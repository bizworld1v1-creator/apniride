import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLoop } from '@/lib/motion';
import { colors, opacity } from '@/lib/theme';

const W = 34;
const H = 44;

/** Teardrop pin (blue = pickup, coral = destination). The tip is at the bottom centre. */
export function PinShape({ color = colors.pickupPin }: { color?: string }) {
  return (
    <Svg width={W} height={H} viewBox="0 0 34 44">
      <Path d="M17 43S2 26 2 16a15 15 0 0130 0c0 10-15 27-15 27z" fill={color} />
      <Circle cx="17" cy="16" r="6" fill={colors.surface} />
    </Svg>
  );
}

/**
 * Pin fixed in the middle of the map: the passenger moves the map under it. Its tip sits exactly on the map centre.
 * `bounce` = the gentle hop with a squashing shadow (home map card).
 */
export function CenterPin({ color, bounce = false }: { color?: string; bounce?: boolean }) {
  const hop = useLoop(700, { enabled: bounce });
  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const shadowScale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });

  return (
    <View style={styles.wrap} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {/* Lift the pin by its own height so the tip, not the middle, is on the centre. */}
      <View style={styles.lift}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <PinShape color={color} />
        </Animated.View>
        <Animated.View style={[styles.shadow, { transform: [{ scaleX: shadowScale }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  lift: { alignItems: 'center', marginBottom: H },
  shadow: { width: 20, height: 6, borderRadius: 3, backgroundColor: colors.ink, opacity: opacity.shadow, marginTop: -3 },
});
