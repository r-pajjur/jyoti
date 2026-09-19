import { el, esc, qs } from '../dom.js';
import { ApiError, fetchToday, submitPost } from '../api.js';
import { preparePhoto, type PreparedPhoto } from '../photo.js';
import { markPosted } from '../state.js';
import { errorScreen, loadingScreen } from '../ui.js';
import { go, mountInto } from '../router.js';

const MAX_TEXT = 600;

export async function captureScreen(): Promise<HTMLElement> {
  const host = el('<section></section>');
  mountInto(host, loadingScreen());

  let today;
  try {
    today = await fetchToday();
  } catch (error) {
    mountInto(host, errorScreen((error as Error).message, () => go('/capture', { reload: true }), (error as ApiError).detail));
    return host;
  }
  if (!today.active) {
    go('/feed');
    return host;
  }

  const prompt = today.prompt;
  const wantsPhoto = prompt?.type === 'photo';
  let photo: PreparedPhoto | null = null;

  const view = el(`
    <div>
      <button class="btn btn-quiet" data-back style="justify-content:flex-start">← Not now</button>
      <span class="eyebrow">Day ${today.day}</span>
      <p class="prompt">${esc(prompt?.text ?? '')}</p>
      <hr class="rule">
      <div data-preview></div>
      <button class="btn btn-ghost" data-pick>${wantsPhoto ? '📷  Add your photo' : '📷  Add a photo (optional)'}</button>
      <input type="file" accept="image/*" hidden data-file>
      <div class="field" style="margin-top:18px">
        <label for="reflection">${wantsPhoto ? 'A line or two, if you like' : 'Your reflection'}</label>
        <textarea id="reflection" maxlength="${MAX_TEXT}" enterkeyhint="done"
                  placeholder="${wantsPhoto ? 'Where this was, what it held…' : 'However it comes out. Nobody is marking this.'}"></textarea>
        <div class="counter" data-counter>0 / ${MAX_TEXT}</div>
      </div>
      <button class="btn" data-post disabled>Add your drop to the river</button>
      <p class="small muted center" data-status></p>
    </div>
  `);

  const file = qs<HTMLInputElement>(view, '[data-file]');
  const text = qs<HTMLTextAreaElement>(view, '#reflection');
  const counter = qs(view, '[data-counter]');
  const previewHost = qs(view, '[data-preview]');
  const postButton = qs<HTMLButtonElement>(view, '[data-post]');
  const status = qs(view, '[data-status]');

  function validate(): void {
    postButton.disabled = !photo && text.value.trim().length === 0;
  }

  function renderPreview(): void {
    if (!photo) {
      previewHost.replaceChildren();
      return;
    }
    const preview = el(`
      <div class="preview">
        <img alt="The photo you are about to post" src="${photo.dataUrl}">
        <button type="button" data-clear>Replace</button>
      </div>
    `);
    preview.querySelector('[data-clear]')?.addEventListener('click', () => {
      photo = null;
      file.value = '';
      renderPreview();
      validate();
    });
    previewHost.replaceChildren(preview);
  }

  view.querySelector('[data-back]')?.addEventListener('click', () => go('/feed'));
  view.querySelector('[data-pick]')?.addEventListener('click', () => file.click());

  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    status.textContent = 'Preparing your photo…';
    try {
      photo = await preparePhoto(selected);
      status.textContent = '';
      renderPreview();
    } catch (error) {
      photo = null;
      status.textContent = (error as Error).message;
    }
    validate();
  });

  text.addEventListener('input', () => {
    counter.textContent = `${text.value.length} / ${MAX_TEXT}`;
    validate();
  });

  postButton.addEventListener('click', async () => {
    postButton.disabled = true;
    postButton.textContent = 'Adding…';
    status.textContent = photo ? 'Sending your photo — this can take a moment on mobile data.' : '';
    try {
      await submitPost({
        day: today.day,
        text: text.value.trim(),
        ...(photo ? { photo: photo.dataUrl, photoType: photo.contentType } : {}),
      });
      markPosted(today.day);
      go('/feed', { reload: true });
    } catch (error) {
      status.textContent = (error as Error).message;
      postButton.disabled = false;
      postButton.textContent = 'Add your drop to the river';
    }
  });

  mountInto(host, view);
  return host;
}
