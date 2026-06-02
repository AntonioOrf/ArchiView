const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, '../src/renderer/index.html');
const outDir = path.join(__dirname, '../out/renderer');
const outFile = path.join(outDir, 'index.html');
const basePath = path.join(__dirname, '../src/renderer');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

let content = fs.readFileSync(srcFile, 'utf8');

const includeRegex = /<!--\s*@include\s+['"]([^'"]+)['"]\s*-->/g;

content = content.replace(includeRegex, (match, filename) => {
    const includePath = path.join(basePath, filename);
    if (fs.existsSync(includePath)) {
        console.log(`[build-html] Includo: ${filename}`);
        return fs.readFileSync(includePath, 'utf8');
    } else {
        console.warn(`[build-html] ATTENZIONE: File non trovato - ${includePath}`);
        return `<!-- ERRORE: non trovato ${filename} -->`;
    }
});

fs.writeFileSync(outFile, content);
console.log(`[build-html] Generato con successo ${outFile}`);
