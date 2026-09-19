import { el, esc, qs } from '../dom.js';
import { getProfile, saveProfile } from '../state.js';
import { go } from '../router.js';

export function onboardingScreen(): HTMLElement {
  const node = el('<section></section>');
  let name = getProfile()?.name ?? '';

  const view = el(`
    <div>
      <div class="center">
        <div class="drop"></div>
        <span class="eyebrow">Jyoti · ज्योति</span>
        <h1>What shall we call you?</h1>
        <p class="muted">This is the name the group will see beside your drop. Your first name is plenty.</p>
      </div>
      <div class="card">
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" type="text" autocomplete="given-name" autocapitalize="words"
                 enterkeyhint="done" maxlength="40" placeholder="Lakshmi" value="${esc(name)}">
        </div>
        <button class="btn" data-next disabled>Begin</button>
      </div>
      <p class="small muted center">You can change this later by reinstalling — there is no password, no account.</p>
    </div>
  `);

  const input = qs<HTMLInputElement>(view, '#name');
  const next = qs<HTMLButtonElement>(view, '[data-next]');
  const validate = () => {
    name = input.value.trim();
    next.disabled = name.length < 2;
  };
  input.addEventListener('input', validate);
  input.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter' && !next.disabled) next.click();
  });
  next.addEventListener('click', () => {
    saveProfile(name);
    go('/feed');
  });
  validate();

  node.replaceChildren(view);
  setTimeout(() => input.focus(), 60);
  return node;
}
