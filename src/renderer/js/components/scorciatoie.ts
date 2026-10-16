function inCampoDiTesto(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

function scorciatoiaSuSchede(e) {
    if (inCampoDiTesto(document.activeElement)) return false;
    if (document.querySelector('.modal-overlay:not(.hidden-tab)')) return false;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim() !== '') return false;
    return true;
}

function collegaScorciatoie() {
    document.addEventListener('keydown', function(e) {
        const vTrascrizione = document.getElementById('view-trascrizione');

        if (vTrascrizione && !vTrascrizione.classList.contains('hidden-tab')) {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(-1);
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(1);
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                window.alternaSchedaTrascrizione();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (typeof salvaTrascrizione === 'function') salvaTrascrizione();
            }
            if (e.altKey && e.key === 'f') {
                e.preventDefault();
                if (typeof toggleFullscreenAllegato === 'function') toggleFullscreenAllegato();
            }
            if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const pannello = document.getElementById('trasc-caratteri');
                const aperto = pannello && !pannello.classList.contains('hidden-tab');
                window.toggleCaratteriSpeciali(!aperto || !pannello.contains(document.activeElement), true);
            }
            if (!(e.key === 'Escape' && document.querySelector('.modal-overlay:not(.hidden-tab)'))) return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (searchInput) {
                if (typeof switchTab === 'function') switchTab('list');
                if (typeof window.apriSidebarTab === 'function') window.apriSidebarTab('search');
                searchInput.focus();
                searchInput.select();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            if (typeof switchTab === 'function') switchTab('add');
            const segInput = document.getElementById('form-segnatura');
            if (segInput) segInput.focus();
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
            const vAdd = document.getElementById('view-add');
            const btnDoc = document.getElementById('btn-documento-scheda');
            if (vAdd && !vAdd.classList.contains('hidden-tab') && btnDoc && !btnDoc.classList.contains('hidden-tab')) {
                e.preventDefault();
                window.alternaDocumentoScheda();
                return;
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            const vAdd = document.getElementById('view-add');
            if (vAdd && !vAdd.classList.contains('hidden-tab')) {
                e.preventDefault();
                const form = document.getElementById('manoscritto-form');
                if (form) {
                    const event = new Event('submit', { cancelable: true });
                    form.dispatchEvent(event);
                }
            }
        }

        if (scorciatoiaSuSchede(e)) {
            const selezionate = (window.selectedRecords && window.selectedRecords.length) || 0;
            const k = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;

            if (ctrl && e.shiftKey && k === 'e' && selezionate > 0) {
                e.preventDefault();
                window.esportaSelezionatiCsv('csv');
                return;
            }
            if (ctrl && e.shiftKey && typeof window.apriAzioneMassa === 'function' && (k === 'm' || k === 't' || k === 'l')) {
                e.preventDefault();
                window.apriAzioneMassa(k === 'm' ? 'cartella' : (k === 't' ? 'tipo' : 'tag'));
                return;
            }
            if (ctrl && !e.shiftKey && k === 'a') {
                e.preventDefault();
                window.selezionaTuttiIRisultati();
                return;
            }
            if (ctrl && !e.shiftKey && k === 'd') {
                e.preventDefault();
                window.azzeraSelezione();
                return;
            }
            if (ctrl && !e.shiftKey && k === 'h' && typeof window.apriAzioneMassa === 'function') {
                e.preventDefault();
                window.apriAzioneMassa('sostituisci');
                return;
            }
            if (selezionate > 0) {
                if (ctrl && !e.shiftKey && k === 'c') { e.preventDefault(); window.copiaSelezionati(); return; }
                if (ctrl && !e.shiftKey && k === 'x') { e.preventDefault(); window.tagliaSelezionati(); return; }
                if (ctrl && !e.shiftKey && k === 'e') { e.preventDefault(); window.esportaSelezionati(); return; }
                if (e.key === 'Delete' && !ctrl) { e.preventDefault(); window.eliminaSelezionati(); return; }
                if (e.key === 'F2' && selezionate === 1) { e.preventDefault(); window.editItem(window.selectedRecords[0]); return; }
            }
            if (ctrl && !e.shiftKey && k === 'v') {
                const appunti = ((window.copiedRecordIds && window.copiedRecordIds.length) || 0)
                    + ((window.cutRecordIds && window.cutRecordIds.length) || 0);
                if (appunti > 0) {
                    e.preventDefault();
                    window.incollaRecord(undefined);
                    return;
                }
            }
        }

        if (e.key === 'Escape') {
            const aperti = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden-tab)'));
            if (aperti.length > 0) {
                let top = aperti[0];
                let topZ = -1;
                for (const m of aperti) {
                    const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
                    if (z >= topZ) { topZ = z; top = m; }
                }

                chiudiModaleTop(top);
                return;
            }

            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (searchInput && document.activeElement === searchInput) {
                searchInput.value = '';
                searchInput.blur();
                if (typeof renderMain === 'function') renderMain();
                if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
                return;
            }

            if ((window.selectedRecords && window.selectedRecords.length) > 0 && !inCampoDiTesto(document.activeElement)) {
                window.azzeraSelezione();
            }
        }
    });
}
