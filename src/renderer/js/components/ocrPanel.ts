window.testoOcrRecord = function(m) {
    if (!m || !Array.isArray(m.allegati)) return '';
    let out = '';
    for (const a of m.allegati) {
        if (a && a.ocr && typeof a.ocr.testo === 'string' && a.ocr.testo) out += a.ocr.testo + '\n';
    }
    return out;
};

const _oStato = {
    recordId: null,
    indice: 0,
    inCorso: false,
    risultato: null,
    lingue: [],
    preferite: []
};

function _oT(k, d) { return window.t(k, d); }

function _oNomeLingua(l) { return _oT('ocr_lang_name_' + l.codice, l.nome); }

function _oRecord() {
    if (!_oStato.recordId) return null;
    return appData.manoscritti.find(x => String(x.id) === String(_oStato.recordId)) || null;
}

function _oAllegati(m) {
    return (m && Array.isArray(m.allegati)) ? m.allegati : [];
}

async function _oSalva() {
    await window.Store.commit();
}

async function _oCaricaLingue() {
    try {
        const r = await window.apiOcr.lingue();
        _oStato.lingue = (r && r.lingue) || [];
    } catch (errore) {
        console.error('[OCR] Elenco lingue non leggibile:', errore);
        _oStato.lingue = [];
    }
    await _oCaricaLinguePreferite();
    return _oStato.lingue;
}

async function _oCaricaLinguePreferite() {
    try {
        const s = await window.apiSettings.get();
        if (Array.isArray(s.ocrLingue)) {
            _oStato.preferite = s.ocrLingue;
            return;
        }
        const vecchie = String(localStorage.getItem('archiview.ocr.lingue') || '').split('+').filter(Boolean);
        _oStato.preferite = vecchie;
        if (vecchie.length) {
            const r = await window.apiSettings.patch({ ocrLingue: vecchie });
            if (r && r.ok) localStorage.removeItem('archiview.ocr.lingue');
        }
    } catch (errore) {
        console.error('[OCR] Lingue preferite non leggibili:', errore);
    }
}

function _oLingueInstallate() {
    return _oStato.lingue.filter(l => l.installata && l.codice !== 'osd');
}

function _oLinguePredefinite() {
    const installate = _oLingueInstallate().map(l => l.codice);
    const valide = _oStato.preferite.filter(c => installate.includes(c));
    if (valide.length) return valide;
    if (installate.includes('ita')) return ['ita'];
    return installate.slice(0, 1);
}

function _oOsdInstallato() {
    return _oStato.lingue.some(l => l.codice === 'osd' && l.installata);
}

function _oRaddrizzaPredefinito() {
    if (!_oOsdInstallato()) return false;
    try {
        return localStorage.getItem('archiview.ocr.raddrizza') !== '0';
    } catch (errore) {
        console.error('[OCR] localStorage non leggibile:', errore);
        return true;
    }
}

function _oRicordaRaddrizza(attivo) {
    try {
        localStorage.setItem('archiview.ocr.raddrizza', attivo ? '1' : '0');
    } catch (errore) {
        console.error('[OCR] localStorage non scrivibile:', errore);
    }
}

function _oRicordaLingue(lingue) {
    _oStato.preferite = lingue;
    window.apiSettings.patch({ ocrLingue: lingue })
        .catch(errore => console.error('[OCR] Lingue preferite non salvate:', errore));
}

function _oRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _oNota(testo, classe?) {
    const p = document.createElement('p');
    p.className = classe || 'modello-suggerimento';
    p.textContent = testo;
    return p;
}

