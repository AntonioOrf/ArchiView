// --- CONTEXT MENU ---
// Le voci sono dichiarative; disegno, tastiera e posizionamento stanno in
// components/contextMenu.ts (Fase 4.3). Gli stessi array alimentano il tasto destro
// e i pulsanti overflow "⋯" di card e cartelle, così le due strade non divergono.
// Spostato da app.ts (PIANO-REFACTOR Fase 6).


// Il tasto destro (o il "⋯") su un record fuori selezione lavora su quel solo record.
window.assicuraSelezioneRecord = function(id) {
    if (!window.selectedRecords.includes(id)) {
        window.selectedRecords = [id];
        window.lastSelectedId = id;
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
        window.aggiornaStatoSelezione();
    }
};

window.vociMenuRecord = function(id) {
    const selCount = window.selectedRecords.length;
    const suffisso = selCount > 1 ? ` (${selCount})` : '';
    // ETICHETTE A UNA O DUE PAROLE. Il menu è largo al massimo 280px e le voci con una
    // scorciatoia ne lasciano ~150 al testo, che `truncate` taglia senza avvisare: con le
    // dizioni per esteso metà colonna finiva in "Sposta in un arch…", "Cambia tipo di do…",
    // "Aggiungi o rimuov…" — cioè tre voci che si distinguevano solo dall'icona.
    // Allargare il menu non è la soluzione: coprirebbe la scheda su cui si sta agendo.
    // La dizione estesa non si perde, va nel `title` della voce.
    const voci = [];
    if (selCount === 1) {
        voci.push({ label: window.t('menu_edit_short', 'Modifica'), title: window.t('menu_edit_record', 'Rinomina / Modifica'), icon: 'edit-3', shortcut: 'F2', onSelect: () => window.editItem(id) });
        voci.push({ label: window.t('btn_transcribe', 'Trascrivi'), icon: 'pen-line', onSelect: () => window.apriTrascrizione(id) });
        // Fase 2.3 — solo se la scheda ha allegati: offrire l'OCR su una scheda senza
        // immagini aprirebbe un modale capace solo di dire "non c'è niente da riconoscere",
        // cioè un comando che non fa nulla. Stesso criterio della palette nella 1.4.
        if (typeof window.apriOcrModal === 'function') {
            // Lettura NON distruttiva: `normalizzaAllegati` scriverebbe `m.allegati = []`
            // sul record, e costruire un menu non è un motivo per modificare il database
            // (è la stessa trappola evitata in `recordPassaFiltri`, Fase 1.3).
            const rec = appData.manoscritti.find(x => String(x.id) === String(id));
            const conAllegati = !!(rec && ((Array.isArray(rec.allegati) && rec.allegati.length) || rec.allegato));
            if (conAllegati) {
                voci.push({ label: window.t('menu_ocr_short', 'Riconosci testo'), title: window.t('ocr_menu_entry', 'Riconosci testo (OCR)…'), icon: 'scan-text', onSelect: () => window.apriOcrModal(id, 0) });
            }
        }

        // Le tre viste secondarie della scheda in un sottomenu: sono la stessa domanda —
        // "guarda questa scheda da un'altra angolazione" — e nessuna è un'azione che
        // modifica qualcosa, quindi nessuna merita una riga del primo livello.
        // Fase 3.5 / 4.3 — le voci ci sono SEMPRE, anche senza collegamenti o cronologia:
        // sono anche il modo di scoprire che non ce n'è, cosa che una voce condizionale
        // non distinguerebbe da "non ho guardato". Il modale lo dice a parole.
        const vociVedi = [];
        if (typeof window.apriCollegamenti === 'function') {
            vociVedi.push({ label: window.t('menu_links', 'Collegate'), title: window.t('link_panel_title', 'Schede collegate'), icon: 'link', onSelect: () => window.apriCollegamenti(id) });
        }
        // P9 — sempre presente come "Collegate": senza testimoni il messaggio dice cosa manca.
        if (typeof window.apriCollazione === 'function') {
            vociVedi.push({ label: window.t('coll_title', 'Collazione'), title: window.t('coll_title', 'Collazione'), icon: 'git-compare', onSelect: () => window.apriCollazione(id) });
        }
        if (typeof window.apriGrafo === 'function') {
            vociVedi.push({ label: window.t('menu_graph', 'Grafo'), title: window.t('graph_title', 'Grafo dei collegamenti'), icon: 'git-fork', onSelect: () => window.apriGrafo() });
        }
        if (typeof window.apriStoriaRecord === 'function') {
            vociVedi.push({ label: window.t('menu_record_history', 'Cronologia'), title: window.t('rec_history_title', 'Cronologia della scheda'), icon: 'history', onSelect: () => window.apriStoriaRecord(id) });
        }
        if (vociVedi.length > 0) {
            voci.push({ separator: true });
            voci.push({ label: window.t('menu_view_group', 'Vedi'), title: window.t('menu_view_group_title', 'Collegamenti, grafo, cronologia'), icon: 'eye', submenu: vociVedi });
        }
        voci.push({ separator: true });
    }
    voci.push({ label: window.t('menu_copy', 'Copia') + suffisso, icon: 'copy', shortcut: 'Ctrl+C', onSelect: () => window.copiaSelezionati() });
    voci.push({ label: window.t('menu_cut', 'Taglia') + suffisso, icon: 'scissors', shortcut: 'Ctrl+X', onSelect: () => window.tagliaSelezionati() });
    // Quattro modi di portare fuori le stesse schede: una famiglia sola, una riga sola.
    // Le scorciatoie restano visibili dentro il sottomenu, accanto al comando che eseguono.
    const vociEsporta: any[] = [
        { label: window.t('menu_export_zip', 'Esporta ZIP') + suffisso, title: window.t('bulk_export_zip_full', 'Esporta la selezione in ZIP'), icon: 'upload', shortcut: 'Ctrl+E', onSelect: () => window.esportaSelezionati() },
        { label: window.t('menu_export_csv', 'Esporta CSV') + suffisso, title: window.t('bulk_export_csv', 'Esporta selezione in CSV'), icon: 'table', shortcut: 'Ctrl+Maiusc+E', onSelect: () => window.esportaSelezionatiCsv('csv') }
    ];
    // Fasi 2.5/2.6. Un'unica voce per cinque formati: la scelta fra RTF e BibTeX è una
    // domanda del modale, non del menu — cinque voci qui renderebbero il menu illeggibile.
    if (typeof window.apriEsportaTesto === 'function') {
        vociEsporta.push({ label: window.t('menu_export_text', 'Esporta testo') + suffisso, title: window.t('tx_cmd_selection', 'Esporta la trascrizione o la citazione'), icon: 'file-output', onSelect: () => window.apriEsportaTesto('selezione') });
    }
    // Fase 2.2. `apriStampa('selezione')` e non la stampa immediata: il layout è una
    // scelta, e stampare venti schede nel formato sbagliato costa carta vera.
    if (typeof window.apriStampa === 'function') {
        vociEsporta.push({ label: window.t('menu_print_short', 'Stampa') + suffisso, title: window.t('print_cmd_selection', 'Stampa la selezione'), icon: 'printer', shortcut: 'Ctrl+P', onSelect: () => window.apriStampa('selezione') });
    }
    voci.push({ label: window.t('menu_export_group', 'Esporta') + suffisso, title: window.t('menu_export_group_title', 'ZIP, CSV, testo, stampa'), icon: 'share', submenu: vociEsporta });

    // Fase 1.5 — le azioni in massa vivono QUI e non in una barra: la barra della
    // selezione era stata rimossa nella 1.1 perché spingeva in basso le schede a ogni
    // click. In un gruppo a sé, perché agiscono su TUTTA la selezione mentre le voci
    // sopra ne agiscono anche su una sola.
    if (typeof window.apriAzioneMassa === 'function') {
        const vociMassa: any[] = [
            { label: window.t('menu_bulk_move', 'Sposta'), title: window.t('bulk_move_title', 'Sposta in una cartella'), icon: 'folder-input', shortcut: 'Ctrl+Maiusc+M', onSelect: () => window.apriAzioneMassa('cartella') },
            { label: window.t('menu_bulk_type', 'Cambia tipo'), title: window.t('bulk_type_title', 'Cambia tipo di documento'), icon: 'shapes', shortcut: 'Ctrl+Maiusc+T', onSelect: () => window.apriAzioneMassa('tipo') },
            { label: window.t('menu_bulk_tag', 'Modifica tag'), title: window.t('bulk_tag_title', 'Aggiungi o rimuovi tag'), icon: 'tags', shortcut: 'Ctrl+Maiusc+L', onSelect: () => window.apriAzioneMassa('tag') },
            { label: window.t('menu_bulk_replace', 'Sostituisci'), title: window.t('bulk_replace_title', 'Trova e sostituisci'), icon: 'replace', shortcut: 'Ctrl+H', onSelect: () => window.apriAzioneMassa('sostituisci') }
        ];
        if (typeof window.ocrSelezionati === 'function') {
            vociMassa.push({ label: window.t('menu_bulk_ocr', 'OCR'), title: window.t('ocr_bulk_title', 'OCR delle schede selezionate'), icon: 'scan-text', onSelect: () => window.ocrSelezionati() });
        }
        // Il conteggio passa dall'intestazione all'etichetta del GENITORE: è lì che si
        // decide se aprire il gruppo, ed è lì che deve stare il numero di schede che si
        // stanno per cambiare — l'informazione che manca proprio nel momento del rischio.
        voci.push({ separator: true });
        voci.push({
            label: selCount > 1
                ? window.t('menu_bulk_on', 'Su {var0} schede').replace('{var0}', String(selCount))
                : window.t('menu_bulk_on_one', 'Su questa scheda'),
            title: window.t('menu_bulk_group_title', 'Modifica in massa'),
            icon: 'list-checks',
            submenu: vociMassa
        });
    }

    voci.push({ separator: true });
    voci.push({ label: window.t('tooltip_delete', 'Elimina') + suffisso, icon: 'trash-2', danger: true, shortcut: 'Canc', onSelect: () => window.eliminaSelezionati() });
    // "Deseleziona" viveva solo nella barra rimossa: senza, con una selezione multipla non
    // ci sarebbe più modo esplicito di azzerarla (il click su una card la sostituisce, ma
    // non è la stessa cosa quando le schede selezionate sono su più pagine).
    if (selCount > 0) {
        voci.push({ separator: true });
        voci.push(window.voceSelezionaTutti());
        voci.push({
            label: window.t('btn_clear_selection', 'Deseleziona') + suffisso,
            icon: 'x',
            shortcut: 'Ctrl+D',
            onSelect: () => window.azzeraSelezione()
        });
    }
    return voci;
};

