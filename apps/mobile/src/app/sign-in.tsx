import { ApiError, maskPhone, OTP_LENGTH, pkMobileSchema } from '@apniride/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { NumberPad } from '@/components/auth/NumberPad';
import { OtpCircles } from '@/components/auth/OtpCircles';
import { PhoneIllustration } from '@/components/auth/PhoneIllustration';
import { AuthLayout, authStyles, FieldError, TextLink } from '@/components/AuthLayout';
import { Button, Icon } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/errors';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, iconSize, radius, size, space, touch } from '@/lib/theme';

/** Digits after the fixed +92 (e.g. 3001234567). */
const NATIONAL_LENGTH = 10;

/** "3001234567" → "300 1234567", as the design shows it. */
const formatNational = (digits: string) => (digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits);

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

type Step = 'phone' | 'code';

/**
 * Sign-in on one screen (design: login.html): phone number, then the SMS code, both typed on the on-screen
 * number pad. Mobile number + OTP only, no social login.
 */
export default function SignInScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('phone');
  const [national, setNational] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const resendIn = useCountdown(resendAt);

  const parsed = pkMobileSchema.safeParse(`+92${national}`);
  const phone = parsed.success && national.length === NATIONAL_LENGTH ? parsed.data : null;

  const requestOtp = useMutation({
    mutationFn: (e164: string) => api.auth.requestOtp({ phone: e164, role: useAuth.getState().preferredMode }),
    onSuccess: (res) => {
      verify.reset();
      setCode('');
      setDevCode(res.devCode ?? null);
      setResendAt(Date.now() + res.resendInSeconds * 1000);
      setStep('code');
    },
    onError: (err) => {
      // The server tells us how long to wait; respect it.
      if (err instanceof ApiError && err.retryAfterSeconds !== null) {
        setResendAt(Date.now() + err.retryAfterSeconds * 1000);
      }
    },
  });

  const verify = useMutation({
    mutationFn: (value: string) =>
      api.auth.verifyOtp({ phone: phone!, role: useAuth.getState().preferredMode, code: value }),
    // Signing in flips the route guards in _layout; the router moves on by itself.
    onSuccess: (session) => useAuth.getState().signIn(session),
    onError: () => setCode(''),
  });

  const busy = requestOtp.isPending || verify.isPending;

  const resetVerify = verify.reset;
  const editPhone = useCallback(() => {
    setStep('phone');
    setCode('');
    resetVerify();
  }, [resetVerify]);

  const back = () => {
    if (step === 'code') editPhone();
    else if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };

  // Android back button on the code step goes back to the number, not out of sign-in.
  useEffect(() => {
    if (step !== 'code') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      editPhone();
      return true;
    });
    return () => sub.remove();
  }, [step, editPhone]);

  const onDigit = (d: string) => {
    if (busy) return;
    if (step === 'phone') {
      // The +92 is fixed: a leading 0 (as in 0300…) is dropped.
      if (national.length === 0 && d === '0') return;
      if (national.length < NATIONAL_LENGTH) {
        requestOtp.reset();
        setNational(national + d);
      }
      return;
    }
    if (code.length >= OTP_LENGTH) return;
    const next = code + d;
    if (verify.isError) verify.reset();
    setCode(next);
    // Submit automatically once all digits are in.
    if (next.length === OTP_LENGTH) verify.mutate(next);
  };

  const onBackspace = () => {
    if (busy) return;
    if (step === 'phone') setNational(national.slice(0, -1));
    else setCode(code.slice(0, -1));
  };

  const onContinue = () => {
    if (step === 'phone') {
      if (phone) requestOtp.mutate(phone);
    } else if (code.length === OTP_LENGTH) {
      verify.mutate(code);
    }
  };

  const error = verify.isError ? verify.error : requestOtp.isError ? requestOtp.error : null;
  const bubble = __DEV__ && devCode && step === 'code' ? devCode : '• • •';

  return (
    <AuthLayout
      title={t('auth.title')}
      subtitle={t('auth.subtitle')}
      onBack={back}
      illustration={<PhoneIllustration bubble={bubble} />}
      footer={
        <Button
          variant="primary"
          label={t('auth.continue')}
          onPress={onContinue}
          loading={busy}
          disabled={step === 'phone' ? !phone : code.length !== OTP_LENGTH}
        />
      }
    >
      <Text style={authStyles.label}>{t('auth.phoneLabel')}</Text>
      {/* Phone numbers always read left-to-right, also in Urdu. */}
      <Pressable
        style={[styles.phoneField, step === 'phone' && styles.fieldActive]}
        onPress={step === 'code' ? editPhone : undefined}
        disabled={step === 'phone'}
        accessibilityRole={step === 'code' ? 'button' : 'text'}
        accessibilityLabel={`${t('auth.phoneLabel')}: +92 ${formatNational(national)}`}
        accessibilityHint={step === 'code' ? t('auth.editPhone') : undefined}
      >
        <Text style={styles.prefix}>+92</Text>
        <View style={styles.divider} />
        <Text style={[styles.phoneText, !national && styles.placeholder]} numberOfLines={1}>
          {national ? formatNational(national) : t('auth.phonePlaceholder')}
        </Text>
        {phone ? (
          <View style={styles.valid} accessible accessibilityLabel={t('auth.phoneValid')}>
            <Icon name="check" size={iconSize.sm} color={colors.onColor} strokeWidth={3} />
          </View>
        ) : null}
      </Pressable>

      {step === 'code' && phone ? (
        <View style={styles.codeBlock}>
          <Text style={authStyles.label}>
            {t('auth.codeLabel')} · {t('auth.verifySubtitle', { phone: maskPhone(phone) })}
          </Text>
          <OtpCircles value={code} length={OTP_LENGTH} error={verify.isError} />
        </View>
      ) : null}

      <FieldError message={error ? errorMessage(t, error) : null} />

      <View style={styles.pad}>
        <NumberPad onDigit={onDigit} onBackspace={onBackspace} disabled={busy} />
      </View>

      {step === 'code' && phone ? (
        <View style={styles.links}>
          <TextLink
            label={resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
            onPress={() => requestOtp.mutate(phone)}
            disabled={resendIn > 0 || busy}
          />
          <TextLink label={t('auth.changeNumber')} onPress={editPhone} />
        </View>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  phoneField: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.button,
    borderRadius: radius.input,
    backgroundColor: colors.background,
    paddingStart: space[5],
    paddingEnd: space[1.5],
    gap: space[2.5],
    borderWidth: borderWidth.thick,
    borderColor: colors.background,
  },
  fieldActive: { borderColor: colors.brand },
  prefix: { ...bodyFont('bold'), fontSize: fontSize.lg, color: colors.text },
  divider: { width: borderWidth.thin, height: iconSize.md, backgroundColor: colors.border },
  phoneText: { ...bodyFont('semibold'), flex: 1, fontSize: fontSize.xxl, color: colors.text },
  placeholder: { color: colors.muted },
  valid: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: size.iconButton / 2,
    backgroundColor: colors.online,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBlock: { marginTop: space[4.5] },
  pad: { marginTop: space[4] },
  links: { marginTop: space[2] },
});
