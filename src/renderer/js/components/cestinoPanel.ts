function _cpT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

let _cpSelezionati = new Set<string>();
let _cpVoci = [];

window.apriCestino = async function() {
    const modal = document.getElementById('cestino-modal');
    if (!modal) return;
    _cpSelezionati = new Set<string>();
    modal.classList.remove('hidden-tab');
    await window.disegnaCestino();
};

window.chiudiCestino = function() {
    const modal = document.getElementById('cestino-modal');
    if (modal) modal.classList.add('hidden-tab');
};

function _cpData(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function _cpRiga(voce) {
    const rec = voce.record || {};
    const riga = document.createElement('div');
    riga.className = 'cestino-riga';
    riga.dataset.id = String(rec.id);

    const sel = document.createElement('input');
    sel.type = 'checkbox';
    sel.checked = _cpSelezionati.has(String(rec.id));
    sel.setAttribute('aria-label', _cpT('trash_select', 'Seleziona questa scheda'));
    sel.onchange = () => {
        if (sel.checked) _cpSelezionati.add(String(rec.id));
        else _cpSelezionati.delete(String(rec.id));
        _cpAggiornaBarra();
    };
    riga.appendChild(sel);

    const titolo = document.createElement('span');
    titolo.className = 'cestino-segnatura';
    titolo.textContent = rec.segnatura || rec.titolo || _cpT('record_untitled', 'scheda senza titolo');
    titolo.translate = false;
    const dove = document.createElement('span');
    dove.className = 'cestino-dove';
    const cartella = voce.cartella || rec.cartella || '';
    dove.textContent = (cartella || (typeof window.etichettaRadice === 'function' ? window.etichettaRadice() : _cpT('folder_root_label', 'Radice'))) +
        (voce.da ? '  ·  ' + voce.da : '');
    riga.append(titolo, dove);

    const quando = document.createElement('span');
    quando.className = 'cestino-quando';
    quando.textContent = _cpData(voce.deletedAt);
    riga.appendChild(quando);

    const ripristina = document.createElement('button');
    ripristina.type = 'button';
    ripristina.className = 'btn btn-ghost btn-icon shrink-0';
    ripristina.title = _cpT('trash_restore', 'Ripristina');
    ripristina.setAttribute('aria-label', _cpT('trash_restore', 'Ripristina') + ': ' + titolo.textContent);
    ripristina.innerHTML = '<i data-lucide="rotate-ccw" class="w-4 h-4"></i>';
    ripristina.onclick = () => window.ripristinaVociCestino([String(rec.id)]);
    riga.appendChild(ripristina);

    const elimina = document.createElement('button');
    elimina.type = 'button';
    elimina.className = 'btn btn-danger-ghost btn-icon shrink-0';
    elimina.title = _cpT('trash_delete_forever', 'Elimina definitivamente');
    elimina.setAttribute('aria-label', _cpT('trash_delete_forever', 'Elimina definitivamente') + ': ' + titolo.textContent);
    elimina.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    elimina.onclick = () => window.eliminaVociCestino([String(rec.id)]);
    riga.appendChild(elimina);

    return riga;
}

function _cpAggiornaBarra() {
    const barra = document.getElementById('cestino-bulk-bar');
    const conteggio = document.getElementById('cestino-bulk-count');
    if (!barra) return;
    if (_cpSelezionati.size === 0) {
        barra.classList.add('hidden-tab');
        return;
    }
    barra.classList.remove('hidden-tab');
    if (conteggio) {
        conteggio.textContent = _cpT('trash_selected', '{var0} selezionate').replace('{var0}', String(_cpSelezionati.size));
    }
}

window.disegnaCestino = async function() {
    const lista = document.getElementById('cestino-list');
    if (!lista) return;

    lista.innerHTML = '';
    try {
        _cpVoci = await window.elencaCestino();
    } catch (err) {
        console.error('[Cestino] Lettura fallita:', err);
        _cpVoci = [];
        const errore = document.createElement('div');
        errore.className = 'p-6 text-xs testo-pericolo text-center';
        errore.textContent = _cpT('trash_read_error', 'Il cestino non è leggibile.');
        lista.appendChild(errore);
        _cpAggiornaBarra();
        return;
    }

    const vivi = new Set(_cpVoci.map(v => String(v.record.id)));
    for (const k of Array.from(_cpSelezionati)) if (!vivi.has(k)) _cpSelezionati.delete(k);

    if (_cpVoci.length === 0) {
        const vuoto = document.createElement('div');
        vuoto.className = 'p-6 modello-suggerimento text-center';
        vuoto.textContent = _cpT('trash_empty', 'Il cestino è vuoto.');
        lista.appendChild(vuoto);
        _cpAggiornaBarra();
        return;
    }

    const frammento = document.createDocumentFragment();
    for (const v of _cpVoci) frammento.appendChild(_cpRiga(v));
    lista.appendChild(frammento);
    _cpAggiornaBarra();
    if (window.lucide) lucide.createIcons({ nodes: [lista] });
};

window.ripristinaVociCestino = async function(ids) {
    try {
        const rientrati = await window.ripristinaDalCestino(ids);
        if (rientrati.length === 0) {
            mostraMessaggio(_cpT('trash_restore_none', 'Nessuna scheda da ripristinare.'), 'info');
        } else {
            mostraMessaggio(
                _cpT('trash_restored', '{var0} schede ripristinate.').replace('{var0}', String(rientrati.length)),
                'success'
            );
        }
    } catch (err) {
        console.error('[Cestino] Ripristino fallito:', err);
        mostraMessaggio(_cpT('trash_restore_error', 'Ripristino non riuscito: ') + (err.message || err), 'error');
    }
    await window.disegnaCestino();
};

window.eliminaVociCestino = async function(ids) {
    const quante = (ids || []).length;
    const msg = quante > 1
        ? _cpT('trash_confirm_delete_many', 'Eliminare definitivamente {var0} schede? L\'operazione non è annullabile.').replace('{var0}', String(quante))
        : _cpT('trash_confirm_delete_one', 'Eliminare definitivamente questa scheda? L\'operazione non è annullabile.');

    const procedi = async () => {
        try {
            await window.eliminaDefinitivo(ids);
        } catch (err) {
            console.error('[Cestino] Eliminazione fallita:', err);
            mostraMessaggio(_cpT('trash_delete_error', 'Eliminazione non riuscita: ') + (err.message || err), 'error');
        }
        await window.disegnaCestino();
    };

    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, procedi);
    else await procedi();
};

