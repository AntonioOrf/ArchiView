function _iiT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

let _iiStato = null;

function _iiMotivo(codice, extra?) {
    switch (codice) {
        case 'url_non_valido': return _iiT('iiif_err_url', "L'indirizzo non e' valido: serve un URL http o https.");
        case 'timeout': return _iiT('iiif_err_timeout', 'Il server della biblioteca non ha risposto in tempo.');
        case 'rete': return _iiT('iiif_err_net', 'Impossibile raggiungere il server della biblioteca.');
        case 'http': return _iiT('iiif_err_http', 'Il server ha risposto con un errore.') + (extra ? ` (${extra})` : '');
        case 'troppo_grande': return _iiT('iiif_err_big', 'Il file e\' troppo grande per essere un manifest.');
        case 'non_json': return _iiT('iiif_err_json', "L'indirizzo non restituisce un manifest: forse e' la pagina del manoscritto e non il suo manifest IIIF.");
        case 'non_manifest': return _iiT('iiif_err_shape', 'Il file scaricato non e\' un manifest IIIF.');
        case 'collection': return _iiT('iiif_err_collection', 'Questo indirizzo e\' una collezione di manoscritti, non un manoscritto: aprila nel sito della biblioteca e copia il manifest di un singolo manoscritto.');
        case 'nessuna_carta': return _iiT('iiif_err_empty', 'Il manifest non contiene nessuna carta.');
        case 'servizio_assente': return _iiT('iiif_warn_static', 'Questo manifest pubblica immagini a misura fissa: la risoluzione scelta verra\' ignorata.');
        case 'versione_ignota': return _iiT('iiif_warn_version', 'Il manifest non dichiara la sua versione: e\' stata dedotta dalla struttura.');
        default: return codice;
    }
}

function _iiBloccante(avvisi) {
    return (avvisi || []).some(a => a === 'collection' || a === 'nessuna_carta' || a === 'non_manifest');
}

function _iiEl(id) { return document.getElementById(id); }

function _iiLatoScelto() {
    const n = Number(_iiEl('iiif-lato').value);
    return Number.isFinite(n) && n >= 0 ? n : 2000;
}

function _iiMostraErrore(testo) {
    const box = _iiEl('iiif-errore');
    box.textContent = testo || '';
    box.classList.toggle('hidden-tab', !testo);
}

function _iiNomeTipo(t) {
    const chiave = 'model_' + t.id;
    const tradotto = window.t(chiave);
    return tradotto !== chiave ? tradotto : (t.nome || t.id);
}

function _iiEtichettaCarta(c, i) {
    return (c && c.etichetta) || _iiT('iiif_page_n', 'Carta {var0}').replace('{var0}', String(i + 1));
}

