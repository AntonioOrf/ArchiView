// @ts-nocheck

window.pusherInstance = null;
window.pusherChannel = null;

async function inizializzaRealTime() {
    if (!window.apiSettings) return;

    const settings = await window.apiSettings.get();
    
    // Cleanup precedente se esiste
    if (window.pusherInstance) {
        window.pusherInstance.disconnect();
        window.pusherInstance = null;
    }

    // Se mancano i dati, non attiviamo Pusher
    if (!settings.pusherKey || !settings.pusherCluster || !settings.driveAutofetch) {
        return;
    }

    // Inizializza Pusher
    window.pusherInstance = new Pusher(settings.pusherKey, {
        cluster: settings.pusherCluster
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
    // Aspetta che le librerie esterne siano caricate
    setTimeout(inizializzaRealTime, 1000);
});

// Funzione chiamata da settingsModal.ts quando vengono salvate le impostazioni
window.salvaImpostazioniDrive = async function() {
    if (!window.apiSettings) return;
    const settings = await window.apiSettings.get() || {};
    
    const syncAtt = document.getElementById('cloud-drive-sync-attachments');
    
    settings.driveAutofetch = document.getElementById('cloud-drive-autofetch').checked;
    if (syncAtt) settings.syncAttachments = syncAtt.checked;
    settings.pusherKey = document.getElementById('cloud-pusher-key').value;
    settings.pusherCluster = document.getElementById('cloud-pusher-cluster').value;
    settings.pusherWebhook = document.getElementById('cloud-pusher-webhook').value;
    
    await window.apiSettings.save(settings);
    
    // Riavvia Realtime
    if(settings.driveAutofetch) {
        avviaPusherRealtime();
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
    if (!window.apiSettings) return;
    const settings = await window.apiSettings.get() || {};
    
    const checkAutofetch = document.getElementById('cloud-drive-autofetch');
    if(checkAutofetch) checkAutofetch.checked = !!settings.driveAutofetch;
    
    const syncAtt = document.getElementById('cloud-drive-sync-attachments');
    if(syncAtt) syncAtt.checked = !!settings.syncAttachments;
    
    const inputKey = document.getElementById('cloud-pusher-key');
    if(inputKey) inputKey.value = settings.pusherKey || "";
    
    const inputCluster = document.getElementById('cloud-pusher-cluster');
    if(inputCluster) inputCluster.value = settings.pusherCluster || "";
    
    const inputWebhook = document.getElementById('cloud-pusher-webhook');
    if(inputWebhook) inputWebhook.value = settings.pusherWebhook || "";
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