window.showRecordContextMenu = function(e, id) {
    window.assicuraSelezioneRecord(id);
    window.apriMenuContestuale(e, window.vociMenuRecord(id));
};

window.showFolderContextMenu = function(e) {
    // Mostra solo se clicchiamo nello sfondo del view-list
    if (e.target.closest('.card-scheda')) return;

    // Fase 1.5: "Seleziona tutti i risultati" ha bisogno di un punto di partenza che NON
    // sia una scheda — cliccare su una la seleziona da sola — e lo sfondo della lista è
    // l'unico posto in cui non c'è nulla di selezionato su cui il comando possa confondersi.
    const voci: any[] = [window.voceSelezionaTutti()];
    const voceIncolla = window.voceMenuIncolla(null);
    if (voceIncolla) voci.push({ separator: true }, voceIncolla);
    window.apriMenuContestuale(e, voci);
};

/**
 * Voce condivisa fra il menu di una scheda e quello dello sfondo: la selezione totale è
 * il presupposto di ogni azione in massa e deve raggiungersi da entrambi, senza che le
 * due strade possano divergere sull'etichetta o sul conteggio.
 */
window.voceSelezionaTutti = function() {
    const totale = typeof window.getManoscrittiFiltrati === 'function' ? window.getManoscrittiFiltrati().length : 0;
    return {
        label: window.t('menu_select_all_short', 'Seleziona tutto') + (totale > 0 ? ` (${totale})` : ''),
        title: window.t('menu_select_all', 'Seleziona tutti i risultati'),
        icon: 'check-square',
        shortcut: 'Ctrl+A',
        disabled: totale === 0,
        onSelect: () => window.selezionaTuttiIRisultati()
    };
};

