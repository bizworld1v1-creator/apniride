import { updateProfileBodySchema } from '@apniride/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { authStyles, TextLink } from '@/components/AuthLayout';
import { Avatar } from '@/components/Avatar';
import { PageLayout, pageStyles } from '@/components/PageLayout';
import { Button, Icon, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/errors';
import { useMode } from '@/lib/mode';
import { CameraDeniedError, pickPhoto } from '@/lib/onboarding';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, size, space, text } from '@/lib/theme';

/** Small enough for weak internet (~50–100 KB), big enough for the profile picture. */
const PHOTO_WIDTH = 512;

/** Photo, name, (masked) number, driver registration link, and deleting the account. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const mode = useMode();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState(user?.name ?? '');
  const parsed = updateProfileBodySchema.safeParse({ name });
  const nameError = name.trim() && !parsed.success ? parsed.error.issues[0]?.message : null;

  const photo = useMutation({
    mutationFn: async (source: 'camera' | 'gallery') => {
      const file = await pickPhoto({ source, front: true, maxWidth: PHOTO_WIDTH, name: 'profile' });
      return file ? api.me.uploadPhoto(file) : null;
    },
    onSuccess: (u) => {
      if (u) void useAuth.getState().setUser(u);
    },
  });
  const removePhoto = useMutation({
    mutationFn: api.me.deletePhoto,
    onSuccess: (u) => useAuth.getState().setUser(u),
  });
  const saveName = useMutation({
    mutationFn: () => api.me.update({ name }),
    onSuccess: (u) => useAuth.getState().setUser(u),
  });
  const deleteAccount = useMutation({
    mutationFn: api.me.deleteAccount,
    // Every session is gone on the server; forget this one too (the route guards show sign-in).
    onSuccess: () => useAuth.getState().clear(),
  });

  const confirmDelete = () =>
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.deleteConfirm'), style: 'destructive', onPress: () => deleteAccount.mutate() },
    ]);

  const photoError = photo.error
    ? photo.error instanceof CameraDeniedError
      ? t('common.cameraDenied')
      : errorMessage(t, photo.error)
    : removePhoto.error
      ? errorMessage(t, removePhoto.error)
      : null;
  const busyPhoto = photo.isPending || removePhoto.isPending;

  return (
    <PageLayout title={t('profile.title')}>
      {/* Photo card: big avatar, camera / gallery, remove. */}
      <View style={[pageStyles.card, styles.photoCard]}>
        <View style={styles.avatarRing}>
          <Avatar size={size.avatarLarge + space[5]} />
        </View>
        <Text style={text.h2} numberOfLines={1}>
          {user?.name}
        </Text>
        <Text style={pageStyles.muted}>{t('profile.photoNote')}</Text>
        {busyPhoto ? (
          <ActivityIndicator color={colors.brand} style={styles.photoBusy} />
        ) : (
          <View style={styles.photoButtons}>
            <Button variant="primary" compact label={t('common.camera')} onPress={() => photo.mutate('camera')} style={styles.flex} />
            <Button variant="outline" compact label={t('common.gallery')} onPress={() => photo.mutate('gallery')} style={styles.flex} />
          </View>
        )}
        {user?.photoUpdatedAt && !busyPhoto ? (
          <TextLink label={t('profile.removePhoto')} onPress={() => removePhoto.mutate()} />
        ) : null}
        {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
      </View>

      <Text style={[pageStyles.section, styles.gap]}>{t('profile.name')}</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          saveName.reset();
        }}
        maxLength={60}
        autoComplete="name"
        style={[authStyles.input, styles.inputOnBg]}
        placeholderTextColor={colors.muted}
        placeholder={t('auth.namePlaceholder')}
      />
      {nameError ? <Text style={styles.error}>{t(`errors.${nameError}`)}</Text> : null}
      {saveName.error ? <Text style={styles.error}>{errorMessage(t, saveName.error)}</Text> : null}
      <View style={styles.saveRow}>
        <Button
          variant="ink"
          compact
          label={t('profile.saveName')}
          onPress={() => saveName.mutate()}
          loading={saveName.isPending}
          disabled={!parsed.success || name.trim() === user?.name}
        />
        {saveName.isSuccess ? <Text style={styles.saved}>{t('profile.saved')}</Text> : null}
      </View>

      <Text style={[pageStyles.section, styles.gap]}>{t('profile.phone')}</Text>
      <View style={[pageStyles.card, styles.phoneCard]}>
        <View style={styles.iconBox}>
          <Icon name="phone" size={iconSize.sm} color={colors.brand} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.value}>{user?.phoneMasked}</Text>
          <Text style={pageStyles.muted}>{t('profile.phoneNote')}</Text>
        </View>
      </View>

      {mode === 'driver' ? (
        <>
          <Text style={[pageStyles.section, styles.gap]}>{t('profile.driverSection')}</Text>
          <PressableScale style={[pageStyles.card, styles.linkCard]} onPress={() => router.push('/onboarding')} accessibilityRole="link">
            <View style={styles.iconBox}>
              <Icon name="car" size={iconSize.sm} color={colors.brand} />
            </View>
            <Text style={[styles.value, styles.flex]}>{t('profile.driverOpen')}</Text>
            <Icon name="chevronRight" size={iconSize.sm} color={colors.textSecondary} />
          </PressableScale>
        </>
      ) : null}

      <View style={[styles.danger, styles.dangerGap]}>
        <Text style={[text.title, styles.dangerTitle]}>{t('profile.deleteTitle')}</Text>
        <Text style={pageStyles.muted}>{t('profile.deleteBody')}</Text>
        {deleteAccount.error ? <Text style={styles.error}>{errorMessage(t, deleteAccount.error)}</Text> : null}
        <Button
          variant="danger"
          label={t('profile.deleteButton')}
          onPress={confirmDelete}
          loading={deleteAccount.isPending}
          style={styles.deleteButton}
        />
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photoCard: { alignItems: 'center', gap: space[2] },
  avatarRing: { padding: space[1], borderRadius: radius.pill, backgroundColor: colors.accent, marginBottom: space[1] },
  photoButtons: { flexDirection: 'row', gap: space[2], alignSelf: 'stretch', marginTop: space[2] },
  photoBusy: { marginVertical: space[3] },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, marginTop: space[1.5] },
  gap: { marginTop: space[6] },
  dangerGap: { marginTop: space[10] },
  inputOnBg: { backgroundColor: colors.surface },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] },
  saved: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.success },
  phoneCard: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  iconBox: {
    width: size.iconButton - space[2],
    height: size.iconButton - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...bodyFont('bold'), fontSize: fontSize.lg, color: colors.text },
  danger: { backgroundColor: colors.errorSoft, borderRadius: radius.card, padding: space[5], gap: space[2] },
  dangerTitle: { color: colors.errorText },
  deleteButton: { marginTop: space[2] },
});
