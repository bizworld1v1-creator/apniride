import { DRIVER_DOCUMENT_TYPES, formatCnic, REQUIRED_DRIVER_DOCUMENTS } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { authStyles, FieldError } from '@/components/AuthLayout';
import { DocumentRow } from '@/components/DocumentRow';
import { PageLayout, pageStyles } from '@/components/PageLayout';
import { Button, Icon, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { PROFILE_KEY } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { ONBOARDING_KEY, useOnboarding } from '@/lib/onboarding';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, size, space } from '@/lib/theme';

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
      <PageLayout title={t('driver.onboarding.title')}>
        {isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <FieldError message={errorMessage(t, error)} />
            <Button variant="outline" label={t('driver.onboarding.retry')} onPress={() => void refetch()} />
          </>
        )}
      </PageLayout>
    );
  }

  const { details, canEdit } = data;
  const byType = new Map(data.documents.map((d) => [d.type, d]));
  const submittedOn = data.submittedAt ? new Date(data.submittedAt).toLocaleDateString(i18n.language) : '';

  return (
    <PageLayout title={t('driver.onboarding.title')}>
      {data.status === 'rejected' && data.reviewNote ? (
        <View style={[pageStyles.banner, styles.rejected]}>
          <Text style={[pageStyles.bannerText, styles.bold]}>{t('driver.status.rejectedTitle')}</Text>
          <Text style={pageStyles.bannerText}>{t('driver.status.reason', { reason: data.reviewNote })}</Text>
        </View>
      ) : null}
      {!canEdit ? (
        <View style={[pageStyles.banner, styles.info]}>
          <Text style={pageStyles.bannerText}>{t('driver.onboarding.submitted', { date: submittedOn })}</Text>
        </View>
      ) : null}

      <Text style={pageStyles.section}>{t('driver.onboarding.stepDetails')}</Text>
      <PressableScale style={[pageStyles.card, styles.detailsRow]} onPress={() => router.push('/onboarding-details')}>
        <View style={[styles.iconBox, details && styles.iconDone]}>
          <Icon name={details ? 'check' : 'user'} size={iconSize.sm} color={details ? colors.onColor : colors.brand} />
        </View>
        <View style={styles.flex}>
          {details ? (
            <>
              <Text style={styles.strong}>{formatCnic(details.cnic)}</Text>
              <Text style={pageStyles.muted}>
                {t(`driver.vehicle.${details.vehicle.type}`)} · {details.vehicle.make} {details.vehicle.model} ·{' '}
                {details.vehicle.plate}
              </Text>
            </>
          ) : (
            <Text style={[pageStyles.muted, styles.todo]}>{t('driver.onboarding.detailsMissing')}</Text>
          )}
        </View>
        {canEdit ? (
          <Text style={styles.link}>{details ? t('driver.onboarding.edit') : t('driver.onboarding.add')}</Text>
        ) : null}
        <Icon name="chevronRight" size={iconSize.sm} color={colors.textSecondary} />
      </PressableScale>

      <View style={authStyles.gap} />
      <Text style={pageStyles.section}>{t('driver.onboarding.stepDocuments')}</Text>
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
        <Text style={pageStyles.muted}>{t('driver.onboarding.detailsFirst')}</Text>
      )}

      {canEdit ? (
        <>
          <View style={authStyles.gap} />
          {!data.readyToSubmit ? <Text style={[pageStyles.muted, styles.center]}>{t('driver.onboarding.submitHint')}</Text> : null}
          <FieldError message={submit.isError ? errorMessage(t, submit.error) : null} />
          <View style={authStyles.gap} />
          <Button
            variant="ink"
            label={t('driver.onboarding.submit')}
            onPress={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!data.readyToSubmit}
          />
        </>
      ) : null}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  iconBox: {
    width: size.iconButton - space[2],
    height: size.iconButton - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDone: { backgroundColor: colors.success },
  strong: { ...bodyFont('bold'), fontSize: fontSize.lg, color: colors.text },
  link: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.brand },
  todo: { ...bodyFont('bold'), color: colors.brand },
  center: { textAlign: 'center' },
  bold: { ...bodyFont('bold'), marginBottom: space[1] },
  rejected: { backgroundColor: colors.errorSoft },
  info: { backgroundColor: colors.infoSoft },
});
