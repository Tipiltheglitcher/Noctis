import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noctis.mobile',
  appName: 'Noctis',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060608',
    },
  },
};

export default config;
