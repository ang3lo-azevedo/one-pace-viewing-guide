import { For, Show, createSignal } from 'solid-js';
import { prefs, resetFilters, setPrefs } from '../store/prefs';
import { clearAll, exportJSON, importJSON } from '../store/progress';
import { guide, tiers } from '../lib/guide';
import { hasActiveFilters, visibleEpisodeCount } from '../lib/filter';

function Toggle(props: { active: boolean; onClick: () => void; children: any; title?: string }) {
  return (
    <button
      class="chip border text-xs font-semibold transition-colors"
      classList={{
        'border-strawhat-500 bg-strawhat-500/15 text-strawhat-600 dark:text-strawhat-500': props.active,
        'border-slate-300 text-slate-500 hover:border-slate-400 dark:border-sea-600 dark:text-slate-400':
          !props.active,
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
  let fileInput: HTMLInputElement | undefined;

  function doExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `one-pace-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const merge = confirm('Merge with your current progress? Click Cancel to REPLACE instead.');
      const n = importJSON(text, merge);
      alert(`Imported ${n} watched episodes.`);
    } catch (err) {
      alert('Could not import that file: ' + (err as Error).message);
    } finally {
      input.value = '';
    }
  }

  return (
    <div class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 backdrop-blur dark:border-sea-800 dark:bg-sea-950/95">
      <div class="mx-auto max-w-5xl px-3 py-2.5 sm:px-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[11rem] flex-1">
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search titles, anime #, chapters…"
              class="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-strawhat-500 dark:border-sea-600 dark:bg-sea-900"
              value={prefs.search}
              onInput={(e) => setPrefs('search', e.currentTarget.value)}
            />
          </div>

          <Toggle active={prefs.canonOnly} onClick={() => setPrefs('canonOnly', !prefs.canonOnly)} title="Show only the canon One Pace route">
            {prefs.canonOnly ? '● Canon Only' : '○ Canon Only'}
          </Toggle>

          <div class="chip gap-0 overflow-hidden border-slate-300 p-0 dark:border-sea-600">
            <button
              class="px-2.5 py-1 text-xs font-semibold"
              classList={{ 'bg-strawhat-500/15 text-strawhat-600 dark:text-strawhat-500': prefs.streamSource === 'onepace' }}
              onClick={() => setPrefs('streamSource', 'onepace')}
            >
              One Pace
            </button>
            <button
              class="px-2.5 py-1 text-xs font-semibold"
              classList={{ 'bg-strawhat-500/15 text-strawhat-600 dark:text-strawhat-500': prefs.streamSource === 'stremio' }}
              onClick={() => setPrefs('streamSource', 'stremio')}
            >
              Stremio
            </button>
          </div>

          <button
            class="chip border-slate-300 text-xs font-semibold text-slate-500 hover:border-slate-400 dark:border-sea-600 dark:text-slate-400"
            onClick={() => setShowMore(!showMore())}
            aria-expanded={showMore()}
          >
            ⚙ Filters
          </button>
        </div>

        <Show when={showMore()}>
          <div class="mt-2.5 space-y-2.5 border-t border-slate-200 pt-2.5 dark:border-sea-800">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Tier</span>
              <Toggle active={prefs.tierMin == null} onClick={() => setPrefs('tierMin', null)}>
                All
              </Toggle>
              <For each={tiers}>
                {(t) => (
                  <button
                    class="chip border text-xs font-semibold"
                    classList={{ 'ring-2 ring-offset-1 ring-offset-transparent': prefs.tierMin === t.min }}
                    style={{
                      'background-color': t.color + '22',
                      color: t.color,
                      'border-color': t.color + '66',
                    }}
                    onClick={() => setPrefs('tierMin', prefs.tierMin === t.min ? null : t.min)}
                    title={`${t.label} (★ ${t.min}+)`}
                  >
                    ★ {t.min}+
                  </button>
                )}
              </For>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Saga</span>
              <select
                class="rounded-lg border border-slate-300 bg-white py-1 px-2 text-xs dark:border-sea-600 dark:bg-sea-900"
                value={prefs.sagaId ?? ''}
                onChange={(e) => setPrefs('sagaId', e.currentTarget.value || null)}
              >
                <option value="">All sagas</option>
                <For each={guide.sagas}>{(s) => <option value={s.id}>{s.title}</option>}</For>
              </select>

              <Toggle active={prefs.hideWatched} onClick={() => setPrefs('hideWatched', !prefs.hideWatched)}>
                Hide watched
              </Toggle>

              <Show when={hasActiveFilters()}>
                <button
                  class="chip border-strawhat-500/50 text-xs font-semibold text-strawhat-600 dark:text-strawhat-500"
                  onClick={resetFilters}
                >
                  ✕ Clear filters
                </button>
              </Show>
              <span class="text-xs text-slate-400">{visibleEpisodeCount()} shown</span>
            </div>

            <div class="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5 dark:border-sea-800">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</span>
              <button class="chip border-slate-300 text-xs font-semibold dark:border-sea-600" onClick={doExport}>
                ⭳ Export
              </button>
              <button class="chip border-slate-300 text-xs font-semibold dark:border-sea-600" onClick={() => fileInput?.click()}>
                ⭱ Import
              </button>
              <button
                class="chip border-red-400/50 text-xs font-semibold text-red-600 dark:text-red-400"
                onClick={() => {
                  if (confirm('Reset ALL watched progress? This cannot be undone.')) clearAll();
                }}
              >
                ⟲ Reset progress
              </button>
              <input ref={fileInput} type="file" accept="application/json,.json" class="hidden" onChange={onFile} />
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
