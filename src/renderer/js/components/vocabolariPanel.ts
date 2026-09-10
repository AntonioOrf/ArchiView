// @ts-nocheck

// Fase 3.3 — il pannello "Vocabolari" — e Fase 3.6 — il rilevatore di segnature duplicate.
//
// Stanno nello stesso file perché sono due modali piccoli e senza stato condiviso con il
// resto: le mutazioni sono in `logic/vocabolariLogic.ts`, qui c'è solo il DOM.
//
// PREFISSO `_vp` sugli helper privati: il bundle concatena tutti gli script in UNO scope.

function _vpT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

// --- Vocabolari (3.3) ---------------------------------------------------------

/** Id del vocabolario mostrato nel riquadro di destra. */
let _vpAperto = null;

window.apriVocabolari = function(idDaAprire) {
    const modal = document.getElementById('vocab-modal');
    if (!modal) return;
    const elenco = window.elencoVocabolari();
    _vpAperto = idDaAprire || (_vpAperto && elenco.some(v => v.id === _vpAperto) ? _vpAperto : (elenco[0] && elenco[0].id)) || null;
    modal.classList.remove('hidden-tab');
    window.disegnaVocabolari();
};

window.chiudiVocabolari = function() {
    const modal = document.getElementById('vocab-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.disegnaVocabolari = function() {
    const lista = document.getElementById('vocab-list');
    const valori = document.getElementById('vocab-values');
    const titolo = document.getElementById('vocab-current-name');
    if (!lista || !valori) return;

    const elenco = window.elencoVocabolari();
    if (!elenco.some(v => v.id === _vpAperto)) _vpAperto = elenco[0] ? elenco[0].id : null;

    lista.innerHTML = '';
    for (const voc of elenco) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vocab-riga' + (voc.id === _vpAperto ? ' attiva' : '');
        btn.onclick = () => { _vpAperto = voc.id; window.disegnaVocabolari(); };
        const nome = document.createElement('span');
        nome.className = 'truncate';
        nome.textContent = voc.nome;   // textContent: è dato utente
        const conta = document.createElement('span');
        conta.className = 'shrink-0 ml-2 text-xs tabular-nums text-stone-400';
        conta.textContent = String((voc.valori || []).length);
        btn.append(nome, conta);
        lista.appendChild(btn);
    }

    const corrente = elenco.find(v => v.id === _vpAperto) || null;
    if (titolo) titolo.textContent = corrente ? corrente.nome : '';
    const azioni = document.getElementById('vocab-actions');
    if (azioni) azioni.classList.toggle('hidden', !corrente);

    valori.innerHTML = '';
    if (!corrente) {
        const vuoto = document.createElement('div');
        vuoto.className = 'p-6 text-xs text-stone-400 italic text-center';
        vuoto.textContent = _vpT('vocab_none', 'Nessun vocabolario. Creane uno per condividere una lista di valori con tutto il gruppo.');
        valori.appendChild(vuoto);
        return;
    }

    // Quante schede usano ciascun valore: senza il numero, togliere un valore è una
    // scommessa su quanto materiale ne dipende.
    const bersagli = window.Model.campiDelVocabolario(appData, corrente.id);
    const conteggio = {};
    for (const m of appData.manoscritti || []) {
        for (const b of bersagli) {
            if (String(m.tipoDocumento) !== b.tipo) continue;
            const k = window.Model.chiaveTesto(m[b.campo]);
            if (k) conteggio[k] = (conteggio[k] || 0) + 1;
        }
    }

    for (const valore of corrente.valori || []) {
        valori.appendChild(_vpRigaValore(corrente, valore, conteggio[window.Model.chiaveTesto(valore)] || 0));
    }
    if (window.lucide) lucide.createIcons({ nodes: [valori, lista] });
};

