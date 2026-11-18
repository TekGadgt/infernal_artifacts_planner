// The plan lives in localStorage and can be shared as a compressed URL hash.

import { useSyncExternalStore } from 'react';
import type { LoadoutKind, NamedLoadout, Plan, PlanV1, SoulBrandSlot } from './types';

// The key keeps its v1 name so plans saved before multiple loadouts still load.
const KEY = 'iapl.plan.v1';
const HASH_KEY = 'plan';

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

export async function shareUrl(plan: Plan): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(plan)), new CompressionStream('deflate-raw'));
  const url = new URL(window.location.href);
  url.hash = `${HASH_KEY}=${toBase64Url(packed)}`;
  return url.toString();
}

/** Loads a plan from the URL hash, if there is one, and clears the hash. */
export async function importFromHash(): Promise<Plan | null> {
  const match = window.location.hash.match(new RegExp(`${HASH_KEY}=([\\w-]+)`));
  if (!match) return null;
  try {
    const bytes = await pipe(fromBase64Url(match[1]), new DecompressionStream('deflate-raw'));
    return normalize(JSON.parse(new TextDecoder().decode(bytes)));
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
