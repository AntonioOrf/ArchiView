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
        await window.Store.eliminaSchede(idsEliminati);
        window.selectedRecords = [];
        window.aggiornaStatoSelezione();

        const ripristinaFn = async () => {
            window.Store.togliTombstone(idsEliminati);
            appData.manoscritti.push(...JSON.parse(JSON.stringify(recordSalvati)));
            await window.Store.commit();
        };

        const rifaiFn = async () => {
            const vivi = appData.manoscritti.filter(m => idsEliminati.includes(String(m.id)));
            if (vivi.length === 0) return;
            if (typeof window.cestinaRecord === 'function') {
                await window.cestinaRecord(vivi, window.origineCestino(vivi.length));
            }
            await window.Store.eliminaSchede(idsEliminati);
        };

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(`Eliminazione di ${count} record`, ripristinaFn, rifaiFn);
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

        if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
        if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
        const res = await window.apiBrowser.duplicateRecords(idsToCopy, baseTarget);

        if (res.success) {
            if (!appData.cartelle.includes(baseTarget)) {
                appData.cartelle.push(baseTarget);
            }
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_duplicato_con_su", 'Archivio duplicato ({var0} schede).').replace("{var0}", String(res.count)), "success");
            window.copiedFolderPath = null;
            if (window.salvaStatoPosizione) window.salvaStatoPosizione();
            await window.ricaricaDatiDaDisco();
            if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
        } else {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_duplicazione_ar", "Errore in duplicazione archivio: ") + res.error, "error");
        }
        return;
    }

    if (window.cutRecordIds && window.cutRecordIds.length > 0) {
        let movedCount = 0;
        const provenienza = [];
        appData.manoscritti.forEach(m => {
            if (window.cutRecordIds.includes(m.id)) {
                provenienza.push({ id: String(m.id), cartella: m.cartella });
                m.cartella = targetFolder;
                movedCount++;
            }
        });
        if (movedCount > 0) {
            const spostaIn = async (destinazioni) => {
                for (const [id, cartella] of destinazioni) {
                    const m = appData.manoscritti.find(x => String(x.id) === String(id));
                    if (m) m.cartella = cartella;
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
    if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
    
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    const res = await window.apiBrowser.duplicateRecords(window.copiedRecordIds, targetFolder);
    
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_duplicati_con_", '{var0} schede duplicate.').replace("{var0}", String(res.count)), "success");
        if (window.salvaStatoPosizione) window.salvaStatoPosizione();
        await window.ricaricaDatiDaDisco();
        if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
    } else {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_incolla", "Errore in incolla: ") + res.error, "error");
    }
};
