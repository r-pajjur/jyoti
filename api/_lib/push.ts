import webpush from 'web-push';
import { allSubscribers, removeSubscriber, type Subscriber } from './store.js';

/**
 * Web push, self-hosted with VAPID keys. No APNS certificate: iOS 16.4+ speaks
 * standard Web Push once the app is installed to the home screen.
 */

function configure(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('Missing required environment variable: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@example.com', publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendReport {
  sent: number;
  failed: number;
  pruned: number;
  errors: { name: string; status?: number; message: string }[];
}

/**
 * Sends to everyone. A subscription the browser has discarded answers 404 or
 * 410; those rows are deleted rather than retried forever.
 */
export async function sendToAll(payload: PushPayload): Promise<SendReport> {
  configure();
  const subscribers = await allSubscribers();
  const report: SendReport = { sent: 0, failed: 0, pruned: 0, errors: [] };

  await Promise.all(
    subscribers.map(async (sub: Subscriber) => {
      try {
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, JSON.stringify(payload));
        report.sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        const message = error instanceof Error ? error.message : 'unknown';
        report.failed++;
        report.errors.push({ name: sub.name, status, message });
        if (status === 404 || status === 410) {
          await removeSubscriber(sub.endpoint);
          report.pruned++;
        }
      }
    }),
  );

  return report;
}
