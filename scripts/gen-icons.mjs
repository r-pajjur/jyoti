import { writeFile, mkdir } from 'node:fs/promises';
import { encodePNG } from './lib/png.mjs';
import { renderDrop } from './lib/drop.mjs';

const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
  // Transparent glyph used as the in-app drop.
  { file: 'drop.png', size: 512, scale: 1, background: false },
];

await mkdir('public/icons', { recursive: true });
for (const target of TARGETS) {
  const pixels = renderDrop(target.size, { scale: target.scale, background: target.background !== false });
  await writeFile(`public/icons/${target.file}`, encodePNG(target.size, target.size, pixels));
  console.log(`[jyoti] icons/${target.file}`);
}
