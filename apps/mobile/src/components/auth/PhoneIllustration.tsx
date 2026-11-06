import { Animated, StyleSheet, Text, View } from 'react-native';
import { displayFont } from '@/lib/fonts';
import { useEnter, useLoop } from '@/lib/motion';
import { colors, fontSize, letterSpacing, radius, space } from '@/lib/theme';

/**
 * The floating phone with a yellow speech bubble (sign-in screens). Drawn with plain views (no image to download).
 * Sizes here are the drawing itself. `bubble` is the text in the speech bubble (e.g. "• • •" or the dev code).
 */
export function PhoneIllustration({ bubble }: { bubble: string }) {
  const float = useLoop(1750);
  const bubbleIn = useEnter('pop', 0, 500);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '-3deg'] });

  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.phone, { transform: [{ translateY }, { rotate }] }]}>
        <View style={styles.speaker} />
        <View style={styles.line} />
        <View style={[styles.line, styles.lineShort]} />
      </Animated.View>
      <Animated.View style={[styles.bubble, bubbleIn]}>
        <Text style={styles.bubbleText}>{bubble}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 200, height: 160, direction: 'ltr' },
  phone: {
    position: 'absolute',
    left: 50,
    top: 8,
    width: 96,
    height: 150,
    borderRadius: 22,
    borderWidth: 5,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  speaker: { alignSelf: 'center', marginTop: space[3], width: 30, height: 5, borderRadius: 3, backgroundColor: colors.ink },
  line: { marginTop: space[4.5], marginHorizontal: space[3], height: 8, borderRadius: 4, backgroundColor: colors.brandSoft },
  lineShort: { marginTop: space[2], marginStart: 26 },
  bubble: {
    position: 'absolute',
    left: 124,
    top: 0,
    height: 44,
    paddingHorizontal: space[3.5],
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    borderBottomLeftRadius: radius.xs,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  bubbleText: { ...displayFont('extraBold'), fontSize: fontSize.xxl, letterSpacing: letterSpacing.pin, color: colors.onAccent },
});