function _oSelect(id, opzioni, valore) {
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

function _oCheckbox(id, etichetta, spuntato) {
    const wrap = document.createElement('label');
    wrap.className = 'flex items-center gap-2 text-sm cursor-pointer';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!spuntato;
        const span = document.createElement('span');
    span.textContent = etichetta;
    wrap.append(input, span);
    return wrap;
}

function _oEtichettaAllegato(a, i) {
    const nome = (a && a.originalName) || (a && a.nome) || `${i + 1}`;
    const marca = a && a.ocr && a.ocr.testo ? ' ✓' : '';
    return `${i + 1}. ${nome}${marca}`;
}

function _oBlocccoLingue(preselezione) {
    const contenitore = document.createElement('div');
    contenitore.className = 'flex flex-col gap-2';

    const installate = _oLingueInstallate();
    if (installate.length === 0) {
        const avviso = _oNota(
            _oT('ocr_no_langs', 'Nessuna lingua installata: il riconoscimento ha bisogno almeno di una lingua.'),
            'text-sm testo-avviso leading-relaxed'
        );
        contenitore.appendChild(avviso);
    } else {
        const griglia = document.createElement('div');
        griglia.className = 'flex flex-wrap gap-x-4 gap-y-1';
        griglia.id = 'ocr-langs-choice';
        for (const l of installate) {
            griglia.appendChild(_oCheckbox('ocr-lang-' + l.codice, _oNomeLingua(l), preselezione.includes(l.codice)));
        }
        contenitore.appendChild(griglia);
        contenitore.appendChild(_oNota(_oT('ocr_langs_hint',
            'Più lingue insieme rallentano il riconoscimento: sceglile solo se il documento le mescola davvero.')));
    }

    const gestisci = document.createElement('button');
    gestisci.type = 'button';
    gestisci.className = 'btn-collegamento self-start';
    gestisci.textContent = _oT('ocr_manage_langs', 'Gestisci lingue…');
    gestisci.onclick = () => window.apriGestioneLingueOcr();
    contenitore.appendChild(gestisci);

    return contenitore;
}

function _oLingueScelte() {
    const griglia = document.getElementById('ocr-langs-choice');
    if (!griglia) return [];
    return Array.from(griglia.querySelectorAll('input[type=checkbox]'))
        .filter(c => c.checked)
        .map(c => c.id.replace('ocr-lang-', ''));
}

window.chiudiOcrModal = function() {
    const modal = document.getElementById('ocr-modal');
    if (!modal) return;
    if (_oStato.inCorso) window.annullaOcr();
    modal.classList.add('hidden-tab');
};

window.apriOcrModal = async function(recordId, indice) {
    if (!window.apiOcr) return;

    let id = recordId;
    if (!id) {
        const campo = document.getElementById('trascrizione-id');
        id = campo ? campo.value : null;
    }
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;

    const allegati = _oAllegati(m);
    if (allegati.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_no_attachments', 'Questa scheda non ha allegati da riconoscere.'), 'info');
        }
        return;
    }

    _oStato.recordId = m.id;
    _oStato.indice = Math.min(Math.max(Number(indice) || 0, 0), allegati.length - 1);
    _oStato.risultato = null;
    _oStato.inCorso = false;

    const modal = document.getElementById('ocr-modal');
    if (!modal) return;
    const corpo = modal.querySelector('#ocr-body');
    corpo.innerHTML = '';

    await _oCaricaLingue();
    const preselezione = _oLinguePredefinite();

    modal.querySelector('#ocr-subtitle').textContent = `${m.segnatura || ''} ${m.titolo ? '— ' + m.titolo : ''}`.trim();

    corpo.appendChild(_oRiga(
        _oT('ocr_source', 'Allegato'),
        _oSelect('ocr-source', [
            ...allegati.map((a, i) => ({ value: i, label: _oEtichettaAllegato(a, i) })),
            { value: 'tutti', label: _oT('ocr_source_all', 'Tutti gli allegati della scheda') }
        ], _oStato.indice)
    ));

    corpo.appendChild(_oRiga(_oT('ocr_langs', 'Lingue'), _oBlocccoLingue(preselezione)));

    const orientamento = document.createElement('div');
    orientamento.className = 'flex flex-col gap-1';
    const raddrizza = _oCheckbox('ocr-raddrizza', _oT('ocr_straighten', 'Raddrizza le pagine scansionate di traverso'), _oRaddrizzaPredefinito());
    const inputRaddrizza = raddrizza.querySelector('input');
    if (!_oOsdInstallato()) {
        inputRaddrizza.disabled = true;
        raddrizza.classList.add('opacity-60');
    }
    orientamento.appendChild(raddrizza);
    orientamento.appendChild(_oNota(_oOsdInstallato()
        ? _oT('ocr_straighten_hint', 'Le pagine girate di 90° o capovolte si ruotano prima del riconoscimento; nel PDF ricercabile appaiono dritte. Se l\'orientamento è incerto si legge nei due versi e si tiene la lettura migliore.')
        : _oT('ocr_straighten_missing', 'Per usarlo installa «Rilevamento orientamento» da Gestisci lingue.')));
    corpo.appendChild(_oRiga(_oT('ocr_orientation', 'Orientamento'), orientamento));

    const destinazione = document.createElement('div');
    destinazione.className = 'flex flex-col gap-1';
    destinazione.appendChild(_oCheckbox('ocr-dest-bozza', _oT('ocr_dest_draft', 'Inserisci come bozza nella trascrizione'), true));
    destinazione.appendChild(_oCheckbox('ocr-dest-indice', _oT('ocr_dest_index', 'Rendi il testo cercabile'), true));
    destinazione.appendChild(_oCheckbox('ocr-dest-pdf', _oT('ocr_dest_pdf', 'Salva una copia come PDF ricercabile'), false));
    corpo.appendChild(_oRiga(_oT('ocr_destination', 'Destinazione'), destinazione));
    corpo.appendChild(_oNota(_oT('ocr_dest_hint',
        'Il testo cercabile resta legato all\'allegato e non tocca la trascrizione: serve a ritrovare la scheda, non a sostituire il lavoro di lettura.')));

    const avanzate = document.createElement('details');
    avanzate.className = 'text-sm';
    const riassunto = document.createElement('summary');
    riassunto.className = 'cursor-pointer text-xs text-stone-600';
    riassunto.textContent = _oT('ocr_advanced', 'Opzioni avanzate');
    avanzate.appendChild(riassunto);
    const corpoAvanzate = document.createElement('div');
    corpoAvanzate.className = 'flex flex-col gap-2 mt-2';
    corpoAvanzate.appendChild(_oRiga(_oT('ocr_dpi', 'Risoluzione di scansione dei PDF'), _oSelect('ocr-dpi', [
        { value: 200, label: '200 dpi — ' + _oT('ocr_dpi_fast', 'veloce') },
        { value: 300, label: '300 dpi — ' + _oT('ocr_dpi_default', 'consigliata') },
        { value: 400, label: '400 dpi — ' + _oT('ocr_dpi_slow', 'lenta, testo minuto') }
    ], 300)));
    const maxPagine = document.createElement('input');
    maxPagine.type = 'number';
    maxPagine.id = 'ocr-max-pagine';
    maxPagine.className = 'form-input';
    maxPagine.min = '1';
    maxPagine.value = '20';
    corpoAvanzate.appendChild(_oRiga(_oT('ocr_max_pages', 'Pagine massime per PDF'), maxPagine));
    corpoAvanzate.appendChild(_oNota(_oT('ocr_max_pages_hint',
        'Il limite esiste perché un PDF di trecento carte occuperebbe il programma per ore senza che nessuno lo abbia chiesto.')));
    avanzate.appendChild(corpoAvanzate);
    corpo.appendChild(avanzate);

    const avanzamento = document.createElement('div');
    avanzamento.id = 'ocr-progress';
    avanzamento.className = 'hidden-tab flex flex-col gap-2';
    avanzamento.innerHTML = window.sanitizeHTML(`
        <div class="traccia">
            <div id="ocr-progress-bar" class="h-full barra-avanzamento barra-scala"></div>
        </div>
        <p id="ocr-progress-text" class="modello-suggerimento"></p>
    `);
    corpo.appendChild(avanzamento);

    const risultato = document.createElement('div');
    risultato.id = 'ocr-result';
    risultato.className = 'hidden-tab flex flex-col gap-2';
    corpo.appendChild(risultato);

    _oPreparaPulsanti(modal);
    modal.classList.remove('hidden-tab');
};

