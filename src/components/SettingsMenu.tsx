import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { prefs, setPrefs, setVersion, type Prefs } from '../store/prefs';
import { VERSION_SETS } from '../lib/versions';

interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

function Choice<T>(props: { label: string; hint?: string; options: Option<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div class="space-y-1">
      <div class="text-[11px] font-bold uppercase tracking-wide text-sea-400">{props.label}</div>
      <div class="flex flex-wrap gap-1">
        <For each={props.options}>
          {(o) => (
            <button
              class="angled angled-edge border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              classList={{
                'no-edge bg-accent-500 text-white': props.value === o.value,
                'border-sea-600 text-sea-300 hover:border-accent-400 hover:text-accent-300': props.value !== o.value,
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
        <div class="text-[11px] leading-snug text-sea-400">{props.hint}</div>
      </Show>
    </div>
  );
}

/** Header menu for how the guide is laid out: versions, Live Action placement, Final Saga, Catch up. */
export default function SettingsMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  const onDocClick = (e: MouseEvent) => {
    if (root && !root.contains(e.target as Node)) setOpen(false);
  };
  onMount(() => document.addEventListener('click', onDocClick));
  onCleanup(() => document.removeEventListener('click', onDocClick));

  return (
    <div class="shrink-0 sm:relative" ref={root}>
      <button
        class="chip border-sea-600 font-semibold text-sea-200 hover:border-accent-400 hover:text-accent-400"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
        title="Choose versions and how the guide is laid out"
      >
        Settings ▾
      </button>
      <Show when={open()}>
        <div class="absolute inset-x-3 z-40 mt-2 sm:inset-x-auto sm:right-0 max-h-[75vh] sm:w-80 space-y-3.5 overflow-y-auto rounded-xl border border-sea-700 bg-sea-900 p-3 text-sm text-sea-100 shadow-xl">
          <Choice<'onepace' | 'stremio'>
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
          />
          <Choice<boolean>
            label="Extras"
            value={prefs.canonOnly}
            onPick={(v) => setPrefs('canonOnly', v)}
            options={[
              { value: false, label: 'Show' },
              { value: true, label: 'Hide', title: 'Only the main One Pace route: hides movies, specials, Live Action, filler, original anime and alternatives' },
            ]}
          />
          <Choice<boolean>
            label="Non-canon"
            value={prefs.hideNonCanon}
            onPick={(v) => setPrefs('hideNonCanon', v)}
            options={[
              { value: false, label: 'Show' },
              { value: true, label: 'Hide', title: 'Hide films, filler and most specials. Canon extras like the Live Action stay.' },
            ]}
          />
          <div class="border-t border-sea-700" />
          <div class="text-[11px] leading-snug text-sea-400">Which version is your main route. The others stay listed as optional alternatives.</div>
          <For each={VERSION_SETS}>
            {(set) => (
              <Choice<string>
                label={set.label}
                value={prefs.versions[set.key]}
                onPick={(v) => setVersion(set.key, v)}
                options={set.options}
              />
            )}
          </For>
          <div class="text-[11px] leading-snug text-sea-400">To skip filler entirely, turn off Filler &amp; Fun Pace under Filters.</div>
          <Choice<Prefs['liveActionPlacement']>
            label="Live Action"
            value={prefs.liveActionPlacement}
            onPick={(v) => setPrefs('liveActionPlacement', v)}
            options={[
              { value: 'arc', label: 'Next to each arc', title: 'Watch each episode where the guide places it (some reveal things early)' },
              { value: 'post-enies-lobby-arc', label: 'After Post-Enies Lobby', title: 'Watch it all once the earlier reveals are covered' },
              {
                value: 'thriller-bark-arc',
                label: 'After Thriller Bark',
                title: 'Safest: some Live Action episodes show things the anime only reveals by the end of Thriller Bark',
              },
            ]}
          />
          <Choice<boolean>
            label="Final Saga"
            value={prefs.splitFinalSaga}
            onPick={(v) => setPrefs('splitFinalSaga', v)}
            options={[
              { value: false, label: 'One saga' },
              { value: true, label: 'Egghead and Elbaph separate', title: 'List Egghead and Elbaph like the other sagas' },
            ]}
          />
          <Choice<boolean>
            label="Catch up"
            value={prefs.catchUpExtras}
            onPick={(v) => setPrefs('catchUpExtras', v)}
            options={[
              { value: true, label: 'Includes extras', title: 'Also marks the films, specials, Live Action and filler before that point' },
              { value: false, label: 'Main route only' },
            ]}
          />
        </div>
      </Show>
    </div>
  );
}
