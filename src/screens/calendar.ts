import { el, esc } from '../dom.js';
import { fetchArchive, type ArchiveDay, type Post } from '../api.js';
import { getProfile } from '../state.js';
import { errorScreen, loadingScreen } from '../ui.js';
import { go, mountInto } from '../router.js';

function thumb(post: Post): string {
  if (post.photoUrl) {
    return `<img loading="lazy" decoding="async" alt="${esc(post.author ?? 'A lamp')}" src="${esc(post.photoUrl)}">`;
  }
  return `<div class="thumb-text">${esc(post.body.slice(0, 120))}</div>`;
}

/** One square in the month grid. A lit day shows a photo behind the number. */
function cell(entry: ArchiveDay, today: number, selected: number, mineOnly: boolean): string {
  const posts = mineOnly ? entry.posts.filter((post) => post.mine) : entry.posts;
  const cover = posts.find((post) => post.photoUrl)?.photoUrl;
  const lit = posts.length > 0 && !entry.locked;
  const classes = [
    'cell',
    lit ? 'lit' : '',
    entry.day === today ? 'today' : '',
    entry.day > today ? 'empty' : '',
  ].filter(Boolean).join(' ');

  return `
    <button class="${classes}" data-day="${entry.day}" aria-pressed="${entry.day === selected}"
            ${entry.day > today ? 'disabled' : ''}>
      ${cover ? `<img loading="lazy" decoding="async" alt="" src="${esc(cover)}">` : ''}
      <span class="n">${entry.day}</span>
      <span class="f" aria-hidden="true">${entry.locked ? '🔒' : lit ? '🪔' : ''}</span>
    </button>`;
}

export async function calendarScreen(): Promise<HTMLElement> {
  const host = el('<section></section>');
  mountInto(host, loadingScreen('Gathering the month…'));

  try {
    const archive = await fetchArchive();
    const name = getProfile()?.name ?? 'you';
    // The API hands back newest-first; the calendar reads naturally ascending.
    const days = [...archive.days].sort((a, b) => a.day - b.day);
    let mineOnly = false;
    let selected = archive.today;

    const view = el(`
      <div>
        <span class="eyebrow">The gallery</span>
        <h1>${archive.today} of ${archive.totalDays} mornings</h1>
        <p class="muted">Every lamp the group has lit so far. Tap a day to open it.</p>
        <div class="segmented">
          <button data-scope="all" aria-pressed="true">Everyone</button>
          <button data-scope="mine" aria-pressed="false">${esc(name)}'s thread</button>
        </div>
        <div class="calendar" data-grid></div>
        <div data-detail></div>
      </div>
    `);

    const grid = view.querySelector('[data-grid]') as HTMLElement;
    const detail = view.querySelector('[data-detail]') as HTMLElement;

    function paintDetail(): void {
      const entry = days.find((day) => day.day === selected);
      if (!entry) {
        detail.innerHTML = '';
        return;
      }
      const posts = mineOnly ? entry.posts.filter((post) => post.mine) : entry.posts;
      const body = entry.locked
        ? `<p class="note">Light today's lamp to open this day.</p>`
        : posts.length
          ? `<div class="thumbs">${posts.map(thumb).join('')}</div>`
          : `<p class="note">${mineOnly ? 'No lamp from you on this day.' : 'No lamps on this day.'}</p>`;
      detail.innerHTML = `
        <div class="day-head">
          <h3>Day ${entry.day} · ${esc(entry.prompt?.title ?? '')}</h3>
          <span class="muted">${entry.locked ? '🔒' : `${posts.length} 🪔`}</span>
        </div>
        <p class="muted small">${esc(entry.prompt?.text ?? '')}</p>
        ${body}`;
    }

    function paint(): void {
      grid.innerHTML = days.map((entry) => cell(entry, archive.today, selected, mineOnly)).join('');
      paintDetail();
    }

    grid.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-day]');
      if (!button || button.disabled) return;
      selected = Number(button.dataset.day);
      paint();
    });

    view.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((button) => {
      button.addEventListener('click', () => {
        mineOnly = button.dataset.scope === 'mine';
        view.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((other) => {
          other.setAttribute('aria-pressed', String((other.dataset.scope === 'mine') === mineOnly));
        });
        paint();
      });
    });

    paint();
    mountInto(host, view);
    return host;
  } catch (error) {
    mountInto(host, errorScreen((error as Error).message, () => go('/calendar', { reload: true })));
    return host;
  }
}
