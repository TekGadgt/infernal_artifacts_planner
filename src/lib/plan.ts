// The plan lives in localStorage and can be shared as a compressed URL hash.

import { useSyncExternalStore } from 'react';
import { affixById } from '../data/league';
import { decodePlan, encodePlan } from './share-codec';
import type { LoadoutKind, NamedLoadout, Plan, PlanV1, SoulBrandSlot } from './types';

// The key keeps its v1 name so plans saved before multiple loadouts still load.
const KEY = 'iapl.plan.v1';
const HASH_KEY = 'p';
const LEGACY_HASH_KEY = 'plan';

const noBrands = (): Record<SoulBrandSlot, string | null> => ({ weapon: null, armour: null, jewellery: null });

export function newLoadout(kind: LoadoutKind, name: string, id: string = crypto.randomUUID()): NamedLoadout {
  return { id, name, kind, items: {}, soulBrands: noBrands() };
}

export function emptyPlan(): Plan {
  return {
    version: 2,
    name: 'My league plan',
    relics: {},
    loadouts: [newLoadout('combat', 'Combat', 'combat'), newLoadout('skilling', 'Skilling', 'skilling')],
    activeLoadout: 'combat',
    forge: [],
  };
}

function fromV1(p: Partial<PlanV1>): Plan {
  const base = emptyPlan();
  const [combat, skilling] = base.loadouts;
  return {
    ...base,
    name: p.name ?? base.name,
    relics: p.relics ?? {},
    loadouts: [
      { ...combat, items: p.loadouts?.combat ?? {}, soulBrands: { ...noBrands(), ...p.soulBrands } },
      { ...skilling, items: p.loadouts?.skilling ?? {} },
    ],
    forge: Array.isArray(p.forge) ? p.forge : [],
  };
}

function normalize(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') return emptyPlan();
  const version = (raw as { version?: number }).version;
  if (version === 1) return fromV1(raw as Partial<PlanV1>);
  if (version !== 2) return emptyPlan();

  const base = emptyPlan();
  const p = raw as Partial<Plan>;
  const loadouts = (Array.isArray(p.loadouts) ? p.loadouts : [])
    .filter((l) => l && typeof l.id === 'string' && (l.kind === 'combat' || l.kind === 'skilling'))
    .map((l) => ({ ...l, items: l.items ?? {}, soulBrands: { ...noBrands(), ...l.soulBrands } }));
  if (!loadouts.length) loadouts.push(...base.loadouts);
  return {
    ...base,
    ...p,
    version: 2,
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

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const tierMax = (affixId: string, tier: number) =>
  affixById.get(affixId)?.tiers.find((t) => t.tier === tier)?.max ?? null;

// The first byte of a compact link says whether the rest is deflated.
const RAW = 0;
const DEFLATED = 1;

export async function shareUrl(plan: Plan): Promise<string> {
  const raw = encodePlan(plan, tierMax);
  const deflated = await pipe(raw, new CompressionStream('deflate-raw'));
  const [flag, body] = deflated.length < raw.length ? [DEFLATED, deflated] : [RAW, raw];
  const url = new URL(window.location.href);
  url.hash = `${HASH_KEY}=${toBase64Url(Uint8Array.of(flag, ...body))}`;
  return url.toString();
}

async function decodeCompact(encoded: string): Promise<Plan> {
  const bytes = fromBase64Url(encoded);
  const body = bytes.subarray(1);
  const raw = bytes[0] === DEFLATED ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return normalize(decodePlan(raw, tierMax));
}

/** Links made before the compact format: deflated JSON under `#plan=`. */
async function decodeLegacy(encoded: string): Promise<Plan> {
  const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
  return normalize(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Loads a plan from the URL hash, if there is one, and clears the hash. */
export async function importFromHash(): Promise<Plan | null> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const compact = params.get(HASH_KEY);
  const legacy = params.get(LEGACY_HASH_KEY);
  if (!compact && !legacy) return null;
  try {
    return compact ? await decodeCompact(compact) : await decodeLegacy(legacy!);
  } catch {
    return null;
  } finally {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function parsePlanFile(text: string): Plan | null {
  try {
    const parsed = JSON.parse(text);
    return parsed?.version === 1 || parsed?.version === 2 ? normalize(parsed) : null;
  } catch {
    return null;
  }
}
