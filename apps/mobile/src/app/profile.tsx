import { updateProfileBodySchema } from '@apniride/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { PageLayout, pageStyles } from '@/components/PageLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/errors';
import { useMode } from '@/lib/mode';
import { CameraDeniedError, pickPhoto } from '@/lib/onboarding';
import { borderWidth, colors, fontSize, fontWeight, opacity, radius, space, touch } from '@/lib/theme';

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
      <View style={styles.photoRow}>
        <Avatar size={88} />
        <View style={styles.photoButtons}>
          {busyPhoto ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <SmallButton label={t('common.camera')} onPress={() => photo.mutate('camera')} />
              <SmallButton label={t('common.gallery')} onPress={() => photo.mutate('gallery')} />
              {user?.photoUpdatedAt ? (
                <Pressable onPress={() => removePhoto.mutate()} accessibilityRole="button" hitSlop={touch.hitSlop}>
                  <Text style={styles.removeText}>{t('profile.removePhoto')}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
      <Text style={pageStyles.muted}>{t('profile.photoNote')}</Text>
      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}

      <Text style={[pageStyles.section, styles.gap]}>{t('profile.name')}</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          saveName.reset();
        }}
        maxLength={60}
        autoComplete="name"
        style={styles.input}
        placeholderTextColor={colors.muted}
        placeholder={t('auth.namePlaceholder')}
      />
      {nameError ? <Text style={styles.error}>{t(`errors.${nameError}`)}</Text> : null}
      {saveName.error ? <Text style={styles.error}>{errorMessage(t, saveName.error)}</Text> : null}
      <View style={styles.saveRow}>
        <SmallButton
          label={t('profile.saveName')}
          onPress={() => saveName.mutate()}
          disabled={!parsed.success || name.trim() === user?.name || saveName.isPending}
          primary
        />
        {saveName.isSuccess ? <Text style={styles.saved}>{t('profile.saved')}</Text> : null}
      </View>

      <Text style={[pageStyles.section, styles.gap]}>{t('profile.phone')}</Text>
      <Text style={styles.value}>{user?.phoneMasked}</Text>
      <Text style={pageStyles.muted}>{t('profile.phoneNote')}</Text>

      {mode === 'driver' ? (
        <>
          <Text style={[pageStyles.section, styles.gap]}>{t('profile.driverSection')}</Text>
          <Pressable style={pageStyles.card} onPress={() => router.push('/onboarding')} accessibilityRole="button">
            <Text style={styles.value}>{t('profile.driverOpen')} ›</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={[pageStyles.section, styles.dangerGap]}>{t('profile.deleteTitle')}</Text>
      <Text style={pageStyles.muted}>{t('profile.deleteBody')}</Text>
      {deleteAccount.error ? <Text style={styles.error}>{errorMessage(t, deleteAccount.error)}</Text> : null}
      <Pressable
        style={styles.delete}
        onPress={confirmDelete}
        disabled={deleteAccount.isPending}
        accessibilityRole="button"
        accessibilityState={{ busy: deleteAccount.isPending }}
      >
        {deleteAccount.isPending ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.deleteText}>{t('profile.deleteButton')}</Text>
        )}
      </Pressable>
    </PageLayout>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={[styles.small, primary && styles.smallPrimary, disabled && styles.smallDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.smallText, primary && styles.smallPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space[4], marginBottom: space[2] },
  photoButtons: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  removeText: { fontSize: fontSize.md, color: colors.error },
  error: { fontSize: fontSize.md, color: colors.error, marginTop: space[1.5] },
  gap: { marginTop: space[6] },
  dangerGap: { marginTop: space[10] },
  input: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
    fontSize: fontSize.lg,
    color: colors.text,
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[2.5] },
  saved: { fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold },
  value: { fontSize: fontSize.lg, color: colors.text, marginBottom: space[1] },
  small: {
    borderWidth: borderWidth.thin,
    borderColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: space[2],
    paddingHorizontal: space[3.5],
    minHeight: touch.min,
    justifyContent: 'center',
  },
  smallPrimary: { backgroundColor: colors.brand },
  smallDisabled: { opacity: opacity.faint },
  smallText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.brand },
  smallPrimaryText: { color: colors.brandText },
  delete: {
    marginTop: space[3],
    borderWidth: borderWidth.thin,
    borderColor: colors.error,
    borderRadius: radius.lg,
    paddingVertical: space[3],
    alignItems: 'center',
    minHeight: touch.button,
    justifyContent: 'center',
  },
  deleteText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.error },
});