// Voce "Incolla" condivisa fra sfondo lista e cartelle: null se non c'è nulla negli appunti.
window.voceMenuIncolla = function(folderPath) {
    const countRecord = (window.copiedRecordIds && window.copiedRecordIds.length) || (window.cutRecordIds && window.cutRecordIds.length) || 0;
    const hasFolderAction = !!(window.cutFolderPath || window.copiedFolderPath);
    if (countRecord === 0 && !hasFolderAction) return null;
    const isMoving = !!((window.cutRecordIds && window.cutRecordIds.length > 0) || window.cutFolderPath);
    // null = sfondo della lista ⇒ "incolla nella cartella corrente". '' e 'ROOT' sono
    // entrambi la radice virtuale, ed è una destinazione esplicita come le altre.
    const destinazione = folderPath === null || folderPath === undefined
        ? undefined
        : (folderPath === 'ROOT' ? '' : folderPath);
    const label = countRecord > 0
        ? (destinazione !== undefined
            ? window.t('menu_paste_here', 'Incolla qui') + ` (${countRecord})`
            : window.t('menu_paste', 'Incolla') + ` (${countRecord})`)
        : window.t('menu_paste_folder_here', 'Incolla cartella qui');
    return {
        label,
        icon: 'clipboard-paste',
        accent: !isMoving,
        accentWarn: isMoving,
        onSelect: () => window.incollaRecord(destinazione)
    };
};

