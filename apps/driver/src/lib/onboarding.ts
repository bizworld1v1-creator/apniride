import type { DriverDocumentType } from '@apniride/shared';
import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export const ONBOARDING_KEY = ['driver', 'onboarding'] as const;

export function useOnboarding(enabled = true) {
  return useQuery({ queryKey: ONBOARDING_KEY, queryFn: api.driver.onboarding.get, enabled, staleTime: 60_000 });
}

/** Wide enough to read a CNIC or a number plate; keeps each photo around 150–300 KB on weak internet. */
const MAX_WIDTH = 1280;

export class CameraDeniedError extends Error {}

/**
 * Takes a photo (or picks one from the gallery), shrinks it and returns a file for upload.
 * null if the driver backed out.
 */
export async function pickDocumentPhoto(
  type: DriverDocumentType,
  source: 'camera' | 'gallery',
): Promise<{ uri: string; name: string; type: string } | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    exif: false,
    cameraType: type === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CameraDeniedError();
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: `${type}.jpg`, type: 'image/jpeg' };
}
