import type { VehicleType } from '@apniride/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { PROFILE_KEY } from '@/lib/driver';
import { errorMessage } from '@/lib/errors';
import { colors } from '@/lib/theme';

const OPTIONS: { type: VehicleType; icon: string }[] = [
  { type: 'bike', icon: '🏍️' },
  { type: 'car', icon: '🚗' },
];

/** First step for a new driver. Full onboarding (CNIC, documents, approval) comes later. */
export function VehiclePicker({ current, onDone }: { current?: VehicleType | null; onDone?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (vehicleType: VehicleType) => api.driver.updateProfile({ vehicleType }),
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_KEY, profile);
      onDone?.();
    },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('vehicle.title')}</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.type}
            style={[styles.option, current === o.type && styles.selected]}
            onPress={() => save.mutate(o.type)}
            disabled={save.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.icon}>{o.icon}</Text>
            <Text style={styles.label}>{t(`vehicle.${o.type}`)}</Text>
          </Pressable>
        ))}
      </View>
      {save.isError ? <Text style={styles.error}>{errorMessage(t, save.error)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 6 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.brand },
  icon: { fontSize: 36 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 6 },
  error: { color: colors.error, fontSize: 14, marginTop: 10, textAlign: 'center' },
});
