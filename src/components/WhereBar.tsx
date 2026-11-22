import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';

interface Crumb {
  el: HTMLElement;
  title: string;
}

/**
 * Shown under the filter bar while you scroll inside an open saga / arc / section: where you
 * are, with the innermost open one last. Click a name to jump back to it; ▲ closes the
 * innermost one. Replaces sticky headers, which overlapped each other on phones.
 */
export default function WhereBar(props: { below: () => HTMLElement | undefined }) {
  const [crumbs, setCrumbs] = createSignal<Crumb[]>([]);
  let frame = 0;

  const update = () => {
    frame = 0;
    const bar = props.below();
    if (!bar) return;
    // The line just under the filter bar (without this strip, so it doesn't flicker).
    const line = bar.getBoundingClientRect().bottom + 4;
    const out: Crumb[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-open-key]')) {
      const r = el.getBoundingClientRect();
      // Its header has scrolled under the bar, and it still fills the space below the bar.
      const head = el.querySelector<HTMLElement>('[data-toggle]');
      const headBottom = head ? head.getBoundingClientRect().bottom : r.top;
      if (headBottom < line && r.bottom > line + 40) out.push({ el, title: el.dataset.openTitle ?? '' });
    }
    const prev = crumbs();
    if (out.length !== prev.length || out.some((c, i) => c.el !== prev[i].el)) setCrumbs(out);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  onMount(() => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Opening/closing changes the layout without scrolling.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-open-key'] });
    schedule();
    onCleanup(() => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      mo.disconnect();
      cancelAnimationFrame(frame);
    });
  });

  const jump = (el: HTMLElement) => el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const closeLast = () => {
    const last = crumbs()[crumbs().length - 1];
    if (!last) return;
    jump(last.el);
    last.el.querySelector<HTMLElement>('[data-toggle]')?.click();
  };

  return (
    <Show when={crumbs().length}>
      <div class="border-t border-sea-200 dark:border-sea-800">
        <div class="mx-auto flex max-w-5xl items-center gap-1.5 px-3 py-1.5 text-xs sm:px-4">
          <div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap">
            <For each={crumbs()}>
              {(c, i) => (
                <>
                  <Show when={i() > 0}>
                    <span class="shrink-0 text-sea-400" aria-hidden="true">
                      ›
                    </span>
                  </Show>
                  <button
                    class="truncate font-semibold hover:underline"
                    classList={{
                      'min-w-0 text-sea-800 dark:text-sea-50': i() === crumbs().length - 1,
                      'max-w-[30%] shrink text-sea-500 dark:text-sea-400': i() < crumbs().length - 1,
                    }}
                    title={`Go to ${c.title}`}
                    onClick={() => jump(c.el)}
                  >
                    {c.title}
                  </button>
                </>
              )}
            </For>
          </div>
          <button
            class="chip shrink-0 border-sea-300 py-0.5 text-[11px] text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300"
            onClick={closeLast}
            title={`Close ${crumbs()[crumbs().length - 1]?.title ?? ''}`}
          >
            ▲ Close
          </button>
        </div>
      </div>
    </Show>
  );
}
