import type { Ride } from '@apniride/shared';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, ComingSoonBadge, Icon, type IconName } from '@/components/ui';
import { formatRupees } from '@/lib/fare';
import { useEnter, useLoop } from '@/lib/motion';
import { colors, iconSize, opacity, radius, size, space, text } from '@/lib/theme';

const FACES: IconName[] = ['faceVerySad', 'faceSad', 'faceOk', 'faceHappy', 'faceVeryHappy'];
const TAGS = ['tagSmooth', 'tagClean', 'tagOnTime', 'tagFriendly', 'tagAc', 'tagSafe'] as const;

/** Confetti pieces: horizontal position (0–1), colour, size and how far into the fall they start. */
const CONFETTI = [
  { x: 0.08, color: colors.accent, w: 14, start: 0 },
  { x: 0.24, color: colors.online, w: 10, start: 0.45 },
  { x: 0.5, color: colors.destination, w: 12, start: 0.2 },
  { x: 0.7, color: colors.accent, w: 10, start: 0.7 },
  { x: 0.86, color: colors.online, w: 14, start: 0.3 },
];

/**
 * After the ride (design: rate.html): blue header with falling confetti and a bouncing check, the cash to pay, and the
 * rating card. Ratings aren't built yet, so the faces and tags are greyed out with "Coming soon".
 */
export function TripComplete({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const { t } = useTranslation();
  const name = ride.driver?.firstName || t('ride.yourDriver');
  const fare = t('ride.fare', { amount: formatRupees(ride.fare) });
  const badge = useEnter('pop', 0, 200);
  const words = useEnter('up', 2, 200);
  const soon = `${t('ride.rateTitle', { name })}, ${t('common.comingSoon')}`;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Confetti />
        <Animated.View style={[styles.badge, badge]}>
          <Icon name="check" size={iconSize.xl} color={colors.onAccent} strokeWidth={3.2} />
        </Animated.View>
        <Animated.View style={[styles.words, words]}>
          <Text style={[text.h1, styles.white]} accessibilityRole="header">
            {t('ride.woohoo')}
          </Text>
          <Text style={[text.body, styles.whiteMuted]}>{t('ride.payNow', { fare, name })}</Text>
        </Animated.View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Card index={3}>
          <View accessible accessibilityLabel={soon} style={styles.rateTop}>
            <Text style={[text.title, styles.center]}>{t('ride.rateTitle', { name })}</Text>
            <ComingSoonBadge />
          </View>
          <View style={[styles.faces, styles.dim]} importantForAccessibility="no-hide-descendants">
            {FACES.map((face) => (
              <View key={face} style={styles.face}>
                <Icon name={face} size={iconSize.lg} color={colors.textSecondary} />
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.dim} importantForAccessibility="no-hide-descendants">
          <Text style={[text.title, styles.standOut]}>{t('ride.standOut')}</Text>
          <View style={styles.tags}>
            {TAGS.map((tag) => (
              <Chip key={tag} label={t(`ride.${tag}`)} onPress={() => undefined} disabled />
            ))}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Button variant="ink" label={t('ride.goHome')} onPress={onDone} />
      </SafeAreaView>
    </View>
  );
}

function Confetti() {
  const { width } = useWindowDimensions();
  const fall = useLoop(2600, { pingPong: false });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {CONFETTI.map((c) => {
        const p = Animated.modulo(Animated.add(fall, c.start), 1);
        return (
          <Animated.View
            key={c.x}
            style={[
              styles.piece,
              {
                left: c.x * width,
                width: c.w,
                height: c.w * 0.7,
                backgroundColor: c.color,
                opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }) },
                  { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const BADGE = 84;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.brand,
    borderBottomLeftRadius: radius.sheetLarge,
    borderBottomRightRadius: radius.sheetLarge,
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingBottom: space[8],
    overflow: 'hidden',
    direction: 'ltr',
  },
  piece: { position: 'absolute', top: 0, borderRadius: radius.xs },
  badge: {
    marginTop: space[10],
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { alignItems: 'center', marginTop: space[4], gap: space[1] },
  white: { color: colors.onColor, textAlign: 'center' },
  whiteMuted: { color: colors.onBrandMuted, textAlign: 'center' },
  content: { padding: space[5], gap: space[4] },
  rateTop: { alignItems: 'center', gap: space[2] },
  center: { textAlign: 'center' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[3.5] },
  face: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: opacity.faint },
  standOut: { marginBottom: space[2.5] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  footer: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
});
