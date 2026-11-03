module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      // Metro gets the v6y Babel plugin from withV6y() in metro.config.js.
      // Jest doesn't run through Metro, so the showcase test adds it here.
      test: { plugins: [['v6y/babel', { enabled: true }]] },
    },
  };
};
