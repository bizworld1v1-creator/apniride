import { CITY_CENTERS, type LatLng, type SavedPlace, savedPlaceKindSchema } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PLACES_KEY } from '@/lib/account';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { MAP_PROVIDER } from '@/lib/map-provider';
import { borderWidth, colors, elevation, fontSize, fontWeight, iconSize, radius, space, touch } from '@/lib/theme';
import { BackButton } from '@/components/ui';

const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

/** Put the pin on a place (move the map, like choosing a destination) and give it a name. */
export default function PickPlaceScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ kind: string; id?: string; label?: string; lat?: string; lng?: string }>();
  const kind = savedPlaceKindSchema.catch('other').parse(params.kind);
  const existing: LatLng | null =
    params.lat && params.lng ? { latitude: Number(params.lat), longitude: Number(params.lng) } : null;
  const mapRef = useRef<MapView>(null);
  // Map centre in a ref: dragging must not re-render the screen.
  const centerRef = useRef<LatLng>(existing ?? CITY_CENTERS.LHE);
  const defaultLabel = kind === 'home' ? t('places.home') : kind === 'work' ? t('places.work') : '';
  const [label, setLabel] = useState(params.label ?? defaultLabel);

  // A new place starts where the phone is (if location is allowed); an existing one where it was saved.
  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getLastKnownPositionAsync();
      if (cancelled || !pos) return;
      mapRef.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, ...DELTA }, 400);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useMutation({
    mutationFn: () => {
      const body = { kind, label: label.trim() || defaultLabel, location: { ...centerRef.current } };
      return params.id ? api.me.places.update(params.id, body) : api.me.places.create(body);
    },
    onSuccess: (place: SavedPlace) => {
      queryClient.setQueryData(PLACES_KEY, (old: { places: SavedPlace[] } | undefined) => {
        // Home / Work replace the old one of the same kind.
        const rest = (old?.places ?? []).filter((p) => p.id !== place.id && (kind === 'other' || p.kind !== kind));
        return { places: [...rest, place] };
      });
      void queryClient.invalidateQueries({ queryKey: PLACES_KEY });
      router.back();
    },
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={MAP_PROVIDER}
        initialRegion={{ ...(existing ?? CITY_CENTERS.LHE), ...DELTA }}
        onRegionChangeComplete={(r: Region) => {
          centerRef.current = { latitude: r.latitude, longitude: r.longitude };
        }}
        showsUserLocation
        toolbarEnabled={false}
        showsIndoors={false}
        showsBuildings={false}
      />
      {/* The emoji's tip sits on the exact map centre. */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Text style={styles.pin}>📍</Text>
      </View>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <BackButton overMap />
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.title}>{t(`places.pickTitle.${kind}`)}</Text>
          <Text style={styles.hint}>{t('places.pickHint')}</Text>
          <Text style={styles.label}>{t('places.label')}</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('places.labelPlaceholder')}
            placeholderTextColor={colors.muted}
            maxLength={40}
            style={styles.input}
            returnKeyType="done"
          />
          {save.error ? <Text style={styles.error}>{errorMessage(t, save.error)}</Text> : null}
          <Pressable
            style={styles.primary}
            onPress={() => save.mutate()}
            disabled={save.isPending}
            accessibilityRole="button"
            accessibilityState={{ busy: save.isPending }}
          >
            {save.isPending ? <ActivityIndicator color={colors.onColor} /> : <Text style={styles.primaryText}>{t('places.save')}</Text>}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinWrap: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  pin: { fontSize: iconSize.xl, marginBottom: iconSize.xl },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: space[3] },
  back: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space[2],
    paddingHorizontal: space[3.5],
    elevation: elevation.low,
  },
  backText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[4],
    elevation: elevation.medium,
  },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  hint: { fontSize: fontSize.md, color: colors.muted, marginTop: space[1], marginBottom: space[3] },
  label: { fontSize: fontSize.md, color: colors.muted, marginBottom: space[1] },
  input: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
    fontSize: fontSize.lg,
    color: colors.text,
  },
  error: { fontSize: fontSize.md, color: colors.error, marginTop: space[2] },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: space[4],
    alignItems: 'center',
    marginTop: space[3],
    minHeight: touch.button,
    justifyContent: 'center',
  },
  primaryText: { color: colors.brandText, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
});
