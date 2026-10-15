import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { scriviAtomico } from './scritturaAtomica';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// --- Mappa dei chunk ---------------------------------------------------------
// `<workspace>/.archiview-chunkmap.json`: chiave → { mtimeMs, size, valore }. Una sync senza
// modifiche non rilegge né rihasha gli allegati invariati. Sta fuori dalle cartelle di cache,
// che si cancellano a fine sync.
// ponytail: le voci di allegati cancellati restano nella mappa (pochi byte l'una); potarle se cresce.
type MappaChunk = Record<string, { mtimeMs: number; size: number; valore: any }>;

export function percorsoMappaChunk(workspacePath: string): string {
    return path.join(workspacePath, '.archiview-chunkmap.json');
}

export function leggiMappaChunk(workspacePath: string): MappaChunk {
    try {
        const m = JSON.parse(fs.readFileSync(percorsoMappaChunk(workspacePath), 'utf8'));
        if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
        // Gli hash diventano percorsi in cache da caricare: solo hash validi, come per index.json.
        for (const k of Object.keys(m)) {
            const v = m[k] && m[k].valore;
            if (!Array.isArray(v) || !v.every(isChunkHash)) delete m[k];
        }
        return m;
    } catch {
        return {}; // assente o corrotta: si ricalcola tutto
    }
}

export async function scriviMappaChunk(workspacePath: string, mappa: MappaChunk): Promise<void> {
    try {
        await scriviAtomico(percorsoMappaChunk(workspacePath), JSON.stringify(mappa));
    } catch (e) {
        console.warn('[chunkmap] scrittura non riuscita, la prossima sync ricalcola:', e);
    }
}

/** `calcola()` solo se il file è cambiato (mtime o dimensione) rispetto alla voce `chiave`. */
export async function conMappaChunk<T>(mappa: MappaChunk, chiave: string, filePath: string,
                                       calcola: () => Promise<T>): Promise<{ valore: T; ricalcolato: boolean }> {
    const st = await fs.promises.stat(filePath);
    const voce = mappa[chiave];
    if (voce && voce.mtimeMs === st.mtimeMs && voce.size === st.size) return { valore: voce.valore, ricalcolato: false };
    const valore = await calcola();
    mappa[chiave] = { mtimeMs: st.mtimeMs, size: st.size, valore };
    return { valore, ricalcolato: true };
}

/**
 * Splits a file into chunks of a specified size, computes the SHA-256 hash for each chunk,
 * and saves them locally. Returns an array of the chunk hashes.
 * 
 * @param filePath Path to the original file
 * @param cacheDir Directory where chunks should be saved
 * @param chunkSize Size of each chunk in bytes (default 5MB)
 * @returns Array of SHA-256 hashes representing the chunks in order
 */
export async function splitFileIntoChunks(filePath: string, cacheDir: string, chunkSize: number = DEFAULT_CHUNK_SIZE): Promise<string[]> {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const chunkHashes: string[] = [];
    const fileHandle = await fs.promises.open(filePath, 'r');
    
    try {
        const stats = await fileHandle.stat();
        let bytesReadTotal = 0;
        
        while (bytesReadTotal < stats.size) {
            const bytesToRead = Math.min(chunkSize, stats.size - bytesReadTotal);
            const buffer = Buffer.alloc(bytesToRead);
            const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, bytesReadTotal);
            
            if (bytesRead === 0) break;

            const actualBuffer = bytesRead === bytesToRead ? buffer : buffer.subarray(0, bytesRead);
            
            const hash = crypto.createHash('sha256').update(actualBuffer).digest('hex');
            const chunkPath = path.join(cacheDir, hash);
            
            // Write chunk to disk only if it doesn't already exist to save I/O
            if (!fs.existsSync(chunkPath)) {
                await fs.promises.writeFile(chunkPath, actualBuffer);
            }
            
            chunkHashes.push(hash);
            bytesReadTotal += bytesRead;
        }
    } finally {
        await fileHandle.close();
    }

    return chunkHashes;
}

/**
 * Reassembles a file from an array of chunk hashes.
 * 
 * @param chunkHashes Array of SHA-256 hashes
 * @param cacheDir Directory where chunks are stored
 * @param destinationFilePath Output path for the reassembled file
 */
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const CACHE_DIR_MAX = 50;
const resolvedCacheDirCache = new Map<string, string>();

export function isChunkHash(hash: unknown): hash is string {
    return typeof hash === 'string' && SHA256_HEX_RE.test(hash);
}

/**
 * Tiene di un indice remoto (`index.json` su Drive, scrivibile da ogni collaboratore) solo le
 * voci con una lista di hash ben formati. Gli hash diventano nomi di file nella cache: una voce
 * con un "hash" come `../../x.bat` farebbe scaricare un file fuori dalla cache, quindi la voce
 * intera viene scartata, non ripulita (un file ricomposto senza un chunk sarebbe corrotto).
 */
export function filtraIndiceChunk(indice: unknown): { indice: Record<string, string[]>; scartate: string[] } {
    const pulito: Record<string, string[]> = {};
    const scartate: string[] = [];
    if (!indice || typeof indice !== 'object' || Array.isArray(indice)) return { indice: pulito, scartate };
    for (const [nome, hashes] of Object.entries(indice as Record<string, unknown>)) {
        if (Array.isArray(hashes) && hashes.every(isChunkHash)) pulito[nome] = hashes as string[];
        else scartate.push(nome);
    }
    return { indice: pulito, scartate };
}

/** SHA-256 di un file letto in streaming (i chunk arrivano a 5 MB: niente buffer interi). */
export async function hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    for await (const blocco of fs.createReadStream(filePath)) hash.update(blocco as Buffer);
    return hash.digest('hex');
}

export function safeChunkPath(cacheDir: string, hash: string): string {
    if (!SHA256_HEX_RE.test(hash)) {
        throw new Error(`Hash chunk non valido (formato inatteso): ${hash}`);
    }
    if (!resolvedCacheDirCache.has(cacheDir)) {
        if (resolvedCacheDirCache.size >= CACHE_DIR_MAX) {
            resolvedCacheDirCache.delete(resolvedCacheDirCache.keys().next().value!);
        }
        resolvedCacheDirCache.set(cacheDir, path.resolve(cacheDir));
    }
    const resolvedCache = resolvedCacheDirCache.get(cacheDir)!;
    const chunkPath = path.resolve(path.join(cacheDir, hash));
    if (!chunkPath.startsWith(resolvedCache + path.sep) && chunkPath !== resolvedCache) {
        throw new Error(`Path traversal rilevato per hash: ${hash}`);
    }
    return chunkPath;
}

export async function assembleFileFromChunks(chunkHashes: string[], cacheDir: string, destinationFilePath: string): Promise<void> {
    const destDir = path.dirname(destinationFilePath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    // Validazione PRIMA di aprire la destinazione: un file creato e lasciato vuoto da un chunk
    // mancante risulterebbe "già presente" alla sync successiva e non verrebbe più riscaricato.
    const chunkPaths = chunkHashes.map((hash) => {
        const chunkPath = safeChunkPath(cacheDir, hash);
        if (!fs.existsSync(chunkPath)) throw new Error(`Chunk mancante nella cache locale: ${hash}`);
        return chunkPath;
    });

    const fileHandle = await fs.promises.open(destinationFilePath, 'w');

    try {
        for (const chunkPath of chunkPaths) {
            const chunkData = await fs.promises.readFile(chunkPath);
            await fileHandle.write(chunkData);
        }
    } finally {
        await fileHandle.close();
    }
}
