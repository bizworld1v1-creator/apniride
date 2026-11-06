// Development only: every shared component from the new design on one screen, to check them on a real phone.
// Linked from Settings when running in development (`__DEV__`). Text here is sample data, not translated.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomNav,
  Button,
  Card,
  Chip,
  ComingSoonBadge,
  CountdownRing,
  IconButton,
  Initials,
  RouteConnector,
} from '@/components/ui';
import { useJelly } from '@/lib/motion';
import { colors, radius, space, text } from '@/lib/theme';

export default function UiPreviewScreen() {
  const [price, setPrice] = useState(450);
  const [chips, setChips] = useState<Record<string, boolean>>({ smooth: true });
  const [seconds, setSeconds] = useState(20);
  const jelly = useJelly(price);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s <= 0 ? 20 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
          <Text style={text.h2}>UI preview</Text>
          <IconButton icon="bell" label="Notifications" onPress={() => undefined} dot />
        </View>

        <Text style={text.h1}>Where to, Ahmed?</Text>
        <Text style={text.body}>Body text in Plus Jakarta Sans.</Text>
        <Text style={text.label}>Label · secondary</Text>

        <Card tone="hero" index={1}>
          <Text style={[text.label, styles.onBrandMuted]}>Your offer</Text>
          <Animated.Text style={[text.priceHero, styles.onBrand, { transform: [{ scale: jelly }] }]}>
            Rs {price}
          </Animated.Text>
          <View style={styles.row}>
            <Chip label="−Rs 20" onPress={() => setPrice((p) => p - 20)} />
            <Chip label="+Rs 20" onPress={() => setPrice((p) => p + 20)} />
          </View>
        </Card>

        <Card index={2} raised>
          <View style={styles.route}>
            <RouteConnector />
            <View style={styles.routeText}>
              <Text style={text.caption}>From</Text>
              <Text style={text.title}>Liberty Market, Gulberg</Text>
              <Text style={[text.caption, styles.gapTop]}>To</Text>
              <Text style={text.title}>Emporium Mall</Text>
            </View>
          </View>
        </Card>

        <Card index={3}>
          <View style={styles.row}>
            <Initials name="Ayesha Malik" tint="mint" />
            <View style={styles.flex}>
              <Text style={text.title}>Ayesha Malik</Text>
              <Text style={text.caption}>★ 4.8 · 1,120 trips</Text>
            </View>
            <CountdownRing secondsLeft={seconds} total={20} />
          </View>
        </Card>

        <View style={styles.wrap}>
          {['smooth', 'clean', 'onTime', 'friendly'].map((k) => (
            <Chip key={k} label={k} selected={!!chips[k]} onPress={() => setChips((c) => ({ ...c, [k]: !c[k] }))} />
          ))}
        </View>

        <View style={styles.row}>
          <Text style={text.title}>Rickshaw</Text>
          <ComingSoonBadge />
        </View>

        <Button variant="ink" label="Send offer to drivers" onPress={() => undefined} />
        <Button variant="primary" label="Ride with Ayesha" onPress={() => undefined} />
        <Button variant="outline" label="Share live trip" onPress={() => undefined} />
        <Button variant="danger" label="Cancel ride" onPress={() => undefined} />
        <Button variant="primary" label="Loading" onPress={() => undefined} loading />
        <View style={styles.blue}>
          <Button variant="light" label="Let's ride" onPress={() => undefined} />
          <IconButton icon="chevronLeft" label="Back" tone="onBrand" onPress={() => undefined} />
        </View>
        <View style={styles.row}>
          <IconButton icon="chat" label="Chat" onPress={() => undefined} />
          <IconButton icon="phone" label="Call" tone="brand" onPress={() => undefined} />
          <IconButton icon="x" label="Skip offer" tone="outline" onPress={() => undefined} />
        </View>

        <BottomNav
          active="home"
          items={[
            { key: 'home', icon: 'home', label: 'Home' },
            { key: 'trips', icon: 'clock', label: 'Trips' },
            { key: 'wallet', icon: 'wallet', label: 'Wallet', comingSoon: true },
            { key: 'profile', icon: 'user', label: 'Profile' },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space[5], gap: space[3.5] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  flex: { flex: 1 },
  route: { flexDirection: 'row', gap: space[3.5] },
  routeText: { flex: 1 },
  gapTop: { marginTop: space[3] },
  onBrand: { color: colors.onColor },
  onBrandMuted: { color: colors.onBrandMuted },
  blue: { backgroundColor: colors.brand, padding: space[5], borderRadius: radius.hero, gap: space[3] },
});
