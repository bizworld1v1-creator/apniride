import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

/** Small pill that shows whether the backend (and its DB/Redis) is reachable. */
export function ServerStatus() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 60_000,
  });

  const state = isPending ? 'checking' : isError ? 'offline' : data.status === 'ok' ? 'ok' : 'degraded';
  const color = { checking: colors.neutral, ok: colors.success, degraded: colors.warning, offline: colors.error }[state];

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{t(`server.${state}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.xs, marginEnd: 6 },
  text: { fontSize: 12, color: colors.textTertiary },
});
