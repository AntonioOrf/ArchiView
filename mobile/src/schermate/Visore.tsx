// Fase 13 (design 11/10): la pagina toccata a tutto schermo, zoom e strisciata fra le pagine della
// scheda. Area della foto sempre scura, barre col tema. Pagine modificabili: etichetta e azioni
// (Ruota, Ritaglia, Rifai, Dividi, Elimina). In invio o inviate: sola lettura.
// Fase 15b: lo usano anche i Documenti, senza etichetta né Dividi; le azioni ricevono l'indice.

import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Check, CloudUpload, Columns2, Crop, Palette, RotateCw, ScanLine, ScanText, Trash2 } from 'lucide-react-native';
import { ScannerLotto } from '../contratto';
import { FILTRI, type Filtro } from '../filtri';
import { giorniRimasti, type DopoInvio } from '../pagine';
import { colori } from '../theme/colori';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';
import { Zoom } from '../ui/Zoom';

/** `chiave`: cambia quando cambia la foto (lo zoom riparte). `inviatoIl`: per i giorni rimasti. */
export type PaginaVisore = { chiave: string; uri: string; etichetta?: string; doppia?: boolean; stato?: 'invio' | 'inviata'; inviatoIl?: string; filtro?: Filtro };
type Azione = (i: number) => void;

type Props = {
  titolo: string;
  pagine: PaginaVisore[];
  indice: number;
  onIndice: (i: number) => void;
  dopoInvio?: DopoInvio;
  occupato: boolean;
  onChiudi: () => void;
  /** Assente: niente campo «Carta» (Documenti). */
  onEtichetta?: (i: number, etichetta: string) => void;
  onRuota: Azione;
  onRitaglia: Azione;
  onRifai: Azione;
  /** Assente: niente «Dividi» (Documenti). */
  onDividi?: Azione;
  onElimina: Azione;
  /** Fase 15e, solo Documenti: «Testo» (OCR e «Copia testo»). */
  onTesto?: Azione;
  /** Fase 15d, solo Documenti: «Filtri» apre la scelta sotto la foto. `null` = originale. */
  filtri?: { onScegli: (i: number, f: Filtro | null) => void; onTutte: (f: Filtro | null) => void };
};

function Bottone({ titolo, icona: Icona, pericolo, spento, attivo, onPress }: { titolo: string; icona: ComponentType<{ size?: number; color?: string }>; pericolo?: boolean; spento?: boolean; attivo?: boolean; onPress: () => void }) {
  const c = useColori();
  const colore = pericolo ? c.dangerText : attivo ? c.primaryHover : c.textMain;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={titolo} accessibilityState={{ disabled: !!spento, ...(attivo !== undefined ? { expanded: attivo } : {}) }} disabled={spento} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spazio.xs, borderRadius: raggio.md, backgroundColor: pressed ? c.bgHover : attivo ? c.primaryLight : 'transparent', opacity: spento ? 0.5 : 1 })}
    >
      <Icona size={22} color={colore} />
      <Testo variante="aiuto" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: colore }}>{titolo}</Testo>
    </Pressable>
  );
}

