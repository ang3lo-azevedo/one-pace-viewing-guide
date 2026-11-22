import { For, Show, createSignal, type JSX } from 'solid-js';
import { prefs, setPrefs, setVersion, toggleExtra, type Prefs } from '../store/prefs';
import { VERSION_SETS } from '../lib/versions';
import { EXTRA_LABELS, type ExtraCategory } from '../lib/guide';
import { CustomPace, PACES } from './VoyageHero';

/** Content kinds you can leave out (alternatives have their own choice under Versions). */
const CONTENT = (Object.keys(EXTRA_LABELS) as ExtraCategory[]).filter((c) => c !== 'alternatives');
import { wasOpen } from '../lib/restore';

interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

/** One preference: a label and a row of options, the picked one filled. */
function Choice<T>(props: { label: string; hint?: string; options: Option<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div class="space-y-1.5">
      <div class="text-xs font-semibold text-sea-700 dark:text-sea-200">{props.label}</div>
      <div class="flex flex-wrap gap-1.5">
        <For each={props.options}>
          {(o) => (
            <button
              class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
              classList={{
                'border-accent-500 bg-accent-500 text-white': props.value === o.value,
                'border-sea-300 text-sea-600 hover:border-accent-400 hover:text-accent-600 dark:border-sea-600 dark:text-sea-300 dark:hover:text-accent-300':
                  props.value !== o.value,
              }}
              aria-pressed={props.value === o.value}
              title={o.title}
              onClick={() => props.onPick(o.value)}
            >
              {o.label}
            </button>
          )}
        </For>
      </div>
      <Show when={props.hint}>
        <div class="text-[11px] leading-snug text-sea-500 dark:text-sea-400">{props.hint}</div>
      </Show>
    </div>
  );
}

function Group(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="space-y-3">
      <div>
        <h3 class="text-[11px] font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">{props.title}</h3>
        <Show when={props.note}>
          <p class="mt-0.5 text-[11px] leading-snug text-sea-500 dark:text-sea-400">{props.note}</p>
        </Show>
      </div>
      {props.children}
    </section>
  );
}

