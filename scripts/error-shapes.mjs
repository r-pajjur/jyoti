#!/usr/bin/env node
/**
 * The client must turn every error shape a deployment can return into readable
 * words. The nested { error: { code, message } } is Vercel's own — it is what
 * a function that never booted answers with, and it used to render as
 * "[object Object]".
 */
import * as esbuild from 'esbuild';
import assert from 'node:assert/strict';

const bundle = await esbuild.build({
  entryPoints: ['src/api.ts'],
  bundle: true, write: false, format: 'esm', logLevel: 'silent',
  define: { __BUILD_ID__: '"test"' },
});
const source = bundle.outputFiles[0].text;
const { ApiError } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const cases = [
  ['our own handler', 500, '{"error":"Missing required environment variable: KV_REST_API_URL"}',
    /Missing required environment/],
  ['Vercel platform error', 404, '{"error":{"code":"NOT_FOUND","message":"The page could not be found"}}',
    /could not be found/],
  ['platform error with only a code', 500, '{"error":{"code":"FUNCTION_INVOCATION_FAILED"}}',
    /FUNCTION_INVOCATION_FAILED \(500\)/],
  ['an HTML error page', 502, '<!doctype html><h1>Bad Gateway</h1>', /Something went wrong \(502\)/],
  ['an empty body', 500, '', /Something went wrong \(500\)/],
];

let passed = 0;
for (const [label, status, body, expected] of cases) {
  globalThis.fetch = async () => new Response(body, { status });
  const mod = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  const error = await mod.fetchToday().then(() => null, (e) => e);
  assert.ok(error instanceof ApiError || error?.name === 'Error', `${label}: expected a thrown error`);
  assert.match(error.message, expected, `${label}: got "${error.message}"`);
  assert.doesNotMatch(error.message, /\[object Object\]/, `${label}: leaked [object Object]`);
  console.log(`  \x1b[32m✓\x1b[0m ${label} → "${error.message}"`);
  passed++;
}
console.log(`\n\x1b[32m${passed} error shapes render as words\x1b[0m\n`);
