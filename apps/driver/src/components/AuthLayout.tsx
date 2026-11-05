import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { borderWidth, colors, fontSize, fontWeight, opacity, radius, space, touch } from '@/lib/theme';

/** Plain, light layout for the sign-in screens (no images or animations – fast on low-end phones). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>ApniRide Driver</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      style={[styles.button, inactive && styles.buttonDisabled]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? <ActivityIndicator color={colors.brandText} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={touch.hitSlop}>
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  return message ? (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  ) : null;
}

export function DevCodeBanner({ code, label }: { code?: string | null; label: string }) {
  if (!__DEV__ || !code) return null;
  return (
    <View style={styles.dev}>
      <Text style={styles.devText}>{label}</Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  input: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    fontSize: fontSize.xxl,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error },
  label: { fontSize: fontSize.md, color: colors.muted, marginBottom: space[1.5] },
  gap: { height: 16 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space[6], paddingTop: space[12] },
  brand: { fontSize: fontSize.brandLarge, fontWeight: fontWeight.bold, color: colors.brand, marginBottom: space[6] },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.base, color: colors.muted, marginTop: space[1.5] },
  body: { marginTop: space[7] },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: space[4],
    alignItems: 'center',
    minHeight: touch.button,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: opacity.disabled },
  buttonText: { color: colors.brandText, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
  link: { color: colors.brand, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center', paddingVertical: space[2] },
  linkDisabled: { color: colors.muted, fontWeight: fontWeight.regular },
  error: { color: colors.error, fontSize: fontSize.md, marginTop: space[2] },
  dev: { backgroundColor: colors.devBg, borderRadius: radius.sm, padding: space[2.5], marginBottom: space[4] },
  devText: { color: colors.devText, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
