const { getDefaultConfig } = require('expo/metro-config');
const { withV6y } = require('v6y/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Only because this example installs v6y from the monorepo
// ("file:../../packages/v6y") rather than from npm, so its real path is outside
// this project. Your app doesn't need any of this block.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../packages/v6y')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
// ---------------------------------------------------------------------------

// The one line v6y needs:
module.exports = withV6y(config);
