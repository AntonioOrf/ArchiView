window.pusherInstance = null;

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

window.avviaRealtimeHub = async function() {
    fermaRealtimeHub();
    const cfg = window.hubConfig;
    if (!cfg || !cfg.repoId || !cfg.pusherKey || !cfg.pusherCluster || !window.apiBrowser?.hubRealtimeAuth) return;
    try {
        const settings = window.apiSettings ? await window.apiSettings.get() : {};
        if (settings && settings.autofetchEnabled === false) return;
    } catch {}

    if (!(await caricaPusherSdk())) return;
    if (window.hubConfig !== cfg) return;

    const canale = `private-repo-${cfg.repoId}`;
    window.pusherInstance = new window.Pusher(cfg.pusherKey, {
        cluster: cfg.pusherCluster,
        forceTLS: true,
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
        console.warn("Iscrizione realtime Hub rifiutata:", e && (e.status || e.error));
    });
    channel.bind('hub-updated', async (data) => {
        if (window.hubPushInCorso) await window.hubPushInCorso.catch(() => {});
        const locale = window.hubConfig && window.hubConfig.version;
        if (data && typeof data.version === 'number' && typeof locale === 'number' && data.version <= locale) return;
        if (typeof window.controllaModificheHub === 'function') window.controllaModificheHub(false);
    });
};
