import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { ModeSwitch } from '@/components/ModeSwitch';
import { signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useMode } from '@/lib/mode';
import { Button, Icon, type IconName } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, opacity, radius, size, space, touch } from '@/lib/theme';

/**
 * The ☰ button for the home card, and the side menu it opens (like inDrive's): account, ride history, saved
 * places, profile, settings, switching mode and signing out.
 * A plain Modal (no drawer library): no extra native code, no gesture/animation work on low-end phones.
 * `busy`: driver online or a ride going on, so mode switching and signing out are greyed out.
 */
export function SideMenu({ visible, onClose, busy }: { visible: boolean; onClose: () => void; busy: boolean }) {
  const { t } = useTranslation();
  const mode = useMode();
  const name = useAuth((s) => s.user?.name);
  const phone = useAuth((s) => s.user?.phoneMasked);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const items: { icon: IconName; label: string; href: Href }[] = [
    { icon: 'clock', label: t(mode === 'driver' ? 'menu.earnings' : 'menu.history'), href: '/history' },
    ...(mode === 'passenger' ? [{ icon: 'pin' as IconName, label: t('menu.places'), href: '/places' as Href }] : []),
    { icon: 'user', label: t('menu.profile'), href: '/profile' },
    { icon: 'settings', label: t('menu.settings'), href: '/settings' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panel}>
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable style={styles.account} onPress={() => go('/profile')} accessibilityRole="button">
              <Avatar size={size.avatar} />
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.phone}>{phone}</Text>
                <Text style={styles.modeLabel}>{t(mode === 'driver' ? 'menu.inDriverMode' : 'menu.inPassengerMode')}</Text>
              </View>
            </Pressable>

            <View style={styles.items}>
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => go(item.href)}
                  accessibilityRole="button"
                >
                  <View style={styles.itemIcon}>
                    <Icon name={item.icon} size={iconSize.sm} color={colors.brand} />
                  </View>
                  <Text style={styles.itemText}>{item.label}</Text>
                  <Icon name="chevronRight" size={iconSize.sm} color={colors.disabled} />
                </Pressable>
              ))}
            </View>

            <ModeSwitch blocked={busy} />

            <Button
              variant="danger"
              label={t('menu.signOut')}
              onPress={() => {
                onClose();
                void signOut();
              }}
              disabled={busy}
            />
            {/* A driver must never vanish mid-shift by accident. */}
            {busy && mode === 'driver' ? <Text style={styles.muted}>{t('menu.signOutBlocked')}</Text> : null}
          </ScrollView>
        </SafeAreaView>
        {/* Tapping beside the panel closes it. */}
        <Pressable style={styles.flex} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('menu.close')} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Row direction follows the layout direction, so the panel is on the right in Urdu (RTL).
  backdrop: { flex: 1, flexDirection: 'row', backgroundColor: colors.overlay },
  panel: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: colors.background,
    borderTopEndRadius: radius.sheet,
    borderBottomEndRadius: radius.sheet,
    overflow: 'hidden',
  },
  content: { padding: space[5], gap: space[4] },
  // Blue hero card with the person's photo, name, number and mode.
  account: { flexDirection: 'row', alignItems: 'center', gap: space[3], backgroundColor: colors.brand, borderRadius: radius.card, padding: space[4] },
  name: { ...bodyFont('bold'), fontSize: fontSize.xxl, color: colors.onColor },
  phone: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.onBrandMuted },
  muted: { ...bodyFont('medium'), fontSize: fontSize.sm, color: colors.textSecondary },
  modeLabel: {
    ...bodyFont('bold'),
    alignSelf: 'flex-start',
    fontSize: fontSize.xs,
    color: colors.onAccent,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space[2.5],
    paddingVertical: space[0.5],
    marginTop: space[1.5],
    overflow: 'hidden',
  },
  items: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: space[3], paddingVertical: space[1] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], minHeight: touch.min + space[3] },
  itemPressed: { opacity: opacity.dim },
  itemIcon: {
    width: size.iconButton - space[2],
    height: size.iconButton - space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { ...bodyFont('semibold'), flex: 1, fontSize: fontSize.lg, color: colors.text },
});
