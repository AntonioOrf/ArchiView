// @ts-nocheck

// Fase 3.5 — il pannello "Persone e luoghi" e i collegamenti fra schede.
//
// I nomi di persona erano già in archivio da sempre: sono i valori delle `dynamic_list`
// (`attori_dinamici`, `famiglia_dinamici`). Mancava il passo che li rende interrogabili —
// vederli tutti, sapere da quante schede compaiono, unificare due grafie della stessa
// persona — e il rimando diretto fra due schede, che non esisteva affatto.
//
// Le mutazioni sono in `logic/vocabolariLogic.ts`; qui c'è solo il DOM.
// PREFISSO `_ap` sugli helper privati: il bundle concatena tutti gli script in UNO scope.

function _apT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

/** 'persona' | 'luogo': la scheda del pannello attualmente mostrata. */
let _apTipo = 'persona';

// --- Pannello persone e luoghi ------------------------------------------------

window.apriAnagrafica = function(tipo) {
    const modal = document.getElementById('authority-modal');
    if (!modal) return;
    if (tipo) _apTipo = tipo;
    const filtro = document.getElementById('authority-filter');
    if (filtro) filtro.value = '';
    modal.classList.remove('hidden-tab');
    window.disegnaAnagrafica();
    if (filtro) filtro.focus();
};

