import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { ModeSwitch } from '@/components/ModeSwitch';
import { signOut } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useMode } from '@/lib/mode';
import { borderWidth, colors, elevation, fontSize, fontWeight, opacity, radius, space, touch } from '@/lib/theme';

/**
 * The ☰ button for the home card, and the side menu it opens (like inDrive's): account, ride history, saved
 * places, profile, settings, switching mode and signing out.
 * A plain Modal (no drawer library): no extra native code, no gesture/animation work on low-end phones.
 * `busy`: driver online or a ride going on, so mode switching and signing out are greyed out.
 */
export function MenuButton({ busy = false }: { busy?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('menu.open')}
        hitSlop={touch.hitSlop}
        style={styles.menuButton}
      >
        <Text style={styles.menuIcon}>☰</Text>
      </Pressable>
      <SideMenu visible={open} onClose={() => setOpen(false)} busy={busy} />
    </>
  );
}

function SideMenu({ visible, onClose, busy }: { visible: boolean; onClose: () => void; busy: boolean }) {
  const { t } = useTranslation();
  const mode = useMode();
  const name = useAuth((s) => s.user?.name);
  const phone = useAuth((s) => s.user?.phoneMasked);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const items: { icon: string; label: string; href: Href }[] = [
    { icon: '🕘', label: t(mode === 'driver' ? 'menu.earnings' : 'menu.history'), href: '/history' },
    ...(mode === 'passenger' ? [{ icon: '📍', label: t('menu.places'), href: '/places' as Href }] : []),
    { icon: '👤', label: t('menu.profile'), href: '/profile' },
    { icon: '⚙️', label: t('menu.settings'), href: '/settings' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panel}>
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable style={styles.account} onPress={() => go('/profile')} accessibilityRole="button">
              <Avatar size={56} />
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.muted}>{phone}</Text>
                <Text style={styles.modeLabel}>{t(mode === 'driver' ? 'menu.inDriverMode' : 'menu.inPassengerMode')}</Text>
              </View>
            </Pressable>

            <View style={styles.items}>
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.item}
                  onPress={() => go(item.href)}
                  accessibilityRole="button"
                >
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <Text style={styles.itemText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <ModeSwitch blocked={busy} />

            <Pressable
              style={[styles.signOut, busy && styles.disabled]}
              onPress={() => {
                onClose();
                void signOut();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
            >
              <Text style={styles.signOutText}>{t('menu.signOut')}</Text>
            </Pressable>
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
  menuButton: { paddingEnd: space[3], paddingVertical: space[0.5] },
  menuIcon: { fontSize: fontSize.heading, color: colors.text },
  // Row direction follows the layout direction, so the panel is on the right in Urdu (RTL).
  backdrop: { flex: 1, flexDirection: 'row', backgroundColor: colors.overlay },
  panel: { width: '80%', maxWidth: 340, backgroundColor: colors.surface, elevation: elevation.high },
  content: { padding: space[5], gap: space[4] },
  account: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.muted },
  modeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.brand, marginTop: space[0.5] },
  items: { borderTopWidth: borderWidth.thin, borderColor: colors.borderLight, paddingTop: space[2] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], minHeight: touch.min + space[2] },
  itemIcon: { fontSize: fontSize.xxl, width: 28, textAlign: 'center' },
  itemText: { fontSize: fontSize.lg, color: colors.text },
  signOut: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: space[3],
    alignItems: 'center',
    marginTop: space[2],
  },
  signOutText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.error },
  disabled: { opacity: opacity.faint },
});
