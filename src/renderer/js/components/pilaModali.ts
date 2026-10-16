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
    'diff-modal': 'chiudiDiffModal',
    'history-diff-modal': 'chiudiHistoryDiffModal',
    'release-notes-modal': 'chiudiNoteRilascio',
    'merge-conflict-modal': 'annullaSincronizzazioneConflitto',
    'deletion-conflict-modal': 'annullaSincronizzazioneDeletions',
};

function chiudiModaleTop(top) {
    if (modaliNonChiudibili.includes(top.id)) return false;

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
        const btnAnnulla = top.querySelector('[data-modal-cancel]');
        if (fnName && typeof (window as any)[fnName] === 'function') (window as any)[fnName]();
        else if (btnAnnulla) btnAnnulla.click();
        else top.classList.add('hidden-tab');
    }

    if (typeof editingTypeId !== 'undefined') editingTypeId = null;
    return true;
}

function collegaChiusuraModali() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            chiudiModaleTop(e.target);
        }
    });
}
