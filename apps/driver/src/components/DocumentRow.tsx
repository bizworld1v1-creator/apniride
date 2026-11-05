import type { DriverDocument, DriverDocumentType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { CameraDeniedError, ONBOARDING_KEY, pickDocumentPhoto } from '@/lib/onboarding';
import { colors, radius } from '@/lib/theme';

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
  row: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  top: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.border },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  state: { fontSize: 13, marginTop: 6, color: colors.muted, fontWeight: '600' },
  done: { color: colors.success },
  todo: { color: colors.brand },
  error: { color: colors.error, fontSize: 13, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 10, minHeight: 40, alignItems: 'center' },
  button: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonText: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  buttonTextPrimary: { color: colors.brandText },
});
