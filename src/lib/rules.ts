import {
  IMPROVE_TIER_ILVL,
  SOUL_BRAND_SLOTS,
  STAT_AFFIXES,
  TWO_HANDED_MULTIPLIER,
  affixLimits,
  affixById,
  powerById,
  rarityById,
  variantById,
} from '../data/league';
import type { Affix, AffixTier, Category, Loadout, LoadoutKind, NamedLoadout, PlannedAffix, PlannedItem, Power, Slot, Style } from './types';

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return Number(n.toFixed(2)).toLocaleString('en-US');
}

/** Highest tier that can roll naturally at this item level (0 if none). */
export function rollCeiling(affix: Affix, ilvl: number): number {
  return affix.tiers.reduce((best, t) => (t.ilvl <= ilvl ? Math.max(best, t.tier) : best), 0);
}

/** Highest tier the Forge's Improve tab allows at this item level. */
export function improveCeiling(ilvl: number): number {
  return IMPROVE_TIER_ILVL.reduce((best, min, i) => (min <= ilvl ? i + 1 : best), 0);
}

export type TierStatus = 'rolls' | 'improve' | 'primal' | 'locked';

export function tierStatus(affix: Affix, tier: AffixTier, item: PlannedItem): TierStatus {
  if (tier.ilvl <= item.ilvl) return 'rolls';
  const roll = rollCeiling(affix, item.ilvl);
  if (item.variant === 'primal' && tier.tier === roll + 1) return 'primal';
  if (tier.tier <= improveCeiling(item.ilvl)) return 'improve';
  return 'locked';
}

export const TIER_STATUS_TEXT: Record<TierStatus, string> = {
  rolls: 'Rolls at this item level',
  improve: 'Improve only: the Forge allows it, but it does not roll this low',
  primal: 'Primal only: Primal items can roll one tier past the item level limit',
  locked: 'Locked at this item level',
};

export function bestTier(affix: Affix, item: PlannedItem): AffixTier {
  const usable = affix.tiers.filter((t) => tierStatus(affix, t, item) !== 'locked');
  return usable.at(-1) ?? affix.tiers[0];
}

export function multiplier(affix: Affix, item: PlannedItem, slot: Slot): number {
  const variant = variantById.get(item.variant)?.multiplier ?? 1;
  const twoHanded = slot === 'weapon' && item.twoHanded && STAT_AFFIXES.has(affix.id) ? TWO_HANDED_MULTIPLIER : 1;
  return variant * twoHanded;
}

export function baseValue(planned: PlannedAffix, tier: AffixTier, item: PlannedItem): number | null {
  if (tier.max === null) return null;
  if (item.variant === 'primal') return tier.max;
  return planned.value ?? tier.max;
}

export function effectiveValue(planned: PlannedAffix, affix: Affix, item: PlannedItem, slot: Slot): number | null {
  const tier = affix.tiers.find((t) => t.tier === planned.tier) ?? affix.tiers[0];
  const base = baseValue(planned, tier, item);
  return base === null ? null : base * multiplier(affix, item, slot);
}

export function describe(tier: AffixTier, value: number | null): string {
  return value === null ? tier.template : tier.template.replace('{v}', fmt(value));
}

export function describePower(power: Power): string {
  return power.min === null ? power.effect : power.template.replace('{v}', `${fmt(power.min)}–${fmt(power.max)}`);
}

export function affixesFor(slot: Slot, kind: LoadoutKind, all: Affix[]): Affix[] {
  return all.filter((a) => a.slots.includes(slot) && (kind === 'skilling') === (a.category === 'skilling'));
}

export function powersFor(slots: Slot[], all: Power[]): Power[] {
  return all.filter((p) => p.slots.some((s) => slots.includes(s)));
}

// ---------- checks ----------

export interface Issue {
  level: 'error' | 'warn';
  text: string;
}

function restrictionStyles(restriction: string | null): Style[] | null {
  if (!restriction) return null;
  const styles = (['melee', 'ranged', 'magic'] as const).filter((s) => restriction.toLowerCase().includes(s));
  return styles.length ? styles : null;
}

