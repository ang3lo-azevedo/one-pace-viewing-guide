/**
 * Keep your place across the reload that a version change needs (Fish-Man Island, filler):
 * which sagas, arcs and sections were open, and the scroll position.
 */
const KEY = 'op-restore';

interface Saved {
  open: string[];
  y: number;
}

const saved: Saved | null = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
})();

let openKeys: Set<string> | null = saved ? new Set(saved.open) : null;

/**
 * During the first render after a version reload: whether this saga/arc/section was open
 * (true/false). Null otherwise, so the normal defaults apply.
 */
export function wasOpen(key: string): boolean | null {
  return openKeys ? openKeys.has(key) : null;
}

/** Save what is open (elements marked data-open-key) and the scroll position. */
export function saveView() {
  const open = [...document.querySelectorAll<HTMLElement>('[data-open-key]')].map((el) => el.dataset.openKey!);
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ open, y: window.scrollY }));
  } catch {
    /* ignore */
  }
}

/** After the first render: go back to where you were. Returns false on a normal load. */
export function restoreScroll(): boolean {
  openKeys = null; // later renders use the normal defaults again
  if (!saved) return false;
  window.scrollTo({ top: saved.y, behavior: 'instant' as ScrollBehavior });
  return true;
}
