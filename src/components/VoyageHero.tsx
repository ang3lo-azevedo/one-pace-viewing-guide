import { For, Show, createSignal } from 'solid-js';
import { fmtDate, fmtDuration, fmtFromNow, fmtHours, fmtSpan, parsePace, stats } from '../lib/stats';
import { formatBerry } from '../lib/bounties';
import { nextUp, revealEpisode } from '../lib/focus';
import { LINK_LABEL, primaryLinkKey } from '../lib/links';
import { splitTitle } from '../lib/guide';
import { setWatched } from '../store/progress';
import { isConnected, rateEpisode, trakt } from '../store/trakt';
import { RATING_WORDS } from './EpisodeRow';
import { prefs, setPrefs } from '../store/prefs';
import { EXTRA_LABELS } from '../lib/guide';

function Panel(props: { title: string; accent: string; children: any }) {
  // `accent` is a Tailwind class list (with a dark: variant) so both themes stay readable.
  return (
    <div class="card flex flex-col p-3.5">
      <div class={`mb-2 text-[11px] font-bold uppercase tracking-widest ${props.accent}`}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

function Big(props: { value: string; label: string; color: string }) {
  return (
    <div class="mb-2">
      <div class={`font-display text-2xl font-black leading-tight tabular-nums whitespace-nowrap ${props.color}`}>
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
          <div class="text-xs font-bold uppercase tracking-widest" classList={{ 'text-accent-600 dark:text-accent-400': !props.muted, 'text-sea-500 dark:text-sea-400': props.muted }}>
            {props.label}
          </div>
          <div class="text-sm text-sea-500 dark:text-sea-400">{props.detail}</div>
        </div>
        <div
          class="font-display font-black tabular-nums"
          classList={{ 'text-3xl text-accent-600 dark:text-accent-400 sm:text-4xl': !props.muted, 'text-2xl text-sea-400 dark:text-sea-300 sm:text-3xl': props.muted }}
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

const PACES: [number | null, string][] = [
  [null, 'Auto'],
  [30, '30m'],
  [60, '1h'],
  [120, '2h'],
  [180, '3h'],
];

/** Type any pace: "90", "1h30", "1:30", "1.5h" or "2 eps". */
function CustomPace() {
  const preset = () => PACES.some(([v]) => v === prefs.paceMinutes);
  const [text, setText] = createSignal(preset() || prefs.paceMinutes == null ? '' : fmtDuration(prefs.paceMinutes));
  const [bad, setBad] = createSignal(false);
  const apply = () => {
    const t = text().trim();
    if (!t) {
      setBad(false);
      if (!preset()) setPrefs('paceMinutes', null);
      return;
    }
    const m = parsePace(t);
    setBad(m == null || m > 24 * 60);
    if (m != null && m <= 24 * 60) {
      setPrefs('paceMinutes', m);
      setText(fmtDuration(m));
    }
  };
  return (
    <input
      type="text"
      inputmode="text"
      placeholder="Custom"
      aria-label="Custom pace a day"
      title={'Type your own pace a day, e.g. 90, 1h30, 1:30, 1.5h or 2 eps. Press Enter to apply.'}
      class="w-20 rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold outline-none dark:bg-sea-900"
      classList={{
        'border-accent-500 text-accent-600 dark:text-accent-300': !preset() && prefs.paceMinutes != null && !bad(),
        'border-red-500 text-red-600': bad(),
        'border-sea-300 dark:border-sea-700': preset() && !bad(),
      }}
      value={text()}
      onInput={(e) => setText(e.currentTarget.value)}
      onKeyDown={(e) => e.key === 'Enter' && apply()}
      onBlur={apply}
    />
  );
}

function FinishLine() {
  const s = stats;
  return (
    <div class="card px-4 py-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span>
            <span class="text-[11px] font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">Time left</span>{' '}
            <b class="text-sea-800 dark:text-sea-50" title={fmtHours(s().minLeft)}>{fmtSpan(s().minLeft)}</b>
            <span class="text-sea-500 dark:text-sea-400" title={fmtHours(s().canonMinLeft)}> (canon route {fmtSpan(s().canonMinLeft)})</span>
          </span>
          <Show when={s().pacePerDay > 0}>
            <Show when={s().finishSelection}>
              <span>
                <span class="text-[11px] font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">Done by</span>{' '}
                <b class="text-sea-800 dark:text-sea-50">{fmtDate(s().finishSelection!)}</b>
                <span class="text-sea-500 dark:text-sea-400"> ({fmtFromNow(s().finishSelection!)})</span>
                <Show when={s().finishCanonOnly && !prefs.canonOnly}>
                  <span class="text-sea-500 dark:text-sea-400"> · canon route only {fmtDate(s().finishCanonOnly!)} ({fmtFromNow(s().finishCanonOnly!)})</span>
                </Show>
              </span>
            </Show>
          </Show>
        </div>

        <div class="flex items-center gap-1.5" role="radiogroup" aria-label="Watching pace">
          <span class="text-[11px] text-sea-500 dark:text-sea-400">Pace a day</span>
          <For each={PACES}>
            {([value, label]) => (
              <button
                role="radio"
                aria-checked={prefs.paceMinutes === value}
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors"
                classList={{
                  'bg-accent-500 text-white': prefs.paceMinutes === value,
                  'text-sea-500 hover:text-sea-800 dark:text-sea-400 dark:hover:text-sea-100': prefs.paceMinutes !== value,
                }}
                onClick={() => setPrefs('paceMinutes', value)}
                title={
                  value == null
                    ? s().paceSource === 'trakt'
                      ? `Your One Piece watching on Trakt over the last ${Math.round(s().paceDays)} days (bulk-added history ignored)`
                      : 'How much you watched in the last 28 days (episodes you checked one at a time)'
                    : `Assume ${label} of watching a day`
                }
              >
                {label}
                {value == null && s().historyPace > 0 ? ` (${fmtHours(s().historyPace)}${s().paceSource === 'trakt' ? ' · Trakt' : ''})` : ''}
              </button>
            )}
          </For>
          <CustomPace />
        </div>
      </div>
      <Show when={s().pacePerDay <= 0}>
        <div class="mt-1.5 text-xs text-sea-500 dark:text-sea-400">
          No recent watch times yet, so there is no finish date. Pick a pace above, or keep checking episodes as you
          watch them and Auto will use your real pace{' '}(connecting Trakt fills it in from your history).
        </div>
      </Show>
    </div>
  );
}

/** After "Mark watched" in the card: rate the episode you just finished on Trakt. */
function RateJustWatched(props: { id: string; title: string; onDone: () => void }) {
  const mine = () => trakt.myRatings[props.id];
  return (
    <div class="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#ed1c24]/30 bg-[#ed1c24]/5 px-3 py-2">
      <span class="w-full text-xs text-sea-600 sm:w-auto dark:text-sea-300">
        {mine() ? 'Rated' : 'Rate'} <b class="text-sea-800 dark:text-sea-50">{props.title}</b> on Trakt
      </span>
      <div class="flex flex-wrap gap-1">
        <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
          {(n) => (
            <button
              class="h-7 w-7 rounded text-xs font-bold tabular-nums transition-colors"
              classList={{
                'bg-[#ed1c24] text-white': mine() === n,
                'bg-sea-200 text-sea-700 hover:bg-[#ed1c24]/70 hover:text-white dark:bg-sea-800 dark:text-sea-200': mine() !== n,
              }}
              title={RATING_WORDS[n]}
              onClick={() => {
                void rateEpisode(props.id, n);
                setTimeout(props.onDone, 700);
              }}
            >
              {n}
            </button>
          )}
        </For>
      </div>
      <button class="ml-auto px-1 text-xs text-sea-400 hover:text-sea-700 dark:hover:text-sea-100" onClick={props.onDone}>
        {mine() ? 'Done' : 'Skip'}
      </button>
    </div>
  );
}

function ContinueWatching() {
  const next = nextUp;
  const [justWatched, setJustWatched] = createSignal<{ id: string; title: string } | null>(null);
  const link = () => {
    const n = next();
    if (!n) return null;
    const k = primaryLinkKey(n.ep.links, prefs.streamSource);
    return k ? { url: n.ep.links[k]!, label: LINK_LABEL[k] } : null;
  };
  const title = () => {
    const n = next();
    if (!n) return '';
    return prefs.spoilerSafe ? splitTitle(n.ep.title).label : n.ep.title;
  };
  return (
    <div class="space-y-2">
    <Show when={justWatched()}>
      {(j) => <RateJustWatched id={j().id} title={j().title} onDone={() => setJustWatched(null)} />}
    </Show>
    <Show
      when={next()}
      fallback={<div class="text-sm font-semibold text-accent-600 dark:text-accent-400">You have watched everything in your selection.</div>}
    >
      {(n) => (
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent-400/30 bg-accent-400/10 px-3 py-2.5">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">Continue watching</div>
            <div class="truncate font-display text-base font-extrabold" title={prefs.spoilerSafe ? undefined : n().ep.fullTitle}>
              {title()}
            </div>
            <div class="truncate text-xs text-sea-500 dark:text-sea-400">{n().nodeTitle}</div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <Show when={link()}>
              {(l) => (
                <a href={l().url} target="_blank" rel="noopener noreferrer" class="btn-watch px-3.5 py-1.5 text-sm">
                  ▶ Watch on {l().label}
                </a>
              )}
            </Show>
            <button
              class="chip border-sea-300 text-xs font-semibold text-sea-600 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-200"
              onClick={() => {
                const ep = n().ep;
                setWatched(ep.id, true);
                if (isConnected() && trakt.mapped[ep.id] && !trakt.myRatings[ep.id])
                  setJustWatched({ id: ep.id, title: prefs.spoilerSafe ? splitTitle(ep.title).label : ep.title });
              }}
              title="Mark this episode watched and move on to the next one"
            >
              ✓ Mark watched
            </button>
            <button
              class="chip border-sea-300 text-xs font-semibold text-sea-600 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-200"
              onClick={() => revealEpisode(n().ep.id)}
            >
              Show in list
            </button>
          </div>
        </div>
      )}
    </Show>
    </div>
  );
}

export default function VoyageHero() {
  const [crewOpen, setCrewOpen] = createSignal(false);
  const s = stats;
  const selectionLabel = () => {
    if (prefs.canonOnly) return null;
    const hidden = prefs.hiddenExtras.map((c) => EXTRA_LABELS[c]);
    if (prefs.hideNonCanon) hidden.unshift('non-canon');
    return hidden.length ? `Your selection (without ${hidden.join(', ')})` : 'Everything, incl. extras and non-canon';
  };

  return (
    <div class="space-y-4">
      <div class="card space-y-4 overflow-hidden p-4 sm:p-5">
        <ContinueWatching />
        <Bar label="Canon route" detail={`${s().canonWatched} of ${s().canonTotal} episodes watched · % by watch time`} pct={s().canonPct} />
        <Show when={selectionLabel()}>
          <Bar label={selectionLabel()!} detail={`${s().selWatched} of ${s().selTotal} entries watched · % by watch time`} pct={s().selPct} muted />
        </Show>
      </div>

      <FinishLine />

      <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Watched" accent="text-accent-600 dark:text-accent-400">
          <Big value={fmtSpan(s().minWatched)} label={`of ${fmtSpan(s().minTotal)} in total`} color="text-accent-600 dark:text-accent-300" />
          <Row label="One Pace episodes" value={`${s().onePaceWatched} / ${s().onePaceTotal}`} title="One Pace's own numbered episodes" />
        </Panel>

        <Panel title="Saved vs full anime" accent="text-teal-700 dark:text-teal-300">
          <Big value={fmtSpan(s().savedSoFarMin)} label="saved so far" color="text-teal-600 dark:text-teal-300" />
          <Row label="Saved in total" value={fmtSpan(s().savedTotalMin)} />
          <Row label="Full anime equivalent" value={fmtSpan(s().animeEquivMin)} title="Time to watch the same story in the original anime" />
        </Panel>

        <Panel title="Journey" accent="text-sky-700 dark:text-accent-300">
          <div class="grid grid-cols-2 gap-1.5">
            <Mini value={`${s().islandsConquered}/${s().islandsTotal}`} label="Islands" pct={(s().islandsConquered / s().islandsTotal) * 100} />
            <Mini value={`${s().sagasConquered}/${s().sagasTotal}`} label="Sagas" pct={(s().sagasConquered / s().sagasTotal) * 100} />
            <Mini value={`~${s().chaptersSeen}`} label="Manga chapters" />
            <Mini value={`~${s().animeSeen}`} label="Anime episodes" />
          </div>
        </Panel>

        <Panel title="Extras" accent="text-amber-700 dark:text-amber-300">
          <For each={s().extras}>
            {(x) => (
              <Row
                label={x.label}
                value={x.total ? `${x.watched}/${x.total}` : '-'}
                title={x.minLeft ? `${fmtSpan(x.minLeft)} left` : undefined}
              />
            )}
          </For>
          <div class="mt-1 text-[10px] text-sea-400">Alternative versions are optional and not counted.</div>
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
            <span class="text-xs font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">Crew Bounties</span>
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
