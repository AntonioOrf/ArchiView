window.posizioneOriginale = function(originale, indiceNorm) {
    let n = 0;
    let i = 0;
    for (const ch of originale) {
        if (n >= indiceNorm) return i;
        n += window.normalizzaTesto(ch).length;
        i += ch.length;
    }
    return originale.length;
};

window.tokenizzaRicerca = function(str) {
    const norm = window.normalizzaTesto(str).trim();
    if (!norm) return [];
    return norm.split(/\s+/).filter(Boolean);
};

window.testoIndicizzabile = function(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
        let out = '';
        for (const el of v) {
            if (el === null || el === undefined) continue;
            if (typeof el === 'string' || typeof el === 'number') out += el + ' ';
            else if (typeof el === 'object') out += (el.k || '') + ' ' + (el.v || '') + ' ';
        }
        return out;
    }
    return '';
};

window.analizzaQuery = function(str) {
    const esito: { testo: string[]; campi: { campo: string; valore: string }[] } = { testo: [], campi: [] };
    const norm = window.normalizzaTesto(str);
    if (!norm || !norm.trim()) return esito;

    const re = /([\w\-]+):"([^"]*)"|([\w\-]+):(\S+)|([\w\-]+):(?=\s|$)|"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(norm)) !== null) {
        if (m[1] !== undefined) {
            const v = m[2].trim();
            if (v) esito.campi.push({ campo: m[1], valore: v });
        } else if (m[3] !== undefined) {
            esito.campi.push({ campo: m[3], valore: m[4] });
        } else if (m[5] !== undefined) {
            continue;
        } else if (m[6] !== undefined) {
            const v = m[6].trim();
            if (v) esito.testo.push(v);
        } else if (m[7] !== undefined) {
            esito.testo.push(m[7]);
        }
    }
    return esito;
};

const ALIAS_CAMPI_QUERY = {
    tag: 'tags',
    tipo: 'tipodocumento',
    archiuio: 'cartella',
    modificato: 'lastmodified'
};

window.recordPassaCampi = function(m, campi) {
    if (!campi || campi.length === 0) return true;
    for (const f of campi) {
        const cercato = ALIAS_CAMPI_QUERY[f.campo] || f.campo;

        if (cercato === 'ocr') {
            const testo = window.testoOcrRecord ? window.testoOcrRecord(m) : '';
            if (!testo || !window.normalizzaTesto(testo).includes(f.valore)) return false;
            continue;
        }

        let trovato = false;
        let corrisponde = false;
        for (const chiave of Object.keys(m)) {
            if (window.normalizzaTesto(chiave) !== cercato) continue;
            trovato = true;
            if (window.normalizzaTesto(window.testoIndicizzabile(m[chiave])).includes(f.valore)) {
                corrisponde = true;
                break;
            }
        }
        if (!trovato || !corrisponde) return false;
    }
    return true;
};

window.recordPassaFiltri = function(m, filtri) {
    if (!filtri) return true;

    if (filtri.tipo && (m.tipoDocumento || 'manoscritto') !== filtri.tipo) return false;

    if (filtri.allegati === 'si' || filtri.allegati === 'no') {
        const n = Array.isArray(m.allegati) ? m.allegati.length : (m.allegato ? 1 : 0);
        if (filtri.allegati === 'si' && n === 0) return false;
        if (filtri.allegati === 'no' && n > 0) return false;
    }

    if (filtri.trascrizione === 'si' || filtri.trascrizione === 'no') {
        const testo = String(m.trascrizione || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (filtri.trascrizione === 'si' && !testo) return false;
        if (filtri.trascrizione === 'no' && testo) return false;
    }

    if (filtri.collegamenti === 'si' || filtri.collegamenti === 'no') {
        const indice = window.__idsCollegati;
        const collegata = indice ? indice.has(String(m.id)) : window.Model.relazioni(m).length > 0;
        if (filtri.collegamenti === 'si' && !collegata) return false;
        if (filtri.collegamenti === 'no' && collegata) return false;
    }

    if (filtri.statoCarte && !(Array.isArray(m.allegati) && m.allegati.some(a => a && a.stato === filtri.statoCarte))) return false;

    if (filtri.ocr === 'si' || filtri.ocr === 'no') {
        const n = window.testoOcrRecord ? window.testoOcrRecord(m).trim() : '';
        if (filtri.ocr === 'si' && !n) return false;
        if (filtri.ocr === 'no' && n) return false;
    }

    if (filtri.daData || filtri.aData) {
        const ts = Number(m.lastModified) || 0;
        if (!ts) return false;
        if (filtri.daData) {
            const d = Date.parse(filtri.daData + 'T00:00:00');
            if (!isNaN(d) && ts < d) return false;
        }
        if (filtri.aData) {
            const d = Date.parse(filtri.aData + 'T23:59:59.999');
            if (!isNaN(d) && ts > d) return false;
        }
    }

    if (filtri.daAnno || filtri.aAnno) {
        if (!window.DataStorica || !window.Model) return false;
        const tipo = (typeof appData !== 'undefined' && appData.tipiDocumento)
            ? appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'))
            : null;
        const campiData = window.Model.campiDellaScheda(m, tipo, window.CONFIG_CAMPI, appData)
            .filter(d => d.tipo === 'date')
            .map(d => d.id);
        if (!campiData.length) return false;
        const dentro = campiData.some(c => window.DataStorica.nelPeriodo(m[c], filtri.daAnno, filtri.aAnno));
        if (!dentro) return false;
    }

    return true;
};

window.cartellaNelSottoalbero = function(cartella, base) {
    const c = typeof cartella === 'string' ? cartella : '';
    const b = typeof base === 'string' ? base : '';
    if (!b) return true;
    return c === b || c.indexOf(b + '/') === 0;
};

window.contaFiltriAvanzati = function(filtri) {
    if (!filtri) return 0;
    let n = 0;
    if (filtri.tipo) n++;
    if (filtri.sottocartelle) n++;
    if (filtri.daData) n++;
    if (filtri.aData) n++;
    if (filtri.daAnno) n++;
    if (filtri.aAnno) n++;
    if (filtri.allegati) n++;
    if (filtri.trascrizione) n++;
    if (filtri.ocr) n++;
    if (filtri.collegamenti) n++;
    if (filtri.statoCarte) n++;
    return n;
};
