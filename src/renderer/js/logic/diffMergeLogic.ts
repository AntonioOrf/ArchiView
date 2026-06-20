// @ts-nocheck

window.getRecordHash = function(record) {
    if (!record) return null;
    const r = { ...record };
    delete r.lastModified;
    delete r.modificatoDa;
    delete r.creatoDa;
    
    // Sort keys to ensure deterministic JSON
    const sortedKeys = Object.keys(r).sort();
    const sortedObj = {};
    for (const k of sortedKeys) {
        sortedObj[k] = r[k];
    }
    return JSON.stringify(sortedObj);
};

window.rilevaConflitti = function(locali, esterni, loadedAt, baseHashes = {}) {
    const localMap = new Map((locali || []).map(m => [m.id, m]));
    const externalMap = new Map((esterni || []).map(m => [m.id, m]));
    
    const conflitti = [];
    // allegatoTipo è un campo derivato da allegati: viene risolto implicitamente
    // quando l'utente sceglie la versione degli allegati. Tenerli separati crea rumore.
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'allegatoTipo'];

    for (const [id, local] of localMap) {
        const external = externalMap.get(id);
        if (external) {
            const localHash = window.getRecordHash(local);
            const externalHash = window.getRecordHash(external);
            const baseHash = baseHashes[id];
            
            // Se sono identici (i contenuti, scartando i timestamp), non c'è conflitto
            if (localHash === externalHash) continue;
            
            // Se non c'è baseHash (documento precedente alla migrazione hash), fallback timestamp
            if (!baseHash) {
                
                const tLocal = local.lastModified || 0;
                const tExternal = external.lastModified || 0;
                if (tLocal > loadedAt && tExternal > loadedAt) {
                    let differenzeTrovate = false;
                    const campiConflitto = [];
                    const allKeys = new Set([...Object.keys(local), ...Object.keys(external)]);
                    for (const key of allKeys) {
                        if (chiaviIgnorate.includes(key)) continue;
                        if (JSON.stringify(local[key]) !== JSON.stringify(external[key])) {
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
                continue;
            }
            
            // Logica 3-way merge
            if (localHash !== baseHash && externalHash !== baseHash && localHash !== externalHash) {
                // Entrambi i file sono stati modificati rispetto al baseHash, ed in modi diversi
                const campiConflitto = [];
                const allKeys = new Set([...Object.keys(local), ...Object.keys(external)]);
                for (const key of allKeys) {
                    if (chiaviIgnorate.includes(key)) continue;
                    if (JSON.stringify(local[key]) !== JSON.stringify(external[key])) {
                        campiConflitto.push(key);
                    }
                }
                
                if (campiConflitto.length > 0) {
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
