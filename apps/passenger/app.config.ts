import type { ExpoConfig } from 'expo/config';

// Google Maps keys are only needed for real builds (EAS). Expo Go works without them.
// Put them in apps/passenger/.env (gitignored) or as EAS environment variables.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

const config: ExpoConfig = {
  name: 'ApniRide',
  slug: 'apniride-passenger',
  scheme: 'apniride',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: 'pk.apniride.passenger',
    supportsTablet: false,
  },
  android: {
    package: 'pk.apniride.passenger',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    // Urdu is RTL – let the native layer flip layouts when the device language is Urdu.
    ['expo-localization', { supportsRTL: true }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'ApniRide uses your location to set your pickup point.',
      },
    ],
    ['react-native-maps', { androidGoogleMapsApiKey, iosGoogleMapsApiKey }],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
