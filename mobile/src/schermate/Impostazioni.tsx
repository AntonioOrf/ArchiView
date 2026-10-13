// Impostazioni (dalla barra in fondo): account Google, regola d'invio, Wi-Fi diretto, lingua, versione e aggiornamenti.

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { avviso } from '../ui/Avviso';
import { Camera, CameraOff, Check, CloudDownload, Download, LogIn, LogOut, QrCode, RefreshCw, ScrollText, Settings, ShieldCheck, Smartphone, Unplug, Wifi } from 'lucide-react-native';
import { cercaAggiornamento, noteVersione, versioneApp } from '../aggiornaApp';
import type { Nuova } from '../aggiornamento';
import { apriImpostazioni, fotocameraConsentita, informativa } from '../consenso';
import { localeDate, t, type SceltaLingua } from '../lingua';
import { quantiGiorni, type DopoInvio } from '../pagine';
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
  /** F5: copia dei Documenti su Drive, data dell'ultima copia (ISO), ripristino. */
  copiaDocumenti: boolean;
  ultimaCopia?: string;
  onCopiaDocumenti: (v: boolean) => void;
  onRipristina: () => void;
  lingua: SceltaLingua;
  onLingua: (l: SceltaLingua) => void;
  onIndietro: () => void;
  /** Versione nuova già trovata all'avvio, e la sua installazione. */
  nuova: Nuova | null;
  onAggiorna: (n: Nuova) => void;
};

type StatoAggiornamento = { stato: 'ignoto' | 'cerco' } | { stato: 'recente'; ora: string } | { stato: 'nuova'; nuova: Nuova };

export function Sezione({ titolo, evidenza, children }: { titolo: string; evidenza?: boolean; children: ReactNode }) {
  const c = useColori();
  return (
    <View style={{ gap: spazio.sm }}>
      <Testo variante="sezione" accessibilityRole="header" style={{ marginHorizontal: spazio.xs }}>{titolo}</Testo>
      <View style={{ padding: spazio.md, gap: spazio.md, backgroundColor: c.bgPanel, borderWidth: evidenza ? 2 : 1, borderColor: evidenza ? c.primary : c.divisore, borderRadius: raggio.lg }}>{children}</View>
    </View>
  );
}

