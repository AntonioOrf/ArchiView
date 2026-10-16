import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { scriviAtomico } from './scritturaAtomica';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

// ponytail: le voci di allegati cancellati restano nella mappa (pochi byte l'una); potarle se cresce.
type MappaChunk = Record<string, { mtimeMs: number; size: number; valore: any }>;

export function percorsoMappaChunk(workspacePath: string): string {
    return path.join(workspacePath, '.archiview-chunkmap.json');
}

export function leggiMappaChunk(workspacePath: string): MappaChunk {
    try {
        const m = JSON.parse(fs.readFileSync(percorsoMappaChunk(workspacePath), 'utf8'));
        if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
        for (const k of Object.keys(m)) {
            const v = m[k] && m[k].valore;
            if (!Array.isArray(v) || !v.every(isChunkHash)) delete m[k];
        }
        return m;
    } catch {
        return {};
    }
}

export async function scriviMappaChunk(workspacePath: string, mappa: MappaChunk): Promise<void> {
    try {
        await scriviAtomico(percorsoMappaChunk(workspacePath), JSON.stringify(mappa));
    } catch (e) {
        console.warn('[chunkmap] scrittura non riuscita, la prossima sync ricalcola:', e);
    }
}

export async function conMappaChunk<T>(mappa: MappaChunk, chiave: string, filePath: string,
                                       calcola: () => Promise<T>): Promise<{ valore: T; ricalcolato: boolean }> {
    const st = await fs.promises.stat(filePath);
    const voce = mappa[chiave];
    if (voce && voce.mtimeMs === st.mtimeMs && voce.size === st.size) return { valore: voce.valore, ricalcolato: false };
    const valore = await calcola();
    mappa[chiave] = { mtimeMs: st.mtimeMs, size: st.size, valore };
    return { valore, ricalcolato: true };
}

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

const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const CACHE_DIR_MAX = 50;
const resolvedCacheDirCache = new Map<string, string>();

export function isChunkHash(hash: unknown): hash is string {
    return typeof hash === 'string' && SHA256_HEX_RE.test(hash);
}

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