window.chiudiAnagrafica = function() {
    const modal = document.getElementById('authority-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.cambiaTipoAnagrafica = function(tipo) {
    _apTipo = tipo;
    window.disegnaAnagrafica();
};

window.disegnaAnagrafica = function() {
    const lista = document.getElementById('authority-list');
    if (!lista) return;

    for (const t of window.Model.TIPI_AUTHORITY) {
        const btn = document.getElementById('authority-tab-' + t);
        if (!btn) continue;
        btn.classList.toggle('attiva', t === _apTipo);
        btn.setAttribute('aria-selected', String(t === _apTipo));
    }

    const filtro = window.Model.chiaveTesto(document.getElementById('authority-filter')?.value || '');
    let voci = window.elencoAuthority(_apTipo);
    if (filtro) voci = voci.filter(v => window.Model.chiaveTesto(v.nome).includes(filtro));

    lista.innerHTML = '';
    if (voci.length === 0) {
        const vuoto = document.createElement('div');
        vuoto.className = 'p-6 text-xs text-stone-400 italic text-center';
        // Il testo distingue "archivio senza persone" da "campo non dichiarato": senza,
        // un archivio pieno di attori ma con nessun campo marcato sembrerebbe vuoto.
        vuoto.textContent = _apT('auth_none', 'Nessuna voce. Le persone e i luoghi si raccolgono dai campi marcati come tali nell\'editor del tipo documento.');
        lista.appendChild(vuoto);
        return;
    }

    const frammento = document.createDocumentFragment();
    for (const v of voci) frammento.appendChild(_apRiga(v));
    lista.appendChild(frammento);
    if (window.lucide) lucide.createIcons({ nodes: [lista] });
};

function _apRiga(voce) {
    const riga = document.createElement('div');
    riga.className = 'tag-manager-row';

    const nome = document.createElement('span');
    nome.className = 'tag-manager-name auth-nome truncate';
    nome.textContent = voce.nome;   // textContent: è dato utente
    riga.appendChild(nome);

    const conteggio = document.createElement('span');
    conteggio.className = 'tag-manager-count tabular-nums';
    conteggio.textContent = String(voce.conteggio);
    conteggio.title = voce.conteggio === 1
        ? _apT('tag_count_one', '1 scheda')
        : _apT('tag_count_many', '{var0} schede').replace('{var0}', String(voce.conteggio));
    riga.appendChild(conteggio);

    // Il backlink è il motivo per cui l'anagrafica serve: "mostrami le schede in cui questa
    // persona compare" è la domanda che prima richiedeva una ricerca a mano, nome per nome.
    const vedi = document.createElement('button');
    vedi.type = 'button';
    vedi.className = 'btn btn-ghost btn-icon shrink-0';
    vedi.title = _apT('auth_show_records', 'Mostra le schede che la citano');
    vedi.setAttribute('aria-label', _apT('auth_show_records', 'Mostra le schede che la citano') + ': ' + voce.nome);
    vedi.innerHTML = '<i data-lucide="corner-down-right" class="w-4 h-4"></i>';
    vedi.onclick = () => {
        window.chiudiAnagrafica();
        const input = document.getElementById('search-input');
        // La ricerca fra virgolette è già esatta (1.3): un nome composto non deve essere
        // spezzato in token, o "Giovanni di Pietro" troverebbe tutti i Giovanni.
        if (input) input.value = '"' + voce.nome + '"';
        if (typeof renderMain === 'function') renderMain();
    };
    riga.appendChild(vedi);

    const rinomina = document.createElement('button');
    rinomina.type = 'button';
    rinomina.className = 'btn btn-ghost btn-icon shrink-0';
    rinomina.title = _apT('tag_rename', 'Rinomina');
    rinomina.setAttribute('aria-label', _apT('tag_rename', 'Rinomina') + ': ' + voce.nome);
    rinomina.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
    rinomina.onclick = () => _apRinominaInLoco(riga, voce);
    riga.appendChild(rinomina);

    return riga;
}

/**
 * Rinominare qui NON è cosmetico: riscrive il nome in tutte le schede che lo citano. È
 * l'operazione per cui l'anagrafica esiste — unificare "Bartolo da Sassoferrato" e
 * "Bartolus de Saxoferrato" senza aprire quaranta schede.
 */
function _apRinominaInLoco(riga, voce) {
    const nome = riga.querySelector('.auth-nome');
    if (!nome || riga.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input tag-manager-input';
    input.value = voce.nome;
    riga.replaceChild(input, nome);
    input.focus();
    input.select();

    let chiuso = false;
    const fine = async (conferma) => {
        if (chiuso) return;
        chiuso = true;
        const nuovo = input.value.trim();
        if (conferma && nuovo && nuovo !== voce.nome) await window.rinominaAuthorityArchivio(voce.tipo, voce.nome, nuovo);
        window.disegnaAnagrafica();
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); fine(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fine(false); }
    };
    input.onblur = () => fine(true);
}

// --- Il pannello "Schede collegate" -------------------------------------------
//
// Senza questo, il rimando sarebbe di sola scrittura: si registra nel form e non lo si
// rivede mai — men che meno dal lato della scheda puntata, che del collegamento non porta
// traccia nel dato (il verso entrante è calcolato, vedi shared/model.ts).
// Le due direzioni si mostrano SEPARATE e non fuse in un unico elenco: "questa scheda
// rimanda a" e "è richiamata da" sono affermazioni diverse, e un elenco solo le
// confonderebbe proprio dove la distinzione conta — l'originale e la sua copia.

let _apSchedaCollegamenti = null;

window.apriCollegamenti = function(id) {
    const modal = document.getElementById('relazioni-modal');
    if (!modal) return;
    _apSchedaCollegamenti = String(id);
    modal.classList.remove('hidden-tab');
    window.disegnaCollegamenti();
};

window.chiudiCollegamenti = function() {
    const modal = document.getElementById('relazioni-modal');
    if (modal) modal.classList.add('hidden-tab');
};

function _apRigaCollegamento(voce) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rel-riga w-full text-left';
    btn.onclick = () => {
        window.chiudiCollegamenti();
        if (typeof editItem === 'function') editItem(voce.scheda.id);
    };

    const tipo = document.createElement('span');
    tipo.className = 'rel-tipo';
    tipo.textContent = voce.tipo || _apT('link_generic', 'collegata a');
    btn.appendChild(tipo);

    const seg = document.createElement('span');
    seg.className = 'truncate';
    seg.textContent = voce.scheda.segnatura || _apT('no_signature', 'Senza segnatura');
    btn.appendChild(seg);

    // Cartella e tipo: due schede collegate hanno spesso segnature vicine, e senza il
    // contesto l'elenco è una colonna di stringhe quasi uguali.
    const dove = document.createElement('span');
    dove.className = 'ml-auto shrink-0 text-xs text-stone-400 truncate';
    dove.textContent = voce.scheda.cartella || '';
    btn.appendChild(dove);

    return btn;
}

window.disegnaCollegamenti = function() {
    const box = document.getElementById('relazioni-body');
    const titolo = document.getElementById('relazioni-subject');
    if (!box) return;

    const m = (appData.manoscritti || []).find(x => String(x.id) === _apSchedaCollegamenti);
    if (titolo) titolo.textContent = m ? (m.segnatura || _apT('no_signature', 'Senza segnatura')) : '';

    const risolte = window.relazioniRisolte(_apSchedaCollegamenti);
    box.innerHTML = '';

    const sezione = (chiave, fallback, voci) => {
        const h = document.createElement('p');
        h.className = 'text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mt-3 mb-1';
        h.textContent = _apT(chiave, fallback) + ' (' + voci.length + ')';
        box.appendChild(h);
        if (voci.length === 0) {
            const vuoto = document.createElement('p');
            vuoto.className = 'text-xs text-stone-400 italic';
            vuoto.textContent = _apT('link_none', 'Nessun collegamento.');
            box.appendChild(vuoto);
            return;
        }
        for (const v of voci) box.appendChild(_apRigaCollegamento(v));
    };

    sezione('link_outgoing', 'Questa scheda rimanda a', risolte.uscenti);
    sezione('link_incoming', 'È richiamata da', risolte.entranti);
};

