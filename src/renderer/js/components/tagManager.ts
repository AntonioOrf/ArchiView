// @ts-nocheck

// Fase 3.4 — Il pannello "Gestione tag".
//
// Prima della 3.4 un tag esisteva solo come sottostringa dentro il campo `tags` di N
// schede: correggere un refuso — `pergamana` per `pergamena` — significava aprire le schede
// una per una, perché nemmeno il trova&sostituisci in massa (1.5) lo faceva in sicurezza
// (agisce sulla selezione e per sottostringa, quindi `not` toccava anche `notaio`).
//
// Le mutazioni NON stanno qui: sono in `logic/tagsLogic.ts`, che a sua volta delega
// l'aritmetica a `shared/model.ts`. Questo file raccoglie parametri e ridisegna, ed è la
// stessa divisione in tre strati delle azioni in massa.
//
// PREFISSO `_tm` sugli helper privati: gli script del renderer non sono moduli e il bundle
// li concatena in UN UNICO scope — una `function riga()` qui dentro sostituirebbe quella
// omonima di un altro componente per l'intero bundle, senza un errore in console.

function _tmT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

/** I tag selezionati per la fusione, per chiave. Sopravvive ai ridisegni della lista. */
let _tmSelezionati = new Set();

window.apriGestioneTag = function() {
    const modal = document.getElementById('tag-manager-modal');
    if (!modal) return;
    _tmSelezionati = new Set();
    const filtro = document.getElementById('tag-manager-filter');
    if (filtro) filtro.value = '';
    modal.classList.remove('hidden-tab');
    window.disegnaGestioneTag();
    if (filtro) filtro.focus();
};

window.chiudiGestioneTag = function() {
    const modal = document.getElementById('tag-manager-modal');
    if (modal) modal.classList.add('hidden-tab');
};

/** Riga: selezione per la fusione, colore, nome (rinominabile in loco), conteggio, elimina. */
function _tmRiga(voce) {
    const riga = document.createElement('div');
    riga.className = 'tag-manager-row';
    riga.dataset.chiave = voce.chiave;

    const sel = document.createElement('input');
    sel.type = 'checkbox';
    sel.className = 'shrink-0';
    sel.checked = _tmSelezionati.has(voce.chiave);
    sel.setAttribute('aria-label', _tmT('tag_select_for_merge', 'Seleziona per la fusione'));
    sel.onchange = () => {
        if (sel.checked) _tmSelezionati.add(voce.chiave);
        else _tmSelezionati.delete(voce.chiave);
        _tmAggiornaBarraFusione();
    };
    riga.appendChild(sel);

    const colore = document.createElement('select');
    colore.className = 'tag-color-select tag-col-' + (window.Model.coloreTag(appData, voce.nome) || 'neutro');
    const scelte = [{ value: '', label: _tmT('tag_color_none', 'Nessuno') }].concat(
        window.Model.COLORI_TAG.map(c => ({ value: c, label: _tmT('tag_color_' + c, c) }))
    );
    for (const s of scelte) {
        const opt = document.createElement('option');
        opt.value = s.value;
        opt.textContent = s.label;
        if (s.value === window.Model.coloreTag(appData, voce.nome)) opt.selected = true;
        colore.appendChild(opt);
    }
    colore.setAttribute('aria-label', _tmT('tag_color_label', 'Colore del tag'));
    colore.onchange = async () => {
        await window.impostaColoreTagArchivio(voce.nome, colore.value);
        window.disegnaGestioneTag();
    };
    riga.appendChild(colore);

    const nome = document.createElement('span');
    nome.className = 'tag-manager-name truncate';
    nome.textContent = voce.nome;   // textContent: è dato utente
    riga.appendChild(nome);

    const conteggio = document.createElement('span');
    conteggio.className = 'tag-manager-count tabular-nums';
    conteggio.textContent = String(voce.conteggio);
    conteggio.title = voce.conteggio === 1
        ? _tmT('tag_count_one', '1 scheda')
        : _tmT('tag_count_many', '{var0} schede').replace('{var0}', String(voce.conteggio));
    riga.appendChild(conteggio);

    const rinomina = document.createElement('button');
    rinomina.type = 'button';
    rinomina.className = 'btn btn-ghost btn-icon shrink-0';
    rinomina.title = _tmT('tag_rename', 'Rinomina');
    rinomina.setAttribute('aria-label', _tmT('tag_rename', 'Rinomina') + ': ' + voce.nome);
    rinomina.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
    rinomina.onclick = () => _tmRinominaInLoco(riga, voce);
    riga.appendChild(rinomina);

    const elimina = document.createElement('button');
    elimina.type = 'button';
    elimina.className = 'btn btn-ghost btn-icon shrink-0 text-red-600';
    elimina.title = _tmT('tag_delete', 'Elimina il tag');
    elimina.setAttribute('aria-label', _tmT('tag_delete', 'Elimina il tag') + ': ' + voce.nome);
    elimina.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    elimina.onclick = async () => {
        // Nessun modale di conferma: l'operazione è annullabile dal toast, come ogni altra
        // azione in massa. Una conferma in più su un'azione già reversibile è solo attrito.
        await window.eliminaTagArchivio(voce.nome);
        _tmSelezionati.delete(voce.chiave);
        window.disegnaGestioneTag();
    };
    riga.appendChild(elimina);

    return riga;
}

