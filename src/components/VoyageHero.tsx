import { For, Show, createSignal } from 'solid-js';
import { fmtHours, stats } from '../lib/stats';
import { BOUNTY_PER_EPISODE, formatBerry, nextRank } from '../lib/bounties';
import { prefs } from '../store/prefs';
import { EXTRA_LABELS } from '../lib/guide';

function Panel(props: { title: string; accent: string; children: any }) {
  return (
    <div class="card flex flex-col p-3.5">
      <div class="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: props.accent }}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

function Big(props: { value: string; label: string; color: string }) {
  return (
    <div class="mb-2">
      <div class="font-display text-2xl font-black leading-tight tabular-nums whitespace-nowrap" style={{ color: props.color }}>
        {props.value}
      </div>
      <div class="text-[11px] text-sea-500 dark:text-sea-400">{props.label}</div>
    </div>
  );
}

function Row(props: { label: string; value: string; title?: string }) {
  return (
    <div class="flex items-baseline justify-between gap-2 border-t border-sea-200 py-1 text-xs dark:border-sea-800" title={props.title}>
      <span class="text-sea-500 dark:text-sea-400">{props.label}</span>
      <span class="font-semibold tabular-nums text-sea-700 dark:text-sea-100">{props.value}</span>
    </div>
  );
}

function Mini(props: { value: string; label: string; pct?: number }) {
  return (
    <div class="rounded-lg bg-sea-100 px-2.5 py-2 dark:bg-sea-950/60">
      <div class="font-display text-lg font-black leading-tight tabular-nums text-accent-500 dark:text-accent-300">{props.value}</div>
      <div class="text-[10px] font-semibold uppercase tracking-wide text-sea-500 dark:text-sea-400">{props.label}</div>
      {props.pct != null && (
        <div class="mt-1 h-1 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
          <div class="voyage-fill h-full rounded-full" style={{ width: `${props.pct}%` }} />
        </div>
      )}
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
  const [crewOpen, setCrewOpen] = createSignal(false);
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

      <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Time" accent="#66c0ef">
          <Big value={fmtHours(s().minLeft)} label="left to watch" color="#ff0408" />
          <Row label="Watched" value={fmtHours(s().minWatched)} />
          <Row label="Total" value={fmtHours(s().minTotal)} />
          <Row label="Canon route left" value={fmtHours(s().canonMinLeft)} />
        </Panel>

        <Panel title="Saved vs full anime" accent="#2dd4bf">
          <Big value={fmtHours(s().savedSoFarMin)} label="saved so far" color="#2dd4bf" />
          <Row label="Saved in total" value={fmtHours(s().savedTotalMin)} />
          <Row label="Full anime equivalent" value={fmtHours(s().animeEquivMin)} title="Time to watch the same story in the original anime" />
          <Row label="With this guide" value={fmtHours(s().minTotal)} />
        </Panel>

        <Panel title="Journey" accent="#8fd0f3">
          <div class="grid grid-cols-2 gap-1.5">
            <Mini value={`${s().islandsConquered}/${s().islandsTotal}`} label="Islands" pct={(s().islandsConquered / s().islandsTotal) * 100} />
            <Mini value={`${s().sagasConquered}/${s().sagasTotal}`} label="Sagas" pct={(s().sagasConquered / s().sagasTotal) * 100} />
            <Mini value={`~${s().chaptersSeen}`} label="Manga chapters" />
            <Mini value={`~${s().animeSeen}`} label="Anime episodes" />
          </div>
        </Panel>

        <Panel title="Pirate" accent="#f4d35e">
          <Big value={formatBerry(s().bounty)} label="your bounty (฿3M per canon episode)" color="#f4d35e" />
          <Row label="Rank" value={s().rank} />
          <Show when={nextRank(s().bounty)}>
            {(n) => (
              <Row
                label={`Next: ${n().name}`}
                value={`${Math.ceil((n().at - s().bounty) / BOUNTY_PER_EPISODE)} eps`}
                title={`Reached at ${formatBerry(n().at)}`}
              />
            )}
          </Show>
        </Panel>
      </div>

      <Show when={s().crew.length}>
        <div class="card overflow-hidden">
          <button
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-sea-100 dark:hover:bg-sea-800/40 sm:px-4"
            onClick={() => setCrewOpen(!crewOpen())}
            aria-expanded={crewOpen()}
          >
            <span class="text-xs transition-transform" classList={{ 'rotate-90': crewOpen() }} aria-hidden="true">
              ▶
            </span>
            <span class="text-xs font-bold uppercase tracking-widest text-accent-400">Crew Bounties</span>
            <span class="text-[11px] text-sea-400">
              · {s().crew.length} crew{s().crewAsOf ? ` · as of ${s().crewAsOf}` : ''}
            </span>
          </button>
          <Show when={crewOpen()}>
            <div class="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-4">
              <For each={s().crew}>{(c) => <Poster emoji={c.emoji} name={c.name} bounty={c.bounty} />}</For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