function _oPreparaPulsanti(modal) {
    const vecchio = modal.querySelector('#ocr-confirm');
    const conferma = vecchio.cloneNode(true);
    vecchio.parentNode.replaceChild(conferma, vecchio);
    conferma.disabled = _oLingueInstallate().length === 0;
    conferma.querySelector('span').textContent = _oT('ocr_start', 'Riconosci');
    conferma.onclick = () => window.avviaOcr();
}

function _oAggiornaAvanzamento(dati) {
    const box = document.getElementById('ocr-progress');
    const barra = document.getElementById('ocr-progress-bar');
    const testo = document.getElementById('ocr-progress-text');
    if (!box || !barra || !testo) return;
    box.classList.remove('hidden-tab');

    const pagine = dati.pagine || 1;
    const pagina = dati.pagina || 1;
    const dentroPagina = typeof dati.progresso === 'number' ? dati.progresso : 0;
    const frazione = Math.min(((pagina - 1) + dentroPagina) / pagine, 1);
    barra.style.transform = `scaleX(${frazione})`;

    const fasi = {
        pagina: _oT('ocr_phase_page', 'Pagina'),
        rasterizzazione: _oT('ocr_phase_raster', 'Preparazione immagine'),
        orientamento: _oT('ocr_phase_orientation', 'Rilevamento orientamento'),
        riconoscimento: _oT('ocr_phase_recognize', 'Riconoscimento'),
        'recognizing text': _oT('ocr_phase_recognize', 'Riconoscimento'),
        'loading language traineddata': _oT('ocr_phase_lang', 'Caricamento lingua'),
        'initializing api': _oT('ocr_phase_init', 'Avvio del motore')
    };
    const nomeFase = fasi[dati.fase] || dati.fase || '';
    testo.textContent = pagine > 1
        ? `${nomeFase} — ${_oT('ocr_page_of', 'pagina {var0} di {var1}').replace('{var0}', pagina).replace('{var1}', pagine)}`
        : nomeFase;
}

window.annullaOcr = async function() {
    try { await window.apiOcr.annulla(); } catch (errore) { console.error('[OCR] Annullamento:', errore); }
};

function _oRimappa(m, esiti) {
    const vivo = appData.manoscritti.find(x => String(x.id) === String(m.id)) || null;
    if (!vivo) return { m: null, esiti: [] };
    const carte = _oAllegati(vivo);
    return {
        m: vivo,
        esiti: esiti
            .map(e => ({ ...e, indice: e.nome ? carte.findIndex(a => a && a.nome === e.nome) : e.indice }))
            .filter(e => e.indice >= 0)
    };
}

