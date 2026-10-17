window.cartelleEspanse = window.cartelleEspanse || new Set(['']);

window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

window.localeAttuale = function() {
    return window.linguaAttuale === 'en' ? 'en-US' : 'it-IT';
};

const ATTR_AZIONE = /^data-(on|args)-/i;
let _hookAzioniRegistrato = false;

window.sanitizeHTML = function(html) {
    if (typeof DOMPurify !== 'undefined') {
        if (!_hookAzioniRegistrato) {
            DOMPurify.addHook('uponSanitizeAttribute', (_nodo, dati) => {
                if (ATTR_AZIONE.test(dati.attrName)) dati.keepAttr = false;
            });
            _hookAzioniRegistrato = true;
        }
        return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|archiview|local-asset|iiif-img):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i });
    }
    return window.escapeHTML(html);
};

window.annunciaA11y = function(testo, priorita = 'polite') {
    if (!testo) return;
    const el = document.getElementById(priorita === 'assertive' ? 'a11y-live-assertive' : 'a11y-live-polite');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = String(testo); });
};

window.normalizzaTesto = function(s) {
    if (s === null || s === undefined) return '';
    const varianti = { v: 'u', j: 'i', 'ſ': 's', 'ꝛ': 'r', 'ꝺ': 'd', 'æ': 'ae', 'œ': 'oe' };
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[vjſꝛꝺæœ]/g, c => varianti[c])
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u02bc\u02b9\u2032]/g, "'");
};


window.STATI_CARTA = ['daTrascrivere', 'trascritta', 'rivista', 'dubbio'];

window.avanzamentoCarte = function(m) {
    const allegati = Array.isArray(m && m.allegati) ? m.allegati : [];
    if (!allegati.some(a => a && a.stato)) return null;
    const fatte = allegati.filter(a => a && (a.stato === 'trascritta' || a.stato === 'rivista')).length;
    return { fatte, totale: allegati.length };
};

window.confrontaNaturale = function(a, b) {
    const sa = String(a ?? '').replace(/[‘’ʼʹ′]/g, "'").trim();
    const sb = String(b ?? '').replace(/[‘’ʼʹ′]/g, "'").trim();
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    const self = window.confrontaNaturale;
    if (!self.collatore) self.collatore = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return self.collatore.compare(sa, sb);
};

window.salvaStatoPosizione = async function() {
    const vAdd = document.getElementById('view-add');
    const vTrasc = document.getElementById('view-trascrizione');
    let tabAttuale = 'list';
    if (vAdd && !vAdd.classList.contains('hidden-tab')) tabAttuale = 'add';
    else if (vTrasc && !vTrasc.classList.contains('hidden-tab')) tabAttuale = 'trascrizione';

    const stato = {
        cartella: typeof window.cartellaAttuale === 'string' ? window.cartellaAttuale : '',
        tab: tabAttuale,
        trascrizioneId: (document.getElementById('trascrizione-id') as HTMLInputElement | null)?.value ?? null,
        cartelleEspanse: Array.from(window.cartelleEspanse),
        ricerca: (document.getElementById('search-input') as HTMLInputElement | null)?.value ?? '',
        tagAttivi: window.activeTags ? Array.from(window.activeTags) : [],
        sort: window.sortState ? { campo: window.sortState.campo, dir: window.sortState.dir } : null,
        vista: window.vistaLista || 'griglia',
        colonneTabella: window.colonneTabella || {},
        alberoSecondario: window.alberoSecondario || null,
        filtriAvanzati: window.filtriAvanzati || null,
        ricercheSalvate: Array.isArray(window.ricercheSalvate) ? window.ricercheSalvate : [],
        stampa: window.impostazioniStampa || null,
        esportaTesto: window.impostazioniExportTesto || null
    };
    
    if (window.apiSettings) {
        await window.apiSettings.patch({ appState: stato });
    }
};

