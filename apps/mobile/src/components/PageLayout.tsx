import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { borderWidth, colors, fontSize, fontWeight, radius, space, touch } from '@/lib/theme';

/** Plain scrolling page with a back link (registration, profile, settings, saved places). */
export function PageLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={touch.hitSlop} style={styles.back}>
            <Text style={styles.backText}>‹ {t('common.back')}</Text>
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

export const pageStyles = StyleSheet.create({
  section: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginTop: space[2], marginBottom: space[2.5] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[3.5], borderWidth: borderWidth.thin, borderColor: colors.border },
  muted: { fontSize: fontSize.md, color: colors.muted },
  banner: { borderRadius: radius.lg, padding: space[3], marginBottom: space[4] },
  bannerText: { fontSize: fontSize.md, color: colors.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space[5], paddingBottom: space[10] },
  back: { alignSelf: 'flex-start', marginBottom: space[3] },
  backText: { fontSize: fontSize.lg, color: colors.brand, fontWeight: fontWeight.semibold },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.base, color: colors.muted, marginTop: space[1.5] },
  body: { marginTop: space[5] },
  choices: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  choice: {
    flexGrow: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  choiceText: { fontSize: fontSize.base, color: colors.text },
  choiceTextSelected: { fontWeight: fontWeight.bold, color: colors.brand },
});
