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
    }
})();
