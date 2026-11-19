import { For, Show } from 'solid-js';
import { guide } from './lib/guide';
import { visibleSagas } from './lib/filter';
import { prefs, toggleTheme } from './store/prefs';
import VoyageHero from './components/VoyageHero';
import FilterBar from './components/FilterBar';
import SagaSection from './components/SagaSection';

export default function App() {
  return (
    <div class="min-h-screen">
      {/* Header */}
      <header class="border-b border-slate-200 bg-gradient-to-b from-sea-900 to-sea-800 text-slate-100 dark:border-sea-800">
        <div class="mx-auto flex max-w-5xl items-center gap-3 px-3 py-4 sm:px-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-strawhat-500 text-2xl shadow-lg">
            🏴‍☠️
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-black leading-tight sm:text-2xl">One Pace Viewing Guide</h1>
            <p class="text-xs text-slate-300 sm:text-sm">
              Track your voyage through the manga-paced cut of One Piece ·{' '}
              <a href="https://onepace.net" target="_blank" rel="noopener noreferrer" class="underline hover:text-gold-400">
                onepace.net
              </a>
            </p>
          </div>
          <button
            class="chip shrink-0 border-slate-500/50 text-slate-200 hover:border-gold-400 hover:text-gold-400"
            onClick={toggleTheme}
            title="Toggle light / dark theme"
          >
            {prefs.theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>

      <FilterBar />

      <main class="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <VoyageHero />

        <div class="space-y-4">
          <Show
            when={visibleSagas().length}
            fallback={
              <div class="card px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="text-3xl">🧭</div>
                <p class="mt-2 font-semibold">No episodes match your filters.</p>
                <p class="text-sm">Try clearing the search or filters above.</p>
              </div>
            }
          >
            <For each={visibleSagas()}>
              {(saga) => {
                const idx = guide.sagas.findIndex((s) => s.id === saga.id);
                return <SagaSection saga={saga} index={idx} />;
              }}
            </For>
          </Show>
        </div>

        <footer class="border-t border-slate-200 pt-4 text-center text-xs text-slate-400 dark:border-sea-800">
          <p>
            Progress is saved in your browser. One Pace is an unofficial fan project re-editing the
            One Piece anime to match the manga's pacing. All credit to Eiichiro Oda, Toei Animation,
            and the One Pace team.
          </p>
          <p class="mt-1">
            {guide.meta.episodeCount} entries · {guide.meta.paceNumberedCount} canon Pace episodes ·
            data updated {guide.meta.generatedAt}
          </p>
        </footer>
      </main>
    </div>
  );
}
