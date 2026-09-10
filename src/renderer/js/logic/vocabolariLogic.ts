// @ts-nocheck

// Fasi 3.3, 3.5 e 3.6 — le operazioni d'archivio su vocabolari controllati, anagrafica di
// persone e luoghi, relazioni fra schede e duplicati della segnatura.
//
// Stessa divisione in tre strati di `tagsLogic.ts`, e per la stessa ragione: l'aritmetica
// (chiavi, propagazioni, unioni) sta in `shared/model.ts`, qui restano stato, salvataggio,
// undo e i18n — le tre cose che il modello non può conoscere — e i modali stanno nei
// componenti.
//
// PREFISSO `_vc` sugli helper privati: il bundle concatena tutti gli script in UNO scope.

function _vcT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

async function _vcAutore() {
    try {
        const settings = await window.apiSettings.get();
        return settings.username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
        return 'Anonimo';
    }
}

/**
 * Fotografia profonda delle schede indicate più delle tre anagrafiche di primo livello.
 * È ciò che l'undo rimette a posto: copiare l'intero archivio per una rinomina che tocca
 * quattro schede sarebbe uno spreco proporzionale alla dimensione del vault.
 */
function _vcFotografia(ids) {
    const set = new Set((ids || []).map(String));
    return {
        schede: (appData.manoscritti || [])
            .filter(m => m && set.has(String(m.id)))
            .map(m => JSON.parse(JSON.stringify(m))),
        vocabolari: JSON.parse(JSON.stringify(window.Model.vocabolari(appData))),
        authority: JSON.parse(JSON.stringify(window.Model.authority(appData)))
    };
}

async function _vcApplica(descrizione, messaggio, schedeToccate, foto) {
    if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    await window.Store.commit();

    const ripristina = async () => {
        for (const vecchio of foto.schede) {
            const i = appData.manoscritti.findIndex(m => String(m.id) === String(vecchio.id));
            // Come nell'undo delle azioni in massa: una scheda sparita nel frattempo non si
            // resuscita — l'undo annulla una modifica, non una cancellazione altrui.
            if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(vecchio));
        }
        appData.vocabolari = JSON.parse(JSON.stringify(foto.vocabolari));
        appData.authority = JSON.parse(JSON.stringify(foto.authority));
        await window.Store.commit();
    };

    const testo = String(messaggio).replace('{var0}', String(schedeToccate));
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(descrizione, ripristina);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(testo, 'success', () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    } else if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(testo, 'success');
    }
}

// --- Vocabolari controllati (3.3) ---------------------------------------------

/** Tutti i vocabolari, in ordine alfabetico di nome. */
window.elencoVocabolari = function() {
    const voc = window.Model.vocabolari(appData);
    return Object.keys(voc)
        .map(id => voc[id])
        .filter(v => v && Array.isArray(v.valori))
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it', { sensitivity: 'base' }));
};

window.salvaVocabolarioArchivio = async function(voc) {
    if (!window.Model.salvaVocabolario(appData, voc)) return false;
    await window.Store.commit();
    return true;
};

/**
 * L'"aggiungi al volo" del form. Non passa da `_vcApplica`: non tocca alcun record — il
 * vocabolario è una chiave di primo livello — quindi non c'è niente da fotografare.
 */
window.aggiungiValoreVocabolario = async function(id, valore) {
    if (!window.Model.aggiungiValoreVocabolario(appData, id, valore)) return false;
    await window.Store.commit();
    return true;
};

window.rinominaValoreVocabolario = async function(id, da, a) {
    // I bersagli si calcolano PRIMA: dopo la rinomina nessuna scheda porta più il valore
    // vecchio, e la fotografia sarebbe vuota.
    const bersagli = window.Model.campiDelVocabolario(appData, id);
    const chiave = window.Model.chiaveTesto(da);
    const ids = (appData.manoscritti || []).filter(m => m && bersagli.some(b =>
        String(m.tipoDocumento) === b.tipo && window.Model.chiaveTesto(m[b.campo]) === chiave
    )).map(m => m.id);
    const foto = _vcFotografia(ids);

    const esito = window.Model.rinominaValoreVocabolario(appData, id, da, a, { autore: await _vcAutore() });
    if (!esito.cambiato) return 0;
    await _vcApplica(
        _vcT('undo_vocab_rename', 'Rinomina di un valore'),
        _vcT('msg_vocab_renamed', 'Valore rinominato su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.eliminaValoreVocabolario = async function(id, valore) {
    if (!window.Model.eliminaValoreVocabolario(appData, id, valore)) return false;
    await window.Store.commit();
    // Le schede che portavano quel valore lo conservano: dirlo evita la domanda "l'ho perso?".
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(_vcT('msg_vocab_value_removed', 'Valore tolto dall\'elenco. Le schede che lo contengono lo conservano.'), 'info');
    }
    return true;
};

window.eliminaVocabolarioArchivio = async function(id) {
    if (!window.Model.eliminaVocabolario(appData, id)) return false;
    await window.Store.commit();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(_vcT('msg_vocab_deleted', 'Vocabolario eliminato. I campi che lo usavano conservano i valori come elenco proprio.'), 'info');
    }
    return true;
};