function _oCartaViva(recordId, nome) {
    const m = appData.manoscritti.find(x => String(x.id) === String(recordId)) || null;
    const indice = m ? _oAllegati(m).findIndex(a => a && a.nome === nome) : -1;
    return { m, indice, a: indice >= 0 ? _oAllegati(m)[indice] : null };
}

async function _oEseguiSuAllegato(a, lingue, opzioni) {
    if (!a) return null;
    const intestazione = _oT('ocr_provenance', 'Bozza generata da OCR ({var0}) il {var1} — da rivedere')
        .replace('{var0}', lingue.join('+'))
        .replace('{var1}', new Date().toLocaleDateString());
    return window.apiOcr.esegui({
        nomeFile: a.nome,
        tipo: a.tipo,
        lingue,
        dpi: opzioni.dpi,
        maxPagine: opzioni.maxPagine,
        intestazione: opzioni.bozza ? intestazione : '',
        pdf: !!opzioni.pdf,
        raddrizza: !!opzioni.raddrizza
    });
}

window.avviaOcr = async function() {
    const m = _oRecord();
    if (!m || _oStato.inCorso) return;

    const lingue = _oLingueScelte();
    if (lingue.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pick_lang', 'Scegli almeno una lingua.'), 'info');
        }
        return;
    }

    const sorgente = document.getElementById('ocr-source').value;
    const opzioni = {
        dpi: Number(document.getElementById('ocr-dpi').value) || 300,
        maxPagine: Math.max(1, Number(document.getElementById('ocr-max-pagine').value) || 20),
        bozza: document.getElementById('ocr-dest-bozza').checked,
        indice: document.getElementById('ocr-dest-indice').checked,
        pdf: document.getElementById('ocr-dest-pdf').checked,
        raddrizza: document.getElementById('ocr-raddrizza').checked
    };
    if (_oOsdInstallato()) _oRicordaRaddrizza(opzioni.raddrizza);
    if (!opzioni.bozza && !opzioni.indice && !opzioni.pdf) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pick_dest', 'Scegli almeno una destinazione per il testo.'), 'info');
        }
        return;
    }

    _oRicordaLingue(lingue);

    if (opzioni.pdf) {
        const avvio = await _oIniziaPdf(m, sorgente);
        if (!avvio) return;
    }

    const modal = document.getElementById('ocr-modal');
    const conferma = modal.querySelector<HTMLButtonElement>('#ocr-confirm');
    conferma.disabled = true;
    _oStato.inCorso = true;
    document.getElementById('ocr-result').classList.add('hidden-tab');

    const recordId = m.id;
    const carte = (sorgente === 'tutti' ? _oAllegati(m) : [_oAllegati(m)[Number(sorgente)]])
        .filter(a => a && a.nome)
        .map(a => ({ nome: a.nome, tipo: a.tipo }));

    const esiti: any[] = [];
    let annullato = false;
    try {
        for (let k = 0; k < carte.length; k++) {
            const i = k;
            _oAggiornaAvanzamento({ fase: 'pagina', pagina: k + 1, pagine: carte.length });
            const r = await _oEseguiSuAllegato(carte[k], lingue, opzioni);
            if (r && r.ok) {
                esiti.push({ nome: carte[k].nome, risultato: r });
            } else if (r && r.codice === 'annullato') {
                annullato = true;
                break;
            } else if (r) {
                console.error('[OCR] Allegato', i, 'fallito:', r);
            }
        }
    } catch (errore) {
        console.error('[OCR] Esecuzione fallita:', errore);
    } finally {
        _oStato.inCorso = false;
        conferma.disabled = false;
    }

    document.getElementById('ocr-progress').classList.add('hidden-tab');

    const pdf = opzioni.pdf ? await _oConcludiPdf(annullato) : null;

    if (esiti.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_failed', 'Nessun testo riconosciuto.'), 'warning');
        }
        return;
    }

    const vivo = _oCartaViva(recordId, '').m;
    if (!vivo) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_oT('ocr_record_gone', 'La scheda non c\'è più: il testo riconosciuto non è stato salvato.'), 'warning');
        return;
    }
    const sulleCarte = esiti
        .map(e => ({ ...e, indice: _oCartaViva(recordId, e.nome).indice }))
        .filter(e => e.indice >= 0);
    await _oApplicaEsiti(vivo, sulleCarte, lingue, opzioni, pdf);
};

function _oNomePdf(m, sorgente) {
    const a = sorgente === 'tutti' ? null : _oAllegati(m)[Number(sorgente)];
    const base = a
        ? String(a.originalName || a.nome || '').replace(/\.[^.]+$/, '')
        : String(m.segnatura || m.titolo || '');
    return `${base || 'OCR'} - OCR.pdf`;
}

