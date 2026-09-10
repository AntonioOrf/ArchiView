// @ts-nocheck
// ─── STORICO VERSIONI CLOUD ─────────────────────────────────────────────────

// Context menu personalizzato per lo storico
let _historyContextMenu = null;

function chiudiHistoryContextMenu() {
    if (_historyContextMenu) {
        _historyContextMenu.remove();
        _historyContextMenu = null;
    }
}

function apriHistoryContextMenu(e, fileId, rev, dataStr, oraStr, autore, isCurrent) {
    chiudiHistoryContextMenu();
    e.preventDefault();
    e.stopPropagation();

    const label = `${dataStr} ${oraStr} – ${autore}`;

    const menu = document.createElement('div');
    menu.id = 'history-ctx-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${Math.min(e.clientY, window.innerHeight - 120)}px;
        left: ${Math.min(e.clientX, window.innerWidth - 200)}px;
        z-index: 500;
        background: #1c1917;
        border: 1px solid #44403c;
        border-radius: 6px;
        padding: 4px;
        min-width: 190px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        font-size: 0.78rem;
        color: #e7e5e4;
    `;

    const menuItem = (icon, text, color, onclick) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%; display: flex; align-items: center; gap: 8px;
            padding: 7px 10px; border: none; background: transparent;
            color: ${color}; cursor: pointer; border-radius: 4px;
            font-size: 0.78rem; text-align: left;
            transition: background 0.1s;
        `;
        btn.innerHTML = `<i data-lucide="${icon}" style="width:13px;height:13px;flex-shrink:0;"></i> ${text}`;
        btn.onmouseenter = () => btn.style.background = '#292524';
        btn.onmouseleave = () => btn.style.background = 'transparent';
        btn.onclick = (ev) => { ev.stopPropagation(); chiudiHistoryContextMenu(); onclick(); };
        return btn;
    };

    // Header: data/autore
    const header = document.createElement('div');
    header.style.cssText = 'padding: 6px 10px 5px; font-size: 0.68rem; color: #78716c; border-bottom: 1px solid #292524; margin-bottom: 4px; line-height: 1.4;';
    header.innerHTML = `<strong style="color:#a8a29e;">${dataStr} ${oraStr}</strong><br>${escapeHTML(autore)}`;
    menu.appendChild(header);

    // Confronta con ora (sempre disponibile)
    menu.appendChild(menuItem('git-compare', window.t("history_compare_now", "Compare with current"), '#93c5fd',
        () => apriDiffRevisioneCloud(fileId, rev.id, label)));

    // Separatore
    if (!isCurrent) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
        menu.appendChild(sep);

        menu.appendChild(menuItem('rotate-ccw', window.t("history_restore_version", "Restore to this version"), '#fca5a5',
            () => ripristinaRevisioneConConferma(fileId, rev.id, label)));
    }

    // Separatore + Annulla
    const sep2 = document.createElement('div');
    sep2.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
    menu.appendChild(sep2);

    menu.appendChild(menuItem('x', window.t("btn_cancel", "Cancel"), '#78716c', () => {}));

    document.body.appendChild(menu);
    _historyContextMenu = menu;

    if (window.lucide) lucide.createIcons({ nodes: [menu] });

    // Chiudi cliccando altrove
    setTimeout(() => {
        document.addEventListener('click', chiudiHistoryContextMenu, { once: true });
        document.addEventListener('contextmenu', chiudiHistoryContextMenu, { once: true });
    }, 0);
}

// ─── Rendering lista revisioni ───────────────────────────────────────────────

/**
 * Fase 4.2 — Il pannello mostra DUE cronologie, sempre entrambe: quella del cloud (Hub o
 * Drive, o l'invito a collegarsi se non c'è) e quella locale degli snapshot.
 *
 * Non sono in alternativa perché non rispondono alla stessa domanda: il cloud sa cosa hanno
 * fatto i colleghi, gli snapshot sanno cos'è successo su QUESTO computer — comprese le
 * modifiche mai inviate, che nel cloud non compaiono per definizione. Mostrare i soli
 * snapshot a chi lavora offline e le sole versioni cloud a tutti gli altri avrebbe lasciato
 * senza rete proprio il caso più frequente: l'errore fatto e salvato prima di sincronizzare.
 */
