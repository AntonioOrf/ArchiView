// @ts-nocheck

window.rilevaConflitti = function(locali, esterni, loadedAt) {
    const localMap = new Map((locali || []).map(m => [m.id, m]));
    const externalMap = new Map((esterni || []).map(m => [m.id, m]));
    
    const conflitti = [];
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa'];

    for (const [id, local] of localMap) {
        const external = externalMap.get(id);
        if (external) {
            const tLocal = local.lastModified || 0;
            const tExternal = external.lastModified || 0;
            
            // Entrambi hanno modificato dopo loadedAt
            if (tLocal > loadedAt && tExternal > loadedAt) {
                // Controlla se ci sono effettive differenze nei contenuti
                let differenzeTrovate = false;
                const campiConflitto = [];
                const allKeys = new Set([...Object.keys(local), ...Object.keys(external)]);
                
                for (const key of allKeys) {
                    if (chiaviIgnorate.includes(key)) continue;
                    
                    const localVal = local[key];
                    const externalVal = external[key];
                    
                    if (JSON.stringify(localVal) !== JSON.stringify(externalVal)) {
                        differenzeTrovate = true;
                        campiConflitto.push(key);
                    }
                }
                
                if (differenzeTrovate) {
                    conflitti.push({
                        id: id,
                        segnatura: local.segnatura || 'Senza Segnatura',
                        localCard: local,
                        externalCard: external,
                        campiConflitto: campiConflitto
                    });
                }
            }
        }
    }
    
    return conflitti;
};
