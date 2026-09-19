export type Route = () => HTMLElement | Promise<HTMLElement>;

interface RouterConfig {
  routes: Record<string, Route>;
  fallback: string;
  /** Returns a path to redirect to, or null to allow the requested one. */
  guard?: (path: string) => string | null;
  /** Paths that hide the bottom tab bar. */
  chromeless?: string[];
}

let config: RouterConfig;
let renderToken = 0;

export function mountInto(host: HTMLElement, node: Node): void {
  host.replaceChildren(node);
}

export function currentPath(): string {
  const raw = location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

export function go(path: string, options: { reload?: boolean } = {}): void {
  const target = `#${path}`;
  if (location.hash === target) {
    if (options.reload) void render();
    return;
  }
  location.hash = target;
}

function updateChrome(path: string): void {
  const tabbar = document.getElementById('tabbar');
  if (!tabbar) return;
  const hidden = config.chromeless?.includes(path) ?? false;
  tabbar.hidden = hidden;
  document.body.classList.toggle('no-tabs', hidden);
  tabbar.querySelectorAll<HTMLAnchorElement>('a[data-tab]').forEach((link) => {
    const active = link.getAttribute('href') === `#${path}`;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

async function render(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const requested = currentPath();
  const redirect = config.guard?.(requested);
  if (redirect && redirect !== requested) {
    go(redirect);
    return;
  }

  const route = config.routes[requested] ?? config.routes[config.fallback];
  if (!route) return;

  updateChrome(requested);
  const token = ++renderToken;
  const node = await route();
  if (token !== renderToken) return; // a newer navigation won
  mountInto(app, node);
  window.scrollTo(0, 0);
}

export function startRouter(next: RouterConfig): void {
  config = next;
  window.addEventListener('hashchange', () => void render());
  void render();
}
