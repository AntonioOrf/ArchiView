document.addEventListener('DOMContentLoaded', async () => {
    if (window.lucide) lucide.createIcons();
    await initData();

    // Primo render per popolare l'interfaccia all'avvio
    if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();
    renderSidebar();
    renderMain();

    // Debounce sulla ricerca: renderMain e renderSearchSuggestions vengono
    // chiamate max 1 volta ogni 150ms invece che ad ogni singolo tasto
    const debouncedRenderMain = debounce(renderMain, 150);
    const debouncedRenderSuggestions = debounce(renderSearchSuggestions, 150);

    document.getElementById('search-input').addEventListener('input', () => {
        debouncedRenderMain();
        debouncedRenderSuggestions();
    });
    document.getElementById('global-tag-search').addEventListener('input', debouncedRenderMain);
    document.getElementById('manoscritto-form').addEventListener('submit', handleFormSubmit);

    // Gestione Anteprime file
    document.getElementById('form-allegato').addEventListener('change', function(e) {
        const fileList = e.target.files;
        const previewNew = document.getElementById('form-allegati-new-preview');
        if (previewNew) {
            if (fileList.length > 0) {
                previewNew.textContent = `${fileList.length} nuovi file pronti per il salvataggio.`;
                previewNew.classList.remove('hidden');
            } else {
                previewNew.classList.add('hidden');
            }
        }
    });

    // Scorciatoie da tastiera
    document.addEventListener('keydown', function(e) {
        const vTrascrizione = document.getElementById('view-trascrizione');
        if (vTrascrizione && !vTrascrizione.classList.contains('hidden-tab')) {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(-1);
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(1);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (typeof salvaTrascrizione === 'function') salvaTrascrizione();
            }
        }
    });

    // Drag to resize Trascrizione panels
    const resizer = document.getElementById('trascrizione-resizer');
    const leftPanel = document.getElementById('trascrizione-editor-panel');
    const container = document.getElementById('trascrizione-container');
    let isResizing = false;

    if (resizer && leftPanel && container) {
        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            leftPanel.style.transition = 'none';
            // Disabilita pointer events su iframe durante il drag
            const iframe = document.getElementById('trasc-pdf-preview');
            if (iframe) iframe.style.pointerEvents = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerRect = container.getBoundingClientRect();
            let newWidth = e.clientX - containerRect.left;

            if (newWidth < 250) newWidth = 250;
            if (newWidth > containerRect.width - 250) newWidth = containerRect.width - 250;

            const percentage = (newWidth / containerRect.width) * 100;
            leftPanel.style.width = `${percentage}%`;
        });

        document.addEventListener('mouseup', async () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                leftPanel.style.transition = '';
                const iframe = document.getElementById('trasc-pdf-preview');
                if (iframe) iframe.style.pointerEvents = '';

                appData.trascrizioneEditorWidth = leftPanel.style.width;
                if (typeof salvaTutto === 'function') await salvaTutto();
            }
        });
    }
});
