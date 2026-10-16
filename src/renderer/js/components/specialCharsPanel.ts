(function() {
    const CHIAVE_RECENTI = 'av_caratteri_recenti';
    const MAX_RECENTI = 10;

    const GRUPPI: [string, string, [string, string, string][]][] = [
        ['car_gruppo_abbreviazioni', 'Abbreviazioni', [
            ['ꝑ', 'car_a751', 'p con asta tagliata, per'],
            ['ꝓ', 'car_a753', 'p con svolazzo, pro'],
            ['ꝗ', 'car_a757', 'q con asta tagliata, quod'],
            ['ꝙ', 'car_a759', 'q con tratto obliquo, quam'],
            ['⁊', 'car_204a', 'nota tironiana, et'],
            ['ꝯ', 'car_a76f', 'con'],
            ['ꝰ', 'car_a770', 'us'],
            ['ꝝ', 'car_a75d', 'rum'],
            ['ꝫ', 'car_a76b', 'et, segno di abbreviazione'],
            ['̄', 'car_0304', 'titulus, lineetta sulla lettera precedente'],
        ]],
        ['car_gruppo_lettere', 'Lettere', [
            ['ſ', 'car_017f', 's lunga'],
            ['ꝛ', 'car_a75b', 'r rotonda'],
            ['ā', 'car_0101', 'a con titulus'],
            ['ē', 'car_0113', 'e con titulus'],
            ['ī', 'car_012b', 'i con titulus'],
            ['ō', 'car_014d', 'o con titulus'],
            ['ū', 'car_016b', 'u con titulus'],
            ['æ', 'car_00e6', 'ae legata'],
            ['œ', 'car_0153', 'oe legata'],
            ['ꝺ', 'car_a77a', 'd insulare'],
            ['þ', 'car_00fe', 'thorn'],
            ['ð', 'car_00f0', 'eth'],
            ['ȝ', 'car_021d', 'yogh'],
        ]],
        ['car_gruppo_punteggiatura', 'Punteggiatura', [
            ['·', 'car_00b7', 'punto medio'],
            ['⹎', 'car_2e4e', 'punctus elevatus'],
            ['¶', 'car_00b6', 'paragrafo'],
            ['⸿', 'car_2e3f', 'capitulum'],
            ['⸗', 'car_2e17', 'doppio trattino obliquo'],
            ['⁒', 'car_2052', 'segno di sottrazione commerciale'],
            ['†', 'car_2020', 'croce'],
        ]],
    ];
    const NOMI = new Map(GRUPPI.flatMap(([, , car]) => car.map(([c, k, f]) => [c, [k, f]] as [string, [string, string]])));
    const nome = (c: string) => { const n = NOMI.get(c); return n ? window.t(n[0], n[1]) : c; };
    const glifo = (c: string) => /^\p{M}$/u.test(c) ? '◌' + c : c;

    function leggiRecenti(): string[] {
        try {
            const v = JSON.parse(localStorage.getItem(CHIAVE_RECENTI) || '[]');
            return Array.isArray(v) ? v.filter(c => NOMI.has(c)) : [];
        } catch { return []; }
    }
    function ricordaRecente(c: string) {
        const recenti = [c, ...leggiRecenti().filter(x => x !== c)].slice(0, MAX_RECENTI);
        try { localStorage.setItem(CHIAVE_RECENTI, JSON.stringify(recenti)); } catch {}
    }

    function gruppoEl(id: string, titolo: string, caratteri: string[]): HTMLElement {
        const g = document.createElement('div');
        g.className = 'car-gruppo';
        g.setAttribute('role', 'group');
        g.dataset.gruppo = id;
        const etichetta = document.createElement('span');
        etichetta.className = 'car-gruppo-titolo';
        etichetta.id = 'car-gruppo-' + id;
        etichetta.textContent = titolo;
        g.setAttribute('aria-labelledby', etichetta.id);
        g.appendChild(etichetta);
        for (const c of caratteri) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-ghost car-speciale';
            b.textContent = glifo(c);
            b.dataset.c = c;
            b.setAttribute('aria-label', nome(c));
            b.title = `${nome(c)} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`;
            g.appendChild(b);
        }
        return g;
    }

    function disegna(pannello: HTMLElement) {
        const recenti = leggiRecenti();
        pannello.replaceChildren(
            ...(recenti.length ? [gruppoEl('recenti', window.t('car_gruppo_recenti', 'Recenti'), recenti)] : []),
            ...GRUPPI.map(([k, f, car], i) => gruppoEl(String(i), window.t(k, f), car.map(([c]) => c))),
        );
    }

    let rangeEditor: Range | null = null;

    function inserisci(bottone: HTMLElement, e: MouseEvent) {
        const c = bottone.dataset.c;
        const editor = document.getElementById('trascrizione-editor');
        if (!editor || !c) return;
        if (document.activeElement !== editor) {
            editor.focus();
            const sel = window.getSelection();
            if (sel && rangeEditor && editor.contains(rangeEditor.startContainer)) {
                sel.removeAllRanges();
                sel.addRange(rangeEditor);
            }
        }
        document.execCommand('insertText', false, c);
        ricordaRecente(c);
        const pannello = document.getElementById('trasc-caratteri');
        if (!pannello) return;
        const gruppo = bottone.closest<HTMLElement>('[data-gruppo]')?.dataset.gruppo;
        disegna(pannello);
        if (e.detail === 0 && gruppo) {
            pannello.querySelector<HTMLElement>(`[data-gruppo="${gruppo}"] [data-c="${CSS.escape(c)}"]`)?.focus();
        }
    }

    window.toggleCaratteriSpeciali = function(apri?: boolean, conFuoco?: boolean) {
        const pannello = document.getElementById('trasc-caratteri');
        const btn = document.getElementById('btn-caratteri-speciali');
        if (!pannello) return;
        const aperto = apri ?? pannello.classList.contains('hidden-tab');
        if (aperto) disegna(pannello);
        pannello.classList.toggle('hidden-tab', !aperto);
        btn?.setAttribute('aria-expanded', String(aperto));
        if (aperto && conFuoco) pannello.querySelector<HTMLElement>('.car-speciale')?.focus();
        if (!aperto && pannello.contains(document.activeElement)) document.getElementById('trascrizione-editor')?.focus();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const pannello = document.getElementById('trasc-caratteri');
        if (!pannello) return;
        document.getElementById('trascrizione-editor')?.addEventListener('focusout', (e) => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && (e.currentTarget as Node).contains(sel.anchorNode)) rangeEditor = sel.getRangeAt(0).cloneRange();
        });
        const bottoneDi = (e: Event) => (e.target as Element).closest<HTMLElement>('.car-speciale');
        pannello.addEventListener('mousedown', (e) => { if (bottoneDi(e)) e.preventDefault(); });
        pannello.addEventListener('click', (e) => { const b = bottoneDi(e); if (b) inserisci(b, e); });
        pannello.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('trascrizione-editor')?.focus();
                return;
            }
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const tutti = Array.from(pannello.querySelectorAll<HTMLElement>('.car-speciale'));
            const i = tutti.indexOf(document.activeElement as HTMLElement);
            if (i < 0) return;
            e.preventDefault();
            tutti[(i + (e.key === 'ArrowRight' ? 1 : -1) + tutti.length) % tutti.length].focus();
        });
    });
})();
