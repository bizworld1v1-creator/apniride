import type { DriverDocument, DriverDocumentType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Button, Icon } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { CameraDeniedError, ONBOARDING_KEY, pickDocumentPhoto } from '@/lib/onboarding';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, size, space, touch } from '@/lib/theme';

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
      ? t('driver.onboarding.cameraDenied')
      : errorMessage(t, upload.error)
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, uploaded && styles.thumbDone]}>
            <Icon name={uploaded ? 'check' : 'plus'} size={iconSize.md} color={uploaded ? colors.onColor : colors.brand} />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.name}>{t(`driver.onboarding.docs.${type}`)}</Text>
          <Text style={styles.hint}>{t(`driver.onboarding.hints.${type}`)}</Text>
          <Text style={[styles.state, uploaded ? styles.done : required ? styles.todo : null]}>
            {upload.isPending
              ? t('driver.onboarding.uploading')
              : uploaded
                ? t('driver.onboarding.uploaded')
                : required
                  ? t('driver.onboarding.required')
                  : t('driver.onboarding.optional')}
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
              <Button
                variant={uploaded ? 'outline' : 'primary'}
                compact
                label={t('driver.onboarding.camera')}
                onPress={() => upload.mutate('camera')}
                style={styles.flex}
              />
              <Button variant="outline" compact label={t('driver.onboarding.gallery')} onPress={() => upload.mutate('gallery')} style={styles.flex} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: radius.card - space[2], padding: space[4], marginBottom: space[2.5] },
  top: { flexDirection: 'row', gap: space[3] },
  flex: { flex: 1 },
  thumb: { width: size.avatar, height: size.avatar, borderRadius: radius.chip, backgroundColor: colors.border },
  thumbEmpty: { backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  thumbDone: { backgroundColor: colors.success },
  name: { ...bodyFont('bold'), fontSize: fontSize.lg, color: colors.text },
  hint: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.textSecondary, marginTop: space[0.5] },
  state: { ...bodyFont('bold'), fontSize: fontSize.sm, marginTop: space[1.5], color: colors.textSecondary },
  done: { color: colors.success },
  todo: { color: colors.brand },
  error: { ...bodyFont('medium'), color: colors.error, fontSize: fontSize.sm, marginTop: space[2] },
  buttons: { flexDirection: 'row', gap: space[2], marginTop: space[3], minHeight: touch.min, alignItems: 'center' },
});
