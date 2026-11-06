import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { easing, useLoop, useReduceMotion } from '@/lib/motion';
import { colors, opacity } from '@/lib/theme';

/**
 * The welcome screen drawing (design: splash.html): a yellow sun rising with slowly turning rays, two drifting
 * clouds, a road with moving lane marks and a yellow car driving across. Every number here is part of the drawing.
 * All loops run on the native driver and stop when "reduce motion" is on.
 */
export function SunScene() {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();

  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      rise.setValue(1);
      return;
    }
    const anim = Animated.timing(rise, { toValue: 1, duration: 1400, easing: easing.spring, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [rise, reduce]);

  const rays = useLoop(30_000, { pingPong: false });
  const cloud = useLoop(8000);
  const lane = useLoop(800, { pingPong: false });
  const drive = useLoop(6000, { pingPong: false });
  const bob = useLoop(200);
  const wheel = useLoop(600, { pingPong: false });

  const spin = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const cloudX = cloud.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  // With reduce motion the car parks in the middle of the road.
  const carX = reduce
    ? (width - CAR_W) / 2
    : drive.interpolate({ inputRange: [0, 1], outputRange: [-CAR_W - 30, width + 30] });

  return (
    <View style={styles.scene} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.sun,
          {
            left: (width - 200) / 2,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [160, 0] }) },
              { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin(rays) }] }]}>
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Path
              d="M100 4v22M100 174v22M4 100h22M174 100h22M32 32l16 16M152 152l16 16M32 168l16-16M152 48l16-16"
              stroke={colors.accent}
              strokeWidth={6}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <View style={styles.sunDisc} />
      </Animated.View>

      <Animated.View style={[styles.cloudBig, { left: width - 140, transform: [{ translateX: cloudX }] }]}>
        <Cloud width={120} height={44} />
      </Animated.View>
      <Animated.View style={[styles.cloudSmall, { transform: [{ translateX: Animated.multiply(cloudX, -1) }] }]}>
        <Cloud width={90} height={34} />
      </Animated.View>

      <View style={styles.road}>
        <Animated.View
          style={[styles.lanes, { transform: [{ translateX: lane.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }]}
        >
          {Array.from({ length: Math.ceil(width / 60) + 2 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.car,
          { transform: [{ translateX: carX }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] },
        ]}
      >
        <Svg width={CAR_W} height={60} viewBox="0 0 110 60">
          <Path
            d="M8 40V30c0-4 3-6 7-7l14-3 14-12c3-2 6-3 10-3h20c4 0 7 2 9 5l10 14c6 1 10 4 10 9v7z"
            fill={colors.accent}
          />
          <Path d="M47 12h16v10H36z M67 12h12l7 10H67z" fill={colors.ink} opacity={0.75} />
        </Svg>
        {[18, 74].map((left) => (
          <Animated.View key={left} style={[styles.wheel, { left, transform: [{ rotate: spin(wheel) }] }]}>
            <View style={styles.spoke} />
            <View style={styles.hub} />
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

const CAR_W = 110;

function Cloud({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 44">
      <Path d="M20 40h80a18 18 0 000-36 26 26 0 00-48 4A18 18 0 0020 40z" fill={colors.surface} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Left-to-right also in Urdu: the drawing is positioned from the left edge.
  scene: { height: 340, width: '100%', overflow: 'hidden', direction: 'ltr' },
  sun: { position: 'absolute', top: 30, width: 200, height: 200 },
  sunDisc: { position: 'absolute', top: 40, left: 40, right: 40, bottom: 40, borderRadius: 60, backgroundColor: colors.accent },
  cloudBig: { position: 'absolute', top: 0, opacity: 0.9 },
  cloudSmall: { position: 'absolute', top: 170, left: -20, opacity: 0.7 },
  road: { position: 'absolute', top: 270, left: 0, right: 0, height: 70, backgroundColor: colors.brandPressed, overflow: 'hidden' },
  lanes: { position: 'absolute', top: 33, left: 0, flexDirection: 'row', opacity: opacity.disabled },
  dash: { width: 30, height: 4, marginEnd: 30, backgroundColor: colors.surface },
  car: { position: 'absolute', top: 226, left: 0, width: CAR_W, height: 60 },
  wheel: {
    position: 'absolute',
    top: 34,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: { position: 'absolute', width: 2, height: 18, backgroundColor: colors.surface },
  hub: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
});
