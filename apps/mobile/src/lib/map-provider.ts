import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Google Maps on Android (works in Expo Go and in our builds).
 * On iPhone, Google Maps needs our own build with GOOGLE_MAPS_IOS_API_KEY; in Expo Go, or without
 * the key, use Apple Maps (provider undefined) so the app runs on any iPhone.
 */
const iosHasGoogle =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  Constants.expoConfig?.extra?.iosGoogleMaps === true;

export const MAP_PROVIDER = Platform.OS === 'android' || iosHasGoogle ? PROVIDER_GOOGLE : undefined;