export function itemIssues(slot: Slot, item: PlannedItem): Issue[] {
  const issues: Issue[] = [];
  const rarity = rarityById.get(item.rarity)!;
  const [minCount, maxCount] = rarity.affixes;
  const count = item.affixes.length;

  if (count > maxCount) issues.push({ level: 'error', text: `${rarity.label} items have at most ${maxCount} affixes.` });
  else if (count > 0 && count < minCount)
    issues.push({ level: 'warn', text: `${rarity.label} items roll ${minCount}–${maxCount} affixes. ${count} is fewer than a drop gives.` });

  if (item.variant === 'ancient' && !['epic', 'legendary'].includes(item.rarity))
    issues.push({ level: 'error', text: 'Ancient only rolls on Epic and Legendary items.' });
  if (item.variant === 'primal' && item.rarity !== 'legendary')
    issues.push({ level: 'error', text: 'Primal only rolls on Legendary items.' });

  const { limits } = affixLimits(item.rarity, slot);
  if (limits) {
    const byCategory: Partial<Record<Category, number>> = {};
    for (const p of item.affixes) {
      const a = affixById.get(p.affixId);
      if (a) byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    }
    for (const [cat, limit] of Object.entries(limits)) {
      const n = byCategory[cat as Category] ?? 0;
      if (n > limit)
        issues.push({
          level: 'error',
          text: limit === 0 ? `${rarity.label} ${slot} items roll no ${cat} affixes.` : `${rarity.label} ${slot} items have at most ${limit} ${cat} affixes (this has ${n}).`,
        });
    }
  }

  const foods = new Set(item.affixes.map((p) => affixById.get(p.affixId)).filter((a) => a?.food).map((a) => a!.name));
  if (foods.size > 1) issues.push({ level: 'error', text: `Only one food affix can roll on an item (${[...foods].join(', ')}).` });

  for (const p of item.affixes) {
    const a = affixById.get(p.affixId);
    if (!a) {
      issues.push({ level: 'error', text: `Unknown affix "${p.affixId}". It may have been renamed on the wiki.` });
      continue;
    }
    if (!a.slots.includes(slot)) issues.push({ level: 'error', text: `${a.name} cannot roll on ${slot}.` });
    const tier = a.tiers.find((t) => t.tier === p.tier);
    if (!tier) continue;
    const status = tierStatus(a, tier, item);
    if (status === 'locked')
      issues.push({ level: 'error', text: `${a.name} Tier ${ROMAN[p.tier]} needs item level ${Math.min(tier.ilvl, IMPROVE_TIER_ILVL[p.tier - 1])}.` });
    if (status === 'improve')
      issues.push({ level: 'warn', text: `${a.name} Tier ${ROMAN[p.tier]} rolls from item level ${tier.ilvl}. You'd need to Improve it up from a lower tier.` });
    if (tier.requirement) issues.push({ level: 'warn', text: `${a.name} Tier ${ROMAN[p.tier]}: ${tier.requirement}` });
    const styles = restrictionStyles(a.restriction);
    if (styles && item.style !== 'any' && !styles.includes(item.style))
      issues.push({ level: 'warn', text: `${a.name} is ${a.restriction!.replace(/\.$/, '').toLowerCase()}, and this item is ${item.style} gear.` });
  }

  if (item.powerId) {
    const power = powerById.get(item.powerId);
    if (item.rarity !== 'legendary') issues.push({ level: 'error', text: 'Only Legendary items carry a Demonic Power.' });
    if (power && !power.slots.includes(slot))
      issues.push({ level: 'warn', text: `The wiki lists ${power.name} for ${power.slots.join(', ')}, not ${slot}.` });
  }
  return mergeIssues(issues);
}

/**
 * Collapses repeats into one message, errors first. Only per-affix messages
 * repeat (one per roll of the same affix), so the count is a roll count.
 */
