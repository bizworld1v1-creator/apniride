import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borderWidth, colors, iconSize, size } from '@/lib/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

interface Props {
  icon: IconName;
  /** Read out by screen readers (icon-only buttons must have one): "Back", "Call", "Skip offer". */
  label: string;
  onPress: () => void;
  /** `light` = white circle (on the light background), `onBrand` = see-through white (on blue), `brand` = blue,
   *  `outline` = white with a grey ring. */
  tone?: 'light' | 'onBrand' | 'brand' | 'outline';
  /** Small red dot (e.g. unread notifications). */
  dot?: boolean;
  disabled?: boolean;
  diameter?: number;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only button (back, bell, chat, call, skip). */
export function IconButton({ icon, label, onPress, tone = 'light', dot, disabled, diameter = size.iconButton, style }: Props) {
  const color = tone === 'onBrand' || tone === 'brand' ? colors.onColor : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.base, styles[tone], { width: diameter, height: diameter, borderRadius: diameter / 2 }, style]}
    >
      <Icon name={icon} size={iconSize.sm} color={color} />
      {dot ? <View style={styles.dot} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: colors.surface },
  onBrand: { backgroundColor: colors.onBrandSubtle },
  brand: { backgroundColor: colors.brand },
  outline: { backgroundColor: colors.surface, borderWidth: borderWidth.thick, borderColor: colors.border },
  dot: {
    position: 'absolute',
    top: size.iconButton / 4,
    end: size.iconButton / 4,
    width: size.pagerDot,
    height: size.pagerDot,
    borderRadius: size.pagerDot / 2,
    backgroundColor: colors.danger,
  },
});
