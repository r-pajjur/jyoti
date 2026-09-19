import { delegate, el, esc } from '../dom.js';
import { ApiError, bless, fetchFeed, type Post } from '../api.js';
import { isBlessed, markBlessed, markPosted } from '../state.js';
import { errorScreen, loadingScreen, softTime } from '../ui.js';
import { go, mountInto } from '../router.js';

function postCard(post: Post): string {
  const blessed = isBlessed(post.id);
  return `
    <article class="post ${post.mine ? 'post-mine' : ''}">
      ${post.photoUrl ? `<img loading="lazy" decoding="async" alt="A drop from ${esc(post.author ?? 'the group')}" src="${esc(post.photoUrl)}">` : ''}
      <div class="post-body">
        <p class="post-author">${esc(post.author ?? 'Someone')}${post.mine ? ' · you' : ''}</p>
        ${post.body ? `<p class="post-text">${esc(post.body)}</p>` : ''}
        <div class="post-foot">
          <span class="small muted">${esc(softTime(post.createdAt))}</span>
          ${
            post.mine
              ? ''
              : `<button class="bless" data-bless="${esc(post.id)}" data-blessed="${blessed}"
                         aria-label="Bless this" ${blessed ? 'disabled' : ''}>${blessed ? '♥' : '♡'}</button>`
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

    // Before you post: no prompt, no posts — only how many have gone before you.
    if (feed.locked) {
      const dots = Array.from(
        { length: Math.max(feed.groupSize, feed.count) },
        (_, index) => `<span class="dot ${index < feed.count ? 'dot-lit' : ''}"></span>`,
      ).join('');
      mountInto(
        host,
        el(`
          <div class="locked card">
            <div class="drop drop-unlit"></div>
            <span class="eyebrow">Day ${feed.day}</span>
            <p class="count">${feed.count}/${feed.groupSize}</p>
            <h2>drops in the river today</h2>
            <div class="dots">${dots}</div>
            <p class="muted">Sometime today is perfect — there is no hurry.</p>
            <a class="btn" href="#/capture">Add your drop to the river</a>
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
        <h1>${feed.count}/${feed.groupSize} drops today</h1>
        <p class="muted">${esc(feed.prompt?.text ?? '')}</p>
        <div class="grid ${withPhotos === 0 ? 'grid-1' : ''}" data-grid>
          ${feed.posts.map(postCard).join('')}
        </div>
        <a class="btn btn-quiet" href="#/calendar">See the whole river</a>
      </div>
    `);

    delegate(view, '[data-bless]', 'click', async (button) => {
      const postId = button.dataset.bless;
      if (!postId) return;
      (button as HTMLButtonElement).disabled = true;
      button.textContent = '♥';
      try {
        await bless(postId);
        markBlessed(postId);
        button.dataset.blessed = 'true';
      } catch {
        (button as HTMLButtonElement).disabled = false;
        button.textContent = '♡';
      }
    });

    mountInto(host, view);
    return host;
  } catch (error) {
    mountInto(host, errorScreen((error as Error).message, () => go('/feed', { reload: true }), (error as ApiError).detail));
    return host;
  }
}
