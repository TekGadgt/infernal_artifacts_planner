// Hand-maintained league rules from wiki.august.games/wiki/Infernal_Artifacts_League.
// Affix and power tables live in ./generated and come from `npm run sync`.

import affixData from './generated/affixes.json';
import powerData from './generated/powers.json';
import type { Affix, Category, Power, Rarity, Slot, Variant } from '../lib/types';

export const affixes = affixData.affixes as Affix[];
export const powers = powerData.powers as Power[];
export const syncedAt = affixData.syncedAt;

export const affixById = new Map(affixes.map((a) => [a.id, a]));
export const powerById = new Map(powers.map((p) => [p.id, p]));

export const LEAGUE_START = '2026-11-19T18:00:00Z';
export const WIKI = 'https://wiki.august.games/wiki/Infernal_Artifacts_League';

// Laid out like the in-game equipment screen.
export const SLOTS: { id: Slot; label: string; row: number; col: number }[] = [
  { id: 'head', label: 'Head', row: 1, col: 2 },
  { id: 'cape', label: 'Cape', row: 2, col: 1 },
  { id: 'neck', label: 'Neck', row: 2, col: 2 },
  { id: 'weapon', label: 'Weapon', row: 3, col: 1 },
  { id: 'body', label: 'Body', row: 3, col: 2 },
  { id: 'shield', label: 'Shield', row: 3, col: 3 },
  { id: 'legs', label: 'Legs', row: 4, col: 2 },
  { id: 'hands', label: 'Hands', row: 5, col: 1 },
  { id: 'feet', label: 'Feet', row: 5, col: 2 },
  { id: 'ring', label: 'Ring', row: 5, col: 3 },
];

export const RARITIES: {
  id: Rarity;
  label: string;
  color: string;
  affixes: [number, number];
  limits: Record<Exclude<Category, 'skilling'>, number> | null;
}[] = [
  { id: 'common', label: 'Common', color: '#9d9d9d', affixes: [0, 0], limits: null },
  { id: 'uncommon', label: 'Uncommon', color: '#1eff00', affixes: [1, 2], limits: null },
  { id: 'rare', label: 'Rare', color: '#3b9dff', affixes: [2, 3], limits: { offence: 2, defence: 2, utility: 1 } },
  { id: 'epic', label: 'Epic', color: '#a335ee', affixes: [3, 4], limits: { offence: 2, defence: 2, utility: 2 } },
  { id: 'legendary', label: 'Legendary', color: '#ff8000', affixes: [5, 6], limits: { offence: 3, defence: 3, utility: 2 } },
];
export const rarityById = new Map(RARITIES.map((r) => [r.id, r]));

export const VARIANTS: { id: Variant; label: string; multiplier: number; note: string }[] = [
  { id: 'normal', label: 'Normal', multiplier: 1, note: '' },
  { id: 'ancient', label: 'Ancient', multiplier: 1.2, note: '+20% to every affix. 1% of Epic and Legendary drops.' },
  {
    id: 'primal',
    label: 'Primal',
    multiplier: 1.5,
    note: '+50% to every affix, every affix at max, and the tier ceiling can go past the item level limit. 0.1% of Legendary drops.',
  },
];
export const variantById = new Map(VARIANTS.map((v) => [v.id, v]));

// The Forge's Improve tab caps affixes by item level with these thresholds.
// They differ from the per-affix roll thresholds in the affix list.
export const IMPROVE_TIER_ILVL = [0, 30, 55, 85, 105];

// Two-handed weapons roll stat affixes 1.75x stronger. The wiki does not list
// which affixes count as "stat" affixes; these flat equipment stats are a guess.
export const TWO_HANDED_MULTIPLIER = 1.75;
export const STAT_AFFIXES = new Set(['arcane', 'brutal', 'heavy', 'grounded', 'shielding', 'warded', 'vital', 'blessed']);

export const SOUL_BRAND_SLOTS: { id: 'weapon' | 'armour' | 'jewellery'; label: string; itemSlots: Slot[] }[] = [
  { id: 'weapon', label: 'Weapon', itemSlots: ['weapon'] },
  { id: 'armour', label: 'Armour', itemSlots: ['head', 'cape', 'body', 'shield', 'legs', 'hands', 'feet'] },
  { id: 'jewellery', label: 'Jewellery', itemSlots: ['neck', 'ring'] },
];

// ---------- Forge and Codex costs ----------

export const TRANSPLANT_COST = [
  { tier: 1, gems: 1500, cores: 5 },
  { tier: 2, gems: 3000, cores: 15 },
  { tier: 3, gems: 6000, cores: 40 },
  { tier: 4, gems: 15000, cores: 100 },
  { tier: 5, gems: 40000, cores: 250 },
];
export const LEGENDARY_TRANSPLANT_MULTIPLIER = 1.5;

export const AWAKENING_COST = {
  legendary: { label: 'Legendary Awakening (Epic to Legendary)', tier: 6, gems: 25000, cores: 100, embers: 0 },
  ancient: { label: 'Ancient Awakening (Legendary to Ancient)', tier: 7, gems: 50000, cores: 35, embers: 5 },
};

// Only one stamp cost is public: Storm-Touched over Hammerdin on an Abyssal whip.
export const STAMP_EXAMPLE_GEMS = 1100;

// Values shown for a Smiths tunic. Stitch costs are not public yet.
export const OUTFITTER_STEPS = [
  { id: 'trim', label: 'Trim', grade: 'Trimmed (t)', ilvl: 40, points: 2500, bars: '20 Silver bars', thread: 10, gems: 350, keepGems: 1500, keepCores: 60, quality: 40 },
  { id: 'gild', label: 'Gild', grade: 'Gilded (g)', ilvl: 70, points: 8000, bars: '20 Gold bars', thread: 25, gems: 1000, keepGems: 4500, keepCores: 120, quality: 60 },
] as const;

export const OUTFIT_RESOURCE_POINTS = [
  ['Copper ore', 11], ['Tin ore', 11], ['Iron ore', 20], ['Silver ore', 20], ['Coal', 30], ['Coal dust', 30],
  ['Adamantite ore', 40], ['Runite ore', 50], ['Granite dust', 60], ['Luminite flux', 70], ['Luminite ore', 70],
] as const;

export const DEMONIC_POWER_CAPS = [
  { item: 'Adamant platebody', ilvl: 35, cap: 'Up to 21% of full strength' },
  { item: "Torag's helm", ilvl: 70, cap: 'Up to 40% of full strength' },
  { item: 'Sanguine Scythe of Vitur', ilvl: 120, cap: 'Full strength' },
];
