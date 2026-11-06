import { updateProfileBodySchema } from '@apniride/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import type { z } from 'zod';
import { PhoneIllustration } from '@/components/auth/PhoneIllustration';
import { AuthLayout, authStyles, FieldError, TextLink } from '@/components/AuthLayout';
import { Button } from '@/components/ui';
import { api, signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/errors';
import { colors } from '@/lib/theme';

type FormIn = z.input<typeof updateProfileBodySchema>;
type FormOut = z.output<typeof updateProfileBodySchema>;

/** Shown once, right after the first sign-in, until the user has a name. */
export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const { control, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(updateProfileBodySchema),
    defaultValues: { name: '' },
  });

  const save = useMutation({
    mutationFn: (body: FormOut) => api.me.update(body),
    // Having a name flips the route guard in _layout and opens the home screen.
    onSuccess: (user) => useAuth.getState().setUser(user),
  });

  const onSubmit = handleSubmit((body) => save.mutate(body));
  const fieldError = formState.errors.name?.message;

  return (
    <AuthLayout
      title={t('auth.nameTitle')}
      subtitle={t('auth.nameSubtitle')}
      illustration={<PhoneIllustration bubble="👋" />}
      footer={
        <Button variant="ink" label={t('auth.continue')} onPress={() => void onSubmit()} loading={save.isPending} />
      }
    >
      <Text style={authStyles.label}>{t('auth.namePlaceholder')}</Text>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput
            style={[authStyles.input, fieldError && authStyles.inputError]}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => void onSubmit()}
            placeholder={t('auth.namePlaceholder')}
            placeholderTextColor={colors.muted}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={60}
            autoFocus
            returnKeyType="done"
          />
        )}
      />
      <FieldError message={fieldError ? t(`errors.${fieldError}`, { defaultValue: t('errors.generic') }) : null} />
      <FieldError message={save.isError ? errorMessage(t, save.error) : null} />
      <View style={authStyles.gap} />
      <TextLink label={t('auth.signOut')} onPress={() => void signOut()} />
    </AuthLayout>
  );
}
