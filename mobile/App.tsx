// Fase 0 — prova tecnica (PIANO-SCANNER.md): accesso Google, scatto "documento" (ML Kit) e
// "grezza" (fotocamera senza correzioni), invio di un lotto su Drive. Non è l'interfaccia
// definitiva: serve a verificare scope, cartelle condivise con il desktop e qualità.
// Stringhe in italiano senza i18n: Lingui arriva in Fase 5.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { launchDocumentScannerAsync, ResultFormatOptions, ScannerModeOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { accedi, esci, utenteSilenzioso, type Utente } from './src/accesso';
import { inviaLotto } from './src/drive';
import { aggiungiPagina, eliminaLotto, fileDellaPagina, manifest, nuovoLotto, type Bozza } from './src/lotti';

export default function App() {
  const [utente, setUtente] = useState<Utente | null>(null);
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [esito, setEsito] = useState<string>('');

  useEffect(() => { utenteSilenzioso().then(setUtente); }, []);

  async function esegui(etichetta: string, fn: () => Promise<void>) {
    setOccupato(etichetta);
    try {
      await fn();
    } catch (e: any) {
      console.error('[prova]', etichetta, e);
      Alert.alert('Errore', `${etichetta}: ${e?.message || String(e)}`);
    } finally {
      setOccupato(null);
    }
  }

  const lottoCorrente = () => bozza || nuovoLotto();

  const scattaDocumento = () => esegui('Scansione documento', async () => {
    const r = await launchDocumentScannerAsync({
      pageLimit: 20,
      galleryImportAllowed: false,
      scannerMode: ScannerModeOptions.FULL,
      resultFormats: ResultFormatOptions.JPEG
    });
    if (r.canceled || !r.pages) return;
    let b = lottoCorrente();
    for (const uri of r.pages) b = await aggiungiPagina(b, uri, 'documento');
    setBozza(b);
  });

  const scattaGrezza = () => esegui('Foto grezza', async () => {
    const permesso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permesso.granted) throw new Error('permesso_fotocamera_negato');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false });
    if (r.canceled) return;
    let b = lottoCorrente();
    for (const a of r.assets) b = await aggiungiPagina(b, a.uri, 'grezza', { larghezza: a.width, altezza: a.height });
    setBozza(b);
  });

  const invia = () => esegui('Invio su Drive', async () => {
    if (!bozza) return;
    const t0 = Date.now();
    await inviaLotto(manifest(bozza, `${Platform.OS} ${Platform.Version}`), nome => fileDellaPagina(bozza, nome), a => setOccupato(`Invio ${a.fatte}/${a.totali}`));
    const mb = bozza.pagine.reduce((s, p) => s + p.byte, 0) / 1048576;
    setEsito(`Lotto ${bozza.id} inviato: ${bozza.pagine.length} pagine, ${mb.toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    eliminaLotto(bozza);
    setBozza(null);
  });

  return (
    <ScrollView contentContainerStyle={stili.contenitore}>
      <Text style={stili.titolo}>ArchiView Scanner — prova tecnica</Text>
      {utente ? (
        <View style={stili.riga}>
          <Text style={stili.testo}>{utente.email}</Text>
          <Button title="Esci" onPress={() => esegui('Uscita', async () => { await esci(); setUtente(null); })} />
        </View>
      ) : (
        <Button title="Accedi con Google" onPress={() => esegui('Accesso', async () => setUtente(await accedi()))} />
      )}

      <View style={stili.riga}>
        <Button title="Documento" onPress={scattaDocumento} disabled={!!occupato} />
        <Button title="Grezza" onPress={scattaGrezza} disabled={!!occupato} />
      </View>

      {bozza && (
        <View>
          <Text style={stili.testo}>Lotto {bozza.id} — {bozza.pagine.length} pagine</Text>
          {bozza.pagine.map(p => (
            <View key={p.file} style={stili.pagina}>
              <Image source={{ uri: fileDellaPagina(bozza, p.file).uri }} style={stili.miniatura} />
              <Text style={stili.testo}>
                {p.file} · {p.modalita} · {(p.byte / 1048576).toFixed(2)} MB{p.larghezza ? ` · ${p.larghezza}×${p.altezza}` : ''}
              </Text>
            </View>
          ))}
          <Button title="Invia su Drive" onPress={invia} disabled={!utente || !!occupato || !bozza.pagine.length} />
        </View>
      )}

      {occupato && <View style={stili.riga}><ActivityIndicator /><Text style={stili.testo}>{occupato}</Text></View>}
      {!!esito && <Text style={stili.testo}>{esito}</Text>}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const stili = StyleSheet.create({
  contenitore: { padding: 16, paddingTop: 48, gap: 16 },
  titolo: { fontSize: 20, fontWeight: '600' },
  testo: { fontSize: 14, flexShrink: 1 },
  riga: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pagina: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  miniatura: { width: 64, height: 86, backgroundColor: '#ddd' }
});
