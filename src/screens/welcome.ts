import { el } from '../dom.js';
import { isIOS, isSafari, isStandalone } from '../platform.js';
import { go } from '../router.js';

export function welcomeScreen(): HTMLElement {
  const ios = isIOS();
  const inSafari = isSafari();

  const instructions = ios
    ? `
      <ol class="steps">
        <li>Tap the <strong>Share</strong> button at the bottom of Safari — the square with an arrow pointing up.</li>
        <li>Scroll down the list and tap <strong>Add to Home Screen</strong>.</li>
        <li>Tap <strong>Add</strong> in the top right corner.</li>
        <li>Close Safari, then open <strong>Jyoti</strong> from your home screen — the little drop.</li>
      </ol>
      ${
        inSafari
          ? ''
          : '<p class="note note-warn">It looks like you opened this inside another app. Tap the ••• menu and choose <strong>Open in Safari</strong> first — this only works from Safari.</p>'
      }`
    : `
      <ol class="steps">
        <li>Open the browser menu — the <strong>⋮</strong> or <strong>Install</strong> icon in the address bar.</li>
        <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
        <li>Open <strong>Jyoti</strong> from your home screen.</li>
      </ol>`;

  const node = el(`
    <section>
      <div class="center">
        <div class="drop"></div>
        <span class="eyebrow">Jyoti · ज्योति</span>
        <h1>Thirty mornings of light</h1>
        <p class="muted">We have come home from the yatra. For the next thirty days, one gentle prompt each morning — a photo, or a few words. When you add your drop, you get to see everyone else's.</p>
      </div>
      <hr class="rule">
      <div class="card">
        <h2>First, put Jyoti on your home screen</h2>
        <p class="muted small">It takes about twenty seconds, and it makes Jyoti open like an app instead of a web page.</p>
        ${instructions}
      </div>
      <button class="btn" data-continue>I've added it — let's begin</button>
      <button class="btn btn-quiet" data-skip>Continue in the browser for now</button>
    </section>
  `);

  node.querySelector('[data-continue]')?.addEventListener('click', () => go('/join'));
  node.querySelector('[data-skip]')?.addEventListener('click', () => go('/join'));
  if (isStandalone()) {
    node.querySelector('.card')?.replaceChildren(
      el('<div><h2>You are all set</h2><p class="muted">Jyoti is installed. Let\'s get your name.</p></div>'),
    );
  }
  return node;
}
