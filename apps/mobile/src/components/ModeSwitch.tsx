import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { useMode, useSwitchMode } from '@/lib/mode';
import { borderWidth, colors, fontSize, fontWeight, opacity, radius, space, touch } from '@/lib/theme';

/**
 * "Driver mode" / "Passenger mode" button for the home header (inDrive has it in the side menu; we will move it
 * into the settings menu when that exists). `blocked` greys it out when we already know the server would refuse
 * (driver online or on a ride); the server checks again anyway.
 */
export function ModeSwitch({ blocked = false }: { blocked?: boolean }) {
  const { t } = useTranslation();
  const mode = useMode();
  const switchMode = useSwitchMode();
  const to = mode === 'driver' ? 'passenger' : 'driver';
  const disabled = blocked || switchMode.isPending;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.button, disabled && styles.disabled]}
        onPress={() => switchMode.mutate(to)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: switchMode.isPending }}
        hitSlop={touch.hitSlop}
      >
        {switchMode.isPending ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Text style={styles.text}>{t(to === 'driver' ? 'mode.toDriver' : 'mode.toPassenger')}</Text>
        )}
      </Pressable>
      {switchMode.error ? <Text style={styles.error}>{errorMessage(t, switchMode.error)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', marginTop: space[2] },
  button: {
    borderWidth: borderWidth.thin,
    borderColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    minWidth: 110,
    alignItems: 'center',
  },
  disabled: { opacity: opacity.faint },
  text: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.brand },
  error: { fontSize: fontSize.sm, color: colors.error, marginTop: space[1] },
});
