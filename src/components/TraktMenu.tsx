import { Show, createSignal, onCleanup, onMount } from 'solid-js';

// Re-render relative times once a minute.
const [now, setNow] = createSignal(Date.now());
setInterval(() => setNow(Date.now()), 60_000);

function ago(t: number): string {
  const m = Math.round((now() - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
import { traktConfigured } from '../config';
import { progress } from '../store/progress';
import { connect, disconnect, isConnected, pullFromTrakt, pushToTrakt, trakt } from '../store/trakt';

function Avatar(props: { size: string }) {
  return (
    <Show
      when={trakt.avatar}
      fallback={
        <span class={`${props.size} flex shrink-0 items-center justify-center rounded-full bg-[#ed1c24] text-xs font-black text-white`}>
          {(trakt.username ?? 'T').slice(0, 1).toUpperCase()}
        </span>
      }
    >
      <img src={trakt.avatar!} alt="" class={`${props.size} shrink-0 rounded-full object-cover`} referrerpolicy="no-referrer" />
    </Show>
  );
}

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
            class="chip gap-1.5 border-[#ed1c24]/60 py-0.5 pl-0.5 font-semibold text-[#ff5a5f] hover:bg-[#ed1c24]/10"
            onClick={() => setOpen(!open())}
            aria-expanded={open()}
            title={`Signed in to Trakt as @${trakt.username ?? '…'}`}
          >
            <Avatar size="h-6 w-6" />
            <span class="max-w-[9rem] truncate">{trakt.username ? `@${trakt.username}` : 'Trakt'}</span> ▾
          </button>
        </Show>

        <Show when={open() && isConnected()}>
          <div class="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-sea-700 bg-sea-900 p-2 text-sm text-sea-100 shadow-xl">
            <div class="mb-2 flex items-center gap-2.5 rounded-lg bg-sea-950/60 p-2">
              <Avatar size="h-10 w-10" />
              <div class="min-w-0">
                <div class="text-[10px] uppercase tracking-wide text-sea-400">Signed in to Trakt as</div>
                <div class="truncate font-bold text-sea-50">{trakt.name ?? trakt.username ?? 'Loading…'}</div>
                <Show when={trakt.username}>
                  <a
                    href={`https://trakt.tv/users/${trakt.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-[#ff5a5f] hover:underline"
                  >
                    @{trakt.username} ↗
                  </a>
                </Show>
              </div>
            </div>
            <div class="px-2 pb-2 text-xs text-sea-400">
              <div class="flex items-center justify-between gap-2">
                <span>
                  {busy() ? 'Syncing…' : trakt.lastSyncedAt ? `Last synced ${ago(trakt.lastSyncedAt)}` : 'Not synced yet'}
                </span>
                <button
                  class="rounded-md border border-[#ed1c24]/50 px-2 py-0.5 font-semibold text-[#ff5a5f] hover:bg-[#ed1c24]/10 disabled:opacity-50"
                  onClick={pullFromTrakt}
                  disabled={busy()}
                >
                  Sync now
                </button>
              </div>
              <div class="mt-1.5">
                Your changes are sent to Trakt right away. Watched episodes are pulled from Trakt when the page opens
                and when you come back to this tab (at most every 5 minutes).
              </div>
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
