import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { avviso } from '../ui/Avviso';
import { Camera as IconaCamera } from 'lucide-react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { t } from '../lingua';
import { colori } from '../theme/colori';
import { raggio, spazio, useColori } from '../theme';
import { Intestazione } from '../ui/Intestazione';
import { Pulsante } from '../ui/Pulsante';
import { Testo } from '../ui/Testo';

type Props = {
  titolo: string;
  onFine: (uris: string[]) => void;
};

const scuro = colori.scuro;

export function Fotocamera({ titolo, onFine }: Props) {
  const c = useColori();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const foto = usePhotoOutput({ qualityPrioritization: 'quality' });
  const [scattate, setScattate] = useState<string[]>([]);
  const [scatto, setScatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!scattate.length) { onFine([]); return true; }
      avviso(t('Conservare le foto?'), t('{n} foto non ancora salvate.', { n: scattate.length }), [
        { text: t('Scarta'), style: 'destructive', onPress: () => onFine([]) },
        { text: t('Conserva'), onPress: () => onFine(scattate) }
      ]);
      return true;
    });
    return () => s.remove();
  }, [scattate, onFine]);

  const scatta = async () => {
    if (scatto) return;
    setScatto(true);
    setErrore(null);
    try {
      const { filePath } = await foto.capturePhotoToFile({ flashMode: 'off', enableShutterSound: true }, {});
      setScattate(s => [...s, filePath.startsWith('file://') ? filePath : `file://${filePath}`]);
    } catch (e: any) {
      console.warn('[fotocamera] scatto non riuscito', e);
      setErrore(t('Scatto non riuscito: riprova.'));
    } finally {
      setScatto(false);
    }
  };

  if (!hasPermission || !device) {
    return (
      <View style={{ flex: 1 }}>
        <Intestazione titolo={t('Foto libera')} sotto={titolo} onIndietro={() => onFine([])} />
        <View style={{ flex: 1, padding: spazio.lg, gap: spazio.md, justifyContent: 'center' }}>
          <IconaCamera size={40} color={c.textMuted} />
          <Testo variante="sezione" accessibilityRole="header">{device ? t('Serve la fotocamera') : t('Nessuna fotocamera posteriore')}</Testo>
          <Testo>{device ? t('La foto libera usa la fotocamera direttamente, senza lo scanner.') : t('Senza fotocamera usa «Scansiona».')}</Testo>
          {device && <Pulsante variante="primario" titolo={t('Consenti')} onPress={requestPermission} />}
        </View>
      </View>
    );
  }

  const n = scattate.length;
  return (
    <View style={{ flex: 1, backgroundColor: scuro.bgBase }}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[foto]} />
      <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spazio.md, paddingBottom: spazio.xl, gap: spazio.sm, backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <Testo style={{ color: scuro.textMain }}>{errore ?? (n ? t('{n} foto · senza ritaglio', { n }) : t('Senza ritaglio: sigilli, filigrane, legature, dettagli.'))}</Testo>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pulsante variante="secondario" titolo={t('Annulla')} onPress={() => (n ? avviso(t('Scartare le foto?'), t('{n} foto non ancora salvate.', { n }), [
            { text: t('No'), style: 'cancel' },
            { text: t('Scarta'), style: 'destructive', onPress: () => onFine([]) }
          ]) : onFine([]))} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('Scatta')} accessibilityState={{ disabled: scatto, busy: scatto }} disabled={scatto} onPress={scatta}
            style={({ pressed }) => ({ width: 72, height: 72, borderRadius: raggio.tondo, borderWidth: 4, borderColor: scuro.textMain, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' })}>
            {scatto && <ActivityIndicator color={scuro.textMain} />}
          </Pressable>
          <Pulsante variante="primario" titolo={t('Fine')} disabilitato={!n || scatto} onPress={() => onFine(scattate)} />
        </View>
      </View>
    </View>
  );
}
