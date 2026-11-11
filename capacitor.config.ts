import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fitos.personal',
  appName: 'FitOS',
  webDir: 'dist',
  android: {
    // the web assets are bundled in the APK; no remote server
    allowMixedContent: false,
  },
};

export default config;
