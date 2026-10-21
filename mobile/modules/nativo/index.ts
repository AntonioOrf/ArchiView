import { requireNativeModule } from 'expo-modules-core';

type Nativo = {
  raddrizza(sorgente: string, angoli: number[], latoMassimo: number, qualita: number): Promise<{ uri: string; width: number; height: number }>;
  impronta(uri: string): Promise<{ sha256: string; byte: number }>;
  preparaScanner(): Promise<boolean>;
};

export default requireNativeModule<Nativo>('Nativo');
