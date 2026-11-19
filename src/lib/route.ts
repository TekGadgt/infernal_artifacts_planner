// The achievement route and progress live apart from the plan, in their own
// localStorage key, and share through their own link (#r=).

import { useSyncExternalStore } from 'react';
import { PRESTIGE_POINTS, achievementById, type PointSource } from '../data/achievements';
import { RELIC_TIERS } from '../data/relics';
import { hashUrl, pack, takeHash, unpack } from './link';
import { decodeRoute, encodeRoute } from './share-codec';

const KEY = 'iapl.route.v1';
const HASH_KEY = 'r';

export interface RouteStep {
  id: string;
  note: string;
}

/** Progress in one playthrough. A League Prestige resets achievements, so each run tracks its own. */
export interface RunProgress {
  /** Achievements you've completed, in or out of the route. */
  done: string[];
  /** League points from collection log slots, copied from the in-game panel. */
  collectionLog: number;
  /** Skill prestiges, at PRESTIGE_POINTS each. */
  prestiges: number;
}

export interface Route {
  version: 2;
  name: string;
  /** Achievements in the order you plan to do them. The same route serves every run. */
  steps: RouteStep[];
  /** Progress per playthrough, in the plan's playthrough order. */
  progress: RunProgress[];
}

/** The shape saved before progress was tracked per playthrough. */
interface RouteV1 extends Omit<Route, 'version' | 'progress'> {
  version: 1;
  done: string[];
  otherPoints: number;
}

export const emptyProgress = (): RunProgress => ({ done: [], collectionLog: 0, prestiges: 0 });
export const emptyRoute = (): Route => ({ version: 2, name: 'My route', steps: [], progress: [emptyProgress()] });

const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

/** `otherPoints` is the single "other sources" number saved before points were split by source. */
function normalizeProgress(raw: (Partial<RunProgress> & { otherPoints?: number }) | undefined): RunProgress {
  return {
    done: Array.isArray(raw?.done) ? [...new Set(raw.done.filter((d) => typeof d === 'string'))] : [],
    collectionLog: count(raw?.collectionLog ?? raw?.otherPoints),
    prestiges: count(raw?.prestiges),
  };
}

function normalize(raw: unknown): Route {
  let r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Route>;
  if ((r.version as number) === 1) {
    const { done, otherPoints, ...v1 } = r as Partial<RouteV1>;
    r = { ...v1, version: 2, progress: [normalizeProgress({ done, otherPoints })] };
  }
  const seen = new Set<string>();
  const steps = (Array.isArray(r.steps) ? r.steps : []).filter((s) => {
    if (!s || typeof s.id !== 'string' || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return {
    version: 2,
    name: typeof r.name === 'string' ? r.name : emptyRoute().name,
    steps: steps.map((s) => ({ id: s.id, note: typeof s.note === 'string' ? s.note : '' })),
    progress: (Array.isArray(r.progress) && r.progress.length ? r.progress : [undefined]).map(normalizeProgress),
  };
}

function read(): Route {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? normalize(JSON.parse(stored)) : emptyRoute();
  } catch {
    return emptyRoute();
  }
}

let current: Route | null = null;
const listeners = new Set<() => void>();
const get = () => (current ??= read());

export function setRoute(next: Route | ((r: Route) => Route)) {
  current = typeof next === 'function' ? next(get()) : next;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage can be full or blocked; the route still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = read();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useRoute(): [Route, typeof setRoute] {
  return [useSyncExternalStore(subscribe, get, emptyRoute), setRoute];
}

// ---------- points ----------

export const pointsOf = (id: string) => achievementById.get(id)?.points ?? 0;

export const progressFor = (route: Route, run: number): RunProgress => route.progress[run] ?? emptyProgress();

/** Changes one run's progress, filling in empty progress for any runs before it. */
export function withProgress(route: Route, run: number, fn: (p: RunProgress) => RunProgress): Route {
  const progress = Array.from({ length: Math.max(route.progress.length, run + 1) }, (_, i) => route.progress[i] ?? emptyProgress());
  progress[run] = fn(progress[run]);
  return { ...route, progress };
}

/** League points so far in a run, by the in-game panel's four sources. */
export function pointsBySource(progress: RunProgress): Record<PointSource, number> {
  const points = { collectionLog: progress.collectionLog, achievements: 0, powers: 0, prestiges: progress.prestiges * PRESTIGE_POINTS };
  for (const id of progress.done) {
    const a = achievementById.get(id);
    if (a) points[a.source] += a.points;
  }
  return points;
}

export function currentPoints(progress: RunProgress): number {
  return Object.values(pointsBySource(progress)).reduce((n, v) => n + v, 0);
}

/** The highest relic tier these points unlock (0 for none) and the next tier, if any. */
export function tierAt(points: number) {
  const reached = RELIC_TIERS.filter((t) => t.points !== null && t.points <= points).at(-1);
  const next = RELIC_TIERS.find((t) => t.points !== null && t.points > points);
  return { reached: reached?.tier ?? 0, next };
}

export interface RouteLine {
  step: RouteStep;
  index: number;
  points: number;
  /** League points after this step. */
  total: number;
  /** Relic tiers this step unlocks. */
  unlocks: number[];
}

/**
 * Walks the route from where you'd start it: collection log and prestige points, and
 * achievements you've done outside the route.
 */
export function walkRoute(route: Route, progress: RunProgress): { start: number; lines: RouteLine[] } {
  const inRoute = new Set(route.steps.map((s) => s.id));
  const start = progress.collectionLog + progress.prestiges * PRESTIGE_POINTS + progress.done.filter((id) => !inRoute.has(id)).reduce((n, id) => n + pointsOf(id), 0);
  let total = start;
  const lines = route.steps.map((step, index) => {
    const before = total;
    const points = pointsOf(step.id);
    total += points;
    const unlocks = RELIC_TIERS.filter((t) => t.points !== null && t.points > before && t.points <= total).map((t) => t.tier);
    return { step, index, points, total, unlocks };
  });
  return { start, lines };
}

// ---------- sharing ----------

export async function routeShareUrl(route: Route): Promise<string> {
  return hashUrl(HASH_KEY, await pack(encodeRoute(route)));
}

/** A route from the URL hash, if there is one. Your progress stays your own. */
export async function routeFromHash(): Promise<Pick<Route, 'name' | 'steps'> | null> {
  const found = takeHash(HASH_KEY);
  if (!found?.[HASH_KEY]) return null;
  try {
    const shared = normalize(decodeRoute(await unpack(found[HASH_KEY])));
    return { name: shared.name, steps: shared.steps };
  } catch {
    return null;
  }
}

export function routeText(route: Route, progress: RunProgress, relicFor: (tier: number) => string | undefined): string {
  const { start, lines } = walkRoute(route, progress);
  const end = lines.at(-1)?.total ?? start;
  const n = (v: number) => v.toLocaleString('en-US');
  const out = [`**${route.name.trim() || 'Achievement route'}** (${lines.length} achievement${lines.length === 1 ? '' : 's'}, ${n(end - start)} points)`];
  if (start) out.push(`Starting from ${n(start)} points`);
  for (const l of lines) {
    const a = achievementById.get(l.step.id);
    out.push(`${l.index + 1}. ${a?.name ?? l.step.id} (${n(l.points)})${l.step.note ? ` — ${l.step.note}` : ''}`);
    for (const tier of l.unlocks) {
      const relic = relicFor(tier);
      out.push(`   ⮑ Tier ${tier} at ${n(l.total)}${relic ? `: ${relic}` : ''}`);
    }
  }
  return out.join('\n');
}
