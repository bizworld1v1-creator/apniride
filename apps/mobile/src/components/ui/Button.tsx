import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, iconSize, opacity, radius, size, space, touch } from '@/lib/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

/**
 * - `ink`: the main CTA. Dark pill, label on the start side, yellow arrow circle on the end side.
 * - `light`: the same on a blue background (white pill, yellow arrow), e.g. "Let's ride" on the splash.
 * - `primary`: blue pill, centred label.
 * - `outline`: white pill with a grey border.
 * - `danger`: red outline, for "Cancel ride", "Delete account".
 */
export type ButtonVariant = 'ink' | 'light' | 'primary' | 'outline' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Icon before the label (primary / outline / danger). */
  icon?: IconName;
  /** Smaller (44 px) outline pill, e.g. counter-offer amounts. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  compact,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const withArrow = variant === 'ink' || variant === 'light';
  const textColor = {
    ink: colors.onColor,
    light: colors.text,
    primary: colors.onColor,
    outline: colors.text,
    danger: colors.error,
  }[variant];
  const off = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[
        styles.base,
        withArrow ? styles.withArrow : styles.centred,
        styles[variant],
        compact && styles.compact,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading && !withArrow ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && !withArrow ? <Icon name={icon} size={iconSize.sm} color={textColor} /> : null}
          <Text style={[styles.label, compact && styles.labelCompact, { color: textColor }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
      {withArrow ? (
        <View style={styles.arrow}>
          {loading ? <ActivityIndicator color={colors.onAccent} /> : <Icon name="arrowRight" color={colors.onAccent} />}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.button,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centred: { justifyContent: 'center', gap: space[2], paddingHorizontal: space[6] },
  withArrow: {
    minHeight: touch.buttonLarge,
    justifyContent: 'space-between',
    paddingStart: space[6.5],
    paddingEnd: (touch.buttonLarge - size.ctaArrow) / 2,
  },
  compact: { minHeight: touch.min, paddingHorizontal: space[4] },
  ink: { backgroundColor: colors.ink },
  light: { backgroundColor: colors.surface },
  primary: { backgroundColor: colors.brand },
  outline: { backgroundColor: colors.surface, borderWidth: borderWidth.thick, borderColor: colors.border },
  danger: { backgroundColor: colors.surface, borderWidth: borderWidth.thick, borderColor: colors.errorSoftStrong },
  disabled: { opacity: opacity.disabled },
  label: { ...bodyFont('bold'), fontSize: fontSize.xl, flexShrink: 1 },
  labelCompact: { fontSize: fontSize.base },
  arrow: {
    width: size.ctaArrow,
    height: size.ctaArrow,
    borderRadius: size.ctaArrow / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
