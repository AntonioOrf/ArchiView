function apriHistoryContextMenu(e, fileId, rev, dataStr, oraStr, autore, isCurrent) {
    e.stopPropagation();
    const label = `${dataStr} ${oraStr} – ${autore}`;
    window.apriMenuContestuale(e, [
        { heading: true, label: `${dataStr} ${oraStr} · ${autore}` },
        { label: window.t("history_compare_now", "Confronta con l'attuale"), icon: 'git-compare',
          onSelect: () => apriDiffRevisioneCloud(fileId, rev.id, label) },
        !isCurrent && { separator: true },
        !isCurrent && { label: window.t("history_restore_version", "Ripristina questa versione"), icon: 'rotate-ccw', danger: true,
          onSelect: () => ripristinaRevisioneConConferma(fileId, rev.id, label) }
    ]);
}

window.renderHistoryList = async function() {
    const list = document.getElementById('history-list');
    if (!list) return;
    await renderCronologiaCloud(list);
    await window.renderSnapshotLocali(list);
};

async function renderCronologiaCloud(list) {
    if (window.hubConfig) return renderHubHistoryList(list);

    if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
        list.innerHTML = `
            <li class="p-6 text-center flex flex-col items-center gap-3">
                <i data-lucide="cloud-off" class="w-8 h-8 text-stone-300"></i>
                <span class="text-xs text-stone-400 italic">${window.t("history_not_connected", "Connect to Google Drive to see the history.")}</span>
            </li>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = `
        <li class="p-6 text-center flex flex-col items-center gap-3">
            <div class="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin testo-accento" style="border-color: currentColor; border-top-color: transparent;"></div>
            <span class="text-xs text-stone-400 italic">${window.t("history_loading", "Loading history…")}</span>
        </li>`;

    try {
        const { fileId, revisions } = await window.elencaRevisioniCloud();

        if (!revisions || revisions.length === 0) {
            list.innerHTML = `<li class="p-4 text-xs text-stone-400 italic text-center">${window.t("history_no_revisions", "No revisions found. Upload to Cloud at least once.")}</li>`;
            return;
        }

        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const hint = document.createElement('li');
        hint.className = 'storico-intestazione px-3 py-2 text-[11px] italic';
        hint.textContent = window.t("history_click_hint", "Click a version to compare or restore.");
        fragment.appendChild(hint);

        revisions.forEach((rev, index) => {
            const data = new Date(rev.modifiedTime);
            const dataStr = data.toLocaleDateString(window.localeAttuale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
            const oraStr = data.toLocaleTimeString(window.localeAttuale(), { hour: '2-digit', minute: '2-digit' });
            const autore = rev.lastModifyingUser
                ? (rev.lastModifyingUser.displayName || rev.lastModifyingUser.emailAddress || window.t('history_unknown_author', 'Sconosciuto'))
                : window.t('history_unknown_author', 'Sconosciuto');
            const dimensioneKb = rev.size ? Math.round(parseInt(rev.size) / 1024) : '?';
            const isCurrent = index === 0;

            const li = document.createElement('li');
            li.className = `storico-riga${isCurrent ? ' is-attuale' : ''} flex items-center gap-3 py-2.5 px-3 cursor-context-menu select-none transition-colors`;
            li.dataset.revisionId = rev.id;
            li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

            li.innerHTML = `
                <i data-lucide="${isCurrent ? 'git-commit-horizontal' : 'clock'}" class="storico-riga-icona w-3.5 h-3.5 shrink-0 text-stone-400"></i>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="storico-riga-titolo text-xs font-semibold text-stone-700 truncate">${escapeHTML(dataStr)} ${escapeHTML(oraStr)}</span>
                    <span class="text-[11px] text-stone-500 truncate">${escapeHTML(autore)} · ${dimensioneKb} KB</span>
                </div>
                ${isCurrent ? `<span class="storico-badge shrink-0">${escapeHTML(window.t('history_current', 'ATTUALE'))}</span>` : ''}
            `;

            const handleActionMenu = (e) => {
                apriHistoryContextMenu(e, fileId, rev, dataStr, oraStr, autore, isCurrent);
            };
            li.addEventListener('click', handleActionMenu);
            li.addEventListener('contextmenu', handleActionMenu);

            fragment.appendChild(li);
        });

        list.appendChild(fragment);
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Errore storico cloud:", err);
        list.innerHTML = `
            <li class="p-4 text-xs testo-pericolo italic text-center">
                ${escapeHTML(window.t('history_error', 'Errore: '))}${escapeHTML(err.message)}
            </li>`;
    }
}

function calcolaDiffsManoscritti(oldList, newList) {
    const oldMap = {};
    (oldList || []).forEach(m => { oldMap[m.id] = m; });
    const newMap = {};
    (newList || []).forEach(m => { newMap[m.id] = m; });

    const allIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    const diffs = [];
    for (const id of allIds) {
        const revM = oldMap[id] || {};
        const curM = newMap[id] || {};
        if (JSON.stringify(revM) !== JSON.stringify(curM)) {
            diffs.push({ revM, curM, id });
        }
    }
    return diffs;
}

async function apriDiffRevisioneCloud(fileId, revisionId, label) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_revisione", "Caricamento revisione…"), "info");
    try {
        const revDb = await window.caricaRevisioneCloud(fileId, revisionId);
        if (!revDb || !revDb.manoscritti) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_revisione_vuota_o_non_val", "Revisione vuota o non valida."), "warning");
            return;
        }

        const diffs = calcolaDiffsManoscritti(revDb.manoscritti, appData.manoscritti || []);

        if (diffs.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nessuna_differenza_rispet", "Nessuna differenza rispetto alla versione attuale."), "success");
            return;
        }

        apriDiffRevisioneModal(diffs, label);

    } catch (err) {
        console.error("Errore confronto revisione:", err);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_nel_caricamento_de", "Errore nel caricamento della revisione: ") + err.message, "error");
    }
}

function apriDiffRevisioneModal(diffs, label, leftLabel?, rightLabel?) {
    const esistente = document.getElementById('history-diff-modal');
    if (esistente) esistente.remove();

    const t = window.t;
    let idx = 0;

    const overlay = document.createElement('div');
    overlay.id = 'history-diff-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = window.sanitizeHTML(`
        <div class="modal-window max-w-3xl">
            <div class="modal-header gap-4">
                <div class="min-w-0">
                    <h3 class="modal-title">
                        <span>${escapeHTML(t('history_diff_title', 'Storico'))} ·</span>
                        <span class="font-mono font-medium truncate" translate="no">${escapeHTML(label)}</span>
                    </h3>
                    <p id="hist-diff-sottotitolo" class="modal-sottotitolo"></p>
                </div>
                <button id="hist-close-btn" type="button" class="btn btn-ghost btn-icon shrink-0" aria-label="${escapeHTML(t('btn_close', 'Chiudi'))}"><span aria-hidden="true">✕</span></button>
            </div>
            <div id="hist-diff-body" class="modal-body"></div>
            <div class="modal-footer modal-footer-bar">
                <button id="hist-prev-btn" type="button" class="btn btn-secondary disabled:opacity-40"><span aria-hidden="true">←</span> ${escapeHTML(t('btn_prev', 'Precedente'))}</button>
                <button id="hist-next-btn" type="button" class="btn btn-secondary disabled:opacity-40">${escapeHTML(t('btn_next', 'Successiva'))} <span aria-hidden="true">→</span></button>
                <button id="hist-close-btn2" type="button" class="btn btn-primary ml-auto">${escapeHTML(t('btn_close', 'Chiudi'))}</button>
            </div>
        </div>
    `);
    document.body.appendChild(overlay);

    const sottotitolo = overlay.querySelector<HTMLElement>('#hist-diff-sottotitolo');
    const body = overlay.querySelector<HTMLElement>('#hist-diff-body');
    const btnPrev = overlay.querySelector<HTMLButtonElement>('#hist-prev-btn');
    const btnNext = overlay.querySelector<HTMLButtonElement>('#hist-next-btn');
    const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'id', 'allegato', 'allegatoTipo'];

    function renderDiff() {
        const { revM, curM } = diffs[idx];
        const titolo = curM.titolo || revM.titolo || curM.segnatura || revM.segnatura || t('history_diff_untitled', 'Senza titolo');

        const conteggio = t(diffs.length === 1 ? 'history_diff_count_one' : 'history_diff_count_other',
            diffs.length === 1 ? '{n} scheda con differenze' : '{n} schede con differenze').replace('{n}', String(diffs.length));
        const posizione = t('history_diff_position', 'Visualizzando {i} di {n}:')
            .replace('{i}', String(idx + 1)).replace('{n}', String(diffs.length));
        sottotitolo.innerHTML = window.sanitizeHTML(
            `${escapeHTML(conteggio)} · ${escapeHTML(posizione)} <strong class="font-mono font-medium" translate="no">${escapeHTML(titolo)}</strong>`);

        const allKeys = new Set([...Object.keys(revM), ...Object.keys(curM)]);
        let htmlDiff = '';
        for (const key of allKeys) {
            if (chiaviIgnorate.includes(key)) continue;
            const v = JSON.stringify(revM[key] ?? '');
            const a = JSON.stringify(curM[key] ?? '');
            if (v === a) continue;
            const prima = typeof revM[key] === 'object' ? JSON.stringify(revM[key], null, 2) : String(revM[key] ?? '');
            const dopo = typeof curM[key] === 'object' ? JSON.stringify(curM[key], null, 2) : String(curM[key] ?? '');
            htmlDiff += window.htmlDiffCampo(key, prima, dopo,
                leftLabel || t("diff_in_revision", "nella revisione"), rightLabel || t("diff_current_version", "versione attuale"));
        }
        if (!htmlDiff) htmlDiff = `<p class="modello-suggerimento text-center py-8">${escapeHTML(t('history_diff_no_visible', 'Nessuna differenza nei campi visibili.'))}</p>`;
        body.innerHTML = window.sanitizeHTML(htmlDiff);
        body.scrollTop = 0;

        btnPrev.disabled = idx === 0;
        btnNext.disabled = idx >= diffs.length - 1;
        const attivo = document.activeElement;
        if (attivo === btnNext && btnNext.disabled) btnPrev.focus();
        else if (attivo === btnPrev && btnPrev.disabled) btnNext.focus();
    }

    const close = () => overlay.remove();
    window.chiudiHistoryDiffModal = close;
    overlay.querySelector<HTMLElement>('#hist-close-btn').onclick = close;
    overlay.querySelector<HTMLElement>('#hist-close-btn2').onclick = close;
    btnPrev.onclick = () => { if (idx > 0) { idx--; renderDiff(); } };
    btnNext.onclick = () => { if (idx < diffs.length - 1) { idx++; renderDiff(); } };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    renderDiff();
}

async function ripristinaRevisioneConConferma(fileId, revisionId, label) {
    apriConfermaRipristino(label, () => window.ripristinaRevisioneCloud(fileId, revisionId));
}

async function apriConfermaRipristino(label, onConfirm) {
    const esistente = document.getElementById('history-restore-confirm');
    if (esistente) esistente.remove();

    const t = window.t;
    const overlay = document.createElement('div');
    overlay.id = 'history-restore-confirm';
    overlay.className = 'modal-overlay z-modal-alert';
    overlay.innerHTML = window.sanitizeHTML(`
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">${escapeHTML(t('history_restore_title', 'Ripristina revisione'))}</h3>
            </div>
            <div class="modal-body">
                <p class="text-sm text-stone-600 mb-2">${escapeHTML(t('history_restore_intro', 'Stai per ripristinare il vault alla versione del:'))}</p>
                <p class="storico-versione text-sm mb-4" translate="no">${escapeHTML(label)}</p>
                <p class="text-sm text-stone-600 leading-relaxed">${t('history_restore_warning', 'Questa operazione <strong>sovrascriverà il database locale</strong> e caricherà la versione ripristinata sul cloud. Verrà salvata come nuova revisione nello storico.')}</p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button id="hist-cancel-restore" type="button" class="btn btn-secondary" data-modal-cancel>${escapeHTML(t('btn_cancel', 'Annulla'))}</button>
                <button id="hist-confirm-restore" type="button" class="btn btn-danger">${escapeHTML(t('btn_restore', 'Ripristina'))}</button>
            </div>
        </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector<HTMLElement>('#hist-cancel-restore').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector<HTMLElement>('#hist-confirm-restore').onclick = async () => {
        overlay.remove();
        if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(true, 'download_in_progress');
        try {
            const esito = await onConfirm();
            if (esito !== false) {
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_vault_ripristinato_alla_v", 'Archivio ripristinato alla versione selezionata.'), "success");
            }
            if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
        } catch (err) {
            console.error("Errore ripristino:", err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_il_riprist", "Errore durante il ripristino: ") + err.message, "error");
        } finally {
            if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(false);
        }
    };
}

function formatRelativeDate(ts) {
    const diffSec = Math.round((ts - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs > 60 * 60 * 24 * 30) {
        const d = new Date(ts);
        return d.toLocaleDateString(window.localeAttuale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString(window.localeAttuale(), { hour: '2-digit', minute: '2-digit' });
    }
    const rtf = new Intl.RelativeTimeFormat(window.localeAttuale(), { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, secs] of units) {
        if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
    }
    return rtf.format(diffSec, 'second');
}

async function renderHubHistoryList(list) {
    list.innerHTML = `
        <li class="p-6 text-center flex flex-col items-center gap-3">
            <div class="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin testo-accento" style="border-color: currentColor; border-top-color: transparent;"></div>
            <span class="text-xs text-stone-400 italic">${window.t("history_loading", "Loading history…")}</span>
        </li>`;

    try {
        const { currentVersion, versions } = await window.elencaVersioniHub();

        if (!versions || versions.length === 0) {
            list.innerHTML = `<li class="p-4 text-xs text-stone-400 italic text-center">${window.t("hub_history_empty", "Nessuna versione. Esegui almeno un 'Invia' all'Hub.")}</li>`;
            return;
        }

        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const hint = document.createElement('li');
        hint.className = 'storico-intestazione px-3 py-2 text-[11px] italic';
        hint.textContent = window.t("history_click_hint", "Click a version to compare or restore.");
        fragment.appendChild(hint);

        const versionSet = new Set(versions.map(v => v.version));

        versions.forEach((entry) => {
            const isCurrent = entry.version === currentVersion;
            const autore = entry.authorMemberId == null
                ? window.t("hub_history_owner", "Proprietario")
                : (entry.authorLabel || window.t("hub_generic_author", "Collaboratore"));
            const dimensioneKb = entry.sizeBytes ? Math.round(entry.sizeBytes / 1024) : 0;

            const li = document.createElement('li');
            li.className = `storico-riga${isCurrent ? ' is-attuale' : ''} flex items-center gap-3 py-2.5 px-3 cursor-context-menu select-none transition-colors`;
            li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

            const icon = document.createElement('i');
            icon.dataset.lucide = isCurrent ? 'git-commit-horizontal' : 'git-commit-vertical';
            icon.className = 'storico-riga-icona w-3.5 h-3.5 shrink-0 text-stone-400';
            li.appendChild(icon);

            const col = document.createElement('div');
            col.className = 'flex flex-col min-w-0 flex-1';
            const line1 = document.createElement('span');
            line1.className = 'storico-riga-titolo text-xs font-semibold text-stone-700 truncate';
            line1.innerHTML = `<span style="font-family:monospace;">v${escapeHTML(String(entry.version))}</span> · ${escapeHTML(autore)}`;
            const line2 = document.createElement('span');
            line2.className = 'text-[11px] text-stone-500 truncate';
            line2.textContent = `${formatRelativeDate(entry.createdAt)} · ${dimensioneKb} KB`;
            col.appendChild(line1);
            col.appendChild(line2);
            li.appendChild(col);

            if (isCurrent) {
                const badge = document.createElement('span');
                badge.className = 'storico-badge shrink-0';
                badge.textContent = window.t("history_current", "ATTUALE");
                li.appendChild(badge);
            }

            const handleActionMenu = (e) => {
                apriHubHistoryContextMenu(e, entry, versionSet, currentVersion);
            };
            li.addEventListener('click', handleActionMenu);
            li.addEventListener('contextmenu', handleActionMenu);

            fragment.appendChild(li);
        });

        list.appendChild(fragment);
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Errore storico Hub:", err);
        list.innerHTML = `
            <li class="p-4 text-xs testo-pericolo italic text-center">
                ${escapeHTML(window.t('history_error', 'Errore: '))}${escapeHTML(err.message)}
            </li>`;
    }
}

function apriHubHistoryContextMenu(e, entry, versionSet, currentVersion) {
    e.stopPropagation();

    const isCurrent = entry.version === currentVersion;
    const autore = entry.authorMemberId == null
        ? window.t("hub_history_owner", "Proprietario")
        : (entry.authorLabel || window.t("hub_generic_author", "Collaboratore"));
    const data = new Date(entry.createdAt);
    const dataStr = data.toLocaleDateString(window.localeAttuale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    const oraStr = data.toLocaleTimeString(window.localeAttuale(), { hour: '2-digit', minute: '2-digit' });
    const label = `v${entry.version} – ${dataStr} ${oraStr} – ${autore}`;
    const hasPrevious = versionSet.has(entry.version - 1);

    window.apriMenuContestuale(e, [
        { heading: true, label: `v${entry.version} · ${dataStr} ${oraStr} · ${autore}` },
        { label: window.t("history_compare_now", "Confronta con l'attuale"), icon: 'git-compare',
          onSelect: () => apriDiffVersioneHub(entry.version, null, label) },
        hasPrevious && { label: window.t("history_compare_previous", "Confronta con precedente"), icon: 'file-diff',
          onSelect: () => apriDiffVersioneHub(entry.version - 1, entry.version, label) },
        !isCurrent && { separator: true },
        !isCurrent && { label: window.t("history_restore_version", "Ripristina questa versione"), icon: 'rotate-ccw', danger: true,
          onSelect: () => ripristinaVersioneHubConConferma(entry.version, label) }
    ]);
}

async function apriDiffVersioneHub(oldVersion, newVersionOrNull, label) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_revisione", "Caricamento revisione…"), "info");
    try {
        const [oldSnap, newList] = await Promise.all([
            window.caricaVersioneHub(oldVersion),
            newVersionOrNull == null
                ? Promise.resolve({ database: { manoscritti: appData.manoscritti || [] } })
                : window.caricaVersioneHub(newVersionOrNull)
        ]);

        const diffs = calcolaDiffsManoscritti(oldSnap.database.manoscritti || [], newList.database.manoscritti || []);

        if (diffs.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nessuna_differenza_rispet", "Nessuna differenza rispetto alla versione attuale."), "success");
            return;
        }

        const leftLabel = `v${oldVersion}`;
        const rightLabel = newVersionOrNull == null ? window.t("diff_current_version", "CURRENT VERSION") : `v${newVersionOrNull}`;
        apriDiffRevisioneModal(diffs, label, leftLabel, rightLabel);

    } catch (err) {
        console.error("Errore confronto versione Hub:", err);
        const msg = err.status === 404
            ? window.t("hub_history_pruned", "Versione non più disponibile: eliminata dalla retention del server.")
            : window.t("msg_errore_nel_caricamento_de", "Errore nel caricamento della revisione: ") + (err.message || '');
        if (typeof mostraMessaggio === 'function') mostraMessaggio(msg, "error");
    }
}

async function ripristinaVersioneHubConConferma(version, label) {
    apriConfermaRipristino(label, () => window.ripristinaVersioneHub(version));
}

function _snEtichettaMotivo(motivo) {
    switch (motivo) {
        case 'manuale': return window.t('snap_reason_manual', 'creato a mano');
        case 'prima-ripristino': return window.t('snap_reason_restore', 'prima di un ripristino');
        case 'prima-import': return window.t('snap_reason_import', 'prima di un import');
        default: return window.t('snap_reason_auto', 'automatico');
    }
}

function _snKb(bytes) {
    return bytes ? Math.max(1, Math.round(bytes / 1024)) : 0;
}

window.renderSnapshotLocali = async function(list) {
    if (!list || !window.apiSicurezza) return;

    const intestazione = document.createElement('li');
    intestazione.className = 'storico-intestazione px-3 py-2 flex items-center justify-between gap-2 sticky top-0';
    const titolo = document.createElement('span');
    titolo.className = 'text-[11px] font-medium';
    titolo.textContent = window.t('snap_section_title', 'Snapshot locali');
    intestazione.appendChild(titolo);
    const crea = document.createElement('button');
    crea.type = 'button';
    crea.id = 'btn-snapshot-now';
    crea.className = 'btn-collegamento text-[11px]';
    crea.textContent = window.t('snap_create_now', 'Crea adesso');
    crea.title = window.t('snap_create_now_hint', 'Fotografa subito lo stato dell\'archivio');
    crea.onclick = () => window.creaSnapshotOra();
    intestazione.appendChild(crea);
    list.appendChild(intestazione);

    let voci = [];
    try {
        const res = await window.apiSicurezza.snapshotElenca();
        if (!res || res.success === false) throw new Error((res && res.error) || 'Elenco non disponibile');
        voci = res.voci || [];
    } catch (err) {
        console.error('Errore elenco snapshot:', err);
        const errore = document.createElement('li');
        errore.className = 'p-3 text-xs testo-pericolo italic text-center';
        errore.textContent = window.t('history_error', 'Errore: ') + (err.message || err);
        list.appendChild(errore);
        return;
    }

    if (voci.length === 0) {
        const vuoto = document.createElement('li');
        vuoto.className = 'p-3 text-[11px] text-stone-400 italic text-center';
        vuoto.textContent = window.t('snap_empty', 'Nessuno snapshot: il primo viene creato da solo mentre lavori.');
        list.appendChild(vuoto);
        return;
    }

    const frammento = document.createDocumentFragment();
    for (const v of voci) {
        const li = document.createElement('li');
        li.className = 'storico-riga flex items-center gap-3 py-2.5 px-3 cursor-context-menu select-none transition-colors';
        li.dataset.snapshot = v.nome;
        li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

        const icona = document.createElement('i');
        icona.dataset.lucide = 'hard-drive';
        icona.className = 'w-3.5 h-3.5 shrink-0 text-stone-400';
        li.appendChild(icona);

        const col = document.createElement('div');
        col.className = 'flex flex-col min-w-0 flex-1';
        const r1 = document.createElement('span');
        r1.className = 'text-xs font-semibold text-stone-700 truncate';
        r1.textContent = formatRelativeDate(v.creatoIl);
        const r2 = document.createElement('span');
        r2.className = 'text-[11px] text-stone-500 truncate';
        r2.textContent = _snEtichettaMotivo(v.motivo) + ' · ' + _snKb(v.sizeBytes) + ' KB';
        col.appendChild(r1);
        col.appendChild(r2);
        li.appendChild(col);

        const menu = (e) => _snApriMenu(e, v);
        li.addEventListener('click', menu);
        li.addEventListener('contextmenu', menu);
        frammento.appendChild(li);
    }
    list.appendChild(frammento);
    if (window.lucide) lucide.createIcons({ nodes: [list] });
};

function _snApriMenu(e, voce) {
    e.stopPropagation();

    const data = new Date(voce.creatoIl);
    const dataStr = data.toLocaleDateString(window.localeAttuale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    const oraStr = data.toLocaleTimeString(window.localeAttuale(), { hour: '2-digit', minute: '2-digit' });
    const label = `${dataStr} ${oraStr} – ${_snEtichettaMotivo(voce.motivo)}`;

    window.apriMenuContestuale(e, [
        { heading: true, label },
        {
            label: window.t('history_compare_now', 'Confronta con l\'attuale'),
            icon: 'git-compare',
            onSelect: () => window.confrontaSnapshot(voce.nome, label)
        },
        { separator: true },
        {
            label: window.t('history_restore_version', 'Ripristina questa versione'),
            icon: 'rotate-ccw',
            onSelect: () => window.ripristinaSnapshot(voce.nome, label)
        },
        {
            label: window.t('snap_delete', 'Elimina lo snapshot'),
            icon: 'trash-2',
            danger: true,
            onSelect: () => window.eliminaSnapshot(voce.nome)
        }
    ]);
}

async function _snCarica(nome) {
    const res = await window.apiSicurezza.snapshotCarica(nome);
    if (!res || res.success === false) throw new Error((res && res.error) || 'Snapshot illeggibile');
    return res.database;
}

window.confrontaSnapshot = async function(nome, label) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_caricamento_revisione', 'Caricamento revisione…'), 'info');
    try {
        const db = await _snCarica(nome);
        const diffs = calcolaDiffsManoscritti(db.manoscritti || [], appData.manoscritti || []);
        if (diffs.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_nessuna_differenza_rispet', 'Nessuna differenza rispetto alla versione attuale.'), 'success');
            return;
        }
        apriDiffRevisioneModal(diffs, label, window.t('snap_side_label', 'NELLO SNAPSHOT'), window.t('diff_current_version', 'CURRENT VERSION'));
    } catch (err) {
        console.error('Errore confronto snapshot:', err);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_errore_nel_caricamento_de', 'Errore nel caricamento della revisione: ') + (err.message || err), 'error');
    }
};

window.ripristinaSnapshot = function(nome, label) {
    apriConfermaRipristino(label, async () => {
        try {
            await window.apiSicurezza.snapshotCrea('prima-ripristino');
        } catch (err) {
            console.error('Snapshot di sicurezza non creato:', err);
        }
        const db = await _snCarica(nome);
        const esito = await window.ripristinaDatabase(db);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(window.t('snap_restored', 'Archivio riportato allo snapshot: {var0} schede.').replace('{var0}', String(esito.schede)), 'success');
        }
        return false;
    });
};

window.creaSnapshotOra = async function() {
    try {
        if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
        const res = await window.apiSicurezza.snapshotCrea('manuale');
        if (!res || res.success === false) throw new Error((res && res.error) || 'Creazione non riuscita');
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('snap_created', 'Snapshot creato.'), 'success');
    } catch (err) {
        console.error('Errore creazione snapshot:', err);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('snap_create_failed', 'Snapshot non creato: ') + (err.message || err), 'error');
    }
    if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
};

