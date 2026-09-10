// @ts-nocheck

// Fase 3.8 — riordino dei campi di UNA scheda.
//
// L'ordine vive sul record (`ordineCampi`) e riguarda solo quella scheda: il modello e le
// altre schede non cambiano. ⚠️ Lo seguono il form, la vista a schede e la stampa per scheda,
// cioè i posti in cui si guarda una scheda sola; la tabella e il CSV no, perché le loro
// colonne sono comuni a tutte le schede e l'ordine di un record non può riordinarle.
//
// ⚠️ In riordino i controlli NON vengono smontati, solo nascosti: restano nel DOM con i loro
// valori, quindi un salvataggio fatto mentre l'elenco è aperto scrive esattamente ciò che
// l'utente aveva compilato. Smontarli avrebbe voluto dire tenere i valori in una variabile
// di modulo, cioè un secondo posto in cui vivono i dati del form.
//
// Si trascina un ELENCO DI NOMI e non i campi veri: trascinare un `input` combatte con la
// selezione del testo, e su un `textarea` alto tre righe la maniglia sarebbe più grande del
// campo che sposta.

/** L'ordine in composizione nel form, sempre un array di id. */
function ordineCampiForm() {
    const el = document.getElementById('form-ordine-campi');
    if (!el) return [];
    try {
        return window.Model.ordineCampi({ ordineCampi: JSON.parse(el.value || '[]') });
    } catch (err) {
        console.error('Campo ordineCampi illeggibile, la scheda usa l\'ordine naturale:', err);
        return [];
    }
}
window.ordineCampiForm = ordineCampiForm;

function scriviOrdineCampiForm(ordine) {
    const el = document.getElementById('form-ordine-campi');
    if (!el) return;
    el.value = JSON.stringify(window.Model.ordineCampi({ ordineCampi: ordine || [] }));
}
window.scriviOrdineCampiForm = scriviOrdineCampiForm;

/** Gli id nell'ordine in cui il form li sta mostrando adesso. */
function _idsCorrenti() {
    return window.campiDefinitiDelForm().map(d => d.id);
}

// --- Modalità riordino --------------------------------------------------------

window.riordinoCampiAttivo = false;

window.apriRiordinoCampi = function() {
    const campi = document.getElementById('form-dynamic-fields');
    const box = document.getElementById('form-riordino');
    if (!campi || !box) return;
    window.riordinoCampiAttivo = true;
    campi.classList.add('hidden-tab');
    box.classList.remove('hidden-tab');
    _disegnaElencoRiordino();
    _aggiornaPulsanteRiordino();
};

/**
 * `silenzioso` = non ridisegnare. Lo usano `resetForm` e `editItem`, che disegnano il form da
 * sé subito dopo: ridisegnare qui rileggerebbe i valori della scheda PRECEDENTE e li
 * rimetterebbe addosso a quella nuova.
 */
window.chiudiRiordinoCampi = function(silenzioso) {
    const campi = document.getElementById('form-dynamic-fields');
    const box = document.getElementById('form-riordino');
    if (!campi || !box) return;
    window.riordinoCampiAttivo = false;
    box.classList.add('hidden-tab');
    campi.classList.remove('hidden-tab');
    // Il form si ridisegna nell'ordine nuovo, conservando ciò che è già scritto.
    if (!silenzioso && window.ridisegnaCampiConservandoValori) window.ridisegnaCampiConservandoValori();
    _aggiornaPulsanteRiordino();
};

window.alternaRiordinoCampi = function() {
    if (window.riordinoCampiAttivo) window.chiudiRiordinoCampi();
    else window.apriRiordinoCampi();
};

function _aggiornaPulsanteRiordino() {
    const btn = document.getElementById('btn-riordina-campi');
    if (!btn) return;
    const etichetta = window.riordinoCampiAttivo
        ? window.t('reorder_done', 'Fine riordino')
        : window.t('reorder_fields', 'Riordina i campi');
    const span = btn.querySelector('span');
    if (span) span.textContent = etichetta;
    btn.setAttribute('aria-pressed', window.riordinoCampiAttivo ? 'true' : 'false');
}

/** Rimette la scheda nell'ordine naturale (tipo, poi campi propri). */
window.azzeraRiordinoCampi = function() {
    scriviOrdineCampiForm([]);
    window.isFormDirty = true;
    _disegnaElencoRiordino();
};

// --- Elenco trascinabile ------------------------------------------------------

let _trascinato = null;

