import { parentPort as portaGrezza, workerData } from 'worker_threads';
import { IndiceMemoria } from './indiceMemoria';

if (!portaGrezza) throw new Error('worker.ts va avviato come worker_thread');
const parentPort = portaGrezza;
const indice = new IndiceMemoria(workerData || {});
const inCorso = new Map<number, AbortController>();
const OPERAZIONI = new Set(['sincronizza', 'cerca', 'scheda', 'invalida']);

parentPort.on('message', async (msg: any) => {
  if (!msg || typeof msg.reqId !== 'number') return;
  if (msg.op === 'annulla') {
    const c = inCorso.get(msg.reqId);
    if (c) c.abort();
    return;
  }
  if (!OPERAZIONI.has(msg.op)) {
    parentPort.postMessage({ reqId: msg.reqId, ok: false, errore: { name: 'Error', message: 'Operazione sconosciuta: ' + msg.op } });
    return;
  }
  const controllo = new AbortController();
  inCorso.set(msg.reqId, controllo);
  try {
    const args = Array.isArray(msg.args) ? msg.args : [];
    const valore = msg.op === 'cerca'
      ? await indice.cerca(args[0], controllo.signal)
      : await indice[msg.op](...args);
    parentPort.postMessage({ reqId: msg.reqId, ok: true, valore });
  } catch (e) {
    parentPort.postMessage({ reqId: msg.reqId, ok: false, errore: { name: (e && e.name) || 'Error', message: (e && e.message) || String(e) } });
  } finally {
    inCorso.delete(msg.reqId);
  }
});

parentPort.postMessage({ pronto: true });
export {};