window.eliminaSnapshot = function(nome) {
    const procedi = async () => {
        try {
            const res = await window.apiSicurezza.snapshotElimina(nome);
            if (!res || res.success === false) throw new Error((res && res.error) || 'Eliminazione non riuscita');
        } catch (err) {
            console.error('Errore eliminazione snapshot:', err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('snap_delete_failed', 'Snapshot non eliminato: ') + (err.message || err), 'error');
        }
        if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
    };
    const msg = window.t('snap_confirm_delete', 'Eliminare questo snapshot? La cronologia locale di quel momento andrà persa.');
    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, procedi);
    else procedi();
};

window.apriStoriaRecord = async function(id) {
    if (!window.apiSicurezza) return;
    const record = appData.manoscritti.find(x => String(x.id) === String(id));
    const etichetta = record ? (record.segnatura || record.titolo || window.t('record_untitled', 'scheda senza titolo')) : String(id);

    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('rec_history_loading', 'Ricostruzione della cronologia…'), 'info');
    let tappe = [];
    try {
        const res = await window.apiSicurezza.storiaRecord(String(id));
        if (!res || res.success === false) throw new Error((res && res.error) || 'Cronologia non disponibile');
        tappe = res.tappe || [];
    } catch (err) {
        console.error('Errore cronologia scheda:', err);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('rec_history_failed', 'Cronologia non disponibile: ') + (err.message || err), 'error');
        return;
    }

    if (tappe.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('rec_history_empty', 'Nessuno snapshot contiene questa scheda: la cronologia comincia dal primo snapshot.'), 'info');
        return;
    }
    _srApriModal(id, etichetta, tappe, record || {});
};

