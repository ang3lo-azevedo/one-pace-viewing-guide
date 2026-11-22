import { For, Show, createSignal } from 'solid-js';
import { prefs, resetFilters, setPrefs } from '../store/prefs';
import { guide, tiers } from '../lib/guide';
import { hasActiveFilters, visibleEpisodeCount } from '../lib/filter';
import WhereBar from './WhereBar';

function Toggle(props: { active: boolean; onClick: () => void; children: any; title?: string }) {
  return (
    <button
      class="chip shrink-0 whitespace-nowrap border text-xs font-semibold transition-colors"
      classList={{
        'border-strawhat-500 bg-strawhat-500/15 text-strawhat-500': props.active,
        'border-sea-300 text-sea-500 hover:border-sea-400 dark:border-sea-600 dark:text-sea-300': !props.active,
      }}
      onClick={props.onClick}
      title={props.title}
      aria-pressed={props.active}
    >
      {props.children}
    </button>
  );
}


export default function FilterBar() {
  const [showMore, setShowMore] = createSignal(false);
  let bar: HTMLDivElement | undefined;
  const anyFilter = () => hasActiveFilters();

  return (
    <div class="filter-bar sticky top-0 z-20 border-b border-sea-200 bg-white shadow-[0_1px_6px_rgba(16,42,60,0.06)] dark:border-sea-800 dark:bg-sea-950 dark:shadow-none">
      <div ref={bar} class="mx-auto max-w-5xl px-3 py-2.5 sm:px-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-0 flex-1 sm:min-w-[11rem]">
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sea-400">⌕</span>
            <input
              type="search"
              placeholder="Search titles, anime #, chapters…"
              class="w-full rounded-lg border border-sea-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent-400 dark:border-sea-700 dark:bg-sea-900"
              value={prefs.search}
              onInput={(e) => setPrefs('search', e.currentTarget.value)}
            />
          </div>

          <button
            class="chip shrink-0 text-xs font-semibold hover:border-sea-400"
            classList={{
              'border-accent-400 text-accent-500 dark:text-accent-300': anyFilter() && !showMore(),
              'border-sea-300 text-sea-500 dark:border-sea-600 dark:text-sea-300': !(anyFilter() && !showMore()),
            }}
            onClick={() => setShowMore(!showMore())}
            aria-expanded={showMore()}
          >
            ⚙ Filters{anyFilter() ? ' •' : ''}
          </button>

        </div>

        <Show when={showMore()}>
          <div class="mt-2.5 space-y-2.5 border-t border-sea-200 pt-2.5 dark:border-sea-800">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-sea-400">Tier</span>
              <Toggle active={prefs.tierMin == null} onClick={() => setPrefs('tierMin', null)}>
                All
              </Toggle>
              <For each={tiers}>
                {(t) => (
                  <button
                    class="chip border text-xs font-semibold"
                    classList={{ 'ring-2 ring-offset-1 ring-offset-transparent': prefs.tierMin === t.min }}
                    style={{ 'background-color': t.color + '22', color: t.color, 'border-color': t.color + '66' }}
                    onClick={() => setPrefs('tierMin', prefs.tierMin === t.min ? null : t.min)}
                    title={`${t.label} (★ ${t.min}+)`}
                  >
                    ★ {t.min}+
                  </button>
                )}
              </For>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-sea-400">Saga</span>
              <select
                class="rounded-lg border border-sea-300 bg-white py-1 px-2 text-xs dark:border-sea-700 dark:bg-sea-900"
                value={prefs.sagaId ?? ''}
                onChange={(e) => setPrefs('sagaId', e.currentTarget.value || null)}
              >
                <option value="">All sagas</option>
                <For each={guide.sagas}>{(s) => <option value={s.id}>{s.title}</option>}</For>
              </select>

              <Toggle active={prefs.hideWatched} onClick={() => setPrefs('hideWatched', !prefs.hideWatched)}>
                Hide watched
              </Toggle>

              <Show when={anyFilter()}>
                <button class="chip border-strawhat-500/50 text-xs font-semibold text-strawhat-500" onClick={resetFilters}>
                  ✕ Clear filters
                </button>
              </Show>
              <span class="text-xs text-sea-400">{visibleEpisodeCount()} shown</span>
            </div>
          </div>
        </Show>
      </div>
      <WhereBar below={() => bar} />
    </div>
  );
}
