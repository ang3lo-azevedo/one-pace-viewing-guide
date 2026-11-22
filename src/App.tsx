import { For, Show, onMount } from 'solid-js';
import { scrollToFocus } from './lib/focus';
import { restoreScroll } from './lib/restore';
import { guide } from './lib/guide';
import { visibleSagas } from './lib/filter';
import { prefs, toggleTheme } from './store/prefs';
import VoyageHero from './components/VoyageHero';
import FilterBar from './components/FilterBar';
import SagaSection from './components/SagaSection';
import InfoPanel from './components/InfoPanel';
import TraktMenu from './components/TraktMenu';
import ProgressMenu from './components/ProgressMenu';
import Preferences from './components/Preferences';

export default function App() {
  // Jump to the last episode you watched once the list has rendered.
  onMount(() => setTimeout(() => restoreScroll() || scrollToFocus(), 60));

  return (
    <div class="min-h-screen">
      <header class="border-b border-sea-800 bg-sea-975 text-sea-50">
        {/* On phones the title takes the full first row and the buttons wrap below it. */}
        <div class="relative mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2.5 px-3 py-4 sm:flex-nowrap sm:px-4">
          <img src="./favicon.svg" alt="" width="40" height="40" class="shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-auto">
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
          <div class="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-nowrap sm:gap-2">
            <a
              href="https://github.com/ang3lo-azevedo/one-pace-viewing-guide"
              target="_blank"
              rel="noopener noreferrer"
              class="chip shrink-0 gap-1.5 border-sea-600 text-sea-200 hover:border-accent-400 hover:text-accent-400"
              title="Source code on GitHub"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              <span class="hidden sm:inline">Source</span>
            </a>
            <ProgressMenu />
            <TraktMenu />
            <button
              class="chip shrink-0 border-sea-600 text-sea-200 hover:border-accent-400 hover:text-accent-400"
              onClick={toggleTheme}
              title="Toggle light / dark theme"
            >
              {prefs.theme === 'dark' ? '☀' : '☾'}
              <span class="hidden sm:inline">{prefs.theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </header>

      <FilterBar />

      <main class="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <VoyageHero />
        <Preferences />
        <InfoPanel />

        <div class="space-y-4">
          <Show
            when={visibleSagas().length}
            fallback={
              <div class="card px-4 py-12 text-center text-sea-500 dark:text-sea-400">
                <p class="mt-2 font-semibold">No episodes match your filters.</p>
                <p class="text-sm">Try clearing the search or filters above.</p>
              </div>
            }
          >
            <For each={visibleSagas()}>
              {(saga) => {
                return <SagaSection saga={saga} />;
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
