#!/usr/bin/env node
/** Generates the VAPID keypair push needs. Run once; keep the private key secret. */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`
Add these to Vercel → Settings → Environment Variables (Production):

  VAPID_PUBLIC_KEY          ${publicKey}
  VAPID_PRIVATE_KEY         ${privateKey}
  VAPID_SUBJECT             mailto:you@example.com
  PUBLIC_VAPID_PUBLIC_KEY   ${publicKey}

PUBLIC_VAPID_PUBLIC_KEY is the same public value; it is read at build time and
baked into the browser bundle. The private key never leaves the server.
`);