/** Everything about how you watch and how the guide is laid out, in one collapsible section. */
export default function Preferences() {
  // Stays open across the reload a version change needs.
  const [open, setOpen] = createSignal(wasOpen('prefs') ?? false);
  return (
    <div class="card overflow-hidden" id="preferences" data-open-key={open() ? 'prefs' : undefined} data-open-title="Preferences">
      <button
        class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-sea-100 dark:hover:bg-sea-800/40"
        data-toggle
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
      >
        <span class="text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
          ▶
        </span>
        <span class="font-display text-sm font-extrabold uppercase tracking-wide text-accent-600 dark:text-accent-400">Preferences</span>
        <span class="ml-auto hidden truncate text-[11px] text-sea-500 sm:inline dark:text-sea-400">
          Watch on {prefs.streamSource === 'stremio' ? 'Stremio' : 'One Pace'} · Spoiler-safe {prefs.spoilerSafe ? 'on' : 'off'}
          {prefs.canonOnly ? ' · Extras hidden' : ''}
          {prefs.hideNonCanon ? ' · Non-canon hidden' : ''}
        </span>
      </button>

      <Show when={open()}>
        <div class="grid gap-x-8 gap-y-6 border-t border-sea-200 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-sea-800">
          <Group title="Viewing">
            <Choice<Prefs['streamSource']>
              label="Watch on"
              value={prefs.streamSource}
              onPick={(v) => setPrefs('streamSource', v)}
              options={[
                { value: 'onepace', label: 'One Pace', title: 'The red watch button opens onepace.net' },
                { value: 'stremio', label: 'Stremio', title: 'The red watch button opens Stremio Web' },
              ]}
            />
            <Choice<boolean>
              label="Spoiler-safe"
              value={prefs.spoilerSafe}
              onPick={(v) => setPrefs('spoilerSafe', v)}
              options={[
                { value: true, label: 'On', title: 'Hide episode subtitles; reveal on hover' },
                { value: false, label: 'Off', title: 'Show full episode titles' },
              ]}
              hint="Hides episode subtitles until you hover them."
            />
            <Choice<Prefs['theme']>
              label="Theme"
              value={prefs.theme}
              onPick={(v) => setPrefs('theme', v)}
              options={[
                { value: 'system', label: 'System', title: 'Follow your device' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <Choice<Prefs['ratingsShown']>
              label="Ratings shown"
              value={prefs.ratingsShown}
              onPick={(v) => setPrefs('ratingsShown', v)}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'seriesgraph', label: 'SeriesGraph', title: 'The star rating (IMDb ratings via SeriesGraph)' },
                { value: 'trakt', label: 'Trakt' },
              ]}
            />
            <Choice<Prefs['longTimes']>
              label="Long times"
              value={prefs.longTimes}
              onPick={(v) => setPrefs('longTimes', v)}
              options={[
                { value: 'days', label: 'Days (12d 1h)' },
                { value: 'hours', label: 'Hours (289h)' },
              ]}
            />
          </Group>

          <Group title="What to include" note="Part of your watch-through: changes the list, your percentages and the times.">
            <Choice<boolean>
              label="Extras"
              value={prefs.canonOnly}
              onPick={(v) => setPrefs('canonOnly', v)}
              options={[
                { value: false, label: 'Show' },
                { value: true, label: 'Hide' },
              ]}
              hint="Hiding them leaves only the main One Pace route: no films, specials, Live Action, filler, original anime or alternatives."
            />
            <Choice<boolean>
              label="Non-canon"
              value={prefs.hideNonCanon}
              onPick={(v) => setPrefs('hideNonCanon', v)}
              options={[
                { value: false, label: 'Show' },
                { value: true, label: 'Hide' },
              ]}
              hint="Hides films, filler and most specials. Canon extras like the Live Action stay."
            />
            <div class="space-y-1.5">
              <div class="text-xs font-semibold text-sea-700 dark:text-sea-200">Content</div>
              <div class="flex flex-wrap gap-1.5">
                <For each={CONTENT}>
                  {(cat) => {
                    const on = () => !prefs.canonOnly && !prefs.hiddenExtras.includes(cat);
                    return (
                      <button
                        class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
                        classList={{
                          'border-accent-500 bg-accent-500 text-white': on(),
                          'border-sea-300 text-sea-600 line-through decoration-1 hover:border-accent-400 dark:border-sea-600 dark:text-sea-400': !on(),
                        }}
                        aria-pressed={on()}
                        title={on() ? `Hide ${EXTRA_LABELS[cat]}` : `Show ${EXTRA_LABELS[cat]}`}
                        onClick={() => {
                          if (prefs.canonOnly) setPrefs('canonOnly', false);
                          toggleExtra(cat);
                        }}
                      >
                        {EXTRA_LABELS[cat]}
                      </button>
                    );
                  }}
                </For>
              </div>
              <div class="text-[11px] leading-snug text-sea-500 dark:text-sea-400">Tap to show or hide each kind of extra.</div>
            </div>
          </Group>

          <Group title="Versions" note="Your main route for each of these. Changing one reloads the page.">
            <Choice<boolean>
              label="The other versions"
              value={!prefs.hiddenExtras.includes('alternatives')}
              onPick={(show) => {
                if (show !== !prefs.hiddenExtras.includes('alternatives')) toggleExtra('alternatives');
              }}
              options={[
                { value: true, label: 'Show as Alternative' },
                { value: false, label: 'Hide' },
              ]}
              hint="Shown, they stay in the list tagged Alternative and never count as remaining. Also hides other alternative cuts (like the unfixed Fish-Man Island 07)."
            />
            <For each={VERSION_SETS}>
              {(set) => <Choice<string> label={set.label} value={prefs.versions[set.key]} onPick={(v) => setVersion(set.key, v)} options={set.options} />}
            </For>
          </Group>

          <Group title="Layout">
            <Choice<Prefs['liveActionPlacement']>
              label="Live Action"
              value={prefs.liveActionPlacement}
              onPick={(v) => setPrefs('liveActionPlacement', v)}
              options={[
                { value: 'arc', label: 'Next to each arc', title: 'Watch each episode where the guide places it (some reveal things early)' },
                { value: 'post-enies-lobby-arc', label: 'After Post-Enies Lobby', title: 'Watch it all once the earlier reveals are covered' },
                { value: 'thriller-bark-arc', label: 'After Thriller Bark' },
              ]}
              hint="After Thriller Bark is the safest: some episodes show things the anime only reveals by then."
            />
            <Choice<boolean>
              label="Final Saga"
              value={prefs.splitFinalSaga}
              onPick={(v) => setPrefs('splitFinalSaga', v)}
              options={[
                { value: false, label: 'One saga' },
                { value: true, label: 'Egghead and Elbaph separate' },
              ]}
            />
            <Choice<boolean>
              label="Catch up"
              value={prefs.catchUpExtras}
              onPick={(v) => setPrefs('catchUpExtras', v)}
              options={[
                { value: true, label: 'Includes extras' },
                { value: false, label: 'Main route only' },
              ]}
              hint="Whether Catch up also marks the films, specials, Live Action and filler before that point."
            />
          </Group>

          <Group title="Behaviour">
            <div class="space-y-1.5">
              <div class="text-xs font-semibold text-sea-700 dark:text-sea-200">Pace a day</div>
              <div class="flex flex-wrap items-center gap-1.5">
                <For each={PACES}>
                  {([value, label]) => (
                    <button
                      class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
                      classList={{
                        'border-accent-500 bg-accent-500 text-white': prefs.paceMinutes === value,
                        'border-sea-300 text-sea-600 hover:border-accent-400 dark:border-sea-600 dark:text-sea-300': prefs.paceMinutes !== value,
                      }}
                      onClick={() => setPrefs('paceMinutes', value)}
                    >
                      {label}
                    </button>
                  )}
                </For>
                <CustomPace />
              </div>
              <div class="text-[11px] leading-snug text-sea-500 dark:text-sea-400">For the finish dates. Auto uses your recent watching (or Trakt history).</div>
            </div>
            <Choice<Prefs['openAt']>
              label="When the site opens"
              value={prefs.openAt}
              onPick={(v) => setPrefs('openAt', v)}
              options={[
                { value: 'last', label: 'Jump to my last episode' },
                { value: 'top', label: 'Start at the top' },
              ]}
            />
            <Choice<boolean>
              label="Rate on Trakt after watching"
              value={prefs.askRate}
              onPick={(v) => setPrefs('askRate', v)}
              options={[
                { value: true, label: 'Ask me' },
                { value: false, label: "Don't ask" },
              ]}
              hint="Only when Trakt is connected."
            />
            <Choice<boolean>
              label="Confirm bulk marks"
              value={prefs.confirmBulk}
              onPick={(v) => setPrefs('confirmBulk', v)}
              options={[
                { value: true, label: 'Ask first' },
                { value: false, label: 'Just do it' },
              ]}
              hint="Mark arc, Mark saga, Catch up and Mark all."
            />
          </Group>
        </div>
      </Show>
    </div>
  );
}
