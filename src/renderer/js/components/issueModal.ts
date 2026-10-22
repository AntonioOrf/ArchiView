(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('issue-modal')) {
            const modalHtml = `
                <div id="issue-modal" class="modal-overlay hidden-tab">
                    <form id="issue-form" class="modal-window max-w-lg" data-on-submit="inviaIssueForm" data-args-submit="[{&quot;$&quot;:&quot;event&quot;}]">
                        <div class="modal-header">
                            <div class="min-w-0">
                                <h3 class="modal-title" data-i18n="modal_report_issue">Segnala un problema</h3>
                                <p class="modal-sottotitolo" data-i18n="issue_subtitle">La segnalazione arriva direttamente a chi sviluppa ArchiView.</p>
                            </div>
                            <button type="button" data-on-click="chiudiIssueModal" class="btn btn-ghost btn-icon shrink-0" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body space-y-4">
                            <div>
                                <label class="form-label" for="issue-type-select" data-i18n="issue_type">Tipo</label>
                                <select id="issue-type-select" class="form-input">
                                    <option value="bug" data-i18n="issue_type_bug">Errore del programma</option>
                                    <option value="enhancement" data-i18n="issue_type_enhancement">Proposta</option>
                                    <option value="feedback" data-i18n="issue_type_feedback">Altro</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label" for="issue-title-input" data-i18n="issue_title">Titolo</label>
                                <input type="text" id="issue-title-input" required class="form-input" data-i18n-placeholder="placeholder_issue_title" placeholder="Es. l'OCR si blocca sui PDF lunghi">
                            </div>
                            <div>
                                <label class="form-label" for="issue-desc-input" data-i18n="issue_description">Cosa è successo</label>
                                <textarea id="issue-desc-input" required class="form-input font-serif min-h-[120px] resize-y" data-i18n-placeholder="placeholder_issue_desc" placeholder="Cosa stavi facendo, cosa ti aspettavi, cosa è successo invece."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer modal-footer-bar">
                            <button type="button" data-on-click="chiudiIssueModal" class="btn btn-secondary" data-i18n="btn_cancel">Annulla</button>
                            <button type="submit" class="btn btn-primary" data-i18n="issue_send">Invia la segnalazione</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    });

    window.apriIssueModal = function() {
        const modal = document.getElementById('issue-modal');
        if (modal) {
            modal.classList.remove('hidden-tab');
            document.getElementById('issue-title-input').value = '';
            document.getElementById('issue-type-select').value = 'bug';
            document.getElementById('issue-desc-input').value = '';
            
            if (typeof window.applicaTraduzioniHtml === 'function') {
                window.applicaTraduzioniHtml();
            }
            if (window.lucide) {
                lucide.createIcons({ nodes: [modal] });
            }
            setTimeout(() => document.getElementById('issue-title-input').focus(), 100);
        }
    };

    window.chiudiIssueModal = function() {
        const modal = document.getElementById('issue-modal');
        if (modal) {
            modal.classList.add('hidden-tab');
        }
    };

    window.inviaIssueForm = function(event) {
        event.preventDefault();
        const title = document.getElementById('issue-title-input').value.trim();
        const type = document.getElementById('issue-type-select').value;
        const description = document.getElementById('issue-desc-input').value.trim();

        const typeLabels = {
            bug: 'Bug 🐛',
            enhancement: 'Miglioramento 💡',
            feedback: 'Feedback 💬'
        };

        const button = event.target.querySelector('button[type="submit"]');
        const oldText = button.textContent;
        button.textContent = window.t('btn_sending', 'Invio in corso…');
        button.disabled = true;

        const payload = {
            _subject: "ArchiView: " + title,
            _template: "table",
            Tipo: typeLabels[type] || type,
            Titolo: title,
            Descrizione: description,
            Piattaforma: navigator.userAgent
        };

        if (window.apiBrowser && window.apiBrowser.inviaSegnalazione) {
            window.apiBrowser.inviaSegnalazione(payload).then(response => {
                if(response.ok) {
                    if (window.mostraMessaggio) window.mostraMessaggio(window.t("msg_segnalazione_inviata_con_", 'Segnalazione inviata.'), "success");
                } else {
                    console.error("Errore FormSubmit:", response);
                    if (window.mostraMessaggio) window.mostraMessaggio(window.t("msg_errore_durante_l_invio_de", "Errore durante l'invio della segnalazione."), "error");
                }
            }).catch(err => {
                console.error(err);
                if (window.mostraMessaggio) window.mostraMessaggio(window.t("msg_errore_di_rete_durante_l_", "Errore di rete durante l'invio."), "error");
            }).finally(() => {
                button.textContent = oldText;
                button.disabled = false;
                window.chiudiIssueModal();
            });
        } else {
            button.textContent = oldText;
            button.disabled = false;
            window.chiudiIssueModal();
            if (window.mostraMessaggio) window.mostraMessaggio(window.t("msg_funzionalit_non_disponibi", "Funzionalità non disponibile"), "error");
        }
    };
})();
