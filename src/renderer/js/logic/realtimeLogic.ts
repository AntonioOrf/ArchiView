// Notifiche realtime dei vault Hub (S6 in REVIEW-SECURITY.md).
//
// Dopo ogni push riuscito è il Worker a pubblicare `hub-updated {version}` sul canale privato
// `private-repo-<repoId>`. Iscriversi richiede una firma che il Worker rilascia solo a chi ha una
// chiave del repo: la chiede il main (canale IPC hub-realtime-auth), la repoKey non entra qui.
// Nessun ping dal client: i vault Drive non hanno più realtime e restano sul controllo periodico,
// come l'Hub quando Pusher non è raggiungibile.
window.pusherInstance = null;

// SDK vendorizzato (pusher-js 8.6.0), caricato solo per i vault Hub: niente script remoti.
const PUSHER_SDK = 'vendor/pusher.min.js';
let pusherLoadPromise = null;

function caricaPusherSdk() {
    if (window.Pusher) return Promise.resolve(true);
    if (pusherLoadPromise) return pusherLoadPromise;

    pusherLoadPromise = new Promise((resolve) => {
        const tag = document.createElement('script');
        tag.src = PUSHER_SDK;
        tag.async = true;
        tag.onload = () => resolve(!!window.Pusher);
        tag.onerror = () => {
            pusherLoadPromise = null;
            console.warn("SDK Pusher non caricato: notifiche realtime disattivate.");
            resolve(false);
        };
        document.head.appendChild(tag);
    });
    return pusherLoadPromise;
}

function fermaRealtimeHub() {
    if (window.pusherInstance) {
        window.pusherInstance.disconnect();
        window.pusherInstance = null;
    }
}

// Chiamata da avviaAutofetchHub: stessa preferenza (autofetchEnabled) e stesso ciclo di vita.
window.avviaRealtimeHub = async function() {
    fermaRealtimeHub();
    const cfg = window.hubConfig;
    if (!cfg || !cfg.repoId || !cfg.pusherKey || !cfg.pusherCluster || !window.apiBrowser?.hubRealtimeAuth) return;
    try {
        const settings = window.apiSettings ? await window.apiSettings.get() : {};
        if (settings && settings.autofetchEnabled === false) return;
    } catch { /* impostazioni illeggibili: vale il default (attivo) */ }

    if (!(await caricaPusherSdk())) return;
    // Il vault può essere cambiato mentre l'SDK si caricava.
    if (window.hubConfig !== cfg) return;

    const canale = `private-repo-${cfg.repoId}`;
    window.pusherInstance = new window.Pusher(cfg.pusherKey, {
        cluster: cfg.pusherCluster,
        forceTLS: true,
        // Solo WebSocket: niente fallback che scaricano script da CDN (bloccati dalla CSP).
        enabledTransports: ['ws'],
        channelAuthorization: {
            customHandler: async ({ socketId, channelName }, callback) => {
                try {
                    const r = await window.apiBrowser.hubRealtimeAuth(socketId, channelName);
                    if (r && r.ok && r.data && r.data.auth) callback(null, { auth: r.data.auth });
                    else callback(new Error((r && r.error) || 'Autorizzazione realtime negata'), null);
                } catch (e) {
                    callback(e, null);
                }
            }
        }
    });

    const channel = window.pusherInstance.subscribe(canale);
    channel.bind('pusher:subscription_error', (e) => {
        // 401 = chiave revocata, 503 = realtime non configurato: resta il controllo periodico.
        console.warn("Iscrizione realtime Hub rifiutata:", e && (e.status || e.error));
    });
    channel.bind('hub-updated', async (data) => {
        // Se il push è nostro e ancora in volo, la versione locale si aggiorna alla sua risposta.
        if (window.hubPushInCorso) await window.hubPushInCorso.catch(() => {});
        const locale = window.hubConfig && window.hubConfig.version;
        // Il proprio push (o una versione già ricevuta) non è una novità.
        if (data && typeof data.version === 'number' && typeof locale === 'number' && data.version <= locale) return;
        // Solo notifica, come l'autofetch: il merge resta un'azione dell'utente.
        if (typeof window.controllaModificheHub === 'function') window.controllaModificheHub(false);
    });
};
