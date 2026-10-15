// L'impronta vive nel modello (`Model.improntaRecord`), accanto al merge che la usa.
window.getRecordHash = function(record) {
    return window.Model.improntaRecord(record);
};

/**
 * Fase 4.4 — Conflitti CAMPO PER CAMPO.
 *
 * Prima il confronto era sull'impronta dell'intero record: due colleghi che toccavano campi
 * diversi della stessa scheda si vedevano chiedere quale delle due versioni buttare via.
 * Ora la domanda arriva solo per i campi che entrambi hanno cambiato in modo diverso, e la
 * scheda già fusa viaggia nel conflitto (`fusa`) perché il modale parta da lì invece che
 * dalla sola versione locale — altrimenti risolvere un campo cancellerebbe le modifiche
 * altrui su tutti gli altri.
 *
 * @param baseObjects  gli oggetti di base (`.archiview-base.json`). Servono per attribuire
 *                     una differenza a chi l'ha introdotta: `baseHashes` dice SE un lato ha
 *                     cambiato qualcosa, non COSA. Senza, si ricade sull'euristica dei
 *                     timestamp qui sotto, che è quella di prima.
 */
window.rilevaConflitti = function(locali, esterni, loadedAt, baseHashes = {}, baseObjects = {}) {
    const localMap = new Map<string, any>((locali || []).map(m => [m.id, m]));
    const externalMap = new Map<string, any>((esterni || []).map(m => [m.id, m]));
    
    const conflitti = [];
    // allegatoTipo è un campo derivato da allegati: viene risolto implicitamente
    // quando l'utente sceglie la versione degli allegati. Tenerli separati crea rumore.
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'allegatoTipo'];
    const conflitto = (id, local, external, campiConflitto, fusa?) => conflitti.push({
        id: id,
        segnatura: local.segnatura || window.t('print_untitled', 'Senza segnatura'),
        localCard: local,
        externalCard: external,
        campiConflitto: campiConflitto,
        ...(fusa ? { fusa } : {})
    });

    for (const [id, local] of localMap) {
        const external = externalMap.get(id);
        if (external) {
            const localHash = window.getRecordHash(local);
            const externalHash = window.getRecordHash(external);
            const baseHash = baseHashes[id];

            // Se sono identici (i contenuti, scartando i timestamp), non c'è conflitto
            if (localHash === externalHash) continue;

            // Fase 4.4 — strada principale: fusione campo per campo sulla base comune.
            const base = baseObjects && baseObjects[id];
            if (base && window.Model && typeof window.Model.fondiRecord === 'function') {
                const esito = window.Model.fondiRecord(base, local, external);
                if (esito.conflitti.length > 0) conflitto(id, local, external, esito.conflitti, esito.fuso);
                continue;
            }

            // Senza baseHash (documento precedente alla migrazione hash) ogni differenza è un
            // conflitto; con il baseHash solo se entrambi i lati sono cambiati rispetto alla base.
            if (!baseHash || (localHash !== baseHash && externalHash !== baseHash)) {
                const campiConflitto = [];
                const allKeys = new Set([...Object.keys(local), ...Object.keys(external)]);
                for (const key of allKeys) {
                    if (chiaviIgnorate.includes(key)) continue;
                    if (JSON.stringify(local[key]) !== JSON.stringify(external[key])) {
                        campiConflitto.push(key);
                    }
                }
                if (campiConflitto.length > 0) conflitto(id, local, external, campiConflitto);
            }
        }
    }

    return conflitti;
};

/**
 * Le modifiche di struttura in arrivo, per il pannello del cloud: cartelle nuove, modelli nuovi o
 * cambiati, cartelle e schede eliminate. Una sola copia per Drive e Hub: prima erano due, e
 * quella dell'Hub non mostrava le eliminazioni.
 *
 * @param locale  il database aperto (`appData`)
 * @param remoto  il database sul cloud, non ancora applicato
 * @param autore  chi ha scritto l'ultima versione remota, se si sa
 * @returns [{ icon, label }]
 */
window.riepilogoInArrivo = function(locale, remoto, autore) {
    const t = window.t;
    const MAX = 10;
    const voci = [];
    const nuove = (lista, gia) => { const s = new Set(gia || []); return (lista || []).filter(x => !s.has(x)); };

    const cartelle = nuove(remoto.cartelle, locale.cartelle);
    if (cartelle.length) voci.push({ icon: 'folder-plus', label: (cartelle.length > 1
        ? t('incoming_folders_new', '+ {var0} cartelle') : t('incoming_folder_new', '+ 1 cartella')).replace('{var0}', String(cartelle.length)) });

    const tipiLocali = new Map((locale.tipiDocumento || []).map(x => [x.id, JSON.stringify(x)]));
    const tipi = (remoto.tipiDocumento || []).filter(x => tipiLocali.get(x.id) !== JSON.stringify(x)).length;
    if (tipi) voci.push({ icon: 'file-type-2', label: (tipi > 1
        ? t('incoming_types', '{var0} modelli') : t('incoming_type', '1 modello')).replace('{var0}', String(tipi)) });

    const chi = autore || t('hub_generic_author', 'Collaboratore');
    const cartelleTolte = nuove(remoto.deletedCartelle, locale.deletedCartelle);
    for (const c of cartelleTolte.slice(0, MAX)) {
        voci.push({ icon: 'folder-minus', label: t('incoming_folder_deleted', 'Cartella eliminata: {var0} (da {var1})')
            .replace('{var0}', c.split('/').pop() || c).replace('{var1}', chi) });
    }
    if (cartelleTolte.length > MAX) voci.push({ icon: 'more-horizontal', label: t('incoming_folders_deleted_more', '… e altre {var0} cartelle eliminate')
        .replace('{var0}', String(cartelleTolte.length - MAX)) });

    const schedeTolte = nuove(remoto.deletedIds, locale.deletedIds);
    const perId = new Map<string, any>((locale.manoscritti || []).map(m => [m.id, m]));
    for (const id of schedeTolte.slice(0, MAX)) {
        const m = perId.get(id);
        const nome = m ? (m.titolo || m.segnatura || t('untitled_record', 'Senza titolo')) : t('incoming_record_unknown', 'Scheda sconosciuta');
        const daChi = (m && (m.modificatoDa || m.creatoDa)) || chi;
        voci.push({ icon: 'trash-2', label: t('incoming_record_deleted', 'Eliminata: {var0} (da {var1})')
            .replace('{var0}', nome).replace('{var1}', daChi) });
    }
    if (schedeTolte.length > MAX) voci.push({ icon: 'more-horizontal', label: t('incoming_records_deleted_more', '… e altre {var0} eliminazioni')
        .replace('{var0}', String(schedeTolte.length - MAX)) });

    return voci;
};
