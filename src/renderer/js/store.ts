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
        const prima = appData.manoscritti.length;
        appData.manoscritti = appData.manoscritti.filter(m => !morti.has(String(m.id)));
        if (appData.manoscritti.length === prima) return;
        const tombstone = new Set((appData.deletedIds || []).map(String));
        for (const id of morti) tombstone.add(id);
        appData.deletedIds = Array.from(tombstone);
        const adesso = Date.now();
        for (const m of appData.manoscritti) {
            const restanti = window.Model.relazioni(m).filter(r => !morti.has(r.id));
            if (window.Model.scriviRelazioni(m, restanti)) m.lastModified = adesso;
        }
        await this.commit();
    },

    togliTombstone(ids) {
        if (!Array.isArray(appData.deletedIds)) return;
        const vivi = new Set((ids || []).map(String));
        appData.deletedIds = appData.deletedIds.filter(x => !vivi.has(String(x)));
    },

    async addCartella(nome) {
        if (!appData.cartelle.includes(nome)) {
            appData.cartelle.push(nome);
            await this.commit();
        }
    },

    async deleteCartella(nome) {
        const index = appData.cartelle.indexOf(nome);
        if (index !== -1) {
            appData.cartelle.splice(index, 1);
            if (!appData.deletedCartelle) appData.deletedCartelle = [];
            if (!appData.deletedCartelle.includes(nome)) appData.deletedCartelle.push(nome);
            appData.manoscritti.forEach(m => {
                if (m.cartella === nome) m.cartella = '';
                else if (m.cartella && m.cartella.startsWith(nome + '/')) m.cartella = '';
            });
            await this.commit();
        }
    },
    
    async rinominaCartella(vecchioNome, nuovoNome) {
        const index = appData.cartelle.indexOf(vecchioNome);
        if (index !== -1) {
            appData.cartelle[index] = nuovoNome;
            appData.manoscritti.forEach(m => {
                if (m.cartella === vecchioNome) m.cartella = nuovoNome;
                else if (m.cartella && m.cartella.startsWith(vecchioNome + '/')) {
                    m.cartella = m.cartella.replace(vecchioNome + '/', nuovoNome + '/');
                }
            });
            appData.cartelle.forEach((c, i) => {
                if (c.startsWith(vecchioNome + '/')) {
                    appData.cartelle[i] = c.replace(vecchioNome + '/', nuovoNome + '/');
                }
            });
            
            if (!appData.deletedCartelle) appData.deletedCartelle = [];
            if (!appData.deletedCartelle.includes(vecchioNome)) appData.deletedCartelle.push(vecchioNome);
            
            await this.commit();
        }
    }
};
