window.Store = {
    get manoscritti() { return appData?.manoscritti || []; },
    get cartelle() { return appData?.cartelle || []; },
    get tipiDocumento() { return appData?.tipiDocumento || []; },
    get deletedIds() { return appData?.deletedIds || []; },
    get deletedCartelle() { return appData?.deletedCartelle || []; },

    // Render prima, disco dopo: la scrittura dell'intero DB non deve stare tra il click
    // dell'utente e l'aggiornamento della UI. Il salvataggio è differito e coalescente
    // (vedi state.ts); i flussi che leggono il file dal disco chiamano flushSalvataggio().
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

    /**
     * ⚠️ `undefined` in `updates` significa **togli la chiave**, non "lasciala com'era".
     *
     * L'aggiornamento è un merge, e un merge non sa esprimere una cancellazione: la chiave
     * semplicemente assente dal patch resta quella vecchia. Sui campi normali va bene — un
     * campo svuotato diventa `''`, che è un valore — ma le chiavi che esistono solo quando
     * hanno contenuto non hanno un "valore vuoto" da scrivere: `relazioni` (3.5) si cancella
     * proprio togliendo la chiave, per non cambiare l'impronta di ogni scheda mai collegata.
     * Senza questa regola, togliere l'ULTIMO collegamento di una scheda non aveva effetto e
     * il rimando ricompariva al primo ridisegno.
     */
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

    /**
     * Unico punto che elimina schede (singola, selezione, cartella, ripetizione): toglie i
     * record, mette i tombstone e toglie dalle altre schede i rimandi verso quelle eliminate.
     * ⚠️ Non contraddice la regola "un id sconosciuto non si ripulisce": quella vale per un id
     * che NON si sa che fine abbia fatto (su un archivio condiviso la scheda può esistere sulla
     * copia di un collega). Qui l'eliminazione è esplicita e produce un tombstone: la scheda è
     * morta per tutti, e lasciare i rimandi vorrebbe dire collegamenti che non portano da
     * nessuna parte, con lo stesso aspetto di quelli buoni (Fase 3.5).
     */
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

    /** Gli id tornano vivi (ripristino, reimport): via dai tombstone, o la sync li ricancella. Non salva. */
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
            // Gli orfani tornano nella radice virtuale
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
