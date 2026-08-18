// @ts-nocheck

window.pusherInstance = null;
window.pusherChannel = null;

// Pusher non è più caricato staticamente da index.html: lo script CDN veniva scaricato a ogni
// avvio (e falliva offline) anche per vault locali. Lo iniettiamo solo quando serve davvero.
const PUSHER_CDN = 'https://js.pusher.com/8.2.0/pusher.min.js';
let pusherLoadPromise = null;

function caricaPusherSdk() {
    if (window.Pusher) return Promise.resolve(true);
    if (pusherLoadPromise) return pusherLoadPromise;

    pusherLoadPromise = new Promise((resolve) => {
        const tag = document.createElement('script');
        tag.src = PUSHER_CDN;
        tag.async = true;
        tag.onload = () => resolve(!!window.Pusher);
        tag.onerror = () => {
            // Offline o CDN irraggiungibile: il realtime resta spento, il resto dell'app funziona.
            pusherLoadPromise = null;
            console.warn("Impossibile caricare l'SDK Pusher: sincronizzazione realtime disattivata.");
            resolve(false);
        };
        document.head.appendChild(tag);
    });
    return pusherLoadPromise;
}

async function inizializzaRealTime() {
    if (!window.apiBrowser || !window.apiBrowser.getVaultConfig) return;

    const vc = await window.apiBrowser.getVaultConfig();
    const rt = vc.realtime || {};

    // Cleanup precedente se esiste
    if (window.pusherInstance) {
        window.pusherInstance.disconnect();
        window.pusherInstance = null;
    }

    // Se mancano i dati, non attiviamo Pusher
    if (!rt.pusherKey || !rt.pusherCluster || !(vc.sync && vc.sync.driveAutofetch)) {
        return;
    }

    // Inizializza Pusher (SDK caricato on-demand)
    if (!(await caricaPusherSdk())) return;

    window.pusherInstance = new window.Pusher(rt.pusherKey, {
        cluster: rt.pusherCluster
    });

    // Ottieni il path del workspace per creare un ID univoco del canale
    let channelName = "global-updates";
    if (window.apiBrowser) {
        const workspacePath = await window.apiBrowser.getWorkspacePath();
        if (workspacePath) {
            // Un hash semplice o codifica sicura del path per evitare caratteri non validi in Pusher
            // Pusher accetta solo a-z, A-Z, 0-9, - _ = @ , . ;
            channelName = "repo-" + btoa(workspacePath).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
        }
    }

    window.pusherChannel = window.pusherInstance.subscribe(channelName);
    window.currentPusherChannelName = channelName;

    window.pusherChannel.bind('drive-updated', function(data) {
        console.log("Ping ricevuto da Pusher: dati aggiornati su Drive", data);
        
        // Verifica se il ping proviene da noi stessi (evita loop)
        if (data && data.senderId === window.myAppInstanceId) {
            return;
        }

        // Invece di eseguire il merge automatico invasivo, controlla e accende la notifica "In Entrata"
        if (typeof window.controllaModificheInEntrata === 'function') {
            window.controllaModificheInEntrata();
        }
    });
}

// Genera un ID univoco per questa istanza dell'app alla prima apertura
window.myAppInstanceId = window.myAppInstanceId || Math.random().toString(36).substring(2, 15);

document.addEventListener('DOMContentLoaded', () => {
    // Fuori dal percorso critico di avvio: l'SDK viene scaricato solo se la config lo richiede.
    setTimeout(inizializzaRealTime, 1000);
});

// Funzione chiamata da settingsModal.ts quando vengono salvate le impostazioni
window.salvaImpostazioniDrive = async function() {
    if (!window.apiBrowser || !window.apiBrowser.setRealtimeConfig) return;

    const syncAtt = document.getElementById('cloud-drive-sync-attachments');
    const driveAutofetch = document.getElementById('cloud-drive-autofetch').checked;

    // Config realtime (pusher* + autofetch) → modello vault unico.
    await window.apiBrowser.setRealtimeConfig({
        driveAutofetch,
        pusherKey: document.getElementById('cloud-pusher-key').value,
        pusherCluster: document.getElementById('cloud-pusher-cluster').value,
        pusherWebhook: document.getElementById('cloud-pusher-webhook').value
    });

    // syncAttachments resta una preferenza globale.
    if (syncAtt && window.apiSettings) {
        const settings = await window.apiSettings.get() || {};
        settings.syncAttachments = syncAtt.checked;
        await window.apiSettings.save(settings);
    }

    // Riavvia Realtime
    if(driveAutofetch) {
        inizializzaRealTime();
    } else {
        if(window.pusherInstance) {
            window.pusherInstance.disconnect();
            window.pusherInstance = null;
            console.log("Pusher disconnesso (Auto-Sync disattivato)");
        }
    }
    
    mostraMessaggio(window.t("msg_impostazioni_cloud_salvat", "Impostazioni Cloud Salvate"), "success");
};

// Popola i campi all'avvio
window.caricaImpostazioniDriveUI = async function() {
    if (!window.apiBrowser || !window.apiBrowser.getVaultConfig) return;
    const vc = await window.apiBrowser.getVaultConfig();
    const rt = vc.realtime || {};

    const checkAutofetch = document.getElementById('cloud-drive-autofetch');
    if(checkAutofetch) checkAutofetch.checked = !!(vc.sync && vc.sync.driveAutofetch);

    // syncAttachments resta globale.
    const syncAtt = document.getElementById('cloud-drive-sync-attachments');
    if(syncAtt && window.apiSettings) {
        const settings = await window.apiSettings.get() || {};
        syncAtt.checked = !!settings.syncAttachments;
    }

    const inputKey = document.getElementById('cloud-pusher-key');
    if(inputKey) inputKey.value = rt.pusherKey || "";

    const inputCluster = document.getElementById('cloud-pusher-cluster');
    if(inputCluster) inputCluster.value = rt.pusherCluster || "";

    const inputWebhook = document.getElementById('cloud-pusher-webhook');
    if(inputWebhook) inputWebhook.value = rt.pusherWebhook || "";
};

// Quando si apre il modale delle impostazioni, si chiama popolaImpostazioniDrive
const originalApriImpostazioni = window.apriImpostazioni;
window.apriImpostazioni = function() {
    if (typeof originalApriImpostazioni === 'function') originalApriImpostazioni();
    setTimeout(() => {
        if (typeof window.popolaImpostazioniDrive === 'function') {
            window.popolaImpostazioniDrive();
        } else if (typeof window.caricaImpostazioniDriveUI === 'function') {
            window.caricaImpostazioniDriveUI();
        }
    }, 100);
};
