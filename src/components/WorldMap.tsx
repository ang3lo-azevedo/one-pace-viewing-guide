import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js';
import { flatEpisodes, guide } from '../lib/guide';
import { nextUp, revealEpisode } from '../lib/focus';
import { fmtDuration, stats } from '../lib/stats';
import { prefs } from '../store/prefs';
import { wasOpen } from '../lib/restore';
import type { GuideNode } from '../types';

/**
 * A drawn map of the world (not to scale): East Blue, then the Grand Line from Reverse
 * Mountain, across the Red Line into the second half. Each place lists the arcs set there and
 * its island grows with how long those arcs are. Drag to move, scroll (Ctrl + scroll on the
 * page) or pinch to zoom. Spoiler-safe hides the places you have not reached yet.
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
  /** In the sky, under the sea, or on the Red Line itself (no island drawn). */
  kind?: 'sky' | 'deep' | 'line';
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
  { name: 'Skypiea', x: 432, y: 165, arcs: ['skypiea-arc'], route: true, kind: 'sky' },
  { name: 'G-8', x: 466, y: 295, arcs: ['g8-arc'], route: true, below: true },
  { name: 'Long Ring Long Land', x: 508, y: 250, arcs: ['long-ring-long-land-arc'], route: true },
  { name: 'Water 7', x: 560, y: 295, arcs: ['water-seven-arc', 'post-enies-lobby-arc'], route: true, below: true },
  { name: 'Enies Lobby', x: 610, y: 250, arcs: ['enies-lobby-arc'], route: true },
  { name: 'Thriller Bark', x: 642, y: 295, arcs: ['thriller-bark-arc'], route: true, below: true },
  { name: 'Sabaody', x: 684, y: 255, arcs: ['sabaody-archipelago-arc', 'return-to-sabaody-arc'], route: true },
  { name: 'Amazon Lily', x: 622, y: 334, arcs: ['amazon-lily-arc', 'post-war-arc'], route: true, below: true },
  { name: 'Impel Down', x: 672, y: 372, arcs: ['impel-down-arc'], route: true, kind: 'deep', below: true },
  { name: 'Marineford', x: 668, y: 185, arcs: ['marineford-arc'], route: true },
  { name: 'Mary Geoise', x: 720, y: 120, arcs: ['reverie-arc'], kind: 'line' },
  { name: 'Fish-Man Island', x: 720, y: 345, arcs: ['fish-man-island-arc'], route: true, kind: 'deep', below: true },
  { name: 'Punk Hazard', x: 775, y: 250, arcs: ['punk-hazard-arc'], route: true },
  { name: 'Dressrosa', x: 835, y: 295, arcs: ['dressrosa-arc'], route: true, below: true },
  { name: 'Zou', x: 895, y: 250, arcs: ['zou-arc'], route: true },
  { name: 'Whole Cake Island', x: 955, y: 295, arcs: ['whole-cake-island-arc'], route: true, below: true },
  { name: 'Wano', x: 1015, y: 250, arcs: ['wano-country-arc'], route: true },
  { name: 'Egghead', x: 1075, y: 295, arcs: ['egghead-arc'], route: true, below: true },
  { name: 'Elbaph', x: 1135, y: 250, arcs: ['elbaph-arc'], route: true },
];

const nodeById = new Map<string, GuideNode>();
for (const s of guide.sagas) for (const n of s.nodes) if (!nodeById.has(n.id)) nodeById.set(n.id, n);
/** Story order of the route (by the first arc of each place). */
const order = new Map<string, number>();
flatEpisodes.forEach((f, i) => order.has(f.node.id) || order.set(f.node.id, i));
const ROUTE = PLACES.filter((p) => p.route).sort((a, b) => (order.get(a.arcs[0]) ?? 0) - (order.get(b.arcs[0]) ?? 0));

const W = 1200;
const H = 420;
const GL_TOP = 222; // Grand Line between the Calm Belts
const GL_BOTTOM = 318;
const RED_LINES = [204, 720]; // centre of the Red Line at Reverse Mountain and in the middle
const MAX_K = 8;

