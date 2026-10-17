(function() {
    const TIPO_STACCATA = new URLSearchParams(location.search).get('finestra');
    let _staccata: any = null;
    let _zona: any = null;

    const pref = (k, v?) => window.prefLocale(k, v);
    const clona = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    const trova = (id) => appData.manoscritti.find(x => String(x.id) === String(id));

    window.schedaStaccata = () => _staccata === 'scheda';
    window.documentoStaccato = () => _staccata === 'documento';

    window.datiFinestraStaccata = function(id, extra?) {
        const db = { ...appData, baseObjects: {}, baseHashes: {} };
        return { db: clona(db), id, percorso: window.percorsoWorkspace || '', ...(extra || {}) };
    };

    function posizione(tipo) {
        try { return JSON.parse(pref('finestraStaccata:posizione:' + tipo) || 'null'); } catch (e) { return null; }
    }

    async function stacca(tipo, dati) {
        _staccata = tipo;
        pref('finestraStaccata:' + tipo, '1');
        let ok = false;
        try {
            ok = await window.apiFinestre.stacca(tipo, dati, posizione(tipo));
        } catch (err) {
            console.error('[Finestra staccata] Apertura non riuscita:', err);
        }
        if (!ok) {
            _staccata = null;
            pref('finestraStaccata:' + tipo, '0');
            mostraMessaggio(window.t('detach_error', 'Non è stato possibile aprire la finestra.'), 'error');
        }
        return ok;
    }

    window.staccaScheda = async function() {
        if (!window.apiFinestre || window.finestraSatellite) return;
        const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
        if (!(await window.lasciaSchedaTrascrizione())) return;
        _staccata = 'scheda';
        await window.mostraSchedaTrascrizione('scheda');
        if (!(await stacca('scheda', window.datiFinestraStaccata(id)))) await window.mostraSchedaTrascrizione('scheda');
    };

    window.staccaDocumento = async function() {
        if (!window.apiFinestre || window.finestraSatellite) return;
        const doc = window.statoDocumentoScheda();
        if (!doc.id) return;
        window.chiudiDocumentoScheda();
        if (!(await stacca('documento', window.datiFinestraStaccata(doc.id, doc)))) window.aggiornaDocumentoScheda();
    };

    window.riportaSchedaQui = function() {
        if (_staccata) window.apiFinestre.messaggio('riaggancia');
    };

    window.chiudiFinestraStaccata = function(tipo) {
        if (_staccata !== tipo) return;
        _staccata = null;
        window.apiFinestre.messaggio('chiudi');
    };

    window.svuotaFinestraStaccata = async function() {
        if (_staccata) await window.apiFinestre.messaggio('svuota');
    };

    async function salvaDallaStaccata({ id, patch, allegatiPrima }) {
        const vivo = trova(id);
        if (!vivo) throw new Error('scheda non trovata');
        if (String((document.getElementById('trascrizione-id') as HTMLInputElement)?.value) === String(id) && window.salvaEditorTrascrizioneInMemoria) {
            window.salvaEditorTrascrizioneInMemoria();
        }
        if (Array.isArray(patch.allegati) && Array.isArray(allegatiPrima)) {
            patch.allegati = window.Model.fondiAllegati(allegatiPrima, patch.allegati, vivo.allegati || []).allegati;
        }
        await window.Store.updateManoscritto(id, patch);
        const salvato = trova(id);
        if (!salvato) throw new Error('scheda non trovata');
        if (window.ricomponiTrascrizioneFusa) window.ricomponiTrascrizioneFusa(salvato);
        await window.Store.commit();
        if (window.renderBarraCarte) window.renderBarraCarte(salvato.id);
        return clona(salvato);
    }

    async function archivioDallaStaccata({ op, args }) {
        if (op === 'vocabolario') window.Model.aggiungiValoreVocabolario(appData, args[0], args[1]);
        else if (op === 'tag') window.Model.registraTag(appData, args[0]);
        else if (op === 'campoModello') {
            const [tipoId, def] = args;
            const tipo = appData.tipiDocumento.find(t => String(t.id) === String(tipoId));
            if (!tipo || !def || (tipo.campi || []).indexOf(def.id) !== -1) return false;
            window.Model.impostaCampi(tipo, window.Model.campiDelTipo(tipo, window.CONFIG_CAMPI, appData).concat([def]));
        } else throw new Error('operazione sconosciuta: ' + op);
        await window.Store.commit();
        if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();
        return true;
    }

    function zona(tipo) {
        let r: any = null;
        if (tipo === 'scheda' && !(document.getElementById('view-trascrizione') as HTMLInputElement).classList.contains('hidden-tab')) {
            r = (document.getElementById('trascrizione-editor-panel') as HTMLInputElement).getBoundingClientRect();
        } else if (tipo === 'documento' && !(document.getElementById('view-add') as HTMLInputElement).classList.contains('hidden-tab')) {
            const m = (document.querySelector('main') as HTMLElement).getBoundingClientRect();
            r = { left: m.left + m.width / 2, top: m.top, width: m.width / 2, height: m.height };
        }
        _zona = r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
        return _zona;
    }

    function mostraZona(attiva) {
        let velo = document.getElementById('zona-riaggancio');
        if (!attiva || !_zona) {
            velo?.classList.add('hidden-tab');
            return;
        }
        if (!velo) {
            velo = document.createElement('div');
            velo.id = 'zona-riaggancio';
            velo.className = 'zona-riaggancio';
            velo.setAttribute('role', 'status');
            const testo = document.createElement('span');
            testo.textContent = window.t('detach_drop', 'Rilascia per riagganciare');
            velo.appendChild(testo);
            document.body.appendChild(velo);
        }
        Object.assign(velo.style, { left: `${_zona.x}px`, top: `${_zona.y}px`, width: `${_zona.width}px`, height: `${_zona.height}px` });
        velo.classList.remove('hidden-tab');
    }

    function avviaPrincipale() {
        const api = window.apiFinestre;
        api.onRichiesta(async (id, metodo, args) => {
            try {
                let valore: any = null;
                if (metodo === 'salva') valore = await salvaDallaStaccata(args);
                else if (metodo === 'archivio') valore = await archivioDallaStaccata(args);
                else if (metodo === 'record') valore = clona(trova(args));
                else if (metodo === 'zona') valore = zona(args);
                else throw new Error('richiesta sconosciuta: ' + metodo);
                api.rispondi(id, { valore });
            } catch (err) {
                console.error('[Finestra staccata] Richiesta non riuscita:', metodo, err);
                api.rispondi(id, { errore: String(err && err.message || err) });
            }
        });
        api.onZona(mostraZona);
        api.onPosizione((tipo, b) => { if (tipo && b) pref('finestraStaccata:posizione:' + tipo, JSON.stringify(b)); });
        api.onChiusa(async (tipo) => {
            mostraZona(false);
            if (_staccata === tipo) _staccata = null;
            pref('finestraStaccata:' + tipo, '0');
            if (tipo === 'scheda' && !(document.getElementById('view-trascrizione') as HTMLInputElement).classList.contains('hidden-tab')) {
                const trascrizioneId = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
                if (trascrizioneId) await window.mostraSchedaTrascrizione('scheda');
            } else if (tipo === 'documento' && !(document.getElementById('view-add') as HTMLInputElement).classList.contains('hidden-tab')) {
                window.aggiornaDocumentoScheda();
            }
        });
    }

    async function svuotaStaccata() {
        if (TIPO_STACCATA !== 'scheda') return true;
        return window.salvaSchedaTrascrizioneOra();
    }

    async function caricaStaccata(dati) {
        if (!dati) return;
        window.appData = dati.db;
        window.percorsoWorkspace = dati.percorso || '';
        const m = trova(dati.id);
        const nome = (m && (m.segnatura || m.titolo)) || '';
        if (TIPO_STACCATA === 'scheda') {
            document.title = window.t('detach_title_record', 'Scheda — {var0}').replace('{var0}', nome) + ' · ArchiView';
            (document.getElementById('trasc-staccata-titolo') as HTMLInputElement).textContent = nome;
            (document.getElementById('view-trascrizione') as HTMLInputElement).classList.remove('hidden-tab');
            await window.caricaSchedaStaccata(dati.id);
        } else {
            document.title = window.t('detach_title_document', 'Documento — {var0}').replace('{var0}', nome) + ' · ArchiView';
            await window.mostraDocumentoStaccato(dati);
        }
    }

    async function avviaStaccata() {
        const api = window.apiFinestre;
        window.finestraSatellite = TIPO_STACCATA;
        document.documentElement.classList.add('finestra-staccata', 'finestra-staccata-' + TIPO_STACCATA);
        const sotto = TIPO_STACCATA === 'scheda'
            ? 'body > header, body > div.flex-1'
            : 'body > header, #sidebar, #contenuto-principale > :not(#doc-scheda)';
        document.querySelectorAll(sotto).forEach(n => n.setAttribute('inert', ''));
        if (window.initTheme) await window.initTheme();
        if (window.initPreferenzeTesto) await window.initPreferenzeTesto();
        if (window.initLang) await window.initLang();

        window.gestoreAnnullamento = null;
        window.salvaTutto = async () => {};
        window.salvaTuttoDifferito = () => {};
        window.Store.commit = async () => {};
        window.Store.addManoscritto = async () => { throw new Error('la finestra staccata non crea schede'); };
        window.Store.updateManoscritto = async (id, patch) => {
            const i = appData.manoscritti.findIndex(x => String(x.id) === String(id));
            const prima = i >= 0 ? appData.manoscritti[i].allegati : null;
            const salvato = await api.richiesta('salva', { id, patch, allegatiPrima: clona(prima) || null });
            if (i >= 0 && salvato) appData.manoscritti[i] = salvato;
        };
        const inoltra = (op, args) => api.richiesta('archivio', { op, args })
            .catch(err => console.error('[Finestra staccata] Operazione d\'archivio non inoltrata:', op, err));
        const aggiungiValore = window.aggiungiValoreVocabolario;
        window.aggiungiValoreVocabolario = async (id, valore) => {
            const ok = await aggiungiValore(id, valore);
            if (ok) await inoltra('vocabolario', [id, valore]);
            return ok;
        };
        const registraTag = window.registraTagUsati;
        window.registraTagUsati = (tags) => {
            inoltra('tag', [tags]);
            return registraTag(tags);
        };
        const promuovi = window.promuoviCampoProprio;
        window.promuoviCampoProprio = async (id) => {
            const def = clona(campiPropriForm().find(d => d.id === id));
            const tipo = _tipoDelForm();
            await promuovi(id);
            if (def && tipo && (tipo.campi || []).indexOf(id) !== -1) await inoltra('campoModello', [tipo.id, def]);
        };
        window.collegaEventiModulo();

        api.onCarica(async (dati) => {
            await svuotaStaccata();
            await caricaStaccata(dati);
        });
        api.onSvuota(async (id) => {
            let ok = false;
            try { ok = await svuotaStaccata(); } catch (err) { console.error('[Finestra staccata] Salvataggio non riuscito:', err); }
            api.rispondi(id, { valore: ok });
        });
        api.onChiudiRichiesta(async () => {
            if (await svuotaStaccata()) {
                api.riaggancia();
                return;
            }
            window.mostraBottomConfirm(window.t('unsaved_prompt', 'Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?'), () => api.riaggancia());
        });

        const iniziali = await api.dati();
        await caricaStaccata(iniziali && iniziali.dati);
        if (window.lucide) lucide.createIcons();
    }

    window.riagganciaFinestra = async function() {
        if (!window.finestraSatellite) return;
        if (await svuotaStaccata()) window.apiFinestre.riaggancia();
    };

    window.avviaFinestraStaccata = function() {
        return TIPO_STACCATA === 'scheda' || TIPO_STACCATA === 'documento' ? avviaStaccata().then(() => true) : Promise.resolve(false);
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.apiFinestre) {
            document.documentElement.classList.add('senza-finestre');
            return;
        }
        if (!TIPO_STACCATA) avviaPrincipale();
    });
})();
