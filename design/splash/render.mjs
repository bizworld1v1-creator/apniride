// Renders the native splash image (design/splash/sun.svg) to apps/mobile/assets/splash-icon.png.
// Run from the repo root after changing the drawing:   pnpm render:splash
// The splash only changes in a new build (EAS / dev build), not in Expo Go or an OTA update.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const svg = await readFile(path.join(here, 'sun.svg'));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
await writeFile(path.join(root, 'apps/mobile/assets/splash-icon.png'), png);
console.log(`splash-icon.png  ${png.length} bytes`);
