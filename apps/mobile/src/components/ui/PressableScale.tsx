import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/lib/motion';
import { motion, touch } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  /** Applied to the pressable itself, so layout styles (flex, width) work as on a View. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How small it gets while pressed (default 0.94; number-pad keys use 0.9). */
  pressedScale?: number;
}

/** A Pressable that shrinks a little while pressed (native driver, no re-render). The base of every button. */
export function PressableScale({ style, children, pressedScale = motion.pressScale, disabled, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();

  const to = (toValue: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue, speed: 40, bounciness: toValue === 1 ? 10 : 0, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={touch.hitSlop}
      disabled={disabled}
      onPressIn={() => to(pressedScale)}
      onPressOut={() => to(1)}
      {...rest}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
