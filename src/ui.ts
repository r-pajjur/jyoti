import { el, esc } from './dom.js';

export function section(markup: string): HTMLElement {
  return el(`<section>${markup}</section>`);
}

export function loadingScreen(message = 'One moment…'): HTMLElement {
  return el(`<section class="boot"><div class="boot-lamp"></div><p>${esc(message)}</p></section>`);
}

export function errorScreen(message: string, onRetry?: () => void): HTMLElement {
  const node = el(`
    <section>
      <div class="card">
        <h2>That didn't go through</h2>
        <p class="muted">${esc(message)}</p>
        ${onRetry ? '<button class="btn btn-ghost" data-retry>Try again</button>' : ''}
      </div>
    </section>
  `);
  if (onRetry) node.querySelector('[data-retry]')?.addEventListener('click', onRetry);
  return node;
}

export function dayLabel(day: number, total: number): string {
  return `Day ${day} of ${total}`;
}

/** Warm relative time — "this morning", not "7h ago". */
export function softTime(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const hour = then.getHours();
  const today = new Date().toDateString() === then.toDateString();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  return today ? `this ${part}` : then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