function mergeIssues(issues: Issue[]): Issue[] {
  const counts = new Map<string, { issue: Issue; n: number }>();
  for (const issue of issues) {
    const key = `${issue.level}:${issue.text}`;
    const seen = counts.get(key);
    if (seen) seen.n++;
    else counts.set(key, { issue, n: 1 });
  }
  return [...counts.values()]
    .map(({ issue, n }) => (n > 1 ? { ...issue, text: `${issue.text} (${n} rolls)` } : issue))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

export function loadoutIssues(loadout: Loadout): Issue[] {
  if (loadout.weapon?.twoHanded && loadout.shield)
    return [{ level: 'error', text: 'A two-handed weapon leaves no room for a shield.' }];
  return [];
}

// ---------- totals ----------

// Caps that don't limit the summed affix value.
const NON_TOTAL_CAPS = new Set(['juggernaut', 'bulwark']);
// Caps that include a base chance from the item itself.
const CAP_BASE: Record<string, number> = { 'expeditious-chance': 25, 'slaughter-chance': 25 };

// Critty City (Tier 7) lowers the crit chance cap and turns the excess into crit damage.
const CRITTY_CITY_CAP = { value: 50, text: '50% (Critty City)', note: 'Each 1% above 50% becomes +1% critical damage, up to +150%.' };

export interface AffixTotal {
  affix: Affix;
  /** The cap after relics, which can differ from the affix list. */
  cap: Affix['cap'];
  /** Over the cap, but a relic turns the excess into something else. */
  converts: boolean;
  total: number | null;
  rolls: number;
  /** Rolls per slot, in equipment order of first appearance. */
  slots: { slot: Slot; rolls: number }[];
  over: boolean;
  unit: string;
}

export function loadoutTotals(loadout: Loadout, relics: ReadonlySet<string> = new Set()): AffixTotal[] {
  const map = new Map<string, AffixTotal>();
  for (const [slot, item] of Object.entries(loadout) as [Slot, PlannedItem][]) {
    if (loadout.weapon?.twoHanded && slot === 'shield') continue;
    for (const p of item.affixes) {
      const affix = affixById.get(p.affixId);
      if (!affix) continue;
      const entry =
        map.get(affix.id) ??
        ({ affix, cap: affix.cap, converts: false, total: 0, rolls: 0, slots: [], over: false, unit: affix.tiers[0].unit } as AffixTotal);
      const v = effectiveValue(p, affix, item, slot);
      entry.total = v === null || entry.total === null ? null : entry.total + v;
      entry.rolls++;
      const fromSlot = entry.slots.find((s) => s.slot === slot);
      if (fromSlot) fromSlot.rolls++;
      else entry.slots.push({ slot, rolls: 1 });
      map.set(affix.id, entry);
    }
  }
  for (const e of map.values()) {
    if (e.affix.id === 'precise' && relics.has('critty-city')) e.cap = CRITTY_CITY_CAP;
    const cap = e.cap.value;
    e.over = cap !== null && e.total !== null && !NON_TOTAL_CAPS.has(e.affix.id) && e.total + (CAP_BASE[e.affix.id] ?? 0) > cap;
    if (e.over && e.cap === CRITTY_CITY_CAP) {
      e.over = false;
      e.converts = true;
    }
  }
  const order: Category[] = ['offence', 'defence', 'utility', 'skilling'];
  return [...map.values()].sort(
    (a, b) => order.indexOf(a.affix.category) - order.indexOf(b.affix.category) || a.affix.name.localeCompare(b.affix.name),
  );
}

export interface ActivePower {
  power: Power;
  source: string;
  duplicate: boolean;
}

export function activePowers(loadout: NamedLoadout): ActivePower[] {
  const list: ActivePower[] = [];
  for (const [slot, item] of Object.entries(loadout.items) as [Slot, PlannedItem][]) {
    if (slot === 'shield' && loadout.items.weapon?.twoHanded) continue;
    const power = item.powerId && item.rarity === 'legendary' ? powerById.get(item.powerId) : undefined;
    if (power) list.push({ power, source: item.name || slot, duplicate: false });
  }
  for (const brand of SOUL_BRAND_SLOTS) {
    const power = loadout.soulBrands[brand.id] ? powerById.get(loadout.soulBrands[brand.id]!) : undefined;
    if (power) list.push({ power, source: `${brand.label} soul-brand`, duplicate: false });
  }
  const seen = new Map<string, number>();
  for (const p of list) seen.set(p.power.id, (seen.get(p.power.id) ?? 0) + 1);
  for (const p of list) p.duplicate = (seen.get(p.power.id) ?? 0) > 1;
  return list;
}
