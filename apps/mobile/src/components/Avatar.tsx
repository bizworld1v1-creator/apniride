import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { photoSource } from '@/lib/account';
import { useAuth } from '@/lib/auth-store';
import { colors } from '@/lib/theme';
import { Initials } from './ui/Initials';

/** The signed-in person's photo, or their initials on yellow if they have none (or it can't load). */
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
  return <Initials name={user?.name ?? ''} size={size} tint="sun" />;
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceMuted },
});
