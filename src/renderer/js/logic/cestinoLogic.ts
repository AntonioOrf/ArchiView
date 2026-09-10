// @ts-nocheck

// Fase 4.1 — Il cestino, lato renderer.
//
// Tre strati, come per i tag (3.4) e le azioni in massa (1.5): qui stanno le MUTAZIONI,
// il pannello (`components/cestinoPanel.ts`) raccoglie i parametri e ridisegna, e il file
// vero lo scrive il main (`main/trash.ts`), che è anche il posto in cui è spiegato perché
// il cestino non entra nel database e non si sincronizza.
//
// ⚠️ IL CESTINO NON SOSTITUISCE L'UNDO, LO AFFIANCA. Ogni eliminazione continua a
// registrare la sua azione di annullamento nel toast: è la rete immediata, quella che si usa
// due secondi dopo aver sbagliato mira. Il cestino è la rete tardiva, quella di chi se ne
// accorge domani. Toglierne una delle due significherebbe scoprire che manca proprio quando
// serve, e sono due gesti diversi.
//
// PREFISSO `_ce` sugli helper privati: gli script del renderer non sono moduli e il bundle
// li concatena in UN UNICO scope.

function _ceT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

function _ceApi() {
    return window.apiSicurezza || null;
}

/**
 * Copia nel cestino le schede che stanno per essere eliminate. Va chiamata PRIMA della
 * rimozione da `appData.manoscritti`, con i record ancora interi.
 *
 * Non lancia mai e non blocca: se il cestino non è scrivibile, l'eliminazione deve
 * comunque poter avvenire — negare all'utente di cancellare una scheda perché non si è
 * riusciti a conservarne una copia sarebbe il rimedio peggiore del male.
 *
 * @param records elenco di schede (verranno clonate: il chiamante può continuare a usarle)
 * @param origine etichetta libera, mostrata nella lista ("Eliminazione multipla", il nome
 *                dell'archivio cancellato, …)
 */
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

/**
 * Rimette in archivio le schede indicate.
 *
 * Due cose che non sono ovvie:
 *
 * 1. **Si ricrea l'archivio di destinazione se non c'è più.** Una scheda ripristinata in una
 *    cartella nel frattempo eliminata non comparirebbe da nessuna parte: sarebbe "tornata"
 *    solo nel file. Il percorso viene anche tolto da `deletedCartelle`, altrimenti il primo
 *    merge lo cancellerebbe di nuovo portandosi via la scheda appena recuperata.
 * 2. **Si toglie il tombstone e si rifirma il record.** Senza togliere l'id da `deletedIds`
 *    il prossimo sync rieliminerebbe la scheda; senza rifirmare `lastModified` il collega
 *    che ha già ricevuto l'eliminazione non avrebbe motivo di ripescarla.
 */
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
        if (presenti.has(String(r.id))) continue;   // già rimessa (undo, o sync di un collega)
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

    if (Array.isArray(appData.deletedIds)) {
        const set = new Set(record.map(r => String(r.id)));
        appData.deletedIds = appData.deletedIds.filter(x => !set.has(String(x)));
    }
    if (window.Model) window.Model.registraTag(appData, rientrati.flatMap(r => window.Model.tags(r)));

    if (window.Store) await window.Store.commit();
    return rientrati;
};

/** Eliminazione definitiva: toglie la copia dal cestino, il record era già fuori archivio. */
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

/** Etichetta d'origine di un'eliminazione, per la colonna "da" della lista. */
window.origineCestino = function(quante) {
    return quante > 1
        ? _ceT('trash_from_bulk', 'Eliminazione multipla')
        : _ceT('trash_from_single', 'Eliminazione');
};
