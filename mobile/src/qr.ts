export type Abbinamento = { host: string; porta: number; token: string };

function ipPrivato(host: string): boolean {
  const n = host.split('.').map(Number);
  if (n.length !== 4 || n.some(x => !Number.isInteger(x) || x < 0 || x > 255) || !/^[\d.]+$/.test(host)) return false;
  return n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168);
}

export function leggiQr(testo: string): Abbinamento | null {
  const m = /^archiview-scanner:\/\/abbina\?(.*)$/.exec(testo.trim());
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const host = q.get('h') || '';
  const porta = Number(q.get('p'));
  const token = q.get('t') || '';
  if (!ipPrivato(host)) return null;
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535 || !/^[0-9a-f]{64}$/.test(token)) return null;
  return { host, porta, token };
}
