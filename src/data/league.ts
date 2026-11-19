// Hand-maintained league rules from wiki.august.games/wiki/Infernal_Artifacts_League.
// Affix and power tables live in ./generated and come from `npm run sync`.

import affixData from './generated/affixes.json';
import gameAffixData from './generated/game-affixes.json';
import powerData from './generated/powers.json';
import type { Affix, Category, Power, Rarity, Slot, Variant } from '../lib/types';

// The wiki's affixes, plus rollable ones the game has that the wiki doesn't list yet.
export const affixes = [...affixData.affixes, ...gameAffixData.affixes] as Affix[];
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

// The Encyclopedia shows these slots overriding the rarity's per-category limits at every rarity.
// The game data doesn't say where that comes from, so they're kept by hand.
const SLOT_AFFIX_LIMITS: Partial<Record<Slot, Record<Exclude<Category, 'skilling'>, number>>> = {
  head: { offence: 3, defence: 3, utility: 0 },
  body: { offence: 3, defence: 3, utility: 0 },
  legs: { offence: 3, defence: 3, utility: 0 },
  cape: { offence: 1, defence: 2, utility: 3 },
  shield: { offence: 2, defence: 3, utility: 2 },
};

/** How many affixes an item rolls, and the most per category (null where the game sets none). */
export function affixLimits(rarity: Rarity, slot: Slot) {
  const r = rarityById.get(rarity)!;
  return { count: r.affixes, limits: r.limits ? (SLOT_AFFIX_LIMITS[slot] ?? r.limits) : null };
}

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

// Trim and Gild values are shown for a Smiths tunic. The Stitch Keep cost is not public yet.
export const OUTFITTER_STEPS = [
  { id: 'trim', label: 'Trim', grade: 'Trimmed (t)', ilvl: 40, points: 2500, bars: '20 Silver bars', thread: 10, gems: 350, keepGems: 1500, keepCores: 60, quality: 40, levels: [1, 49] },
  { id: 'gild', label: 'Gild', grade: 'Gilded (g)', ilvl: 70, points: 8000, bars: '20 Gold bars', thread: 25, gems: 1000, keepGems: 4500, keepCores: 120, quality: 60, levels: [40, 79] },
  { id: 'stitch', label: 'Stitch', grade: 'Demonic stitched (d)', ilvl: 100, points: 20000, bars: '5 Ember silk', thread: 50, gems: 2500, keepGems: null, keepCores: null, quality: 80, levels: [70, Infinity] },
] as const;

/** Each resource adds its level plus 10 points to the outfit progress bar. */
export const outfitPoints = (level: number) => level + 10;

// Resource levels for the outfits the wiki lists so far.
export const OUTFIT_RESOURCES: { outfit: string; resources: [name: string, level: number][] }[] = [
  {
    outfit: 'Smiths',
    resources: [
      ['Copper ore', 1], ['Tin ore', 1], ['Iron ore', 10], ['Silver ore', 10], ['Coal', 20], ['Coal dust', 20],
      ['Gold ore', 20], ['Mithril ore', 20], ['Adamantite ore', 30], ['Runite ore', 40], ['Granite dust', 50],
      ['Dragon ore', 60], ['Luminite flux', 60], ['Luminite ore', 60], ['Oxi ore', 70], ['Demonite ore', 80],
      ['Dragonite ore', 80], ['Olympian ore', 80], ['Refined olympian ore', 100], ['Zaryte ore (prestige rank 3)', 105],
    ],
  },
  {
    outfit: 'Prospector',
    resources: [
      ['Copper ore', 1], ['Tin ore', 1], ['Iron ore', 10], ['Silver ore', 10], ['Coal', 20], ['Gold ore', 20],
      ['Mithril ore', 20], ['Adamantite ore', 30], ['Runite ore', 40], ['Dragon ore', 60], ['Luminite ore', 60],
      ['Oxi ore', 70], ['Demonite ore', 80], ['Dragonite ore', 80], ['Olympian ore', 80], ['Refined olympian ore', 100],
      ['Zaryte ore (prestige rank 3)', 105],
    ],
  },
  {
    outfit: 'Lumberjack',
    resources: [
      ['Logs', 1], ['Oak logs', 15], ['Willow logs', 30], ['Teak logs', 35], ['Maple logs', 45], ['Mahogany logs', 50],
      ['Yew logs', 60], ['Magic logs', 70], ['Olympian logs', 80], ['Redwood logs', 80],
    ],
  },
];

/** Each outfit piece costs this many skilling tokens from the Skilling Token Store. */
export const OUTFIT_PIECE_TOKENS = 5000;

export const DEMONIC_POWER_CAPS = [
  { item: 'Adamant platebody', ilvl: 35, cap: 'Up to 21% of full strength' },
  { item: "Torag's helm", ilvl: 70, cap: 'Up to 40% of full strength' },
  { item: 'Sanguine Scythe of Vitur', ilvl: 120, cap: 'Full strength' },
];
