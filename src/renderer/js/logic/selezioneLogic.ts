window.lastSelectedId = null;
window.selectedRecords = window.selectedRecords || [];
window.copiedRecordIds = window.copiedRecordIds || [];
window.cutRecordIds = window.cutRecordIds || [];

window.selectItem = function(id, event) {
    if (!event) event = window.event || {};
    
    const currentRenderedIds = Array.from(document.querySelectorAll('.card-scheda')).map(el => el.id.replace('card-', ''));
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;

    if (isShift && window.lastSelectedId && currentRenderedIds.includes(window.lastSelectedId) && currentRenderedIds.includes(id)) {
        const startIdx = currentRenderedIds.indexOf(window.lastSelectedId);
        const endIdx = currentRenderedIds.indexOf(id);
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        
        if (!isCtrl) {
            window.selectedRecords = [];
        }
        
        for (let i = minIdx; i <= maxIdx; i++) {
            const sid = currentRenderedIds[i];
            if (!window.selectedRecords.includes(sid)) {
                window.selectedRecords.push(sid);
            }
        }
    } else if (isCtrl) {
        const idx = window.selectedRecords.indexOf(id);
        if (idx === -1) {
            window.selectedRecords.push(id);
        } else {
            window.selectedRecords.splice(idx, 1);
        }
        window.lastSelectedId = id;
    } else {
        if (window.selectedRecords.length === 1 && window.selectedRecords[0] === id) {
            window.selectedRecords = [];
            window.lastSelectedId = null;
        } else {
            window.selectedRecords = [id];
            window.lastSelectedId = id;
        }
    }

    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    window.aggiornaStatoSelezione();
};

window.aggiornaStatoSelezione = function() {
    if (typeof window.aggiornaBarraStato === 'function') window.aggiornaBarraStato();
    const ind = document.getElementById('selection-indicator');
    if (!ind) return;
    const n = (window.selectedRecords && window.selectedRecords.length) || 0;
    ind.classList.toggle('hidden', n === 0);
    if (n === 0) {
        ind.innerText = '';
        return;
    }
    ind.innerText = n === 1
        ? window.t('selection_count_one', '1 scheda selezionata')
        : window.t('selection_count_many', '{var0} schede selezionate').replace('{var0}', String(n));
};

window.azzeraSelezione = function() {
    window.selectedRecords = [];
    window.lastSelectedId = null;
    window.aggiornaStatoSelezione();
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
};

