// Tema chiaro/scuro/sistema: applicazione, scelta dell'utente, ascolto del sistema.
// Spostato da app.ts (PIANO-REFACTOR Fase 6). Il primo frame lo dipinge temaIniziale.ts.

window.applicaTema = function(theme) {
    let activeTheme = theme;
    if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    const classi = window.CLASSI_TEMA; // temaIniziale.ts
    document.documentElement.classList.remove(...Object.values(classi).filter(Boolean) as string[]);
    if (classi[activeTheme]) document.documentElement.classList.add(classi[activeTheme]);
};

window.cambiaTemaSelezionato = async function(theme) {
    await window.apiSettings.patch({ theme });
    localStorage.setItem('theme', theme);
    // Dissolvenza solo per il cambio scelto dall'utente (regola :root.cambio-tema in style.css).
    document.documentElement.classList.add('cambio-tema');
    clearTimeout(window._timerCambioTema);
    window._timerCambioTema = setTimeout(() => document.documentElement.classList.remove('cambio-tema'), 300);
    window.applicaTema(theme);
};

// Initialize Theme
window.initTheme = async function() {
    const settings = await window.apiSettings.get();
    const savedTheme = settings.theme || 'system';
    // localStorage è solo la copia letta da temaIniziale.js per il primo frame: va riallineata
    // qui, o resta vuota quando cambia l'origine della pagina (passaggio a app://, O3) e il
    // tema scelto arriva solo dopo un lampo di quello di sistema, a ogni avvio.
    try { localStorage.setItem('theme', savedTheme); } catch (e) { /* solo il primo frame */ }

    // Set the select element if it's already in the DOM (unlikely since it's in a modal, but safe)
    const sel = document.getElementById('settings-theme');
    if (sel) sel.value = savedTheme;
    
    window.applicaTema(savedTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async e => {
        const s = await window.apiSettings.get();
        const currentPref = s.theme || 'system';
        if (currentPref === 'system') {
            window.applicaTema('system');
        }
    });
};