const CONFIG_CAMPI = {
    dataCronica: { label: 'Data Cronica', placeholder: 'Es. 12 Maggio 1340', type: 'date' },
    dataTopica: { label: 'Data Topica', placeholder: 'Es. Firenze', type: 'text', authority: 'luogo' },
    autore: { label: 'Autore/i', placeholder: 'Es. Anonimo / Notaio', type: 'text' },
    titolo: { label: 'Titolo / Contenuto', placeholder: 'Titolo o descrizione sintetica', type: 'text' },
    note: { label: 'Note', placeholder: 'Note testuali o codicologiche', type: 'textarea' },
    prezzo: { label: 'Prezzo', placeholder: 'Es. 12 fiorini', type: 'text' },
    Marginalia: { label: 'Marginalia', placeholder: 'Note marginali...', type: 'textarea' },
    Notaio: { label: 'Notaio', placeholder: 'Nome del notaio', type: 'text' },
    tipo_di_atto: { label: 'Tipo di Atto', placeholder: 'Es. matrimonio, vendita, testamento...', type: 'text' },
    oggetto: { label: 'Oggetto', placeholder: 'Oggetto del documento', type: 'textarea' },
    elementi_economici: { label: 'Elementi Economici', placeholder: 'Dettagli economici...', type: 'textarea' },
    magistratura: { label: 'Magistratura', placeholder: 'Es. Podestà, Capitano del Popolo...', type: 'text' },
    tipo_di_atto_giur: { label: 'Tipo di Atto', placeholder: 'Es. accusa, inquisitione, testimoni, altro', type: 'text' },
    motivazione_processo: { label: 'Motivazione del Processo', placeholder: 'Causa e ragioni del processo...', type: 'textarea' },
    condanne: { label: 'Condanne', placeholder: 'Eventuali condanne, assoluzioni o pene...', type: 'textarea' },
    attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', authority: 'persona', keyPlaceholder: 'Ruolo (es. Venditore)', valPlaceholder: 'Nome della persona' },
    dichiarante: { label: 'Dichiarante', placeholder: 'Es. famiglia, istituzione…', type: 'text' },
    beni_dinamici: { label: 'Beni (Proprietà)', type: 'dynamic_list', keyPlaceholder: 'Bene (es. Casa, Terreno)', valPlaceholder: 'Valore (es. 10 fiorini)' },
    debiti_dinamici: { label: 'Debiti', type: 'dynamic_list', keyPlaceholder: 'Creditore / Motivo', valPlaceholder: 'Ammontare' },
    crediti_dinamici: { label: 'Crediti', type: 'dynamic_list', keyPlaceholder: 'Debitore / Motivo', valPlaceholder: 'Ammontare' },
    famiglia_dinamici: { label: 'Familiari', type: 'dynamic_list', authority: 'persona', keyPlaceholder: 'Parentela (es. Figlio, Moglie)', valPlaceholder: 'Nome' },
    allegati: { label: 'Allegati', type: 'attachments' }
};

window.CONFIG_CAMPI = CONFIG_CAMPI;

window.apriLinkEsternoSicuro = function(url) {
    const u = String(url || '').trim();
    if (!/^(https?:\/\/|mailto:)/i.test(u)) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_link_non_valido', 'Indirizzo non valido.'), 'warning');
        return;
    }
    if (window.apiBrowser && window.apiBrowser.apriLinkEsterno) window.apiBrowser.apriLinkEsterno(u);
};

function carteDi(m): any[] {
    if (!m) return [];
    if (Array.isArray(m.allegati) && m.allegati.length) return m.allegati;
    return m.allegato ? [{ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' }] : [];
}

function normalizzaAllegati(m): any[] {
    if (!m.allegati) m.allegati = [];
    if (m.allegati.length === 0 && m.allegato) {
        m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
    }
    return m.allegati;
}

window.srcAllegato = function(allegato, opzioni) {
    if (!allegato) return '';
    const opt = opzioni || {};

    if (allegato.remoto && allegato.iiif && window.IiifManifest) {
        const iiif = allegato.iiif;
        if (!iiif.serviceId && !iiif.urlStatico) return '';
        const carta = { s: iiif.serviceId || null, v: iiif.apiVersione || 0, u: iiif.urlStatico || null, l: opt.lato || 0 };
        let byte = '';
        for (const b of new TextEncoder().encode(JSON.stringify(carta))) byte += String.fromCharCode(b);
        return 'iiif-img://img/' + btoa(byte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const nome = typeof allegato === 'string' ? allegato : allegato.nome;
    if (!nome) return '';
    let src = 'local-asset://' + encodeURIComponent(nome);
    if (opt.cacheBuster) src += '?t=' + Date.now();
    if (opt.frammento) src += opt.frammento;
    return src;
};


function debounce(fn, wait) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

function rinominaInLoco(riga, selettore, valore, fine) {
    const nome = riga.querySelector(selettore);
    if (!nome || riga.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input tag-manager-input';
    input.value = valore;
    riga.replaceChild(input, nome);
    input.focus();
    input.select();

    let chiuso = false;
    const chiudi = (conferma) => {
        if (chiuso) return;
        chiuso = true;
        fine(conferma ? input.value.trim() : null);
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); chiudi(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(false); }
    };
    input.onblur = () => chiudi(true);
}

function ripristinaSchede(copie) {
    for (const vecchio of copie) {
        const i = appData.manoscritti.findIndex(m => String(m.id) === String(vecchio.id));
        if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(vecchio));
    }
}

function registraAnnullabile(descrizione, testo, ripristina) {
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(descrizione, ripristina);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(testo, 'success', () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    } else if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(testo, 'success');
    }
}

function creaSelect(id, opzioni, valore) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;
        if (String(o.value) === String(valore)) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function normalizzaCartelle() {
    const citate = appData.manoscritti.map(m => m.cartella).filter(c => typeof c === 'string' && c);
    const cartelleSet = new Set([...appData.cartelle, ...citate]);
    Array.from(cartelleSet).forEach(percorso => {
        let pathCorrente = '';
        percorso.split('/').forEach(part => {
            pathCorrente = pathCorrente ? pathCorrente + '/' + part : part;
            cartelleSet.add(pathCorrente);
        });
    });
    appData.cartelle = Array.from(cartelleSet).sort();
}

window.azzeraFiltriRicerca = function() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';

    if (window.activeTags) window.activeTags.clear();

    if (typeof window.azzeraFiltriAvanzati === 'function') window.azzeraFiltriAvanzati(false);

    const btnClearTag = document.getElementById('btn-clear-tag');
    if (btnClearTag) btnClearTag.classList.add('hidden');

    if (typeof renderTagList === 'function') renderTagList();
    if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
};

window.applicaScorciatoieTooltip = function() {
    document.querySelectorAll<HTMLElement>('[data-shortcut]').forEach(el => {
        const sc = el.getAttribute('data-shortcut');
        if (!sc) return;
        const suffisso = ' (' + sc + ')';
        const base = (testo) => (testo || '').split(suffisso)[0].trim();

        const titolo = base(el.getAttribute('title'));
        if (titolo) el.title = titolo + suffisso;

        const aria = base(el.getAttribute('aria-label'));
        if (aria) el.setAttribute('aria-label', aria + suffisso);
    });
};

window.proporzioneSeparatore = function(pct, aggancia = true) {
    const n = Number(pct);
    let p = Math.min(75, Math.max(25, Number.isFinite(n) ? n : 50));
    if (aggancia) for (const s of [100 / 3, 50, 200 / 3]) if (Math.abs(p - s) < 2) p = s;
    return p;
};

window.attivaSeparatore = function(sep, { attuale, daPuntatore, applica, fine }) {
    const imposta = (valore, ricorda, aggancia = true) => {
        const p = window.proporzioneSeparatore(valore, aggancia);
        sep.setAttribute('aria-valuenow', String(Math.round(p)));
        sep.dataset.percento = `${Math.round(p)} % · ${Math.round(100 - p)} %`;
        applica(p);
        if (ricorda) fine(p);
    };
    sep.setAttribute('aria-valuemin', '25');
    sep.setAttribute('aria-valuemax', '75');
    sep.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        sep.setPointerCapture(e.pointerId);
        sep.classList.add('is-trascina');
        document.body.style.cursor = 'col-resize';
    });
    sep.addEventListener('pointermove', (e) => {
        if (sep.hasPointerCapture(e.pointerId)) imposta(daPuntatore(e.clientX), false);
    });
    const lascia = (e) => {
        if (!sep.hasPointerCapture(e.pointerId)) return;
        sep.releasePointerCapture(e.pointerId);
        sep.classList.remove('is-trascina');
        document.body.style.cursor = '';
        fine(attuale());
    };
    sep.addEventListener('pointerup', lascia);
    sep.addEventListener('pointercancel', lascia);
    sep.addEventListener('dblclick', () => imposta(50, true));
    sep.addEventListener('keydown', (e) => {
        const passo = e.key === 'ArrowLeft' ? -2 : (e.key === 'ArrowRight' ? 2 : 0);
        if (!passo) return;
        e.preventDefault();
        imposta(attuale() + passo, true, false);
    });
    return imposta;
};