function _disegnaElencoRiordino() {
    const lista = document.getElementById('form-riordino-lista');
    if (!lista) return;
    lista.innerHTML = '';

    const definizioni = window.campiDefinitiDelForm();
    const propri = new Set((window.campiPropriForm ? window.campiPropriForm() : []).map(d => d.id));

    definizioni.forEach((def, indice) => {
        const riga = document.createElement('li');
        riga.className = 'riordino-riga';
        riga.draggable = true;
        riga.dataset.campo = def.id;
        riga.tabIndex = 0;

        const maniglia = document.createElement('span');
        maniglia.className = 'riordino-maniglia';
        maniglia.innerHTML = '<i data-lucide="grip-vertical" class="w-4 h-4"></i>';
        riga.appendChild(maniglia);

        const nome = document.createElement('span');
        nome.className = 'riordino-nome';
        const tradotta = window.t('field_' + def.id);
        nome.textContent = tradotta !== 'field_' + def.id
            ? tradotta
            : (def.label || (window.CONFIG_CAMPI[def.id] && window.CONFIG_CAMPI[def.id].label) || def.id);
        riga.appendChild(nome);

        if (propri.has(def.id)) {
            const segno = document.createElement('span');
            segno.className = 'campo-proprio-segno';
            segno.textContent = window.t('own_field_badge', 'solo qui');
            riga.appendChild(segno);
        }

        // P2.4 — l'alternativa da tastiera al trascinamento, come per gli allegati: senza,
        // il riordino sarebbe una funzione riservata a chi usa il mouse.
        const su = _pulsanteSposta('chevron-up', window.t('reorder_up', 'Sposta su'), () => _sposta(indice, -1));
        const giu = _pulsanteSposta('chevron-down', window.t('reorder_down', 'Sposta giù'), () => _sposta(indice, 1));
        su.disabled = indice === 0;
        giu.disabled = indice === definizioni.length - 1;
        riga.append(su, giu);

        riga.addEventListener('dragstart', (e) => {
            _trascinato = riga;
            riga.classList.add('riordino-in-volo');
            e.dataTransfer.effectAllowed = 'move';
            // Firefox non avvia il trascinamento senza dati impostati.
            e.dataTransfer.setData('text/plain', def.id);
        });
        riga.addEventListener('dragend', () => {
            riga.classList.remove('riordino-in-volo');
            _trascinato = null;
            _applicaOrdineDalDom();
        });
        riga.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!_trascinato || _trascinato === riga) return;
            const meta = riga.getBoundingClientRect().top + riga.offsetHeight / 2;
            lista.insertBefore(_trascinato, e.clientY < meta ? riga : riga.nextSibling);
        });
        riga.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            _sposta(indice, e.key === 'ArrowUp' ? -1 : 1, true);
        });

        lista.appendChild(riga);
    });

    if (window.lucide) lucide.createIcons({ nodes: [lista] });
}

function _pulsanteSposta(icona, titolo, azione) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'riordino-freccia';
    b.title = titolo;
    b.setAttribute('aria-label', titolo);
    b.innerHTML = `<i data-lucide="${icona}" class="w-4 h-4"></i>`;
    b.onclick = azione;
    return b;
}

function _sposta(indice, delta, tornaAlFuoco) {
    const ids = _idsCorrenti();
    const nuovo = indice + delta;
    if (nuovo < 0 || nuovo >= ids.length) return;
    const [preso] = ids.splice(indice, 1);
    ids.splice(nuovo, 0, preso);
    _salvaOrdine(ids);
    _disegnaElencoRiordino();
    if (tornaAlFuoco) {
        const riga = document.querySelector(`#form-riordino-lista .riordino-riga[data-campo="${CSS.escape(preso)}"]`);
        if (riga) riga.focus();
    }
}

/** L'ordine come sta adesso nel DOM dell'elenco (dopo un trascinamento). */
function _applicaOrdineDalDom() {
    const righe = document.querySelectorAll('#form-riordino-lista .riordino-riga');
    _salvaOrdine(Array.from(righe).map(r => r.dataset.campo));
    _disegnaElencoRiordino();
}

function _salvaOrdine(ids) {
    // La scrittura passa dal modello: è lui a decidere che un ordine uguale a quello
    // naturale NON si salva (una chiave in più cambierebbe l'impronta del record).
    const finto = {};
    window.Model.scriviOrdineCampi(finto, ids, _ordineNaturale());
    scriviOrdineCampiForm(finto.ordineCampi || []);
    window.isFormDirty = true;
}

/** Gli id nell'ordine che avrebbero senza riordino: prima il tipo, poi i campi propri. */
function _ordineNaturale() {
    const sel = document.getElementById('form-tipo-documento');
    const tipo = (appData.tipiDocumento || []).find(t => t.id === (sel ? sel.value : ''))
        || (appData.tipiDocumento || [])[0] || null;
    const propri = window.campiPropriForm ? window.campiPropriForm() : [];
    return window.Model.campiDellaScheda({ campiPropri: propri }, tipo, window.CONFIG_CAMPI, appData)
        .map(d => d.id);
}
window.ordineNaturaleCampiForm = _ordineNaturale;
