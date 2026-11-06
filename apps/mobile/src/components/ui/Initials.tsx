import { StyleSheet, Text, View } from 'react-native';
import { displayFont } from '@/lib/fonts';
import { colors, size as sizes } from '@/lib/theme';

/** Up to two initials: "Ayesha Malik" → "AM", "Bilal" → "B". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : parts;
  return letters.map((p) => p.charAt(0).toUpperCase()).join('');
}

export type InitialsTint = 'sun' | 'brand' | 'mint';

const TINTS: Record<InitialsTint, string> = {
  sun: colors.accent,
  brand: colors.brandSoft,
  mint: colors.successSoft,
};

/** Round avatar with someone's initials (people without a photo, e.g. the driver on an offer card). */
export function Initials({ name, size = sizes.avatar, tint = 'brand' }: { name: string; size?: number; tint?: InitialsTint }) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: TINTS[tint] }]}
      accessible={false}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initialsOf(name) || '🙂'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { ...displayFont('extraBold'), color: colors.text },
});