window.prefLocale = function(chiave, valore?) {
    try {
        if (valore === undefined) return localStorage.getItem(chiave);
        localStorage.setItem(chiave, String(valore));
    } catch (e) {}
    return null;
};

window.vaiACartella = function(percorso) {
    if (!percorso) return;
    window.cartellaAttuale = percorso;
    if (typeof window.espandiAntenati === 'function') window.espandiAntenati(percorso);
    window.cartelleEspanse.add(percorso);
    window.azzeraFiltriRicerca();
    if (typeof switchTab === 'function') switchTab('list');
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

window.espandiAntenati = function(percorso) {
    if (!percorso) return;
    let pathCorrente = '';
    percorso.split('/').forEach(part => {
        pathCorrente = pathCorrente ? pathCorrente + '/' + part : part;
        window.cartelleEspanse.add(pathCorrente);
    });
};

window.modalitaPrestazioniRidotte = false;

window.comportamentoScroll = function() {
    return window.modalitaPrestazioniRidotte ? 'auto' : 'smooth';
};

window.applicaModalitaPrestazioni = function(attiva) {
    window.modalitaPrestazioniRidotte = !!attiva;
    document.documentElement.classList.toggle('perf-low', !!attiva);
};

window.initModalitaPrestazioni = async function() {
    if (!window.apiBrowser || !window.apiBrowser.getPerfMode) return;
    try {
        const cfg = await window.apiBrowser.getPerfMode();
        window.applicaModalitaPrestazioni(cfg && cfg.lowPerf);
    } catch (e) {
        console.warn("Lettura modalità prestazioni fallita:", e);
    }
};

window.cambiaModalitaPrestazioni = async function(attiva) {
    window.applicaModalitaPrestazioni(attiva);
    if (window.apiBrowser && window.apiBrowser.setPerfMode) {
        const res = await window.apiBrowser.setPerfMode(!!attiva);
        if (res && res.success === false) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_perf_save_failed", "Impossibile salvare la preferenza: ") + res.error, "error");
            return;
        }
    }
    if (typeof renderMain === 'function') renderMain();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t("msg_perf_mode_saved", "Preferenza salvata. Riavvia l'app per applicare anche la disattivazione dell'accelerazione hardware."), "info");
    }
};
