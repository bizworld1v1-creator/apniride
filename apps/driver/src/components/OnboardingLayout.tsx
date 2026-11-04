import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

/** Plain scrolling page with a back link, for the registration screens. */
export function OnboardingLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
            <Text style={styles.backText}>‹ {t('onboarding.back')}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A row of choices (gender, vehicle type). */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.choices}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={[styles.choice, value === o.value && styles.choiceSelected]}
          onPress={() => onChange(o.value)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === o.value, disabled }}
        >
          <Text style={[styles.choiceText, value === o.value && styles.choiceTextSelected]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const onboardingStyles = StyleSheet.create({
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  muted: { fontSize: 14, color: colors.muted },
  banner: { borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerText: { fontSize: 14, color: colors.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { fontSize: 16, color: colors.brand, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6 },
  body: { marginTop: 20 },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  choiceSelected: { borderColor: colors.brand, backgroundColor: '#FFFBEB' },
  choiceText: { fontSize: 15, color: colors.text },
  choiceTextSelected: { fontWeight: '700', color: colors.brand },
});
