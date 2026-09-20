import { calendarScreen } from './screens/calendar.js';
import { captureScreen } from './screens/capture.js';
import { feedScreen } from './screens/feed.js';
import { onboardingScreen } from './screens/onboarding.js';
import { welcomeScreen } from './screens/welcome.js';
import { getProfile } from './state.js';
import { isStandalone } from './platform.js';
import { startRouter } from './router.js';

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', function onChange(this: ServiceWorker) {
        if (this.state === 'installed' && navigator.serviceWorker.controller) this.postMessage('SKIP_WAITING');
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch (error) {
    console.warn('[dhara] service worker not registered', error);
  }
}

const PUBLIC_PATHS = new Set(['/', '/join']);

startRouter({
  fallback: '/',
  chromeless: ['/', '/join', '/capture'],
  routes: {
    '/': welcomeScreen,
    '/join': onboardingScreen,
    '/capture': captureScreen,
    '/feed': feedScreen,
    '/calendar': calendarScreen,
  },
  guard: (path) => {
    const hasProfile = !!getProfile();
    if (!hasProfile && !PUBLIC_PATHS.has(path)) return '/';
    // Returning visitors should not have to walk past the install screen again.
    if (hasProfile && path === '/' && isStandalone()) return '/feed';
    return null;
  },
});

void registerServiceWorker();
