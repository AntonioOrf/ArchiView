let appData = {
    cartelle: ['Generale'], 
    manoscritti: [],
    tipiDocumento: [
        { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
        { id: 'atti', nome: 'Atti Giudiziari', campi: ['dataCronica', 'dataTopica', 'titolo', 'note'] },
        { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dataCronica', 'dataTopica', 'prezzo', 'note'] }
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
        appData.tipiDocumento = [];
    }
    
    // Rimuovi 'manoscritto' e assicurati che i modelli base siano presenti
    appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== 'manoscritto');
    
    const predefiniti = [
        { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
        { id: 'atti', nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
        { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
    ];
    
    predefiniti.forEach(pref => {
        if (!appData.tipiDocumento.some(t => t.id === pref.id)) {
            appData.tipiDocumento.unshift(pref); // Aggiunge all'inizio se mancante
        }
    });

    appData.manoscritti.forEach(m => {
        // Se un record vecchio usava 'manoscritto', lo passiamo a un modello compatibile o al primo
        if (!m.tipoDocumento || m.tipoDocumento === 'manoscritto') m.tipoDocumento = 'imbreviature';
    });
    
    if (!appData.trascrizioneEditorWidth) appData.trascrizioneEditorWidth = '50%';
}

async function salvaTutto() {
    if (window.apiBrowser) {
        await window.apiBrowser.salvaDati(appData);
    }
}