export function Visore(p: Props) {
  const c = useColori();
  const [pannello, setPannello] = useState(false);
  const n = p.pagine.length;
  const i = Math.min(p.indice, n - 1);
  const pg = p.pagine[i];
  const stato = pg.stato;
  const nome = pg.etichetta || `Pagina ${i + 1}`;
  const scorri = (verso: 1 | -1) => { const j = i + verso; if (j >= 0 && j < n) p.onIndice(j); };

  const barra = { backgroundColor: c.bgPanel, borderColor: c.divisore, paddingHorizontal: spazio.md, paddingVertical: spazio.sm };
  const avviso = stato === 'invio'
    ? 'In invio · sola lettura'
    : stato === 'inviata'
      ? `Inviata · sola lettura${p.dopoInvio?.modo === 'giorni' ? `, la tieni ancora ${giorniRimasti(pg.inviatoIl, p.dopoInvio.giorni, new Date())} giorni` : ''}`
      : null;

  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={p.titolo} sotto={`Pagina ${i + 1} di ${n}${n > 1 ? ' · striscia per le altre' : ''}`} onIndietro={p.onChiudi} chiudi />
      {avviso && (
        <View accessibilityRole="text" accessibilityLiveRegion="polite" style={[barra, { flexDirection: 'row', alignItems: 'center', gap: spazio.sm, borderBottomWidth: 1 }]}>
          {stato === 'invio' ? <CloudUpload size={18} color={c.primary} /> : <Check size={18} color={c.primary} />}
          <Testo variante="aiuto" tono="main" style={{ flex: 1 }}>{avviso}</Testo>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: colori.scuro.bgBase }}>
        <Zoom key={pg.chiave} uri={pg.uri} etichetta={nome} onScorri={scorri} />
        {p.occupato && <ActivityIndicator size="large" color={colori.scuro.textMain} accessibilityLabel="Elaborazione della pagina" style={{ position: 'absolute', top: spazio.md, right: spazio.md, padding: spazio.sm, borderRadius: raggio.tondo, backgroundColor: colori.scuro.bgPanel }} />}
      </View>

      {stato === 'inviata' ? (
        <View style={[barra, { flexDirection: 'row', alignItems: 'center', gap: spazio.md, borderTopWidth: 1 }]}>
          <Testo variante="aiuto" style={{ flex: 1 }}>Il computer ha già questa pagina.</Testo>
          <Pulsante variante="pericoloGhost" icona={Trash2} titolo="Togli dal telefono" onPress={() => p.onElimina(i)} />
        </View>
      ) : !stato && (
        <View style={[barra, { gap: spazio.xs, borderTopWidth: 1 }]}>
          {p.onEtichetta && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
              <Testo variante="aiuto">Carta</Testo>
              <TextInput
                accessibilityLabel={`Etichetta di ${nome}`} value={pg.etichetta || ''} onChangeText={t => p.onEtichetta!(i, t)}
                placeholder="Es. 12v" placeholderTextColor={c.textPlaceholder} maxLength={ScannerLotto.LIMITI.etichetta} selectionColor={c.primary}
                style={[tipo.voce, { flex: 1, minHeight: TOCCO, paddingHorizontal: spazio.md, color: c.textMain, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }]}
              />
            </View>
          )}
          {p.filtri && pannello && (
            <View style={{ gap: spazio.xs }}>
              <View accessibilityRole="radiogroup" accessibilityLabel="Filtro della pagina" style={{ flexDirection: 'row', gap: spazio.sm }}>
                {FILTRI.map(f => {
                  const scelto = (pg.filtro ?? null) === f.valore;
                  return (
                    <Pressable key={f.nome} accessibilityRole="radio" accessibilityState={{ checked: scelto, disabled: p.occupato }} disabled={p.occupato}
                      onPress={() => p.filtri!.onScegli(i, f.valore)}
                      style={({ pressed }) => ({ flex: 1, minHeight: TOCCO, alignItems: 'center', justifyContent: 'center', borderRadius: raggio.md, borderWidth: scelto ? 2 : 1, borderColor: scelto ? c.primary : c.divisore, backgroundColor: pressed ? c.bgHover : scelto ? c.primaryLight : c.bgPanel, opacity: p.occupato ? 0.5 : 1 })}>
                      <Testo variante="controllo" numberOfLines={1} maxFontSizeMultiplier={1.5} tono={scelto ? 'accento' : 'main'}>{f.nome}</Testo>
                    </Pressable>
                  );
                })}
              </View>
              {n > 1 && <Pulsante variante="ghost" titolo="Usa per tutte" disabilitato={p.occupato} onPress={() => p.filtri!.onTutte(pg.filtro ?? null)} style={{ alignSelf: 'flex-end' }} />}
            </View>
          )}
          <View accessibilityRole="toolbar" style={{ flexDirection: 'row' }}>
            <Bottone titolo="Ruota" icona={RotateCw} spento={p.occupato} onPress={() => p.onRuota(i)} />
            <Bottone titolo="Ritaglia" icona={Crop} spento={p.occupato} onPress={() => p.onRitaglia(i)} />
            {p.filtri && <Bottone titolo="Filtri" icona={Palette} attivo={pannello} onPress={() => setPannello(v => !v)} />}
            {p.onTesto && <Bottone titolo="Testo" icona={ScanText} spento={p.occupato} onPress={() => p.onTesto!(i)} />}
            <Bottone titolo="Rifai" icona={ScanLine} spento={p.occupato} onPress={() => p.onRifai(i)} />
            {p.onDividi && <Bottone titolo="Dividi" icona={Columns2} spento={p.occupato || !!pg.doppia} onPress={() => p.onDividi!(i)} />}
            <Bottone titolo="Elimina" icona={Trash2} pericolo spento={p.occupato} onPress={() => p.onElimina(i)} />
          </View>
        </View>
      )}
    </View>
  );
}
