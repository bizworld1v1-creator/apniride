import type { DriverApprovalStatus } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextLink } from '@/components/AuthLayout';
import { useOnboarding } from '@/lib/onboarding';
import { colors } from '@/lib/theme';

/** Home-screen card for a driver who can't go online yet: register, wait for review, fix, or suspended. */
export function DriverStatusCard({ status }: { status: Exclude<DriverApprovalStatus, 'approved'> }) {
  const { t } = useTranslation();
  // The reason for a rejection / suspension and whether registration was started.
  const { data } = useOnboarding();
  const open = () => router.push('/onboarding');
  const reason = data?.reviewNote ? <Text style={styles.reason}>{t('status.reason', { reason: data.reviewNote })}</Text> : null;

  return (
    <View style={styles.sheet}>
      {status === 'incomplete' ? (
        <>
          <Text style={styles.title}>{t('status.incompleteTitle')}</Text>
          <Text style={styles.body}>{t('status.incompleteBody')}</Text>
          <PrimaryButton label={data?.details ? t('status.continue') : t('status.start')} onPress={open} />
        </>
      ) : status === 'pending' ? (
        <>
          <Text style={styles.title}>{t('status.pendingTitle')}</Text>
          <Text style={styles.body}>{t('status.pendingBody')}</Text>
          <TextLink label={t('status.view')} onPress={open} />
        </>
      ) : status === 'rejected' ? (
        <>
          <Text style={styles.title}>{t('status.rejectedTitle')}</Text>
          {reason}
          <PrimaryButton label={t('status.fix')} onPress={open} />
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('status.suspendedTitle')}</Text>
          {reason}
          <Text style={styles.body}>{t('status.suspendedBody')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 6 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  body: { fontSize: 15, color: colors.muted, marginBottom: 14 },
  reason: { fontSize: 15, color: colors.error, marginBottom: 14 },
});
