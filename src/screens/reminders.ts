import { el, qs } from '../dom.js';
import { pushStatus } from '../platform.js';
import { disableNotifications, enableNotifications, isSubscribed } from '../push.js';
import { go, mountInto } from '../router.js';

/**
 * Turning the morning reminder on. Everyone onboarded before push existed, so
 * this is reachable from a card on the feed rather than only from onboarding.
 */
export async function remindersScreen(): Promise<HTMLElement> {
  const host = el('<section></section>');
  const status = pushStatus();
  const already = status === 'granted' && (await isSubscribed());

  const explanation: Record<string, string> = {
    'needs-install':
      'Reminders can only be switched on from the installed app. Open Dhara from your home-screen icon, then come back here.',
    unsupported:
      'This phone or browser cannot receive reminders. Everything else works — just open Dhara each morning.',
    denied:
      'Reminders were turned down earlier, and iPhone will not ask twice. If Dhara appears in Settings → Notifications, allow them there. If it is not listed at all, the quickest fix is below.',
    granted: 'Reminders are on. One quiet notification each morning, nothing else.',
    ready:
      'One quiet notification each morning with the day\'s invitation. No badges chasing you, no streaks to lose.',
  };

  const blocked = status === 'needs-install' || status === 'unsupported' || status === 'denied';

  const view = el(`
    <div>
      <div class="center">
        <div class="drop"></div>
        <h1>A gentle morning nudge</h1>
        <p class="muted">${explanation[status] ?? explanation.ready}</p>
      </div>
      <div class="card">
        ${
          already
            ? '<p class="note note-good">Reminders are on.</p><button class="btn btn-quiet" data-off>Turn reminders off</button>'
            : `<button class="btn" data-on ${blocked ? 'disabled' : ''}>Turn on morning reminders</button>`
        }
        ${
          status === 'denied'
            ? `<div class="note" style="margin-top:14px">
                 <strong>To reset it:</strong>
                 <ol class="steps steps-tight">
                   <li>Press and hold the Dhara icon on your home screen, then <strong>Remove App → Delete</strong>.</li>
                   <li>Open <strong>Safari</strong> and go to dhara-cmn.vercel.app</li>
                   <li>Share → <strong>Add to Home Screen</strong> → Add</li>
                   <li>Open Dhara from the icon and enter <strong>the same name as before</strong>, so your drops stay yours.</li>
                 </ol>
                 Nothing you have posted is lost — your drops live on the river, not on your phone.
               </div>`
            : ''
        }
        <button class="btn btn-quiet" data-back>Back to today</button>
        <p class="small muted center" data-result></p>
      </div>
      <p class="small muted center diag-stamp">build ${__BUILD_ID__}${__VAPID_PUBLIC_KEY__ ? '' : ' · no key'}</p>
      </div>
    </div>
  `);

  const result = qs(view, '[data-result]');

  view.querySelector('[data-on]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = 'Asking…';
    const outcome = await enableNotifications().catch((error: Error) => ({ ok: false, message: error.message }));
    result.textContent = outcome.message;
    if (outcome.ok) {
      go('/feed', { reload: true });
      return;
    }
    button.disabled = false;
    button.textContent = 'Turn on morning reminders';
  });

  view.querySelector('[data-off]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    await disableNotifications();
    go('/reminders', { reload: true });
  });

  view.querySelector('[data-back]')?.addEventListener('click', () => go('/feed'));

  mountInto(host, view);
  return host;
}
