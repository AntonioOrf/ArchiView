// P9 — collazione tra testimoni: le trascrizioni di schede collegate, parola per parola.
//
// Il calcolo sta in shared/collazione.ts; qui solo testo dei testimoni e DOM. Si apre dal
// pannello "Schede collegate": i testimoni sono la scheda e le sue collegate (nei due versi).
// Una colonna per testimone con i luoghi varianti segnati e numerati, e sotto l'apparato
// rispetto al testimone base.
(function() {
    let _clIds = [];

    function _clEl(id) { return document.getElementById(id); }
    function _clScheda(id) { return (appData.manoscritti || []).find(m => String(m.id) === String(id)); }
    function _clSigla(m) { return (m && m.segnatura) || window.t('no_signature', 'Senza segnatura'); }

    /** Testo piano della scheda: le carte in ordine, o la trascrizione della scheda se non ne ha. */
    function _clTesto(m) {
        const allegati = Array.isArray(m && m.allegati) ? m.allegati : [];
        const pezzi = allegati.some(a => a && typeof a.trascrizione === 'string')
            ? allegati.map(a => (a && a.trascrizione) || '')
            : [(m && m.trascrizione) || ''];
        const tpl = document.createElement('template');
        // Uno spazio dopo ogni fine di blocco: textContent incollerebbe l'ultima parola di un
        // paragrafo alla prima del successivo.
        tpl.innerHTML = window.sanitizeHTML(pezzi.join('\n').replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '$& '));
        return (tpl.content.textContent || '').replace(/\[p\. \d+\]/g, ' ');
    }

    window.apriCollazione = function(id) {
        const risolte = window.relazioniRisolte(id);
        const ids = [String(id)];
        for (const r of [...risolte.uscenti, ...risolte.entranti]) {
            if (!ids.includes(String(r.scheda.id))) ids.push(String(r.scheda.id));
        }
        _clIds = ids.filter(x => window.trascrizioneHaTesto(_clTesto(_clScheda(x))));
        if (_clIds.length < 2) {
            mostraMessaggio(window.t('coll_need_two', 'Servono almeno due schede collegate con una trascrizione.'), 'info');
            return;
        }
        const base = _clEl('coll-base') as HTMLSelectElement;
        base.replaceChildren();
        const scelta = _clEl('coll-testimoni');
        scelta.replaceChildren();
        for (const x of _clIds) {
            const opt = document.createElement('option');
            opt.value = x;
            opt.textContent = _clSigla(_clScheda(x));
            base.appendChild(opt);
            const label = document.createElement('label');
            label.className = 'collazione-testimone';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.value = x;
            box.checked = true;
            box.addEventListener('change', () => window.ricalcolaCollazione());
            const nome = document.createElement('span');
            nome.textContent = opt.textContent;
            nome.translate = false;
            label.append(box, nome);
            scelta.appendChild(label);
        }
        _clEl('collazione-modal').classList.remove('hidden-tab');
        window.ricalcolaCollazione();
        base.focus();
    };

    window.chiudiCollazione = function() {
        _clEl('collazione-modal')?.classList.add('hidden-tab');
        _clEl('coll-testi')?.replaceChildren();
        _clEl('coll-apparato')?.replaceChildren();
    };

    /** Parole come span (le varianti marcate) e il numero della voce dopo il luogo variante. */
    function _clColonna(titolo, parole, luoghi) {
        const col = document.createElement('section');
        col.className = 'collazione-colonna';
        const h = document.createElement('h4');
        h.className = 'collazione-sigla';
        h.textContent = titolo;
        h.translate = false;
        const testo = document.createElement('p');
        testo.className = 'collazione-testo';
        testo.translate = false;
        const variante = new Uint8Array(parole.length);
        const numeri = new Map();
        for (const l of luoghi) {
            variante.fill(1, l.da, l.a);
            if (!numeri.has(l.a)) numeri.set(l.a, []);
            numeri.get(l.a).push(l.n);
        }
        const nota = (p) => {
            for (const n of numeri.get(p) || []) {
                const sup = document.createElement('sup');
                sup.className = 'collazione-n';
                sup.textContent = String(n);
                testo.appendChild(sup);
            }
        };
        for (let i = 0; i < parole.length; i++) {
            nota(i);
            if (i) testo.appendChild(document.createTextNode(' '));
            const s = document.createElement('span');
            s.textContent = parole[i].testo;
            if (variante[i]) s.className = 'collazione-var';
            testo.appendChild(s);
        }
        nota(parole.length);
        col.append(h, testo);
        return col;
    }

    window.ricalcolaCollazione = function() {
        const baseId = (_clEl('coll-base') as HTMLSelectElement).value;
        const scelti = Array.from(_clEl('coll-testimoni').querySelectorAll<HTMLInputElement>('input:checked'))
            .map(b => b.value).filter(x => x !== baseId);
        const chiave = (_clEl('coll-grafiche') as HTMLInputElement).checked ? window.normalizzaTesto : undefined;
        const app = window.Collazione.apparato(
            _clTesto(_clScheda(baseId)),
            scelti.map(x => ({ sigla: x, testo: _clTesto(_clScheda(x)) })),
            chiave
        );

        const testi = _clEl('coll-testi');
        testi.replaceChildren(_clColonna(_clSigla(_clScheda(baseId)), app.base, app.voci.map((v, i) => ({ da: v.da, a: v.a, n: i + 1 }))));
        for (const x of scelti) {
            if (app.troppoDiversi.includes(x)) continue;
            const luoghi = [];
            app.voci.forEach((v, i) => {
                for (const l of v.lezioni) if (l.sigla === x) luoghi.push({ da: l.da, a: l.a, n: i + 1 });
            });
            testi.appendChild(_clColonna(_clSigla(_clScheda(x)), app.parole[x], luoghi));
        }

        const apparato = _clEl('coll-apparato');
        apparato.replaceChildren();
        const om = window.t('coll_om', 'om.');
        for (const v of app.voci) {
            const li = document.createElement('li');
            // Le lezioni uguali si raggruppano: "fuit B C", non "fuit B; fuit C".
            const gruppi = new Map();
            for (const l of v.lezioni) {
                if (!gruppi.has(l.testo)) gruppi.set(l.testo, []);
                gruppi.get(l.testo).push(_clSigla(_clScheda(l.sigla)));
            }
            const lemma = v.lemma || window.t('coll_add', 'add.');
            const lezioni = Array.from(gruppi, ([testo, sigle]) => (testo || om) + ' ' + sigle.join(', ')).join('; ');
            li.textContent = lemma + ' ] ' + lezioni;
            li.translate = false;
            apparato.appendChild(li);
        }
        const esito = [];
        esito.push(app.voci.length
            ? window.t('coll_count', '{var0} luoghi varianti.').replace('{var0}', String(app.voci.length))
            : window.t('coll_none', 'Nessuna variante.'));
        if (app.troppoDiversi.length) {
            esito.push(window.t('coll_too_different', 'Testi troppo diversi per allinearli: {var0}.')
                .replace('{var0}', app.troppoDiversi.map(x => _clSigla(_clScheda(x))).join(', ')));
        }
        _clEl('coll-esito').textContent = esito.join(' ');
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (_clEl('collazione-modal')) return;
        const html = `
    <div id="collazione-modal" class="modal-overlay hidden-tab">
        <div class="modal-window collazione-finestra">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="git-compare" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="coll_title">Collazione</span>
                </h3>
                <label class="ml-auto flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" id="coll-grafiche" checked data-on-change="ricalcolaCollazione">
                    <span data-i18n="coll_ignore_graphic">Ignora le varianti grafiche</span>
                </label>
                <button type="button" data-on-click="chiudiCollazione" data-modal-cancel class="btn btn-ghost btn-icon" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body collazione-corpo">
                <div class="collazione-scelta">
                    <label class="flex items-center gap-2 text-xs">
                        <span data-i18n="coll_base">Testimone base</span>
                        <select id="coll-base" class="form-input py-1 text-sm" data-on-change="ricalcolaCollazione"></select>
                    </label>
                    <fieldset class="text-xs">
                        <legend class="sr-only" data-i18n="coll_witnesses">Testimoni</legend>
                        <div id="coll-testimoni" class="flex flex-wrap gap-3"></div>
                    </fieldset>
                    <p id="coll-esito" class="text-xs text-stone-500 dark:text-stone-400 ml-auto" aria-live="polite"></p>
                </div>
                <div id="coll-testi" class="collazione-testi"></div>
                <h4 class="collazione-sigla" data-i18n="coll_apparatus">Apparato</h4>
                <ol id="coll-apparato" class="collazione-apparato"></ol>
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [_clEl('collazione-modal')] });
    });
})();