function _srApriModal(id, etichetta, tappe, corrente) {
    const esistente = document.getElementById('record-history-modal');
    if (esistente) esistente.remove();

    const overlay = document.createElement('div');
    overlay.id = 'record-history-modal';
    overlay.className = 'modal-overlay';

    const finestra = document.createElement('div');
    finestra.className = 'modal-window max-w-lg';
    overlay.appendChild(finestra);

    const header = document.createElement('div');
    header.className = 'modal-header';
    const testa = document.createElement('div');
    testa.className = 'min-w-0';
    const h3 = document.createElement('h3');
    h3.className = 'modal-title';
    const span = document.createElement('span');
    span.textContent = window.t('rec_history_title', 'Cronologia della scheda') + ' ·';
    const segnatura = document.createElement('span');
    segnatura.className = 'font-mono font-medium truncate';
    segnatura.setAttribute('translate', 'no');
    segnatura.textContent = etichetta;
    h3.append(span, segnatura);
    const nota = document.createElement('p');
    nota.className = 'modal-sottotitolo';
    nota.textContent = window.t('rec_history_hint', 'Le tappe sono ricavate dagli snapshot locali: compaiono solo i momenti in cui questa scheda è cambiata.');
    testa.append(h3, nota);
    header.appendChild(testa);
    finestra.appendChild(header);

    const body = document.createElement('div');
    body.className = 'modal-body';
    finestra.appendChild(body);

    const lista = document.createElement('div');
    body.appendChild(lista);

    for (let i = 0; i < tappe.length; i++) {
        const t = tappe[i];
        const riga = document.createElement('div');
        riga.className = 'storico-tappa';

        const col = document.createElement('span');
        col.className = 'flex-1 min-w-0';
        const quando = document.createElement('span');
        quando.className = 'block font-medium truncate';
        quando.textContent = formatRelativeDate(t.creatoIl);
        const stato = document.createElement('span');
        stato.className = 'block modello-suggerimento truncate';
        stato.textContent = t.record
            ? _snEtichettaMotivo(t.motivo)
            : window.t('rec_history_absent', 'scheda non presente');
        col.appendChild(quando);
        col.appendChild(stato);
        riga.appendChild(col);

        if (t.record) {
            const confronta = document.createElement('button');
            confronta.type = 'button';
            confronta.className = 'btn btn-ghost btn-icon shrink-0';
            confronta.title = window.t('history_compare_now', 'Confronta con l\'attuale');
            confronta.setAttribute('aria-label', confronta.title);
            confronta.innerHTML = '<i data-lucide="git-compare" class="w-4 h-4"></i>';
            confronta.onclick = () => {
                const diffs = calcolaDiffsManoscritti([t.record], [corrente]);
                if (diffs.length === 0) {
                    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_nessuna_differenza_rispet', 'Nessuna differenza rispetto alla versione attuale.'), 'success');
                    return;
                }
                apriDiffRevisioneModal(diffs, formatRelativeDate(t.creatoIl),
                    window.t('snap_side_label', 'NELLO SNAPSHOT'), window.t('diff_current_version', 'CURRENT VERSION'));
            };
            riga.appendChild(confronta);

            const ripristina = document.createElement('button');
            ripristina.type = 'button';
            ripristina.className = 'btn btn-ghost btn-icon shrink-0';
            ripristina.title = window.t('rec_history_restore', 'Riporta la scheda a questa versione');
            ripristina.setAttribute('aria-label', ripristina.title);
            ripristina.innerHTML = '<i data-lucide="rotate-ccw" class="w-4 h-4"></i>';
            ripristina.onclick = () => window.ripristinaVersioneRecord(id, t.record, formatRelativeDate(t.creatoIl));
            riga.appendChild(ripristina);
        }

        lista.appendChild(riga);
    }

    const footer = document.createElement('div');
    footer.className = 'modal-footer modal-footer-bar';
    const chiudi = document.createElement('button');
    chiudi.type = 'button';
    chiudi.className = 'btn btn-primary';
    chiudi.setAttribute('data-modal-cancel', '');
    chiudi.textContent = window.t('btn_close', 'Chiudi');
    chiudi.onclick = () => overlay.remove();
    footer.appendChild(chiudi);
    finestra.appendChild(footer);

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
}