async function _oIniziaPdf(m, sorgente) {
    try {
        const r = await window.apiOcr.pdfInizia(_oNomePdf(m, sorgente), _oT('ocr_pdf_save_title', 'Salva PDF ricercabile'));
        if (r && r.ok) return true;
        if (r && !r.canceled && typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pdf_failed', 'PDF ricercabile non salvato.'), 'error');
        }
    } catch (errore) {
        console.error('[OCR] Avvio PDF ricercabile:', errore);
    }
    return false;
}

async function _oConcludiPdf(scarta) {
    try {
        const r = await window.apiOcr.pdfConcludi(scarta);
        if (r && r.ok && r.pagine > 0 && typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pdf_saved', 'PDF ricercabile salvato: {var0}').replace('{var0}', r.nome || ''), 'success');
        } else if ((!r || !r.ok) && typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pdf_failed', 'PDF ricercabile non salvato.'), 'error');
        }
        return r || { ok: false };
    } catch (errore) {
        console.error('[OCR] Scrittura PDF ricercabile:', errore);
        return { ok: false };
    }
}

async function _oApplicaEsiti(m, esiti, lingue, opzioni, pdf?) {
    if (!opzioni.indice && !opzioni.bozza) {
        _oMostraRisultato(esiti, false, opzioni, pdf);
        return;
    }

    const adesso = Date.now();
    let username = 'Anonimo';
    try {
        const settings = await window.apiSettings.get();
        username = settings.username || 'Anonimo';
    } catch (errore) {
        console.error('[OCR] Impostazioni non leggibili:', errore);
    }
    ({ m, esiti } = _oRimappa(m, esiti));
    if (!m) return;

    if (opzioni.indice) {
        for (const e of esiti) {
            const a = _oAllegati(m)[e.indice];
            if (!a) continue;
            a.ocr = {
                testo: e.risultato.piano,
                lingue: lingue.join('+'),
                confidenza: e.risultato.confidenza,
                motore: e.risultato.motore,
                pagine: e.risultato.pagineElaborate,
                data: adesso
            };
        }
    }

    let bozzaInserita = false;
    if (opzioni.bozza) {
        bozzaInserita = await _oInserisciBozze(m, esiti);
        ({ m, esiti } = _oRimappa(m, esiti));
        if (!m) return;
    }

    m.lastModified = adesso;
    m.modificatoDa = username;
    await _oSalva();

    _oMostraRisultato(esiti, bozzaInserita, opzioni, pdf);
}

function _oScritturePerPagina(m, utili) {
    const allegati = _oAllegati(m);
    const out = [];
    for (const e of utili) {
        const a = allegati[e.indice];
        const pagine = (e.risultato.pagine || []).filter(p => p && p.html && p.numero > 0);
        if (!a || a.tipo !== 'pdf' || pagine.length === 0) {
            out.push({ indice: e.indice, pagina: 0, html: e.risultato.html });
            continue;
        }
        const origine = /^<p class="ocr-origine">[\s\S]*?<\/p>\n?/.exec(e.risultato.html);
        pagine.forEach((p, k) => {
            out.push({ indice: e.indice, pagina: p.numero, html: (k === 0 && origine ? origine[0] : '') + p.html });
        });
    }
    return out;
}

async function _oInserisciBozze(m, esiti) {
    const utili = (esiti || []).filter(e => e.risultato && e.risultato.html);
    if (utili.length === 0) return false;

    if (window.salvaEditorTrascrizioneInMemoria) window.salvaEditorTrascrizioneInMemoria();
    window.migraTrascrizioneSuAllegati(m);

    let scritture = _oScritturePerPagina(m, utili);
    const inConflitto = scritture.filter(s =>
        window.trascrizioneHaTesto(window.leggiTrascrizioneAllegato(m, s.indice, s.pagina)));

    let scelta = 'sovrascrivi';
    if (inConflitto.length > 0) {
        scelta = await _oChiediSovrascrittura();
        if (scelta === 'annulla') return false;
        const vivo = _oRimappa(m, utili);
        if (!vivo.m) return false;
        m = vivo.m;
        window.migraTrascrizioneSuAllegati(m);
        scritture = _oScritturePerPagina(m, vivo.esiti);
    }

    for (const s of scritture) {
        const precedente = window.leggiTrascrizioneAllegato(m, s.indice, s.pagina);
        const nuovo = (scelta === 'accoda' && window.trascrizioneHaTesto(precedente))
            ? precedente + '\n' + s.html
            : s.html;
        window.scriviTrascrizioneAllegato(m, s.indice, nuovo, s.pagina);
    }

    m.trascrizione = window.componiTrascrizioneRecord(m);

    if (window.ricaricaEditorTrascrizione && window.ricaricaEditorTrascrizione(m)) {
        window.trascrizioneNonSalvata = false;
    }
    return true;
}

