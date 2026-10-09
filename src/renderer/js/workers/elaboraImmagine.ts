// P4 — elaborazioni per l'inchiostro sbiadito, in un Web Worker: su una carta da 12 Mpx un
// passaggio per pixel bloccherebbe l'interfaccia per secondi.
//
// Riceve { id, bitmap, modo, soglia } (bitmap trasferita, già ridotta dal renderer), risponde
// { id, blob } in JPEG o { id, errore }. Gli algoritmi sono funzioni pure su RGBA, esportate
// anche per test/elaboraImmagine.test.js.
//
// Script classico, non modulo: niente import, e la doppia esposizione in coda come model.ts.

/** Luminanza Rec. 601 intera, 0–255. */
function avLuma(r: number, g: number, b: number): number {
    return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Un solo canale in scala di grigi: il rosso fa sparire le rigature, il blu stacca l'inchiostro. */
function avCanale(px: Uint8ClampedArray, c: 0 | 1 | 2) {
    for (let i = 0; i < px.length; i += 4) {
        const v = px[i + c];
        px[i] = v; px[i + 1] = v; px[i + 2] = v;
    }
}

/** Livelli automatici: stira fra il 1° e il 99° percentile della luminanza. */
function avLivelli(px: Uint8ClampedArray) {
    const isto = new Uint32Array(256);
    const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) isto[avLuma(px[i], px[i + 1], px[i + 2]) | 0]++;
    let lo = 0, hi = 255, acc = 0;
    for (; lo < 255 && (acc += isto[lo]) < n * 0.01; lo++);
    acc = 0;
    for (; hi > 0 && (acc += isto[hi]) < n * 0.01; hi--);
    if (hi <= lo) return;
    const k = 255 / (hi - lo);
    for (let i = 0; i < px.length; i += 4) {
        px[i] = (px[i] - lo) * k; px[i + 1] = (px[i + 1] - lo) * k; px[i + 2] = (px[i + 2] - lo) * k;
    }
}

/** Bianco e nero sulla luminanza. */
function avSoglia(px: Uint8ClampedArray, soglia: number) {
    for (let i = 0; i < px.length; i += 4) {
        const v = avLuma(px[i], px[i + 1], px[i + 2]) >= soglia ? 255 : 0;
        px[i] = v; px[i + 1] = v; px[i + 2] = v;
    }
}

/** Autovalori e autovettori (colonne di `v`) di una matrice simmetrica 3×3, metodo di Jacobi. */
function avJacobi3(a: number[][]): { l: number[]; v: number[][] } {
    const m = a.map(r => r.slice());
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let giro = 0; giro < 50; giro++) {
        let p = 0, q = 1;
        if (Math.abs(m[0][2]) > Math.abs(m[p][q])) { p = 0; q = 2; }
        if (Math.abs(m[1][2]) > Math.abs(m[p][q])) { p = 1; q = 2; }
        if (Math.abs(m[p][q]) < 1e-9) break;
        const t = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const tan = Math.sign(t || 1) / (Math.abs(t) + Math.sqrt(t * t + 1));
        const c = 1 / Math.sqrt(tan * tan + 1), s = tan * c;
        for (let k = 0; k < 3; k++) {
            const mkp = m[k][p], mkq = m[k][q];
            m[k][p] = c * mkp - s * mkq; m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < 3; k++) {
            const mpk = m[p][k], mqk = m[q][k];
            m[p][k] = c * mpk - s * mqk; m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < 3; k++) {
            const vkp = v[k][p], vkq = v[k][q];
            v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
        }
    }
    return { l: [m[0][0], m[1][1], m[2][2]], v };
}

/**
 * Decorrelation stretch (il principio di DStretch, spazio RGB): i tre canali vengono resi
 * indipendenti e ciascuno stirato alla stessa varianza, così differenze di colore minime —
 * un inchiostro ferro-gallico sbiadito sulla pergamena — diventano colori diversi.
 */
function avDstretch(px: Uint8ClampedArray, sigma = 55) {
    const passo = Math.max(1, Math.floor(px.length / 4 / 200000)) * 4; // campione, non ogni pixel
    let n = 0;
    const media = [0, 0, 0];
    for (let i = 0; i < px.length; i += passo) { media[0] += px[i]; media[1] += px[i + 1]; media[2] += px[i + 2]; n++; }
    media[0] /= n; media[1] /= n; media[2] /= n;
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < px.length; i += passo) {
        const d = [px[i] - media[0], px[i + 1] - media[1], px[i + 2] - media[2]];
        for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) cov[a][b] += d[a] * d[b];
    }
    for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) { cov[a][b] /= n; cov[b][a] = cov[a][b]; }
    const { l, v } = avJacobi3(cov);
    // T = V · diag(sigma/√λ) · Vᵀ
    const t = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += v[a][k] * (sigma / Math.sqrt(Math.max(l[k], 1e-3))) * v[b][k];
        t[a][b] = s;
    }
    for (let i = 0; i < px.length; i += 4) {
        const d0 = px[i] - media[0], d1 = px[i + 1] - media[1], d2 = px[i + 2] - media[2];
        px[i] = 128 + t[0][0] * d0 + t[0][1] * d1 + t[0][2] * d2;
        px[i + 1] = 128 + t[1][0] * d0 + t[1][1] * d1 + t[1][2] * d2;
        px[i + 2] = 128 + t[2][0] * d0 + t[2][1] * d1 + t[2][2] * d2;
    }
}

/** Applica `modo` sul posto. Modo sconosciuto = errore: un dato arrivato male non passa muto. */
function avElabora(px: Uint8ClampedArray, modo: string, soglia: number) {
    switch (modo) {
        case 'r': return avCanale(px, 0);
        case 'g': return avCanale(px, 1);
        case 'b': return avCanale(px, 2);
        case 'livelli': return avLivelli(px);
        case 'soglia': return avSoglia(px, Number.isFinite(soglia) ? soglia : 128);
        case 'dstretch': return avDstretch(px);
        default: throw new Error('Elaborazione sconosciuta: ' + modo);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { avElabora, avJacobi3, avLuma };
} else if (typeof OffscreenCanvas !== 'undefined') {
    self.onmessage = async (e: MessageEvent) => {
        const { id, bitmap, modo, soglia } = e.data || {};
        try {
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            const dati = ctx.getImageData(0, 0, canvas.width, canvas.height);
            avElabora(dati.data, modo, soglia);
            ctx.putImageData(dati, 0, 0);
            const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
            (self as any).postMessage({ id, blob });
        } catch (err) {
            (self as any).postMessage({ id, errore: String(err && err.message || err) });
        }
    };
}
