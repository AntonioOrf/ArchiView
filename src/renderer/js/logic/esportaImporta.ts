// Export ZIP e CSV di schede e cartelle, import di un archivio ZIP. Spostato da app.ts
// (PIANO-REFACTOR Fase 6): il lavoro vero lo fa il main (exportImportIpc.ts, csvExport.ts).

window.esportaManoscritto = async function(id) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    // Il main legge il DB dal disco: flush del salvataggio differito.
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportZip([id]);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_completata_c", 'Esportazione completata.'), "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

window.esportaCartellaAttuale = async function() {
    window.esportaSpecificaCartella(window.cartellaAttuale);
};

window.esportaSpecificaCartella = async function(folderName) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    // Radice ('') = intero vault: esporta tutto, non solo le schede non archiviate.
    const manoscrittiInCartella = folderName
        ? appData.manoscritti.filter(m => m.cartella === folderName || (m.cartella || '').startsWith(folderName + '/'))
        : appData.manoscritti.slice();
    if (manoscrittiInCartella.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_vuoto_nulla_da", "La cartella è vuota, nulla da esportare."), "warning");
        return;
    }
    const ids = manoscrittiInCartella.map(m => m.id);
    // Il main legge il DB dal disco: flush del salvataggio differito.
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportZip(ids);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_di_var_recor", '{var0} schede esportate.').replace("{var0}", String(res.count)), "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

/**
 * Fase 2.1 — Esportazione CSV/TSV. Le etichette (CONFIG_CAMPI tradotto) e i nomi dei tipi
 * viaggiano col messaggio IPC: il main non ha accesso alla i18n né allo store del renderer.
 */
window.etichetteColonneExport = function() {
    const et = {
        id: window.t('col_id', 'ID'),
        segnatura: window.t('th_signature', 'Segnatura'),
        tipoDocumento: window.t('col_type', 'Tipo documento'),
        cartella: window.t('th_folder', 'Cartella'),
        tags: window.t('th_tags', 'Tag'),
        allegati: window.t('th_attachments', 'Allegati'),
        lastModified: window.t('th_modified', 'Modificato'),
        modificatoDa: window.t('col_modified_by', 'Modificato da'),
        creatoDa: window.t('col_created_by', 'Creato da'),
        // Fase 2.4: `trascrizione` è una chiave di servizio e NON diventa mai una colonna
        // dell'export, ma è una destinazione dell'import — e le due liste di etichette
        // devono restare una sola, o import ed export chiamerebbero le cose in modo diverso.
        trascrizione: window.t('th_transcription', 'Trascrizione')
    };
    // Le colonne dei campi riusano l'etichetta della vista tabella: un export che chiama
    // le cose in modo diverso dalla UI costringe l'utente a ricostruire la corrispondenza.
    const conf = window.CONFIG_CAMPI || {};
    const etichetta = window.etichettaCampo || ((k) => (conf[k] && conf[k].label) || k);
    const campi = new Set(Object.keys(conf));
    ((typeof appData !== 'undefined' && appData.tipiDocumento) || []).forEach(t => (t.campi || []).forEach(c => campi.add(c)));
    campi.forEach(k => { et[k] = etichetta(k); });
    return et;
};

window.nomiTipiExport = function() {
    const nomi = {};
    ((typeof appData !== 'undefined' && appData.tipiDocumento) || []).forEach(t => {
        const chiave = 'model_' + t.id;
        const tradotto = window.t(chiave);
        nomi[t.id] = tradotto && tradotto !== chiave ? tradotto : (t.nome || t.id);
    });
    return nomi;
};

window.esportaCsv = async function(ids, formato = 'csv') {
    if (!window.apiBrowser || !window.apiBrowser.exportCsv) return;
    if (!ids || ids.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_vuoto_nulla_da", "La cartella è vuota, nulla da esportare."), "warning");
        return;
    }
    // Il main legge il DB dal disco: flush del salvataggio differito.
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportCsv(ids, {
        formato,
        titolo: window.t('dialog_export_csv', 'Esporta in CSV/TSV'),
        etichette: window.etichetteColonneExport(),
        nomiTipi: window.nomiTipiExport(),
        // Fase 3.1: i campi `sì/no` sono booleani nel record, e il main non conosce la
        // i18n — senza queste due parole scriverebbe `true` in una colonna di Excel.
        testi: { si: window.t('value_yes', 'Sì'), no: window.t('value_no', 'No') }
    });
    if (res && res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_di_var_recor", '{var0} schede esportate.').replace("{var0}", String(res.count)), "success");
    } else if (res && !res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + (res.error || ''), "error");
    }
};

