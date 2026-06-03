(function() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'system';
        let isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (savedTheme === 'amber-light') {
            document.documentElement.classList.add('amber-light-theme');
        } else if (savedTheme === 'blue-dark') {
            document.documentElement.classList.add('blue-dark-theme');
        } else if (isDark) {
            document.documentElement.classList.add('dark-theme');
        }
    } catch (e) {}
})();
