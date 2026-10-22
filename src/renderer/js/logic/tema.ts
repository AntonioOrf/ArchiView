window.applicaTema = function(theme) {
    let activeTheme = theme;
    if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    const classi = window.CLASSI_TEMA;
    document.documentElement.classList.remove(...Object.values(classi).filter(Boolean) as string[]);
    if (classi[activeTheme]) document.documentElement.classList.add(classi[activeTheme]);
};

window.cambiaTemaSelezionato = async function(theme) {
    await window.apiSettings.patch({ theme });
    localStorage.setItem('theme', theme);
    document.documentElement.classList.add('cambio-tema');
    clearTimeout(window._timerCambioTema);
    window._timerCambioTema = setTimeout(() => document.documentElement.classList.remove('cambio-tema'), 300);
    window.applicaTema(theme);
};

window.initTheme = async function() {
    const settings = await window.apiSettings.get();
    const savedTheme = settings.theme || 'system';
    try { localStorage.setItem('theme', savedTheme); } catch (e) {}

    const scelta = document.querySelector<HTMLInputElement>(`#settings-theme input[value="${CSS.escape(savedTheme)}"]`);
    if (scelta) scelta.checked = true;
    
    window.applicaTema(savedTheme);
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async e => {
        const s = await window.apiSettings.get();
        const currentPref = s.theme || 'system';
        if (currentPref === 'system') {
            window.applicaTema('system');
        }
    });
};