// --- Collegamenti fra schede, dentro il form ----------------------------------

/**
 * Le relazioni in corso di modifica vivono in un campo nascosto, come gli allegati: la
 * scheda nuova non ha ancora un id quando l'utente aggiunge il primo rimando, quindi non
 * c'è nulla su cui scrivere finché non si salva.
 */
function _apRelazioniForm() {
    const campo = document.getElementById('form-relazioni');
    if (!campo) return [];
    try { return window.Model.relazioni({ relazioni: JSON.parse(campo.value || '[]') }); }
    catch (err) { console.error('Campo relazioni illeggibile, riparto da vuoto:', err); return []; }
}

function _apScriviRelazioniForm(lista) {
    const campo = document.getElementById('form-relazioni');
    if (campo) campo.value = JSON.stringify(window.Model.relazioni({ relazioni: lista }));
}

/**
  * I collegamenti ENTRANTI, mostrati nel form sotto quelli uscenti e non modificabili da
  * qui: si tolgono dalla scheda che li ha scritti, e un pulsante che modificasse un'altra
  * scheda senza aprirla sarebbe una modifica invisibile a chi la sta compilando.
  */
window.renderBacklinkForm = function() {
    const box = document.getElementById('form-backlink-list');
    const blocco = document.getElementById('form-backlink');
    if (!box || !blocco) return;

    const id = String(document.getElementById('form-id')?.value || '');
    const entranti = id ? window.relazioniRisolte(id).entranti : [];
    // A scheda nuova, o senza rimandi in entrata, il blocco sparisce: una sezione vuota in
    // mezzo al form è rumore su ogni scheda che non ne ha.
    blocco.classList.toggle('hidden', entranti.length === 0);

    box.innerHTML = '';
    for (const voce of entranti) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rel-riga w-full text-left';
        btn.onclick = () => { if (typeof editItem === 'function') editItem(voce.scheda.id); };
        const tipo = document.createElement('span');
        tipo.className = 'rel-tipo';
        tipo.textContent = voce.tipo || _apT('link_generic', 'collegata a');
        const seg = document.createElement('span');
        seg.className = 'truncate';
        seg.textContent = voce.scheda.segnatura || _apT('no_signature', 'Senza segnatura');
        btn.append(tipo, seg);
        box.appendChild(btn);
    }
};

window.renderRelazioniForm = function() {
    const box = document.getElementById('form-relazioni-list');
    if (!box) return;
    window.renderBacklinkForm();
    const perId = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    const relazioni = _apRelazioniForm();

    box.innerHTML = '';
    if (relazioni.length === 0) {
        const vuoto = document.createElement('p');
        vuoto.className = 'text-xs text-stone-400 italic';
        vuoto.textContent = _apT('link_none', 'Nessun collegamento.');
        box.appendChild(vuoto);
    }

    for (const rel of relazioni) {
        const altra = perId.get(rel.id);
        const riga = document.createElement('div');
        riga.className = 'rel-riga';

        const etichetta = document.createElement('span');
        etichetta.className = 'rel-tipo';
        etichetta.textContent = rel.tipo || _apT('link_generic', 'collegata a');
        riga.appendChild(etichetta);

        const seg = document.createElement('span');
        seg.className = 'truncate';
        // Una scheda che non c'è NON si cancella dal dato: su un archivio condiviso può
        // esistere sulla copia di un collega e non ancora sulla nostra.
        seg.textContent = altra ? (altra.segnatura || _apT('no_signature', 'Senza segnatura')) : _apT('link_missing', 'scheda non presente in questa copia');
        if (!altra) seg.classList.add('italic', 'text-stone-400');
        riga.appendChild(seg);

        const via = document.createElement('button');
        via.type = 'button';
        via.className = 'btn btn-ghost btn-icon shrink-0 text-red-600 ml-auto';
        via.title = _apT('link_remove', 'Togli il collegamento');
        via.setAttribute('aria-label', _apT('link_remove', 'Togli il collegamento'));
        via.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
        via.onclick = () => {
            _apScriviRelazioniForm(_apRelazioniForm().filter(r => r.id !== rel.id));
            window.renderRelazioniForm();
            // La scheda appena scollegata torna fra quelle collegabili: senza, per
            // rifare il collegamento bisognerebbe chiudere e riaprire il form.
            window.aggiornaSelettoriRelazione();
        };
        riga.appendChild(via);

        box.appendChild(riga);
    }
    if (window.lucide) lucide.createIcons({ nodes: [box] });
};