window.esportaSelezionati = async function() {
    if (window.selectedRecords.length === 0) return;
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.exportZip(window.selectedRecords);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_esportazione_di_var_recor", '{var0} schede esportate.').replace("{var0}", String(res.count)), "success");
        window.selectedRecords = [];
        window.aggiornaStatoSelezione();
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

window.eliminaSelezionati = async function() {
    if (window.selectedRecords.length === 0) return;
    const count = window.selectedRecords.length;
    
    const procediEliminazione = async () => {
        const recordDaEliminare = appData.manoscritti.filter(m => window.selectedRecords.includes(m.id));
        const recordSalvati = JSON.parse(JSON.stringify(recordDaEliminare));

        if (typeof window.cestinaRecord === 'function') {
            await window.cestinaRecord(recordSalvati, window.origineCestino(count));
        }

        const idsEliminati = recordSalvati.map(r => String(r.id));
        let rimandi = await window.Store.eliminaSchede(idsEliminati);
        window.selectedRecords = [];
        window.aggiornaStatoSelezione();

        const ripristinaFn = async () => {
            window.Store.togliTombstone(idsEliminati);
            window.Store.rimettiRimandi(rimandi);
            appData.manoscritti.push(...JSON.parse(JSON.stringify(recordSalvati)));
            await window.Store.commit();
        };

        const rifaiFn = async () => {
            const vivi = appData.manoscritti.filter(m => idsEliminati.includes(String(m.id)));
            if (vivi.length === 0) return;
            if (typeof window.cestinaRecord === 'function') {
                await window.cestinaRecord(vivi, window.origineCestino(vivi.length));
            }
            rimandi = await window.Store.eliminaSchede(idsEliminati);
        };

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(window.t('undo_delete_records', "Eliminazione di {var0} schede").replace('{var0}', String(count)), ripristinaFn, rifaiFn);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_eliminati", "{var0} record eliminati.").replace("{var0}", String(count)), "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    };

    if (typeof window.mostraBottomConfirm === 'function') {
        const msg = count > 1 
            ? window.t("confirm_delete_multiple", "Sei sicuro di voler eliminare {var0} record selezionati? L\'operazione è irreversibile.").replace("{var0}", String(count))
            : window.t("confirm_delete_single", "Sei sicuro di voler eliminare questo record? L\'operazione è irreversibile.");
        window.mostraBottomConfirm(msg, procediEliminazione);
    } else {
        await procediEliminazione();
    }
};

window.copiaSelezionati = function() {
    if (window.selectedRecords.length === 0) return;
    window.copiedRecordIds = [...window.selectedRecords];
    window.cutRecordIds = [];
    const count = window.copiedRecordIds.length;
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_copiati_negli_", "{var0} record copiati negli appunti di ArchiView. Tasto destro per incollarli in un altro archivio.").replace("{var0}", String(count)), "info");
    window.selectedRecords = [];
    window.aggiornaStatoSelezione();
    setTimeout(() => {
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }, 50);
};

window.tagliaSelezionati = function() {
    if (window.selectedRecords.length === 0) return;
    window.cutRecordIds = [...window.selectedRecords];
    window.copiedRecordIds = [];
    const count = window.cutRecordIds.length;
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_tagliati_tasto", "{var0} record tagliati. Tasto destro per spostarli in un altro archivio.").replace("{var0}", String(count)), "info");
    window.selectedRecords = [];
    window.aggiornaStatoSelezione();
    setTimeout(() => {
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }, 50);
};

window.copiaCartella = function(folderPath) {
    window.copiedFolderPath = folderPath;
    window.cutFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_cartella_copiata_tasto_de", "Cartella copiata. Tasto destro su un'altra cartella per incollarla."), "info");
};

window.tagliaCartella = function(folderPath) {
    if (!folderPath) return;
    window.cutFolderPath = folderPath;
    window.copiedFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_cartella_tagliata_tasto_d", "Cartella tagliata. Tasto destro per spostarla."), "info");
};
window.incollaRecord = async function(targetFolderOverride) {
    const targetFolder = targetFolderOverride ?? window.cartellaAttuale ?? '';

    if (window.cutFolderPath) {
        if (typeof spostaCartella === 'function') {
            await spostaCartella(window.cutFolderPath, targetFolder === '' ? 'ROOT' : targetFolder);
            window.cutFolderPath = null;
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_spostato_con_suc", 'Archivio spostato.'), "success");
        }
        return;
    }

    if (window.copiedFolderPath) {
        const prefix = window.copiedFolderPath + '/';
        const manoscrittiDaCopiare = appData.manoscritti.filter(m => m.cartella === window.copiedFolderPath || (m.cartella && m.cartella.startsWith(prefix)));
        
        if (manoscrittiDaCopiare.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_copiato_vuoto", "La cartella copiata è vuota."), "warning");
            window.copiedFolderPath = null;
            return;
        }

        const idsToCopy = manoscrittiDaCopiare.map(m => m.id);
        
        const nomeArchivioCopiato = window.copiedFolderPath.split('/').pop();
        const baseTarget = (targetFolder === 'ROOT' || targetFolder === '') ? nomeArchivioCopiato : `${targetFolder}/${nomeArchivioCopiato}`;

        const radice = window.copiedFolderPath;
        try {
            const n = await duplicaSchede(manoscrittiDaCopiare, m => baseTarget + (m.cartella.startsWith(radice + '/') ? m.cartella.slice(radice.length) : ''));
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_duplicato_con_su", 'Archivio duplicato ({var0} schede).').replace("{var0}", String(n)), "success");
            window.copiedFolderPath = null;
        } catch (e) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_duplicazione_ar", "Errore in duplicazione archivio: ") + (e && e.message ? e.message : String(e)), "error");
        }
        return;
    }

    if (window.cutRecordIds && window.cutRecordIds.length > 0) {
        let movedCount = 0;
        const provenienza: any[] = [];
        const autore = await autoreCorrente();
        const tagliate = window.cutRecordIds.map(String);
        appData.manoscritti.forEach(m => {
            if (tagliate.includes(String(m.id))) {
                provenienza.push({ id: String(m.id), cartella: m.cartella });
                Object.assign(m, { cartella: targetFolder, lastModified: Date.now(), modificatoDa: autore });
                movedCount++;
            }
        });
        if (movedCount > 0) {
            const spostaIn = async (destinazioni) => {
                for (const [id, cartella] of destinazioni) {
                    const m = appData.manoscritti.find(x => String(x.id) === String(id));
                    if (m) Object.assign(m, { cartella, lastModified: Date.now(), modificatoDa: autore });
                }
                await window.Store.commit();
            };
            if (window.gestoreAnnullamento) {
                window.gestoreAnnullamento.registraAzione(
                    window.t('undo_move_records', 'Spostamento di {var0} schede').replace('{var0}', String(movedCount)),
                    () => spostaIn(provenienza.map(p => [p.id, p.cartella])),
                    () => spostaIn(provenienza.map(p => [p.id, targetFolder]))
                );
            }
            await window.Store.commit();
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_spostati_con_s", '{var0} schede spostate.').replace("{var0}", String(movedCount)), "success");
            window.cutRecordIds = [];
        }
        return;
    }

    if (!window.copiedRecordIds || window.copiedRecordIds.length === 0) return;
    const ids = window.copiedRecordIds.map(String);
    const originali = appData.manoscritti.filter(m => ids.includes(String(m.id)));
    if (originali.length === 0) return;
    try {
        const n = await duplicaSchede(originali, () => targetFolder);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_duplicati_con_", '{var0} schede duplicate.').replace("{var0}", String(n)), "success");
    } catch (e) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_incolla", "Errore in incolla: ") + (e && e.message ? e.message : String(e)), "error");
    }
};

