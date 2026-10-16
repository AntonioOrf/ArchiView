window.statoCloud = {
    vaultCloud: false,
    autenticato: false,
    inEntrata: false,
    pendenti: false,
    occupato: false,
    errore: null
};

function _contaInEntrata() {
    const record = (window.incomingChanges || []).length;
    const strutturali = (window.incomingStructuralChanges || []).length;
    return record + strutturali;
}

function _contaPendenti() {
    if (typeof appData === 'undefined' || !appData.manoscritti) return 0;
    const loadedAt = window.ultimoCaricamento || 0;
    return appData.manoscritti.filter(m => (m.lastModified || 0) > loadedAt).length;
}

window.calcolaStatoCloud = function() {
    const s = window.statoCloud;

    if (!s.vaultCloud) {
        return { chiave: 'locale', label: window.t('cloud_state_local_only', 'Solo locale'), icona: 'cloud-off' };
    }
    if (s.occupato) {
        return { chiave: 'occupato', label: window.t('cloud_state_syncing', 'Sincronizzazione…'), icona: 'refresh-cw', spin: true };
    }
    if (navigator.onLine === false) {
        return { chiave: 'offline', label: window.t('cloud_state_offline', 'Offline'), icona: 'wifi-off' };
    }
    if (s.errore) {
        return { chiave: 'errore', label: window.t('cloud_state_error', 'Errore di sincronizzazione'), icona: 'cloud-alert' };
    }
    if (!s.autenticato) {
        return { chiave: 'disconnesso', label: window.t('cloud_state_disconnected', 'Non connesso'), icona: 'cloud-off' };
    }
    if (s.inEntrata) {
        const n = _contaInEntrata();
        const label = n > 0
            ? window.t('cloud_state_incoming_n', '{var0} in entrata').replace('{var0}', String(n))
            : window.t('cloud_state_incoming', 'Aggiornamenti in entrata');
        return { chiave: 'entrata', label, icona: 'cloud-download' };
    }
    if (s.pendenti) {
        const n = _contaPendenti();
        const label = n > 0
            ? window.t('cloud_state_pending_n', '{var0} da inviare').replace('{var0}', String(n))
            : window.t('cloud_state_pending', 'Modifiche locali da inviare');
        return { chiave: 'pendenti', label, icona: 'cloud-upload' };
    }
    return { chiave: 'ok', label: window.t('cloud_state_synced', 'Sincronizzato'), icona: 'cloud-check' };
};

function avviaConnessioneCloud() {
    if (typeof window.connettiAccountCloud === 'function') return window.connettiAccountCloud();
    if (typeof window.apriCloudModal === 'function') return window.apriCloudModal();
}

window.azionePrincipaleCloud = function(chiave) {
    switch (chiave) {
        case 'locale':
            return { label: window.t('cloud_action_enable_short', 'Attiva cloud'), icon: 'cloud-cog', onSelect: () => window.apriCloudModal && window.apriCloudModal() };
        case 'disconnesso':
            return { label: window.t('cloud_action_connect_short', 'Connetti'), icon: 'cloud-cog', onSelect: () => avviaConnessioneCloud() };
        case 'errore':
            return { label: window.t('cloud_action_retry', 'Riprova'), icon: 'refresh-cw', onSelect: () => window.controllaModificheInEntrata(true) };
        case 'entrata':
            return { label: window.t('cloud_action_receive', 'Ricevi'), icon: 'cloud-download', onSelect: () => window.scaricaDalCloud() };
        case 'pendenti':
            return { label: window.t('cloud_action_send', 'Invia'), icon: 'cloud-upload', onSelect: () => window.caricaSulCloud() };
        case 'ok':
            return { label: window.t('cloud_action_check', 'Controlla'), icon: 'refresh-cw', onSelect: () => window.controllaModificheInEntrata(true) };
        default:
            return null;
    }
};

function scambiaIcona(idIcona, nome, spin) {
    const icona = document.getElementById(idIcona);
    if (!icona) return;
    const classe = 'w-4 h-4 shrink-0' + (spin ? ' animate-spin' : '');
    if (icona.dataset.icona === nome) {
        icona.classList.toggle('animate-spin', !!spin);
        return;
    }
    const nuovo = document.createElement('i');
    nuovo.id = idIcona;
    nuovo.dataset.icona = nome;
    nuovo.setAttribute('data-lucide', nome);
    nuovo.className = classe;
    const genitore = icona.parentElement;
    icona.replaceWith(nuovo);
    if (window.lucide && genitore) lucide.createIcons({ nodes: [genitore] });
}

