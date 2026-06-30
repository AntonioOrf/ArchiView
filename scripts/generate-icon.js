const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'icon.png');
const dest = path.join(__dirname, '..', 'assets', 'icon.ico');

(async () => {
  const { default: pngToIco } = await import('png-to-ico');
  const buf = await pngToIco(src);
  fs.writeFileSync(dest, buf);
  console.log(`Generated ${dest} (${buf.length} bytes)`);
})().catch(err => {
  console.error('Failed to generate icon:', err);
  process.exit(1);
});
