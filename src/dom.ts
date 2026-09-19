/** Turns a template string into a live element. Keeps screens readable. */
export function el<T extends HTMLElement = HTMLElement>(markup: string): T {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const node = template.content.firstElementChild;
  if (!node) throw new Error('el() received empty markup');
  return node as T;
}

/** Every post is user-authored — escape before it touches innerHTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

export function delegate(
  root: ParentNode,
  selector: string,
  type: string,
  handler: (element: HTMLElement, event: Event) => void,
): void {
  (root as HTMLElement).addEventListener(type, (event) => {
    const match = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (match && (root as HTMLElement).contains(match)) handler(match, event);
  });
}
