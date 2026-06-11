// @ts-nocheck

window.Store = {
    get manoscritti() { return appData?.manoscritti || []; },
    get cartelle() { return appData?.cartelle || []; },
    get tipiDocumento() { return appData?.tipiDocumento || []; },
    get deletedIds() { return appData?.deletedIds || []; },
    get deletedCartelle() { return appData?.deletedCartelle || []; },

    async commit() {
        if (typeof window.salvaTutto === 'function') await window.salvaTutto();
        if (typeof window.normalizzaCartelle === 'function') window.normalizzaCartelle();
        if (typeof window.renderSidebar === 'function') window.renderSidebar();
        if (typeof window.renderMain === 'function') window.renderMain();
    },

    async addManoscritto(m) {
        appData.manoscritti.push(m);
        await this.commit();
    },

    async updateManoscritto(id, updates) {
        const index = appData.manoscritti.findIndex(x => String(x.id) === String(id));
        if (index !== -1) {
            appData.manoscritti[index] = { ...appData.manoscritti[index], ...updates };
            await this.commit();
        }
    },

    async deleteManoscritto(id) {
        const index = appData.manoscritti.findIndex(x => String(x.id) === String(id));
        if (index !== -1) {
            appData.manoscritti.splice(index, 1);
            if (!appData.deletedIds) appData.deletedIds = [];
            if (!appData.deletedIds.includes(String(id))) appData.deletedIds.push(String(id));
            await this.commit();
        }
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
            // Move items to Generale
            appData.manoscritti.forEach(m => {
                if (m.cartella === nome) m.cartella = 'Generale';
                else if (m.cartella && m.cartella.startsWith(nome + '/')) m.cartella = 'Generale';
            });
            await this.commit();
        }
    },
    
    async rinominaCartella(vecchioNome, nuovoNome) {
        const index = appData.cartelle.indexOf(vecchioNome);
        if (index !== -1) {
            appData.cartelle[index] = nuovoNome;
            // Update items
            appData.manoscritti.forEach(m => {
                if (m.cartella === vecchioNome) m.cartella = nuovoNome;
                else if (m.cartella && m.cartella.startsWith(vecchioNome + '/')) {
                    m.cartella = m.cartella.replace(vecchioNome + '/', nuovoNome + '/');
                }
            });
            // Update subfolders
            appData.cartelle.forEach((c, i) => {
                if (c.startsWith(vecchioNome + '/')) {
                    appData.cartelle[i] = c.replace(vecchioNome + '/', nuovoNome + '/');
                }
            });
            
            // Manage tombstones
            if (!appData.deletedCartelle) appData.deletedCartelle = [];
            if (!appData.deletedCartelle.includes(vecchioNome)) appData.deletedCartelle.push(vecchioNome);
            
            await this.commit();
        }
    }
};