window.svuotaCestinoDaPannello = function() {
    const msg = _cpT('trash_confirm_empty', 'Svuotare il cestino? Tutte le schede eliminate andranno perse definitivamente.');
    const procedi = async () => {
        try {
            const quante = await window.svuotaCestino();
            mostraMessaggio(_cpT('trash_emptied', 'Cestino svuotato ({var0} schede).').replace('{var0}', String(quante)), 'success');
        } catch (err) {
            console.error('[Cestino] Svuotamento fallito:', err);
            mostraMessaggio(_cpT('trash_delete_error', 'Eliminazione non riuscita: ') + (err.message || err), 'error');
        }
        await window.disegnaCestino();
    };
    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, procedi);
    else procedi();
};

window.ripristinaSelezionateCestino = function() {
    if (_cpSelezionati.size === 0) return;
    return window.ripristinaVociCestino(Array.from(_cpSelezionati));
};

window.eliminaSelezionateCestino = function() {
    if (_cpSelezionati.size === 0) return;
    return window.eliminaVociCestino(Array.from(_cpSelezionati));
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('cestino-modal')) return;
        const html = `
    <div id="cestino-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-3xl max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="cestino-titolo">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="cestino-titolo" data-i18n="trash_title">Cestino</h3>
                    <p class="modal-sottotitolo" data-i18n="trash_hint">Le schede eliminate restano qui per il tempo scelto nelle Impostazioni, poi spariscono da sole. Il cestino è di questo computer e non si sincronizza.</p>
                </div>
                <button type="button" data-on-click="chiudiCestino" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="cestino-bulk-bar" class="barra-selezione hidden-tab">
                <span id="cestino-bulk-count" class="barra-selezione-conteggio"></span>
                <button type="button" data-on-click="ripristinaSelezionateCestino" class="btn btn-secondary ml-auto">
                    <span data-i18n="trash_restore">Ripristina</span>
                </button>
                <button type="button" data-on-click="eliminaSelezionateCestino" class="btn btn-danger-ghost">
                    <span data-i18n="trash_delete_forever">Elimina definitivamente</span>
                </button>
            </div>
            <div class="modal-body pt-1">
                <div class="cestino-intestazione" aria-hidden="true">
                    <span></span>
                    <span data-i18n="trash_col_record">Scheda</span>
                    <span data-i18n="trash_col_where">Era in</span>
                    <span data-i18n="trash_col_when">Eliminata</span>
                </div>
                <div id="cestino-list"></div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="svuotaCestinoDaPannello" class="btn btn-danger-ghost mr-auto">
                    <span data-i18n="trash_empty_now">Svuota il cestino</span>
                </button>
                <button type="button" data-on-click="chiudiCestino" data-modal-cancel class="btn btn-primary">
                    <span data-i18n="btn_close">Chiudi</span>
                </button>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('cestino-modal')] });
    });
})();