/** CSV di una cartella e delle sue sottocartelle (radice = intero vault, come lo ZIP). */
window.esportaCartellaCsvSpecifica = async function(folderName, formato = 'csv') {
    const inCartella = folderName
        ? appData.manoscritti.filter(m => m.cartella === folderName || (m.cartella || '').startsWith(folderName + '/'))
        : appData.manoscritti.slice();
    await window.esportaCsv(inCartella.map(m => m.id), formato);
};

/** CSV della cartella corrente. */
window.esportaCartellaCsv = async function(formato = 'csv') {
    await window.esportaCartellaCsvSpecifica(window.cartellaAttuale, formato);
};

/** CSV della selezione corrente: a differenza dello ZIP la selezione non viene azzerata. */
window.esportaSelezionatiCsv = async function(formato = 'csv') {
    await window.esportaCsv((window.selectedRecords || []).slice(), formato);
};

// Un archivio grande si estrae per minuti senza segni di vita: un secondo clic avvierebbe un
// secondo import parallelo e, se riusciti entrambi, ogni scheda entrerebbe due volte.
let importZipInCorso = false;
window.importaManoscritto = async function() {
    if (!window.apiBrowser || !window.apiBrowser.importZip || importZipInCorso) return;
    importZipInCorso = true;
    // Il primo segnale arriva dopo la scelta del file: annullare il dialogo non mostra nulla.
    const stacca = window.apiBrowser.onImportZipAvanzamento?.((p) => window.importZipAvanzamento(p));
    try {
        await importaZip();
    } catch (e) {
        window.importZipFallito({ codice: 'altro', dettaglio: e && e.message ? e.message : String(e) });
    } finally {
        if (stacca) stacca();
        importZipInCorso = false;
    }
};

async function importaZip() {
    const res = await window.apiBrowser.importZip(window.t("dialog_import_zip", "Importa Archivio JSON"));
    if (res.success && res.manoscritti) {
        let addedCount = 0;
        const existingIds = new Set(appData.manoscritti.map(m => m.id));
        
        res.manoscritti.forEach(m => {
            if (existingIds.has(m.id)) {
                m.id = window.Model.nuovoId();
                m.titolo = m.titolo ? m.titolo + ' (Copia)' : '';
            }
            // Fase 3.0 — lo ZIP puo' venire da una versione vecchia dell'app: la scheda va
            // portata alla forma corrente prima di entrare nell'archivio, o resterebbe
            // l'unica non migrata (la migrazione gira all'apertura, non all'import).
            window.Model.normalizzaScheda(m);
            // Essenziale: se l'utente aveva cancellato l'ID, lo stiamo importando esplicitamente, quindi va rimosso dai tombstone!
            window.Store.togliTombstone([m.id]);
            appData.manoscritti.push(m);
            
            // Assicuriamoci che la cartella esista
            if (m.cartella && !appData.cartelle.includes(m.cartella)) {
                appData.cartelle.push(m.cartella);
            }
            
            addedCount++;
        });

        if (window.salvaStatoPosizione) window.salvaStatoPosizione();

        // Salvataggio scatena l'update chokidar ma avendo già appData aggiornato in memoria,
        // sincronizzaEUnisciDati non avrà problemi o sovrascritture.
        await window.Store.commit();
        if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
        if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
        window.importZipRiuscito({
            schede: addedCount,
            cartelle: new Set(res.manoscritti.map(m => m.cartella).filter(Boolean)).size,
            copiati: res.copiati || 0,
            saltati: res.saltati || 0,
            primaScheda: res.manoscritti.length ? res.manoscritti[0].id : null
        });
    } else if (!res.canceled) {
        window.importZipFallito({ codice: res.codice, dettaglio: res.dettaglio || res.error });
    }
}
