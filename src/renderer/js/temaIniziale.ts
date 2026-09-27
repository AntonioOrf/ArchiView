// Tema scuro applicato prima del primo disegno: caricato in <head> senza defer, altrimenti
// all'avvio si vedrebbe un lampo del tema chiaro. Era uno <script> inline; sta in un file
// perché la CSP non ammette più 'unsafe-inline' fra gli script.
(function() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'system';
        const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) document.documentElement.classList.add('dark-theme');
    } catch (e) {
        // localStorage non disponibile: resta il tema chiaro, lo sistema poi applicaTema.
    }
})();