/**
 * La rinomina avviene nella riga, non in un modale sopra il modale: un secondo livello di
 * finestra per cambiare una parola è sproporzionato, e su Esc si finirebbe per chiudere
 * l'uno o l'altro senza sapere quale.
 */
function _tmRinominaInLoco(riga, voce) {
    const nome = riga.querySelector('.tag-manager-name');
    if (!nome || riga.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input tag-manager-input';
    input.value = voce.nome;
    riga.replaceChild(input, nome);
    input.focus();
    input.select();

    let chiuso = false;
    const annulla = () => {
        if (chiuso) return;
        chiuso = true;
        window.disegnaGestioneTag();
    };
    const conferma = async () => {
        if (chiuso) return;
        chiuso = true;
        const nuovo = input.value.trim();
        if (nuovo && window.Model.chiaveTag(nuovo) !== voce.chiave) {
            // Se la chiave nuova esiste già è una FUSIONE, e va detto: l'utente crede di
            // rinominare e si ritroverebbe due tag diventati uno senza averlo chiesto.
            const esiste = window.Model.conteggiTag(appData.manoscritti, appData)
                .some(v => v.chiave === window.Model.chiaveTag(nuovo));
            if (esiste && typeof mostraMessaggio === 'function') {
                mostraMessaggio(_tmT('msg_tag_rename_merges', 'Un tag con questo nome esiste già: i due sono stati fusi.'), 'info');
            }
        }
        if (nuovo) await window.rinominaTagArchivio(voce.nome, nuovo);
        _tmSelezionati.delete(voce.chiave);
        window.disegnaGestioneTag();
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); conferma(); }
        // Esc annulla la SOLA rinomina e si ferma qui: senza stopPropagation chiuderebbe
        // anche il modale, cioè due passi indietro per un tasto solo.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); annulla(); }
    };
    input.onblur = () => conferma();
}

/** La barra della fusione compare solo con almeno due tag scelti: sotto non ha significato. */
function _tmAggiornaBarraFusione() {
    const barra = document.getElementById('tag-merge-bar');
    const sel = document.getElementById('tag-merge-target');
    if (!barra || !sel) return;

    const voci = window.Model.conteggiTag(appData.manoscritti, appData)
        .filter(v => _tmSelezionati.has(v.chiave));

    if (voci.length < 2) {
        barra.classList.add('hidden');
        return;
    }
    barra.classList.remove('hidden');
    const precedente = sel.value;
    sel.innerHTML = '';
    for (const v of voci) {
        const opt = document.createElement('option');
        opt.value = v.chiave;
        opt.textContent = v.nome;
        sel.appendChild(opt);
    }
    // La destinazione è uno dei tag scelti, non un nome nuovo: fondere in un tag inesistente
    // è una rinomina, e la rinomina ha già il suo pulsante su ogni riga.
    if (voci.some(v => v.chiave === precedente)) sel.value = precedente;
}

