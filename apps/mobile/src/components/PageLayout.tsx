import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, PressableScale } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, opacity, radius, space, text, touch } from '@/lib/theme';

/** Plain scrolling page with the round back button and a title (registration, profile, settings, saved places). */
export function PageLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <BackButton />
            <Text style={[text.h2, styles.flex]} accessibilityRole="header">
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A row of choices (gender, vehicle type, language): pills, the chosen one filled blue. */
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
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <PressableScale
            key={o.value}
            style={[styles.choice, on && styles.choiceSelected, disabled && styles.disabled]}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
          >
            <Text style={[styles.choiceText, on && styles.choiceTextSelected]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export const pageStyles = StyleSheet.create({
  section: { ...bodyFont('bold'), fontSize: fontSize.xl, color: colors.text, marginTop: space[2], marginBottom: space[2.5] },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space[5] },
  muted: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.textSecondary },
  banner: { borderRadius: radius.card - space[2], padding: space[4], marginBottom: space[4] },
  bannerText: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.text },
  /** Add to `authStyles.input` on a page: white field on the light background. */
  input: { backgroundColor: colors.surface, borderWidth: borderWidth.thin, borderColor: colors.border },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space[5], paddingBottom: space[10] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  subtitle: { ...text.body, color: colors.textSecondary, marginTop: space[3] },
  body: { marginTop: space[5] },
  choices: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  choice: {
    flexGrow: 1,
    minHeight: touch.min,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  disabled: { opacity: opacity.disabled },
  choiceText: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.text },
  choiceTextSelected: { color: colors.onColor },
});
