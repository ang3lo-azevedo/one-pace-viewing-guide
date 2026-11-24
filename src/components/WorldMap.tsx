import { For, Show, createMemo, createSignal } from 'solid-js';
import { flatEpisodes, guide } from '../lib/guide';
import { nextUp, revealEpisode } from '../lib/focus';
import { stats } from '../lib/stats';
import { prefs } from '../store/prefs';
import { wasOpen } from '../lib/restore';
import type { GuideNode } from '../types';

/**
 * A schematic map of the world (not to scale): East Blue, then the Grand Line from Reverse
 * Mountain, across the Red Line into the second half. Each place lists the arcs set there.
 * Spoiler-safe hides the places you have not reached yet.
 */
interface Place {
  name: string;
  x: number;
  y: number;
  arcs: string[];
  /** Part of the voyage line (side stories are pins only). */
  route?: boolean;
  /** Label below the pin instead of above. */
  below?: boolean;
}

const PLACES: Place[] = [
  { name: 'Foosha Village', x: 40, y: 200, arcs: ['romance-dawn-arc'], route: true, below: true },
  { name: 'Orange Town', x: 55, y: 130, arcs: ['orange-town-arc', 'the-adventures-of-buggy-s-crew-arc'], route: true },
  { name: 'Syrup Village', x: 100, y: 185, arcs: ['syrup-village-arc'], route: true, below: true },
  { name: "Gaimon's Island", x: 105, y: 95, arcs: ['gaimon-arc'], route: true },
  { name: 'Baratie', x: 150, y: 140, arcs: ['baratie-arc'], route: true },
  { name: 'Arlong Park', x: 170, y: 60, arcs: ['arlong-park-arc'], route: true },
  { name: 'Loguetown', x: 172, y: 215, arcs: ['loguetown-arc'], route: true, below: true },
  { name: 'Reverse Mountain', x: 232, y: 270, arcs: ['reverse-mountain-arc'], route: true, below: true },
  { name: 'Whisky Peak', x: 270, y: 245, arcs: ['whisky-peak-arc'], route: true },
  { name: 'Little Garden', x: 305, y: 295, arcs: ['little-garden-arc'], route: true, below: true },
  { name: 'Drum Island', x: 342, y: 245, arcs: ['drum-island-arc'], route: true },
  { name: 'Alabasta', x: 382, y: 295, arcs: ['alabasta-arc'], route: true, below: true },
  { name: 'Jaya', x: 418, y: 282, arcs: ['jaya-arc'], route: true, below: true },
  { name: 'Skypiea', x: 432, y: 165, arcs: ['skypiea-arc'], route: true },
  { name: 'G-8', x: 466, y: 295, arcs: ['g8-arc'], route: true, below: true },
  { name: 'Long Ring Long Land', x: 508, y: 250, arcs: ['long-ring-long-land-arc'], route: true },
  { name: 'Water 7', x: 560, y: 295, arcs: ['water-seven-arc', 'post-enies-lobby-arc'], route: true, below: true },
  { name: 'Enies Lobby', x: 610, y: 250, arcs: ['enies-lobby-arc'], route: true },
  { name: 'Thriller Bark', x: 642, y: 295, arcs: ['thriller-bark-arc'], route: true, below: true },
  { name: 'Sabaody', x: 684, y: 255, arcs: ['sabaody-archipelago-arc', 'return-to-sabaody-arc'], route: true },
  { name: 'Amazon Lily', x: 622, y: 334, arcs: ['amazon-lily-arc', 'post-war-arc'], route: true, below: true },
  { name: 'Impel Down', x: 672, y: 372, arcs: ['impel-down-arc'], route: true, below: true },
  { name: 'Marineford', x: 668, y: 185, arcs: ['marineford-arc'], route: true },
  { name: 'Mary Geoise', x: 720, y: 120, arcs: ['reverie-arc'] },
  { name: 'Fish-Man Island', x: 720, y: 345, arcs: ['fish-man-island-arc'], route: true, below: true },
  { name: 'Punk Hazard', x: 775, y: 250, arcs: ['punk-hazard-arc'], route: true },
  { name: 'Dressrosa', x: 835, y: 295, arcs: ['dressrosa-arc'], route: true, below: true },
  { name: 'Zou', x: 895, y: 250, arcs: ['zou-arc'], route: true },
  { name: 'Whole Cake Island', x: 955, y: 295, arcs: ['whole-cake-island-arc'], route: true, below: true },
  { name: 'Wano', x: 1015, y: 250, arcs: ['wano-country-arc'], route: true },
  { name: 'Egghead', x: 1075, y: 295, arcs: ['egghead-arc'], route: true, below: true },
  { name: 'Elbaph', x: 1135, y: 250, arcs: ['elbaph-arc'], route: true },
];

