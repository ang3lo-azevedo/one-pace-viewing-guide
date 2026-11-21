import { For, Show, createSignal } from 'solid-js';
import { prefs, resetFilters, setPrefs, toggleExtra } from '../store/prefs';
import { EXTRA_LABELS, guide, tiers, type ExtraCategory } from '../lib/guide';
import { hasActiveFilters, visibleEpisodeCount } from '../lib/filter';

function Toggle(props: { active: boolean; onClick: () => void; children: any; title?: string }) {
  return (
    <button
      class="chip border text-xs font-semibold transition-colors"
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

const EXTRAS = Object.keys(EXTRA_LABELS) as ExtraCategory[];

export default function FilterBar() {
  const [showMore, setShowMore] = createSignal(false);
  const anyFilter = () => hasActiveFilters() || prefs.hiddenExtras.length > 0;

  return (
    <div class="sticky top-0 z-20 border-b border-sea-200 bg-sea-50/95 backdrop-blur dark:border-sea-800 dark:bg-sea-950/95">
      <div class="mx-auto max-w-5xl px-3 py-2.5 sm:px-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[11rem] flex-1">
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sea-400">⌕</span>
            <input
              type="search"
              placeholder="Search titles, anime #, chapters…"
              class="w-full rounded-lg border border-sea-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent-400 dark:border-sea-700 dark:bg-sea-900"
              value={prefs.search}
              onInput={(e) => setPrefs('search', e.currentTarget.value)}
            />
          </div>

          <Toggle
            active={prefs.canonOnly}
            onClick={() => setPrefs('canonOnly', !prefs.canonOnly)}
            title="Show only the main One Pace route: hides movies, specials, Live Action, filler, original anime and alternatives"
          >
            {prefs.canonOnly ? '● Extras hidden' : '○ Hide extras'}
          </Toggle>

          <Toggle
            active={prefs.hideNonCanon}
            onClick={() => setPrefs('hideNonCanon', !prefs.hideNonCanon)}
            title="Hide what is not story canon (films, filler, most specials). Canon extras like the Live Action and Monsters stay."
          >
            {prefs.hideNonCanon ? '● Non-canon hidden' : '○ Hide non-canon'}
          </Toggle>

          <Toggle active={prefs.spoilerSafe} onClick={() => setPrefs('spoilerSafe', !prefs.spoilerSafe)} title="Hide episode subtitles; reveal on hover">
            🛡 Spoiler-safe
          </Toggle>

          <div
            class="inline-flex items-center gap-1 rounded-full border border-sea-300 p-0.5 dark:border-sea-600"
            role="radiogroup"
            aria-label="Default stream"
            title="Where the red ▶ watch button on each episode opens"
          >
            <span class="pl-2 pr-0.5 text-[11px] font-semibold text-sea-400">Watch on</span>
            <For each={[['onepace', 'One Pace'], ['stremio', 'Stremio']] as const}>
              {([value, label]) => (
                <button
                  role="radio"
                  aria-checked={prefs.streamSource === value}
                  class="rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors"
                  classList={{
                    'bg-strawhat-500 text-white shadow-sm': prefs.streamSource === value,
                    'text-sea-400 hover:text-sea-700 dark:hover:text-sea-100': prefs.streamSource !== value,
                  }}
                  onClick={() => setPrefs('streamSource', value)}
                >
                  {label}
                </button>
              )}
            </For>
          </div>

          <button
            class="chip text-xs font-semibold hover:border-sea-400"
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
              <span class="text-xs font-semibold uppercase tracking-wide text-sea-400" title="It shows characters and reveals earlier than the anime">
                Live Action
              </span>
              <For
                each={[
                  ['arc', 'Next to each arc'],
                  ['post-enies-lobby-arc', 'All after Post-Enies Lobby'],
                  ['thriller-bark-arc', 'All after Thriller Bark'],
                ] as const}
              >
                {([value, label]) => (
                  <Toggle
                    active={prefs.liveActionPlacement === value}
                    onClick={() => setPrefs('liveActionPlacement', value)}
                    title={
                      value === 'arc'
                        ? 'Watch each episode where the guide places it (some reveal things early)'
                        : value === 'thriller-bark-arc'
                          ? 'Safest: the second season covers Laboon, which ties into a character met in Thriller Bark'
                          : 'Watch it all once the earlier reveals are covered'
                    }
                  >
                    {label}
                  </Toggle>
                )}
              </For>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-sea-400">Final Saga</span>
              <Toggle active={!prefs.splitFinalSaga} onClick={() => setPrefs('splitFinalSaga', false)}>
                One saga
              </Toggle>
              <Toggle active={prefs.splitFinalSaga} onClick={() => setPrefs('splitFinalSaga', true)} title="List Egghead and Elbaph like the other sagas">
                Egghead and Elbaph separate
              </Toggle>
              <span class="ml-2 text-xs font-semibold uppercase tracking-wide text-sea-400">Catch up</span>
              <Toggle
                active={prefs.catchUpExtras}
                onClick={() => setPrefs('catchUpExtras', !prefs.catchUpExtras)}
                title="Whether Catch up also marks the films, specials, Live Action and filler before that point"
              >
                {prefs.catchUpExtras ? 'Includes extras' : 'Main route only'}
              </Toggle>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-sea-400">Show</span>
              <For each={EXTRAS}>
                {(cat) => (
                  <Toggle
                    active={!prefs.canonOnly && !prefs.hiddenExtras.includes(cat)}
                    onClick={() => {
                      if (prefs.canonOnly) setPrefs('canonOnly', false);
                      toggleExtra(cat);
                    }}
                    title={`Show or hide ${EXTRA_LABELS[cat]} (also changes the completion percentages)`}
                  >
                    {EXTRA_LABELS[cat]}
                  </Toggle>
                )}
              </For>
            </div>

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
    </div>
  );
}
