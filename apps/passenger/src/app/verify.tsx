import { ApiError, maskPhone, OTP_LENGTH } from '@apniride/shared';
import { useMutation } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { AuthLayout, authStyles, DevCodeBanner, FieldError, PrimaryButton, TextLink } from '@/components/AuthLayout';
import { api, APP_ROLE } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/errors';
import { colors, fontSize, letterSpacing } from '@/lib/theme';

/** Seconds left until `deadline`, ticking once per second (only this screen re-renders). */
function useCountdown(deadline: number) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [left]);
  return left;
}

export default function VerifyScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone: string; resendIn?: string; devCode?: string }>();
  const phone = params.phone;
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.devCode || null);
  const [resendAt, setResendAt] = useState(() => Date.now() + Number(params.resendIn ?? 60) * 1000);
  const resendIn = useCountdown(resendAt);

  const verify = useMutation({
    mutationFn: (value: string) => api.auth.verifyOtp({ phone, role: APP_ROLE, code: value }),
    // Signing in flips the route guards in _layout; the router moves on by itself.
    onSuccess: (session) => useAuth.getState().signIn(session),
    onError: () => setCode(''),
  });

  const resend = useMutation({
    mutationFn: () => api.auth.requestOtp({ phone, role: APP_ROLE }),
    onSuccess: (res) => {
      verify.reset();
      setDevCode(res.devCode ?? null);
      setResendAt(Date.now() + res.resendInSeconds * 1000);
    },
    onError: (err) => {
      // The server tells us how long to wait; respect it.
      if (err instanceof ApiError && err.retryAfterSeconds !== null) {
        setResendAt(Date.now() + err.retryAfterSeconds * 1000);
      }
    },
  });

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    // Submit automatically once all digits are in (also when Android autofills from SMS).
    if (digits.length === OTP_LENGTH && !verify.isPending) verify.mutate(digits);
  };

  if (!phone) return <Redirect href="/sign-in" />;

  const error = verify.isError ? verify.error : resend.isError ? resend.error : null;

  return (
    <AuthLayout title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle', { phone: maskPhone(phone) })}>
      <DevCodeBanner code={devCode} label={t('auth.devCode', { code: devCode })} />
      <TextInput
        style={[authStyles.input, styles.code, error && authStyles.inputError]}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        autoFocus
        editable={!verify.isPending}
        placeholder={'•'.repeat(OTP_LENGTH)}
        placeholderTextColor={colors.border}
        accessibilityLabel={t('auth.verifyTitle')}
      />
      <FieldError message={error ? errorMessage(t, error) : null} />
      <View style={authStyles.gap} />
      <PrimaryButton
        label={t('auth.verify')}
        onPress={() => verify.mutate(code)}
        loading={verify.isPending}
        disabled={code.length !== OTP_LENGTH}
      />
      <View style={authStyles.gap} />
      <TextLink
        label={resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
        onPress={() => resend.mutate()}
        disabled={resendIn > 0 || resend.isPending}
      />
      <TextLink label={t('auth.changeNumber')} onPress={() => router.back()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  code: {
    fontSize: fontSize.code,
    letterSpacing: letterSpacing.code,
    textAlign: 'center',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
});
