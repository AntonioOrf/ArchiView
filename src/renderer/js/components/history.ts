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
    menu.appendChild(menuItem('git-compare', 'Confronta con ora', '#93c5fd',
        () => apriDiffRevisioneCloud(fileId, rev.id, label)));

    // Separatore
    if (!isCurrent) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
        menu.appendChild(sep);

        menu.appendChild(menuItem('rotate-ccw', 'Ripristina a questa versione', '#fca5a5',
            () => ripristinaRevisioneConConferma(fileId, rev.id, label)));
    }

    // Separatore + Annulla
    const sep2 = document.createElement('div');
    sep2.style.cssText = 'height: 1px; background: #292524; margin: 4px 0;';
    menu.appendChild(sep2);

    menu.appendChild(menuItem('x', 'Annulla', '#78716c', () => {}));

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

window.renderHistoryList = async function() {
    const list = document.getElementById('history-list');
    if (!list) return;

    // Controllo se connesso
    if (!window.driveStatus || !window.driveStatus.isAuthenticated) {
        list.innerHTML = `
            <li class="p-6 text-center flex flex-col items-center gap-3">
                <i data-lucide="cloud-off" class="w-8 h-8 text-stone-300"></i>
                <span class="text-xs text-stone-400 italic">Connettiti a Google Drive per vedere lo storico.</span>
            </li>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Loader
    list.innerHTML = `
        <li class="p-6 text-center flex flex-col items-center gap-3">
            <div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-stone-400 italic">Caricamento storico...</span>
        </li>`;

    try {
        const { fileId, revisions } = await window.elencaRevisioniCloud();
        window._historyFileId = fileId;

        if (!revisions || revisions.length === 0) {
            list.innerHTML = `<li class="p-4 text-xs text-stone-400 italic text-center">Nessuna revisione trovata. Carica almeno una volta sul Cloud.</li>`;
            return;
        }

        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Istruzione contestuale
        const hint = document.createElement('li');
        hint.className = 'px-3 py-2 text-[10px] text-stone-400 italic bg-stone-50 dark:bg-stone-800/30 border-b border-stone-100 dark:border-stone-800/50';
        hint.textContent = 'Clicca su una versione per confrontare o ripristinare.';
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
            li.title = 'Clicca per le azioni disponibili';

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
};

// ─── Confronta una revisione con lo stato attuale ───────────────────────────

async function apriDiffRevisioneCloud(fileId, revisionId, label) {
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_caricamento_revisione", "Caricamento revisione..."), "info");
    try {
        const revDb = await window.caricaRevisioneCloud(fileId, revisionId);
        if (!revDb || !revDb.manoscritti) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_revisione_vuota_o_non_val", "Revisione vuota o non valida."), "warning");
            return;
        }

        const revMap = {};
        revDb.manoscritti.forEach(m => { revMap[m.id] = m; });
        const curMap = {};
        (appData.manoscritti || []).forEach(m => { curMap[m.id] = m; });

        const allIds = new Set([...Object.keys(revMap), ...Object.keys(curMap)]);
        const diffs = [];
        for (const id of allIds) {
            const revM = revMap[id] || {};
            const curM = curMap[id] || {};
            if (JSON.stringify(revM) !== JSON.stringify(curM)) {
                diffs.push({ revM, curM, id });
            }
        }

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

function apriDiffRevisioneModal(diffs, label) {
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
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;';

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
                            <div style="font-size:0.6rem;font-weight:700;color:#f87171;margin-bottom:4px;">NELLA REVISIONE</div>
                            <div style="font-size:0.8rem;color:${isDark?'#a8a29e':'#57534e'};white-space:pre-wrap;word-break:break-word;">${escapeHTML(prima)}</div>
                        </div>
                        <div style="flex:1;padding:0.6rem;background:${greenBg};">
                            <div style="font-size:0.6rem;font-weight:700;color:#4ade80;margin-bottom:4px;">VERSIONE ATTUALE</div>
                            <div style="font-size:0.8rem;color:${isDark?'#a8a29e':'#57534e'};white-space:pre-wrap;word-break:break-word;">${escapeHTML(dopo)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        if (!htmlDiff) htmlDiff = `<p style="font-size:0.8rem;color:${textMuted};text-align:center;padding:2rem;">Nessuna differenza nei campi visibili.</p>`;
        body.innerHTML = htmlDiff;

        const close = () => overlay.remove();
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
            await window.ripristinaRevisioneCloud(fileId, revisionId);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_vault_ripristinato_alla_v", "✅ Vault ripristinato alla versione selezionata!"), "success");
            if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
        } catch (err) {
            console.error("Errore ripristino:", err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_il_riprist", "Errore durante il ripristino: ") + err.message, "error");
        } finally {
            if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(false);
        }
    };
}
