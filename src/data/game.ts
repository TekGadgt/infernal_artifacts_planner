// Gear items and roll pools from the game client, via `npm run import-game-data`.
// See scripts/import-game-data.mjs for where each value comes from.

import data from './generated/game.json';
import type { Category, Rarity, Slot } from '../lib/types';

export type GameStyle = 'Melee' | 'Ranged' | 'Magic';
export type AffixStatus = 'rollable' | 'unrollable' | 'hidden';

export interface GameAffix {
  id: string;
  name: string;
  category: Category;
  slots: Slot[];
  template: string;
  description: string;
  /** Values are percentages. */
  percent: boolean;
  tiers: { ilvl: number; min: number; max: number }[];
  /** Roll weight per tier, from the Encyclopedia. */
  weights: number[];
  /** "unrollable": in the Encyclopedia, but no item rolls it. "hidden": only in the game files. */
  status: AffixStatus;
}

export interface GamePower {
  id: string;
  name: string;
  /** False for boss powers, which come from bosses rather than rolls. */
  rollable: boolean;
  weight?: number;
  bySlot?: Partial<Record<Slot, number>>;
}

export interface GameItem {
  id: number;
  name: string;
  slot: Slot;
  ilvl: number;
  rarity: Rarity;
  /** Percent chance to upgrade to the next rarity when it drops. */
  upgrade: number;
  styles: GameStyle[];
  twoHanded: boolean;
  affixes: string[];
  /** Roll weight of each affix in `affixes`, on this item. */
  affixWeights: number[];
  powers: string[];
}

const STYLE_LETTER: Record<string, GameStyle> = { M: 'Melee', R: 'Ranged', A: 'Magic' };

export const gameAffixes: Record<string, GameAffix> = Object.fromEntries(
  Object.entries(data.affixes).map(([id, a]) => [id, { id, ...a } as GameAffix]),
);
export const gamePowers: Record<string, GamePower> = Object.fromEntries(
  Object.entries(data.powers).map(([id, p]) => [id, { id, ...p } as GamePower]),
);

type RawItem = [number, string, Slot, number, Rarity, number, string, number, number[], number[], number[]];

export const items: GameItem[] = (data.items as RawItem[]).map(([id, name, slot, ilvl, rarity, upgrade, styles, two, a, p, w]) => ({
  id,
  name,
  slot,
  ilvl,
  rarity,
  upgrade,
  // The importer writes each style's first letter; Magic is "A" since "M" is Melee.
  styles: [...styles].map((c) => STYLE_LETTER[c]).filter(Boolean),
  twoHanded: two === 1,
  affixes: a.map((i) => data.affixIds[i]),
  affixWeights: w,
  powers: p.map((i) => data.powerIds[i]),
}));

export const itemById = new Map(items.map((i) => [i.id, i]));
export const importedAt = data.importedAt;

/** Tiers of an affix that roll at this item level (tier numbers from 1). */
export function tiersAt(affix: GameAffix, ilvl: number): number[] {
  return affix.tiers.flatMap((t, i) => (Math.max(1, t.ilvl) <= Math.max(1, ilvl) ? [i + 1] : []));
}


export function powerWeight(power: GamePower, slot: Slot): number {
  return power.bySlot?.[slot] ?? power.weight ?? 0;
}

/** The strongest a Demonic Power can roll on an item, as a percent of full strength. */
export function powerStrength(ilvl: number): number {
  const { levels, percents } = data.powerStrength;
  if (ilvl <= levels[0]) return percents[0];
  for (let i = 1; i < levels.length; i++) {
    if (ilvl <= levels[i]) {
      const f = (ilvl - levels[i - 1]) / (levels[i] - levels[i - 1]);
      return Math.round((percents[i - 1] + f * (percents[i] - percents[i - 1])) * 100) / 100;
    }
  }
  return percents.at(-1)!;
}

export { affixLimits } from './league';

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const nextRarity = (r: Rarity): Rarity | null => RARITY_ORDER[RARITY_ORDER.indexOf(r) + 1] ?? null;

export interface ItemRoll {
  item: GameItem;
  weight: number;
  /** Percent chance this is the item's first affix roll, or its power. */
  chance: number;
}

function invert(pools: (item: GameItem) => { id: string; weight: number }[]): Map<string, ItemRoll[]> {
  const index = new Map<string, ItemRoll[]>();
  for (const item of items) {
    const pool = pools(item);
    const total = pool.reduce((n, r) => n + r.weight, 0);
    for (const { id, weight } of pool) {
      const list = index.get(id) ?? [];
      list.push({ item, weight, chance: total ? (weight / total) * 100 : 0 });
      index.set(id, list);
    }
  }
  for (const list of index.values()) list.sort((a, b) => b.chance - a.chance || a.item.name.localeCompare(b.item.name));
  return index;
}

let affixIndex: Map<string, ItemRoll[]> | undefined;
let powerIndex: Map<string, ItemRoll[]> | undefined;

/** Items that can roll this affix, best first-roll odds first. */
export function itemsWithAffix(id: string): ItemRoll[] {
  affixIndex ??= invert((i) => i.affixes.map((id, n) => ({ id, weight: i.affixWeights[n] })));
  return affixIndex.get(id) ?? [];
}

/** Items that can roll this Demonic Power once Legendary, best odds first. */
export function itemsWithPower(id: string): ItemRoll[] {
  powerIndex ??= invert((i) => i.powers.map((id) => ({ id, weight: powerWeight(gamePowers[id], i.slot) })));
  return powerIndex.get(id) ?? [];
}
