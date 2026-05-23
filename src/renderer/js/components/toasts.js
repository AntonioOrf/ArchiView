// Il container toast è già in HTML: niente check dinamico
window.mostraMessaggio = function(testo, tipo = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    const bgClass = tipo === 'error' ? 'bg-red-600' : (tipo === 'success' ? 'bg-green-600' : 'bg-stone-800');
    toast.className = `${bgClass} text-white px-4 py-3 rounded-sm shadow-lg text-sm font-medium flex items-center gap-2 opacity-0 transition-opacity duration-300 pointer-events-auto`;

    let icon = 'info';
    if (tipo === 'success') icon = 'check-circle';
    if (tipo === 'error') icon = 'alert-triangle';

    toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 shrink-0"></i> <span>${testo}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('opacity-0')));

    setTimeout(() => { toast.classList.add('opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
}

