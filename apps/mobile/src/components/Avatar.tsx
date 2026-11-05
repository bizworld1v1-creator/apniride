import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { photoSource } from '@/lib/account';
import { useAuth } from '@/lib/auth-store';
import { colors, fontWeight } from '@/lib/theme';

/** The signed-in person's photo, or their first initial if they have none (or it can't load). */
export function Avatar({ size }: { size: number }) {
  const user = useAuth((s) => s.user);
  const [failed, setFailed] = useState<string | null>(null);
  const source = photoSource(user);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (source && failed !== user?.photoUpdatedAt) {
    return (
      <Image
        source={source}
        style={[styles.image, round]}
        onError={() => setFailed(user?.photoUpdatedAt ?? null)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const initial = user?.name?.trim().charAt(0).toUpperCase() || '🙂';
  return (
    <View style={[styles.initial, round]}>
      <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceMuted },
  initial: { backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.brand, fontWeight: fontWeight.bold },
});