/**
 * Riempie la tendina delle schede collegabili e quella dei tipi di relazione.
 *
 * ⚠️ Si popola SOLO a form aperto, e a form chiuso si svuota. Una tendina di segnature
 * costruita una volta all'avvio invecchia: dopo un'eliminazione continuerebbe a offrire una
 * scheda che non c'è più, e — poiché il form vive dentro `<main>` anche quando è nascosto —
 * le sue opzioni resterebbero nel testo della pagina, cioè visibili alla ricerca e ai test.
 */
window.aggiornaSelettoriRelazione = function() {
    const scheda = document.getElementById('form-relazione-target');
    const tipo = document.getElementById('form-relazione-tipo');
    if (!scheda || !tipo) return;

    const idCorrente = String(document.getElementById('form-id')?.value || '');
    const gia = new Set(_apRelazioniForm().map(r => r.id));

    scheda.innerHTML = '';
    const vuota = document.createElement('option');
    vuota.value = '';
    vuota.textContent = _apT('link_choose', '— scegli una scheda —');
    scheda.appendChild(vuota);

    const vista = document.getElementById('view-add');
    if (vista && vista.classList.contains('hidden-tab')) { tipo.innerHTML = ''; return; }
    // Sé stessa e le già collegate restano fuori: sono le due scelte che non producono nulla.
    const candidate = (appData.manoscritti || [])
        .filter(m => m && String(m.id) !== idCorrente && !gia.has(String(m.id)))
        .sort((a, b) => window.confrontaNaturale(a.segnatura, b.segnatura))
        .slice(0, 500);   // oltre, la tendina non è più uno strumento: si cerca, non si scorre
    for (const m of candidate) {
        const opt = document.createElement('option');
        opt.value = String(m.id);
        opt.textContent = (m.segnatura || _apT('no_signature', 'Senza segnatura')) + (m.cartella ? ' · ' + m.cartella : '');
        scheda.appendChild(opt);
    }

    tipo.innerHTML = '';
    const senza = document.createElement('option');
    senza.value = '';
    senza.textContent = _apT('link_generic', 'collegata a');
    tipo.appendChild(senza);
    for (const v of window.Model.valoriVocabolario(appData, 'relazione')) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        tipo.appendChild(opt);
    }
};

window.aggiungiRelazioneForm = function() {
    const scheda = document.getElementById('form-relazione-target');
    const tipo = document.getElementById('form-relazione-tipo');
    if (!scheda || !scheda.value) return;
    const lista = _apRelazioniForm();
    lista.push({ id: scheda.value, tipo: tipo ? tipo.value : '' });
    _apScriviRelazioniForm(lista);
    window.renderRelazioniForm();
    window.aggiornaSelettoriRelazione();
};

/** Carica nel form le relazioni di una scheda esistente (o le azzera per una nuova). */
window.caricaRelazioniForm = function(m) {
    _apScriviRelazioniForm(m ? window.Model.relazioni(m) : []);
    window.renderRelazioniForm();
    window.aggiornaSelettoriRelazione();
};

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('authority-modal')) return;
        const html = `
    <div id="relazioni-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="link" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="link_panel_title">Schede collegate</span>
                    <code id="relazioni-subject" class="ml-1 truncate"></code>
                </h3>
            </div>
            <div class="modal-body">
                <div id="relazioni-body" class="space-y-1"></div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiCollegamenti()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                    <button type="button" onclick="chiudiCollegamenti(); apriGrafo();" class="btn btn-secondary">
                        <i data-lucide="git-fork" class="w-4 h-4"></i>
                        <span data-i18n="graph_title">Grafo dei collegamenti</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="authority-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="users" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="auth_title">Persone e luoghi</span>
                </h3>
            </div>
            <div class="modal-body">
                <div class="auth-tabs" role="tablist">
                    <button type="button" id="authority-tab-persona" role="tab" aria-selected="true" class="auth-tab attiva" onclick="cambiaTipoAnagrafica('persona')">
                        <span data-i18n="auth_people">Persone</span>
                    </button>
                    <button type="button" id="authority-tab-luogo" role="tab" aria-selected="false" class="auth-tab" onclick="cambiaTipoAnagrafica('luogo')">
                        <span data-i18n="auth_places">Luoghi</span>
                    </button>
                </div>
                <input id="authority-filter" type="text" class="form-input my-3" data-i18n-placeholder="auth_filter" placeholder="Filtra…">
                <div id="authority-list" class="tag-manager-list"></div>
                <p class="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3" data-i18n="auth_hint">L'elenco si ricava dalle schede: non è un archivio parallelo. Rinominare una voce riscrive il nome in tutte le schede che lo citano, ed è il modo di unificare due grafie della stessa persona.</p>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiAnagrafica()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        const filtro = document.getElementById('authority-filter');
        if (filtro) filtro.oninput = () => window.disegnaAnagrafica();
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('authority-modal'), document.getElementById('relazioni-modal')] });
    });
})();