/** Story order of the route (by the first arc of each place). */
const nodeById = new Map<string, GuideNode>();
for (const s of guide.sagas) for (const n of s.nodes) if (!nodeById.has(n.id)) nodeById.set(n.id, n);
const order = new Map<string, number>();
flatEpisodes.forEach((f, i) => order.has(f.node.id) || order.set(f.node.id, i));
const ROUTE = PLACES.filter((p) => p.route).sort((a, b) => (order.get(a.arcs[0]) ?? 0) - (order.get(b.arcs[0]) ?? 0));

const W = 1200;
const H = 420;
const GL_TOP = 222; // Grand Line between the Calm Belts
const GL_BOTTOM = 318;

type State = 'done' | 'here' | 'started' | 'ahead';

export default function WorldMap() {
  const [open, setOpen] = createSignal(wasOpen('map') ?? false);
  const currentArc = createMemo(() => {
    const r = nextUp();
    return r ? guide.sagas.flatMap((s) => s.nodes).find((n) => n.uid === r.nodeUid)?.id ?? null : null;
  });

  const arcProgress = (id: string) => {
    const n = nodeById.get(id);
    return n ? stats().perNode[n.uid] : undefined;
  };

  const stateOf = (p: Place): State => {
    if (currentArc() && p.arcs.includes(currentArc()!)) return 'here';
    const progs = p.arcs.map(arcProgress).filter((x) => x && x.total);
    if (progs.length && progs.every((x) => x!.watched === x!.total)) return 'done';
    if (progs.some((x) => x!.watched > 0)) return 'started';
    return 'ahead';
  };

  /** Spoiler-safe: only the places you have reached. */
  const shown = (p: Place) => !prefs.spoilerSafe || stateOf(p) !== 'ahead';
  const here = createMemo(() => PLACES.find((p) => stateOf(p) === 'here') ?? null);
  const [picked, setPicked] = createSignal<Place | null>(null);
  const selected = () => picked() ?? here();

  // The voyage so far: route places reached, in story order, ending where you are.
  const sailed = createMemo(() => ROUTE.filter((p) => stateOf(p) !== 'ahead'));
  const path = (pts: Place[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  // Fog over the part of the world you have not reached (spoiler-safe).
  const fogFrom = () => Math.max(250, ...sailed().map((p) => p.x)) + 40;
  const reachedNewWorld = () => !prefs.spoilerSafe || sailed().some((p) => p.x > 730);

  const goTo = (arcId: string) => {
    const n = nodeById.get(arcId);
    const first = n && flatEpisodes.find((f) => f.node.uid === n.uid && !f.group.isAlternative);
    if (first) revealEpisode(first.ep.id);
  };

  return (
    <div class="card overflow-hidden" id="world-map" data-open-key={open() ? 'map' : undefined} data-open-title="World map">
      <button
        class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-sea-100 dark:hover:bg-sea-800/40"
        data-toggle
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
      >
        <span class="text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
          ▶
        </span>
        <span class="font-display text-sm font-extrabold uppercase tracking-wide text-accent-600 dark:text-accent-400">World map</span>
        <span class="ml-auto hidden truncate text-[11px] text-sea-500 sm:inline dark:text-sea-400">
          {here() ? `You are at ${here()!.name}` : sailed().length ? 'Voyage complete' : 'Set sail from Foosha Village'}
          {' · '}
          {sailed().length}/{ROUTE.length} places
        </span>
      </button>

      <Show when={open()}>
        <div class="border-t border-sea-200 dark:border-sea-800">
          <div class="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} class="block min-w-[760px] w-full select-none" role="img" aria-label="World map of the voyage">
              <defs>
                <pattern id="calm" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" class="stroke-sea-300/50 dark:stroke-sea-700/60" stroke-width="3" />
                </pattern>
                <linearGradient id="fog" x1="0" x2="1">
                  <stop offset="0" stop-color="var(--map-fog)" stop-opacity="0" />
                  <stop offset="0.12" stop-color="var(--map-fog)" stop-opacity="0.92" />
                  <stop offset="1" stop-color="var(--map-fog)" stop-opacity="0.97" />
                </linearGradient>
              </defs>

              {/* Sea */}
              <rect width={W} height={H} class="fill-accent-300/15 dark:fill-sea-950" />
              {/* Calm Belts and the Grand Line */}
              <rect x="200" y={GL_TOP - 22} width={W - 200} height="22" fill="url(#calm)" />
              <rect x="200" y={GL_BOTTOM} width={W - 200} height="22" fill="url(#calm)" />
              <rect x="200" y={GL_TOP} width={W - 200} height={GL_BOTTOM - GL_TOP} class="fill-accent-400/15 dark:fill-accent-700/15" />
              {/* Red Line: at Reverse Mountain and in the middle of the Grand Line */}
              <rect x="196" y="0" width="16" height={H} rx="4" class="fill-red-800/70 dark:fill-red-900/80" />
              <rect x="712" y="0" width="16" height={H} rx="4" class="fill-red-800/70 dark:fill-red-900/80" />

              {/* Sea names */}
              <g class="fill-sea-500 dark:fill-sea-500" font-size="13" font-weight="800" letter-spacing="3">
                <text x="20" y="34">EAST BLUE</text>
                <text x="470" y={GL_TOP - 7} font-size="10" letter-spacing="2" class="fill-sea-400 dark:fill-sea-600">CALM BELT</text>
                <text x="470" y={GL_BOTTOM + 15} font-size="10" letter-spacing="2" class="fill-sea-400 dark:fill-sea-600">CALM BELT</text>
                <text x="380" y="404">GRAND LINE</text>
                <text x="204" y="410" font-size="10" letter-spacing="2" transform="rotate(-90 204 410)" class="fill-red-200/80">RED LINE</text>
                <Show when={reachedNewWorld()}>
                  <text x="900" y="404">NEW WORLD</text>
                </Show>
              </g>

              {/* Fog over what is ahead (spoiler-safe) */}
              <Show when={prefs.spoilerSafe}>
                <rect x={fogFrom() - 40} y="0" width={W - fogFrom() + 40} height={H} fill="url(#fog)" />
                <text x={Math.min(W - 120, fogFrom() + 30)} y="180" font-size="13" font-style="italic" class="fill-sea-400 dark:fill-sea-500">
                  Uncharted waters
                </text>
              </Show>

              {/* The whole route ahead, faint (spoilers off) */}
              <Show when={!prefs.spoilerSafe}>
                <path d={path(ROUTE)} fill="none" stroke-width="1.5" stroke-dasharray="3 5" class="stroke-sea-400/70 dark:stroke-sea-600" />
              </Show>
              {/* The voyage so far */}
              <path d={path(sailed())} fill="none" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round" class="stroke-strawhat-500" />

              {/* Places */}
              <For each={PLACES}>
                {(p) => (
                  <Show when={shown(p)}>
                    <g
                      class="cursor-pointer"
                      role="button"
                      tabindex="0"
                      aria-label={p.name}
                      onClick={() => setPicked(p)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPicked(p))}
                    >
                      <title>{p.name}</title>
                      <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                      <Show when={stateOf(p) === 'here'}>
                        <circle cx={p.x} cy={p.y} r="11" class="map-pulse fill-none stroke-strawhat-500" stroke-width="2" />
                      </Show>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={selected() === p ? 7 : 5.5}
                        stroke-width="2"
                        classList={{
                          'fill-accent-500 stroke-white dark:stroke-sea-950': stateOf(p) === 'done',
                          'fill-strawhat-500 stroke-white dark:stroke-sea-950': stateOf(p) === 'here',
                          'fill-accent-300 stroke-accent-600': stateOf(p) === 'started',
                          'fill-sea-50 stroke-sea-400 dark:fill-sea-900 dark:stroke-sea-500': stateOf(p) === 'ahead',
                        }}
                      />
                      <text
                        x={p.x}
                        y={p.below ? p.y + 20 : p.y - 11}
                        text-anchor="middle"
                        font-size="10.5"
                        font-weight={selected() === p || stateOf(p) === 'here' ? 800 : 600}
                        class="map-label"
                        classList={{
                          'fill-sea-800 dark:fill-sea-100': stateOf(p) !== 'ahead',
                          'fill-sea-400 dark:fill-sea-500': stateOf(p) === 'ahead',
                        }}
                      >
                        {p.name}
                      </text>
                    </g>
                  </Show>
                )}
              </For>
            </svg>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sea-200 px-4 py-2 text-[11px] text-sea-500 dark:border-sea-800 dark:text-sea-400">
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full bg-strawhat-500" /> You are here</span>
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full bg-accent-500" /> Done</span>
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full border border-accent-600 bg-accent-300" /> Started</span>
            <Show when={!prefs.spoilerSafe}>
              <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full border border-sea-400 bg-sea-50 dark:bg-sea-900" /> Ahead</span>
            </Show>
            <span class="ml-auto">
              {prefs.spoilerSafe ? 'Spoiler-safe: places appear as you reach them.' : 'Not to scale.'}
            </span>
          </div>

          <Show when={selected()}>
            {(p) => (
              <div class="space-y-1.5 border-t border-sea-200 px-4 py-3 dark:border-sea-800">
                <div class="font-display text-sm font-extrabold text-sea-800 dark:text-sea-100">{p().name}</div>
                <For each={p().arcs.filter((id) => nodeById.has(id) && arcProgress(id))}>
                  {(id) => {
                    const prog = () => arcProgress(id)!;
                    return (
                      <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="font-semibold text-sea-700 dark:text-sea-200">{nodeById.get(id)!.title}</span>
                        <span class="text-sea-500 dark:text-sea-400">
                          {prog().watched}/{prog().total} · {Math.round(prog().minTotal ? (prog().minDone / prog().minTotal) * 100 : 0)}%
                        </span>
                        <button
                          class="chip ml-auto border-sea-300 text-sea-600 hover:border-accent-400 hover:text-accent-600 dark:border-sea-600 dark:text-sea-300"
                          onClick={() => goTo(id)}
                        >
                          Go to arc
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
