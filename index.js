import { registerRootComponent } from 'expo';

// Polyfill DOMException for Hermes versions that don't expose it as a global
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