// --- Duplicati della segnatura (3.6) ------------------------------------------

/** I gruppi di schede con la stessa segnatura, ognuno con le schede vere (non i soli id). */
window.duplicatiSegnatura = function() {
    const perId = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    return window.Model.gruppiDuplicati(appData.manoscritti, 'segnatura')
        .map(g => ({ valore: g.valore, schede: g.ids.map(id => perId.get(id)).filter(Boolean) }))
        .filter(g => g.schede.length > 1);
};

// --- Relazioni fra schede (3.5) -----------------------------------------------

/**
 * Le relazioni di una scheda, uscenti ed entranti, già risolte in schede vere.
 *
 * Gli id che non corrispondono a nessuna scheda si SALTANO senza cancellarli dal dato: su un
 * archivio condiviso la scheda può esistere sulla copia di un collega e non ancora sulla
 * nostra, e ripulire d'ufficio un rimando romperebbe il collegamento per tutti.
 */
window.relazioniRisolte = function(id) {
    const perId = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    const m = perId.get(String(id));
    const uscenti = (m ? window.Model.relazioni(m) : [])
        .map(r => ({ tipo: r.tipo || '', scheda: perId.get(r.id) }))
        .filter(r => r.scheda);
    const entranti = window.Model.relazioniEntranti(appData.manoscritti, id)
        .map(r => ({ tipo: r.tipo || '', scheda: perId.get(r.id) }))
        .filter(r => r.scheda);
    return { uscenti, entranti };
};

window.collegaSchede = async function(idA, idB, tipo) {
    const foto = _vcFotografia([idA]);
    if (!window.Model.aggiungiRelazione(appData, idA, idB, tipo)) return false;
    const a = appData.manoscritti.find(m => String(m.id) === String(idA));
    if (a) { a.lastModified = Date.now(); a.modificatoDa = await _vcAutore(); }
    await _vcApplica(
        _vcT('undo_link_add', 'Collegamento fra schede'),
        _vcT('msg_link_added', 'Collegamento aggiunto.'),
        1, foto
    );
    return true;
};

window.scollegaSchede = async function(idA, idB) {
    const foto = _vcFotografia([idA]);
    if (!window.Model.rimuoviRelazione(appData, idA, idB)) return false;
    const a = appData.manoscritti.find(m => String(m.id) === String(idA));
    if (a) { a.lastModified = Date.now(); a.modificatoDa = await _vcAutore(); }
    await _vcApplica(
        _vcT('undo_link_del', 'Rimozione di un collegamento'),
        _vcT('msg_link_removed', 'Collegamento rimosso.'),
        1, foto
    );
    return true;
};

// --- Authority record: persone e luoghi (3.5) ---------------------------------

/**
 * La funzione `(tipoDocumento) => definizioni` che il modello si fa passare per sapere quali
 * campi alimentano l'anagrafica. Il modello non può risolverla da sé: le definizioni dei
 * campi base stanno in `CONFIG_CAMPI`, cioè nel renderer, insieme alla i18n.
 */
function _vcCampiDi(tipoId) {
    const tipo = (appData.tipiDocumento || []).find(t => t && t.id === tipoId);
    return window.Model.campiDelTipo(tipo, window.CONFIG_CAMPI, appData);
}
window.campiDelTipoId = _vcCampiDi;

/** Persone e luoghi ricavati dalle schede, con quante schede li citano. */
window.elencoAuthority = function(tipo) {
    const voci = window.Model.vociAuthority(appData.manoscritti, _vcCampiDi, appData);
    return tipo ? voci.filter(v => v.tipo === tipo) : voci;
};

window.rinominaAuthorityArchivio = async function(tipo, da, a) {
    const chiave = window.Model.chiaveAuthority(tipo, da);
    const voce = window.Model.vociAuthority(appData.manoscritti, _vcCampiDi, appData)
        .find(v => v.chiave === chiave);
    const foto = _vcFotografia(voce ? voce.ids : []);

    const esito = window.Model.rinominaAuthority(appData, tipo, da, a, _vcCampiDi, { autore: await _vcAutore() });
    if (!esito.cambiato) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_vcT('msg_tag_nothing', 'Nessuna scheda modificata.'), 'info');
        return 0;
    }
    await _vcApplica(
        _vcT('undo_auth_rename', 'Rinomina in anagrafica'),
        _vcT('msg_auth_renamed', 'Nome aggiornato su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.salvaNotaAuthority = async function(tipo, nome, note) {
    if (!window.Model.salvaVoceAuthority(appData, tipo, nome, { nome, note })) return false;
    await window.Store.commit();
    return true;
};
