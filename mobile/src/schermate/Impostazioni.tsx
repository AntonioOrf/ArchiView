// Impostazioni (dalla barra in fondo): account Google, regola d'invio, Wi-Fi diretto.

import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { LogIn, LogOut, QrCode, ShieldCheck, Unplug, Wifi } from 'lucide-react-native';
import { chiediConsenso, consenso, INFORMATIVA, revocaConsenso } from '../consenso';
import { dimenticaCartella } from '../esporta';
import type { DopoInvio } from '../pagine';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Riquadro } from '../ui/Riquadro';
import { Testo } from '../ui/Testo';

type Props = {
  email?: string;
  onAccedi: () => void;
  onEsci: () => void;
  soloWifi: boolean;
  onSoloWifi: (v: boolean) => void;
  nomeRete: string;
  dopoInvio: DopoInvio;
  onDopoInvio: (d: DopoInvio) => void;
  abbinamento: { archivio: string; host: string } | null;
  archivio?: string;
  inCoda: boolean;
  invioInCorso: boolean;
  onAbbina: () => void;
  onInviaWifi: () => void;
  onScollega: () => void;
  onIndietro: () => void;
};

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  const c = useColori();
  return (
    <View style={{ gap: spazio.sm }}>
      <Testo variante="sezione" accessibilityRole="header" style={{ marginHorizontal: spazio.xs }}>{titolo}</Testo>
      <View style={{ padding: spazio.md, gap: spazio.md, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg }}>{children}</View>
    </View>
  );
}

/** Una scelta di un gruppo radio: cerchio col colore d'accento, tutta la riga toccabile. */
function Scelta({ attiva, onPress, children, etichetta }: { attiva: boolean; onPress: () => void; children: ReactNode; etichetta: string }) {
  const c = useColori();
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={etichetta} accessibilityState={{ checked: attiva }} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md, minHeight: TOCCO }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: attiva ? c.primary : c.borderInput, alignItems: 'center', justifyContent: 'center' }}>
        {attiva && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary }} />}
      </View>
      {children}
    </Pressable>
  );
}

