import { File, UploadType } from 'expo-file-system';
import { ScannerLotto, type Lotto } from './contratto';
import type { Avanzamento } from './drive';

import type { Abbinamento } from './qr';
export { leggiQr, type Abbinamento } from './qr';

const base = (a: Abbinamento) => `http://${a.host}:${a.porta}`;
const auth = (a: Abbinamento) => ({ Authorization: `Bearer ${a.token}` });

export async function verificaAbbinamento(a: Abbinamento): Promise<string> {
  const res = await fetch(`${base(a)}/ping`, { headers: auth(a) });
  if (!res.ok) throw new Error(`wifi_${res.status}`);
  return (await res.json()).archivio;
}

export const abbinamentoPerso = (e: unknown) => /^wifi_(401|rete)\b/.test(String((e as Error)?.message));

const inRete = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    throw new Error(`wifi_rete: ${e?.message || String(e)}`);
  }
};

export function inviaLottoWifi(a: Abbinamento) {
  return async (lotto: Lotto, fileDi: (nome: string) => File, avanzamento?: (x: Avanzamento) => void): Promise<void> => {
    const esito = ScannerLotto.valida(lotto);
    if (!esito.ok) throw new Error('lotto_non_valido: ' + esito.errori.map(e => e.codice + '@' + e.percorso).join(', '));
    const pulito = esito.lotto;
    let fatte = 0;
    for (const pg of pulito.pagine) {
      const r = await inRete(() => fileDi(pg.file).upload(`${base(a)}/lotti/${pulito.id}/${pg.file}`, {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: { ...auth(a), 'Content-Type': 'application/octet-stream' }
      }));
      if (r.status !== 204) throw new Error(`wifi_${r.status}: ${pg.file}`);
      avanzamento?.({ fatte: ++fatte, totali: pulito.pagine.length });
    }
    const res = await inRete(() => fetch(`${base(a)}/lotti/${pulito.id}/${ScannerLotto.NOME_MANIFEST}`, {
      method: 'PUT',
      headers: { ...auth(a), 'Content-Type': 'application/json' },
      body: JSON.stringify(pulito)
    }));
    if (res.status !== 201) throw new Error(`wifi_${res.status}: ${await res.text().catch(() => '')}`);
  };
}
