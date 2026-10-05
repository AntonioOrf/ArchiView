// Metro deve vedere `../src/shared`: il validatore del lotto è UNO, quello del desktop
// (src/shared/scannerLotto.ts, docs/scanner/CONTRATTO.md). Il file non ha dipendenze, quindi
// i moduli si risolvono da mobile/node_modules. Niente `disableHierarchicalLookup`: expo
// tiene alcune dipendenze annidate (node_modules/expo/node_modules/expo-asset).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const progetto = __dirname;
const condivisi = path.resolve(progetto, '..', 'src', 'shared');

const config = getDefaultConfig(progetto);
config.watchFolders = [condivisi];
config.resolver.nodeModulesPaths = [path.resolve(progetto, 'node_modules')];

module.exports = config;