function aggiornaAzionePrincipale(chiave) {
    const btn = document.getElementById('cloud-primary-action');
    const label = document.getElementById('cloud-primary-action-label');
    if (!btn || !label) return;

    const azione = window.azionePrincipaleCloud(chiave);
    btn.style.display = azione ? 'inline-flex' : 'none';
    if (!azione) return;

    label.textContent = azione.label;
    btn.title = azione.label;
    btn.setAttribute('aria-label', azione.label);
    btn.onclick = azione.onSelect;
    scambiaIcona('cloud-primary-action-icon', azione.icon, false);
}


window.aggiornaCloudStatus = function() {
    const btn = document.getElementById('cloud-status-btn');
    const label = document.getElementById('cloud-status-label');
    if (!btn || !label) return;

    const stato = window.calcolaStatoCloud();
    label.textContent = stato.label;
    btn.dataset.stato = stato.chiave;
    btn.title = stato.label + ' — ' + window.t('cloud_click_hint', 'clicca per le azioni di sincronizzazione');
    btn.setAttribute('aria-label', window.t('tooltip_cloud_sync', 'Sincronizzazione cloud') + ': ' + stato.label);
    aggiornaAzionePrincipale(stato.chiave);


    scambiaIcona('cloud-status-icon', stato.icona, stato.spin);
};

window.impostaErroreCloud = function(messaggio) {
    window.statoCloud.errore = messaggio || window.t('cloud_state_error', 'Errore di sincronizzazione');
    window.aggiornaCloudStatus();
};

window.azzeraErroreCloud = function() {
    if (!window.statoCloud.errore) return;
    window.statoCloud.errore = null;
    window.aggiornaCloudStatus();
};

window.apriPopoverCloud = function(btn) {
    const s = window.statoCloud;
    const stato = window.calcolaStatoCloud();
    const voci: any[] = [{ heading: true, label: stato.label }];

    if (!s.vaultCloud) {
        voci.push({
            label: window.t('cloud_action_enable', 'Attiva il cloud per questo archivio'),
            icon: 'cloud-cog',
            onSelect: () => { if (typeof window.apriCloudModal === 'function') window.apriCloudModal(); }
        });
        window.apriMenuContestuale(btn, voci);
        return;
    }

    if (s.errore) {
        voci.push({ heading: true, label: s.errore, sottotitolo: true });
    }

    const bloccato = s.occupato || !s.autenticato;
    const motivo = s.occupato
        ? window.t('cloud_busy_hint', 'Sincronizzazione in corso')
        : (!s.autenticato ? window.t('cloud_disconnected_hint', 'Account cloud non connesso') : undefined);

    voci.push({ label: window.t('cloud_action_fetch', 'Controlla aggiornamenti'), icon: 'refresh-cw', disabled: bloccato, title: motivo, onSelect: () => window.controllaModificheInEntrata(true) });
    voci.push({ label: window.t('btn_pull', 'Scarica'), icon: 'cloud-download', disabled: bloccato, title: motivo, onSelect: () => window.scaricaDalCloud() });
    voci.push({ label: window.t('btn_push', 'Carica'), icon: 'cloud-upload', disabled: bloccato, title: motivo, onSelect: () => window.caricaSulCloud() });

    if (!s.autenticato) {
        voci.push({ separator: true });
        voci.push({
            label: window.t('cloud_action_connect', 'Connetti account cloud'),
            icon: 'cloud-cog',
            onSelect: () => avviaConnessioneCloud()
        });
    }

    voci.push({ separator: true });
    voci.push({
        label: window.t('cloud_action_view_changes', 'Vedi modifiche'),
        icon: 'git-pull-request',
        onSelect: () => { if (typeof window.apriSidebarTab === 'function') window.apriSidebarTab('source-control'); }
    });
    voci.push({
        label: window.t('cloud_action_history', 'Storico versioni'),
        icon: 'history',
        onSelect: () => { if (typeof window.apriSidebarTab === 'function') window.apriSidebarTab('history'); }
    });

    window.apriMenuContestuale(btn, voci);
};

document.addEventListener('DOMContentLoaded', () => {
    window.aggiornaCloudStatus();
    window.addEventListener('online', () => window.aggiornaCloudStatus());
    window.addEventListener('offline', () => window.aggiornaCloudStatus());
});
