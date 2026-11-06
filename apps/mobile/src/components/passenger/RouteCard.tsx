import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, RouteConnector } from '@/components/ui';
import { displayFont } from '@/lib/fonts';
import { colors, fontSize, space, text } from '@/lib/theme';

/** From / To card with the route connector, and optional distance + time on the end side. */
export function RouteCard({
  from,
  to,
  km,
  minutes,
  index = 0,
}: {
  from: string;
  to: string;
  km?: number;
  minutes?: number;
  index?: number;
}) {
  const { t } = useTranslation();
  return (
    <Card index={index}>
      <View style={styles.row}>
        <RouteConnector />
        <View style={styles.places}>
          <Text style={text.caption}>{t('ride.from')}</Text>
          <Text style={text.title} numberOfLines={1}>
            {from}
          </Text>
          <Text style={[text.caption, styles.to]}>{t('ride.to')}</Text>
          <Text style={text.title} numberOfLines={1}>
            {to}
          </Text>
        </View>
        {km !== undefined ? (
          <View style={styles.stats}>
            <Text style={styles.km}>{t('ride.km', { km })}</Text>
            {minutes !== undefined ? <Text style={text.caption}>{t('ride.aboutMin', { count: minutes })}</Text> : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[3.5] },
  places: { flex: 1 },
  to: { marginTop: space[3] },
  stats: { justifyContent: 'center', alignItems: 'flex-end' },
  km: { ...displayFont('extraBold'), fontSize: fontSize.xxl, color: colors.text },
});