window.renderHistoryList = async function() {
    const list = document.getElementById('history-list');
    if (!list) return;
    await renderCronologiaCloud(list);
    await window.renderSnapshotLocali(list);
};

async function renderCronologiaCloud(list) {
    // Vault Hub: cronologia GitHub-style (versioni append-only, autore+data, diff on-click).
    // Percorso Drive legacy sotto invariato per i vault non ancora migrati.
    if (window.hubConfig) return renderHubHistoryList(list);

    // Controllo se connesso
    if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
        list.innerHTML = `
            <li class="p-6 text-center flex flex-col items-center gap-3">
                <i data-lucide="cloud-off" class="w-8 h-8 text-stone-300"></i>
                <span class="text-xs text-stone-400 italic">${window.t("history_not_connected", "Connect to Google Drive to see the history.")}</span>
            </li>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Loader
    list.innerHTML = `
        <li class="p-6 text-center flex flex-col items-center gap-3">
            <div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-stone-400 italic">${window.t("history_loading", "Loading history...")}</span>
        </li>`;

    try {
        const { fileId, revisions } = await window.elencaRevisioniCloud();
        window._historyFileId = fileId;

        if (!revisions || revisions.length === 0) {
            list.innerHTML = `<li class="p-4 text-xs text-stone-400 italic text-center">${window.t("history_no_revisions", "No revisions found. Upload to Cloud at least once.")}</li>`;
            return;
        }

        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Istruzione contestuale
        const hint = document.createElement('li');
        hint.className = 'px-3 py-2 text-[10px] text-stone-400 italic bg-stone-50 dark:bg-stone-800/30 border-b border-stone-100 dark:border-stone-800/50';
        hint.textContent = window.t("history_click_hint", "Click a version to compare or restore.");
        fragment.appendChild(hint);

        revisions.forEach((rev, index) => {
            const data = new Date(rev.modifiedTime);
            const dataStr = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const oraStr = data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const autore = rev.lastModifyingUser
                ? (rev.lastModifyingUser.displayName || rev.lastModifyingUser.emailAddress || 'Sconosciuto')
                : 'Sconosciuto';
            const dimensioneKb = rev.size ? Math.round(parseInt(rev.size) / 1024) : '?';
            const isCurrent = index === 0;

            const li = document.createElement('li');
            li.className = `flex items-center gap-3 py-2.5 px-3 border-b border-stone-100 dark:border-stone-800/50 last:border-0 ${isCurrent ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/30'} cursor-context-menu select-none transition-colors`;
            li.dataset.revisionId = rev.id;
            li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

            li.innerHTML = `
                <i data-lucide="${isCurrent ? 'git-commit-horizontal' : 'clock'}" class="w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-amber-500' : 'text-stone-400'}"></i>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-xs font-semibold ${isCurrent ? 'text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'} truncate">${escapeHTML(dataStr)} ${escapeHTML(oraStr)}</span>
                    <span class="text-[10px] text-stone-400 truncate">${escapeHTML(autore)} · ${dimensioneKb} KB</span>
                </div>
                ${isCurrent ? '<span class="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded shrink-0">ATTUALE</span>' : ''}
            `;

            // Tasto sinistro o destro → menu contestuale
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
            <li class="p-4 text-xs text-red-500 italic text-center">
                Errore: ${escapeHTML(err.message)}
            </li>`;
    }
}

// ─── Confronta una revisione con lo stato attuale ───────────────────────────

// Diff record-per-record tra due elenchi manoscritti (per id), a prescindere dalla loro
// provenienza (revisione Drive vs attuale, o due snapshot Hub arbitrari).
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
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_revisione", "Caricamento revisione..."), "info");
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

function apriDiffRevisioneModal(diffs, label, leftLabel, rightLabel) {
    const esistente = document.getElementById('history-diff-modal');
    if (esistente) esistente.remove();

    let idx = 0;

    function renderModal() {
        const { revM, curM } = diffs[idx];
        const titolo = curM.titolo || revM.titolo || curM.segnatura || revM.segnatura || 'Senza Titolo';

        const prev = document.getElementById('history-diff-modal');
        if (prev) prev.remove();

        const isDark = document.documentElement.classList.contains('dark-theme');
        const bg = isDark ? '#1c1917' : '#fafaf9';
        const borderColor = isDark ? '#44403c' : '#e7e5e4';
        const textMuted = isDark ? '#a8a29e' : '#78716c';
        const footerBg = isDark ? '#171412' : '#fff';

        const overlay = document.createElement('div');
        overlay.id = 'history-diff-modal';
        // Fase 5.3 — classe modal-overlay: focus trap, Esc e ripristino del fuoco
        // arrivano dal gestore centralizzato invece di mancare del tutto.
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:var(--z-modal);display:flex;align-items:center;justify-content:center;';

        overlay.innerHTML = `
            <div style="background:${bg};border-radius:10px;border:1px solid ${borderColor};box-shadow:0 24px 64px rgba(0,0,0,0.4);max-width:700px;width:calc(100% - 2rem);max-height:90vh;display:flex;flex-direction:column;">
                <div style="padding:1rem 1.25rem;border-bottom:1px solid ${borderColor};display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
                    <div>
                        <h3 style="font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;color:${isDark?'#e7e5e4':'#1c1917'};">
                            <span>🕐</span> Storico: <span style="color:#d97706;">${escapeHTML(label)}</span>
                        </h3>
                        <p style="font-size:0.7rem;color:${textMuted};margin-top:3px;">${diffs.length} scheda${diffs.length !== 1 ? 'e' : ''} con differenze · Visualizzando ${idx + 1} di ${diffs.length}: <strong style="color:${isDark?'#d6d3d1':'#44403c'};">${escapeHTML(titolo)}</strong></p>
                    </div>
                    <button id="hist-close-btn" style="color:${textMuted};cursor:pointer;font-size:1.3rem;line-height:1;border:none;background:none;padding:2px;flex-shrink:0;">✕</button>
                </div>
                <div id="hist-diff-body" style="flex:1;overflow-y:auto;padding:1rem;"></div>
                <div style="padding:0.75rem 1.25rem;border-top:1px solid ${borderColor};display:flex;justify-content:space-between;align-items:center;background:${footerBg};border-radius:0 0 10px 10px;">
                    <div style="display:flex;gap:0.5rem;">
                        <button id="hist-prev-btn" ${idx === 0 ? 'disabled' : ''} style="padding:0.35rem 0.75rem;font-size:0.75rem;background:${idx === 0 ? (isDark?'#292524':'#f5f5f4') : '#fef3c7'};color:${idx === 0 ? (isDark?'#57534e':'#a8a29e') : '#92400e'};border:1px solid ${idx === 0 ? borderColor : '#fde68a'};border-radius:4px;cursor:${idx === 0 ? 'not-allowed' : 'pointer'};transition:all 0.1s;">← Prec.</button>
                        <button id="hist-next-btn" ${idx >= diffs.length - 1 ? 'disabled' : ''} style="padding:0.35rem 0.75rem;font-size:0.75rem;background:${idx >= diffs.length - 1 ? (isDark?'#292524':'#f5f5f4') : '#fef3c7'};color:${idx >= diffs.length - 1 ? (isDark?'#57534e':'#a8a29e') : '#92400e'};border:1px solid ${idx >= diffs.length - 1 ? borderColor : '#fde68a'};border-radius:4px;cursor:${idx >= diffs.length - 1 ? 'not-allowed' : 'pointer'};transition:all 0.1s;">Succ. →</button>
                    </div>
                    <button id="hist-close-btn2" style="padding:0.35rem 1.25rem;font-size:0.75rem;background:#d97706;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Chiudi</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const body = overlay.querySelector('#hist-diff-body');
        const chiaviIgnorate = ['lastModified', 'modificatoDa', 'creatoDa', 'id', 'allegato', 'allegatoTipo'];
        const allKeys = new Set([...Object.keys(revM), ...Object.keys(curM)]);
        let htmlDiff = '';
        for (const key of allKeys) {
            if (chiaviIgnorate.includes(key)) continue;
            const v = JSON.stringify(revM[key] ?? '');
            const a = JSON.stringify(curM[key] ?? '');
            if (v === a) continue;
            const prima = typeof revM[key] === 'object' ? JSON.stringify(revM[key], null, 2) : String(revM[key] ?? '(Vuoto)');
            const dopo = typeof curM[key] === 'object' ? JSON.stringify(curM[key], null, 2) : String(curM[key] ?? '(Vuoto)');
            const rowBg = isDark ? '#292524' : '#f5f5f4';
            const redBg = isDark ? '#3b0d0c' : '#fff1f2';
            const greenBg = isDark ? '#0d2e1a' : '#f0fdf4';
            htmlDiff += `
                <div style="margin-bottom:1rem;border:1px solid ${borderColor};border-radius:6px;overflow:hidden;">
                    <div style="background:${rowBg};padding:0.4rem 0.75rem;font-size:0.75rem;font-weight:700;border-bottom:1px solid ${borderColor};color:${isDark?'#d6d3d1':'#44403c'};">
                        Campo: <span style="color:#d97706;">${escapeHTML(key)}</span>
                    </div>
                    <div style="display:flex;">
                        <div style="flex:1;padding:0.6rem;background:${redBg};border-right:1px solid ${borderColor};">
                            <div style="font-size:0.6rem;font-weight:700;color:#f87171;margin-bottom:4px;">${escapeHTML(leftLabel || window.t("diff_in_revision", "IN REVISION"))}</div>
                            <div style="font-size:0.8rem;color:${isDark?'#a8a29e':'#57534e'};white-space:pre-wrap;word-break:break-word;">${escapeHTML(prima)}</div>
                        </div>
                        <div style="flex:1;padding:0.6rem;background:${greenBg};">
                            <div style="font-size:0.6rem;font-weight:700;color:#4ade80;margin-bottom:4px;">${escapeHTML(rightLabel || window.t("diff_current_version", "CURRENT VERSION"))}</div>
                            <div style="font-size:0.8rem;color:${isDark?'#a8a29e':'#57534e'};white-space:pre-wrap;word-break:break-word;">${escapeHTML(dopo)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        if (!htmlDiff) htmlDiff = `<p style="font-size:0.8rem;color:${textMuted};text-align:center;padding:2rem;">Nessuna differenza nei campi visibili.</p>`;
        body.innerHTML = htmlDiff;

        const close = () => overlay.remove();
        window.chiudiHistoryDiffModal = close;
        overlay.querySelector('#hist-close-btn').onclick = close;
        overlay.querySelector('#hist-close-btn2').onclick = close;
        overlay.querySelector('#hist-prev-btn').onclick = () => { if (idx > 0) { idx--; renderModal(); } };
        overlay.querySelector('#hist-next-btn').onclick = () => { if (idx < diffs.length - 1) { idx++; renderModal(); } };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    renderModal();
}

// ─── Ripristina con modale di conferma ──────────────────────────────────────

async function ripristinaRevisioneConConferma(fileId, revisionId, label) {
    apriConfermaRipristino(label, async () => {
        await window.ripristinaRevisioneCloud(fileId, revisionId);
    });
}

// Modale di conferma generico: `onConfirm` esegue il ripristino vero e proprio
// (Drive: ripristinaRevisioneCloud; Hub: ripristinaVersioneHub) e può lanciare per segnalare
// un fallimento (mostrato all'utente); un ritorno `false` esplicito indica un abort silenzioso
// già notificato da onConfirm stesso (es. conflitto di versione Hub).
async function apriConfermaRipristino(label, onConfirm) {
    const esistente = document.getElementById('history-restore-confirm');
    if (esistente) esistente.remove();

    const isDark = document.documentElement.classList.contains('dark-theme');
    const bg = isDark ? '#1c1917' : '#fff';
    const borderColor = isDark ? '#44403c' : '#e7e5e4';
    const textColor = isDark ? '#e7e5e4' : '#1c1917';
    const textMuted = isDark ? '#a8a29e' : '#57534e';
    const cancelBg = isDark ? '#292524' : '#f5f5f4';
    const cancelBorder = isDark ? '#44403c' : '#e7e5e4';
    const cancelColor = isDark ? '#d6d3d1' : '#44403c';

    const overlay = document.createElement('div');
    overlay.id = 'history-restore-confirm';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:400;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:${bg};border:1px solid ${borderColor};border-radius:10px;padding:1.5rem;max-width:430px;width:calc(100%-2rem);box-shadow:0 24px 64px rgba(0,0,0,0.4);">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;color:${textColor};">
                ⚠️ Ripristina revisione
            </h3>
            <p style="font-size:0.82rem;color:${textMuted};margin-bottom:0.5rem;line-height:1.6;">
                Stai per ripristinare il vault alla versione del:
            </p>
            <p style="font-size:0.85rem;font-weight:700;color:#d97706;margin-bottom:1rem;padding:0.5rem 0.75rem;background:${isDark?'#1c1107':'#fffbeb'};border:1px solid ${isDark?'#78350f':'#fde68a'};border-radius:6px;">
                ${escapeHTML(label)}
            </p>
            <p style="font-size:0.8rem;color:${textMuted};margin-bottom:1.25rem;line-height:1.5;">
                Questa operazione <strong style="color:${textColor};">sovrascriverà il database locale</strong> e caricherà la versione ripristinata sul Cloud. Verrà salvata come nuova revisione nello storico.
            </p>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button id="hist-cancel-restore" style="padding:0.5rem 1.1rem;font-size:0.82rem;background:${cancelBg};color:${cancelColor};border:1px solid ${cancelBorder};border-radius:6px;cursor:pointer;font-weight:500;transition:all 0.1s;">Annulla</button>
                <button id="hist-confirm-restore" style="padding:0.5rem 1.1rem;font-size:0.82rem;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.1s;">Ripristina</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('#hist-cancel-restore');
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = isDark ? '#44403c' : '#e7e5e4'; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = cancelBg; };

    cancelBtn.onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#hist-confirm-restore').onclick = async () => {
        overlay.remove();
        if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(true, 'download_in_progress');
        try {
            // `onConfirm` ritorna `false` per un abort già notificato all'utente (es. conflitto
            // di versione Hub): in quel caso non mostriamo un secondo messaggio di successo.
            const esito = await onConfirm();
            if (esito !== false) {
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_vault_ripristinato_alla_v", "✅ Vault ripristinato alla versione selezionata!"), "success");
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

// ─── Cronologia GitHub-style (Hub) ───────────────────────────────────────────

function formatRelativeDate(ts) {
    const diffSec = Math.round((ts - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs > 60 * 60 * 24 * 30) {
        const d = new Date(ts);
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' });
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, secs] of units) {
        if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
    }
    return rtf.format(diffSec, 'second');
}

async function renderHubHistoryList(list) {
    // Loader
    list.innerHTML = `
        <li class="p-6 text-center flex flex-col items-center gap-3">
            <div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-stone-400 italic">${window.t("history_loading", "Loading history...")}</span>
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
        hint.className = 'px-3 py-2 text-[10px] text-stone-400 italic bg-stone-50 dark:bg-stone-800/30 border-b border-stone-100 dark:border-stone-800/50';
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
            li.className = `flex items-center gap-3 py-2.5 px-3 border-b border-stone-100 dark:border-stone-800/50 last:border-0 ${isCurrent ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/30'} cursor-context-menu select-none transition-colors`;
            li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

            const icon = document.createElement('i');
            icon.dataset.lucide = isCurrent ? 'git-commit-horizontal' : 'git-commit-vertical';
            icon.className = `w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-amber-500' : 'text-stone-400'}`;
            li.appendChild(icon);

            const col = document.createElement('div');
            col.className = 'flex flex-col min-w-0 flex-1';
            const line1 = document.createElement('span');
            line1.className = `text-xs font-semibold ${isCurrent ? 'text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'} truncate`;
            line1.innerHTML = `<span style="font-family:monospace;">v${entry.version}</span> · ${escapeHTML(autore)}`;
            const line2 = document.createElement('span');
            line2.className = 'text-[10px] text-stone-400 truncate';
            line2.textContent = `${formatRelativeDate(entry.createdAt)} · ${dimensioneKb} KB`;
            col.appendChild(line1);
            col.appendChild(line2);
            li.appendChild(col);

            if (isCurrent) {
                const badge = document.createElement('span');
                badge.className = 'text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded shrink-0';
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
            <li class="p-4 text-xs text-red-500 italic text-center">
                Errore: ${escapeHTML(err.message)}
            </li>`;
    }
}

function apriHubHistoryContextMenu(e, entry, versionSet, currentVersion) {
    chiudiHistoryContextMenu();
    e.preventDefault();
    e.stopPropagation();

    const isCurrent = entry.version === currentVersion;
    const autore = entry.authorMemberId == null
        ? window.t("hub_history_owner", "Proprietario")
        : (entry.authorLabel || window.t("hub_generic_author", "Collaboratore"));
    const data = new Date(entry.createdAt);
    const dataStr = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const oraStr = data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const label = `v${entry.version} – ${dataStr} ${oraStr} – ${autore}`;
    const hasPrevious = versionSet.has(entry.version - 1);

    const menu = document.createElement('div');
    menu.id = 'history-ctx-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${Math.min(e.clientY, window.innerHeight - 160)}px;
        left: ${Math.min(e.clientX, window.innerWidth - 220)}px;
        z-index: 500;
        background: #1c1917;
        border: 1px solid #44403c;
        border-radius: 6px;
        padding: 4px;
        min-width: 190px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        font-size: 0.78rem;
        color: #e7e5e4;
    `;

    const menuItem = (icon, text, color, onclick) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%; display: flex; align-items: center; gap: 8px;
            padding: 7px 10px; border: none; background: transparent;
            color: ${color}; cursor: pointer; border-radius: 4px;
            font-size: 0.78rem; text-align: left;
            transition: background 0.1s;
        `;
        btn.innerHTML = `<i data-lucide="${icon}" style="width:13px;height:13px;flex-shrink:0;"></i> ${text}`;
        btn.onmouseenter = () => btn.style.background = '#292524';
        btn.onmouseleave = () => btn.style.background = 'transparent';
        btn.onclick = (ev) => { ev.stopPropagation(); chiudiHistoryContextMenu(); onclick(); };
        return btn;
    };

    const header = document.createElement('div');
    header.style.cssText = 'padding: 6px 10px 5px; font-size: 0.68rem; color: #78716c; border-bottom: 1px solid #292524; margin-bottom: 4px; line-height: 1.4;';
    header.innerHTML = `<strong style="color:#a8a29e;">v${entry.version} – ${escapeHTML(dataStr)} ${escapeHTML(oraStr)}</strong><br>${escapeHTML(autore)}`;
    menu.appendChild(header);

    menu.appendChild(menuItem('git-compare', window.t("history_compare_now", "Compare with current"), '#93c5fd',
        () => apriDiffVersioneHub(entry.version, null, label)));

    if (hasPrevious) {
        menu.appendChild(menuItem('file-diff', window.t("history_compare_previous", "Confronta con precedente"), '#93c5fd',
            () => apriDiffVersioneHub(entry.version - 1, entry.version, label)));
    }

    if (!isCurrent) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
        menu.appendChild(sep);

        menu.appendChild(menuItem('rotate-ccw', window.t("history_restore_version", "Restore to this version"), '#fca5a5',
            () => ripristinaVersioneHubConConferma(entry.version, label)));
    }

    const sep2 = document.createElement('div');
    sep2.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
    menu.appendChild(sep2);

    menu.appendChild(menuItem('x', window.t("btn_cancel", "Cancel"), '#78716c', () => {}));

    document.body.appendChild(menu);
    _historyContextMenu = menu;

    if (window.lucide) lucide.createIcons({ nodes: [menu] });

    setTimeout(() => {
        document.addEventListener('click', chiudiHistoryContextMenu, { once: true });
        document.addEventListener('contextmenu', chiudiHistoryContextMenu, { once: true });
    }, 0);
}

// Confronta due snapshot Hub: `newVersionOrNull === null` → confronto con appData corrente.
async function apriDiffVersioneHub(oldVersion, newVersionOrNull, label) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_revisione", "Caricamento revisione..."), "info");
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

// ─── Snapshot locali (Fase 4.2) ──────────────────────────────────────────────
//
// Il pannello riusa ciò che c'era già: `calcolaDiffsManoscritti` per il confronto,
// `apriDiffRevisioneModal` per mostrarlo, `apriConfermaRipristino` per la conferma. La
// differenza rispetto al cloud è solo la provenienza dei dati — un file gzip in
// `.archiview/snapshots/` invece di una revisione remota — e questo è esattamente il motivo
// per cui la 4.2 costa poco: la parte difficile (diff e ripristino) esisteva dal principio.

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
    intestazione.className = 'px-3 py-2 flex items-center justify-between gap-2 bg-stone-50 dark:bg-stone-800/30 border-y border-stone-100 dark:border-stone-800/50 sticky top-0';
    const titolo = document.createElement('span');
    titolo.className = 'text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400';
    titolo.textContent = window.t('snap_section_title', 'Snapshot locali');
    intestazione.appendChild(titolo);
    const crea = document.createElement('button');
    crea.type = 'button';
    crea.id = 'btn-snapshot-now';
    crea.className = 'text-[10px] font-semibold text-amber-600 hover:text-amber-800 transition-colors';
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
        errore.className = 'p-3 text-xs text-red-500 italic text-center';
        errore.textContent = 'Errore: ' + (err.message || err);
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
        li.className = 'flex items-center gap-3 py-2.5 px-3 border-b border-stone-100 dark:border-stone-800/50 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/30 cursor-context-menu select-none transition-colors';
        li.dataset.snapshot = v.nome;
        li.title = window.t('tooltip_click_for_actions', 'Clicca per le azioni disponibili');

        const icona = document.createElement('i');
        icona.dataset.lucide = 'hard-drive';
        icona.className = 'w-3.5 h-3.5 shrink-0 text-stone-400';
        li.appendChild(icona);

        const col = document.createElement('div');
        col.className = 'flex flex-col min-w-0 flex-1';
        const r1 = document.createElement('span');
        r1.className = 'text-xs font-semibold text-stone-700 dark:text-stone-300 truncate';
        r1.textContent = formatRelativeDate(v.creatoIl);
        const r2 = document.createElement('span');
        r2.className = 'text-[10px] text-stone-400 truncate';
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
    chiudiHistoryContextMenu();
    e.preventDefault();
    e.stopPropagation();

    const data = new Date(voce.creatoIl);
    const dataStr = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const oraStr = data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const label = `${dataStr} ${oraStr} – ${_snEtichettaMotivo(voce.motivo)}`;

    // Il menu contestuale unificato (`apriMenuContestuale`) invece di quello disegnato a mano
    // qui sopra per il cloud: quello è codice del 2.x che nessuno ha ancora convertito, non
    // un modello da imitare. Le voci nuove nascono già sul componente comune, che ha la
    // navigazione da tastiera e la chiusura con Esc.
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
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_caricamento_revisione', 'Caricamento revisione...'), 'info');
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
        // La rete PRIMA della rete: si fotografa lo stato corrente prima di sostituirlo, o
        // un ripristino sbagliato — quello che riporta indietro di tre settimane invece che
        // di tre ore — sarebbe irreversibile quanto l'errore che voleva rimediare.
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
        // `false`: il messaggio di esito l'abbiamo già dato noi, con il conteggio.
        return false;
    });
};

window.creaSnapshotOra = async function() {
    try {
        // Il differito potrebbe non essere ancora sul disco, e lo snapshot fotografa il
        // FILE: senza questo si fotograferebbe lo stato di qualche secondo fa.
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

// ─── Cronologia di UNA scheda (Fase 4.3) ─────────────────────────────────────
//
// La cronologia esisteva solo a livello di intero database: per sapere com'era una scheda la
// settimana scorsa bisognava confrontare due archivi interi e cercare la riga giusta fra le
// altre. Qui il punto d'ingresso è la scheda, e le tappe arrivano già filtrate dal main
// (`snapshots.storiaRecord`), che scarta i momenti in cui quella scheda non è cambiata.
//
// ⚠️ Il ripristino agisce SOLO su questa scheda. È la differenza che giustifica l'esistenza
// della voce: riportare indietro una scheda senza toccare le altre trecento è esattamente
// ciò che il ripristino dell'intero snapshot non sa fare.

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
    const h3 = document.createElement('h3');
    h3.className = 'modal-title';
    h3.innerHTML = '<i data-lucide="history" class="w-5 h-5 text-amber-700"></i>';
    const span = document.createElement('span');
    span.textContent = window.t('rec_history_title', 'Cronologia della scheda') + ': ' + etichetta;
    h3.appendChild(span);
    header.appendChild(h3);
    finestra.appendChild(header);

    const body = document.createElement('div');
    body.className = 'modal-body';
    finestra.appendChild(body);

    const lista = document.createElement('div');
    lista.className = 'tag-manager-list';
    body.appendChild(lista);

    for (let i = 0; i < tappe.length; i++) {
        const t = tappe[i];
        const riga = document.createElement('div');
        riga.className = 'tag-manager-row';

        const col = document.createElement('span');
        col.className = 'tag-manager-name truncate';
        const quando = document.createElement('span');
        quando.textContent = formatRelativeDate(t.creatoIl);
        const stato = document.createElement('span');
        stato.className = 'text-xs text-stone-500 dark:text-stone-400';
        // Una tappa senza record è il momento in cui la scheda ANCORA non esisteva (o non
        // esisteva più): è un'informazione, non un buco da nascondere.
        stato.textContent = '  ·  ' + (t.record
            ? _snEtichettaMotivo(t.motivo)
            : window.t('rec_history_absent', 'scheda non presente'));
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

    const nota = document.createElement('p');
    nota.className = 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-3';
    nota.textContent = window.t('rec_history_hint', 'Le tappe sono ricavate dagli snapshot locali: compaiono solo i momenti in cui questa scheda è cambiata.');
    body.appendChild(nota);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const chiudi = document.createElement('button');
    chiudi.type = 'button';
    chiudi.className = 'btn btn-ghost';
    chiudi.setAttribute('data-modal-cancel', '');
    chiudi.textContent = window.t('btn_close', 'Chiudi');
    chiudi.onclick = () => overlay.remove();
    footer.appendChild(chiudi);
    body.appendChild(footer);

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
}

/**
 * Riporta UNA scheda a una versione passata. Passa dal gestore di annullamento come
 * qualsiasi altra modifica: un ripristino è una modifica, e deve poter essere annullato
 * esattamente come quello che ha rimediato.
 */
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
            // Il record torna indietro nel CONTENUTO, non nel tempo: con il `lastModified`
            // d'allora il primo sync lo rimetterebbe com'era (vedi ripristinaDatabase).
            nuovo.lastModified = Date.now();
            nuovo.modificatoDa = username;
        }
        appData.manoscritti[i] = nuovo;
        if (window.Store) await window.Store.commit();
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