window.disegnaGestioneTag = function() {
    const lista = document.getElementById('tag-manager-list');
    if (!lista) return;

    const filtro = window.Model.chiaveTag(document.getElementById('tag-manager-filter')?.value || '');
    let voci = window.Model.conteggiTag(appData.manoscritti, appData);
    // Le chiavi selezionate che non esistono più (tag fuso, rinominato o eliminato) vanno
    // dimenticate, o la barra della fusione conterebbe fantasmi.
    const vive = new Set(voci.map(v => v.chiave));
    for (const k of Array.from(_tmSelezionati)) if (!vive.has(k)) _tmSelezionati.delete(k);
    if (filtro) voci = voci.filter(v => v.chiave.includes(filtro));

    lista.innerHTML = '';
    if (voci.length === 0) {
        const vuoto = document.createElement('div');
        vuoto.className = 'p-6 text-xs text-stone-400 italic text-center';
        vuoto.textContent = _tmT('no_tags_found', 'Nessun tag disponibile');
        lista.appendChild(vuoto);
        _tmAggiornaBarraFusione();
        return;
    }

    const frammento = document.createDocumentFragment();
    for (const v of voci) frammento.appendChild(_tmRiga(v));
    lista.appendChild(frammento);
    _tmAggiornaBarraFusione();
    if (window.lucide) lucide.createIcons({ nodes: [lista] });
};

window.fondiTagSelezionati = async function() {
    const sel = document.getElementById('tag-merge-target');
    if (!sel || !sel.value) return;
    const voci = window.Model.conteggiTag(appData.manoscritti, appData);
    const destinazione = voci.find(v => v.chiave === sel.value);
    if (!destinazione) return;
    const sorgenti = voci.filter(v => _tmSelezionati.has(v.chiave) && v.chiave !== destinazione.chiave)
        .map(v => v.nome);
    if (sorgenti.length === 0) return;
    await window.fondiTagArchivio(sorgenti, destinazione.nome);
    _tmSelezionati = new Set([destinazione.chiave]);
    window.disegnaGestioneTag();
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('tag-manager-modal')) return;
        const html = `
    <div id="tag-manager-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="tags" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="tag_manager_title">Gestione tag</span>
                </h3>
            </div>
            <div class="modal-body">
                <input id="tag-manager-filter" type="text" class="form-input mb-3"
                       data-i18n-placeholder="placeholder_tags" placeholder="Filtra tag...">
                <div id="tag-manager-list" class="tag-manager-list"></div>
                <div id="tag-merge-bar" class="tag-merge-bar hidden">
                    <label for="tag-merge-target" class="text-xs text-stone-500 dark:text-stone-400" data-i18n="tag_merge_into">Fondi i tag scelti in:</label>
                    <select id="tag-merge-target" class="form-input"></select>
                    <button type="button" onclick="fondiTagSelezionati()" class="btn btn-primary shrink-0">
                        <span data-i18n="btn_tag_merge">Fondi</span>
                    </button>
                </div>
                <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3" data-i18n="tag_manager_hint">Rinomina, fusione ed eliminazione agiscono su tutte le schede dell'archivio, non solo su quelle selezionate. Ogni operazione è annullabile.</p>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiGestioneTag()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        const filtro = document.getElementById('tag-manager-filter');
        if (filtro) filtro.oninput = () => window.disegnaGestioneTag();
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('tag-manager-modal')] });
    });
})();
