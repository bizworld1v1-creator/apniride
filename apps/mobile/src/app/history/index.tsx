import type { RideHistoryItem } from '@apniride/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRupees } from '@/lib/fare';
import { HistoryRow } from '@/components/HistoryRow';
import { useEarnings, useHistory } from '@/lib/account';
import { errorMessage } from '@/lib/errors';
import { useMode } from '@/lib/mode';
import { BackButton, Button, Icon } from '@/components/ui';
import { bodyFont, displayFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, radius, size, space, text } from '@/lib/theme';

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
              <Text style={[text.h2, styles.flex]} accessibilityRole="header">
                {t(mode === 'driver' ? 'history.titleDriver' : 'history.title')}
              </Text>
            </View>
            {mode === 'driver' ? <EarningsCard /> : null}
          </View>
        }
        ListEmptyComponent={
          history.isPending ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : history.isError ? (
            <View style={styles.center}>
              <Text style={styles.error}>{errorMessage(t, history.error)}</Text>
              <Button variant="outline" compact label={t('common.retry')} onPress={refresh} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="clock" size={iconSize.xl} color={colors.brand} />
              </View>
              <Text style={styles.empty}>{t(mode === 'driver' ? 'history.emptyDriver' : 'history.empty')}</Text>
            </View>
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
      <Text style={[text.label, styles.earningsTitle]}>{t('history.earnings.title')}</Text>
      {data ? (
        <View style={styles.periods}>
          {periods.map((p) => (
            <View key={p.label} style={styles.period}>
              <Text style={styles.muted}>{p.label}</Text>
              <Text style={styles.cash} adjustsFontSizeToFit numberOfLines={1}>{t('ride.fare', { amount: formatRupees(p.cash) })}</Text>
              <Text style={styles.muted}>{t('history.earnings.rides', { count: p.rides })}</Text>
            </View>
          ))}
        </View>
      ) : (
        <ActivityIndicator color={colors.onColor} />
      )}
      <Text style={styles.note}>{t('history.earnings.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space[5], paddingBottom: space[10] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[5] },
  spinner: { marginTop: space[6] },
  center: { alignItems: 'center', marginTop: space[6], gap: space[3] },
  error: { ...bodyFont('medium'), fontSize: fontSize.base, color: colors.error, textAlign: 'center' },
  emptyBox: { alignItems: 'center', marginTop: space[10], gap: space[4] },
  emptyIcon: {
    width: size.avatarLarge + space[4],
    height: size.avatarLarge + space[4],
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { ...bodyFont('medium'), fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
  // Blue hero card (design: earnings card).
  earnings: { backgroundColor: colors.brand, borderRadius: radius.hero, padding: space[5], marginBottom: space[5] },
  earningsTitle: { color: colors.onBrandMuted, marginBottom: space[3] },
  periods: { flexDirection: 'row', gap: space[2] },
  period: { flex: 1 },
  cash: { ...displayFont('extraBold'), fontSize: fontSize.xxl, color: colors.onColor, marginVertical: space[0.5] },
  muted: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.onBrandMuted },
  note: { ...bodyFont('medium'), fontSize: fontSize.xs, color: colors.onBrandMuted, marginTop: space[3] },
});
