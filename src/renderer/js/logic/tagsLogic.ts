function _tgT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

async function _tgAutore() {
    try {
        const settings = await window.apiSettings.get();
        return settings.username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
        return 'Anonimo';
    }
}

function _tgFotografia(chiavi) {
    const set = new Set((chiavi || []).map(c => window.Model.chiaveTag(c)).filter(Boolean));
    const schede: any[] = [];
    for (const m of appData.manoscritti || []) {
        for (const t of window.Model.tags(m)) {
            if (!set.has(window.Model.chiaveTag(t))) continue;
            schede.push(JSON.parse(JSON.stringify(m)));
            break;
        }
    }
    return { schede, anagrafica: JSON.parse(JSON.stringify(window.Model.anagraficaTag(appData))) };
}

async function _tgApplica(descrizione, messaggio, schedeToccate, foto) {
    if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    await window.Store.commit();

    const ripristina = async () => {
        ripristinaSchede(foto.schede);
        appData.tagsAnagrafica = JSON.parse(JSON.stringify(foto.anagrafica));
        await window.Store.commit();
    };

    registraAnnullabile(descrizione, String(messaggio).replace('{var0}', String(schedeToccate)), ripristina);
}

function _tgSegui(da, a) {
    if (!window.activeTags || window.activeTags.size === 0) return;
    const vecchia = window.Model.chiaveTag(da);
    const nuovi = new Set();
    let cambiato = false;
    for (const t of window.activeTags) {
        if (window.Model.chiaveTag(t) === vecchia) { cambiato = true; if (a) nuovi.add(a); }
        else nuovi.add(t);
    }
    if (!cambiato) return;
    window.activeTags.clear();
    for (const t of nuovi) window.activeTags.add(t);
}

window.registraTagUsati = function(tags) {
    return window.Model.registraTag(appData, tags);
};

window.rinominaTagArchivio = async function(da, a) {
    const foto = _tgFotografia([da, a]);
    const esito = window.Model.rinominaTag(appData, da, a, { autore: await _tgAutore() });
    if (!esito.cambiato) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_tgT('msg_tag_nothing', 'Nessuna scheda modificata.'), 'info');
        return 0;
    }
    _tgSegui(da, a);
    await _tgApplica(
        _tgT('undo_tag_rename', 'Rinomina di un tag'),
        _tgT('msg_tag_renamed', 'Tag rinominato su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.fondiTagArchivio = async function(sorgenti, destinazione) {
    const lista = window.Model.listaTag(sorgenti);
    const foto = _tgFotografia(lista.concat([destinazione]));
    const esito = window.Model.fondiTag(appData, lista, destinazione, { autore: await _tgAutore() });
    if (!esito.cambiato) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_tgT('msg_tag_nothing', 'Nessuna scheda modificata.'), 'info');
        return 0;
    }
    for (const s of lista) _tgSegui(s, destinazione);
    await _tgApplica(
        _tgT('undo_tag_merge', 'Fusione di tag'),
        _tgT('msg_tag_merged', 'Tag fusi su {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.eliminaTagArchivio = async function(tag) {
    const foto = _tgFotografia([tag]);
    const esito = window.Model.eliminaTag(appData, tag, { autore: await _tgAutore() });
    if (!esito.cambiato) return 0;
    _tgSegui(tag, null);
    await _tgApplica(
        _tgT('undo_tag_delete', 'Eliminazione di un tag'),
        _tgT('msg_tag_deleted', 'Tag rimosso da {var0} schede.'),
        esito.schede,
        foto
    );
    return esito.schede;
};

window.impostaColoreTagArchivio = async function(tag, colore) {
    if (!window.Model.impostaColoreTag(appData, tag, colore)) return false;
    await window.Store.commit();
    return true;
};

window.classeColoreTag = function(tag) {
    const colore = window.Model.coloreTag(appData, tag);
    return colore ? 'card-tag tag-col-' + colore : 'card-tag';
};

window.chipTagHTML = function(tag) {
    return '<span class="' + window.classeColoreTag(tag) + '" data-tag="' + escapeHTML(tag) + '">' + escapeHTML(tag) + '</span>';
};

window.aggiornaChipTagForm = function() {
    const box = document.getElementById('form-tags-chip');
    const campo = document.getElementById('form-tags') as HTMLInputElement | null;
    if (!box || !campo) return;
    box.innerHTML = window.sanitizeHTML(window.Model.tags({ tags: campo.value }).map(t => window.chipTagHTML(t)).join(''));
};

window.apriMenuColoreTag = function(origine, tag) {
    const attuale = window.Model.coloreTag(appData, tag) || '';
    const voci: any[] = [{ heading: true, label: _tgT('tag_color_menu', 'Colore di «{var0}»').replace('{var0}', tag) }];
    for (const c of [''].concat(window.Model.COLORI_TAG)) {
        voci.push({
            label: c ? _tgT('tag_color_' + c, c) : _tgT('tag_color_none', 'Nessuno'),
            colore: c || 'neutro',
            corrente: c === attuale,
            onSelect: async () => {
                if (!(await window.impostaColoreTagArchivio(tag, c))) return;
                if (!document.getElementById('tag-manager-modal')?.classList.contains('hidden-tab')) window.disegnaGestioneTag();
                if (typeof renderTagList === 'function' && !document.getElementById('sidebar-tags')?.classList.contains('hidden-tab')) renderTagList();
                window.aggiornaChipTagForm();
            }
        });
    }
    window.apriMenuContestuale(origine, voci);
};

document.addEventListener('contextmenu', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-tag]') as HTMLElement | null;
    if (!el || !el.dataset.tag || typeof appData === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    window.apriMenuColoreTag(e.clientX || e.clientY ? e : el, el.dataset.tag);
}, true);
