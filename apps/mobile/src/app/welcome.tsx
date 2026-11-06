import type { AppMode } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { SunScene } from '@/components/welcome/SunScene';
import { useAuth } from '@/lib/auth-store';
import { bodyFont } from '@/lib/fonts';
import { useEnter } from '@/lib/motion';
import { colors, fontSize, space, text, touch } from '@/lib/theme';

/** Delay before the words bounce in, after the sun has started rising (design: 0.6 s). */
const WORDS_DELAY = 600;

/**
 * First screen when signed out (design: splash.html). "Let's ride" signs in to passenger mode,
 * "Become a driver" to driver mode (both are the same app; the mode can be switched later without a new code).
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const wordmark = useEnter('up', 0, WORDS_DELAY);
  const tagline = useEnter('up', 2, WORDS_DELAY);
  const cta = useEnter('up', 4, WORDS_DELAY);
  const link = useEnter('up', 5, WORDS_DELAY);

  const start = (mode: AppMode) => {
    void useAuth.getState().setPreferredMode(mode);
    router.push('/sign-in');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.sky}>
        <SunScene />
      </View>
      <View style={styles.bottom}>
        <Animated.Text style={[text.wordmark, styles.white, wordmark]} accessibilityRole="header">
          ApniRide<Text style={styles.dot}>.</Text>
        </Animated.Text>
        <Animated.Text style={[styles.tagline, tagline]}>
          {t('welcome.taglineBefore')}
          <Text style={styles.highlight}> {t('welcome.taglineHighlight')} </Text>
          {t('welcome.taglineAfter')}
          {'\n'}
          {t('welcome.taglineLine2')}
        </Animated.Text>
        <Animated.View style={[styles.cta, cta]}>
          <Button variant="light" label={t('welcome.letsRide')} onPress={() => start('passenger')} />
        </Animated.View>
        <Animated.View style={link}>
          <Pressable onPress={() => start('driver')} accessibilityRole="button" style={styles.linkTap} hitSlop={touch.hitSlop}>
            <Text style={styles.link}>{t('welcome.becomeDriver')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  // The drawing sits at the bottom of the free space; on short phones its top (sky) is cut, not the words.
  sky: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  bottom: { paddingHorizontal: space[6], paddingBottom: space[4], paddingTop: space[6] },
  white: { color: colors.onColor },
  dot: { color: colors.accent },
  tagline: { ...bodyFont('medium'), fontSize: fontSize.brand, lineHeight: fontSize.brand * 1.4, color: colors.onColor, marginTop: space[3.5] },
  highlight: { ...bodyFont('bold'), backgroundColor: colors.accent, color: colors.onAccent },
  cta: { marginTop: space[8] },
  linkTap: { minHeight: touch.min, justifyContent: 'center', marginTop: space[2] },
  link: { ...bodyFont('semibold'), fontSize: fontSize.base, color: colors.onColor, textAlign: 'center', textDecorationLine: 'underline' },
});
