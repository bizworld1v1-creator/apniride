// Renders the vehicle map markers (design/vehicles/*.svg) to PNGs for both apps, at 1x / 2x / 3x.
// Run from the repo root after changing a drawing:   pnpm render:vehicles
// A designer can replace the SVGs (keep the size and "front points up"), or drop in PNGs directly.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
/** Marker size in dp (points); the SVGs are drawn at 2x this. */
const SIZES = { car: [32, 56], bike: [24, 48] };
const APPS = ['apps/mobile'];

for (const [name, [width]] of Object.entries(SIZES)) {
  const svg = await readFile(path.join(here, `${name}.svg`));
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width * scale } }).render().asPng();
    const file = `${name}${scale === 1 ? '' : `@${scale}x`}.png`;
    for (const app of APPS) {
      const dir = path.join(root, app, 'assets', 'vehicles');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, file), png);
    }
    console.log(`${file}  ${png.length} bytes`);
  }
}
