import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { displayFont } from '@/lib/fonts';
import { useLoop, useReduceMotion } from '@/lib/motion';
import { borderWidth, colors, fontSize, size, space } from '@/lib/theme';

interface Props {
  value: string;
  length: number;
  /** Red outline after a wrong code. */
  error?: boolean;
}

/**
 * The code as a row of circles: typed digits are blue circles that pop in; the next empty one has a dashed outline and
 * a blinking caret. Purely visual: digits come from the number pad.
 */
export const OtpCircles = memo(function OtpCircles({ value, length, error }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t('auth.codeProgress', { count: value.length, total: length })}
    >
      {Array.from({ length }, (_, i) => (
        <Slot key={i} digit={value[i]} active={i === value.length} error={error} />
      ))}
    </View>
  );
});

function Slot({ digit, active, error }: { digit?: string; active: boolean; error?: boolean }) {
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const blink = useLoop(500, { enabled: active });

  useEffect(() => {
    if (!digit || reduce) return;
    pop.setValue(0.4);
    const anim = Animated.spring(pop, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [digit, reduce, pop]);

  if (digit) {
    return (
      <Animated.View style={[styles.slot, styles.filled, error && styles.filledError, { transform: [{ scale: pop }] }]}>
        <Text style={styles.digit}>{digit}</Text>
      </Animated.View>
    );
  }
  return (
    <View style={[styles.slot, active ? styles.active : styles.empty, error && styles.emptyError]}>
      {active ? <Animated.View style={[styles.caret, { opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], direction: 'ltr', justifyContent: 'space-between' },
  slot: {
    flex: 1,
    maxWidth: size.otpCircle,
    aspectRatio: 1,
    borderRadius: size.otpCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.brand },
  filledError: { backgroundColor: colors.error },
  active: { borderWidth: borderWidth.thick, borderStyle: 'dashed', borderColor: colors.brand },
  empty: { backgroundColor: colors.background },
  emptyError: { borderWidth: borderWidth.thick, borderColor: colors.error },
  digit: { ...displayFont('extraBold'), fontSize: fontSize.heading, color: colors.onColor },
  caret: { width: borderWidth.thick, height: fontSize.heading, backgroundColor: colors.brand },
});
