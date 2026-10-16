function _ceT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

function _ceApi() {
    return window.apiSicurezza || null;
}

window.cestinaRecord = async function(records, origine) {
    const api = _ceApi();
    const lista = Array.isArray(records) ? records : (records ? [records] : []);
    if (!api || lista.length === 0) return 0;
    try {
        const copie = JSON.parse(JSON.stringify(lista));
        const res = await api.cestinoAggiungi(copie, origine || '');
        if (!res || res.success === false) {
            console.error('[Cestino] Copia non riuscita:', res && res.error);
            return 0;
        }
        return res.aggiunte || 0;
    } catch (err) {
        console.error('[Cestino] Copia non riuscita:', err);
        return 0;
    }
};

window.elencaCestino = async function() {
    const api = _ceApi();
    if (!api) return [];
    const res = await api.cestinoElenca();
    if (!res || res.success === false) throw new Error((res && res.error) || 'Cestino non leggibile');
    return res.voci || [];
};

window.ripristinaDalCestino = async function(ids) {
    const api = _ceApi();
    const cercati = (ids || []).map(String);
    if (!api || cercati.length === 0) return [];

    const res = await api.cestinoPrendi(cercati);
    if (!res || res.success === false) throw new Error((res && res.error) || 'Ripristino non riuscito');
    const record = res.record || [];
    if (record.length === 0) return [];

    const settings = window.apiSettings ? await window.apiSettings.get() : {};
    const username = settings.username || 'Anonimo';
    const adesso = Date.now();
    const presenti = new Set(appData.manoscritti.map(m => String(m.id)));

    const rientrati = [];
    for (const r of record) {
        if (presenti.has(String(r.id))) continue;
        const scheda = window.Model ? window.Model.normalizzaScheda(r) : r;
        const cartella = typeof scheda.cartella === 'string' ? scheda.cartella : '';
        if (cartella && !appData.cartelle.includes(cartella)) appData.cartelle.push(cartella);
        if (cartella && Array.isArray(appData.deletedCartelle)) {
            appData.deletedCartelle = appData.deletedCartelle.filter(c => c !== cartella);
        }
        scheda.lastModified = adesso;
        scheda.modificatoDa = username;
        appData.manoscritti.push(scheda);
        rientrati.push(scheda);
    }

    window.Store.togliTombstone(record.map(r => r.id));
    if (window.Model) window.Model.registraTag(appData, rientrati.flatMap(r => window.Model.tags(r)));

    await window.Store.commit();
    return rientrati;
};

window.eliminaDefinitivo = async function(ids) {
    const api = _ceApi();
    if (!api) return 0;
    const res = await api.cestinoElimina((ids || []).map(String));
    if (!res || res.success === false) throw new Error((res && res.error) || 'Eliminazione non riuscita');
    return res.eliminate || 0;
};

window.svuotaCestino = async function() {
    const api = _ceApi();
    if (!api) return 0;
    const res = await api.cestinoSvuota();
    if (!res || res.success === false) throw new Error((res && res.error) || 'Svuotamento non riuscito');
    return res.eliminate || 0;
};

window.origineCestino = function(quante) {
    return quante > 1
        ? _ceT('trash_from_bulk', 'Eliminazione multipla')
        : _ceT('trash_from_single', 'Eliminazione');
};
