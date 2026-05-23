window.apriImpostazioni = async function() {
    document.getElementById('settings-modal').classList.remove('hidden-tab');
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
        const p = await window.apiBrowser.getWorkspacePath();
        document.getElementById('settings-workspace-path').textContent = p || 'Nessuna cartella impostata';
    }
}

window.esportaBackupZip = async function() {
    if (window.apiBrowser && window.apiBrowser.exportWorkspaceZip) {
        mostraMessaggio("Inizializzazione backup...", "info");
        
        const progDiv = document.createElement('div');
        progDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-sm shadow-2xl z-50 min-w-[300px] border border-stone-700 text-center flex flex-col gap-2';
        progDiv.innerHTML = `
            <div class="font-bold text-sm">Esportazione in corso...</div>
            <div class="w-full bg-stone-700 h-2 rounded-full overflow-hidden">
                <div id="export-progress-bar" class="bg-amber-500 h-full w-0 transition-all duration-300"></div>
            </div>
            <div id="export-progress-text" class="text-xs text-stone-300">Calcolo...</div>
        `;
        document.body.appendChild(progDiv);

        if (!window._exportProgressListener && window.apiBrowser.onExportProgress) {
            window.apiBrowser.onExportProgress((progress) => {
                const bar = document.getElementById('export-progress-bar');
                const text = document.getElementById('export-progress-text');
                if (bar && text && progress.entries) {
                    const proc = progress.entries.processed;
                    const total = progress.entries.total;
                    const perc = total > 0 ? Math.round((proc / total) * 100) : 0;
                    bar.style.width = perc + '%';
                    text.textContent = `${proc} di ${total} file elaborati (${perc}%)`;
                }
            });
            window._exportProgressListener = true;
        }

        const result = await window.apiBrowser.exportWorkspaceZip();
        progDiv.remove();

        if (result.success) {
            mostraMessaggio("Backup esportato con successo!", "success");
        } else if (!result.canceled) {
            mostraMessaggio("Errore durante l'esportazione: " + result.error, "error");
        }
    }
}

window.chiudiImpostazioni = function() {
    document.getElementById('settings-modal').classList.add('hidden-tab');
}

window.cambiaCartellaLavoro = async function() {
    if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        await window.apiBrowser.changeWorkspace();
    }
}

window.controllaAggiornamenti = async function(mostraAvvisi = true) {
    if (window.apiBrowser && window.apiBrowser.checkForUpdates) {
        if (mostraAvvisi) mostraMessaggio("Controllo aggiornamenti in corso...", "info");
        
        const result = await window.apiBrowser.checkForUpdates();

        if (result.error) {
            if (mostraAvvisi) mostraMessaggio("Errore: " + result.error, "error");
        } else if (result.updateAvailable) {
            // Mostra il banner non-intrusivo
            const banner = document.getElementById('update-banner');
            document.getElementById('update-banner-text').textContent = `È disponibile la nuova versione ${result.latestVersion} (attuale: ${result.currentVersion})`;
            
            const btn = document.getElementById('btn-scarica-aggiornamento');
            btn.textContent = "Scarica Aggiornamento";
            btn.disabled = false;
            
            btn.onclick = async () => {
                btn.disabled = true;
                btn.textContent = "Avvio download...";
                const res = await window.apiBrowser.downloadUpdate();
                if (res && !res.success) {
                    btn.textContent = "Errore Download";
                    mostraMessaggio("Errore: " + res.error, "error");
                }
            };
            
            if (!window._updateListenersSetup && window.apiBrowser.onUpdateProgress) {
                window.apiBrowser.onUpdateProgress((progressObj) => {
                    const perc = Math.round(progressObj.percent);
                    btn.textContent = `Scaricamento: ${perc}%`;
                });
                
                window.apiBrowser.onUpdateDownloaded(() => {
                    btn.disabled = false;
                    btn.textContent = "Riavvia e Installa";
                    btn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
                    btn.onclick = () => {
                        btn.textContent = "Installazione...";
                        btn.disabled = true;
                        window.apiBrowser.installUpdate();
                    };
                });
                window._updateListenersSetup = true;
            }
            
            banner.classList.remove('hidden');
        } else {
            if (mostraAvvisi) mostraMessaggio(`Hai già l'ultima versione (${result.currentVersion}).`, "success");
        }
    }
}

window.nascondiBannerAggiornamento = function() {
    document.getElementById('update-banner').classList.add('hidden');
}


