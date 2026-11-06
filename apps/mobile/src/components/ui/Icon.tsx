import { memo, type ReactElement } from 'react';
import { I18nManager } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors, iconSize, iconStroke } from '@/lib/theme';

/**
 * Line icons with rounded caps, drawn on a 24 × 24 grid. Paths are from Lucide (ISC licence, lucide.dev).
 * We keep only the icons we use instead of the whole icon set, to keep the app small.
 */
const ICONS = {
  arrowRight: [<Path key="a" d="M5 12h14" />, <Path key="b" d="m12 5 7 7-7 7" />],
  chevronLeft: [<Path key="a" d="m15 18-6-6 6-6" />],
  chevronRight: [<Path key="a" d="m9 18 6-6-6-6" />],
  search: [<Circle key="a" cx="11" cy="11" r="8" />, <Path key="b" d="m21 21-4.3-4.3" />],
  bell: [
    <Path key="a" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />,
    <Path key="b" d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  ],
  clock: [<Circle key="a" cx="12" cy="12" r="10" />, <Polyline key="b" points="12 6 12 12 16 14" />],
  wallet: [<Rect key="a" width="20" height="14" x="2" y="5" rx="2" />, <Line key="b" x1="2" x2="22" y1="10" y2="10" />],
  user: [
    <Path key="a" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />,
    <Circle key="b" cx="12" cy="7" r="4" />,
  ],
  home: [
    <Path key="a" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    <Polyline key="b" points="9 22 9 12 15 12 15 22" />,
  ],
  building: [
    <Rect key="a" width="16" height="20" x="4" y="2" rx="2" />,
    <Path key="b" d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />,
  ],
  backspace: [
    <Path key="a" d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />,
    <Path key="b" d="m12 9 6 6M18 9l-6 6" />,
  ],
  faceVerySad: [
    <Circle key="a" cx="12" cy="12" r="10" />,
    <Path key="b" d="M16 17s-1.5-2.5-4-2.5-4 2.5-4 2.5M7.5 8.5l2 1M16.5 8.5l-2 1" />,
  ],
  faceSad: [
    <Circle key="a" cx="12" cy="12" r="10" />,
    <Path key="b" d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" />,
  ],
  faceOk: [<Circle key="a" cx="12" cy="12" r="10" />, <Path key="b" d="M8 15h8M9 9h.01M15 9h.01" />],
  faceHappy: [
    <Circle key="a" cx="12" cy="12" r="10" />,
    <Path key="b" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />,
  ],
  faceVeryHappy: [
    <Circle key="a" cx="12" cy="12" r="10" />,
    <Path key="b" d="M7 13a5 5 0 0 0 10 0zM9 9h.01M15 9h.01" />,
  ],
  x: [<Path key="a" d="M18 6 6 18" />, <Path key="b" d="m6 6 12 12" />],
  check: [<Path key="a" d="M20 6 9 17l-5-5" />],
  plus: [<Path key="a" d="M5 12h14" />, <Path key="b" d="M12 5v14" />],
  minus: [<Path key="a" d="M5 12h14" />],
  menu: [<Path key="a" d="M4 6h16M4 12h16M4 18h16" />],
  phone: [
    <Path
      key="a"
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    />,
  ],
  chat: [<Path key="a" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />],
  shield: [
    <Path
      key="a"
      d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
    />,
  ],
  power: [<Path key="a" d="M12 2v10" />, <Path key="b" d="M18.4 6.6a9 9 0 1 1-12.77.04" />],
  star: [
    <Polygon key="a" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  ],
  pin: [
    <Path key="a" d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />,
    <Circle key="b" cx="12" cy="10" r="3" />,
  ],
  car: [
    <Path
      key="a"
      d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
    />,
    <Circle key="b" cx="7" cy="17" r="2" />,
    <Path key="c" d="M9 17h6" />,
    <Circle key="d" cx="17" cy="17" r="2" />,
  ],
  bike: [
    <Circle key="a" cx="18.5" cy="17.5" r="3.5" />,
    <Circle key="b" cx="5.5" cy="17.5" r="3.5" />,
    <Circle key="c" cx="15" cy="5" r="1" />,
    <Path key="d" d="M12 17.5V14l-3-3 4-3 2 3h2" />,
  ],
  rickshaw: [
    <Path key="a" d="M3 16V9a4 4 0 0 1 4-4h6l4 6h3a1 1 0 0 1 1 1v4h-2" />,
    <Path key="b" d="M13 5v6h4M3 11h10M9 16h6" />,
    <Circle key="c" cx="7" cy="17" r="2" />,
    <Circle key="d" cx="17" cy="17" r="2" />,
  ],
  globe: [
    <Circle key="a" cx="12" cy="12" r="10" />,
    <Path key="b" d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />,
  ],
  settings: [
    <Path
      key="a"
      d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
    />,
    <Circle key="b" cx="12" cy="12" r="3" />,
  ],
} satisfies Record<string, ReactElement[]>;

export type IconName = keyof typeof ICONS;

/** Icons that point somewhere: mirrored in Urdu (right-to-left). */
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['arrowRight', 'chevronLeft', 'chevronRight']);

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Fill the shape too (e.g. a solid star). */
  filled?: boolean;
  strokeWidth?: number;
}

/** A line icon. Decorative by default: give the surrounding button an `accessibilityLabel`. */
export const Icon = memo(function Icon({
  name,
  size = iconSize.md,
  color = colors.text,
  filled = false,
  strokeWidth = iconStroke,
}: Props) {
  const flip = I18nManager.isRTL && DIRECTIONAL.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </Svg>
  );
});
