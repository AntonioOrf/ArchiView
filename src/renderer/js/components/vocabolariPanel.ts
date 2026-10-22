function _vpT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

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
        nome.textContent = voc.nome;
        const conta = document.createElement('span');
        conta.className = 'vocab-conteggio';
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
        vuoto.className = 'p-6 modello-suggerimento text-center';
        vuoto.textContent = _vpT('vocab_none', 'Nessun vocabolario. Creane uno per condividere una lista di valori con tutto il gruppo.');
        valori.appendChild(vuoto);
        return;
    }

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
    nome.className = 'vocab-valore-nome';
    nome.textContent = valore;
    riga.appendChild(nome);

    const conta = document.createElement('span');
    conta.className = 'vocab-usi';
    conta.textContent = usi === 0 ? _vpT('vocab_uses_none', 'nessuna scheda')
        : usi === 1 ? _vpT('vocab_uses_one', '1 scheda')
        : _vpT('vocab_uses_n', '{var0} schede').replace('{var0}', String(usi));
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
    elimina.className = 'btn btn-danger-ghost btn-icon shrink-0';
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

function _vpRinominaInLoco(riga, voc, valore) {
    rinominaInLoco(riga, '.vocab-valore-nome', valore, async (nuovo) => {
        if (nuovo && nuovo !== valore) await window.rinominaValoreVocabolario(voc.id, valore, nuovo);
        window.disegnaVocabolari();
    });
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
        seg.className = 'dup-segnatura';
        seg.textContent = g.valore;
        const quante = document.createElement('span');
        quante.className = 'vocab-conteggio';
        quante.textContent = String(g.schede.length);
        testa.append(seg, quante);
        box.appendChild(testa);

        for (const m of g.schede) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dup-scheda';
            const dove = m.cartella || _vpT('folder_root_label', 'Archivio');
            const quando = m.lastModified ? new Date(m.lastModified).toLocaleDateString(window.localeAttuale()) : '';
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

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('vocab-modal')) return;
        const html = `
    <div id="vocab-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-4xl h-[80vh]" role="dialog" aria-modal="true" aria-labelledby="vocab-titolo">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="vocab-titolo" data-i18n="vocab_title">Vocabolari controllati</h3>
                    <p class="modal-sottotitolo" data-i18n="vocab_subtitle">Elenchi di valori ammessi, condivisi da tutti i modelli dell'archivio.</p>
                </div>
                <button type="button" data-on-click="chiudiVocabolari" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="vocab-griglia">
                <div class="vocab-colonna vocab-colonna-elenco">
                    <div id="vocab-list" class="vocab-elenco"></div>
                    <div class="vocab-nuovo">
                        <input id="vocab-new-name" type="text" class="form-input" data-i18n-placeholder="vocab_new" placeholder="Nuovo vocabolario" data-i18n-aria-label="vocab_new" aria-label="Nuovo vocabolario">
                        <button type="button" data-on-click="creaVocabolarioDalPannello" class="btn btn-secondary btn-icon shrink-0" data-i18n-title="vocab_new" data-i18n-aria-label="vocab_new" title="Nuovo vocabolario" aria-label="Nuovo vocabolario">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div class="vocab-colonna vocab-colonna-valori">
                    <div class="vocab-testa">
                        <h4 id="vocab-current-name" class="vocab-nome"></h4>
                        <div id="vocab-actions" class="ml-auto hidden">
                            <button type="button" data-on-click="eliminaVocabolarioDalPannello" class="btn btn-danger-ghost" data-i18n-title="vocab_delete" title="Elimina il vocabolario">
                                <span data-i18n="vocab_delete">Elimina il vocabolario</span>
                            </button>
                        </div>
                    </div>
                    <div class="vocab-nuovo">
                        <input id="vocab-new-value" type="text" class="form-input font-serif" data-i18n-placeholder="vocab_new_value" placeholder="Nuovo valore…" data-i18n-aria-label="vocab_new_value" aria-label="Nuovo valore">
                        <button type="button" data-on-click="aggiungiValoreDalPannello" class="btn btn-secondary shrink-0">
                            <span data-i18n="btn_add">Aggiungi</span>
                        </button>
                    </div>
                    <div id="vocab-values" class="vocab-valori"></div>
                    <p class="modello-suggerimento" data-i18n="vocab_hint">Un vocabolario è condiviso da tutto l'archivio e viaggia con la sincronizzazione. Rinominare un valore lo aggiorna in tutte le schede; toglierlo dall'elenco non lo cancella dalle schede che lo contengono.</p>
                </div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="apriDuplicati" class="btn-collegamento mr-auto">
                    <span data-i18n="dup_title">Segnature ripetute</span>
                </button>
                <button type="button" data-on-click="chiudiVocabolari" data-modal-cancel class="btn btn-primary">
                    <span data-i18n="btn_close">Chiudi</span>
                </button>
            </div>
        </div>
    </div>

    <div id="duplicati-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg max-h-[85vh]" role="dialog" aria-modal="true" aria-labelledby="duplicati-titolo">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="duplicati-titolo" data-i18n="dup_title">Segnature ripetute</h3>
                    <p id="duplicati-summary" class="modal-sottotitolo"></p>
                </div>
                <button type="button" data-on-click="chiudiDuplicati" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="duplicati-list"></div>
                <p class="modello-suggerimento mt-3" data-i18n="dup_hint">Una segnatura ripetuta non è per forza un errore: un fondo può contenerne per inventariazioni precedenti alla schedatura. L'elenco le segnala, la decisione resta a chi guarda.</p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="chiudiDuplicati" data-modal-cancel class="btn btn-primary">
                    <span data-i18n="btn_close">Chiudi</span>
                </button>
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
