import { requireNativeModule } from 'expo-modules-core';

type Nativo = {
  raddrizza(sorgente: string, angoli: number[], latoMassimo: number, qualita: number): Promise<{ uri: string; width: number; height: number }>;
  impronta(uri: string): Promise<{ sha256: string; byte: number }>;
  preparaScanner(): Promise<boolean>;
  avviaInvio(titolo: string, testo: string, canaleInvio: string, canaleEsito: string): void;
  aggiornaInvio(titolo: string, testo: string, fatte: number, totali: number): void;
  fermaInvio(titolo: string | null, testo: string | null, ok: boolean): void;
};

export default requireNativeModule<Nativo>('Nativo');