/** Una scelta di un gruppo radio: cerchio col colore d'accento, tutta la riga toccabile. */
export function Scelta({ attiva, onPress, children, etichetta }: { attiva: boolean; onPress: () => void; children: ReactNode; etichetta: string }) {
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
  // Il permesso si cambia anche dalle impostazioni di Android: si rilegge al ritorno nell'app.
  const [fotocamera, setFotocamera] = useState(fotocameraConsentita);
  useEffect(() => {
    const s = AppState.addEventListener('change', st => { if (st === 'active') setFotocamera(fotocameraConsentita()); });
    return () => s.remove();
  }, []);
  // I nomi delle lingue restano nella loro lingua: chi ha sbagliato scelta deve ritrovare la sua.
  const lingue: [SceltaLingua, string][] = [['auto', t('Automatica (lingua del telefono)')], ['it', 'Italiano'], ['en', 'English']];
  // La versione nuova trovata all'avvio («Più tardi» sul popup) si ritrova qui.
  const [agg, setAgg] = useState<StatoAggiornamento>(p.nuova ? { stato: 'nuova', nuova: p.nuova } : { stato: 'ignoto' });
  const cerca = async () => {
    setAgg({ stato: 'cerco' });
    try {
      const n = await cercaAggiornamento(true);
      setAgg(n ? { stato: 'nuova', nuova: n } : { stato: 'recente', ora: new Date().toLocaleTimeString(localeDate(), { timeStyle: 'short' }) });
    } catch (e: any) {
      setAgg({ stato: 'ignoto' });
      avviso(t('Errore'), t('Controllo degli aggiornamenti: {motivo}', { motivo: e?.message || String(e) }));
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <Intestazione titolo={t('Impostazioni')} onIndietro={p.onIndietro} />
      <ScrollView contentContainerStyle={{ padding: spazio.md, gap: spazio.lg }}>
        <Sezione titolo={t('Account Google')}>
          {p.email ? (
            <>
              <Testo>{p.email}</Testo>
              <Pulsante variante="secondario" icona={LogOut} titolo={t('Esci')} onPress={p.onEsci} />
            </>
          ) : (
            <>
              <Testo variante="aiuto">{t('Serve per inviare le pagine su Drive e leggere gli archivi.')}</Testo>
              <Pulsante variante="primario" icona={LogIn} titolo={t('Accedi con Google')} onPress={p.onAccedi} />
            </>
          )}
        </Sezione>

        <Sezione titolo={t('Invio')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
            <Testo style={{ flex: 1 }}>{t('Invio automatico solo col Wi-Fi')}</Testo>
            <Switch value={p.soloWifi} onValueChange={p.onSoloWifi} accessibilityLabel={t('Invio automatico solo col Wi-Fi')}
              trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={p.soloWifi ? c.onPrimary : c.textMuted} />
          </View>
          <Testo variante="aiuto">{t('Rete ora: {rete}. Con i dati mobili le pagine partono solo con «Invia ora».', { rete: p.nomeRete })}</Testo>
        </Sezione>

        <Sezione titolo={t('Dopo l\'invio')}>
          <View accessibilityRole="radiogroup">
            <Scelta etichetta={t('Cancella subito')} attiva={d.modo === 'subito'} onPress={() => p.onDopoInvio({ ...d, modo: 'subito' })}>
              <Testo>{t('Cancella subito')}</Testo>
            </Scelta>
            <Scelta etichetta={t('Conserva per {giorni}', { giorni: quantiGiorni(d.giorni) })} attiva={d.modo === 'giorni'} onPress={() => p.onDopoInvio({ ...d, modo: 'giorni' })}>
              <Testo>{t('Conserva per')}</Testo>
              <TextInput
                accessibilityLabel={t('Giorni')} keyboardType="number-pad" maxLength={3} value={giorni} selectionColor={c.primary}
                onChangeText={setGiorni}
                onEndEditing={() => {
                  const g = parseInt(giorni, 10);
                  if (g > 0) p.onDopoInvio({ modo: 'giorni', giorni: g });
                  else setGiorni(String(d.giorni));
                }}
                style={[tipo.corpo, { width: 64, minHeight: TOCCO, paddingHorizontal: spazio.sm, textAlign: 'center', color: c.textMain, backgroundColor: c.bgPanel, borderWidth: 1, borderColor: c.borderInput, borderRadius: raggio.md }]}
              />
              <Testo>{d.giorni === 1 ? t('giorno') : t('giorni')}</Testo>
            </Scelta>
            <Scelta etichetta={t('Conserva sempre')} attiva={d.modo === 'sempre'} onPress={() => p.onDopoInvio({ ...d, modo: 'sempre' })}>
              <Testo>{t('Conserva sempre')}</Testo>
            </Scelta>
          </View>
          <Testo variante="aiuto">{t('Le pagine conservate restano nella scheda in sola lettura e si rimuovono anche a mano.')}</Testo>
        </Sezione>

        <Sezione titolo={t('Documenti')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
            <Testo style={{ flex: 1 }}>{t('Copia su Drive')}</Testo>
            <Switch value={p.copiaDocumenti} onValueChange={p.onCopiaDocumenti} disabled={!p.email} accessibilityLabel={t('Copia dei Documenti su Drive')}
              trackColor={{ false: c.borderInput, true: c.primary }} thumbColor={p.copiaDocumenti ? c.onPrimary : c.textMuted} />
          </View>
          <Testo variante="aiuto">{!p.email
            ? t('I Documenti stanno solo su questo telefono. Accedi con Google per copiarli su Drive.')
            : p.copiaDocumenti
              ? `${t('Solo col Wi-Fi, in «ArchiView/Documenti telefono».')} ${p.ultimaCopia ? t('Ultima copia: {data}.', { data: new Date(p.ultimaCopia).toLocaleString(localeDate(), { dateStyle: 'short', timeStyle: 'short' }) }) : t('Nessuna copia ancora.')}`
              : t('I Documenti stanno solo su questo telefono: se lo perdi, li perdi.')}</Testo>
          {!!p.email && <Pulsante variante="ghost" icona={CloudDownload} titolo={t('Ripristina da Drive')} onPress={p.onRipristina} />}
        </Sezione>

        <Sezione titolo={t('Privacy')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }}>
            <View style={{ width: 40, height: 40, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center', backgroundColor: fotocamera ? c.successLight : c.bgHover }}>
              {fotocamera ? <Camera size={20} color={c.success} /> : <CameraOff size={20} color={c.textMuted} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Testo variante="controllo">{fotocamera ? t('Fotocamera consentita') : t('Fotocamera non consentita')}</Testo>
              <Testo variante="aiuto">{fotocamera
                ? t('Serve per scansionare, per il QR dell\'abbinamento e per la Foto libera.')
                : t('Senza, non si scansiona. Android la richiede al prossimo uso; se l\'hai negata due volte, si attiva da qui.')}</Testo>
            </View>
          </View>
          <Pulsante variante="secondario" icona={Settings} titolo={t('Gestisci nelle impostazioni di Android')} onPress={apriImpostazioni} />
          <Pulsante variante="ghost" icona={ShieldCheck} titolo={t('Informativa sulla privacy')}
            onPress={() => Linking.openURL(informativa()).catch(e => avviso(t('Errore'), t('Informativa non aperta: {motivo}', { motivo: e?.message || String(e) })))} />
        </Sezione>

        <Sezione titolo={t('Wi-Fi diretto')}>
          <Testo variante="aiuto">{t('Senza Drive né account: il telefono manda le pagine al computer sulla stessa rete. Sul computer: pannello «Dal telefono» → «Ricevi via Wi-Fi, senza Drive…», poi inquadra il QR.')}</Testo>
          {p.abbinamento ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.sm }}>
                <Wifi size={20} color={c.success} />
                <Testo style={{ flex: 1 }}>{t('Collegato a «{archivio}» ({host})', p.abbinamento)}</Testo>
              </View>
              {!!p.archivio && p.abbinamento.archivio !== p.archivio && (
                <Riquadro tono="avviso"><Testo variante="aiuto" tono="main">{t('Sul computer è aperto un altro archivio: le pagine di «{archivio}» verranno rifiutate.', { archivio: p.archivio })}</Testo></Riquadro>
              )}
              <Pulsante variante="primario" icona={Wifi} titolo={t('Invia via Wi-Fi')} disabilitato={!p.inCoda || p.invioInCorso} onPress={p.onInviaWifi} />
              <Pulsante variante="ghost" icona={Unplug} titolo={t('Scollega')} onPress={p.onScollega} />
            </>
          ) : (
            <Pulsante variante="secondario" icona={QrCode} titolo={t('Abbina col computer')} onPress={p.onAbbina} />
          )}
        </Sezione>

        <Sezione titolo={t('Lingua')}>
          <View accessibilityRole="radiogroup">
            {lingue.map(([valore, nome]) => (
              <Scelta key={valore} etichetta={nome} attiva={p.lingua === valore} onPress={() => p.onLingua(valore)}>
                <Testo>{nome}</Testo>
              </Scelta>
            ))}
          </View>
        </Sezione>

        <Sezione titolo={t('App')} evidenza={agg.stato === 'nuova'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazio.md }} accessibilityLiveRegion="polite">
            <View style={{ width: 40, height: 40, borderRadius: raggio.tondo, alignItems: 'center', justifyContent: 'center',
              backgroundColor: agg.stato === 'nuova' ? c.primaryLight : agg.stato === 'recente' ? c.successLight : c.bgHover }}>
              {agg.stato === 'cerco' ? <ActivityIndicator color={c.textMuted} />
                : agg.stato === 'nuova' ? <Download size={20} color={c.primaryHover} />
                : agg.stato === 'recente' ? <Check size={20} color={c.success} />
                : <Smartphone size={20} color={c.textMuted} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Testo variante="controllo">{agg.stato === 'nuova' ? t('Versione {v} disponibile', { v: agg.nuova.versione }) : t('Versione {v}', { v: versioneApp() })}</Testo>
              {agg.stato === 'nuova' && <Testo variante="aiuto">{t('Installata: {v}. Le pagine in attesa restano dove sono.', { v: versioneApp() })}</Testo>}
              {agg.stato === 'recente' && <Testo variante="aiuto">{t('È la più recente · controllato alle {ora}', { ora: agg.ora })}</Testo>}
              {agg.stato === 'cerco' && <Testo variante="aiuto">{t('Controllo su GitHub…')}</Testo>}
            </View>
          </View>
          {agg.stato === 'nuova' ? (
            <>
              <Pulsante variante="primario" titolo={t('Aggiorna')} onPress={() => p.onAggiorna(agg.nuova)} />
              <Pulsante variante="ghost" icona={ScrollText} titolo={t('Novità della versione')}
                onPress={() => Linking.openURL(noteVersione(agg.nuova.versione)).catch(e => avviso(t('Errore'), t('Note della versione non aperte: {motivo}', { motivo: e?.message || String(e) })))} />
            </>
          ) : (
            <Pulsante variante="secondario" icona={RefreshCw} titolo={t('Cerca aggiornamenti')} disabilitato={agg.stato === 'cerco'} onPress={cerca} />
          )}
        </Sezione>
      </ScrollView>
    </View>
  );
}
