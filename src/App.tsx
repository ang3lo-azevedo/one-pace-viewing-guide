import { For, Show } from 'solid-js';
import { guide } from './lib/guide';
import { visibleSagas } from './lib/filter';
import { prefs, toggleTheme } from './store/prefs';
import VoyageHero from './components/VoyageHero';
import FilterBar from './components/FilterBar';
import SagaSection from './components/SagaSection';
import InfoPanel from './components/InfoPanel';
import TraktMenu from './components/TraktMenu';

export default function App() {
  return (
    <div class="min-h-screen">
      <header class="border-b border-sea-800 bg-sea-975 text-sea-50">
        <div class="mx-auto flex max-w-5xl items-center gap-3 px-3 py-4 sm:px-4">
          <img src="./favicon.svg" alt="" width="40" height="40" class="shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1">
            <h1 class="font-display text-xl font-black leading-tight tracking-wide sm:text-2xl">
              ONE PACE <span class="text-accent-400">Viewing Guide</span>
            </h1>
            <p class="text-xs text-sea-300 sm:text-sm">
              Track your way through the manga-paced cut of One Piece ·{' '}
              <a href="https://onepace.net" target="_blank" rel="noopener noreferrer" class="text-accent-400 hover:underline">
                onepace.net
              </a>
            </p>
          </div>
          <TraktMenu />
          <button
            class="chip shrink-0 border-sea-600 text-sea-200 hover:border-accent-400 hover:text-accent-400"
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
        <InfoPanel />

        <div class="space-y-4">
          <Show
            when={visibleSagas().length}
            fallback={
              <div class="card px-4 py-12 text-center text-sea-500 dark:text-sea-400">
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

        <footer class="border-t border-sea-200 pt-4 text-center text-xs text-sea-400 dark:border-sea-800">
          <p>
            Progress is saved in your browser. One Pace is an unofficial fan project re-editing the
            One Piece anime to match the manga's pacing. All credit to Eiichiro Oda, Toei Animation,
            and the One Pace team. Ratings from SeriesGraph.
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