function _oChiediSovrascrittura() {
    return new Promise<string>((risolvi) => {
        const modal = document.getElementById('ocr-overwrite-modal');
        if (!modal) { risolvi('sovrascrivi'); return; }

        const chiudi = (scelta) => {
            modal.classList.add('hidden-tab');
            risolvi(scelta);
        };
        modal.querySelector<HTMLElement>('#ocr-ow-replace').onclick = () => chiudi('sovrascrivi');
        modal.querySelector<HTMLElement>('#ocr-ow-append').onclick = () => chiudi('accoda');
        modal.querySelector<HTMLElement>('#ocr-ow-cancel').onclick = () => chiudi('annulla');
        modal.classList.remove('hidden-tab');
    });
}

function _oMostraRisultato(esiti, bozzaInserita, opzioni, pdf?) {
    const box = document.getElementById('ocr-result');
    if (!box) return;
    box.innerHTML = '';
    box.classList.remove('hidden-tab');

    const caratteri = esiti.reduce((s, e) => s + (e.risultato.caratteri || 0), 0);
    const confidenze = esiti.map(e => e.risultato.confidenza).filter(c => typeof c === 'number');
    const media = confidenze.length ? Math.round(confidenze.reduce((s, c) => s + c, 0) / confidenze.length) : 0;

    const riepilogo = document.createElement('p');
    riepilogo.className = 'text-sm font-medium font-mono';
    riepilogo.textContent = _oT('ocr_result_summary', '{var0} caratteri riconosciuti, confidenza media {var1}%')
        .replace('{var0}', String(caratteri))
        .replace('{var1}', String(media));
    box.appendChild(riepilogo);

    if (media && media < 70) {
        box.appendChild(_oNota(
            _oT('ocr_low_confidence', 'Confidenza bassa: probabilmente la scrittura è corsiva o la scansione è poco leggibile. Il testo va riletto parola per parola.'),
            'text-xs testo-avviso leading-relaxed'
        ));
    }

    const anteprima = document.createElement('div');
    anteprima.className = 'ocr-anteprima';
    anteprima.textContent = esiti.map(e => e.risultato.piano).join('\n\n').slice(0, 1200);
    box.appendChild(anteprima);

    const stato = [];
    if (opzioni.indice) stato.push(_oT('ocr_saved_index', 'Testo reso cercabile.'));
    if (opzioni.bozza) {
        stato.push(bozzaInserita
            ? _oT('ocr_saved_draft', 'Bozza inserita nella trascrizione.')
            : _oT('ocr_draft_skipped', 'Trascrizione lasciata invariata.'));
    }
    const pagineOcr = esiti.flatMap(e => e.risultato.pagine || []);
    const raddrizzate = pagineOcr.filter(p => p && p.rotazione).length;
    const incerte = pagineOcr.filter(p => p && p.orientamentoIncerto).length;
    if (raddrizzate) {
        stato.push(_oT('ocr_straightened', 'Pagine raddrizzate: {var0}.').replace('{var0}', String(raddrizzate)));
    }
    if (incerte) {
        stato.push(_oT('ocr_orientation_unsure', 'Pagine forse girate ma lasciate com\'erano (orientamento incerto): {var0}.').replace('{var0}', String(incerte)));
    }
    if (opzioni.pdf && pdf && pdf.ok && pdf.pagine > 0) {
        stato.push(_oT('ocr_pdf_saved', 'PDF ricercabile salvato: {var0}').replace('{var0}', pdf.nome || ''));
    }
    box.appendChild(_oNota(stato.join(' ')));

    if (opzioni.pdf && esiti.some(e => e.risultato.pdfErrore)) {
        const cifrati = esiti.some(e => e.risultato.pdfErrore === 'pdf_cifrato');
        box.appendChild(_oNota(cifrati
            ? _oT('ocr_pdf_encrypted', 'Alcuni PDF sono protetti e non sono stati inclusi nel PDF ricercabile.')
            : _oT('ocr_pdf_partial', 'Alcuni allegati non sono stati inclusi nel PDF ricercabile.'),
            'text-xs testo-avviso leading-relaxed'));
    }

    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(_oT('ocr_done', 'Riconoscimento completato.'), 'success');
    }
}

