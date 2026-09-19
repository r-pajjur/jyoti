import * as esbuild from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const dev = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/main.ts'],
  outfile: 'public/app.js',
  bundle: true,
  format: 'iife',
  target: ['safari16', 'chrome110', 'firefox110'],
  minify: !dev,
  sourcemap: true,
  legalComments: 'none',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
};

async function buildServiceWorker() {
  const src = await readFile('src/sw.js', 'utf8');
  await writeFile('public/sw.js', src.replaceAll('__BUILD_ID__', BUILD_ID));
}

if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await buildServiceWorker();
  console.log(`[jyoti] watching — build ${BUILD_ID}`);
} else {
  await esbuild.build(options);
  await buildServiceWorker();
  console.log(`[jyoti] built ${BUILD_ID}`);
}
