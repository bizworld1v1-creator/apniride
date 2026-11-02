import type { ExpoConfig } from 'expo/config';

// Google Maps keys are only needed for real builds (EAS). Expo Go works without them.
// Put them in apps/driver/.env (gitignored) or as EAS environment variables.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

const config: ExpoConfig = {
  name: 'ApniRide Driver',
  slug: 'apniride-driver',
  scheme: 'apniride-driver',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: 'pk.apniride.driver',
    supportsTablet: false,
  },
  android: {
    package: 'pk.apniride.driver',
    adaptiveIcon: {
      backgroundColor: '#FEF3C7',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    ['expo-localization', { supportsRTL: true }],
    [
      'expo-location',
      {
        // Drivers must keep sharing location while online, even with the app in the background.
        // Background location does NOT work in Expo Go – it needs a development build (EAS).
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
        locationWhenInUsePermission:
          'ApniRide Driver uses your location to show you to nearby passengers.',
        locationAlwaysAndWhenInUsePermission:
          'ApniRide Driver keeps sharing your location while you are online, so passengers can track their ride.',
      },
    ],
    ['react-native-maps', { androidGoogleMapsApiKey, iosGoogleMapsApiKey }],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
