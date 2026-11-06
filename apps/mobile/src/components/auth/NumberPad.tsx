import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, PressableScale } from '@/components/ui';
import { bodyFont } from '@/lib/fonts';
import { colors, fontSize, iconSize, motion, radius, space, touch } from '@/lib/theme';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

/**
 * On-screen number pad for the phone number and the code (no system keyboard to open, and it never covers the
 * button). Always left-to-right, like every phone keypad, also in Urdu.
 */
export const NumberPad = memo(function NumberPad({ onDigit, onBackspace, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((d) => (
            <Key key={d} label={d} onPress={() => onDigit(d)} disabled={disabled} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.spacer} />
        <Key label="0" onPress={() => onDigit('0')} disabled={disabled} />
        <PressableScale
          style={styles.key}
          onPress={onBackspace}
          onLongPress={onBackspace}
          disabled={disabled}
          pressedScale={motion.pressScaleSmall}
          accessibilityLabel={t('auth.backspace')}
        >
          <Icon name="backspace" size={iconSize.md} />
        </PressableScale>
      </View>
    </View>
  );
});

function Key({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      style={styles.key}
      onPress={onPress}
      disabled={disabled}
      pressedScale={motion.pressScaleSmall}
      accessibilityLabel={label}
    >
      <Text style={styles.digit}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: { gap: space[2], direction: 'ltr' },
  row: { flexDirection: 'row', gap: space[2] },
  key: {
    flex: 1,
    height: touch.min + space[1],
    borderRadius: radius.chip,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  digit: { ...bodyFont('bold'), fontSize: fontSize.brand, color: colors.text },
});