function _vpRigaValore(voc, valore, usi) {
    const riga = document.createElement('div');
    riga.className = 'vocab-valore';

    const nome = document.createElement('span');
    nome.className = 'vocab-valore-nome truncate';
    nome.textContent = valore;
    riga.appendChild(nome);

    const conta = document.createElement('span');
    conta.className = 'tag-manager-count tabular-nums';
    conta.textContent = usi ? String(usi) : '';
    conta.title = _vpT('vocab_used_by', 'Schede che usano questo valore');
    riga.appendChild(conta);

    const rinomina = document.createElement('button');
    rinomina.type = 'button';
    rinomina.className = 'btn btn-ghost btn-icon shrink-0';
    rinomina.title = _vpT('tag_rename', 'Rinomina');
    rinomina.setAttribute('aria-label', _vpT('tag_rename', 'Rinomina') + ': ' + valore);
    rinomina.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
    rinomina.onclick = () => _vpRinominaInLoco(riga, voc, valore);
    riga.appendChild(rinomina);

    const elimina = document.createElement('button');
    elimina.type = 'button';
    elimina.className = 'btn btn-ghost btn-icon shrink-0 text-red-600';
    elimina.title = _vpT('vocab_remove_value', 'Togli dall\'elenco');
    elimina.setAttribute('aria-label', _vpT('vocab_remove_value', 'Togli dall\'elenco') + ': ' + valore);
    elimina.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    elimina.onclick = async () => {
        await window.eliminaValoreVocabolario(voc.id, valore);
        window.disegnaVocabolari();
    };
    riga.appendChild(elimina);
    return riga;
}

/** Come nel pannello dei tag: si rinomina nella riga, non in un modale sopra il modale. */
function _vpRinominaInLoco(riga, voc, valore) {
    const nome = riga.querySelector('.vocab-valore-nome');
    if (!nome || riga.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input tag-manager-input';
    input.value = valore;
    riga.replaceChild(input, nome);
    input.focus();
    input.select();

    let chiuso = false;
    const fine = async (conferma) => {
        if (chiuso) return;
        chiuso = true;
        const nuovo = input.value.trim();
        if (conferma && nuovo && nuovo !== valore) await window.rinominaValoreVocabolario(voc.id, valore, nuovo);
        window.disegnaVocabolari();
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); fine(true); }
        // Esc annulla la sola rinomina: senza stopPropagation chiuderebbe anche il modale.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fine(false); }
    };
    input.onblur = () => fine(true);
}

window.aggiungiValoreDalPannello = async function() {
    const input = document.getElementById('vocab-new-value');
    if (!input || !_vpAperto) return;
    const valore = input.value.trim();
    if (!valore) return;
    await window.aggiungiValoreVocabolario(_vpAperto, valore);
    input.value = '';
    input.focus();
    window.disegnaVocabolari();
};

window.creaVocabolarioDalPannello = async function() {
    const campo = document.getElementById('vocab-new-name');
    const nome = campo ? campo.value.trim() : '';
    if (!nome) { if (campo) campo.focus(); return; }
    const id = window.Model.idVocabolario(nome);
    if (!id) return;
    if (window.Model.vocabolario(appData, id)) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_vpT('msg_vocab_exists', 'Esiste già un vocabolario con questo nome.'), 'error');
        return;
    }
    await window.salvaVocabolarioArchivio({ id, nome, valori: [] });
    if (campo) campo.value = '';
    window.apriVocabolari(id);
};

window.eliminaVocabolarioDalPannello = async function() {
    if (!_vpAperto) return;
    await window.eliminaVocabolarioArchivio(_vpAperto);
    _vpAperto = null;
    window.disegnaVocabolari();
};

// --- Duplicati della segnatura (3.6) ------------------------------------------

window.apriDuplicati = function() {
    const modal = document.getElementById('duplicati-modal');
    if (!modal) return;
    modal.classList.remove('hidden-tab');
    window.disegnaDuplicati();
};

