import type { ExpoConfig } from 'expo/config';
// Relative import: the config runs in Node before Metro, so it reads the theme source directly.
import { getTheme } from '../../packages/shared/src/theme.ts';

const { colors } = getTheme('mobile');

// Google Maps keys are only needed for real builds (EAS). Expo Go works without them.
// Put them in apps/mobile/.env (gitignored) or as EAS environment variables.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

/** One app for passengers and drivers (like inDrive): "Driver mode" is a switch inside the app. */
const config: ExpoConfig = {
  name: 'ApniRide',
  slug: 'apniride',
  scheme: 'apniride',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: 'pk.apniride.app',
    supportsTablet: false,
  },
  android: {
    package: 'pk.apniride.app',
    adaptiveIcon: {
      backgroundColor: colors.appIconBackground,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    ['expo-splash-screen', { backgroundColor: colors.splash, image: './assets/splash-icon.png', imageWidth: 120 }],
    // Urdu is RTL – let the native layer flip layouts when the device language is Urdu.
    ['expo-localization', { supportsRTL: true }],
    [
      'expo-location',
      {
        // Driver mode must keep sharing location while online, even with the app in the background.
        // Background location does NOT work in Expo Go – it needs a development build (EAS).
        // Passengers are only ever asked for "while using the app".
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
        locationWhenInUsePermission:
          'ApniRide uses your location to set your pickup point, and in driver mode to show you to nearby passengers.',
        locationAlwaysAndWhenInUsePermission:
          'In driver mode, ApniRide keeps sharing your location while you are online, so passengers can track their ride.',
      },
    ],
    ['react-native-maps', { androidGoogleMapsApiKey, iosGoogleMapsApiKey }],
    [
      'expo-image-picker',
      {
        // Driver registration: photos of the CNIC, licence and vehicle, and a selfie.
        cameraPermission: 'ApniRide uses the camera to photograph your CNIC, licence and vehicle for driver registration.',
        photosPermission: 'ApniRide lets you choose photos of your documents from your gallery for driver registration.',
        microphonePermission: false,
      },
    ],
  ],
  // Read by src/lib/map-provider.ts: use Google Maps on iOS only when a key is built in.
  extra: { iosGoogleMaps: !!iosGoogleMapsApiKey },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
