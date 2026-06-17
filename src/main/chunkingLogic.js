import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
/**
 * Splits a file into chunks of a specified size, computes the SHA-256 hash for each chunk,
 * and saves them locally. Returns an array of the chunk hashes.
 *
 * @param filePath Path to the original file
 * @param cacheDir Directory where chunks should be saved
 * @param chunkSize Size of each chunk in bytes (default 5MB)
 * @returns Array of SHA-256 hashes representing the chunks in order
 */
export async function splitFileIntoChunks(filePath, cacheDir, chunkSize = DEFAULT_CHUNK_SIZE) {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const chunkHashes = [];
    const fileHandle = await fs.promises.open(filePath, 'r');
    try {
        const stats = await fileHandle.stat();
        let bytesReadTotal = 0;
        while (bytesReadTotal < stats.size) {
            const bytesToRead = Math.min(chunkSize, stats.size - bytesReadTotal);
            const buffer = Buffer.alloc(bytesToRead);
            const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, bytesReadTotal);
            if (bytesRead === 0)
                break;
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
    }
    finally {
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
export async function assembleFileFromChunks(chunkHashes, cacheDir, destinationFilePath) {
    const destDir = path.dirname(destinationFilePath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const fileHandle = await fs.promises.open(destinationFilePath, 'w');
    try {
        for (const hash of chunkHashes) {
            const chunkPath = path.join(cacheDir, hash);
            if (!fs.existsSync(chunkPath)) {
                throw new Error(`Chunk mancante nella cache locale: ${hash}`);
            }
            const chunkData = await fs.promises.readFile(chunkPath);
            await fileHandle.write(chunkData);
        }
    }
    finally {
        await fileHandle.close();
    }
}
