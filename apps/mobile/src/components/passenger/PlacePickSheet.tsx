import type { SavedPlace } from '@apniride/shared';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Chip } from '@/components/ui';
import { useEnter } from '@/lib/motion';
import { colors, radius, shadow, space, text } from '@/lib/theme';

/** Bottom sheet while the passenger moves the map under the pin: title, saved places as chips, confirm button. */
export function PlacePickSheet({
  step,
  places,
  onPlace,
  onConfirm,
}: {
  step: 'pickup' | 'dropoff';
  places: SavedPlace[] | undefined;
  onPlace: (place: SavedPlace) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const enter = useEnter('sheet');
  return (
    <Animated.View style={[styles.sheet, shadow.sheet, enter]}>
      <Text style={[text.title, styles.title]}>{t(step === 'pickup' ? 'ride.setPickup' : 'ride.setDropoff')}</Text>
      {step === 'dropoff' && places?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {places.map((place) => (
            <Chip key={place.id} label={place.label} onPress={() => onPlace(place)} />
          ))}
        </ScrollView>
      ) : null}
      <Button
        variant="ink"
        label={t(step === 'pickup' ? 'ride.confirmPickup' : 'ride.confirmDropoff')}
        onPress={onConfirm}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: space[5], gap: space[3.5] },
  title: { textAlign: 'center' },
  chips: { gap: space[2] },
});
