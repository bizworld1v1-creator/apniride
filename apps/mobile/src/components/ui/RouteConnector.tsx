import { Animated, StyleSheet, View } from 'react-native';
import { useLoop } from '@/lib/motion';
import { colors, radius, size, space } from '@/lib/theme';

const DASH = space[1];
const GAP = space[1];
const DASHES = 12;

/**
 * Vertical pickup → drop-off marker for a From / To list: blue dot, flowing dashed line, coral square.
 * Put it next to the two place rows; it stretches to their height.
 */
export function RouteConnector() {
  const flow = useLoop(1200, { pingPong: false });
  const translateY = flow.interpolate({ inputRange: [0, 1], outputRange: [-(DASH + GAP), 0] });

  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.dot} />
      <View style={styles.track}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </Animated.View>
      </View>
      <View style={styles.square} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: size.routeDot, alignItems: 'center', alignSelf: 'stretch', paddingVertical: space[1] },
  dot: { width: size.routeDot, height: size.routeDot, borderRadius: size.routeDot / 2, backgroundColor: colors.pickupPin },
  track: { flex: 1, overflow: 'hidden', marginVertical: space[1], width: space[0.5] },
  dash: { width: space[0.5], height: DASH, marginBottom: GAP, borderRadius: radius.xs, backgroundColor: colors.brandTint3 },
  square: { width: size.routeDot, height: size.routeDot, borderRadius: radius.xs, backgroundColor: colors.destination },
});
