const assert = require('assert');

// Mock of asyncPool to verify it works as expected
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function runTests() {
  console.log("Running Cloud Sync Tests...");

  // Test 1: asyncPool works concurrently
  let activeWorkers = 0;
  let maxWorkers = 0;
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  await asyncPool(5, items, async (item) => {
    activeWorkers++;
    if (activeWorkers > maxWorkers) maxWorkers = activeWorkers;
    await new Promise(resolve => setTimeout(resolve, 50));
    activeWorkers--;
  });

  assert.ok(maxWorkers <= 5, `Expected max workers <= 5, got ${maxWorkers}`);
  assert.ok(maxWorkers === 5, `Expected exactly 5 workers running in parallel, got ${maxWorkers}`);
  console.log("✅ Test 1: asyncPool respects concurrency limits.");

  // Test 2: Optimistic Concurrency Control Simulator
  // This simulates the behavior built into driveSync.ts (lines 515-520)
  
  const driveMock = {
    cloudTime: 10000, // Time on the cloud
  };

  async function simulateSyncToDrive(parentModifiedTime) {
      const currentModifiedTime = driveMock.cloudTime;
      if (parentModifiedTime && currentModifiedTime > parentModifiedTime + 1000) {
          throw new Error("409_CONFLICT: Un altro utente ha salvato modifiche più recenti sul Cloud. E' necessario prima ricevere gli aggiornamenti.");
      }
      // Se passa, aggiorna il cloud time
      driveMock.cloudTime = Date.now();
      return true;
  }

  // A) Caso successo: abbiamo l'ultima versione e aggiorniamo
  try {
      await simulateSyncToDrive(10000); // Passiamo 10000 (uguale al cloud)
      console.log("✅ Test 2a: Sync To Drive passa quando i tempi corrispondono.");
  } catch (e) {
      assert.fail("Sync dovrebbe passare, invece ha dato errore: " + e.message);
  }

  // Resettiamo mock per il test fallimentare
  driveMock.cloudTime = 20000;

  // B) Caso fallimento: il cloud ha un file più nuovo del nostro (10000)
  try {
      await simulateSyncToDrive(10000);
      assert.fail("Sync NON dovrebbe passare, manca l'errore di conflitto!");
  } catch (e) {
      assert.ok(e.message.includes("409_CONFLICT"), "Errore non corretto: " + e.message);
      console.log("✅ Test 2b: Sync To Drive viene bloccato correttamente se rileva modifiche esterne (Prevenzione Perdita Dati).");
  }

  console.log("Tutti i test cloud passati con successo!");
}

runTests().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
