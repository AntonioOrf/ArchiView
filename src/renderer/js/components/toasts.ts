// @ts-nocheck
// Il container toast è già in HTML: niente check dinamico
window.mostraMessaggio = function(testo, tipo = 'info', azioneAnnulla = null) {
    const container = document.getElementById('toast-container');
    
    // Non far apparire più di 3 messaggi identici
    const existingToasts = Array.from(container.children);
    const ugualiCount = existingToasts.filter(t => t.innerText.trim().includes(testo.trim())).length;
    if (ugualiCount >= 3) return;

    const toast = document.createElement('div');
    const bgClass = tipo === 'error' ? 'bg-red-600' : (tipo === 'success' ? 'bg-green-600' : 'bg-stone-800');
    toast.className = `${bgClass} text-white px-4 py-3 rounded-sm shadow-lg text-sm font-medium flex items-center justify-between gap-4 opacity-0 transition-opacity duration-300 pointer-events-auto`;

    let icon = 'info';
    if (tipo === 'success') icon = 'check-circle';
    if (tipo === 'error') icon = 'alert-triangle';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex items-center gap-2';
    contentDiv.innerHTML = window.sanitizeHTML(`<i data-lucide="${icon}" class="w-5 h-5 shrink-0"></i> <span>${escapeHTML(testo)}</span>`);
    toast.appendChild(contentDiv);

    let dismissTimeout;
    const hideToast = () => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    };

    if (azioneAnnulla && typeof azioneAnnulla === 'function') {
        const btnAnnulla = document.createElement('button');
        btnAnnulla.className = 'text-amber-400 hover:text-amber-300 underline font-bold uppercase text-xs tracking-wider shrink-0 transition-colors';
        btnAnnulla.innerText = window.t('btn_cancel', 'Annulla');
        btnAnnulla.onclick = () => {
            clearTimeout(dismissTimeout);
            hideToast();
            azioneAnnulla();
        };
        toast.appendChild(btnAnnulla);
    }

    // Pulsante di chiusura sempre presente: indispensabile per gli errori che non
    // si auto-chiudono, utile in generale per liberare lo schermo.
    const btnClose = document.createElement('button');
    btnClose.className = 'text-white/70 hover:text-white shrink-0 transition-colors';
    btnClose.setAttribute('aria-label', window.t('btn_close', 'Chiudi'));
    btnClose.innerHTML = window.sanitizeHTML('<i data-lucide="x" class="w-4 h-4"></i>');
    btnClose.onclick = () => {
        clearTimeout(dismissTimeout);
        hideToast();
    };
    toast.appendChild(btnClose);

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('opacity-0')));

    // Gli errori restano finché non vengono chiusi manualmente (rischio di non
    // farli leggere altrimenti). Gli altri si auto-chiudono; 5s se c'è un'azione
    // di annullamento per dare il tempo di cliccare.
    if (tipo !== 'error') {
        dismissTimeout = setTimeout(hideToast, azioneAnnulla ? 5000 : 3500);
    }
}