async function duplicaSchede(originali, cartellaDi: (m) => string) {
    let autore = 'Anonimo';
    try { autore = (await window.apiSettings.get()).username || 'Anonimo'; } catch (e) {}
    const cloni = originali.map(o => {
        const c = JSON.parse(JSON.stringify(o));
        delete c.id; delete c.lastModified; delete c.relazioni;
        c.creatoDa = autore;
        c.modificatoDa = autore;
        c.titolo = c.titolo ? c.titolo + ' (Copia)' : 'Copia';
        if (c.segnatura) c.segnatura += ' (Copia)';
        c.cartella = cartellaDi(o);
        return window.Model.creaScheda(c);
    });
    const conFile: any[] = [];
    for (const c of cloni) {
        for (const a of Array.isArray(c.allegati) ? c.allegati : []) {
            if (a && typeof a.nome === 'string' && a.nome && !a.remoto) conFile.push({ a, prefisso: String(c.id) });
        }
    }
    if (conFile.length) {
        const res = await window.apiBrowser.duplicaAllegati(conFile.map(v => ({ nome: v.a.nome, prefisso: v.prefisso })));
        if (!res || !res.success) throw new Error((res && res.error) || 'copia allegati');
        conFile.forEach((v, i) => { if (res.nomi[i]) v.a.nome = res.nomi[i]; });
    }
    appData.manoscritti.push(...cloni);
    await window.Store.commit();
    return cloni.length;
}
