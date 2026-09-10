// @ts-nocheck

// Fase 3.4 — Tag come entità: le operazioni di ARCHIVIO (rinomina, fusione, eliminazione,
// colore) e la resa dei chip.
//
// Perché non in bulkActions.ts: quelle agiscono sulla SELEZIONE e passano da
// `applicaInMassa`. Queste agiscono su tutte le schede che portano un tag, selezionate o
// no — rinominare `pergamena` deve toccare l'archivio intero anche se l'utente non ha
// selezionato niente — e quindi hanno bisogno di un proprio undo e di un proprio salvataggio.
//
// Tutta l'aritmetica dei tag (chiavi, deduplica, propagazione) sta in `shared/model.ts`:
// qui restano solo lo stato (`appData`), il salvataggio, l'undo e la i18n, cioè le tre cose
// che il modello non può conoscere.

/** Il nome globale `_tg` per gli helper privati: il bundle concatena tutto in UNO scope. */
function _tgT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

async function _tgAutore() {
    try {
        const settings = await window.apiSettings.get();
        return settings.username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
        return 'Anonimo';
    }
}

/**
 * Fotografia profonda delle sole schede che portano uno dei tag indicati, più
 * dell'anagrafica. È ciò che l'undo rimette a posto: copiare l'intero archivio per una
 * rinomina che tocca tre schede sarebbe uno spreco proporzionale alla dimensione del vault.
 */
function _tgFotografia(chiavi) {
    const set = new Set((chiavi || []).map(c => window.Model.chiaveTag(c)).filter(Boolean));
    const schede = [];
    for (const m of appData.manoscritti || []) {
        for (const t of window.Model.tags(m)) {
            if (!set.has(window.Model.chiaveTag(t))) continue;
            schede.push(JSON.parse(JSON.stringify(m)));
            break;
        }
    }
    return { schede, anagrafica: JSON.parse(JSON.stringify(window.Model.anagraficaTag(appData))) };
}

async function _tgApplica(descrizione, messaggio, schedeToccate, foto) {
    if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    await window.Store.commit();

    const ripristina = async () => {
        for (const vecchio of foto.schede) {
            const i = appData.manoscritti.findIndex(m => String(m.id) === String(vecchio.id));
            // Come nell'undo delle azioni in massa: una scheda sparita nel frattempo non
            // si resuscita — l'undo annulla una modifica, non una cancellazione altrui.
            if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(vecchio));
        }
        appData.tagsAnagrafica = JSON.parse(JSON.stringify(foto.anagrafica));
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

/**
 * Se il tag filtrato viene rinominato o fuso, il filtro attivo punta a un tag che non
 * esiste più e la griglia resta vuota senza spiegazione. Il filtro segue la rinomina.
 */
function _tgSegui(da, a) {
    if (!window.activeTags || window.activeTags.size === 0) return;
    const vecchia = window.Model.chiaveTag(da);
    const nuovi = new Set();
    let cambiato = false;
    for (const t of window.activeTags) {
        if (window.Model.chiaveTag(t) === vecchia) { cambiato = true; if (a) nuovi.add(a); }
        else nuovi.add(t);
    }
    if (!cambiato) return;
    window.activeTags.clear();
    for (const t of nuovi) window.activeTags.add(t);
}

// --- Operazioni ---------------------------------------------------------------

/** Registra nell'anagrafica i tag comparsi in un salvataggio. Nessun undo: non è un'azione. */
window.registraTagUsati = function(tags) {
    return window.Model.registraTag(appData, tags);
};

window.rinominaTagArchivio = async function(da, a) {
    // La fotografia PRIMA della mutazione: dopo, fotograferebbe il risultato e l'undo
    // rimetterebbe a posto ciò che ha appena cambiato, cioè niente.
    const foto = _tgFotografia([da, a]);
    const esito = window.Model.rinominaTag(appData, da, a, { autore: await _tgAutore() });
    if (!esito.cambiato) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_tgT('msg_tag_nothing', 'Nessuna scheda modificata.'), 'info');
        return 0;
    }
    _tgSegui(da, a);
    await _tgApplica(
        _tgT('undo_tag_rename', 'Rinomina di un tag'),
        _tgT('msg_tag_renamed', 'Tag rinominato su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.fondiTagArchivio = async function(sorgenti, destinazione) {
    const lista = window.Model.listaTag(sorgenti);
    const foto = _tgFotografia(lista.concat([destinazione]));
    const esito = window.Model.fondiTag(appData, lista, destinazione, { autore: await _tgAutore() });
    if (!esito.cambiato) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_tgT('msg_tag_nothing', 'Nessuna scheda modificata.'), 'info');
        return 0;
    }
    for (const s of lista) _tgSegui(s, destinazione);
    await _tgApplica(
        _tgT('undo_tag_merge', 'Fusione di tag'),
        _tgT('msg_tag_merged', 'Tag fusi su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.eliminaTagArchivio = async function(tag) {
    const foto = _tgFotografia([tag]);
    const esito = window.Model.eliminaTag(appData, tag, { autore: await _tgAutore() });
    if (!esito.cambiato) return 0;
    _tgSegui(tag, null);
    await _tgApplica(
        _tgT('undo_tag_delete', 'Eliminazione di un tag'),
        _tgT('msg_tag_deleted', 'Tag rimosso da {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

/**
 * Il colore NON passa da `_tgApplica`: non tocca alcun record — vive nell'anagrafica, che
 * è una chiave di primo livello — quindi non c'è nulla da fotografare, nessuna firma da
 * apporre e nessun messaggio da mostrare. È anche la ragione per cui colorare un tag non
 * fa apparire mezzo archivio come "modificato" al prossimo sync.
 */
window.impostaColoreTagArchivio = async function(tag, colore) {
    if (!window.Model.impostaColoreTag(appData, tag, colore)) return false;
    await window.Store.commit();
    return true;
};

// --- Resa ---------------------------------------------------------------------

/**
 * La classe CSS del chip. Il colore è un NOME nell'anagrafica (vedi shared/model.ts): la
 * traduzione in valori la fa il foglio di stile, che è l'unico posto a sapere che esiste
 * anche un tema scuro.
 */
window.classeColoreTag = function(tag) {
    const colore = window.Model.coloreTag(appData, tag);
    return colore ? 'card-tag tag-col-' + colore : 'card-tag';
};

/** Un chip già pronto. Usato da griglia e tabella, che prima costruivano lo span a mano. */
window.chipTagHTML = function(tag) {
    return '<span class="' + window.classeColoreTag(tag) + '">' + escapeHTML(tag) + '</span>';
};
