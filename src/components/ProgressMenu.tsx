import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { clearAll, exportJSON, importJSON } from '../store/progress';

/** Header menu for backing up and restoring local progress. */
export default function ProgressMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  let fileInput: HTMLInputElement | undefined;

  const onDocClick = (e: MouseEvent) => {
    if (root && !root.contains(e.target as Node)) setOpen(false);
  };
  onMount(() => document.addEventListener('click', onDocClick));
  onCleanup(() => document.removeEventListener('click', onDocClick));

  function doExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `one-pace-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const merge = confirm('Merge with your current progress? Click Cancel to REPLACE it instead.');
      const n = importJSON(await file.text(), merge);
      alert(`Imported ${n} watched episodes.`);
    } catch (err) {
      alert('Could not import that file: ' + (err as Error).message);
    } finally {
      input.value = '';
      setOpen(false);
    }
  }

  const item = 'block w-full rounded-lg px-2 py-1.5 text-left hover:bg-sea-800';

  return (
    <div class="shrink-0 sm:relative" ref={root}>
      <button
        class="chip border-sea-600 font-semibold text-sea-200 hover:border-accent-400 hover:text-accent-400"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
        title="Back up or restore your progress"
      >
        Progress ▾
      </button>
      <Show when={open()}>
        <div class="absolute inset-x-3 z-40 mt-2 sm:inset-x-auto sm:right-0 sm:w-60 rounded-xl border border-sea-700 bg-sea-900 p-2 text-sm text-sea-100 shadow-xl">
          <div class="px-2 pb-2 text-xs text-sea-400">Progress is saved in this browser. Export it to move it to another device.</div>
          <button class={item} onClick={doExport}>
            ⭳ Export progress (.json)
          </button>
          <button class={item} onClick={() => fileInput?.click()}>
            ⭱ Import progress
          </button>
          <button
            class={`${item} text-red-400`}
            onClick={() => {
              if (confirm('Reset ALL watched progress in this browser? Your Trakt history is not touched.')) clearAll();
              setOpen(false);
            }}
          >
            ⟲ Reset progress
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" class="hidden" onChange={onFile} />
        </div>
      </Show>
    </div>
  );
}
