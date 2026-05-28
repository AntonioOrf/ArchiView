// @ts-nocheck
let appData = {
    cartelle: ['Generale'], 
    manoscritti: [],
    tipiDocumento: [
        { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
        { id: 'atti', nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
        { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
    ],
    trascrizioneEditorWidth: '50%'
};
window.cartellaAttuale = 'Generale';

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
    // Assicuriamoci che esista sempre almeno una cartella
    if (!appData.cartelle || appData.cartelle.length === 0) {
        appData.cartelle = ['Generale'];
    }
    
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
        const index = appData.tipiDocumento.findIndex(t => t.id === pref.id);
        if (index === -1) {
            appData.tipiDocumento.unshift(pref); // Aggiunge all'inizio se mancante
        } else {
            // Forza l'aggiornamento dei campi per i modelli predefiniti (che non sono modificabili dall'utente)
            appData.tipiDocumento[index].campi = pref.campi;
        }
    });

    appData.manoscritti.forEach(m => {
        // Se un record vecchio usava 'manoscritto', lo passiamo a un modello compatibile o al primo
        if (!m.tipoDocumento || m.tipoDocumento === 'manoscritto') m.tipoDocumento = 'imbreviature';
    });
    
    if (!appData.trascrizioneEditorWidth) appData.trascrizioneEditorWidth = '50%';
    
    window.ultimoCaricamento = Date.now();
}

async function salvaTutto() {
    if (window.apiBrowser) {
        window.ultimoCaricamento = Date.now();
        await window.apiBrowser.salvaDati(appData);
    }
}

window.sincronizzaEUnisciDati = async function(nuovoDati) {
    if (!nuovoDati) return;
    
    const loadedAt = window.ultimoCaricamento || 0;
    
    // 1. Fondi le cartelle
    const cartelleSet = new Set([...(appData.cartelle || []), ...(nuovoDati.cartelle || [])]);
    appData.cartelle = Array.from(cartelleSet).sort();
    
    // 2. Fondi i tipiDocumento
    const tipiMap = new Map();
    (nuovoDati.tipiDocumento || []).forEach(t => tipiMap.set(t.id, t));
    (appData.tipiDocumento || []).forEach(t => {
        if (!tipiMap.has(t.id)) tipiMap.set(t.id, t);
    });
    appData.tipiDocumento = Array.from(tipiMap.values());
    
    // 3. Fondi i manoscritti (schede)
    const localMap = new Map((appData.manoscritti || []).map(m => [m.id, m]));
    const externalMap = new Map((nuovoDati.manoscritti || []).map(m => [m.id, m]));
    
    const mergedManoscritti = [];
    const tuttiIds = new Set([...localMap.keys(), ...externalMap.keys()]);
    
    const idInModifica = document.getElementById('form-id')?.value;
    const idInTrascrizione = document.getElementById('trascrizione-id')?.value;
    const isAddingViewVisible = document.getElementById('view-add') && !document.getElementById('view-add').classList.contains('hidden-tab');
    
    for (const id of tuttiIds) {
        const local = localMap.get(id);
        const external = externalMap.get(id);
        
        if (local && external) {
            const tLocal = local.lastModified || 0;
            const tExternal = external.lastModified || 0;
            
            if (tLocal >= tExternal) {
                mergedManoscritti.push(local);
            } else {
                if (id === idInModifica && isAddingViewVisible) {
                    mergedManoscritti.push(local);
                } else if (id === idInTrascrizione && window.trascrizioneNonSalvata) {
                    mergedManoscritti.push(local);
                } else {
                    mergedManoscritti.push(external);
                }
            }
        } else if (local) {
            const tLocal = local.lastModified || 0;
            if (tLocal > loadedAt) {
                mergedManoscritti.push(local);
            }
        } else if (external) {
            const tExternal = external.lastModified || 0;
            if (tExternal > loadedAt || loadedAt === 0) {
                mergedManoscritti.push(external);
            }
        }
    }
    
    appData.manoscritti = mergedManoscritti;
    window.ultimoCaricamento = Date.now();
    
    // Aggiorna l'interfaccia
    if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    
    // Se l'utente è nella vista trascrizione e non ha modifiche pendenti, ricarica
    if (idInTrascrizione && !window.trascrizioneNonSalvata) {
        const checkEsiste = appData.manoscritti.some(x => String(x.id) === String(idInTrascrizione));
        if (checkEsiste) {
            if (typeof apriTrascrizione === 'function') apriTrascrizione(idInTrascrizione);
        } else {
            mostraMessaggio("Il documento corrente è stato eliminato da un altro utente.", "warning");
            switchTab('list');
        }
    }
};
