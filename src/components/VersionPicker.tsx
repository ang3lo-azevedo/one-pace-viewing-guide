import { For, Show } from 'solid-js';
import { guide } from '../lib/guide';
import { prefs, setPrefs, setVersionPref, type Prefs } from '../store/prefs';

interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

/** A small inline version of a Settings choice, shown where it applies. */
export function InlineChoice<T>(props: { label: string; options: Option<T>[]; value: T; onPick: (v: T) => void; hint?: string }) {
  return (
    <div class="flex flex-wrap items-center gap-1.5 rounded-md bg-sea-100 px-2.5 py-1.5 text-xs dark:bg-sea-900/70">
      <span class="text-[10px] font-bold uppercase tracking-wide text-sea-400">{props.label}</span>
      <For each={props.options}>
        {(o) => (
          <button
            class="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors"
            classList={{
              'border-accent-500 bg-accent-500 text-white': props.value === o.value,
              'border-sea-300 text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300': props.value !== o.value,
            }}
            aria-pressed={props.value === o.value}
            title={o.title}
            onClick={(e) => {
              e.stopPropagation();
              props.onPick(o.value);
            }}
          >
            {o.label}
          </button>
        )}
      </For>
      <Show when={props.hint}>
        <span class="text-[11px] text-sea-400">{props.hint}</span>
      </Show>
    </div>
  );
}

const versionsByUid = new Map<string, Set<string>>();
for (const s of guide.sagas)
  for (const n of s.nodes) {
    const v = new Set(n.groups.flatMap((g) => (g.version ? [g.version.split(':')[0]] : [])));
    if (v.size) versionsByUid.set(n.uid, v);
  }

/** Version choices for the arc they affect (Fish-Man Island, G-8, Boat Piece). */
export default function VersionPicker(props: { node: { uid: string } }) {
  const sets = () => versionsByUid.get(props.node.uid);
  return (
    <Show when={sets()}>
      <Show when={sets()!.has('fishman')}>
        <InlineChoice<Prefs['fishmanVersion']>
          label="Watching"
          value={prefs.fishmanVersion}
          onPick={(v) => setVersionPref('fishmanVersion', v)}
          options={[
            { value: 'log', label: 'One Piece Log', title: 'The official 21-episode remaster' },
            { value: 'onepace', label: 'One Pace', title: 'The One Pace edit' },
          ]}
          hint="Also in Settings. The other version stays as an alternative."
        />
      </Show>
      <Show when={sets()!.has('filler')}>
        <InlineChoice<Prefs['fillerVersion']>
          label="Watching"
          value={prefs.fillerVersion}
          onPick={(v) => setVersionPref('fillerVersion', v)}
          options={[
            { value: 'funpace', label: 'Fun Pace', title: 'Paced cut of the filler' },
            { value: 'original', label: 'Original anime', title: 'The full original anime episodes' },
          ]}
          hint="Also in Settings. Applies to all filler with a Fun Pace cut."
        />
      </Show>
    </Show>
  );
}

/** Live Action placement, shown on the Live Action sections. */
export function LiveActionPicker() {
  return (
    <InlineChoice<Prefs['liveActionPlacement']>
      label="Live Action"
      value={prefs.liveActionPlacement}
      onPick={(v) => setPrefs('liveActionPlacement', v)}
      options={[
        { value: 'arc', label: 'Next to each arc' },
        { value: 'post-enies-lobby-arc', label: 'After Post-Enies Lobby' },
        { value: 'thriller-bark-arc', label: 'After Thriller Bark', title: 'Safest' },
      ]}
    />
  );
}

/** Final Saga layout, shown on the Final Saga. */
export function FinalSagaPicker() {
  return (
    <InlineChoice<boolean>
      label="Show as"
      value={prefs.splitFinalSaga}
      onPick={(v) => setPrefs('splitFinalSaga', v)}
      options={[
        { value: false, label: 'One saga' },
        { value: true, label: 'Egghead and Elbaph separate' },
      ]}
    />
  );
}