window.ocrSelezionati = async function() {
    if (!window.apiOcr) return;
    const ids = window.selectedRecords || [];
    if (ids.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('msg_bulk_no_selection', 'Seleziona almeno una scheda.'), 'info');
        }
        return;
    }

    await _oCaricaLingue();
    const lingue = _oLinguePredefinite();
    if (lingue.length === 0) {
        window.apriGestioneLingueOcr();
        return;
    }

    const set = new Set(ids.map(String));
    const records = appData.manoscritti.filter(m => set.has(String(m.id)));
    const daFare = records.filter(m => _oAllegati(m).length > 0);
    if (daFare.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_no_attachments_sel', 'Nessuna delle schede selezionate ha allegati.'), 'info');
        }
        return;
    }

    const modal = document.getElementById('ocr-bulk-modal');
    if (modal) modal.classList.remove('hidden-tab');
    _oStato.inCorso = true;

    let schede = 0;
    let allegatiFatti = 0;
    const adesso = Date.now();

    try {
        for (let k = 0; k < daFare.length; k++) {
            if (!_oStato.inCorso) break;
            const m = daFare[k];
            _oAggiornaBulk(k + 1, daFare.length, m.segnatura || '');

            let toccata = false;
            const recordId = m.id;
            const carte = _oAllegati(m)
                .filter(a => a && a.nome && !(a.ocr && a.ocr.testo))
                .map(a => ({ nome: a.nome, tipo: a.tipo }));
            for (const c of carte) {
                if (!_oStato.inCorso) break;
                const r = await window.apiOcr.esegui({
                    nomeFile: c.nome,
                    tipo: c.tipo,
                    lingue,
                    dpi: 300,
                    maxPagine: 20,
                    intestazione: '',
                    raddrizza: _oRaddrizzaPredefinito()
                });
                if (r && r.ok && r.piano) {
                    const viva = _oCartaViva(recordId, c.nome);
                    if (!viva.a) continue;
                    viva.a.ocr = {
                        testo: r.piano,
                        lingue: lingue.join('+'),
                        confidenza: r.confidenza,
                        motore: r.motore,
                        pagine: r.pagineElaborate,
                        data: adesso
                    };
                    viva.m.lastModified = adesso;
                    toccata = true;
                    allegatiFatti++;
                } else if (r && r.codice === 'annullato') {
                    _oStato.inCorso = false;
                    break;
                }
            }
            if (toccata) schede++;
        }
    } catch (errore) {
        console.error('[OCR] OCR in massa fallito:', errore);
    } finally {
        _oStato.inCorso = false;
        if (modal) modal.classList.add('hidden-tab');
    }

    if (schede > 0) {
        await _oSalva();
    }

    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(
            _oT('ocr_bulk_done', 'OCR completato: {var0} allegati in {var1} schede.')
                .replace('{var0}', String(allegatiFatti))
                .replace('{var1}', String(schede)),
            schede > 0 ? 'success' : 'info'
        );
    }
};

function _oAggiornaBulk(fatte, totale, segnatura) {
    const barra = document.getElementById('ocr-bulk-bar');
    const testo = document.getElementById('ocr-bulk-text');
    if (barra) barra.style.transform = `scaleX(${(fatte - 1) / totale})`;
    if (testo) {
        testo.textContent = _oT('ocr_bulk_progress', 'Scheda {var0} di {var1}: {var2}')
            .replace('{var0}', String(fatte))
            .replace('{var1}', String(totale))
            .replace('{var2}', segnatura);
    }
}

window.annullaOcrMassa = function() {
    _oStato.inCorso = false;
    window.annullaOcr();
};

window.chiudiGestioneLingueOcr = async function() {
    const modal = document.getElementById('ocr-langs-modal');
    if (modal) modal.classList.add('hidden-tab');
    const ocr = document.getElementById('ocr-modal');
    if (ocr && !ocr.classList.contains('hidden-tab') && !_oStato.inCorso && _oStato.recordId) {
        await window.apriOcrModal(_oStato.recordId, _oStato.indice);
        const conferma = document.getElementById('ocr-confirm') as HTMLButtonElement | null;
        if (conferma && !conferma.disabled) conferma.focus();
    }
};

window.apriGestioneLingueOcr = async function() {
    if (!window.apiOcr) return;
    const modal = document.getElementById('ocr-langs-modal');
    if (!modal) return;
    modal.classList.remove('hidden-tab');
    await _oRenderLingue();
};

