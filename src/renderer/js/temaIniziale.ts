// Tema applicato prima del primo disegno: caricato in <head> senza defer, altrimenti
// all'avvio si vedrebbe un lampo del tema chiaro. Era uno <script> inline; sta in un file
// perché la CSP non ammette più 'unsafe-inline' fra gli script.
//
// CLASSI_TEMA è l'unica tabella tema → classe: la usa anche applicaTema (app.ts), così un tema
// nuovo non può essere riconosciuto al cambio ma dimenticato all'avvio.
window.CLASSI_TEMA = Object.freeze({
    light: null,
    'amber-light': 'amber-light-theme',
    dark: 'dark-theme',
    'blue-dark': 'blue-dark-theme'
});

(function() {
    try {
        const salvato = localStorage.getItem('theme') || 'system';
        const tema = salvato === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : salvato;
        const classe = window.CLASSI_TEMA[tema];
        if (classe) document.documentElement.classList.add(classe);
    } catch (e) {
        // localStorage non disponibile: resta il tema chiaro, lo sistema poi applicaTema.
    }
})();
