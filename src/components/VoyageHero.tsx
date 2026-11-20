import { For, Show } from 'solid-js';
import { fmtHours, stats } from '../lib/stats';
import { formatBerry } from '../lib/bounties';
import { prefs } from '../store/prefs';
import { EXTRA_LABELS } from '../lib/guide';

function Tile(props: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div class="card flex flex-col justify-center px-3 py-2.5">
      <div
        class="font-display font-black leading-tight tabular-nums whitespace-nowrap"
        classList={{ 'text-base sm:text-lg': props.value.length <= 11, 'text-sm sm:text-[15px]': props.value.length > 11 }}
        style={{ color: props.accent }}
      >
        {props.value}
      </div>
      <div class="text-[11px] font-semibold uppercase tracking-wide text-sea-500 dark:text-sea-400">{props.label}</div>
      {props.sub && <div class="text-[11px] text-sea-400 dark:text-sea-500">{props.sub}</div>}
    </div>
  );
}

function Bar(props: { label: string; detail: string; pct: number; muted?: boolean }) {
  return (
    <div>
      <div class="mb-1 flex items-end justify-between gap-3">
        <div>
          <div class="text-xs font-bold uppercase tracking-widest" classList={{ 'text-accent-400': !props.muted, 'text-sea-400': props.muted }}>
            {props.label}
          </div>
          <div class="text-sm text-sea-500 dark:text-sea-400">{props.detail}</div>
        </div>
        <div
          class="font-display font-black tabular-nums"
          classList={{ 'text-3xl text-accent-400 sm:text-4xl': !props.muted, 'text-2xl text-sea-300 sm:text-3xl': props.muted }}
        >
          {props.pct.toFixed(1)}%
        </div>
      </div>
      <div class="overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800" classList={{ 'h-4': !props.muted, 'h-2.5': props.muted }}>
        <div
          class="h-full rounded-full transition-all duration-700"
          classList={{ 'voyage-fill': !props.muted, 'bg-sea-400': props.muted }}
          style={{ width: `${Math.max(props.pct, 1.5)}%` }}
        />
      </div>
    </div>
  );
}

function Poster(props: { emoji: string; name: string; bounty: number | null }) {
  return (
    <div class="flex w-[6.5rem] shrink-0 flex-col items-center rounded-md border-2 border-[#8b6b3e] bg-[#f3e2bf] px-2 py-2 text-[#3b2a17] shadow-sm">
      <div class="font-display text-[11px] font-black tracking-[0.2em]">WANTED</div>
      <div class="my-1 flex h-11 w-11 items-center justify-center rounded border border-[#8b6b3e]/60 bg-[#e8d3a6] text-2xl">
        {props.emoji}
      </div>
      <div class="font-display text-xs font-extrabold">{props.name}</div>
      <div class="text-[10px] font-bold tabular-nums">{props.bounty != null ? formatBerry(props.bounty) : 'No bounty yet'}</div>
    </div>
  );
}

export default function VoyageHero() {
  const s = stats;
  const selectionLabel = () => {
    if (prefs.canonOnly) return null;
    const hidden = prefs.hiddenExtras.map((c) => EXTRA_LABELS[c]);
    return hidden.length ? `Your selection (without ${hidden.join(', ')})` : 'Everything, incl. non-canon';
  };

  return (
    <div class="space-y-4">
      <div class="card space-y-4 overflow-hidden p-4 sm:p-5">
        <Bar label="Canon route" detail={`${s().canonWatched} of ${s().canonTotal} episodes watched`} pct={s().canonPct} />
        <Show when={selectionLabel()}>
          <Bar label={selectionLabel()!} detail={`${s().selWatched} of ${s().selTotal} entries watched`} pct={s().selPct} muted />
        </Show>
      </div>

      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <For
          each={[
            { label: 'Watched', value: `${s().selWatched} / ${s().selTotal}`, sub: prefs.canonOnly ? 'canon episodes' : 'entries', accent: '#66c0ef' },
            { label: 'Time Watched', value: fmtHours(s().minWatched), sub: `of ${fmtHours(s().minTotal)} total`, accent: '#66c0ef' },
            { label: 'Time Remaining', value: fmtHours(s().minLeft), sub: `canon only: ${fmtHours(s().canonMinLeft)}`, accent: '#ff0408' },
            { label: 'Full Anime Equivalent', value: fmtHours(s().animeEquivMin), sub: 'same story in the original anime', accent: '#90a4ae' },
            { label: 'Saved vs Anime', value: fmtHours(s().savedSoFarMin), sub: `so far · ${fmtHours(s().savedTotalMin)} in total`, accent: '#2dd4bf' },
            { label: 'Islands Conquered', value: `${s().islandsConquered} / ${s().islandsTotal}`, sub: 'arcs completed', accent: '#8fd0f3' },
            { label: 'Sagas Conquered', value: `${s().sagasConquered} / ${s().sagasTotal}`, sub: 'sagas completed', accent: '#8fd0f3' },
            { label: 'Manga Chapters', value: `~${s().chaptersSeen}`, sub: 'covered so far', accent: '#c4b5fd' },
            { label: 'Anime Eps Covered', value: `~${s().animeSeen}`, sub: 'covered so far', accent: '#c4b5fd' },
            { label: 'Bounty', value: formatBerry(s().bounty), sub: '฿3M per canon episode', accent: '#f4d35e' },
            { label: 'Pirate Rank', value: s().rank, sub: 'based on your bounty', accent: '#f4d35e' },
            { label: 'Canon Route', value: `${s().canonPct.toFixed(1)}%`, sub: `${s().canonWatched} / ${s().canonTotal}`, accent: '#66c0ef' },
          ]}
        >
          {(t) => <Tile label={t.label} value={t.value} sub={t.sub} accent={t.accent} />}
        </For>
      </div>

      <Show when={s().crew.length}>
        <div class="card p-3 sm:p-4">
          <div class="mb-2 flex items-baseline justify-between gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-accent-400">Crew Bounties</div>
            <div class="text-[11px] text-sea-400">{s().crewAsOf ? `as of ${s().crewAsOf}` : 'start watching to meet the crew'}</div>
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1">
            <For each={s().crew}>{(c) => <Poster emoji={c.emoji} name={c.name} bounty={c.bounty} />}</For>
          </div>
        </div>
      </Show>
    </div>
  );
}