async function _oRenderLingue() {
    const box = document.getElementById('ocr-langs-list');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(_oNota(_oT('ocr_langs_loading', 'Lettura in corso…')));

    await _oCaricaLingue();
    box.innerHTML = '';

    for (const l of _oStato.lingue) {
        const riga = document.createElement('div');
        riga.className = 'riga-filetto';

        const sinistra = document.createElement('div');
        sinistra.className = 'flex flex-col';
        const nome = document.createElement('span');
        nome.className = 'text-sm text-stone-800';
        nome.textContent = _oNomeLingua(l);
        const dettaglio = document.createElement('span');
        dettaglio.className = 'text-xs font-mono text-stone-500';
        dettaglio.textContent = l.installata
            ? `${l.codice} — ${Math.round((l.dimensione || 0) / 1024 / 1024 * 10) / 10} MB`
            : l.codice;
        sinistra.append(nome, dettaglio);

        const azione = document.createElement('button');
        azione.type = 'button';
        azione.className = l.installata ? 'btn btn-ghost' : 'btn btn-secondary';
        azione.textContent = l.installata ? _oT('ocr_lang_remove', 'Rimuovi') : _oT('ocr_lang_install', 'Installa');
        azione.dataset.codice = l.codice;
        azione.onclick = async () => {
            azione.disabled = true;
            azione.textContent = l.installata
                ? _oT('ocr_lang_removing', 'Rimozione…')
                : _oT('ocr_lang_installing', 'Download…');
            const r = l.installata
                ? await window.apiOcr.rimuoviLingua(l.codice)
                : await window.apiOcr.installaLingua(l.codice);
            if (!r || !r.ok) {
                if (typeof mostraMessaggio === 'function') {
                    mostraMessaggio(
                        _oT('ocr_lang_error', 'Operazione non riuscita: serve una connessione per scaricare i dati di lingua.'),
                        'error'
                    );
                }
            }
            await _oRenderLingue();
        };

        riga.append(sinistra, azione);
        box.appendChild(riga);
    }

}

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('ocr-modal')) return;
        const html = `
    <div id="ocr-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="ocr-titolo">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="ocr-titolo" data-i18n="ocr_title">Riconosci testo</h3>
                    <p class="modal-sottotitolo" data-i18n="ocr_subtitle_local">Sul tuo computer, senza inviare nulla in rete. Il risultato va controllato a mano.</p>
                    <p id="ocr-subtitle" class="modal-sottotitolo font-mono" translate="no"></p>
                </div>
                <button type="button" data-on-click="chiudiOcrModal" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="ocr-body" class="flex flex-col gap-4"></div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="chiudiOcrModal" data-modal-cancel class="btn btn-secondary">
                    <span data-i18n="btn_close">Chiudi</span>
                </button>
                <button type="button" id="ocr-confirm" class="btn btn-primary">
                    <span data-i18n="ocr_start">Riconosci</span>
                </button>
            </div>
        </div>
    </div>

    <div id="ocr-langs-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="ocr-lingue-titolo">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="ocr-lingue-titolo" data-i18n="ocr_langs_title">Lingue del riconoscimento</h3>
                    <p class="modal-sottotitolo" data-i18n="ocr_langs_offline_hint">I dati si scaricano una sola volta e restano su questo computer: dopo l'installazione il riconoscimento funziona senza connessione.</p>
                </div>
            </div>
            <div class="modal-body">
                <div id="ocr-langs-list" class="flex flex-col"></div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="chiudiGestioneLingueOcr" data-modal-cancel class="btn btn-primary">
                    <span data-i18n="btn_close">Chiudi</span>
                </button>
            </div>
        </div>
    </div>

    <div id="ocr-overwrite-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md" role="alertdialog" aria-labelledby="ocr-ow-titolo" aria-describedby="ocr-ow-nota">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="ocr-ow-titolo" data-i18n="ocr_overwrite_title">Trascrizione già presente</h3>
                    <p class="modal-sottotitolo" id="ocr-ow-nota" data-i18n="ocr_overwrite_desc">Alcune carte hanno già una trascrizione. La bozza dell'OCR può sostituirla o essere aggiunta in fondo. Il testo sostituito non è recuperabile.</p>
                </div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" id="ocr-ow-cancel" data-modal-cancel class="btn btn-ghost mr-auto">
                    <span data-i18n="btn_cancel">Annulla</span>
                </button>
                <button type="button" id="ocr-ow-replace" class="btn btn-secondary">
                    <span data-i18n="ocr_overwrite_replace">Sostituisci</span>
                </button>
                <button type="button" id="ocr-ow-append" class="btn btn-primary">
                    <span data-i18n="ocr_overwrite_append">Aggiungi in fondo</span>
                </button>
            </div>
        </div>
    </div>

    <div id="ocr-bulk-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md" role="dialog" aria-modal="true" aria-labelledby="ocr-bulk-titolo">
            <div class="modal-header">
                <h3 class="modal-title" id="ocr-bulk-titolo" data-i18n="ocr_bulk_title">OCR delle schede selezionate</h3>
            </div>
            <div class="modal-body flex flex-col gap-2">
                <div class="traccia">
                    <div id="ocr-bulk-bar" class="h-full barra-avanzamento barra-scala"></div>
                </div>
                <p id="ocr-bulk-text" class="modello-suggerimento"></p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" id="ocr-bulk-cancel" data-on-click="annullaOcrMassa" data-modal-cancel class="btn btn-secondary">
                    <span data-i18n="btn_cancel">Annulla</span>
                </button>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('ocr-modal')] });

        if (window.apiOcr && window.apiOcr.onProgress) {
            window.apiOcr.onProgress((dati) => {
                if (_oStato.inCorso) _oAggiornaAvanzamento(dati || {});
            });
        }
    });
})();
