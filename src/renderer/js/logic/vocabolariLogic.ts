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
        ripristinaSchede(foto.schede);
        appData.vocabolari = JSON.parse(JSON.stringify(foto.vocabolari));
        appData.authority = JSON.parse(JSON.stringify(foto.authority));
        for (const c of foto.campi || []) {
            const tipo = (appData.tipiDocumento || []).find(x => x && String(x.id) === c.tipo);
            if (tipo && tipo.campiDef && tipo.campiDef[c.campo]) tipo.campiDef[c.campo] = JSON.parse(JSON.stringify(c.def));
        }
        await window.Store.commit();
        if (typeof window.disegnaVocabolari === 'function') window.disegnaVocabolari();
    };

    registraAnnullabile(descrizione, String(messaggio).replace('{var0}', String(schedeToccate)), ripristina);
}

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

window.aggiungiValoreVocabolario = async function(id, valore) {
    if (!window.Model.aggiungiValoreVocabolario(appData, id, valore)) return false;
    await window.Store.commit();
    return true;
};

window.rinominaValoreVocabolario = async function(id, da, a) {
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
    const foto = _vcFotografia([]);
    if (!window.Model.eliminaValoreVocabolario(appData, id, valore)) return false;
    await _vcApplica(
        _vcT('undo_vocab_value_delete', 'Eliminazione di un valore'),
        _vcT('msg_vocab_value_removed', 'Valore tolto dall\'elenco. Le schede che lo contengono lo conservano.'),
        0,
        foto
    );
    return true;
};

window.eliminaVocabolarioArchivio = async function(id) {
    const foto: any = _vcFotografia([]);
    foto.campi = window.Model.campiDelVocabolario(appData, id).map(b => {
        const tipo = (appData.tipiDocumento || []).find(x => x && String(x.id) === b.tipo);
        const def = tipo && tipo.campiDef && tipo.campiDef[b.campo];
        return def ? { tipo: b.tipo, campo: b.campo, def: JSON.parse(JSON.stringify(def)) } : null;
    }).filter(Boolean);
    if (!window.Model.eliminaVocabolario(appData, id)) return false;
    await _vcApplica(
        _vcT('undo_vocab_delete', 'Eliminazione di un vocabolario'),
        _vcT('msg_vocab_deleted', 'Vocabolario eliminato. I campi che lo usavano conservano i valori come elenco proprio.'),
        0,
        foto
    );
    return true;
};

window.duplicatiSegnatura = function() {
    const perId = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    return window.Model.gruppiDuplicati(appData.manoscritti, 'segnatura')
        .map(g => ({ valore: g.valore, schede: g.ids.map(id => perId.get(id)).filter(Boolean) }))
        .filter(g => g.schede.length > 1);
};

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

function _vcCampiDi(tipoId) {
    const tipo = (appData.tipiDocumento || []).find(t => t && t.id === tipoId);
    return window.Model.campiDelTipo(tipo, window.CONFIG_CAMPI, appData);
}

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

window.collegaAuthorityArchivio = async function(tipo, nome, dati) {
    const foto = _vcFotografia([]);
    if (!window.Model.salvaVoceAuthority(appData, tipo, nome, dati)) return false;
    const tolto = !dati.wikidata;
    await _vcApplica(
        _vcT('undo_auth_link', 'Collegamento in anagrafica'),
        tolto ? _vcT('auth_link_removed', 'Collegamento rimosso.') : _vcT('auth_link_saved', 'Voce collegata a Wikidata.'),
        0, foto
    );
    return true;
};

