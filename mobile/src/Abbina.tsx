// Fase 7 — abbinamento col computer: si inquadra il QR del pannello "Scansioni in arrivo" e si
// verifica subito che il desktop risponda (stessa rete, server acceso).
// 11c: componenti del tema; sopra la fotocamera barra scura fissa (come l'area foto del visore).

import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera as IconaCamera, QrCode } from 'lucide-react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
// Lettore ML Kit (anche Android): `useObjectOutput` del core legge i QR solo su iOS.
import { useBarcodeScannerOutput, type Barcode } from 'react-native-vision-camera-barcode-scanner';
import { t } from './lingua';
import { colori } from './theme/colori';
import { spazio, useColori } from './theme';
import { Intestazione } from './ui/Intestazione';
import { Pulsante } from './ui/Pulsante';
import { Testo } from './ui/Testo';
import { leggiQr, verificaAbbinamento, type Abbinamento } from './wifi';

type Props = {
  onAbbinato: (a: Abbinamento, archivio: string) => void;
  onAnnulla: () => void;
};

const scuro = colori.scuro;

export function Abbina({ onAbbinato, onAnnulla }: Props) {
  const c = useColori();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [stato, setStato] = useState(() => t('Inquadra il codice QR sul computer.'));
  const inVerifica = useRef(false);

  const letti = useCallback((codici: Barcode[]) => {
    if (inVerifica.current) return;
    for (const codice of codici) {
      if (!codice.rawValue) continue;
      const a = leggiQr(codice.rawValue);
      if (!a) { setStato(t('Questo QR non è di ArchiView.')); continue; }
      inVerifica.current = true;
      setStato(t('Collegamento a {host}…', { host: a.host }));
      verificaAbbinamento(a)
        .then(archivio => onAbbinato(a, archivio))
        .catch(e => {
          console.warn('[abbina] desktop non raggiungibile', e);
          setStato(t('Computer non raggiungibile: stessa rete Wi-Fi? Riprova.'));
          inVerifica.current = false;
        });
      return;
    }
  }, [onAbbinato]);
  const qr = useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: letti,
    onError: e => console.warn('[abbina] lettore QR', e)
  });

  if (!hasPermission || !device) {
    return (
      <View style={{ flex: 1 }}>
        <Intestazione titolo={t('Abbina col computer')} sotto={t('Wi-Fi diretto')} onIndietro={onAnnulla} />
        <View style={{ flex: 1, padding: spazio.lg, gap: spazio.md, justifyContent: 'center' }}>
          <IconaCamera size={40} color={c.textMuted} />
          <Testo variante="sezione" accessibilityRole="header">{device ? t('Serve la fotocamera') : t('Nessuna fotocamera posteriore')}</Testo>
          <Testo>{device ? t('L\'abbinamento usa la fotocamera per leggere il QR.') : t('Senza fotocamera non si legge il QR: usa l\'invio con Google Drive.')}</Testo>
          {device && <Pulsante variante="primario" titolo={t('Consenti')} onPress={requestPermission} />}
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: scuro.bgBase }}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[qr]} />
      <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spazio.md, paddingBottom: spazio.xl, flexDirection: 'row', alignItems: 'center', gap: spazio.md, backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <QrCode size={24} color={scuro.textMain} />
        <Testo style={{ flex: 1, color: scuro.textMain }}>{stato}</Testo>
        <Pulsante variante="secondario" titolo={t('Annulla')} onPress={onAnnulla} />
      </View>
    </View>
  );
}
