import { MAX_SAVED_PLACES, type SavedPlace, type SavedPlaceKind } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { PageLayout, pageStyles } from '@/components/PageLayout';
import { Button, Icon, type IconName, IconButton } from '@/components/ui';
import { PLACES_KEY, usePlaces } from '@/lib/account';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { bodyFont } from '@/lib/fonts';
import { borderWidth, colors, fontSize, iconSize, radius, size, space, touch } from '@/lib/theme';

const ICON: Record<SavedPlaceKind, IconName> = { home: 'home', work: 'building', other: 'pin' };

const edit = (kind: SavedPlaceKind, place?: SavedPlace) =>
  router.push({
    pathname: '/places/pick',
    params: place
      ? { kind, id: place.id, label: place.label, lat: String(place.location.latitude), lng: String(place.location.longitude) }
      : { kind },
  });

/** Home, Work and other places. Passengers pick them as the destination when booking. */
export default function PlacesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const places = usePlaces();
  const list = places.data ?? [];
  const home = list.find((p) => p.kind === 'home');
  const work = list.find((p) => p.kind === 'work');
  const others = list.filter((p) => p.kind === 'other');

  const remove = useMutation({
    mutationFn: (id: string) => api.me.places.remove(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData(PLACES_KEY, (old: { places: SavedPlace[] } | undefined) =>
        old ? { places: old.places.filter((p) => p.id !== id) } : old,
      ),
  });
  const confirmRemove = (place: SavedPlace) =>
    Alert.alert(t('places.removeTitle'), place.label, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('places.remove'), style: 'destructive', onPress: () => remove.mutate(place.id) },
    ]);

  return (
    <PageLayout title={t('places.title')} subtitle={t('places.subtitle')}>
      {places.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {places.isError ? <Text style={styles.error}>{errorMessage(t, places.error)}</Text> : null}
      {remove.error ? <Text style={styles.error}>{errorMessage(t, remove.error)}</Text> : null}

      {places.data ? (
        <>
          <View style={pageStyles.card}>
            <PlaceRow kind="home" title={t('places.home')} place={home} onEdit={() => edit('home', home)} onRemove={home ? () => confirmRemove(home) : undefined} />
            <View style={styles.divider} />
            <PlaceRow kind="work" title={t('places.work')} place={work} onEdit={() => edit('work', work)} onRemove={work ? () => confirmRemove(work) : undefined} />
          </View>

          <Text style={[pageStyles.section, styles.sectionGap]}>{t('places.others')}</Text>
          {others.length ? (
            <View style={pageStyles.card}>
              {others.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <PlaceRow kind="other" title={p.label} place={p} onEdit={() => edit('other', p)} onRemove={() => confirmRemove(p)} />
                </View>
              ))}
            </View>
          ) : null}

          {list.length < MAX_SAVED_PLACES ? (
            <Button variant="outline" icon="plus" label={t('places.addOther')} onPress={() => edit('other')} style={styles.add} />
          ) : (
            <Text style={pageStyles.muted}>{t('places.limit', { count: MAX_SAVED_PLACES })}</Text>
          )}
        </>
      ) : null}
    </PageLayout>
  );
}

function PlaceRow({
  kind,
  title,
  place,
  onEdit,
  onRemove,
}: {
  kind: SavedPlaceKind;
  title: string;
  place: SavedPlace | undefined;
  onEdit: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  // Home / Work: the title is the slot; the custom name (if different) goes underneath.
  const sub = !place ? t('places.notSet') : kind !== 'other' && place.label !== title ? place.label : null;
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Icon name={ICON[kind]} size={iconSize.sm} color={colors.brand} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={pageStyles.muted} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Button
        variant={place ? 'outline' : 'primary'}
        compact
        label={place ? t('places.edit') : t('places.add')}
        onPress={onEdit}
        accessibilityLabel={`${place ? t('places.edit') : t('places.add')}: ${title}`}
      />
      {onRemove ? (
        <IconButton icon="x" tone="outline" label={`${t('places.remove')}: ${title}`} onPress={onRemove} diameter={touch.min} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { ...bodyFont('medium'), fontSize: fontSize.md, color: colors.error, marginBottom: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: touch.button - space[1] },
  iconBox: {
    width: size.iconButton - space[2],
    height: size.iconButton - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.text },
  divider: { height: borderWidth.thin, backgroundColor: colors.borderLight, marginVertical: space[2] },
  sectionGap: { marginTop: space[5] },
  add: { marginTop: space[4] },
});
