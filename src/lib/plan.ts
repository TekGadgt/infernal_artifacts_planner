// The plan lives in localStorage and can be shared as a compressed URL hash.

import { useSyncExternalStore } from 'react';
import { affixById } from '../data/league';
import { MAX_PLAYTHROUGHS } from '../data/relics';
import { hashUrl, pack, takeHash, unpack, unpackJson } from './link';
import { decodePlan, encodePlan } from './share-codec';
import type { LoadoutKind, NamedLoadout, Plan, PlanV1, PlanV2, Playthrough, SoulBrandSlot } from './types';

// The key keeps its v1 name so plans saved before multiple loadouts still load.
const KEY = 'iapl.plan.v1';
const HASH_KEY = 'p';
const LEGACY_HASH_KEY = 'plan';

const noBrands = (): Record<SoulBrandSlot, string | null> => ({ weapon: null, armour: null, jewellery: null });

export function newLoadout(kind: LoadoutKind, name: string, id: string = crypto.randomUUID()): NamedLoadout {
  return { id, name, kind, items: {}, soulBrands: noBrands() };
}

export const newPlaythrough = (): Playthrough => ({ relics: {}, reloaded: null });

export function emptyPlan(): Plan {
  return {
    version: 3,
    name: 'My league plan',
    playthroughs: [newPlaythrough()],
    activePlaythrough: 0,
    loadouts: [newLoadout('combat', 'Combat', 'combat'), newLoadout('skilling', 'Skilling', 'skilling')],
    activeLoadout: 'combat',
    forge: [],
  };
}

function fromV1(p: Partial<PlanV1>): Partial<PlanV2> {
  const base = emptyPlan();
  const [combat, skilling] = base.loadouts;
  return {
    version: 2,
    name: p.name ?? base.name,
    relics: p.relics ?? {},
    loadouts: [
      { ...combat, items: p.loadouts?.combat ?? {}, soulBrands: { ...noBrands(), ...p.soulBrands } },
      { ...skilling, items: p.loadouts?.skilling ?? {} },
    ],
    forge: Array.isArray(p.forge) ? p.forge : [],
  };
}

function fromV2({ relics, ...p }: Partial<PlanV2>): Partial<Plan> {
  return { ...p, version: 3, playthroughs: [{ relics: relics ?? {}, reloaded: null }], activePlaythrough: 0 };
}

const isRecord = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && !Array.isArray(v);

function normalize(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') return emptyPlan();
  const version = (raw as { version?: number }).version;
  let p = raw as Partial<Plan>;
  if (version === 1) p = fromV2(fromV1(raw as Partial<PlanV1>));
  else if (version === 2) p = fromV2(raw as Partial<PlanV2>);
  else if (version !== 3) return emptyPlan();

  const base = emptyPlan();
  const loadouts = (Array.isArray(p.loadouts) ? p.loadouts : [])
    .filter((l) => l && typeof l.id === 'string' && (l.kind === 'combat' || l.kind === 'skilling'))
    .map((l) => ({ ...l, items: l.items ?? {}, soulBrands: { ...noBrands(), ...l.soulBrands } }));
  if (!loadouts.length) loadouts.push(...base.loadouts);
  const playthroughs = (Array.isArray(p.playthroughs) ? p.playthroughs : [])
    .slice(0, MAX_PLAYTHROUGHS)
    .map((t) => ({ relics: isRecord(t?.relics) ? t.relics : {}, reloaded: typeof t?.reloaded === 'string' ? t.reloaded : null }));
  if (!playthroughs.length) playthroughs.push(newPlaythrough());
  const active = Number(p.activePlaythrough);
  return {
    ...base,
    ...p,
    version: 3,
    playthroughs,
    activePlaythrough: Number.isInteger(active) && active >= 0 && active < playthroughs.length ? active : 0,
    loadouts,
    activeLoadout: loadouts.some((l) => l.id === p.activeLoadout) ? p.activeLoadout! : loadouts[0].id,
    forge: Array.isArray(p.forge) ? p.forge : [],
  };
}

function read(): Plan {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? normalize(JSON.parse(stored)) : emptyPlan();
  } catch {
    return emptyPlan();
  }
}

let current: Plan | null = null;
const listeners = new Set<() => void>();

function get(): Plan {
  current ??= read();
  return current;
}

export function setPlan(next: Plan | ((p: Plan) => Plan)) {
  current = typeof next === 'function' ? next(get()) : next;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage can be full or blocked; the plan still works for this visit.
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

export function usePlan(): [Plan, typeof setPlan] {
  return [useSyncExternalStore(subscribe, get, emptyPlan), setPlan];
}

// ---------- sharing ----------

const tierMax = (affixId: string, tier: number) =>
  affixById.get(affixId)?.tiers.find((t) => t.tier === tier)?.max ?? null;

export async function shareUrl(plan: Plan): Promise<string> {
  return hashUrl(HASH_KEY, await pack(encodePlan(plan, tierMax)));
}

/** Loads a plan from the URL hash, if there is one, and clears the hash. */
export async function importFromHash(): Promise<Plan | null> {
  const found = takeHash(HASH_KEY, LEGACY_HASH_KEY);
  if (!found) return null;
  try {
    const compact = found[HASH_KEY];
    return compact ? normalize(decodePlan(await unpack(compact), tierMax)) : normalize(await unpackJson(found[LEGACY_HASH_KEY]!));
  } catch {
    return null;
  }
}

export function parsePlanFile(text: string): Plan | null {
  try {
    const parsed = JSON.parse(text);
    return [1, 2, 3].includes(parsed?.version) ? normalize(parsed) : null;
  } catch {
    return null;
  }
}
