const { getDefaultConfig } = require('expo/metro-config');
const { withV6y } = require('@v6y/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Only because this example uses the v6y packages straight from the monorepo
// (../../packages) instead of installing them from npm. Your app doesn't need
// any of this block.
const packages = path.resolve(__dirname, '../../packages');
config.watchFolders = [...(config.watchFolders ?? []), packages];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = {
  '@v6y/core': path.join(packages, 'core'),
  '@v6y/react-native': path.join(packages, 'react-native'),
};
// ---------------------------------------------------------------------------

// The one line v6y needs:
module.exports = withV6y(config);
