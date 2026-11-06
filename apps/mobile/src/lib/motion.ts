import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { motion } from './theme';

/**
 * Animation helpers. Everything here runs on the native driver (transform + opacity only), so animations stay smooth
 * on low-end phones and don't re-render React. When the phone's "reduce motion" setting is on, loops stop and
 * things fade in instead of bouncing.
 */

const bezier = ([x1, y1, x2, y2]: readonly number[]) => Easing.bezier(x1!, y1!, x2!, y2!);

export const easing = {
  spring: bezier(motion.easing.spring),
  springBig: bezier(motion.easing.springBig),
  sheet: bezier(motion.easing.sheet),
  standard: Easing.inOut(Easing.ease),
};

let reduceMotionNow = false;
void AccessibilityInfo.isReduceMotionEnabled().then((on) => (reduceMotionNow = on));

/** Whether the phone's "reduce motion" / "remove animations" setting is on (updates live). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(reduceMotionNow);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotionNow = on;
      if (alive) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      reduceMotionNow = on;
      setReduce(on);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export type EnterFrom = 'up' | 'pop' | 'sheet' | 'fade';

/**
 * Pop / slide an element in once when it mounts. Pass `index` to stagger items (70 ms apart).
 * Returns a style for an `Animated.View`.
 */
export function useEnter(from: EnterFrom = 'up', index = 0, extraDelay = 0) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      delay: reduce ? 0 : extraDelay + index * motion.stagger,
      duration: reduce ? motion.duration.fast : from === 'sheet' ? motion.duration.sheet : motion.duration.enter,
      easing: reduce ? easing.standard : from === 'sheet' ? easing.sheet : easing.spring,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Runs once on mount on purpose: entering is a one-time effect.
  }, []);

  // Opacity must not overshoot past 1 with the springy curve.
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  if (reduce || from === 'fade') return { opacity };
  if (from === 'pop') {
    return { opacity, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };
  }
  const distance = from === 'sheet' ? 400 : 24;
  return {
    opacity: from === 'sheet' ? 1 : opacity,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

/**
 * A gentle endless loop between 0 and 1 (pin bounce, radar pulse, live dot). Stops when "reduce motion" is on
 * (returns a value stuck at 0) and when the component unmounts.
 */
export function useLoop(duration: number, { pingPong = true, enabled = true } = {}) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || !enabled) {
      value.setValue(0);
      return;
    }
    const step = (toValue: number) =>
      Animated.timing(value, { toValue, duration, easing: easing.standard, useNativeDriver: true });
    const loop = Animated.loop(
      pingPong ? Animated.sequence([step(1), step(0)]) : Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, enabled, duration, pingPong, value]);

  return value;
}

/**
 * A short "jelly" bounce every time `key` changes (prices). Returns a scale for `transform`.
 */
export function useJelly(key: unknown) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    scale.setValue(0.92);
    const anim = Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [key, reduce, scale]);

  return scale;
}
