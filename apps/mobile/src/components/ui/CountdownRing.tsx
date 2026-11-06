import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { displayFont } from '@/lib/fonts';
import { colors, fontSize, size } from '@/lib/theme';

interface Props {
  /** Seconds left; the parent ticks it (one re-render per second is cheap). */
  secondsLeft: number;
  total: number;
  diameter?: number;
}

/** Ring that empties as time runs out, with the seconds in the middle (offer cards). */
export function CountdownRing({ secondsLeft, total, diameter = size.countdownRing }: Props) {
  const stroke = size.countdownStroke;
  const r = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, total > 0 ? secondsLeft / total : 0));
  const seconds = Math.max(0, Math.ceil(secondsLeft));

  return (
    <View
      style={{ width: diameter, height: diameter }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${seconds}s`}
    >
      <Svg width={diameter} height={diameter} style={styles.svg}>
        <Circle cx={diameter / 2} cy={diameter / 2} r={r} stroke={colors.borderLight} strokeWidth={stroke} fill="none" />
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          stroke={colors.brand}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - left)}
          // Start at 12 o'clock.
          transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.text}>{seconds}s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  text: { ...displayFont('extraBold'), fontSize: fontSize.sm, color: colors.text },
});
