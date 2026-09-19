import { el, esc } from '../dom.js';
import { fetchArchive, type ArchiveDay, type Post } from '../api.js';
import { errorScreen, loadingScreen } from '../ui.js';
import { go, mountInto } from '../router.js';

function thumb(post: Post): string {
  if (post.photoUrl) {
    return `<img loading="lazy" decoding="async" alt="${esc(post.author ?? 'A drop')}" src="${esc(post.photoUrl)}">`;
  }
  return `<div class="thumb-text">${esc(post.body.slice(0, 120))}</div>`;
}

/** One square in the month grid. A lit day shows a photo behind the number. */
function cell(entry: ArchiveDay, today: number, selected: number): string {
  const cover = entry.posts.find((post) => post.photoUrl)?.photoUrl;
  const lit = entry.posts.length > 0 && !entry.locked;
  const classes = ['cell', lit ? 'lit' : '', entry.day === today ? 'today' : '', entry.day > today ? 'empty' : '']
    .filter(Boolean)
    .join(' ');

  return `
    <button class="${classes}" data-day="${entry.day}" aria-pressed="${entry.day === selected}"
            aria-label="Day ${entry.day}" ${entry.day > today ? 'disabled' : ''}>
      ${cover ? `<img loading="lazy" decoding="async" alt="" src="${esc(cover)}">` : ''}
      <span class="n">${entry.day}</span>
    </button>`;
}

export async function calendarScreen(): Promise<HTMLElement> {
  const host = el('<section></section>');
  mountInto(host, loadingScreen('Gathering the river…'));

  try {
    const archive = await fetchArchive();

    // The whole month is gated on today: the river opens once you have added to it.
    const todayEntry = archive.days.find((entry) => entry.day === archive.today);
    if (todayEntry?.locked) {
      mountInto(
        host,
        el(`
          <div class="locked card">
            <div class="lamp lamp-unlit"></div>
            <h2>The river is still</h2>
            <p class="muted">Add your drop for today and the whole month opens — every day the group has gathered so far.</p>
            <a class="btn" href="#/capture">Add your drop to the river</a>
            <a class="btn btn-quiet" href="#/feed">Back to today</a>
          </div>
        `),
      );
      return host;
    }

    // The API only returns days that have happened. The grid is the whole month,
    // so pad the future out with empty squares — the shape of what is still to come.
    const known = new Map(archive.days.map((entry) => [entry.day, entry]));
    const days: ArchiveDay[] = Array.from({ length: archive.totalDays }, (_, index) => {
      const day = index + 1;
      return known.get(day) ?? { day, dateKey: '', prompt: null, count: 0, locked: false, posts: [] };
    });

    let selected = archive.today;

    const view = el(`
      <div>
        <span class="eyebrow">The river</span>
        <h1>${archive.today} of ${archive.totalDays} mornings</h1>
        <div class="calendar" data-grid></div>
        <div data-detail></div>
        <a class="btn btn-quiet" href="#/feed">Back to today</a>
      </div>
    `);

    const grid = view.querySelector('[data-grid]') as HTMLElement;
    const detail = view.querySelector('[data-detail]') as HTMLElement;

    function paint(): void {
      grid.innerHTML = days.map((entry) => cell(entry, archive.today, selected)).join('');
      const entry = days.find((day) => day.day === selected);
      if (!entry) {
        detail.innerHTML = '';
        return;
      }
      detail.innerHTML = `
        <div class="day-head">
          <h3>Day ${entry.day} · ${esc(entry.prompt?.title ?? '')}</h3>
          <span class="muted">${entry.posts.length} 🪔</span>
        </div>
        <p class="muted small">${esc(entry.prompt?.text ?? '')}</p>
        ${
          entry.posts.length
            ? `<div class="thumbs">${entry.posts.map(thumb).join('')}</div>`
            : `<p class="note">No drops on this day.</p>`
        }`;
    }

    grid.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-day]');
      if (!button || button.disabled) return;
      selected = Number(button.dataset.day);
      paint();
    });

    paint();
    mountInto(host, view);
    return host;
  } catch (error) {
    mountInto(host, errorScreen((error as Error).message, () => go('/calendar', { reload: true })));
    return host;
  }
}
