/**
 * Zero-setup entry, injected at the top of your app's entry file by `withV6y`
 * (metro.config.js) in development builds only:
 *
 * - loads v6y.config.{ts,js} (withV6y points `@v6y/react-native/project-config`
 *   at it; without withV6y that module is an empty default)
 * - wraps every root component in <V6yProvider> via AppRegistry
 *
 * Without Metro integration, `import '@v6y/react-native/auto'` at the top of
 * your entry file does the same (minus the project config).
 */
import { V6yProvider, configure } from './index';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const mod = require('@v6y/react-native/project-config');
configure(mod?.default ?? mod ?? {});

const { AppRegistry } = require('react-native');
// Note: AppRegistry keeps a single wrapper. If your app sets its own, render <V6yProvider> manually instead.
AppRegistry.setWrapperComponentProvider(() => V6yProvider);
