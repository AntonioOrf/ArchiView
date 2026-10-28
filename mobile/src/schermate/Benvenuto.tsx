import { useEffect, useState, type ComponentType } from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import { avviso } from '../ui/Avviso';
import { ArrowLeft, Check, CloudUpload, LogIn, Minus, Plus, ScanLine, ShieldCheck, Camera } from 'lucide-react-native';
import { informativa } from '../consenso';
import { t } from '../lingua';
import { quantiGiorni, type DopoInvio } from '../pagine';
import { raggio, spazio, tipo, useColori } from '../theme';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';
import { Scelta } from './Impostazioni';

type Props = {
  dopoInvio: DopoInvio;
  email?: string;
  onAccedi: () => void;
  onFine: (dopoInvio: DopoInvio) => void;
};

type Icona = ComponentType<{ size?: number; color?: string }>;

const ULTIMO = 3;

export function Benvenuto(p: Props) {
  const c = useColori();
  const [passo, setPasso] = useState(0);
  const [dopo, setDopo] = useState(p.dopoInvio);

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (passo === 0 || passo === ULTIMO) return false;
      setPasso(passo - 1);
      return true;
    });
    return () => s.remove();
  }, [passo]);

  const pannello = { padding: spazio.md, gap: spazio.md, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.divisore, borderRadius: raggio.lg } as const;
  const punto = (I: Icona, testo: string) => (
    <View key={testo} style={{ flexDirection: 'row', gap: spazio.md, alignItems: 'flex-start' }}>
      <I size={22} color={c.primary} />
      <Testo style={{ flex: 1 }}>{testo}</Testo>
    </View>
  );
  const titolo = (n: number, testo: string, sotto: string) => (
    <View style={{ gap: spazio.sm }}>
      <Testo variante="aiuto" style={{ color: c.primary, fontWeight: '600' }}>{t('Passo {n} di 2', { n })}</Testo>
      <Testo variante="titolo" accessibilityRole="header" style={{ fontSize: 26 }}>{testo}</Testo>
      <Testo tono="main">{sotto}</Testo>
    </View>
  );
  const giorni = (g: number) => setDopo({ modo: 'giorni', giorni: Math.min(365, Math.max(1, g)) });
  const gg = quantiGiorni(dopo.giorni);
  const riepilogo: [string, string][] = [
    [t('Dopo l\'invio'), dopo.modo === 'subito' ? t('Cancella subito') : dopo.modo === 'giorni' ? t('Conserva {giorni}', { giorni: gg }) : t('Conserva sempre')],
    ['Google Drive', p.email || t('Non collegato')]
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spazio.sm, paddingVertical: spazio.xs, minHeight: 56 }}>
        {passo > 0 && passo < ULTIMO ? <Pulsante variante="ghost" icona={ArrowLeft} etichetta={t('Indietro')} onPress={() => setPasso(passo - 1)} /> : <View />}
        {passo < 2 && <Pulsante variante="ghost" titolo={t('Salta')} onPress={() => setPasso(2)} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spazio.lg, paddingBottom: spazio.lg, gap: spazio.lg }}>
        {passo === 0 && (
          <View style={{ gap: spazio.lg, paddingTop: spazio.lg }}>
            <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <ScanLine size={44} color={c.primary} />
            </View>
            <View style={{ gap: spazio.md }}>
              <Testo variante="titolo" accessibilityRole="header" style={{ fontSize: 30 }}>{t('Benvenuto in ArchiScanner')}</Testo>
              <Testo tono="main" style={{ fontSize: 16 }}>{t('Fotografa le pagine dei manoscritti e mandale al tuo archivio ArchiView, su Drive o direttamente al computer.')}</Testo>
            </View>
            <View style={{ gap: spazio.md }}>
              {punto(Camera, t('Scansiona, ritaglia e raddrizza le pagine in lotti.'))}
              {punto(CloudUpload, t('Invia su Google Drive o via Wi-Fi al computer.'))}
            </View>
            <View style={pannello}>
              <View style={{ flexDirection: 'row', gap: spazio.md, alignItems: 'center' }}>
                <ShieldCheck size={22} color={c.success} />
                <Testo variante="sezione" accessibilityRole="header">{t('I tuoi dati')}</Testo>
              </View>
              <Testo variante="aiuto">{t('Le pagine restano sul telefono finché non le invii tu, al tuo Drive o al tuo computer. Nessun server nostro, nessuna pubblicità né statistica d\'uso.')}</Testo>
              <Pulsante variante="ghost" titolo={t('Leggi l\'informativa sulla privacy')} style={{ alignSelf: 'flex-start' }}
                onPress={() => Linking.openURL(informativa()).catch(e => avviso(t('Errore'), t('Informativa non aperta: {motivo}', { motivo: e?.message || String(e) })))} />
            </View>
          </View>
        )}

        {passo === 1 && (
          <>
            {titolo(1, t('Dopo l\'invio, le pagine…'), t('Quando una pagina è arrivata su Drive o sul computer, cosa ne fa il telefono?'))}
            <View accessibilityRole="radiogroup" style={[pannello, { gap: 0, paddingVertical: spazio.sm }]}>
              <Scelta etichetta={t('Cancellale subito')} attiva={dopo.modo === 'subito'} onPress={() => setDopo({ ...dopo, modo: 'subito' })}>
                <Testo variante="voce">{t('Cancellale subito')}</Testo>
              </Scelta>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Scelta etichetta={t('Conservale per {giorni}', { giorni: gg })} attiva={dopo.modo === 'giorni'} onPress={() => setDopo({ ...dopo, modo: 'giorni' })}>
                    <Testo variante="voce" style={{ flexShrink: 1 }}>{t('Conservale per {giorni}', { giorni: gg })}</Testo>
                  </Scelta>
                </View>
                {dopo.modo === 'giorni' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }}>
                    <Pulsante variante="ghost" icona={Minus} etichetta={t('Un giorno in meno')} onPress={() => giorni(dopo.giorni - 1)} />
                    <Testo style={[tipo.controllo, { minWidth: 32, textAlign: 'center' }]} accessibilityLiveRegion="polite">{String(dopo.giorni)}</Testo>
                    <Pulsante variante="ghost" icona={Plus} etichetta={t('Un giorno in più')} onPress={() => giorni(dopo.giorni + 1)} />
                  </View>
                )}
              </View>
              <Scelta etichetta={t('Conservale sempre')} attiva={dopo.modo === 'sempre'} onPress={() => setDopo({ ...dopo, modo: 'sempre' })}>
                <Testo variante="voce">{t('Conservale sempre')}</Testo>
              </Scelta>
            </View>
            <Testo variante="aiuto">{t('Le pagine conservate restano nella scheda in sola lettura.')}</Testo>
          </>
        )}

        {passo === 2 && (
          <>
            {titolo(2, t('Collega il tuo Drive'), t('Con l\'account Google le pagine arrivano nell\'archivio su Drive e vedi gli archivi che hai già.'))}
            <View style={pannello}>
              {punto(Check, t('Accesso solo ai file creati dall\'app, non a tutto il Drive.'))}
              {punto(Check, t('Senza account puoi inviare via Wi-Fi al computer.'))}
              {punto(Check, t('Puoi accedere o uscire quando vuoi da Impostazioni.'))}
            </View>
          </>
        )}

        {passo === ULTIMO && (
          <View style={{ gap: spazio.lg, paddingTop: spazio.md }}>
            <View style={{ width: 72, height: 72, borderRadius: raggio.tondo, backgroundColor: c.successLight, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={36} color={c.success} />
            </View>
            <Testo variante="titolo" accessibilityRole="header" style={{ fontSize: 26 }}>{t('Tutto pronto')}</Testo>
            <View style={[pannello, { gap: 0, paddingVertical: spazio.xs }]}>
              {riepilogo.map(([k, v], i) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spazio.md, paddingVertical: spazio.md, borderBottomWidth: i < riepilogo.length - 1 ? 1 : 0, borderColor: c.divisore }}>
                  <Testo tono="muted">{k}</Testo>
                  <Testo style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Testo>
                </View>
              ))}
            </View>
            <Testo variante="aiuto">{t('Tutto si cambia dopo da Impostazioni.')}</Testo>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: spazio.lg, paddingTop: spazio.md, paddingBottom: spazio.lg, gap: spazio.md }}>
        {passo < ULTIMO && (
          <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', gap: spazio.sm }}>
            {[0, 1, 2].map(i => <View key={i} style={{ height: 8, width: i === passo ? 24 : 8, borderRadius: 4, backgroundColor: i === passo ? c.primary : c.borderLight }} />)}
          </View>
        )}
        {passo === 2 ? (
          <>
            <Pulsante variante="primario" icona={LogIn} titolo={t('Accedi con Google')} onPress={() => { p.onAccedi(); setPasso(ULTIMO); }} />
            <Pulsante variante="ghost" titolo={t('Più tardi')} onPress={() => setPasso(ULTIMO)} />
          </>
        ) : (
          <Pulsante variante="primario" titolo={passo === 0 ? t('Inizia') : passo === ULTIMO ? t('Vai all\'app') : t('Avanti')}
            onPress={() => (passo === ULTIMO ? p.onFine(dopo) : setPasso(passo + 1))} />
        )}
      </View>
    </View>
  );
}
