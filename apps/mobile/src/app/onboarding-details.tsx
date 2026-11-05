import {
  type DriverDetailsBody,
  driverDetailsBodySchema,
  type DriverOnboarding,
  formatCnic,
  formatDate,
  type Gender,
  type VehicleType,
} from '@apniride/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { type Control, Controller, type FieldPath, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, type TextInputProps, View } from 'react-native';
import type { z } from 'zod';
import { authStyles, FieldError, PrimaryButton } from '@/components/AuthLayout';
import { Choice, OnboardingLayout, onboardingStyles } from '@/components/OnboardingLayout';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { ONBOARDING_KEY, useOnboarding } from '@/lib/onboarding';
import { colors, space } from '@/lib/theme';

type FormIn = z.input<typeof driverDetailsBodySchema>;
type FormOut = z.output<typeof driverDetailsBodySchema>;

/** Types the dashes for you: 3520212345671 → 35202-1234567-1. */
function typeCnic(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 13);
  return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join('-');
}

/** 31122028 → 31-12-2028 while typing. */
function typeDate(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('-');
}

function toForm(o: DriverOnboarding | undefined): FormIn {
  const d = o?.details;
  if (!d) {
    return {
      gender: undefined as unknown as Gender,
      cnic: '',
      licenceNumber: '',
      licenceExpiry: '',
      vehicle: { type: undefined as unknown as VehicleType, make: '', model: '', year: '', colour: '', plate: '' },
    };
  }
  return {
    ...d,
    cnic: formatCnic(d.cnic),
    licenceExpiry: formatDate(d.licenceExpiry),
    vehicle: { ...d.vehicle, year: String(d.vehicle.year) },
  };
}

export default function OnboardingDetailsScreen() {
  const { t } = useTranslation();
  const onboarding = useOnboarding();
  if (onboarding.isPending) {
    return (
      <OnboardingLayout title={t('driver.details.title')}>
        <ActivityIndicator color={colors.brand} />
      </OnboardingLayout>
    );
  }
  // Mount the form only once the saved details are here, so they become its starting values.
  return <DetailsForm initial={onboarding.data} />;
}

function DetailsForm({ initial }: { initial: DriverOnboarding | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(driverDetailsBodySchema),
    defaultValues: toForm(initial),
  });
  const editable = initial?.canEdit ?? true;

  const save = useMutation({
    mutationFn: (body: FormOut) => api.driver.onboarding.saveDetails(body as DriverDetailsBody),
    onSuccess: (data) => {
      queryClient.setQueryData(ONBOARDING_KEY, data);
      router.back();
    },
  });
  const onSubmit = handleSubmit((body) => save.mutate(body));

  return (
    <OnboardingLayout title={t('driver.details.title')} subtitle={t('driver.details.subtitle')}>
      <Text style={authStyles.label}>{t('driver.details.gender')}</Text>
      <Controller
        control={control}
        name="gender"
        render={({ field, fieldState }) => (
          <>
            <Choice<Gender>
              options={(['male', 'female', 'other'] as const).map((g) => ({ value: g, label: t(`driver.details.${g}`) }))}
              value={field.value}
              onChange={field.onChange}
              disabled={!editable}
            />
            <FieldError message={fieldState.error ? t('errors.required') : null} />
          </>
        )}
      />
      <View style={authStyles.gap} />
      <Field
        control={control}
        name="cnic"
        label={t('driver.details.cnic')}
        placeholder={t('driver.details.cnicPlaceholder')}
        format={typeCnic}
        keyboardType="number-pad"
        maxLength={15}
        editable={editable}
      />
      <Field
        control={control}
        name="licenceNumber"
        label={t('driver.details.licenceNumber')}
        autoCapitalize="characters"
        maxLength={25}
        editable={editable}
      />
      <Field
        control={control}
        name="licenceExpiry"
        label={t('driver.details.licenceExpiry')}
        placeholder={t('driver.details.licenceExpiryPlaceholder')}
        format={typeDate}
        keyboardType="number-pad"
        maxLength={10}
        editable={editable}
      />

      <Text style={onboardingStyles.section}>{t('driver.details.vehicleSection')}</Text>
      <Text style={authStyles.label}>{t('driver.details.vehicleType')}</Text>
      <Controller
        control={control}
        name="vehicle.type"
        render={({ field, fieldState }) => (
          <>
            <Choice<VehicleType>
              options={[
                { value: 'bike', label: `🏍️ ${t('driver.vehicle.bike')}` },
                { value: 'car', label: `🚗 ${t('driver.vehicle.car')}` },
              ]}
              value={field.value}
              onChange={field.onChange}
              disabled={!editable}
            />
            <FieldError message={fieldState.error ? t('errors.required') : null} />
          </>
        )}
      />
      <View style={authStyles.gap} />
      <Field control={control} name="vehicle.make" label={t('driver.details.make')} maxLength={30} editable={editable} />
      <Field control={control} name="vehicle.model" label={t('driver.details.model')} maxLength={30} editable={editable} />
      <Field
        control={control}
        name="vehicle.year"
        label={t('driver.details.year')}
        keyboardType="number-pad"
        maxLength={4}
        editable={editable}
      />
      <Field control={control} name="vehicle.colour" label={t('driver.details.colour')} maxLength={20} editable={editable} />
      <Field
        control={control}
        name="vehicle.plate"
        label={t('driver.details.plate')}
        placeholder={t('driver.details.platePlaceholder')}
        autoCapitalize="characters"
        maxLength={15}
        editable={editable}
      />

      <FieldError message={save.isError ? errorMessage(t, save.error) : null} />
      <View style={authStyles.gap} />
      {editable ? <PrimaryButton label={t('driver.details.save')} onPress={() => void onSubmit()} loading={save.isPending} /> : null}
    </OnboardingLayout>
  );
}

function Field({
  control,
  name,
  label,
  format,
  ...input
}: {
  control: Control<FormIn>;
  name: FieldPath<FormIn>;
  label: string;
  /** Reformats the text as the driver types (dashes in CNIC / dates). */
  format?: (text: string) => string;
} & Pick<TextInputProps, 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize' | 'editable'>) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={{ marginBottom: space[3.5] }}>
          <Text style={authStyles.label}>{label}</Text>
          <TextInput
            style={[authStyles.input, fieldState.error && authStyles.inputError]}
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(text) => field.onChange(format ? format(text) : text)}
            onBlur={field.onBlur}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            {...input}
          />
          <FieldError
            message={
              fieldState.error?.message
                ? t(`errors.${fieldState.error.message}`, { defaultValue: t('errors.generic') })
                : null
            }
          />
        </View>
      )}
    />
  );
}
