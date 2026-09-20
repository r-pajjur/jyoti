#!/usr/bin/env node
/**
 * Prints the WhatsApp message to send the group, ready to copy.
 *
 *   npm run message              today's prompt
 *   npm run message -- --day 7   a specific day, to write ahead
 *   npm run message -- --install the join-and-install message
 *   npm run message -- --all     every day, to review the month at once
 *
 * Reads the same prompts and start date the app does, so the day number here
 * and the day number on someone's phone can never disagree.
 */
import * as esbuild from 'esbuild';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const URL_BASE = (value('url') ?? process.env.DHARA_URL ?? 'https://dhara-cmn.vercel.app').replace(/\/+$/, '');
const START = process.env.DHARA_START_DATE ?? process.env.JYOTI_START_DATE ?? '2026-09-20';
const TIMEZONE = process.env.DHARA_TIMEZONE ?? process.env.JYOTI_TIMEZONE ?? 'Asia/Kolkata';

const bundle = await esbuild.build({
  entryPoints: ['api/_lib/prompts.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { PROMPTS } = await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`);

function todayNumber() {
  const here = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
  const days = (Date.parse(`${here}T00:00:00Z`) - Date.parse(`${START}T00:00:00Z`)) / 86_400_000;
  return Math.floor(days) + 1;
}

function dailyMessage(day) {
  const prompt = PROMPTS.find((p) => p.day === day);
  if (!prompt) return null;
  const invitation =
    prompt.type === 'photo'
      ? 'A photo is all it takes. A line with it if you feel like one.'
      : 'A few words is plenty — the true version, not the tidy one.';
  const closing =
    day === 30
      ? 'This is the last one. When you add your drop, the whole month opens as a keepsake. Thank you for every single day. 🙏'
      : "Once you add your drop, you'll see everyone else's from today.";

  return [
    `💧 *Dhara · Day ${day}*`,
    '',
    prompt.text,
    '',
    invitation,
    closing,
    '',
    URL_BASE,
  ].join('\n');
}

const INSTALL = [
  '💧 *Dhara — thirty mornings, together*',
  '',
  'We are home from the yatra. For the next thirty days there is one small invitation each morning: a photo, or a few words. When you add yours, you get to see everyone else\'s from that day.',
  '',
  'No pressure, no streaks, nothing to lose. Sometime during the day is perfect.',
  '',
  '*To set it up — about twenty seconds:*',
  '',
  `1. Open this link *in Safari*: ${URL_BASE}`,
  '2. Tap the *Share* button at the bottom (the square with an arrow pointing up)',
  '3. Scroll down and tap *Add to Home Screen*',
  '4. Tap *Add* in the top right',
  '5. Open *Dhara* from your home screen — the little drop — and type your name',
  '',
  'That is all. I will send the day\'s invitation here each morning. 🙏',
].join('\n');

const line = '─'.repeat(52);

if (flag('install')) {
  console.log(`\n${line}\n${INSTALL}\n${line}\n`);
} else if (flag('all')) {
  for (const prompt of PROMPTS) {
    console.log(`\n${line}\n${dailyMessage(prompt.day)}\n`);
  }
  console.log(line + '\n');
} else {
  const day = Number(value('day') ?? todayNumber());
  const message = dailyMessage(day);
  if (!message) {
    console.error(
      day < 1
        ? `Day ${day}: the thirty days begin on ${START}.`
        : `Day ${day}: the thirty days ended on day ${PROMPTS.length}.`,
    );
    process.exit(1);
  }
  console.log(`\n${line}\n${message}\n${line}\n`);
  if (!value('day')) console.log(`(today, ${TIMEZONE})\n`);
}
