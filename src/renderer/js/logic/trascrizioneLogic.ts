const TAG_INCOLLA = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li'];

window.pulisciHtmlIncollato = function(html) {
    return DOMPurify.sanitize(String(html || ''), { ALLOWED_TAGS: TAG_INCOLLA, ALLOWED_ATTR: [] });
};

document.addEventListener('paste', (e) => {
    const editor = document.getElementById('trascrizione-editor');
    if (!editor || !(e.target instanceof Node) || !editor.contains(e.target) || !e.clipboardData) return;
    const html = e.clipboardData.getData('text/html');
    const testo = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, window.pulisciHtmlIncollato(html));
    else if (testo) document.execCommand('insertText', false, testo);
});

window.trascrizioneHaTesto = function(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
};

window.leggiTrascrizioneAllegato = function(m, i, pagina) {
    if (!m) return '';
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return m.trascrizione || '';
    const a = allegati[i];
    if (!a) return '';
    if (pagina > 0 && a.tipo === 'pdf') {
        window.migraTrascrizionePdfSuPagine(a);
        if (!Array.isArray(a.pagine)) return '';
        return typeof a.pagine[pagina - 1] === 'string' ? a.pagine[pagina - 1] : '';
    }
    return typeof a.trascrizione === 'string' ? a.trascrizione : '';
};

window.scriviTrascrizioneAllegato = function(m, i, html, pagina) {
    if (!m) return;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) { m.trascrizione = html; return; }
    const a = allegati[i];
    if (!a) return;
    if (!(pagina > 0 && a.tipo === 'pdf')) { a.trascrizione = html; return; }

    window.migraTrascrizionePdfSuPagine(a);
    const pagine = Array.isArray(a.pagine) ? a.pagine : [];
    const vuota = !window.trascrizioneHaTesto(html);
    if (vuota && pagina > pagine.length) return;
    for (let k = pagine.length; k < pagina - 1; k++) pagine[k] = '';
    pagine[pagina - 1] = vuota ? '' : html;
    while (pagine.length && pagine[pagine.length - 1] === '') pagine.pop();
    a.pagine = pagine;
    a.trascrizione = window.componiPagineAllegato(pagine);
};

window.componiPagineAllegato = function(pagine) {
    const lista = Array.isArray(pagine) ? pagine : [];
    const conTesto: any[] = [];
    for (let k = 0; k < lista.length; k++) {
        if (window.trascrizioneHaTesto(lista[k])) conTesto.push(k);
    }
    if (conTesto.length === 0) return '';
    if (conTesto.length === 1 && conTesto[0] === 0) return lista[0];
    const pezzi: any[] = [];
    for (const k of conTesto) {
        pezzi.push('<p class="ocr-pagina"><strong>[p. ' + (k + 1) + ']</strong></p>');
        pezzi.push(lista[k]);
    }
    return pezzi.join('\n');
};

window.dividiTrascrizionePerPagine = function(html) {
    const testo = String(html || '');
    const marcatore = /<p\b[^>]*\bclass="[^"]*\bocr-pagina\b[^"]*"[^>]*>\s*<(strong|b)>\s*\[p\.\s*(\d{1,5})\]\s*<\/\1>\s*<\/p>/gi;
    const pagine: any[] = [];
    const aggiungi = (k, pezzo) => {
        const pulito = pezzo.replace(/^\n/, '').replace(/\n$/, '');
        if (!window.trascrizioneHaTesto(pulito)) return;
        for (let j = pagine.length; j <= k; j++) pagine[j] = '';
        pagine[k] = pagine[k] ? pagine[k] + '\n' + pulito : pulito;
    };
    let paginaCorrente = 0;
    let ultimo = 0;
    let trovato;
    while ((trovato = marcatore.exec(testo)) !== null) {
        aggiungi(paginaCorrente, testo.slice(ultimo, trovato.index));
        const n = Number(trovato[2]);
        paginaCorrente = n > 0 ? n - 1 : 0;
        ultimo = marcatore.lastIndex;
    }
    aggiungi(paginaCorrente, testo.slice(ultimo));
    return pagine;
};

window.migraTrascrizionePdfSuPagine = function(a) {
    if (!a || a.tipo !== 'pdf') return false;
    const testo = typeof a.trascrizione === 'string' ? a.trascrizione : '';
    if (Array.isArray(a.pagine)) {
        if (window.componiPagineAllegato(a.pagine) === testo) return false;
    } else if (!window.trascrizioneHaTesto(testo)) {
        return false;
    }
    a.pagine = window.dividiTrascrizionePerPagine(testo);
    return true;
};

window.migraTrascrizioneSuAllegati = function(m) {
    if (!m) return false;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return false;
    if (allegati.some(a => a && typeof a.trascrizione === 'string')) return false;
    if (!window.trascrizioneHaTesto(m.trascrizione)) return false;
    allegati[0].trascrizione = m.trascrizione;
    return true;
};

window.ricomponiTrascrizioneFusa = function(m) {
    if (m && window.Model && window.Model.trascrizioneDerivata(m)) m.trascrizione = window.componiTrascrizioneRecord(m);
    return m;
};

window.componiTrascrizioneRecord = function(m) {
    if (!m) return '';
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return m.trascrizione || '';

    const pezzi: any[] = [];
    let conTesto = 0;
    for (const a of allegati) {
        if (a && window.trascrizioneHaTesto(a.trascrizione)) conTesto++;
    }
    for (let i = 0; i < allegati.length; i++) {
        const a = allegati[i];
        if (!a || !window.trascrizioneHaTesto(a.trascrizione)) continue;
        if (conTesto > 1) {
            const nome = a.originalName || a.nome || String(i + 1);
            pezzi.push('<p class="trasc-carta"><strong>' + window.escapeHTML(nome) + '</strong></p>');
        }
        pezzi.push(a.trascrizione);
    }
    return pezzi.join('\n');
};
