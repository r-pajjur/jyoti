import { dropSubscription, sendSubscription } from './api.js';
import { pushStatus } from './platform.js';

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export interface SubscribeResult {
  ok: boolean;
  message: string;
}

/**
 * Must run from a user gesture, inside the installed app. On iOS a permission
 * request from a Safari tab fails instantly and sours the state, so
 * pushStatus() gates it before anything is asked.
 */
export async function enableNotifications(): Promise<SubscribeResult> {
  const status = pushStatus();
  if (status === 'needs-install') {
    return { ok: false, message: 'Open Dhara from your home-screen icon first, then try again.' };
  }
  if (status === 'unsupported') {
    return { ok: false, message: 'This browser cannot send reminders. Safari on iPhone 16.4 or newer works.' };
  }
  if (status === 'denied') {
    return { ok: false, message: 'Reminders are switched off in iPhone Settings → Notifications → Dhara.' };
  }
  if (!__VAPID_PUBLIC_KEY__) {
    return { ok: false, message: 'Reminders are not configured yet.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: 'No reminders for now. You can turn them on any time.' };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true, // iOS drops the subscription if a push is ever silent.
      applicationServerKey: urlBase64ToBytes(__VAPID_PUBLIC_KEY__),
    }));

  await sendSubscription(subscription);
  return { ok: true, message: 'Done. A gentle nudge will arrive each morning.' };
}

export async function disableNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  // Drop the server row first: if the browser unsubscribes but the request
  // fails, the morning push would go to an endpoint that no longer exists.
  await dropSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

export async function isSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  return !!(await registration.pushManager.getSubscription());
}
