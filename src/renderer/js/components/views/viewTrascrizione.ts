// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('view-trascrizione')) {
            const html = `
    <div id="view-trascrizione" class="fixed inset-0 z-40 hidden-tab fade-in flex flex-col p-4 md:p-6 overflow-hidden" style="background-color: var(--color-bg-base);">
        <header class="shrink-0 mb-4 flex items-center justify-between pb-4 p-3 panel-glass">
            <div class="flex items-center gap-4">
                <button id="btn-back-to-list-trasc" onclick="chiudiTrascrizione()" class="btn btn-secondary btn-icon" data-i18n-title="tooltip_back" data-i18n-aria-label="tooltip_back">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <button id="btn-collapse-editor" onmousedown="event.preventDefault()" onclick="toggleFullscreenAllegato()" class="btn btn-secondary btn-icon shadow-sm" data-i18n-title="tooltip_collapse" data-i18n-aria-label="tooltip_collapse">
                    <i data-lucide="panel-left-close" class="w-5 h-5"></i>
                </button>
                <div>
                    <h2 id="trascrizione-title" class="text-2xl font-bold flex items-center gap-2" style="color: var(--color-primary);"> <span data-i18n="title_transcription">Trascrizione</span></h2>
                    <p id="trascrizione-subtitle" class="text-sm italic" style="color: var(--color-text-muted);"></p>
                </div>
            </div>
            
            <button onmousedown="event.preventDefault()" onclick="salvaTrascrizione()" data-i18n-title="btn_save" class="btn btn-primary px-6 py-2 shadow-md text-lg">
                <span data-i18n="btn_save_transcription">Salva Trascrizione</span>
            </button>
        </header>

        <div id="trascrizione-container" class="flex-1 flex flex-col lg:flex-row gap-2 overflow-hidden relative">
            
            <div id="trascrizione-editor-panel" style="width: 50%;" class="flex flex-col bg-white shadow-xl border border-stone-200/50 rounded-sm overflow-hidden transition-all duration-300 shrink-0 min-w-[250px]">
                <div id="trascrizione-toolbar" class="bg-stone-100 border-b border-stone-200 p-2 flex flex-wrap gap-2 items-center">
                    <button onmousedown="event.preventDefault()" data-cmd="bold" aria-pressed="false" onclick="document.execCommand('bold', false, null);window.updateToolbarState&&window.updateToolbarState()" class="btn btn-ghost btn-icon rounded" data-i18n-title="tooltip_bold" data-i18n-aria-label="tooltip_bold"><i data-lucide="bold" class="w-4 h-4"></i></button>
                    <button onmousedown="event.preventDefault()" data-cmd="italic" aria-pressed="false" onclick="document.execCommand('italic', false, null);window.updateToolbarState&&window.updateToolbarState()" class="btn btn-ghost btn-icon rounded" data-i18n-title="tooltip_italic" data-i18n-aria-label="tooltip_italic"><i data-lucide="italic" class="w-4 h-4"></i></button>
                    <button onmousedown="event.preventDefault()" data-cmd="underline" aria-pressed="false" onclick="document.execCommand('underline', false, null);window.updateToolbarState&&window.updateToolbarState()" class="btn btn-ghost btn-icon rounded" data-i18n-title="tooltip_underline" data-i18n-aria-label="tooltip_underline"><i data-lucide="underline" class="w-4 h-4"></i></button>
                    <div class="w-px h-6 bg-stone-300 mx-1"></div>
                    <button onmousedown="event.preventDefault()" data-cmd="insertUnorderedList" aria-pressed="false" onclick="document.execCommand('insertUnorderedList', false, null);window.updateToolbarState&&window.updateToolbarState()" class="btn btn-ghost btn-icon rounded" data-i18n-title="tooltip_ul" data-i18n-aria-label="tooltip_ul"><i data-lucide="list" class="w-4 h-4"></i></button>
                    <button onmousedown="event.preventDefault()" data-cmd="insertOrderedList" aria-pressed="false" onclick="document.execCommand('insertOrderedList', false, null);window.updateToolbarState&&window.updateToolbarState()" class="btn btn-ghost btn-icon rounded" data-i18n-title="tooltip_ol" data-i18n-aria-label="tooltip_ol"><i data-lucide="list-ordered" class="w-4 h-4"></i></button>
                    
                    <div class="flex-1"></div>
                    
                    <button id="btn-carica-allegato-trasc" onclick="document.getElementById('trasc-file-input').click()" class="btn hidden btn-secondary border border-amber-300/50">
                        <i data-lucide="upload" class="w-4 h-4"></i> <span data-i18n="btn_add_image_pdf">Aggiungi Immagine/PDF</span></button>
                    <input type="file" id="trasc-file-input" class="hidden" accept="image/*,.pdf" onchange="caricaAllegatoTrascrizione(event)">
                </div>
                <div class="flex-1 overflow-y-auto cursor-text p-6 bg-white" onclick="if(event.target === this) document.getElementById('trascrizione-editor').focus()">
                    <div id="trascrizione-editor" contenteditable="true" class="min-h-full outline-none text-lg leading-relaxed text-stone-800 select-text" style="font-family: 'Georgia', serif; outline: none;"></div>
                </div>
            </div>

            <div id="trascrizione-resizer" class="lg:flex w-2 cursor-col-resize bg-stone-200 hover:bg-amber-400 active:bg-amber-500 border border-stone-300 rounded-sm items-center justify-center group transition-colors hidden z-10 shrink-0" title="Trascina per ridimensionare">
                <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 group-hover:text-white pointer-events-none"></i>
            </div>

            <div id="trascrizione-allegato-panel" class="flex-1 bg-stone-200/50 shadow-inner border border-stone-300/50 rounded-sm overflow-hidden relative flex flex-col transition-all duration-300 hidden-tab min-w-[250px]">
                <div id="trascrizione-thumbnails" class="flex gap-2 p-2 bg-stone-100 border-b border-stone-300 overflow-x-auto hidden-tab shrink-0"></div>
                <div class="flex-1 relative flex justify-center items-center overflow-hidden group">
                    <button id="btn-prev-allegato" onclick="cambiaAllegatoRelativo(-1)" data-i18n-title="tooltip_prev" data-i18n-aria-label="tooltip_prev" class="btn btn-icon absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-0 z-10 hidden" style="background-color: rgba(41, 37, 36, 0.6); color: white;"><i data-lucide="chevron-left" class="w-6 h-6"></i></button>
                    <img id="trasc-img-preview" alt="" class="max-w-full max-h-full object-contain hidden" />
                    <iframe id="trasc-pdf-preview" class="w-full h-full bg-white hidden" src=""></iframe>
                    <button id="btn-next-allegato" onclick="cambiaAllegatoRelativo(1)" data-i18n-title="tooltip_next" data-i18n-aria-label="tooltip_next" class="btn btn-icon absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-0 z-10 hidden" style="background-color: rgba(41, 37, 36, 0.6); color: white;"><i data-lucide="chevron-right" class="w-6 h-6"></i></button>
                    <div id="trasc-no-allegato" class="text-center p-8 hidden">
                        <i data-lucide="image-off" class="w-16 h-16 mx-auto text-stone-400 mb-4"></i>
                        <p class="text-stone-500 font-medium" data-i18n="no_attachment">Nessun allegato disponibile per questa scheda.</p>
                    </div>
                </div>
            </div>
            
        </div>
        <input type="hidden" id="trascrizione-id">
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        // P2.5 — stato attivo dei bottoni di formattazione (aria-pressed + visuale).
        // Aggiornato su selectionchange quando la selezione è dentro l'editor.
        const updateToolbarState = () => {
            const editor = document.getElementById('trascrizione-editor');
            const toolbar = document.getElementById('trascrizione-toolbar');
            if (!editor || !toolbar) return;
            const sel = window.getSelection();
            const inEditor = sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode);
            toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
                let active = false;
                if (inEditor) {
                    try { active = document.queryCommandState(btn.getAttribute('data-cmd')); } catch { /* noop */ }
                }
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        };
        window.updateToolbarState = updateToolbarState;
        document.addEventListener('selectionchange', updateToolbarState);
    });
})();
