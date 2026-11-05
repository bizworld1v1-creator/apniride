import type { DriverDocument, DriverDocumentType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { CameraDeniedError, ONBOARDING_KEY, pickDocumentPhoto } from '@/lib/onboarding';
import { borderWidth, colors, fontSize, fontWeight, radius, space, touch } from '@/lib/theme';

/** One document: what to photograph, whether it's done, and camera / gallery buttons. */
export function DocumentRow({
  type,
  required,
  uploaded,
  editable,
}: {
  type: DriverDocumentType;
  required: boolean;
  uploaded: DriverDocument | undefined;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: async (source: 'camera' | 'gallery') => {
      const file = await pickDocumentPhoto(type, source);
      if (!file) return null; // backed out of the camera
      return { file, onboarding: await api.driver.onboarding.uploadDocument(type, file) };
    },
    onSuccess: (result) => {
      if (result) queryClient.setQueryData(ONBOARDING_KEY, result.onboarding);
    },
  });

  // Thumbnail of the photo just taken on this phone (the server copy is never downloaded: saves data).
  const preview = upload.data?.file.uri;
  const error = upload.error
    ? upload.error instanceof CameraDeniedError
      ? t('onboarding.cameraDenied')
      : errorMessage(t, upload.error)
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        {preview ? <Image source={{ uri: preview }} style={styles.thumb} /> : null}
        <View style={styles.flex}>
          <Text style={styles.name}>{t(`onboarding.docs.${type}`)}</Text>
          <Text style={styles.hint}>{t(`onboarding.hints.${type}`)}</Text>
          <Text style={[styles.state, uploaded ? styles.done : required ? styles.todo : null]}>
            {upload.isPending
              ? t('onboarding.uploading')
              : uploaded
                ? t('onboarding.uploaded')
                : required
                  ? t('onboarding.required')
                  : t('onboarding.optional')}
          </Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {editable ? (
        <View style={styles.buttons}>
          {upload.isPending ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <Button label={t('onboarding.camera')} onPress={() => upload.mutate('camera')} primary={!uploaded} />
              <Button label={t('onboarding.gallery')} onPress={() => upload.mutate('gallery')} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable style={[styles.button, primary && styles.buttonPrimary]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[3.5], borderWidth: borderWidth.thin, borderColor: colors.border, marginBottom: space[2.5] },
  top: { flexDirection: 'row', gap: space[3] },
  flex: { flex: 1 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.border },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.muted, marginTop: space[0.5] },
  state: { fontSize: fontSize.sm, marginTop: space[1.5], color: colors.muted, fontWeight: fontWeight.semibold },
  done: { color: colors.success },
  todo: { color: colors.brand },
  error: { color: colors.error, fontSize: fontSize.sm, marginTop: space[2] },
  buttons: { flexDirection: 'row', gap: space[2], marginTop: space[2.5], minHeight: touch.min, alignItems: 'center' },
  button: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.brand,
    paddingVertical: space[2.5],
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonText: { color: colors.brand, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  buttonTextPrimary: { color: colors.brandText },
});
