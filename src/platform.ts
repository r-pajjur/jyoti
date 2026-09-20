/** Install detection — the welcome screen tells people what they still need to do. */

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium/.test(ua);
}

export function supportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export type PushBlocker = 'ready' | 'needs-install' | 'unsupported' | 'denied' | 'granted';

/** iOS only exposes a working PushManager inside the installed app. */
export function pushStatus(): PushBlocker {
  if (!supportsPush()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return 'ready';
}

/* ── Home-screen icon badge ─────────────────────────────────────────────── */

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** One unanswered prompt shows a badge; a posted day clears it. Decorative —
 *  never let it break a render. */
export async function setBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    /* not supported here */
  }
}
