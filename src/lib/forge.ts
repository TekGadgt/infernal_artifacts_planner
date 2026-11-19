// Forge, Codex, and Outfitter's Bench costs, per entry and summed.

import {
  AWAKENING_COST,
  LEGENDARY_TRANSPLANT_MULTIPLIER,
  OUTFITTER_STEPS,
  SLOTS,
  STAMP_EXAMPLE_GEMS,
  TRANSPLANT_COST,
  affixById,
} from '../data/league';
import { ROMAN, tierStatus } from './rules';
import type { ForgeOp, NamedLoadout, Plan, PlannedItem, Slot } from './types';

export interface Cost {
  gems: number;
  cores: number;
  embers: number;
  thread: number;
  bars: Record<string, number>;
  estimated: boolean;
}

export const zeroCost = (): Cost => ({ gems: 0, cores: 0, embers: 0, thread: 0, bars: {}, estimated: false });

export const OP_LABEL: Record<ForgeOp['kind'], string> = {
  transplant: 'Transplant',
  'awaken-legendary': 'Legendary Awakening',
  'awaken-ancient': 'Ancient Awakening',
  stamp: 'Stamp a power',
  outfit: 'Outfit upgrade',
};

export function opCost(op: ForgeOp): Cost {
  const c = zeroCost();
  switch (op.kind) {
    case 'transplant': {
      const row = TRANSPLANT_COST[(op.tier ?? 1) - 1];
      const m = op.ontoLegendary ? LEGENDARY_TRANSPLANT_MULTIPLIER : 1;
      c.gems = Math.floor(row.gems * m);
      c.cores = Math.floor(row.cores * m);
      break;
    }
    case 'awaken-legendary':
    case 'awaken-ancient': {
      const a = AWAKENING_COST[op.kind === 'awaken-legendary' ? 'legendary' : 'ancient'];
      c.gems = a.gems;
      c.cores = a.cores;
      c.embers = a.embers;
      break;
    }
    case 'stamp':
      c.gems = STAMP_EXAMPLE_GEMS;
      c.estimated = true;
      break;
    case 'outfit': {
      const s = OUTFITTER_STEPS.find((x) => x.id === op.step) ?? OUTFITTER_STEPS[0];
      // The Stitch Keep cost isn't public, so it adds nothing yet.
      c.gems = s.gems + (op.keep ? (s.keepGems ?? 0) : 0);
      c.cores = op.keep ? (s.keepCores ?? 0) : 0;
      c.thread = s.thread;
      c.bars[s.bars.replace(/^\d+\s+/, '')] = Number(s.bars.match(/^\d+/)?.[0] ?? 0);
      c.estimated = true;
      break;
    }
  }
  const n = Math.max(1, op.count);
  return {
    gems: c.gems * n,
    cores: c.cores * n,
    embers: c.embers * n,
    thread: c.thread * n,
    bars: Object.fromEntries(Object.entries(c.bars).map(([k, v]) => [k, v * n])),
    estimated: c.estimated,
  };
}

export function sumCosts(costs: Cost[]): Cost {
  return costs.reduce((acc, c) => {
    acc.gems += c.gems;
    acc.cores += c.cores;
    acc.embers += c.embers;
    acc.thread += c.thread;
    for (const [k, v] of Object.entries(c.bars)) acc.bars[k] = (acc.bars[k] ?? 0) + v;
    acc.estimated ||= c.estimated;
    return acc;
  }, zeroCost());
}

const n = (v: number) => v.toLocaleString('en-US');

/** "25,000 gems, 100 cores", leaving out anything that is zero. */
export function costText(c: Cost): string {
  const parts = [
    `${n(c.gems)} gems`,
    c.cores && `${n(c.cores)} cores`,
    c.embers && `${n(c.embers)} embers`,
    c.thread && `${n(c.thread)} thread`,
    ...Object.entries(c.bars).map(([k, v]) => `${n(v)} ${k}`),
  ];
  return parts.filter(Boolean).join(', ');
}

/** The loadout and piece an entry is for, or null when it isn't tied to planned gear. */
export function opTarget(plan: Plan, op: ForgeOp): { loadout: NamedLoadout; slot: Slot; item: PlannedItem } | null {
  const loadout = op.loadout ? plan.loadouts.find((l) => l.id === op.loadout) : undefined;
  const item = loadout && op.slot ? loadout.items[op.slot] : undefined;
  return loadout && item ? { loadout, slot: op.slot!, item } : null;
}

export const slotLabel = (slot: Slot) => SLOTS.find((s) => s.id === slot)?.label ?? slot;
export const pieceLabel = (slot: Slot, item: PlannedItem) => (item.name ? `${slotLabel(slot)}: ${item.name}` : slotLabel(slot));

export interface ForgeGroup {
  loadout: NamedLoadout | null;
  pieces: { slot: Slot | null; item: PlannedItem | null; ops: ForgeOp[]; cost: Cost }[];
  cost: Cost;
}

/** Forge entries grouped by loadout and piece, in loadout and equipment order, untied entries last. */
export function shoppingList(plan: Plan): ForgeGroup[] {
  const groups: ForgeGroup[] = [];
  for (const loadout of [...plan.loadouts, null]) {
    const ops = plan.forge.filter((op) => (loadout ? opTarget(plan, op)?.loadout === loadout : !opTarget(plan, op)));
    if (!ops.length) continue;
    const slots: (Slot | null)[] = loadout ? SLOTS.map((s) => s.id).filter((s) => ops.some((op) => op.slot === s)) : [null];
    const pieces = slots.map((slot) => {
      const own = loadout ? ops.filter((op) => op.slot === slot) : ops;
      return { slot, item: loadout && slot ? loadout.items[slot]! : null, ops: own, cost: sumCosts(own.map(opCost)) };
    });
    groups.push({ loadout, pieces, cost: sumCosts(pieces.map((p) => p.cost)) });
  }
  return groups;
}

export interface GearWork {
  loadout: NamedLoadout;
  slot: Slot;
  item: PlannedItem;
  text: string;
  /** An entry that would cover it, when the work has a known cost. */
  op?: Omit<ForgeOp, 'id'>;
}

/** Forge work your planned gear implies that the Forge list doesn't cover yet. */
export function gearWork(plan: Plan): GearWork[] {
  const work: GearWork[] = [];
  for (const loadout of plan.loadouts) {
    for (const { id: slot } of SLOTS) {
      const item = loadout.items[slot];
      if (!item) continue;
      const planned = plan.forge.filter((op) => op.loadout === loadout.id && op.slot === slot);
      if (item.variant === 'ancient' && !planned.some((op) => op.kind === 'awaken-ancient'))
        work.push({
          loadout,
          slot,
          item,
          text: 'Ancient: an Ancient Awakening, unless it drops Ancient',
          op: { kind: 'awaken-ancient', count: 1, loadout: loadout.id, slot },
        });
      for (const p of item.affixes) {
        const affix = affixById.get(p.affixId);
        const tier = affix?.tiers.find((t) => t.tier === p.tier);
        if (affix && tier && tierStatus(affix, tier, item) === 'improve')
          work.push({ loadout, slot, item, text: `Improve ${affix.name} to Tier ${ROMAN[p.tier]} (costs not public yet)` });
      }
    }
  }
  return work;
}
