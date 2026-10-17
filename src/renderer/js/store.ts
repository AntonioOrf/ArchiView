window.Store = {
    get manoscritti() { return appData?.manoscritti || []; },
    get cartelle() { return appData?.cartelle || []; },
    get tipiDocumento() { return appData?.tipiDocumento || []; },
    get deletedIds() { return appData?.deletedIds || []; },
    get deletedCartelle() { return appData?.deletedCartelle || []; },

    async commit() {
        if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
        if (typeof window.normalizzaCartelle === 'function') window.normalizzaCartelle();
        if (typeof window.renderSidebar === 'function') window.renderSidebar();
        if (typeof window.renderMain === 'function') window.renderMain();
        if (typeof window.salvaTuttoDifferito === 'function') window.salvaTuttoDifferito();
        else if (typeof window.salvaTutto === 'function') await window.salvaTutto();
    },

    async addManoscritto(m) {
        appData.manoscritti.push(m);
        await this.commit();
    },

    async updateManoscritto(id, updates) {
        const index = appData.manoscritti.findIndex(x => String(x.id) === String(id));
        if (index !== -1) {
            const fuso = { ...appData.manoscritti[index], ...updates };
            for (const chiave of Object.keys(updates || {})) {
                if (updates[chiave] === undefined) delete fuso[chiave];
            }
            appData.manoscritti[index] = fuso;
            await this.commit();
        }
    },

    async deleteManoscritto(id) {
        await this.eliminaSchede([id]);
    },

    async eliminaSchede(ids) {
        const morti = new Set<string>((ids || []).map(String));
        const rimandi = this.rimandiVerso(ids);
        const prima = appData.manoscritti.length;
        appData.manoscritti = appData.manoscritti.filter(m => !morti.has(String(m.id)));
        if (appData.manoscritti.length === prima) return [];
        const tombstone = new Set((appData.deletedIds || []).map(String));
        for (const id of morti) tombstone.add(id);
        appData.deletedIds = Array.from(tombstone);
        const adesso = Date.now();
        for (const m of appData.manoscritti) {
            const restanti = window.Model.relazioni(m).filter(r => !morti.has(r.id));
            if (window.Model.scriviRelazioni(m, restanti)) m.lastModified = adesso;
        }
        await this.commit();
        return rimandi;
    },

    rimandiVerso(ids) {
        const morti = new Set<string>((ids || []).map(String));
        const rimandi = [];
        for (const m of appData.manoscritti) {
            if (morti.has(String(m.id))) continue;
            for (const r of window.Model.relazioni(m)) if (morti.has(String(r.id))) rimandi.push({ da: m.id, relazione: r });
        }
        return rimandi;
    },

    rimettiRimandi(rimandi) {
        const adesso = Date.now();
        for (const { da, relazione } of rimandi || []) {
            const m = appData.manoscritti.find(x => String(x.id) === String(da));
            if (!m) continue;
            const attuali = window.Model.relazioni(m);
            if (attuali.some(r => r.id === relazione.id && r.tipo === relazione.tipo)) continue;
            if (window.Model.scriviRelazioni(m, [...attuali, relazione])) m.lastModified = adesso;
        }
    },

    togliTombstone(ids) {
        if (!Array.isArray(appData.deletedIds)) return;
        const vivi = new Set((ids || []).map(String));
        appData.deletedIds = appData.deletedIds.filter(x => !vivi.has(String(x)));
    }
};
