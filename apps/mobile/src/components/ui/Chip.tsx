import { StyleSheet, Text } from 'react-native';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, opacity, radius, space, touch } from '@/lib/theme';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Toggle pill. Selected = blue fill + white text (fill AND text change, so it isn't colour alone). */
export function Chip({ label, selected = false, onPress, disabled }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      style={[styles.chip, selected ? styles.on : styles.off, disabled && styles.disabled]}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.min,
    paddingHorizontal: space[4.5],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { backgroundColor: colors.surface, borderColor: colors.border },
  on: { backgroundColor: colors.brand, borderColor: colors.brand },
  disabled: { opacity: opacity.disabled },
  text: { ...bodyFont('bold'), fontSize: fontSize.md, color: colors.text },
  textOn: { color: colors.onColor },
});
