import type { DriverApprovalStatus } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text } from 'react-native';
import { TextLink } from '@/components/AuthLayout';
import { Button } from '@/components/ui';
import { useOnboarding } from '@/lib/onboarding';
import { useEnter } from '@/lib/motion';
import { colors, radius, space, text } from '@/lib/theme';

/** Home-screen card for a driver who can't go online yet: register, wait for review, fix, or suspended. */
export function DriverStatusCard({ status }: { status: Exclude<DriverApprovalStatus, 'approved'> }) {
  const { t } = useTranslation();
  // The reason for a rejection / suspension and whether registration was started.
  const { data } = useOnboarding();
  const open = () => router.push('/onboarding');
  const enter = useEnter('pop', 1);
  const reason = data?.reviewNote ? <Text style={styles.reason}>{t('driver.status.reason', { reason: data.reviewNote })}</Text> : null;

  return (
    <Animated.View style={[styles.sheet, enter]}>
      {status === 'incomplete' ? (
        <>
          <Text style={styles.title}>{t('driver.status.incompleteTitle')}</Text>
          <Text style={styles.body}>{t('driver.status.incompleteBody')}</Text>
          <Button variant="ink" label={data?.details ? t('driver.status.continue') : t('driver.status.start')} onPress={open} />
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
          <Button variant="ink" label={t('driver.status.fix')} onPress={open} />
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('driver.status.suspendedTitle')}</Text>
          {reason}
          <Text style={styles.body}>{t('driver.status.suspendedBody')}</Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.hero, padding: space[5], gap: space[2] },
  title: { ...text.h2 },
  body: { ...text.body, color: colors.textSecondary, marginBottom: space[2] },
  reason: { ...text.body, color: colors.error, marginBottom: space[2] },
});
