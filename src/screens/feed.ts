import { delegate, el, esc } from '../dom.js';
import { bless, fetchFeed, type Post } from '../api.js';
import { isBlessed, markBlessed, markPosted } from '../state.js';
import { errorScreen, loadingScreen, softTime } from '../ui.js';
import { go, mountInto } from '../router.js';

function postCard(post: Post): string {
  const blessed = isBlessed(post.id);
  return `
    <article class="post ${post.mine ? 'post-mine' : ''}">
      ${post.photoUrl ? `<img loading="lazy" decoding="async" alt="A lamp from ${esc(post.author ?? 'the group')}" src="${esc(post.photoUrl)}">` : ''}
      <div class="post-body">
        <p class="post-author">${esc(post.author ?? 'Someone')}${post.mine ? ' · you' : ''}</p>
        ${post.body ? `<p class="post-text">${esc(post.body)}</p>` : ''}
        <div class="post-foot">
          <span class="small muted">${esc(softTime(post.createdAt))}</span>
          ${
            post.mine
              ? ''
              : `<button class="bless" data-bless="${esc(post.id)}" data-blessed="${blessed}" ${blessed ? 'disabled' : ''}>
                   ${blessed ? '🪔 blessed' : '🪔 bless'}
                 </button>`
          }
        </div>
      </div>
    </article>`;
}

export async function feedScreen(): Promise<HTMLElement> {
  const host = el('<section></section>');
  mountInto(host, loadingScreen('Opening today…'));

  try {
    const feed = await fetchFeed();

    if (feed.locked) {
      const dots = Array.from({ length: Math.min(feed.count, 30) }, () => '<span class="dot"></span>').join('');
      mountInto(
        host,
        el(`
          <div>
            <div class="center">
              <span class="eyebrow">Day ${feed.day}</span>
            </div>
            <div class="prompt">${esc(feed.prompt?.text ?? '')}</div>
            <div class="locked card">
              <div class="lamp lamp-unlit"></div>
              <p class="count">${feed.count}</p>
              <h2>${feed.count === 1 ? 'lamp is lit' : 'lamps are lit'} today</h2>
              <div class="dots">${dots}</div>
              <p class="muted">You'll see them all the moment you light yours. Sometime today is perfect — there is no hurry.</p>
              <a class="btn" href="#/capture">Light my lamp</a>
            </div>
          </div>
        `),
      );
      return host;
    }

    markPosted(feed.day);
    const withPhotos = feed.posts.filter((post) => post.photoUrl).length;
    const view = el(`
      <div>
        <span class="eyebrow">Day ${feed.day}</span>
        <h1>${feed.count} ${feed.count === 1 ? 'lamp' : 'lamps'} today</h1>
        <p class="muted">${esc(feed.prompt?.text ?? '')}</p>
        <div class="grid ${withPhotos === 0 ? 'grid-1' : ''}" data-grid>
          ${feed.posts.map(postCard).join('')}
        </div>
        <a class="btn btn-quiet" href="#/calendar">See the whole month</a>
      </div>
    `);

    delegate(view, '[data-bless]', 'click', async (button) => {
      const postId = button.dataset.bless;
      if (!postId) return;
      const original = button.textContent;
      (button as HTMLButtonElement).disabled = true;
      button.textContent = '🪔 …';
      try {
        await bless(postId);
        markBlessed(postId);
        button.dataset.blessed = 'true';
        button.textContent = '🪔 blessed';
      } catch {
        (button as HTMLButtonElement).disabled = false;
        button.textContent = original;
      }
    });

    mountInto(host, view);
    return host;
  } catch (error) {
    mountInto(host, errorScreen((error as Error).message, () => go('/feed', { reload: true })));
    return host;
  }
}