window.chiudiDuplicati = function() {
    const modal = document.getElementById('duplicati-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.disegnaDuplicati = function() {
    const lista = document.getElementById('duplicati-list');
    const riassunto = document.getElementById('duplicati-summary');
    if (!lista) return;

    const gruppi = window.duplicatiSegnatura();
    lista.innerHTML = '';

    if (riassunto) {
        riassunto.textContent = gruppi.length === 0
            ? _vpT('dup_none', 'Nessuna segnatura ripetuta.')
            : _vpT('dup_found', '{var0} segnature ripetute.').replace('{var0}', String(gruppi.length));
    }
    if (gruppi.length === 0) return;

    for (const g of gruppi) {
        const box = document.createElement('div');
        box.className = 'dup-gruppo';

        const testa = document.createElement('div');
        testa.className = 'dup-testa';
        const seg = document.createElement('span');
        seg.className = 'font-semibold truncate';
        seg.textContent = g.valore;
        const quante = document.createElement('span');
        quante.className = 'tag-manager-count tabular-nums';
        quante.textContent = String(g.schede.length);
        testa.append(seg, quante);
        box.appendChild(testa);

        for (const m of g.schede) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dup-scheda';
            // Cartella e data distinguono due schede che per definizione hanno la stessa
            // segnatura: senza, l'elenco sarebbe N righe identiche.
            const dove = m.cartella || _vpT('folder_root_label', 'Archivio');
            const quando = m.lastModified ? new Date(m.lastModified).toLocaleDateString('it-IT') : '';
            btn.textContent = dove + (quando ? ' · ' + quando : '');
            btn.onclick = () => {
                window.chiudiDuplicati();
                if (typeof editItem === 'function') editItem(m.id);
            };
            box.appendChild(btn);
        }
        lista.appendChild(box);
    }
};

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('vocab-modal')) return;
        const html = `
    <div id="vocab-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-2xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="list-tree" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="vocab_title">Vocabolari controllati</span>
                </h3>
            </div>
            <div class="modal-body">
                <div class="vocab-griglia">
                    <div class="vocab-colonna">
                        <div id="vocab-list" class="vocab-elenco"></div>
                        <div class="flex gap-2">
                            <input id="vocab-new-name" type="text" class="form-input" data-i18n-placeholder="vocab_new" placeholder="Nuovo vocabolario">
                            <button type="button" onclick="creaVocabolarioDalPannello()" class="btn btn-secondary shrink-0" data-i18n-title="vocab_new" data-i18n-aria-label="vocab_new" title="Nuovo vocabolario" aria-label="Nuovo vocabolario">
                                <i data-lucide="plus" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <div class="vocab-colonna">
                        <div class="flex items-center gap-2">
                            <strong id="vocab-current-name" class="truncate"></strong>
                            <div id="vocab-actions" class="ml-auto hidden">
                                <button type="button" onclick="eliminaVocabolarioDalPannello()" class="btn btn-ghost btn-icon text-red-600" data-i18n-title="vocab_delete" title="Elimina il vocabolario">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        <div id="vocab-values" class="tag-manager-list"></div>
                        <div class="flex gap-2">
                            <input id="vocab-new-value" type="text" class="form-input" data-i18n-placeholder="vocab_new_value" placeholder="Nuovo valore…">
                            <button type="button" onclick="aggiungiValoreDalPannello()" class="btn btn-primary shrink-0">
                                <span data-i18n="btn_add">Aggiungi</span>
                            </button>
                        </div>
                    </div>
                </div>
                <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3" data-i18n="vocab_hint">Un vocabolario è condiviso da tutto l'archivio e viaggia con la sincronizzazione. Rinominare un valore lo aggiorna in tutte le schede; toglierlo dall'elenco non lo cancella dalle schede che lo contengono.</p>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiVocabolari()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="duplicati-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="copy" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="dup_title">Segnature ripetute</span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="duplicati-summary" class="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3"></p>
                <div id="duplicati-list" class="tag-manager-list"></div>
                <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3" data-i18n="dup_hint">Una segnatura ripetuta non è per forza un errore: un fondo può contenerne per inventariazioni precedenti alla schedatura. L'elenco le segnala, la decisione resta a chi guarda.</p>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiDuplicati()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        const nuovo = document.getElementById('vocab-new-value');
        if (nuovo) nuovo.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); window.aggiungiValoreDalPannello(); } };
        const nuovoNome = document.getElementById('vocab-new-name');
        if (nuovoNome) nuovoNome.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); window.creaVocabolarioDalPannello(); } };
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('vocab-modal'), document.getElementById('duplicati-modal')] });
    });
})();
