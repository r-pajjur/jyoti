#!/usr/bin/env node
/**
 * Compiles api/ with tsc and imports every handler under real Node ESM — the
 * way Vercel runs them in /var/task, with no bundler in the way.
 *
 * The other suites bundle with esbuild, which resolves extensionless imports
 * happily. Node does not: with "type": "module", `./_lib/day` must be written
 * `./_lib/day.js`. That difference shipped a deployment where every handler
 * died with ERR_MODULE_NOT_FOUND while all tests passed.
 */
import { execFileSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), '.esmcheck');
const HANDLERS = ['today', 'feed', 'archive', 'post', 'react', 'health', 'photo',
                  'subscribe', 'unsubscribe', 'cron/daily'];

await rm(OUT, { recursive: true, force: true });
try {
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit', 'false', '--outDir', OUT], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  await writeFile(
    join(OUT, 'probe.mjs'),
    `const names = ${JSON.stringify(HANDLERS)};
     let ok = 0;
     for (const name of names) {
       try {
         const mod = await import('./api/' + name + '.js');
         if (typeof mod.default !== 'function') throw new Error('no default export');
         console.log('  \\x1b[32m✓\\x1b[0m /api/' + name + ' loads');
         ok++;
       } catch (error) {
         console.log('  \\x1b[31m✗\\x1b[0m /api/' + name + ' — ' + (error.code ?? '') + ' ' + error.message.split('\\n')[0]);
       }
     }
     process.exit(ok === names.length ? 0 : 1);`,
  );

  execFileSync('node', [join(OUT, 'probe.mjs')], { stdio: 'inherit' });
  console.log(`\n\x1b[32m${HANDLERS.length} handlers resolve under real Node ESM\x1b[0m\n`);
} catch (error) {
  if (error.stderr) console.error(String(error.stderr).slice(0, 800));
  console.error('\x1b[31m✗ handlers do not load the way Vercel loads them\x1b[0m');
  process.exitCode = 1;
} finally {
  await rm(OUT, { recursive: true, force: true });
}
