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
import { colors } from '@/lib/theme';

/** Plain, light layout for the sign-in screens (no images or animations – fast on low-end phones). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>ApniRide</Text>
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
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8}>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: colors.error },
  label: { fontSize: 14, color: colors.muted, marginBottom: 6 },
  gap: { height: 16 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 48 },
  brand: { fontSize: 22, fontWeight: '700', color: colors.brand, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6 },
  body: { marginTop: 28 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.brandText, fontSize: 17, fontWeight: '600' },
  link: { color: colors.brand, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  linkDisabled: { color: colors.muted, fontWeight: '400' },
  error: { color: colors.error, fontSize: 14, marginTop: 8 },
  dev: { backgroundColor: colors.devBg, borderRadius: 8, padding: 10, marginBottom: 16 },
  devText: { color: colors.devText, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
