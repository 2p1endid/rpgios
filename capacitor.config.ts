import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rpgmaker.player',
  appName: 'RPG Maker Player',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
};

export default config;
