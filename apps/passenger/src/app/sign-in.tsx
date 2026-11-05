import { pkMobileSchema } from '@apniride/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { AuthLayout, authStyles, FieldError, PrimaryButton } from '@/components/AuthLayout';
import { api, APP_ROLE } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { colors, radius } from '@/lib/theme';

const formSchema = z.object({ phone: pkMobileSchema });
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

export default function SignInScreen() {
  const { t } = useTranslation();
  const { control, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: { phone: '' },
  });

  const requestOtp = useMutation({
    mutationFn: (phone: string) => api.auth.requestOtp({ phone, role: APP_ROLE }),
    onSuccess: (res, phone) => {
      router.push({
        pathname: '/verify',
        params: { phone, resendIn: String(res.resendInSeconds), devCode: res.devCode ?? '' },
      });
    },
  });

  const onSubmit = handleSubmit(({ phone }) => requestOtp.mutate(phone));
  const fieldError = formState.errors.phone?.message;

  return (
    <AuthLayout title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <Text style={authStyles.label}>{t('auth.phoneLabel')}</Text>
      {/* Phone numbers always read left-to-right, also in Urdu. */}
      <View style={styles.row}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>🇵🇰 +92</Text>
        </View>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput
              style={[authStyles.input, styles.phoneInput, fieldError && authStyles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              onSubmitEditing={() => void onSubmit()}
              placeholder={t('auth.phonePlaceholder')}
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={16}
              autoFocus
              returnKeyType="done"
              accessibilityLabel={t('auth.phoneLabel')}
            />
          )}
        />
      </View>
      <FieldError message={fieldError ? t(`errors.${fieldError}`, { defaultValue: t('errors.invalid_phone') }) : null} />
      <FieldError message={requestOtp.isError ? errorMessage(t, requestOtp.error) : null} />
      <View style={authStyles.gap} />
      <PrimaryButton label={t('auth.sendCode')} onPress={() => void onSubmit()} loading={requestOtp.isPending} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', direction: 'ltr', alignItems: 'stretch' },
  prefix: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  prefixText: { fontSize: 17, color: colors.text },
  phoneInput: { flex: 1, textAlign: 'left', writingDirection: 'ltr' },
});
