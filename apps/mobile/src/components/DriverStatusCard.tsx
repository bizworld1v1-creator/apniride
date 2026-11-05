import type { DriverApprovalStatus } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextLink } from '@/components/AuthLayout';
import { useOnboarding } from '@/lib/onboarding';
import { colors, elevation, fontSize, fontWeight, radius, space } from '@/lib/theme';

/** Home-screen card for a driver who can't go online yet: register, wait for review, fix, or suspended. */
export function DriverStatusCard({ status }: { status: Exclude<DriverApprovalStatus, 'approved'> }) {
  const { t } = useTranslation();
  // The reason for a rejection / suspension and whether registration was started.
  const { data } = useOnboarding();
  const open = () => router.push('/onboarding');
  const reason = data?.reviewNote ? <Text style={styles.reason}>{t('driver.status.reason', { reason: data.reviewNote })}</Text> : null;

  return (
    <View style={styles.sheet}>
      {status === 'incomplete' ? (
        <>
          <Text style={styles.title}>{t('driver.status.incompleteTitle')}</Text>
          <Text style={styles.body}>{t('driver.status.incompleteBody')}</Text>
          <PrimaryButton label={data?.details ? t('driver.status.continue') : t('driver.status.start')} onPress={open} />
        </>
      ) : status === 'pending' ? (
        <>
          <Text style={styles.title}>{t('driver.status.pendingTitle')}</Text>
          <Text style={styles.body}>{t('driver.status.pendingBody')}</Text>
          <TextLink label={t('driver.status.view')} onPress={open} />
        </>
      ) : status === 'rejected' ? (
        <>
          <Text style={styles.title}>{t('driver.status.rejectedTitle')}</Text>
          {reason}
          <PrimaryButton label={t('driver.status.fix')} onPress={open} />
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('driver.status.suspendedTitle')}</Text>
          {reason}
          <Text style={styles.body}>{t('driver.status.suspendedBody')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space[4], elevation: elevation.medium },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: space[1.5] },
  body: { fontSize: fontSize.base, color: colors.muted, marginBottom: space[3.5] },
  reason: { fontSize: fontSize.base, color: colors.error, marginBottom: space[3.5] },
});
