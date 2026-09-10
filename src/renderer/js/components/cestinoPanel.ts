// @ts-nocheck

// Fase 4.1 — Il pannello "Cestino".
//
// Le mutazioni NON stanno qui: sono in `logic/cestinoLogic.ts`, che a sua volta parla con
// `main/trash.ts`, dove è scritto perché il cestino non entra nel database. Questo file
// raccoglie le scelte e ridisegna, come `tagManager.ts` per i tag: stessa divisione in tre
// strati, e deliberatamente le stesse classi `.tag-manager-list`/`.tag-manager-row`, perché
// è lo stesso oggetto d'interfaccia — un elenco di voci d'archivio con azioni in riga.
//
// PREFISSO `_cp` sugli helper privati: gli script del renderer non sono moduli e il bundle
// li concatena in UN UNICO scope.

function _cpT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

/** Gli id selezionati per l'azione in massa. Sopravvive ai ridisegni della lista. */
let _cpSelezionati = new Set();
/** L'ultimo elenco letto dal disco: la lista si ridisegna senza rileggere il file. */
let _cpVoci = [];

window.apriCestino = async function() {
    const modal = document.getElementById('cestino-modal');
    if (!modal) return;
    _cpSelezionati = new Set();
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
    riga.className = 'tag-manager-row';
    riga.dataset.id = String(rec.id);

    const sel = document.createElement('input');
    sel.type = 'checkbox';
    sel.className = 'shrink-0';
    sel.checked = _cpSelezionati.has(String(rec.id));
    sel.setAttribute('aria-label', _cpT('trash_select', 'Seleziona questa scheda'));
    sel.onchange = () => {
        if (sel.checked) _cpSelezionati.add(String(rec.id));
        else _cpSelezionati.delete(String(rec.id));
        _cpAggiornaBarra();
    };
    riga.appendChild(sel);

    const col = document.createElement('span');
    col.className = 'tag-manager-name truncate';
    const titolo = document.createElement('span');
    // textContent: è dato utente, e la segnatura di un manoscritto contiene di tutto.
    titolo.textContent = rec.segnatura || rec.titolo || _cpT('record_untitled', 'scheda senza titolo');
    const dove = document.createElement('span');
    dove.className = 'text-xs text-stone-500 dark:text-stone-400';
    const cartella = voce.cartella || rec.cartella || '';
    dove.textContent = '  ·  ' + (cartella || (typeof window.etichettaRadice === 'function' ? window.etichettaRadice() : _cpT('folder_root_label', 'Radice'))) +
        (voce.da ? '  ·  ' + voce.da : '');
    col.appendChild(titolo);
    col.appendChild(dove);
    riga.appendChild(col);

    const quando = document.createElement('span');
    quando.className = 'tag-manager-count tabular-nums shrink-0';
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
    elimina.className = 'btn btn-ghost btn-icon shrink-0 text-red-600';
    elimina.title = _cpT('trash_delete_forever', 'Elimina definitivamente');
    elimina.setAttribute('aria-label', _cpT('trash_delete_forever', 'Elimina definitivamente') + ': ' + titolo.textContent);
    elimina.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    elimina.onclick = () => window.eliminaVociCestino([String(rec.id)]);
    riga.appendChild(elimina);

    return riga;
}

/** La barra in massa compare solo con almeno una voce scelta: sotto non ha significato. */
function _cpAggiornaBarra() {
    const barra = document.getElementById('cestino-bulk-bar');
    const conteggio = document.getElementById('cestino-bulk-count');
    if (!barra) return;
    if (_cpSelezionati.size === 0) {
        barra.classList.add('hidden');
        return;
    }
    barra.classList.remove('hidden');
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
        errore.className = 'p-6 text-xs text-red-500 italic text-center';
        errore.textContent = _cpT('trash_read_error', 'Il cestino non è leggibile.');
        lista.appendChild(errore);
        _cpAggiornaBarra();
        return;
    }

    // Gli id selezionati che non ci sono più (ripristinati, scaduti) vanno dimenticati, o
    // la barra in massa conterebbe fantasmi.
    const vivi = new Set(_cpVoci.map(v => String(v.record.id)));
    for (const k of Array.from(_cpSelezionati)) if (!vivi.has(k)) _cpSelezionati.delete(k);

    if (_cpVoci.length === 0) {
        const vuoto = document.createElement('div');
        vuoto.className = 'p-6 text-xs text-stone-400 italic text-center';
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
    // Qui la conferma serve davvero: è l'unico punto dell'applicazione in cui un dato
    // sparisce senza rete: né undo, né cestino, né snapshot lo riporterebbero indietro
    // com'era un minuto prima.
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
        <div class="modal-window max-w-2xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="trash-2" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="trash_title">Cestino</span>
                </h3>
            </div>
            <div class="modal-body">
                <div id="cestino-list" class="tag-manager-list"></div>
                <div id="cestino-bulk-bar" class="tag-merge-bar hidden">
                    <span id="cestino-bulk-count" class="text-xs text-stone-500 dark:text-stone-400"></span>
                    <button type="button" onclick="ripristinaSelezionateCestino()" class="btn btn-primary shrink-0">
                        <span data-i18n="trash_restore">Ripristina</span>
                    </button>
                    <button type="button" onclick="eliminaSelezionateCestino()" class="btn btn-ghost text-red-600 shrink-0">
                        <span data-i18n="trash_delete_forever">Elimina definitivamente</span>
                    </button>
                </div>
                <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3" data-i18n="trash_hint">Le schede eliminate restano qui per 30 giorni e poi spariscono da sole. Il cestino è locale a questo computer: non viene sincronizzato e non occupa spazio nell'archivio condiviso.</p>
                <div class="modal-footer">
                    <button type="button" onclick="svuotaCestinoDaPannello()" class="btn btn-ghost text-red-600 mr-auto">
                        <span data-i18n="trash_empty_now">Svuota il cestino</span>
                    </button>
                    <button type="button" onclick="chiudiCestino()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('cestino-modal')] });
    });
})();
