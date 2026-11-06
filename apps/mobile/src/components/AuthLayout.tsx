import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { useEnter } from '@/lib/motion';
import { borderWidth, colors, fontSize, radius, size, space, text, touch } from '@/lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Drawing in the blue area (e.g. the floating phone). */
  illustration?: ReactNode;
  /** Back button in the blue area. */
  onBack?: () => void;
  /** Pinned to the bottom of the sheet (the main button). */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Sign-in layout from the design: blue top area with an illustration, white sheet (40 px top corners) that slides up.
 * The sheet scrolls on small phones; the footer button stays at the bottom.
 */
export function AuthLayout({ title, subtitle, illustration, onBack, footer, children }: Props) {
  const { t } = useTranslation();
  const sheetIn = useEnter('sheet');

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.top}>
        {onBack ? (
          <IconButton icon="chevronLeft" label={t('common.back')} tone="onBrand" onPress={onBack} style={styles.back} />
        ) : null}
        <View style={styles.illustration}>{illustration}</View>
      </SafeAreaView>
      <Animated.View style={[styles.sheet, sheetIn]}>
        <SafeAreaView edges={['bottom']} style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={text.h1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              <View style={styles.body}>{children}</View>
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

/** The main blue button (kept for the driver registration screens, which get their new layout in group 5). */
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
  return <Button variant="primary" label={label} onPress={onPress} loading={loading} disabled={disabled} />;
}

export function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={touch.hitSlop}
      style={styles.linkTap}
    >
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

export const authStyles = StyleSheet.create({
  /** Pill text field on the light background. */
  input: {
    minHeight: touch.button,
    borderRadius: radius.input,
    paddingHorizontal: space[5],
    ...bodyFont('semibold'),
    fontSize: fontSize.xxl,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: { borderWidth: borderWidth.thick, borderColor: colors.error },
  label: { ...text.label, marginBottom: space[1.5] },
  gap: { height: space[4] },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  flex: { flex: 1 },
  top: { minHeight: size.authHeader },
  back: { position: 'absolute', top: space[5], start: space[5], zIndex: 1 },
  illustration: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space[4] },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheetLarge,
    borderTopRightRadius: radius.sheetLarge,
  },
  content: { paddingHorizontal: space[6], paddingTop: space[7], paddingBottom: space[4] },
  subtitle: { ...text.body, color: colors.textSecondary, marginTop: space[1.5] },
  body: { marginTop: space[5] },
  footer: { paddingHorizontal: space[6], paddingBottom: space[4], paddingTop: space[2] },
  linkTap: { minHeight: touch.min, justifyContent: 'center' },
  link: { ...bodyFont('semibold'), color: colors.brand, fontSize: fontSize.base, textAlign: 'center' },
  linkDisabled: { ...bodyFont('regular'), color: colors.muted },
  error: { ...bodyFont('medium'), color: colors.error, fontSize: fontSize.md, marginTop: space[2] },
});
