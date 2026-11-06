import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Choice, PageLayout, pageStyles } from '@/components/PageLayout';
import { type LanguageChoice, setLanguage, useLanguage } from '@/lib/language';
import { Icon, PressableScale } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, space, text, touch } from '@/lib/theme';

/** Language, short help, emergency numbers and the app version. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const choice = useLanguage((s) => s.choice);
  const restartNeeded = useLanguage((s) => s.restartNeeded);
  const version = Constants.expoConfig?.version ?? '';

  return (
    <PageLayout title={t('settings.title')}>
      <Text style={pageStyles.section}>{t('settings.language')}</Text>
      <Choice<LanguageChoice>
        options={[
          { value: 'system', label: t('settings.system') },
          { value: 'en', label: t('settings.english') },
          { value: 'ur', label: t('settings.urdu') },
        ]}
        value={choice}
        onChange={(v) => void setLanguage(v)}
      />
      {restartNeeded ? <Text style={styles.note}>{t('settings.restart')}</Text> : null}

      <Text style={[pageStyles.section, styles.gap]}>{t('settings.help')}</Text>
      <View style={[pageStyles.card, styles.helpCard]}>
        <Text style={styles.body}>{t('settings.helpPay')}</Text>
        <Text style={styles.body}>{t('settings.helpDriver')}</Text>
      </View>

      <Text style={[pageStyles.section, styles.gap]}>{t('settings.emergency')}</Text>
      {/* Plain phone calls (free): opens the dialer with the number filled in. */}
      <View style={styles.callRow}>
        <CallButton label={t('settings.police')} number="15" />
        <CallButton label={t('settings.rescue')} number="1122" />
      </View>

      <Text style={[pageStyles.section, styles.gap]}>{t('settings.about')}</Text>
      <Text style={styles.body}>{t('tagline')}</Text>
      <Text style={pageStyles.muted}>{t('settings.version', { version })}</Text>
      {__DEV__ ? (
        <Pressable onPress={() => router.push('/ui-preview')} accessibilityRole="link" hitSlop={touch.hitSlop}>
          <Text style={[pageStyles.muted, styles.gap]}>UI preview (dev only)</Text>
        </Pressable>
      ) : null}
    </PageLayout>
  );
}

function CallButton({ label, number }: { label: string; number: string }) {
  return (
    <PressableScale style={styles.call} onPress={() => void Linking.openURL(`tel:${number}`)}>
      <Icon name="phone" size={iconSize.sm} color={colors.onColor} />
      <Text style={styles.callText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: space[6] },
  note: { ...bodyFont('semibold'), fontSize: fontSize.md, color: colors.warningStrong, marginTop: space[2] },
  helpCard: { gap: space[3] },
  body: { ...text.body, marginBottom: space[1] },
  callRow: { flexDirection: 'row', gap: space[3] },
  // Emergency calls: solid red pills (white text on the darker red passes 4.5:1).
  call: {
    flex: 1,
    flexDirection: 'row',
    gap: space[2],
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    alignItems: 'center',
    minHeight: touch.button,
    justifyContent: 'center',
  },
  callText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onColor },
});
