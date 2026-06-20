import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { splitFileIntoChunks, assembleFileFromChunks } from './src/main/chunkingLogic';

async function runTest() {
    console.log("Creazione file fittizio...");
    const testFile = path.join(__dirname, 'dummy_test.bin');
    const cacheDir = path.join(__dirname, '.dummy_chunks');
    const restoredFile = path.join(__dirname, 'dummy_restored.bin');

    // Crea un file da 12MB con dati pseudo-casuali (12MB è più grande del chunk size di 5MB)
    const buf = crypto.randomBytes(12 * 1024 * 1024);
    fs.writeFileSync(testFile, buf);
    const originalHash = crypto.createHash('sha256').update(buf).digest('hex');
    console.log(`Hash originale del file da 12MB: ${originalHash}`);

    try {
        console.log("Divisione in blocchi...");
        // Usa una chunkSize più piccola per il test se vogliamo (o lascia default 5MB)
        const hashes = await splitFileIntoChunks(testFile, cacheDir, 5 * 1024 * 1024);
        console.log("File diviso in blocchi con hash:");
        hashes.forEach((h, i) => console.log(` - Blocco ${i+1}: ${h}`));

        console.log("Riassemblaggio...");
        await assembleFileFromChunks(hashes, cacheDir, restoredFile);
        console.log("Riassemblaggio completato.");

        const restoredBuf = fs.readFileSync(restoredFile);
        const restoredHash = crypto.createHash('sha256').update(restoredBuf).digest('hex');
        console.log(`Hash riassemblato: ${restoredHash}`);

        if (originalHash === restoredHash) {
            console.log("✅ TEST PASSATO: Il file riassemblato è identico all'originale.");
        } else {
            console.error("❌ TEST FALLITO: L'hash non corrisponde!");
        }
    } catch (e) {
        console.error("Errore durante il test:", e);
    } finally {
        // Pulizia
        console.log("Pulizia dei file temporanei...");
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        if (fs.existsSync(restoredFile)) fs.unlinkSync(restoredFile);
        if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
    }
}

runTest();