window.vociMenuCartella = function(folderPath) {
    // La radice virtuale ('') non è una cartella vera: si può creare dentro e incollare,
    // ma non rinominare/copiare/eliminare. 'ROOT' = click a vuoto nell'area della sidebar,
    // che è la stessa cosa della radice: senza una riga dedicata nell'albero, quel menu è
    // l'unico posto da cui nasce la prima cartella di un archivio vuoto.
    const isRadice = folderPath === '' || folderPath === 'ROOT';
    const percorsoCreazione = isRadice ? '' : folderPath;
    const voci = [];

    voci.push({ label: window.t('menu_new_record_short', 'Nuova scheda'), title: window.t('menu_new_record_here', 'Crea nuova scheda'), icon: 'file-plus', onSelect: () => window.creaSchedaContext(percorsoCreazione) });
    voci.push({ label: window.t('menu_new_folder_short', 'Nuova cartella'), title: window.t('menu_new_folder_here', 'Crea nuova cartella'), icon: 'folder-plus', onSelect: () => window.mostraAggiungiCartellaContext(percorsoCreazione) });

    if (!isRadice) {
        voci.push({ separator: true });
        voci.push({ label: window.t('menu_rename_short', 'Rinomina'), title: window.t('menu_rename_folder', 'Rinomina cartella'), icon: 'edit-2', onSelect: () => window.rinominaCartellaDaSidebar(folderPath) });
        // Alternativa al drag nell'albero (WCAG 2.5.7): spostare una cartella non richiede trascinare.
        voci.push({ label: window.t('menu_move_short', 'Sposta in…'), title: window.t('menu_move_folder', "Sposta la cartella in un'altra"), icon: 'folder-input', onSelect: () => window.apriSpostaCartella(folderPath) });

        const vociEsporta: any[] = [
            { label: window.t('menu_export_zip', 'Esporta ZIP'), title: window.t('tooltip_export_folder', 'Esporta cartella'), icon: 'upload', onSelect: () => window.esportaSpecificaCartella(folderPath) },
            { label: window.t('menu_export_csv', 'Esporta CSV'), title: window.t('menu_export_folder_csv', 'Esporta cartella in CSV'), icon: 'table', onSelect: () => window.esportaCartellaCsvSpecifica(folderPath, 'csv') }
        ];
        // Come la stampa qui sotto: si NAVIGA prima nella cartella, perché l'ambito del
        // modale si calcola sulla cartella corrente e un export che dice "Archivio
        // corrente" mentre ne esporta un altro sarebbe una trappola silenziosa (2.2).
        if (typeof window.apriEsportaTesto === 'function') {
            vociEsporta.push({ label: window.t('menu_export_text', 'Esporta testo'), title: window.t('menu_export_text_folder', 'Esporta il testo della cartella'), icon: 'file-output', onSelect: () => {
                window.vaiACartella(folderPath);
                window.apriEsportaTesto('cartella');
            } });
        }
        // Fase 2.2 — la stampa di una cartella parte SEMPRE navigandoci dentro: gli ambiti
        // del modale si calcolano sulla cartella corrente, e una stampa che dice "Archivio
        // corrente" mentre ne stampa un altro sarebbe una trappola silenziosa.
        if (typeof window.apriStampa === 'function') {
            vociEsporta.push({ label: window.t('menu_print_short', 'Stampa'), title: window.t('menu_print_folder', 'Stampa cartella'), icon: 'printer', onSelect: () => {
                window.vaiACartella(folderPath);
                window.apriStampa('cartella');
            } });
        }
        voci.push({ label: window.t('menu_export_group', 'Esporta'), title: window.t('menu_export_group_title', 'ZIP, CSV, testo, stampa'), icon: 'share', submenu: vociEsporta });

        voci.push({ label: window.t('menu_explorer_short', 'Esplora risorse'), title: window.t('menu_open_in_explorer', 'Apri in Esplora Risorse'), icon: 'folder-open', onSelect: () => window.apriCartellaInEsploraRisorse(folderPath) });
        voci.push({ separator: true });
        voci.push({ label: window.t('menu_copy', 'Copia'), title: window.t('menu_copy_folder', 'Copia cartella'), icon: 'copy', onSelect: () => window.copiaCartella(folderPath) });
        voci.push({ label: window.t('menu_cut', 'Taglia'), title: window.t('menu_cut_folder', 'Taglia cartella'), icon: 'scissors', onSelect: () => window.tagliaCartella(folderPath) });
        voci.push({ label: window.t('menu_delete_folder', 'Elimina cartella'), icon: 'trash-2', danger: true, onSelect: () => window.eliminaCartellaDaSidebar(folderPath) });
    }

    const voceIncolla = window.voceMenuIncolla(folderPath);
    if (voceIncolla) {
        if (voci.length > 0) voci.push({ separator: true });
        voci.push(voceIncolla);
    }
    return voci;
};

window.showSidebarFolderContextMenu = function(e, folderPath) {
    e.preventDefault();
    e.stopPropagation();
    const voci = window.vociMenuCartella(folderPath);
    if (voci.length === 0) {
        // ROOT senza appunti: niente da mostrare, ma il menu del sistema resta soppresso
        return;
    }
    window.apriMenuContestuale(e, voci);
};


window.apriCartellaInEsploraRisorse = async function(folderPath) {
    if (window.apiBrowser && window.apiBrowser.apriCartellaWorkspace) {
        const success = await window.apiBrowser.apriCartellaWorkspace();
        if (!success) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_impossibile_aprire_la_car", "Impossibile aprire la cartella in Esplora Risorse."), "error");
        }
    }
};

// Nota: nessuna chiamata a selectItem qui — passava un percorso di cartella come id di
// record, sporcando window.selectedRecords. L'evidenziazione della cartella nell'albero
// dipende già da window.cartellaAttuale.
window.creaSchedaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof switchTab === 'function') switchTab('add');
};

window.mostraAggiungiCartellaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof aggiungiCartella === 'function') aggiungiCartella();
};
