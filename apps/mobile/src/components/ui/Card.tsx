import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { type EnterFrom, useEnter } from '@/lib/motion';
import { colors, radius, shadow, space } from '@/lib/theme';

interface Props {
  children: ReactNode;
  /** `hero` = blue card with white text (fare card, header). */
  tone?: 'plain' | 'hero';
  /** Soft blue shadow (use sparingly). */
  raised?: boolean;
  /** Pop in on mount; `index` staggers several cards. */
  enter?: EnterFrom;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** White (or blue hero) rounded card. */
export function Card({ children, tone = 'plain', raised, enter = 'up', index = 0, style }: Props) {
  const anim = useEnter(enter, index);
  return (
    <Animated.View style={[styles.base, tone === 'hero' ? styles.hero : styles.plain, raised && shadow.card, anim, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { padding: space[5] },
  plain: { backgroundColor: colors.surface, borderRadius: radius.card },
  hero: { backgroundColor: colors.brand, borderRadius: radius.hero },
});
