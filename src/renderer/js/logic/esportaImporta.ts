window.esportaManoscritto = async function(id) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
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
    const manoscrittiInCartella = folderName
        ? appData.manoscritti.filter(m => m.cartella === folderName || (m.cartella || '').startsWith(folderName + '/'))
        : appData.manoscritti.slice();
    if (manoscrittiInCartella.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_vuoto_nulla_da", "La cartella è vuota, nulla da esportare."), "warning");
        return;
    }
    const ids = manoscrittiInCartella.map(m => m.id);
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportZip(ids);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_di_var_recor", '{var0} schede esportate.').replace("{var0}", String(res.count)), "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

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
        trascrizione: window.t('th_transcription', 'Trascrizione')
    };
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
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportCsv(ids, {
        formato,
        titolo: window.t('dialog_export_csv', 'Esporta in CSV/TSV'),
        etichette: window.etichetteColonneExport(),
        nomiTipi: window.nomiTipiExport(),
        testi: { si: window.t('value_yes', 'Sì'), no: window.t('value_no', 'No') }
    });
    if (res && res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_di_var_recor", '{var0} schede esportate.').replace("{var0}", String(res.count)), "success");
    } else if (res && !res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + (res.error || ''), "error");
    }
};

window.esportaCartellaCsvSpecifica = async function(folderName, formato = 'csv') {
    const inCartella = folderName
        ? appData.manoscritti.filter(m => m.cartella === folderName || (m.cartella || '').startsWith(folderName + '/'))
        : appData.manoscritti.slice();
    await window.esportaCsv(inCartella.map(m => m.id), formato);
};

window.esportaCartellaCsv = async function(formato = 'csv') {
    await window.esportaCartellaCsvSpecifica(window.cartellaAttuale, formato);
};

window.esportaSelezionatiCsv = async function(formato = 'csv') {
    await window.esportaCsv((window.selectedRecords || []).slice(), formato);
};

let importZipInCorso = false;
window.importaManoscritto = async function() {
    if (!window.apiBrowser || !window.apiBrowser.importZip || importZipInCorso) return;
    importZipInCorso = true;
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
        const { validi, scartati } = window.Model.recordValidi(res.manoscritti);
        if (scartati) console.warn(`[Import ZIP] ${scartati} voci non valide scartate`);
        res.manoscritti = validi;

        const idNuovi = new Map();
        res.manoscritti.forEach(m => {
            if (existingIds.has(m.id)) {
                const vecchio = String(m.id);
                m.id = window.Model.nuovoId();
                idNuovi.set(vecchio, m.id);
                m.titolo = m.titolo ? m.titolo + ' (Copia)' : '';
            }
        });
        const rinominati = res.rinominati || {};
        res.manoscritti.forEach(m => {
            if (Array.isArray(m.relazioni)) {
                for (const r of m.relazioni) if (r && idNuovi.has(String(r.id))) r.id = idNuovi.get(String(r.id));
            }
            if (Array.isArray(m.allegati)) {
                for (const a of m.allegati) if (a && Object.prototype.hasOwnProperty.call(rinominati, a.nome)) a.nome = rinominati[a.nome];
            }
            window.Model.normalizzaScheda(m);
            window.Store.togliTombstone([m.id]);
            appData.manoscritti.push(m);

            const c = m.cartella;
            if (c && Array.isArray(appData.deletedCartelle)) {
                appData.deletedCartelle = appData.deletedCartelle.filter(x => x !== c && !c.startsWith(x + '/'));
            }
            window.Model.registraTag(appData, window.Model.tags(m));

            addedCount++;
        });

        if (window.salvaStatoPosizione) window.salvaStatoPosizione();

        await window.Store.commit();
        if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
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
