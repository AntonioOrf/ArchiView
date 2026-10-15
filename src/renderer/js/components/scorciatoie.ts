// Scorciatoie da tastiera globali (trascrizione, scheda, selezione, Esc). Spostato da app.ts
// (PIANO-REFACTOR Fase 6). Esc sui modali passa da `chiudiModaleTop` (pilaModali.ts).

function inCampoDiTesto(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

/**
 * Vero quando una scorciatoia che agisce sulle SCHEDE può scattare: fuori dai campi
 * di testo (dove Ctrl+C, Canc e F2 hanno un significato loro), con nessun modale
 * aperto, e senza una selezione di testo in corso — quella è quasi sempre un utente
 * che sta copiando una segnatura dalla card, e rubargli Ctrl+C sarebbe il modo più
 * rapido per rendere la scorciatoia odiosa.
 */
function scorciatoiaSuSchede(e) {
    if (inCampoDiTesto(document.activeElement)) return false;
    if (document.querySelector('.modal-overlay:not(.hidden-tab)')) return false;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim() !== '') return false;
    return true;
}

/** Registra il listener `keydown` globale. Da chiamare una volta. */
function collegaScorciatoie() {
    // Scorciatoie da tastiera
    document.addEventListener('keydown', function(e) {
        const vTrascrizione = document.getElementById('view-trascrizione');

        // Salva trascrizione con Ctrl+S o sfoglia
        if (vTrascrizione && !vTrascrizione.classList.contains('hidden-tab')) {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(-1);
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(1);
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                // Ctrl+Maiusc+S alterna i tab «Testo» e «Scheda»; va prima di Ctrl+S, che
                // con Maiusc ha comunque `key` 's'.
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
            // Alt+K apre i caratteri speciali col fuoco sul primo; senza Ctrl, che con Alt è AltGr.
            if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const pannello = document.getElementById('trasc-caratteri');
                const aperto = pannello && !pannello.classList.contains('hidden-tab');
                window.toggleCaratteriSpeciali(!aperto || !pannello.contains(document.activeElement), true);
            }
            // Interrompe qui se siamo in modalità trascrizione, tranne Esc su un modale aperto
            // sopra la vista (confronto carte, esporta): va al ramo Esc più sotto.
            if (!(e.key === 'Escape' && document.querySelector('.modal-overlay:not(.hidden-tab)'))) return;
        }

        // --- SCORCIATOIE GLOBALI ---
        // Ctrl+F -> Cerca
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            if (searchInput) {
                if (typeof switchTab === 'function') switchTab('list');
                // Il campo vive nel pannello 'search' della sidebar: se e' chiuso o
                // sostituito da un altro tab, il focus finiva su un elemento nascosto.
                if (typeof window.apriSidebarTab === 'function') window.apriSidebarTab('search');
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Ctrl+N -> Nuovo Documento
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            if (typeof switchTab === 'function') switchTab('add');
            const segInput = document.getElementById('form-segnatura');
            if (segInput) segInput.focus();
        }

        // Ctrl+Maiusc+S -> nel modulo della scheda, il documento accanto (prima di Ctrl+S: con
        // Maiusc `key` resta 's'). Solo su una scheda con carte, dove c'è il pulsante.
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
            const vAdd = document.getElementById('view-add');
            const btnDoc = document.getElementById('btn-documento-scheda');
            if (vAdd && !vAdd.classList.contains('hidden-tab') && btnDoc && !btnDoc.classList.contains('hidden-tab')) {
                e.preventDefault();
                window.alternaDocumentoScheda();
                return;
            }
        }

        // Ctrl+S -> Salva Scheda (se siamo nel tab di inserimento)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            const vAdd = document.getElementById('view-add');
            if (vAdd && !vAdd.classList.contains('hidden-tab')) {
                e.preventDefault();
                // trigger form submit per sfruttare la validazione
                const form = document.getElementById('manoscritto-form');
                if (form) {
                    const event = new Event('submit', { cancelable: true });
                    form.dispatchEvent(event);
                }
            }
        }

        // --- SCORCIATOIE SU SELEZIONE E AZIONI IN MASSA (Fase 1.5) ---
        //
        // Tutte guardate da `scorciatoiaSuSchede`: dentro un campo di testo Ctrl+C deve
        // copiare il testo, non le schede, e sopra un modale aperto nessuna di queste
        // deve agire su una lista che l'utente in quel momento non sta guardando.
        if (scorciatoiaSuSchede(e)) {
            const selezionate = (window.selectedRecords && window.selectedRecords.length) || 0;
            const k = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;

            // Ctrl+Maiusc+X va valutato PRIMA di Ctrl+X: `key` con Maiusc è comunque 'x',
            // e senza questo ordine "cambia tipo" verrebbe intercettato da "taglia".
            // Fase 2.1: Ctrl+Maiusc+E = CSV, accanto a Ctrl+E = ZIP. Va prima del blocco
            // Ctrl+E per lo stesso motivo di Ctrl+Maiusc+X: `key` con Maiusc resta 'e'.
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
            // Copia/taglia/esporta/elimina hanno senso solo con una selezione: senza,
            // devono restare inerti e lasciare il tasto al comportamento nativo.
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
                    // `undefined` = cartella corrente, la stessa destinazione del tasto
                    // destro sullo sfondo (vedi voceMenuIncolla).
                    window.incollaRecord(undefined);
                    return;
                }
            }
        }

        // Esc -> Chiudi SOLO il modale in primo piano (non tutti in blocco) oppure
        // pulisci la barra di ricerca. La chiusura passa per gli handler dedicati così
        // da eseguire i cleanup (reset iframe PDF, callback di annullamento, ecc.).
        if (e.key === 'Escape') {
            const aperti = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden-tab)'));
            if (aperti.length > 0) {
                // Determina il modale in cima allo stack (z-index più alto)
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

            // Ultimo anello: Esc azzera la selezione. Va DOPO modali e ricerca — una
            // selezione multipla costruita a fatica non deve sparire per un Esc dato a
            // una finestra — ed è l'uscita che mancava a chi seleziona con Ctrl+A.
            if ((window.selectedRecords && window.selectedRecords.length) > 0 && !inCampoDiTesto(document.activeElement)) {
                window.azzeraSelezione();
            }
        }
    });
}