// ---- Drawing helpers (deterministic, so islands keep their shape) ----

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A closed smooth blob around (x, y). */
function blob(x: number, y: number, r: number, seed: string, points = 11, rough = 0.45) {
  const rand = rng(seed);
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2 + rand() * 0.3;
    const rr = r * (1 - rough / 2 + rand() * rough);
    return [x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.85];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[points - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
  for (let i = 0; i < points; i++) {
    const m = mid(pts[i], pts[(i + 1) % points]);
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/** The Red Line: a rugged band of land from top to bottom, cut by the canal at Reverse Mountain. */
function redLine(cx: number, seed: string) {
  const rand = rng(seed);
  const left: string[] = [];
  const right: string[] = [];
  for (let y = -H; y <= H * 2; y += 14) {
    left.push(`${(cx - 12 - rand() * 7).toFixed(1)} ${y}`);
    right.push(`${(cx + 12 + rand() * 7).toFixed(1)} ${y}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
}

/** Small uninhabited islets scattered over the seas, for texture. */
const ISLETS = (() => {
  const rand = rng('islets');
  const out: { d: string; x: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const x = rand() * W;
    const y = rand() * H;
    if (RED_LINES.some((c) => Math.abs(x - c) < 30)) continue;
    if (PLACES.some((p) => Math.hypot(p.x - x, p.y - y) < 30)) continue;
    out.push({ d: blob(x, y, 1.5 + rand() * 3, `i${i}`, 7, 0.6), x });
  }
  return out;
})();

type State = 'done' | 'here' | 'started' | 'ahead';

export default function WorldMap() {
  const [open, setOpen] = createSignal(wasOpen('map') ?? false);
  const [big, setBig] = createSignal(false);

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
  /** Island size from the time its arcs take. */
  const sizeOf = (p: Place) => {
    const min = p.arcs.reduce((a, id) => a + (arcProgress(id)?.minTotal ?? 0), 0);
    return Math.max(6, Math.min(20, 4 + Math.sqrt(min) / 2.2));
  };

  /** Spoiler-safe: only the places you have reached. */
  const shown = (p: Place) => !prefs.spoilerSafe || stateOf(p) !== 'ahead';
  const here = createMemo(() => PLACES.find((p) => stateOf(p) === 'here') ?? null);
  const sailed = createMemo(() => ROUTE.filter((p) => stateOf(p) !== 'ahead'));
  const shipAt = () => here() ?? sailed()[sailed().length - 1] ?? ROUTE[0];
  const path = (pts: Place[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const fogFrom = () => Math.max(250, ...sailed().map((p) => p.x)) + 45;
  const reachedNewWorld = () => !prefs.spoilerSafe || sailed().some((p) => p.x > 730);

  // ---- View: the visible part of the map (world units) and the size of the box on screen ----
  let box!: HTMLDivElement;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const [view, setView] = createSignal({ x: 0, y: 0, k: 1 });
  const viewW = () => W / view().k;
  const viewH = () => (size().w ? (viewW() * size().h) / size().w : H);
  /** Screen pixels per world unit. */
  const scale = () => (size().w ? size().w / viewW() : 1);

  const clamp = (v: { x: number; y: number; k: number }) => {
    const k = Math.max(1, Math.min(MAX_K, v.k));
    const vw = W / k;
    const vh = size().w ? (vw * size().h) / size().w : H;
    const x = Math.max(-vw * 0.1, Math.min(W - vw * 0.9, v.x));
    const y = vh >= H ? (H - vh) / 2 : Math.max(-vh * 0.1, Math.min(H - vh * 0.9, v.y));
    return { x, y, k };
  };

  let anim = 0;
  /** Move the view, smoothly unless `now`. */
  const go = (to: { x: number; y: number; k: number }, now = false) => {
    cancelAnimationFrame(anim);
    const target = clamp(to);
    if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(target);
    const from = view();
    const t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / 450);
      const e = 1 - Math.pow(1 - u, 3);
      setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  const centreOn = (p: { x: number; y: number }, k = view().k, now = false) => {
    const vw = W / k;
    const vh = size().w ? (vw * size().h) / size().w : H;
    go({ x: p.x - vw / 2, y: p.y - vh / 2, k }, now);
  };
  const zoomAt = (factor: number, sx = size().w / 2, sy = size().h / 2, now = true) => {
    const v = view();
    const k = Math.max(1, Math.min(MAX_K, v.k * factor));
    const wx = v.x + sx / scale();
    const wy = v.y + sy / scale();
    const s2 = size().w / (W / k);
    go({ x: wx - sx / s2, y: wy - sy / s2, k }, now);
  };
  const fitAll = (now = false) => go({ x: -20, y: 0, k: 1 }, now);
  /** Readable start: the whole map on wide screens, zoomed on your place on phones. */
  const home = (now = false) => {
    const fitScale = size().w / W;
    if (fitScale >= 0.6) return fitAll(now);
    centreOn(shipAt(), (0.95 * W) / size().w, now);
  };

  // Track the box size; set the first view once it is known.
  let placed = false;
  const observe = (el: HTMLDivElement) => {
    box = el;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      if (!placed && el.clientWidth) {
        placed = true;
        home(true);
      } else setView((v) => clamp(v));
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  };
  createEffect(on(open, (o) => !o && (placed = false)));
  createEffect(on(big, () => requestAnimationFrame(() => home(true)), { defer: true }));

  // Escape closes the full-screen map; the page does not scroll behind it.
  createEffect(() => {
    if (!big()) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    });
  });

  // ---- Gestures: drag to pan, wheel / pinch to zoom ----
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = false;
  let pinch: { d: number; cx: number; cy: number } | null = null;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    // On the page, one finger scrolls the page; the full-screen map takes every touch.
    if (e.pointerType === 'touch' && !big()) return;
    pointers.set(e.pointerId, local(e));
    moved = false;
    cancelAnimationFrame(anim);
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    if (pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) (e.currentTarget as Element).setPointerCapture(e.pointerId);
      moved = true;
      const v = view();
      setView(clamp({ x: v.x - dx / scale(), y: v.y - dy / scale(), k: v.k }));
      pointers.set(e.pointerId, cur);
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (pinch) {
        const v = view();
        setView(clamp({ x: v.x - (cx - pinch.cx) / scale(), y: v.y - (cy - pinch.cy) / scale(), k: v.k }));
        zoomAt(d / pinch.d, cx, cy);
      }
      pinch = { d, cx, cy };
      moved = true;
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  const onWheel = (e: WheelEvent) => {
    // On the page the wheel scrolls; Ctrl + wheel (or any wheel in full screen) zooms.
    if (!big() && !e.ctrlKey) {
      setHint(true);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => setHint(false), 1400);
      return;
    }
    e.preventDefault();
    const p = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0025), p.x, p.y);
  };
  const [hint, setHint] = createSignal(false);
  let hintTimer: ReturnType<typeof setTimeout>;

  // ---- Places: hover shows a card, a click keeps it ----
  const [hovered, setHovered] = createSignal<Place | null>(null);
  const [picked, setPicked] = createSignal<Place | null>(null);
  const card = () => hovered() ?? picked();
  const pick = (p: Place) => {
    if (moved) return;
    setPicked(p);
    if (view().k < 2) centreOn(p, 2.2);
  };
  const goTo = (arcId: string) => {
    const n = nodeById.get(arcId);
    const first = n && flatEpisodes.find((f) => f.node.uid === n.uid && !f.group.isAlternative);
    if (!first) return;
    setBig(false);
    revealEpisode(first.ep.id);
  };

  /** Labels: constant size on screen once zoomed in; hidden when too small to read. */
  const labelSize = () => 11 / Math.max(scale(), 1);
  const showLabel = (p: Place) => scale() * labelSize() >= 7 || p === card() || stateOf(p) === 'here';
  const pinR = (p: Place) => (card() === p ? 7 : 5.5) / Math.max(1, scale() / 1.2);

  const cardPos = createMemo(() => {
    const p = card();
    if (!p) return null;
    const v = view();
    const sx = (p.x - v.x) * scale();
    const sy = (p.y - v.y) * scale();
    const left = Math.max(8, Math.min(size().w - 268, sx - 130));
    return sy > size().h / 2 ? { left, bottom: size().h - sy + 16 } : { left, top: sy + 16 };
  });

  const Btn = (props: { onClick: () => void; title: string; children: any }) => (
    <button
      class="grid size-8 place-items-center rounded-md border border-sea-300 bg-white/90 text-sm font-bold text-sea-700 shadow-sm hover:border-accent-400 hover:text-accent-600 dark:border-sea-700 dark:bg-sea-900/90 dark:text-sea-200"
      title={props.title}
      aria-label={props.title}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );

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
        <div
          class="border-t border-sea-200 dark:border-sea-800"
          classList={{ 'fixed inset-0 z-50 flex flex-col border-0 bg-[var(--card-bg)]': big() }}
        >
          <div
            ref={observe}
            class="map-box relative overflow-hidden"
            classList={{ 'h-[clamp(300px,42vw,500px)]': !big(), 'flex-1 touch-none': big(), 'cursor-grab': true }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={onWheel}
            onClick={() => !moved && setPicked(null)}
          >
            <svg
              viewBox={`${view().x} ${view().y} ${viewW()} ${viewH()}`}
              class="absolute inset-0 size-full select-none"
              role="img"
              aria-label="World map of the voyage"
            >
              <defs>
                <pattern id="calm" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" class="stroke-sea-300/50 dark:stroke-sea-700/60" stroke-width="3" />
                </pattern>
                <pattern id="waves" width="40" height="22" patternUnits="userSpaceOnUse">
                  <path d="M2 12 q5 -5 10 0 t10 0" fill="none" class="stroke-accent-600/10 dark:stroke-accent-300/[0.06]" stroke-width="1" />
                </pattern>
                <linearGradient id="fog" x1="0" x2="1">
                  <stop offset="0" stop-color="var(--map-fog)" stop-opacity="0" />
                  <stop offset="0.1" stop-color="var(--map-fog)" stop-opacity="0.9" />
                  <stop offset="1" stop-color="var(--map-fog)" stop-opacity="0.97" />
                </linearGradient>
              </defs>

              {/* Sea, waves, Calm Belts and the Grand Line (drawn past the edges for panning) */}
              <rect x={-W} y={-H} width={W * 3} height={H * 3} class="fill-[#cfe6f2] dark:fill-[#10232e]" />
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#waves)" />
              <rect x="212" y={GL_TOP - 24} width={W * 2} height="24" fill="url(#calm)" />
              <rect x="212" y={GL_BOTTOM} width={W * 2} height="24" fill="url(#calm)" />
              <rect x="212" y={GL_TOP} width={W * 2} height={GL_BOTTOM - GL_TOP} class="fill-[#b9dcee] dark:fill-[#15303e]" />

              {/* Small islets */}
              <For each={ISLETS}>{(i) => <path d={i.d} class="fill-[#9cc49a] dark:fill-[#2c4a3a]" />}</For>

              {/* Red Line, with the canal over Reverse Mountain */}
              <For each={RED_LINES}>
                {(cx, i) => <path d={redLine(cx, `rl${i()}`)} class="fill-[#b5544c] stroke-[#8e3b35] dark:fill-[#6e2a27] dark:stroke-[#4f1c1a]" stroke-width="1" />}
              </For>
              <path d={`M${RED_LINES[0] - 24} 270 L${RED_LINES[0] + 24} 270`} stroke-width="5" stroke-linecap="round" class="stroke-[#b9dcee] dark:stroke-[#15303e]" />
              <path d={`M${RED_LINES[0] - 18} 200 Q${RED_LINES[0]} 262 ${RED_LINES[0]} 270`} fill="none" stroke-width="3.5" class="stroke-[#b9dcee] dark:stroke-[#15303e]" />

              {/* Sea names */}
              <g font-weight="800" letter-spacing="4" class="fill-[#5a8aa3]/70 dark:fill-[#4d7488]">
                <text x="20" y="32" font-size="14">EAST BLUE</text>
                <text x="390" y={GL_TOP - 8} font-size="9" letter-spacing="3">CALM BELT</text>
                <text x="390" y={GL_BOTTOM + 16} font-size="9" letter-spacing="3">CALM BELT</text>
                <text x="380" y="405" font-size="14">GRAND LINE</text>
                <text x={RED_LINES[0] + 4} y="405" font-size="8" letter-spacing="2" transform={`rotate(-90 ${RED_LINES[0] + 4} 405)`} class="fill-white/70">
                  RED LINE
                </text>
                <Show when={reachedNewWorld()}>
                  <text x="900" y="405" font-size="14">NEW WORLD</text>
                </Show>
              </g>

              {/* The whole route ahead, faint (spoilers off) */}
              <Show when={!prefs.spoilerSafe}>
                <path d={path(ROUTE)} fill="none" stroke-width="1.5" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" class="stroke-sea-500/60" />
              </Show>

              {/* Islands */}
              <For each={PLACES}>
                {(p) => (
                  <Show when={shown(p) && p.kind !== 'line'}>
                    <Show
                      when={p.kind === 'deep'}
                      fallback={
                        <path
                          d={blob(p.x, p.y, sizeOf(p), p.name)}
                          class="map-island"
                          classList={{
                            'fill-white/90 stroke-sea-300 dark:fill-sea-200/80': p.kind === 'sky',
                            'fill-[#8fbf7f] stroke-[#5f8f55] dark:fill-[#3f6b4a] dark:stroke-[#2b4d34]': p.kind !== 'sky' && stateOf(p) !== 'ahead',
                            'fill-[#b8c4b4] stroke-[#97a594] dark:fill-[#34433c] dark:stroke-[#2a3631]': p.kind !== 'sky' && stateOf(p) === 'ahead',
                          }}
                          stroke-width="1"
                        />
                      }
                    >
                      <path d={blob(p.x, p.y, sizeOf(p), p.name)} fill="none" stroke-width="1.2" stroke-dasharray="3 3" class="stroke-accent-700/50 dark:stroke-accent-300/40" />
                    </Show>
                  </Show>
                )}
              </For>

              {/* The voyage so far */}
              <path d={path(sailed())} fill="none" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round" vector-effect="non-scaling-stroke" class="map-route stroke-strawhat-500" />

              {/* Fog over what is ahead (spoiler-safe) */}
              <Show when={prefs.spoilerSafe}>
                <rect x={fogFrom() - 40} y={-H} width={W * 2} height={H * 3} fill="url(#fog)" />
                <text x={Math.min(W - 140, fogFrom() + 30)} y="175" font-size="14" font-style="italic" class="fill-sea-400 dark:fill-sea-500">
                  Uncharted waters
                </text>
              </Show>

              {/* Pins and names */}
              <For each={PLACES}>
                {(p) => (
                  <Show when={shown(p)}>
                    <g
                      class="cursor-pointer outline-none"
                      role="button"
                      tabindex="0"
                      aria-label={p.name}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(p)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={() => setHovered(p)}
                      onBlur={() => setHovered(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        pick(p);
                      }}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(p))}
                    >
                      <circle cx={p.x} cy={p.y} r={Math.max(sizeOf(p), 14 / scale())} fill="transparent" />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={pinR(p)}
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                        classList={{
                          'fill-accent-500 stroke-white dark:stroke-sea-950': stateOf(p) === 'done',
                          'fill-strawhat-500 stroke-white dark:stroke-sea-950': stateOf(p) === 'here',
                          'fill-accent-300 stroke-accent-600': stateOf(p) === 'started',
                          'fill-sea-50 stroke-sea-400 dark:fill-sea-900 dark:stroke-sea-500': stateOf(p) === 'ahead',
                        }}
                      />
                      <Show when={showLabel(p)}>
                        <text
                          x={p.x}
                          y={p.below ? p.y + Math.max(sizeOf(p) * 0.85, 8) + labelSize() : p.y - Math.max(sizeOf(p) * 0.85, 8) - labelSize() * 0.35}
                          text-anchor="middle"
                          font-size={String(labelSize())}
                          font-weight={card() === p || stateOf(p) === 'here' ? 800 : 650}
                          class="map-label"
                          classList={{
                            'fill-sea-900 dark:fill-sea-50': stateOf(p) !== 'ahead',
                            'fill-sea-500 dark:fill-sea-400': stateOf(p) === 'ahead',
                          }}
                        >
                          {p.name}
                        </text>
                      </Show>
                    </g>
                  </Show>
                )}
              </For>

              {/* Your ship, where you are */}
              <g
                class="pointer-events-none"
                style={{
                  transform: `translate(${shipAt().x + 10 / Math.max(1, scale())}px, ${shipAt().y - 3 / Math.max(1, scale())}px) scale(${1.6 / Math.max(1, scale() / 1.2)})`,
                  transition: 'transform 0.9s ease-in-out',
                }}
              >
                <g class="map-ship">
                  <path d="M-9 0 L9 0 L6 5 L-6 5 Z" class="fill-[#7a4a26] stroke-[#4e2e16]" stroke-width="0.8" />
                  <path d="M0 0 L0 -15" class="stroke-[#4e2e16]" stroke-width="1.2" />
                  <path d="M0.8 -14 Q8 -9 0.8 -3 Z" class="fill-white stroke-sea-400" stroke-width="0.6" />
                  <path d="M-0.8 -13 Q-7 -9 -0.8 -4 Z" class="fill-white stroke-sea-400" stroke-width="0.6" />
                  <path d="M0 -15 L5 -17 L0 -18.5 Z" class="fill-strawhat-500" />
                </g>
              </g>
            </svg>

            {/* Zoom and view buttons */}
            <div class="absolute right-2 top-2 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              <Btn title="Zoom in" onClick={() => zoomAt(1.6, undefined, undefined, false)}>+</Btn>
              <Btn title="Zoom out" onClick={() => zoomAt(1 / 1.6, undefined, undefined, false)}>−</Btn>
              <Btn title="Where I am" onClick={() => centreOn(shipAt(), Math.max(view().k, 2.5))}>◎</Btn>
              <Btn title="Whole map" onClick={() => fitAll()}>⤢</Btn>
              <Btn title={big() ? 'Close full screen (Esc)' : 'Full screen'} onClick={() => setBig(!big())}>
                {big() ? '✕' : '⛶'}
              </Btn>
            </div>

            <Show when={hint()}>
              <div class="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md bg-sea-950/80 px-3 py-1.5 text-xs font-semibold text-white">
                Hold Ctrl and scroll to zoom, or open full screen
              </div>
            </Show>

            {/* Place card */}
            <Show when={card() && cardPos()}>
              <div
                class="absolute z-10 w-[260px] rounded-lg border border-sea-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-sea-700 dark:bg-sea-900/95"
                style={{
                  left: `${cardPos()!.left}px`,
                  top: cardPos()!.top != null ? `${cardPos()!.top}px` : undefined,
                  bottom: (cardPos() as any).bottom != null ? `${(cardPos() as any).bottom}px` : undefined,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onPointerEnter={() => setHovered(card())}
                onPointerLeave={() => setHovered(null)}
              >
                <div class="mb-1.5 flex items-center gap-2">
                  <span class="font-display text-sm font-extrabold text-sea-800 dark:text-sea-50">{card()!.name}</span>
                  <Show when={stateOf(card()!) === 'here'}>
                    <span class="rounded bg-strawhat-500 px-1.5 py-0.5 text-[10px] font-bold text-white">You are here</span>
                  </Show>
                </div>
                <For each={card()!.arcs.filter((id) => nodeById.has(id) && arcProgress(id))}>
                  {(id) => {
                    const prog = () => arcProgress(id)!;
                    const node = nodeById.get(id)!;
                    const pct = () => (prog().minTotal ? (prog().minDone / prog().minTotal) * 100 : 0);
                    return (
                      <div class="mt-2 space-y-1">
                        <div class="flex items-center gap-1.5">
                          <span class="font-semibold text-sea-700 dark:text-sea-200">{node.title}</span>
                          <Show when={node.rating}>
                            <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">★ {node.rating}</span>
                          </Show>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
                          <div class="h-full rounded-full bg-accent-500" style={{ width: `${pct()}%` }} />
                        </div>
                        <div class="flex items-center gap-2 text-[11px] text-sea-500 dark:text-sea-400">
                          <span>
                            {prog().watched}/{prog().total} · {Math.round(pct())}%
                            {prog().minTotal > prog().minDone ? ` · ${fmtDuration(prog().minTotal - prog().minDone)} left` : ''}
                          </span>
                          <button
                            class="ml-auto rounded-md border border-sea-300 px-2 py-0.5 font-semibold text-sea-600 hover:border-accent-400 hover:text-accent-600 dark:border-sea-600 dark:text-sea-300"
                            onClick={() => goTo(id)}
                          >
                            Go to arc
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sea-200 px-4 py-2 text-[11px] text-sea-500 dark:border-sea-800 dark:text-sea-400">
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full bg-strawhat-500" /> You are here</span>
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full bg-accent-500" /> Done</span>
            <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full border border-accent-600 bg-accent-300" /> Started</span>
            <Show when={!prefs.spoilerSafe}>
              <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full border border-sea-400 bg-sea-50 dark:bg-sea-900" /> Ahead</span>
            </Show>
            <span class="ml-auto">
              {prefs.spoilerSafe ? 'Spoiler-safe: places appear as you reach them.' : 'Not to scale.'} Bigger islands are longer arcs.
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
}
