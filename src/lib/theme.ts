export type Theme = 'dark' | 'light';
const KEY = 'fitos.theme';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: Theme = getTheme()) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#f6f8fa' : '#0b0f14');
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* per-device preference only */
  }
  applyTheme(t);
}
