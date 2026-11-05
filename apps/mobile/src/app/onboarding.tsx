import { DRIVER_DOCUMENT_TYPES, formatCnic, REQUIRED_DRIVER_DOCUMENTS } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authStyles, FieldError, PrimaryButton } from '@/components/AuthLayout';
import { DocumentRow } from '@/components/DocumentRow';
import { OnboardingLayout, onboardingStyles } from '@/components/OnboardingLayout';
import { api } from '@/lib/api';
import { PROFILE_KEY } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { ONBOARDING_KEY, useOnboarding } from '@/lib/onboarding';
import { colors, fontSize, fontWeight, space } from '@/lib/theme';

/** Registration overview: details, document photos, send for review. */
export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useOnboarding();

  const submit = useMutation({
    mutationFn: api.driver.onboarding.submit,
    onSuccess: (o) => {
      queryClient.setQueryData(ONBOARDING_KEY, o);
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  if (!data) {
    return (
      <OnboardingLayout title={t('driver.onboarding.title')}>
        {isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <FieldError message={errorMessage(t, error)} />
            <PrimaryButton label={t('driver.onboarding.retry')} onPress={() => void refetch()} />
          </>
        )}
      </OnboardingLayout>
    );
  }

  const { details, canEdit } = data;
  const byType = new Map(data.documents.map((d) => [d.type, d]));
  const submittedOn = data.submittedAt ? new Date(data.submittedAt).toLocaleDateString(i18n.language) : '';

  return (
    <OnboardingLayout title={t('driver.onboarding.title')}>
      {data.status === 'rejected' && data.reviewNote ? (
        <View style={[onboardingStyles.banner, styles.rejected]}>
          <Text style={[onboardingStyles.bannerText, styles.bold]}>{t('driver.status.rejectedTitle')}</Text>
          <Text style={onboardingStyles.bannerText}>{t('driver.status.reason', { reason: data.reviewNote })}</Text>
        </View>
      ) : null}
      {!canEdit ? (
        <View style={[onboardingStyles.banner, styles.info]}>
          <Text style={onboardingStyles.bannerText}>{t('driver.onboarding.submitted', { date: submittedOn })}</Text>
        </View>
      ) : null}

      <Text style={onboardingStyles.section}>{t('driver.onboarding.stepDetails')}</Text>
      <Pressable
        style={[onboardingStyles.card, styles.detailsRow]}
        onPress={() => router.push('/onboarding-details')}
        accessibilityRole="button"
      >
        <View style={styles.flex}>
          {details ? (
            <>
              <Text style={styles.strong}>{formatCnic(details.cnic)}</Text>
              <Text style={onboardingStyles.muted}>
                {t(`driver.vehicle.${details.vehicle.type}`)} · {details.vehicle.make} {details.vehicle.model} ·{' '}
                {details.vehicle.plate}
              </Text>
            </>
          ) : (
            <Text style={[onboardingStyles.muted, styles.todo]}>{t('driver.onboarding.detailsMissing')}</Text>
          )}
        </View>
        <Text style={styles.link}>{!canEdit ? '›' : details ? t('driver.onboarding.edit') : t('driver.onboarding.add')}</Text>
      </Pressable>

      <View style={authStyles.gap} />
      <Text style={onboardingStyles.section}>{t('driver.onboarding.stepDocuments')}</Text>
      {details ? (
        DRIVER_DOCUMENT_TYPES.map((type) => (
          <DocumentRow
            key={type}
            type={type}
            required={REQUIRED_DRIVER_DOCUMENTS.includes(type)}
            uploaded={byType.get(type)}
            editable={canEdit}
          />
        ))
      ) : (
        <Text style={onboardingStyles.muted}>{t('driver.onboarding.detailsFirst')}</Text>
      )}

      {canEdit ? (
        <>
          <View style={authStyles.gap} />
          {!data.readyToSubmit ? <Text style={[onboardingStyles.muted, styles.center]}>{t('driver.onboarding.submitHint')}</Text> : null}
          <FieldError message={submit.isError ? errorMessage(t, submit.error) : null} />
          <View style={authStyles.gap} />
          <PrimaryButton
            label={t('driver.onboarding.submit')}
            onPress={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!data.readyToSubmit}
          />
        </>
      ) : null}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  strong: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  link: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.brand },
  todo: { color: colors.brand, fontWeight: fontWeight.semibold },
  center: { textAlign: 'center' },
  bold: { fontWeight: fontWeight.bold, marginBottom: space[1] },
  rejected: { backgroundColor: colors.errorSoft },
  info: { backgroundColor: colors.infoSoft },
});