window.apriImportIiif = function(opzioni) {
    const modal = _iiEl('iiif-modal');
    if (!modal) return;

    const opt = opzioni || {};
    const scheda = opt.idScheda ? appData.manoscritti.find(x => String(x.id) === String(opt.idScheda)) : null;
    _iiStato = { modalita: scheda ? 'aggiungi' : 'nuova', idScheda: scheda ? scheda.id : null, norm: null, url: '', selezione: new Set<number>() };

    _iiEl('iiif-url').value = (scheda && scheda.iiifManifestUrl) || '';
    _iiEl('iiif-anteprima').classList.add('hidden-tab');
    (_iiEl('iiif-conferma') as HTMLButtonElement).disabled = true;
    _iiEl('iiif-conferma').textContent = _iiT('iiif_import', 'Importa');
    _iiMostraErrore('');

    _iiEl('iiif-campi-scheda').classList.toggle('hidden-tab', _iiStato.modalita === 'aggiungi');
    _iiEl('iiif-titolo-modale').textContent = _iiStato.modalita === 'aggiungi'
        ? _iiT('iiif_title_add', 'Aggiungi carte da un manifest IIIF')
        : _iiT('iiif_title', 'Importa un manoscritto da un manifest IIIF');

    if (_iiStato.modalita === 'nuova') {
        const selTipo = _iiEl('iiif-tipo');
        selTipo.innerHTML = window.sanitizeHTML(
            (appData.tipiDocumento || []).map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(_iiNomeTipo(t))}</option>`).join('')
        );
        const ultimo = typeof leggiUltimoTipoDocumento === 'function' ? leggiUltimoTipoDocumento() : null;
        if (ultimo && (appData.tipiDocumento || []).some(t => t.id === ultimo)) selTipo.value = ultimo;

        const selCartella = _iiEl('iiif-cartella');
        const cartelle = ['', ...(appData.cartelle || [])];
        selCartella.innerHTML = window.sanitizeHTML(
            cartelle.map(c => {
                const etichetta = c || (window.etichettaRadice ? window.etichettaRadice() : _iiT('folder_root_label', 'Radice'));
                return `<option value="${escapeHTML(c)}">${escapeHTML(etichetta)}</option>`;
            }).join('')
        );
        if (window.cartellaAttuale) selCartella.value = window.cartellaAttuale;
    }

    if (scheda && Number.isFinite(Number(scheda.iiifLato))) _iiEl('iiif-lato').value = String(Number(scheda.iiifLato));

    modal.classList.remove('hidden-tab');
    if (typeof window.applicaTraduzioniHtml === 'function') window.applicaTraduzioniHtml();
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    _iiEl('iiif-url').focus();
};

window.aggiungiCarteIiifATrascrizione = function() {
    const campo = document.getElementById('trascrizione-id');
    if (!campo || !campo.value) return;
    window.apriImportIiif({ idScheda: campo.value });
};

window.chiudiImportIiif = function() {
    const modal = _iiEl('iiif-modal');
    if (modal) modal.classList.add('hidden-tab');
    _iiStato = null;
};

window.leggiManifestIiif = async function(event) {
    if (event) event.preventDefault();
    if (!_iiStato) return;
    const url = _iiEl('iiif-url').value.trim();
    if (!url) return;

    const btn = _iiEl('iiif-leggi') as HTMLButtonElement;
    btn.disabled = true;
    _iiMostraErrore('');
    _iiEl('iiif-anteprima').classList.add('hidden-tab');
    (_iiEl('iiif-conferma') as HTMLButtonElement).disabled = true;

    try {
        const esito = await window.apiIiif.leggiManifest(url);
        if (!esito || !esito.ok) {
            _iiMostraErrore(_iiMotivo(esito ? esito.codice : 'rete', esito && esito.stato));
            return;
        }

        const norm = window.IiifManifest.normalizza(esito.json);
        if (_iiBloccante(norm.avvisi)) {
            const codice = norm.avvisi.find(a => a === 'collection' || a === 'nessuna_carta') || 'non_manifest';
            let testo = _iiMotivo(codice);
            if (codice === 'collection' && norm.contenuti) {
                testo += ' ' + _iiT('iiif_collection_count', 'Manoscritti contenuti: {var0}.').replace('{var0}', String(norm.contenuti));
            }
            _iiMostraErrore(testo);
            return;
        }

        _iiStato.url = esito.url || url;
        _iiStato.norm = norm;
        _iiStato.selezione = new Set(norm.carte.map((_, i) => i));
        _iiDisegnaAnteprima();
    } catch (e) {
        console.error('[IIIF] Lettura manifest fallita:', e);
        _iiMostraErrore(e.message || _iiMotivo('rete'));
    } finally {
        btn.disabled = false;
    }
};

function _iiDisegnaAnteprima() {
    const { norm } = _iiStato;

    _iiEl('iiif-titolo').textContent = norm.etichetta || _iiT('iiif_untitled', 'Manoscritto senza titolo');
    if (_iiStato.modalita === 'nuova') _iiEl('iiif-segnatura').value = norm.etichetta || '';
    _iiEl('iiif-conteggio').textContent = _iiT('iiif_pages_count', '{var0} carte').replace('{var0}', String(norm.carte.length));

    const riga = [];
    if (norm.attribuzione) riga.push(norm.attribuzione);
    if (norm.licenza) riga.push(norm.licenza);
    _iiEl('iiif-diritti').textContent = riga.join(' — ');

    const avvisi = (norm.avvisi || []).filter(a => a !== 'collection' && a !== 'nessuna_carta');
    const boxAvvisi = _iiEl('iiif-avvisi');
    boxAvvisi.textContent = avvisi.map(a => _iiMotivo(a)).join(' ');
    boxAvvisi.classList.toggle('hidden-tab', avvisi.length === 0);

    _iiEl('iiif-intervallo').value = '';

    const griglia = _iiEl('iiif-miniature');
    griglia.innerHTML = window.sanitizeHTML(norm.carte.map((c, i) => {
        const src = window.srcAllegato({ remoto: true, iiif: c }, { lato: 140 });
        const etichetta = _iiEtichettaCarta(c, i);
        return `
            <label class="iiif-carta" data-indice="${i}" title="${escapeHTML(etichetta)}">
                <span class="iiif-carta-immagine">
                    <img src="${escapeHTML(src)}" alt="${escapeHTML(etichetta)}" loading="lazy">
                    <input type="checkbox" checked aria-label="${escapeHTML(etichetta)}">
                </span>
                <span class="iiif-carta-nome">${escapeHTML(etichetta)}</span>
            </label>`;
    }).join(''));

    griglia.onchange = (e) => {
        const casella = e.target as HTMLInputElement;
        if (!casella || casella.type !== 'checkbox') return;
        const etichetta = casella.closest('.iiif-carta');
        if (!etichetta) return;
        const i = Number(etichetta.dataset.indice);
        if (casella.checked) _iiStato.selezione.add(i); else _iiStato.selezione.delete(i);
        _iiEl('iiif-intervallo').value = '';
        _iiAggiornaConteggio();
    };

    _iiAggiornaConteggio();
    _iiEl('iiif-anteprima').classList.remove('hidden-tab');
}

function _iiSincronizzaCaselle() {
    for (const etichetta of _iiEl('iiif-miniature').querySelectorAll('.iiif-carta')) {
        const casella = etichetta.querySelector('input[type=checkbox]');
        if (casella) casella.checked = _iiStato.selezione.has(Number(etichetta.dataset.indice));
    }
}

function _iiAggiornaConteggio() {
    const n = _iiStato.selezione.size;
    const totale = _iiStato.norm.carte.length;
    _iiEl('iiif-selezionate').textContent = _iiT('iiif_selected_count', '{var0} di {var1} carte selezionate')
        .replace('{var0}', String(n)).replace('{var1}', String(totale));
    const conferma = _iiEl('iiif-conferma') as HTMLButtonElement;
    conferma.disabled = n === 0;
    conferma.textContent = n === 0 ? _iiT('iiif_import', 'Importa')
        : n === 1 ? _iiT('iiif_import_one', 'Importa una carta')
        : _iiT('iiif_import_n', 'Importa {var0} carte').replace('{var0}', String(n));
}

window.applicaIntervalloIiif = function() {
    if (!_iiStato || !_iiStato.norm) return;
    const testo = _iiEl('iiif-intervallo').value;
    const totale = _iiStato.norm.carte.length;
    const indici = testo.trim()
        ? window.IiifManifest.indiciDaIntervallo(testo, totale)
        : _iiStato.norm.carte.map((_, i) => i);
    _iiStato.selezione = new Set(indici);
    _iiSincronizzaCaselle();
    _iiAggiornaConteggio();
};

window.selezionaTutteIiif = function(tutte) {
    if (!_iiStato || !_iiStato.norm) return;
    _iiStato.selezione = tutte ? new Set(_iiStato.norm.carte.map((_, i) => i)) : new Set();
    _iiEl('iiif-intervallo').value = '';
    _iiSincronizzaCaselle();
    _iiAggiornaConteggio();
};

window.confermaImportIiif = async function() {
    if (!_iiStato || !_iiStato.norm) return;
    const { norm, url, modalita } = _iiStato;
    const indici = Array.from(_iiStato.selezione as Set<number>).sort((a, b) => a - b);
    if (!indici.length) return;

    const btn = _iiEl('iiif-conferma') as HTMLButtonElement;
    btn.disabled = true;

    try {
        const lato = _iiLatoScelto();

        if (modalita === 'aggiungi') {
            const m = appData.manoscritti.find(x => String(x.id) === String(_iiStato.idScheda));
            if (!m) throw new Error('scheda non trovata');

            const prima = JSON.parse(JSON.stringify(m.allegati || []));
            const nuovi = window.IiifManifest.costruisciAllegati(norm.carte, m.id, {
                indici,
                nomiEsistenti: (m.allegati || []).map(a => a && a.nome).filter(Boolean)
            });

            const applica = async () => {
                const vivo = appData.manoscritti.find(x => String(x.id) === String(m.id));
                if (!vivo) return;
                vivo.allegati = (vivo.allegati || []).concat(JSON.parse(JSON.stringify(nuovi)));
                if (!vivo.iiifManifestUrl) vivo.iiifManifestUrl = url;
                if (!vivo.iiifAttribuzione && norm.attribuzione) vivo.iiifAttribuzione = norm.attribuzione;
                if (!Number.isFinite(Number(vivo.iiifLato))) vivo.iiifLato = lato;
                vivo.lastModified = Date.now();
                await window.Store.commit();
            };
            const annulla = async () => {
                const vivo = appData.manoscritti.find(x => String(x.id) === String(m.id));
                if (!vivo) return;
                vivo.allegati = JSON.parse(JSON.stringify(prima));
                vivo.lastModified = Date.now();
                await window.Store.commit();
            };

            await applica();
            if (window.gestoreAnnullamento) {
                window.gestoreAnnullamento.registraAzione(
                    _iiT('undo_add_iiif', 'Aggiunta di {var0} carte IIIF').replace('{var0}', String(nuovi.length)),
                    annulla, applica
                );
            }

            window.chiudiImportIiif();
            if (typeof window.renderBarraCarte === 'function') window.renderBarraCarte(m.id);
            if (typeof renderMain === 'function') renderMain();
            mostraMessaggio(
                _iiT('iiif_added', 'Aggiunte {var0} carte alla scheda.').replace('{var0}', String(nuovi.length)),
                'success',
                () => window.gestoreAnnullamento && window.gestoreAnnullamento.annullaUltimaAzione()
            );
            return;
        }

        let username = 'Anonimo';
        try {
            const settings = await window.apiSettings.get();
            username = settings.username || 'Anonimo';
        } catch (err) {
            console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
        }

        const id = window.Model.nuovoId();
        const scheda = window.Model.creaScheda({
            id,
            cartella: _iiEl('iiif-cartella').value || '',
            tipoDocumento: _iiEl('iiif-tipo').value,
            segnatura: _iiEl('iiif-segnatura').value.trim() || norm.etichetta || '',
            allegati: window.IiifManifest.costruisciAllegati(norm.carte, id, { indici }),
            iiifManifestUrl: url,
            iiifAttribuzione: norm.attribuzione || '',
            iiifLato: lato,
            creatoDa: username
        });

        const applica = async () => {
            appData.manoscritti.push(JSON.parse(JSON.stringify(scheda)));
            window.Store.togliTombstone([id]);
            await window.Store.commit();
        };
        const annulla = async () => {
            await window.annullaCreazione([id]);
        };

        await applica();

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(
                _iiT('undo_import_iiif', 'Import IIIF di {var0} carte').replace('{var0}', String(indici.length)),
                annulla, applica
            );
        }

        window.chiudiImportIiif();
        mostraMessaggio(
            _iiT('iiif_done', 'Manoscritto importato: {var0} carte.').replace('{var0}', String(indici.length)),
            'success',
            () => window.gestoreAnnullamento && window.gestoreAnnullamento.annullaUltimaAzione()
        );
    } catch (e) {
        console.error('[IIIF] Import fallito:', e);
        _iiMostraErrore(e.message || _iiT('iiif_err_import', "Import non riuscito."));
        btn.disabled = false;
    }
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('iiif-modal')) return;
        const html = `
    <div id="iiif-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-4xl max-h-[90vh]">
            <div class="modal-header">
                <div class="min-w-0">
                    <h3 class="modal-title" id="iiif-titolo-modale" data-i18n="iiif_title">Importa un manoscritto da un manifest IIIF</h3>
                    <p class="modal-sottotitolo" data-i18n="iiif_hint">Incolla l'indirizzo del manifest pubblicato dalla biblioteca. Le carte restano sul server e non occupano spazio: si scaricano una per una, o tutte insieme, quando servono.</p>
                </div>
                <button type="button" data-on-click="chiudiImportIiif" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="modal-body flex-1 flex flex-col gap-4">
                <form data-on-submit="leggiManifestIiif" data-args-submit="[{&quot;$&quot;:&quot;event&quot;}]" class="flex gap-2">
                    <input type="url" id="iiif-url" required class="form-input flex-1 font-mono text-xs"
                           data-i18n-aria-label="iiif_url_label" aria-label="Indirizzo del manifest"
                           data-i18n-placeholder="iiif_url_placeholder" placeholder="https://.../manifest.json">
                    <button type="submit" id="iiif-leggi" class="btn btn-secondary shrink-0" data-i18n="iiif_read">Leggi</button>
                </form>

                <div id="iiif-errore" class="hidden-tab iiif-nota is-pericolo" role="alert"></div>

                <div id="iiif-anteprima" class="hidden-tab flex flex-col gap-4">
                    <div class="iiif-testata">
                        <h4 id="iiif-titolo" class="iiif-titolo"></h4>
                        <span id="iiif-conteggio" class="modello-suggerimento shrink-0"></span>
                        <span id="iiif-diritti" class="modello-suggerimento min-w-0"></span>
                    </div>

                    <div id="iiif-avvisi" class="hidden-tab iiif-nota is-avviso"></div>

                    <div class="flex flex-wrap items-center gap-2">
                        <label class="iiif-etichetta" for="iiif-intervallo" data-i18n="iiif_range">Carte da importare</label>
                        <input type="text" id="iiif-intervallo" class="form-input iiif-intervallo font-mono text-xs" data-on-input="applicaIntervalloIiif"
                               data-i18n-placeholder="iiif_range_placeholder" placeholder="tutte — oppure 1-10, 25, 40-60">
                        <button type="button" class="btn btn-ghost" data-on-click="selezionaTutteIiif" data-args-click="[true]" data-i18n="iiif_select_all">Tutte</button>
                        <button type="button" class="btn btn-ghost" data-on-click="selezionaTutteIiif" data-args-click="[false]" data-i18n="iiif_select_none">Nessuna</button>
                        <span id="iiif-selezionate" class="modello-suggerimento ml-auto"></span>
                    </div>

                    <div id="iiif-miniature" class="iiif-miniature"></div>

                    <div class="iiif-campi">
                        <div id="iiif-campi-scheda" class="contents">
                            <div>
                                <label class="form-label" for="iiif-segnatura" data-i18n="field_segnatura">Segnatura</label>
                                <input type="text" id="iiif-segnatura" class="form-input font-mono text-xs">
                            </div>
                            <div>
                                <label class="form-label" for="iiif-tipo" data-i18n="imp_model">Modello</label>
                                <select id="iiif-tipo" class="form-input"></select>
                            </div>
                            <div>
                                <label class="form-label" for="iiif-cartella" data-i18n="imp_folder">Cartella</label>
                                <select id="iiif-cartella" class="form-input"></select>
                            </div>
                        </div>
                        <div>
                            <label class="form-label" for="iiif-lato" data-i18n="iiif_resolution">Risoluzione dei download</label>
                            <select id="iiif-lato" class="form-input">
                                <option value="1200">1200 px</option>
                                <option value="2000" selected>2000 px</option>
                                <option value="4000">4000 px</option>
                                <option value="0" data-i18n="iiif_res_max">Massima disponibile</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="chiudiImportIiif" class="btn btn-secondary" data-i18n="btn_cancel">Annulla</button>
                <button type="button" id="iiif-conferma" data-on-click="confermaImportIiif" class="btn btn-primary" disabled></button>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    });
})();
