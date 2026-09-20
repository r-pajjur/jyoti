#!/usr/bin/env node
/**
 * The prompts are the one file meant to be edited by hand, so check the shape
 * rather than the words: every day present once, nothing empty, types valid.
 */
import * as esbuild from 'esbuild';
import assert from 'node:assert/strict';

const bundle = await esbuild.build({
  entryPoints: ['api/_lib/prompts.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { PROMPTS, promptForDay } = await import(
  `data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`
);

let passed = 0;
const check = (label, fn) => { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); passed++; };

check('every day from 1 to 30 appears exactly once', () => {
  const days = PROMPTS.map((p) => p.day).sort((a, b) => a - b);
  assert.deepEqual(days, Array.from({ length: 30 }, (_, i) => i + 1));
});

check('every prompt has a valid type, a title and a text', () => {
  for (const prompt of PROMPTS) {
    assert.ok(['photo', 'reflection'].includes(prompt.type), `day ${prompt.day}: bad type`);
    assert.ok(prompt.title?.trim().length, `day ${prompt.day}: empty title`);
    assert.ok(prompt.text?.trim().length > 10, `day ${prompt.day}: text too short`);
  }
});

check('titles stay short enough for a calendar square heading', () => {
  for (const prompt of PROMPTS) {
    assert.ok(prompt.title.length <= 40, `day ${prompt.day}: title is ${prompt.title.length} chars`);
  }
});

check('lookup returns the right day, and nothing outside the month', () => {
  assert.equal(promptForDay(1).day, 1);
  assert.equal(promptForDay(30).day, 30);
  assert.equal(promptForDay(0), null);
  assert.equal(promptForDay(31), null);
});

const photo = PROMPTS.filter((p) => p.type === 'photo').length;
console.log(`\n\x1b[32m${passed} prompt checks passed\x1b[0m — ${photo} photo, ${30 - photo} reflection\n`);
