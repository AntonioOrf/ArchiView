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

function _idsCorrenti() {
    return window.campiDefinitiDelForm().map(d => d.id);
}

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

window.chiudiRiordinoCampi = function(silenzioso) {
    const campi = document.getElementById('form-dynamic-fields');
    const box = document.getElementById('form-riordino');
    if (!campi || !box) return;
    window.riordinoCampiAttivo = false;
    box.classList.add('hidden-tab');
    campi.classList.remove('hidden-tab');
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

window.azzeraRiordinoCampi = function() {
    scriviOrdineCampiForm([]);
    window.isFormDirty = true;
    _disegnaElencoRiordino();
};

let _trascinato: any = null;

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

        const su = _pulsanteSposta('chevron-up', window.t('reorder_up', 'Sposta su'), () => _sposta(indice, -1));
        const giu = _pulsanteSposta('chevron-down', window.t('reorder_down', 'Sposta giù'), () => _sposta(indice, 1));
        su.disabled = indice === 0;
        giu.disabled = indice === definizioni.length - 1;
        riga.append(su, giu);

        riga.addEventListener('dragstart', (e) => {
            _trascinato = riga;
            riga.classList.add('riordino-in-volo');
            if (!e.dataTransfer) return;
            e.dataTransfer.effectAllowed = 'move';
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
    b.innerHTML = `<i data-lucide="${escapeHTML(icona)}" class="w-4 h-4"></i>`;
    b.onclick = azione;
    return b;
}

function _sposta(indice, delta, tornaAlFuoco?) {
    const ids = _idsCorrenti();
    const nuovo = indice + delta;
    if (nuovo < 0 || nuovo >= ids.length) return;
    const [preso] = ids.splice(indice, 1);
    ids.splice(nuovo, 0, preso);
    _salvaOrdine(ids);
    _disegnaElencoRiordino();
    if (tornaAlFuoco) {
        const riga = document.querySelector(`#form-riordino-lista .riordino-riga[data-campo="${CSS.escape(preso)}"]`);
        if (riga) (riga as HTMLElement).focus();
    }
}

function _applicaOrdineDalDom() {
    const righe = document.querySelectorAll('#form-riordino-lista .riordino-riga');
    _salvaOrdine(Array.from(righe).map(r => r.dataset.campo));
    _disegnaElencoRiordino();
}

function _salvaOrdine(ids) {
    const finto: { ordineCampi?: string[] } = {};
    window.Model.scriviOrdineCampi(finto, ids, _ordineNaturale());
    scriviOrdineCampiForm(finto.ordineCampi || []);
    window.isFormDirty = true;
}

function _ordineNaturale() {
    const sel = document.getElementById('form-tipo-documento');
    const tipo = (appData.tipiDocumento || []).find(t => t.id === (sel ? sel.value : ''))
        || (appData.tipiDocumento || [])[0] || null;
    const propri = window.campiPropriForm ? window.campiPropriForm() : [];
    return window.Model.campiDellaScheda({ campiPropri: propri }, tipo, window.CONFIG_CAMPI, appData)
        .map(d => d.id);
}
window.ordineNaturaleCampiForm = _ordineNaturale;
