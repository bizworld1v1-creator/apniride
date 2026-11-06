import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui';
import { borderWidth, colors, fontSize, fontWeight, radius, space, text } from '@/lib/theme';

/** Plain scrolling page with a back link (registration, profile, settings, saved places). */
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  subtitle: { ...text.body, color: colors.textSecondary, marginTop: space[3] },
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
