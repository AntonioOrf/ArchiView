// Chiusura dei modali: Esc e clic sullo sfondo chiudono SOLO quello in cima, passando dalla
// sua funzione dedicata (cleanup, callback di annullamento). Spostato da app.ts (PIANO-REFACTOR Fase 6).

// Mappa id-modale → funzione di chiusura dedicata (cleanup: reset iframe, callback, ecc.)
// Overlay che NON vanno chiusi né con Esc né cliccando lo sfondo: sono in mezzo a
// un'operazione (progresso di sync, finestra di autenticazione).
// accesso-negato-overlay: con Esc si resterebbe davanti a un vault non autorizzato;
// le uscite sono solo i due pulsanti (cambia account / altro archivio).
const modaliNonChiudibili = ['cloud-progress-overlay', 'cloud-auth-modal', 'email-prompt-modal', 'accesso-negato-overlay'];

const modalClosers = {
    'image-modal': 'chiudiModal',
    'docs-modal': 'chiudiModalDocumenti',
    'rename-modal': 'chiudiRenameModal',
    'settings-modal': 'chiudiImpostazioni',
    'folder-modal': 'chiudiFolderModal',
    'new-type-modal': 'chiudiNewTypeModal',
    'campo-proprio-modal': 'chiudiCampoProprioModal',
    'manage-types-modal': 'chiudiManageTypesModal',
    'delete-modal': 'chiudiDeleteModal',
    // Non chiude finché l'estrazione è in corso: vedi importZipModal.ts.
    'import-zip-modal': 'chiudiImportZip',
    'unsaved-modal': 'chiudiUnsavedModal',
    'cloud-modal': 'chiudiCloudModal',
    'share-modal': 'chiudiShareModal',
    'changelog-modal': 'chiudiChangelogModal',
    'issue-modal': 'chiudiIssueModal',
    'bulk-modal': 'chiudiAzioniMassa',
    'tag-manager-modal': 'chiudiGestioneTag',
    'vocab-modal': 'chiudiVocabolari',
    'duplicati-modal': 'chiudiDuplicati',
    'authority-modal': 'chiudiAnagrafica',
    'scanner-modal': 'chiudiScansioni',
    'relazioni-modal': 'chiudiCollegamenti',
    'grafo-modal': 'chiudiGrafo',
    'altro-archivio-modal': 'chiudiAnteprimaAltroArchivio',
    'copia-archivio-modal': 'chiudiCopiaAltroArchivio',
    'rimando-esterno-modal': 'chiudiSelettoreRimando',
    'omonimi-modal': 'chiudiOmonimiAltriArchivi',
    // Fase 5.3 — prima mancavano: Esc li nascondeva con il fallback `hidden-tab`,
    // che sui modali creati e rimossi al volo lasciava il nodo nel DOM, e sui
    // conflitti di sync abbandonava la callback di risoluzione senza annullarla.
    'diff-modal': 'chiudiDiffModal',
    'history-diff-modal': 'chiudiHistoryDiffModal',
    'release-notes-modal': 'chiudiNoteRilascio',
    'merge-conflict-modal': 'annullaSincronizzazioneConflitto',
    'deletion-conflict-modal': 'annullaSincronizzazioneDeletions',
};

// Chiusura centralizzata del modale in cima allo stack (riusata da Esc e click sul backdrop).
// Ritorna false se la chiusura è stata bloccata (es. welcome-modal obbligatorio).
function chiudiModaleTop(top) {
    if (modaliNonChiudibili.includes(top.id)) return false;

    // Il welcome-modal è chiudibile solo se un workspace esiste già (pulsante chiusura visibile);
    // durante la scelta iniziale è obbligatorio.
    if (top.id === 'welcome-modal') {
        const closeBtn = document.getElementById('welcome-close-btn');
        if (closeBtn && !closeBtn.classList.contains('hidden') && window.chiudiWelcomeModal) {
            window.chiudiWelcomeModal();
            return true;
        }
        return false;
    }

    if (top.id === 'bottom-confirm-banner') {
        const btnCancel = top.querySelector('.btn-ghost');
        if (btnCancel) btnCancel.click();
        else if (window.chiudiBottomConfirm) window.chiudiBottomConfirm();
    } else {
        const fnName = modalClosers[top.id];
        // I modali costruiti al volo (es. vault-delete-modal) espongono il proprio
        // annulla con data-modal-cancel: cliccarlo esegue anche il resolve della promise.
        const btnAnnulla = top.querySelector('[data-modal-cancel]');
        if (fnName && typeof (window as any)[fnName] === 'function') (window as any)[fnName]();
        else if (btnAnnulla) btnAnnulla.click();
        else top.classList.add('hidden-tab'); // fallback per modali senza handler dedicato
    }

    if (typeof editingTypeId !== 'undefined') editingTypeId = null;
    return true;
}

/** Clic sullo sfondo di un modale (solo sull'overlay, non sul contenuto). Da chiamare una volta. */
function collegaChiusuraModali() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            // Instrada alle funzioni chiudi* dedicate (cleanup) come il dispatcher Esc;
            // gli overlay non chiudibili sono filtrati dentro chiudiModaleTop, un elenco solo.
            chiudiModaleTop(e.target);
        }
    });
}
