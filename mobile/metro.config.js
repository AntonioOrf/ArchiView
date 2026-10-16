const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const progetto = __dirname;
const condivisi = path.resolve(progetto, '..', 'src', 'shared');

const config = getDefaultConfig(progetto);
config.watchFolders = [condivisi];
config.resolver.nodeModulesPaths = [path.resolve(progetto, 'node_modules')];

module.exports = config;
