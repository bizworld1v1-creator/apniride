import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { borderWidth, colors, shadow, size, space } from '@/lib/theme';

const THUMB = space[8];

interface Props {
  min: number;
  max: number;
  value: number;
  /** Turns a raw position into an allowed value (e.g. snap to Rs 10). */
  snap: (raw: number) => number;
  onChange: (value: number) => void;
  /** One step for screen-reader swipes up / down. */
  step: number;
  accessibilityLabel: string;
  /** Spoken value, e.g. "Rs 500". */
  valueText: string;
}

/**
 * Price slider (design: fare.html): light track, yellow thumb. Left = lowest, right = highest, also in Urdu.
 * Re-renders only when the snapped value changes, so dragging stays smooth on low-end phones.
 */
export function Slider({ min, max, value, snap, onChange, step, accessibilityLabel, valueText }: Props) {
  const trackRef = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const left = useRef(0);
  const latest = useRef({ min, max, width, value, snap, onChange });
  latest.current = { min, max, width, value, snap, onChange };

  const pan = useMemo(() => {
    const setFromX = (pageX: number) => {
      const { min: lo, max: hi, width: w, value: v, snap: s, onChange: change } = latest.current;
      if (w <= 0 || hi <= lo) return;
      const ratio = Math.min(1, Math.max(0, (pageX - left.current) / w));
      const next = s(lo + ratio * (hi - lo));
      if (next !== v) change(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let the page scroll steal the drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.pageX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.pageX),
    });
  }, []);

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      left.current = x;
      setWidth(w);
    });
  };

  const ratio = max > min ? (value - min) / (max - min) : 0;

  return (
    <View
      style={styles.touch}
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const delta = e.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(snap(value + delta));
      }}
    >
      <View ref={trackRef} style={styles.track} onLayout={measure}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      {width > 0 ? <View pointerEvents="none" style={[styles.thumb, shadow.card, { left: ratio * width - THUMB / 2 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall invisible touch area around the thin track.
  touch: { height: THUMB + space[4], justifyContent: 'center', direction: 'ltr', marginHorizontal: THUMB / 2 },
  track: { height: size.progressBar + space[0.5], borderRadius: size.progressBar, backgroundColor: colors.onBrandSubtle },
  fill: { height: '100%', borderRadius: size.progressBar, backgroundColor: colors.onBrandMuted },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.accent,
    borderWidth: borderWidth.thick,
    borderColor: colors.surface,
  },
});
