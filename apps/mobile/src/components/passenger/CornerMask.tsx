import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Rounded corners for a map. Android draws Google Maps on its own surface, which ignores `borderRadius` +
 * `overflow: hidden`, so we paint the four corners in the background colour on top instead.
 */
export function CornerMask({ radius, color }: { radius: number; color: string }) {
  const r = radius;
  const corner = (rotate: string, pos: object) => (
    <View style={[styles.corner, { width: r, height: r, transform: [{ rotate }] }, pos]}>
      <Svg width={r} height={r} viewBox={`0 0 ${r} ${r}`}>
        <Path d={`M0 0H${r}A${r} ${r} 0 0 0 0 ${r}Z`} fill={color} />
      </Svg>
    </View>
  );
  return (
    // Left-to-right on purpose: the corners are physical, also in Urdu.
    <View style={[StyleSheet.absoluteFill, styles.ltr]} pointerEvents="none">
      {corner('0deg', { top: 0, left: 0 })}
      {corner('90deg', { top: 0, right: 0 })}
      {corner('180deg', { bottom: 0, right: 0 })}
      {corner('270deg', { bottom: 0, left: 0 })}
    </View>
  );
}

const styles = StyleSheet.create({
  ltr: { direction: 'ltr' },
  corner: { position: 'absolute' },
});