window.ripristinaVersioneRecord = async function(id, versione, quando) {
    const indice = appData.manoscritti.findIndex(x => String(x.id) === String(id));
    if (indice === -1) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('rec_history_gone', 'La scheda non è più in archivio: ripristinala dal cestino.'), 'warning');
        return;
    }

    const prima = JSON.parse(JSON.stringify(appData.manoscritti[indice]));
    const settings = window.apiSettings ? await window.apiSettings.get() : {};
    const username = settings.username || 'Anonimo';

    const applica = async (stato, rifirma) => {
        const i = appData.manoscritti.findIndex(x => String(x.id) === String(id));
        if (i === -1) return;
        const nuovo = JSON.parse(JSON.stringify(stato));
        if (rifirma) {
            nuovo.lastModified = Date.now();
            nuovo.modificatoDa = username;
        }
        appData.manoscritti[i] = nuovo;
        await window.Store.commit();
    };

    await applica(versione, true);
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(
            window.t('undo_restore_record', 'Ripristino della scheda al {var0}').replace('{var0}', String(quando)),
            () => applica(prima, false),
            () => applica(versione, true)
        );
    }
    const modal = document.getElementById('record-history-modal');
    if (modal) modal.remove();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t('rec_history_restored', 'Scheda riportata alla versione del {var0}.').replace('{var0}', String(quando)), 'success',
            () => window.gestoreAnnullamento && window.gestoreAnnullamento.annullaUltimaAzione());
    }
};
