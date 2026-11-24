import { For, Show, createSignal } from 'solid-js';
import { prefs } from '../store/prefs';
import { isConnected, rateSeason, trakt } from '../store/trakt';
import { config } from '../config';
import { RATING_WORDS } from './EpisodeRow';

/**
 * Trakt rating of an arc or saga, and (for arcs, when connected) your own rating of it, which
 * rates its season of the One Pace show on Trakt.
 */
export default function SectionTrakt(props: { rating?: number; season?: { number: number; trakt: number | null }; what: string }) {
  const [picking, setPicking] = createSignal(false);
  const key = () => (props.season?.trakt ? `season:${props.season.trakt}` : null);
  const mine = () => (key() ? trakt.myRatings[key()!] : undefined);
  const href = () =>
    props.season ? `https://trakt.tv/shows/${config.traktShowSlug}/seasons/${props.season.number}` : `https://trakt.tv/shows/${config.traktShowSlug}`;
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <Show when={prefs.ratingsShown !== 'seriesgraph'}>
      <Show when={props.rating}>
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          class="inline-flex items-center rounded-md border border-[#ed1c24]/50 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24]/10"
          title={`Trakt rating ${props.rating}: the average of this ${props.what}'s episodes on Trakt, by length. Open on Trakt`}
        >
          Trakt {props.rating?.toFixed(1)}
        </a>
      </Show>
      <Show when={isConnected() && key()}>
        <span class="inline-flex flex-wrap items-center gap-1" onClick={stop}>
          <button
            class="inline-flex items-center rounded-md border px-1.5 py-[3px] text-[11px] font-semibold leading-none transition-colors"
            classList={{
              'border-[#ed1c24] bg-[#ed1c24] text-white': !!mine(),
              'border-[#ed1c24]/50 text-[#ff5a5f] hover:bg-[#ed1c24]/10': !mine(),
            }}
            onClick={() => setPicking(!picking())}
            title={mine() ? `Your Trakt rating of this ${props.what}: ${mine()} (${RATING_WORDS[mine()!]}). Click to change.` : `Rate this ${props.what} on Trakt`}
          >
            {mine() ? `♥ ${mine()}` : `♡ Rate ${props.what}`}
          </button>
          <Show when={picking()}>
            <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
              {(n) => (
                <button
                  class="h-6 w-6 rounded text-[11px] font-bold tabular-nums transition-colors"
                  classList={{
                    'bg-[#ed1c24] text-white': mine() === n,
                    'bg-sea-200 text-sea-700 hover:bg-[#ed1c24]/70 hover:text-white dark:bg-sea-800 dark:text-sea-200': mine() !== n,
                  }}
                  title={RATING_WORDS[n]}
                  onClick={() => {
                    void rateSeason(props.season!.trakt!, n);
                    setPicking(false);
                  }}
                >
                  {n}
                </button>
              )}
            </For>
            <Show when={mine()}>
              <button
                class="px-1 text-[11px] text-sea-400 hover:text-sea-700 dark:hover:text-sea-100"
                onClick={() => {
                  void rateSeason(props.season!.trakt!, null);
                  setPicking(false);
                }}
              >
                remove
              </button>
            </Show>
          </Show>
        </span>
      </Show>
    </Show>
  );
}
