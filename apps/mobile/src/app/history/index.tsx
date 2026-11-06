import type { RideHistoryItem } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRupees } from '@/lib/fare';
import { HistoryRow } from '@/components/HistoryRow';
import { useEarnings, useHistory } from '@/lib/account';
import { errorMessage } from '@/lib/errors';
import { useMode } from '@/lib/mode';
import { borderWidth, colors, fontSize, fontWeight, radius, space } from '@/lib/theme';
import { BackButton } from '@/components/ui';

/** Finished rides of the current mode (20 at a time); in driver mode with the cash collected on top. */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const mode = useMode();
  const history = useHistory(mode);
  const rides = history.data?.pages.flatMap((p) => p.rides) ?? [];

  const refresh = () => void history.refetch();

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={rides}
        keyExtractor={(r: RideHistoryItem) => r.id}
        renderItem={({ item }) => (
          <HistoryRow ride={item} mode={mode} onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })} />
        )}
        contentContainerStyle={styles.content}
        // Light on low-end phones: render few rows at a time.
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={history.isRefetching && !history.isFetchingNextPage} onRefresh={refresh} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <BackButton />
            </View>
            <Text style={styles.title}>{t(mode === 'driver' ? 'history.titleDriver' : 'history.title')}</Text>
            {mode === 'driver' ? <EarningsCard /> : null}
          </View>
        }
        ListEmptyComponent={
          history.isPending ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : history.isError ? (
            <View style={styles.center}>
              <Text style={styles.error}>{errorMessage(t, history.error)}</Text>
              <Pressable onPress={refresh} accessibilityRole="button" style={styles.retry}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.empty}>{t(mode === 'driver' ? 'history.emptyDriver' : 'history.empty')}</Text>
          )
        }
        ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
    </SafeAreaView>
  );
}

function EarningsCard() {
  const { t } = useTranslation();
  const { data } = useEarnings();
  const periods = data
    ? [
        { label: t('history.earnings.today'), ...data.today },
        { label: t('history.earnings.week'), ...data.last7Days },
        { label: t('history.earnings.all'), ...data.allTime },
      ]
    : [];
  return (
    <View style={styles.earnings}>
      <Text style={styles.earningsTitle}>{t('history.earnings.title')}</Text>
      {data ? (
        <View style={styles.periods}>
          {periods.map((p) => (
            <View key={p.label} style={styles.period}>
              <Text style={styles.muted}>{p.label}</Text>
              <Text style={styles.cash}>{t('ride.fare', { amount: formatRupees(p.cash) })}</Text>
              <Text style={styles.muted}>{t('history.earnings.rides', { count: p.rides })}</Text>
            </View>
          ))}
        </View>
      ) : (
        <ActivityIndicator color={colors.brand} />
      )}
      <Text style={styles.note}>{t('history.earnings.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space[5], paddingBottom: space[10] },
  header: { flexDirection: 'row', marginBottom: space[3] },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.bold, color: colors.text, marginBottom: space[4] },
  spinner: { marginTop: space[6] },
  center: { alignItems: 'center', marginTop: space[6], gap: space[3] },
  error: { fontSize: fontSize.base, color: colors.error, textAlign: 'center' },
  retry: { borderWidth: borderWidth.thin, borderColor: colors.brand, borderRadius: radius.md, paddingVertical: space[2], paddingHorizontal: space[5] },
  retryText: { fontSize: fontSize.base, color: colors.brand, fontWeight: fontWeight.semibold },
  empty: { fontSize: fontSize.base, color: colors.muted, textAlign: 'center', marginTop: space[6] },
  earnings: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.borderLight,
    padding: space[4],
    marginBottom: space[4],
  },
  earningsTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: space[3] },
  periods: { flexDirection: 'row', gap: space[2] },
  period: { flex: 1 },
  cash: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.success, marginVertical: space[0.5] },
  muted: { fontSize: fontSize.sm, color: colors.muted },
  note: { fontSize: fontSize.xs, color: colors.muted, marginTop: space[3] },
});
