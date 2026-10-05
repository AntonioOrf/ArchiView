// Ricerca tra archivi — il worker. Ospita l'indice fuori dal thread del main, così
// `JSON.parse` di un database grande e la scansione non fermano l'interfaccia (regola 5).
//
// Protocollo (tutti dati clonabili):
//   in:  { reqId, op: 'sincronizza'|'cerca'|'scheda'|'invalida', args }   |  { op: 'annulla', reqId }
//   out: { pronto: true }  una volta, all'avvio
//        { reqId, ok: true, valore }  |  { reqId, ok: false, errore: { name, message } }
//
// Il worker NON decide quali archivi leggere: riceve percorsi già risolti dal main, che li
// prende dalle impostazioni e mai dal renderer.

const { parentPort, workerData } = require('worker_threads');
const { IndiceMemoria } = require('./indiceMemoria');

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
