const { getDefaultConfig } = require('expo/metro-config');
const { withV6y } = require('v6y/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Only because this example uses v6y straight from the monorepo
// (../../packages/v6y) instead of `npm install v6y`. Your app doesn't need
// any of this block.
const v6y = path.resolve(__dirname, '../../packages/v6y');
config.watchFolders = [...(config.watchFolders ?? []), v6y];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { v6y };
// ---------------------------------------------------------------------------

// The one line v6y needs:
module.exports = withV6y(config);
