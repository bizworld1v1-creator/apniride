import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { bodyFont } from '@/lib/fonts';
import { useMode, useSwitchMode } from '@/lib/mode';
import { borderWidth, colors, fontSize, opacity, radius, space, touch } from '@/lib/theme';

/**
 * "Driver mode" / "Passenger mode" pill (design: "Rider mode" on the driver home; also in the side menu).
 * `blocked` greys it out when we already know the server would refuse (driver online or on a ride); the server
 * checks again anyway. `compact`: no outer margin, for a header row.
 */
export function ModeSwitch({ blocked = false, compact = false }: { blocked?: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  const mode = useMode();
  const switchMode = useSwitchMode();
  const to = mode === 'driver' ? 'passenger' : 'driver';
  const disabled = blocked || switchMode.isPending;

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <PressableScale
        style={[styles.button, disabled && styles.disabled]}
        onPress={() => switchMode.mutate(to)}
        disabled={disabled}
        accessibilityState={{ disabled, busy: switchMode.isPending }}
      >
        {switchMode.isPending ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Text style={styles.text}>{t(to === 'driver' ? 'mode.toDriver' : 'mode.toPassenger')}</Text>
        )}
      </PressableScale>
      {switchMode.error ? <Text style={styles.error}>{errorMessage(t, switchMode.error)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', marginTop: space[2] },
  compact: { marginTop: 0, alignItems: 'flex-end' },
  button: {
    minHeight: touch.min,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingHorizontal: space[3.5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: opacity.faint },
  text: { ...bodyFont('semibold'), fontSize: fontSize.sm, color: colors.text },
  error: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.error, marginTop: space[1] },
});
