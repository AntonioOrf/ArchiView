let appData = {
    cartelle: ['Generale'], 
    manoscritti: [],
    tipiDocumento: [
        { id: 'manoscritto', nome: 'Manoscritto', campi: ['autore', 'titolo', 'note'] }
    ],
    trascrizioneEditorWidth: '50%'
};
let cartellaAttuale = 'Generale';

async function initData() {
    if (window.apiBrowser) {
        const datiSalvati = await window.apiBrowser.leggiDati();
        if (datiSalvati) {
            // Migrazione: Se il file vecchio era solo un array (lista piatta), lo converte nel nuovo formato
            if (Array.isArray(datiSalvati)) {
                appData.manoscritti = datiSalvati.map(m => ({...m, cartella: 'Generale', tipoDocumento: 'manoscritto'}));
                await window.apiBrowser.salvaDati(appData); // Salva subito il nuovo formato
            } else {
                // Formato già corretto
                appData = datiSalvati; 
            }
        }
    }
    // Assicuriamoci che esista sempre almeno la cartella Generale
    if (!appData.cartelle.includes('Generale')) appData.cartelle.push('Generale');
    
    if (!appData.tipiDocumento) {
        appData.tipiDocumento = [
            { id: 'manoscritto', nome: 'Manoscritto', campi: ['autore', 'titolo', 'note'] }
        ];
    }
    appData.manoscritti.forEach(m => {
        if (!m.tipoDocumento) m.tipoDocumento = 'manoscritto';
    });
    
    if (!appData.trascrizioneEditorWidth) appData.trascrizioneEditorWidth = '50%';
}

async function salvaTutto() {
    if (window.apiBrowser) {
        await window.apiBrowser.salvaDati(appData);
    }
}