export function Impostazioni(p: Props) {
  const c = useColori();
  const d = p.dopoInvio;
  const [giorni, setGiorni] = useState(String(d.giorni));
  const [consentito, setConsentito] = useState(consenso);
  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo="Impostazioni" onIndietro={p.onIndietro} />
      <ScrollView contentContainerStyle={{ padding: spazio.md, gap: spazio.lg }}>
        <Sezione titolo="Account Google">
          {p.email ? (
            <>
              <Testo>{p.email}</Testo>
              <Pulsante variante="secondario" icona={LogOut} titolo="Esci" onPress={p.onEsci} />
            </>
          ) : (
            <>
              <Testo variante="aiuto">Serve per inviare le pagine su Drive e leggere gli archivi.</Testo>
              <Pulsante variante="primario" icona={LogIn} titolo="Accedi con Google" onPress={p.onAccedi} />
            </>
          )}
        </Sezione>

        <Sezione titolo="Invio">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
            <Testo style={{ flex: 1 }}>Invio automatico solo col Wi-Fi</Testo>
            <Switch value={p.soloWifi} onValueChange={p.onSoloWifi} accessibilityLabel="Invio automatico solo col Wi-Fi"
              trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={p.soloWifi ? c.onPrimary : c.textMuted} />
          </View>
          <Testo variante="aiuto">{`Rete ora: ${p.nomeRete}. Con i dati mobili le pagine partono solo con «Invia ora».`}</Testo>
        </Sezione>

        <Sezione titolo="Dopo l'invio">
          <View accessibilityRole="radiogroup">
            <Scelta etichetta="Cancella subito" attiva={d.modo === 'subito'} onPress={() => p.onDopoInvio({ ...d, modo: 'subito' })}>
              <Testo>Cancella subito</Testo>
            </Scelta>
            <Scelta etichetta={`Tieni per ${d.giorni} giorni`} attiva={d.modo === 'giorni'} onPress={() => p.onDopoInvio({ ...d, modo: 'giorni' })}>
              <Testo>Tieni per</Testo>
              <TextInput
                accessibilityLabel="Giorni" keyboardType="number-pad" maxLength={3} value={giorni} selectionColor={c.primary}
                onChangeText={setGiorni}
                onEndEditing={() => {
                  const g = parseInt(giorni, 10);
                  if (g > 0) p.onDopoInvio({ modo: 'giorni', giorni: g });
                  else setGiorni(String(d.giorni));
                }}
                style={[tipo.corpo, { width: 64, minHeight: TOCCO, paddingHorizontal: spazio.sm, textAlign: 'center', color: c.textMain, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }]}
              />
              <Testo>giorni</Testo>
            </Scelta>
            <Scelta etichetta="Tieni sempre" attiva={d.modo === 'sempre'} onPress={() => p.onDopoInvio({ ...d, modo: 'sempre' })}>
              <Testo>Tieni sempre</Testo>
            </Scelta>
          </View>
          <Testo variante="aiuto">Le pagine tenute restano nella scheda in sola lettura e si tolgono anche a mano.</Testo>
        </Sezione>

        <Sezione titolo="Privacy">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
            <Testo style={{ flex: 1 }}>Fotocamera, foto e file</Testo>
            <Switch value={!!consentito} accessibilityLabel="Consenso a fotocamera, foto e file"
              onValueChange={async v => {
                if (!v) {
                  try { revocaConsenso(); dimenticaCartella(); } catch (e: any) { Alert.alert('Errore', `Revoca del consenso: ${e?.message || String(e)}`); }
                } else await chiediConsenso();
                setConsentito(consenso());
              }}
              trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={consentito ? c.onPrimary : c.textMuted} />
          </View>
          <Testo variante="aiuto">{consentito
            ? `Consenso dato il ${new Date(consentito).toLocaleDateString('it-IT')}. Se lo revochi, l'app dimentica la cartella di salvataggio e lo richiede al prossimo uso.`
            : 'Senza consenso non si scansiona, non si importa dalla galleria e non si salva in una cartella.'}</Testo>
          <Pulsante variante="ghost" icona={ShieldCheck} titolo="Informativa sulla privacy"
            onPress={() => Linking.openURL(INFORMATIVA).catch(e => Alert.alert('Errore', `Informativa non aperta: ${e?.message || String(e)}`))} />
        </Sezione>

        <Sezione titolo="Wi-Fi diretto">
          <Testo variante="aiuto">Senza Drive né account: il telefono manda le pagine al computer sulla stessa rete. Sul computer: pannello «Dal telefono» → «Ricevi via Wi-Fi, senza Drive…», poi inquadra il QR.</Testo>
          {p.abbinamento ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
                <Wifi size={20} color={c.success} />
                <Testo style={{ flex: 1 }}>{`Collegato a «${p.abbinamento.archivio}» (${p.abbinamento.host})`}</Testo>
              </View>
              {!!p.archivio && p.abbinamento.archivio !== p.archivio && (
                <Riquadro tono="avviso"><Testo variante="aiuto" tono="main">{`Sul computer è aperto un altro archivio: le pagine di «${p.archivio}» verranno rifiutate.`}</Testo></Riquadro>
              )}
              <Pulsante variante="primario" icona={Wifi} titolo="Invia via Wi-Fi" disabilitato={!p.inCoda || p.invioInCorso} onPress={p.onInviaWifi} />
              <Pulsante variante="ghost" icona={Unplug} titolo="Scollega" onPress={p.onScollega} />
            </>
          ) : (
            <Pulsante variante="secondario" icona={QrCode} titolo="Abbina col computer" onPress={p.onAbbina} />
          )}
        </Sezione>
      </ScrollView>
    </View>
  );
}
