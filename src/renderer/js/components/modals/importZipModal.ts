(function() {
    let stato: 'corso' | 'ok' | 'ko' = 'corso';
    let primaScheda: string | null = null;

    const el = (id: string) => document.getElementById(id);

    function crea() {
        if (el('import-zip-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `
    <div id="import-zip-modal" class="modal-overlay hidden-tab z-modal-alert">
        <div class="modal-window iz-finestra">
            <div class="modal-header">
                <div class="min-w-0">
                    <h2 id="iz-titolo" class="modal-title"></h2>
                    <p id="iz-nome" class="modal-sottotitolo iz-nome" data-iz-stato="corso"></p>
                    <p id="iz-riepilogo" class="modal-sottotitolo" data-iz-stato="ok"></p>
                    <p id="iz-causa" class="modal-sottotitolo" data-iz-stato="ko" role="alert"></p>
                </div>
            </div>
            <div class="modal-body iz-corpo">
                <div class="iz-blocco" data-iz-stato="corso">
                    <div class="iz-conteggio"><span id="iz-file"></span><span id="iz-percento"></span></div>
                    <div id="iz-barra" class="iz-traccia" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-i18n-aria-label="import_zip_barra" aria-label="Avanzamento dell'importazione">
                        <div id="iz-riempimento" class="iz-riempimento"></div>
                    </div>
                </div>
                <p class="modello-suggerimento" data-iz-stato="corso" data-i18n="import_zip_nota">Non chiudere ArchiView finché l'importazione non è finita. I file già presenti vengono saltati.</p>
                <div class="iz-tessere" data-iz-stato="ok">
                    <div class="iz-tessera"><span id="iz-copiati" class="iz-numero"></span><span data-i18n="import_zip_copiati">allegati copiati</span></div>
                    <div class="iz-tessera"><span id="iz-saltati" class="iz-numero"></span><span data-i18n="import_zip_saltati">già presenti, saltati</span></div>
                </div>
                <p class="iz-nota" data-iz-stato="ko" data-i18n="import_zip_ko_stato">Nessuna scheda è stata aggiunta. Gli allegati già estratti restano nella cartella e al prossimo tentativo vengono saltati.</p>
                <details class="iz-dettagli" data-iz-stato="ko">
                    <summary data-i18n="import_zip_dettagli">Dettagli tecnici</summary>
                    <code id="iz-dettaglio"></code>
                </details>
            </div>
            <div class="modal-footer modal-footer-bar" data-iz-stato="ok ko">
                <button type="button" class="btn btn-secondary" data-on-click="chiudiImportZip"><span data-i18n="btn_close">Chiudi</span></button>
                <button type="button" class="btn btn-primary" data-iz-stato="ok" data-on-click="mostraSchedeImportate"><span data-i18n="import_zip_mostra">Mostra le schede</span></button>
                <button type="button" class="btn btn-primary" data-iz-stato="ko" data-on-click="riprovaImportZip"><span data-i18n="import_zip_riprova">Riprova</span></button>
            </div>
        </div>
    </div>`);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    }

    function mostra(nuovo: 'corso' | 'ok' | 'ko', titolo: string) {
        crea();
        stato = nuovo;
        const modale = el('import-zip-modal')!;
        modale.querySelectorAll('[data-iz-stato]').forEach((n: Element) => {
            (n as HTMLElement).hidden = !(n.getAttribute('data-iz-stato') || '').split(' ').includes(nuovo);
        });
        el('iz-titolo')!.textContent = titolo;
        modale.classList.remove('hidden-tab');
    }

    window.importZipAvanzamento = function(p: { nome?: string; fatte: number; totale: number }) {
        const modale = el('import-zip-modal');
        if (stato !== 'corso' || !modale || modale.classList.contains('hidden-tab')) {
            mostra('corso', window.t('import_zip_progress_title', 'Importazione in corso'));
            if (window.annunciaA11y) window.annunciaA11y(window.t('import_zip_progress_title', 'Importazione in corso'));
        }
        const totale = Math.max(1, p.totale || 0);
        const percento = Math.min(100, Math.round((p.fatte / totale) * 100));
        el('iz-nome')!.textContent = p.nome || '';
        el('iz-file')!.textContent = window.t('import_zip_progress', 'File {var0} di {var1}…')
            .replace('{var0}', String(p.fatte)).replace('{var1}', String(p.totale));
        el('iz-percento')!.textContent = percento + '%';
        el('iz-riempimento')!.style.transform = `scaleX(${percento / 100})`;
        el('iz-barra')!.setAttribute('aria-valuenow', String(percento));
    };

    window.importZipRiuscito = function(e: { schede: number; cartelle: number; copiati: number; saltati: number; primaScheda: string | null }) {
        primaScheda = e.primaScheda;
        const titolo = window.t('import_zip_ok_titolo', 'Importazione completata');
        mostra('ok', titolo);
        const schede = e.schede === 1
            ? window.t('import_zip_ok_una', 'Una scheda aggiunta all\'archivio')
            : window.t('import_zip_ok', '{var0} schede aggiunte all\'archivio').replace('{var0}', String(e.schede));
        const cartelle = e.cartelle === 0 ? '.'
            : e.cartelle === 1 ? window.t('import_zip_in_una_cartella', ', in una cartella.')
            : window.t('import_zip_in_cartelle', ', in {var0} cartelle.').replace('{var0}', String(e.cartelle));
        const riepilogo = schede + cartelle;
        el('iz-riepilogo')!.textContent = riepilogo;
        el('iz-copiati')!.textContent = String(e.copiati);
        el('iz-saltati')!.textContent = String(e.saltati);
        (el('import-zip-modal')!.querySelector('[data-iz-stato="ok"].btn') as HTMLElement).hidden = !primaScheda;
        if (window.annunciaA11y) window.annunciaA11y(titolo + ' — ' + riepilogo);
    };

    window.importZipFallito = function(e: { codice?: string; dettaglio?: string }) {
        mostra('ko', window.t('import_zip_ko_titolo', 'Importazione non riuscita'));
        const cause: Record<string, [string, string]> = {
            spazio: ['import_zip_causa_spazio', 'Spazio su disco insufficiente per estrarre gli allegati.'],
            permessi: ['import_zip_causa_permessi', 'ArchiView non può scrivere nella cartella degli allegati: è protetta o in uso da un altro programma.'],
            zip_non_valido: ['import_zip_causa_zip', 'Il file ZIP è danneggiato o non è uno ZIP valido.'],
            non_archiview: ['import_zip_causa_formato', 'Lo ZIP non contiene un\'esportazione di ArchiView.'],
            altro: ['import_zip_causa_altro', 'Errore imprevisto durante l\'estrazione.'],
        };
        const [chiave, ripiego] = cause[e.codice || ''] || cause.altro;
        el('iz-causa')!.textContent = window.t(chiave, ripiego);
        el('iz-dettaglio')!.textContent = e.dettaglio || '';
        (el('import-zip-modal')!.querySelector('.iz-dettagli') as HTMLElement).hidden = !e.dettaglio;
    };

    window.chiudiImportZip = function() {
        if (stato === 'corso') return;
        el('import-zip-modal')?.classList.add('hidden-tab');
    };

    window.mostraSchedeImportate = function() {
        window.chiudiImportZip();
        if (primaScheda && window.rivelaRecordNellaGriglia) window.rivelaRecordNellaGriglia(primaScheda);
    };

    window.riprovaImportZip = function() {
        window.chiudiImportZip();
        if (window.importaManoscritto) window.importaManoscritto();
    };
})();
