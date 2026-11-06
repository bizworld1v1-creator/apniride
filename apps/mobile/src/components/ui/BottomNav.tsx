import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, opacity, radius, size, space, touch } from '@/lib/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface NavItem<K extends string> {
  key: K;
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Not built yet: greyed out, says "Coming soon" to screen readers, does nothing. */
  comingSoon?: boolean;
}

interface Props<K extends string> {
  items: NavItem<K>[];
  active: K;
}

/** Floating dark pill at the bottom. The active tab is a yellow pill with icon + label; the others show the icon. */
export function BottomNav<K extends string>({ items, active }: Props<K>) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <PressableScale
            key={item.key}
            onPress={() => item.onPress?.()}
            disabled={item.comingSoon}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, disabled: !!item.comingSoon }}
            accessibilityLabel={item.comingSoon ? `${item.label}, ${t('common.comingSoon')}` : item.label}
            style={[styles.tab, on && styles.tabOn, item.comingSoon && styles.soon]}
          >
            <Icon name={item.icon} size={iconSize.sm} color={on ? colors.onAccent : colors.onColor} />
            {on ? <Text style={styles.label}>{item.label}</Text> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: size.bottomNav,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space[2],
  },
  tab: {
    minWidth: touch.min,
    height: touch.min + space[2],
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
  },
  tabOn: { backgroundColor: colors.accent, paddingHorizontal: space[6] },
  soon: { opacity: opacity.faint },
  label: { ...bodyFont('bold'), fontSize: fontSize.base, color: colors.onAccent },
});
