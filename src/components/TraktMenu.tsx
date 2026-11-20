import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { traktConfigured } from '../config';
import { progress } from '../store/progress';
import { connect, disconnect, isConnected, pullFromTrakt, pushToTrakt, trakt } from '../store/trakt';

/** Header control: "Connect Trakt" when signed out, an account menu when signed in. */
export default function TraktMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const onDocClick = (e: MouseEvent) => {
    if (root && !root.contains(e.target as Node)) setOpen(false);
  };
  onMount(() => document.addEventListener('click', onDocClick));
  onCleanup(() => document.removeEventListener('click', onDocClick));

  const busy = () => trakt.status !== 'idle';

  return (
    <Show when={traktConfigured()}>
      <div class="relative shrink-0" ref={root}>
        <Show
          when={isConnected()}
          fallback={
            <button
              class="chip border-[#ed1c24]/60 font-semibold text-[#ff5a5f] hover:bg-[#ed1c24]/10"
              onClick={connect}
              disabled={busy()}
              title="Sign in with Trakt to sync watched episodes"
            >
              {trakt.status === 'connecting' ? 'Connecting…' : 'Connect Trakt'}
            </button>
          }
        >
          <button
            class="chip border-[#ed1c24]/60 font-semibold text-[#ff5a5f] hover:bg-[#ed1c24]/10"
            onClick={() => setOpen(!open())}
            aria-expanded={open()}
          >
            ● {trakt.username ?? 'Trakt'} ▾
          </button>
        </Show>

        <Show when={open() && isConnected()}>
          <div class="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-sea-700 bg-sea-900 p-2 text-sm text-sea-100 shadow-xl">
            <div class="px-2 pb-2 text-xs text-sea-400">
              Synced with Trakt as <b class="text-sea-100">{trakt.username ?? 'you'}</b>. Checking an episode updates
              Trakt automatically.
            </div>
            <button
              class="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-sea-800 disabled:opacity-50"
              onClick={pullFromTrakt}
              disabled={busy()}
            >
              ⭳ Pull watched from Trakt
            </button>
            <button
              class="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-sea-800 disabled:opacity-50"
              onClick={() => pushToTrakt(Object.keys(progress.watched))}
              disabled={busy()}
            >
              ⭱ Push my progress to Trakt
            </button>
            <button
              class="block w-full rounded-lg px-2 py-1.5 text-left text-sea-400 hover:bg-sea-800"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
            <Show when={busy()}>
              <div class="px-2 pt-1 text-xs text-accent-300">Syncing…</div>
            </Show>
            <Show when={trakt.lastMessage}>
              <div class="border-t border-sea-800 px-2 pt-2 text-xs text-sea-400">{trakt.lastMessage}</div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
