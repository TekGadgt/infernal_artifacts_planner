// Relic tiers, hand-copied from the wiki. Add new tiers here as they are revealed.
// `icon` is a wiki file name; `npm run sync` downloads it to public/icons/.

export interface Relic {
  id: string;
  name: string;
  icon: string | null;
  /** One-line hook shown on the card. */
  summary: string;
  effects: string[];
  /** Effects that grow at later league tiers. */
  scaling?: { tier: number; text: string }[];
  revealed: boolean;
}

export interface RelicTier {
  tier: number;
  points: number | null;
  passives: string[];
  /** League systems that open at this tier. */
  unlocks: string[];
  relics: Relic[];
}

export const RELIC_TIERS: RelicTier[] = [
  {
    tier: 1,
    points: 1500,
    passives: [
      '+100% drop rate',
      '10x XP rate',
      'Beginner clues complete 5x faster',
      '100 gathering actions before stopping',
      '1.5x chance to successfully gather',
      '75% chance for gathering nodes not to deplete',
      'Automatically bank slayer parts, currencies, herbs, and seeds',
    ],
    unlocks: ['Forge: Melt', 'Forge: Improve'],
    relics: [
      {
        id: 'runic-warding',
        name: 'Runic Warding',
        icon: 'Runic_warding_perk.png',
        summary: 'Runecrafting and Warding. Tokens from essence.',
        effects: [
          'Crafting recipes no longer require runes',
          'No recipe requires ordinary thread, mystic thread, or brimstone thread',
          'Manual runecrafting saves 95% of essence and banks all runes',
          'Mined essence turns itself into mixed runes (toggleable, on by default)',
          '1 skilling token per 10 Runecrafting XP, including Warding',
          'Mining essence awards 75x skilling tokens',
          'Gathering essence shards awards 50x skilling tokens',
        ],
        revealed: true,
      },
      {
        id: 'fluxious',
        name: 'Fluxious',
        icon: 'Fluxious_perk.png',
        summary: 'Smithing and Mining. Bars and tokens.',
        effects: [
          'Crafting recipes no longer require coal dust, granite dust, or luminite flux',
          'Smithing an item from bars has a 5% chance to grant 50 extra bars of the same type',
          'Switching to a new ore always succeeds on the first swing (not mixed rocks such as gem rocks)',
          '1 skilling token per 10 Smithing XP',
          '50% more skilling tokens while Mining',
        ],
        revealed: true,
      },
      {
        id: 'man-of-wood',
        name: 'Man of Wood',
        icon: 'Man_of_wood_perk.png',
        summary: 'Fletching and Woodcutting. Free ammo parts.',
        effects: [
          'Fletching no longer needs bow strings, crossbow strings, feathers, or arrow shafts',
          'No recipe requires ordinary thread, mystic thread, or brimstone thread',
          'Bonus arrowheads, dart tips, and javelin heads go to the bank while you gather and craft',
          'Chopping trees grants bonus headless arrows and matching arrow tips (Olympian logs grant Olympian shafts)',
          'Leather from mobs is noted and x10',
          '1 skilling token per 5 Fletching XP and per 5 Woodcutting XP',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 2,
    points: 5600,
    passives: [
      '+200% drop rate',
      '16x XP rate',
      '+50% combat XP boost, on top of the XP rate',
      'Easy clues complete 5x faster',
      '1 Upgrade gem per hitpoint of NPCs you kill, scaled to damage dealt',
      '10 Upgrade gems per successful gather',
      'Automatically bank all keys, ancient shards, and dark totems',
      'Unlock bonfires',
      'Find Imcando Geodes while mining and woodcutting',
    ],
    unlocks: ['Codex: Extract', 'Codex: Stamp', 'Codex: Soul-brand (all three slots)'],
    relics: [
      {
        id: 'task-treasure',
        name: 'Task Treasure',
        icon: 'Task_treasure_perk.png',
        summary: 'Slayer. A Lesser slayer helm that grows.',
        effects: [
          'Gain an upgradeable Lesser slayer helm',
          'On a matching Turael, Vannaka, or Nieve task: 15% damage and accuracy, 3x drop rate, and +5 minimum hit',
          'Unlimited task picks from those Slayer Masters',
          'Ensouled heads go straight to your bank',
        ],
        scaling: [{ tier: 4, text: 'Helm bonus extends to non-boss Nixite tasks' }],
        revealed: true,
      },
      {
        id: 'loot-hound',
        name: 'Loot Hound',
        icon: 'Loot_hound_perk.png',
        summary: 'Clues. Twice as many, and 10x keys.',
        effects: [
          'Find clues twice as often, and pick them up automatically',
          'Easy and Medium caskets give 10x keys when your casket loot rolls a key',
        ],
        scaling: [
          { tier: 4, text: 'Hard caskets join the 10x key effect' },
          { tier: 5, text: 'Elite caskets join the 10x key effect' },
          { tier: 6, text: 'Master caskets join the 10x key effect' },
        ],
        revealed: true,
      },
      {
        id: 'full-metal-alchemist',
        name: 'Full Metal Alchemist',
        icon: 'Full_metal_alchemist_perk.png',
        summary: 'Production. Triple output, each item rolls affixes.',
        effects: [
          'Everything you craft below tier 90 is tripled in output, across all Production skills',
          'Each item rolls its own rarity and affixes',
          'Each craft also awards a slayer part: basic for levels 1–50, normal for 51–80, superior for 81+',
          'Smithed sapphire and emerald gear is excluded',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 3,
    points: null,
    passives: [],
    unlocks: ['Forge: Transplant'],
    relics: [
      {
        id: 'awarding',
        name: 'Awarding',
        icon: 'Awarding_perk.png',
        summary: 'Warding, Herblore, and Smithing. Instant crafts.',
        effects: [
          'Warding, Herblore, and Smithing: crafts finish instantly, up to 50 at a time, with noted components and outputs',
          'Warding and Herblore: stackable components cost half (rounded up), and Level and Prestige requirements are waived',
          'Clean a whole inventory of herbs at once',
          'Staves and tridents melt for 5x Forge Cores',
        ],
        revealed: true,
      },
      {
        id: 'handiwork',
        name: 'Handiwork',
        icon: 'Handiwork_perk.png',
        summary: 'Crafting, Cooking, and Smithing. Instant crafts.',
        effects: [
          'Crafting, Cooking, and Smithing: crafts finish instantly, up to 50 at a time, with noted components and outputs',
          'Crafting and Cooking: stackable components cost half (rounded up), and Level and Prestige requirements are waived',
        ],
        revealed: true,
      },
      {
        id: 'fletch-and-flame',
        name: 'Fletch & Flame',
        icon: 'Fletch_and_flame_perk.png',
        summary: 'Fletching, Firemaking, and Smithing. Instant crafts.',
        effects: [
          'Fletching, Firemaking, and Smithing: crafts finish instantly, up to 50 at a time, with noted components and outputs',
          'Fletching and Firemaking: stackable components cost half (rounded up), and Level and Prestige requirements are waived',
          'Bonfires take noted logs and burn 50 at a time',
          'Each Fletching craft has a 1 in 500 chance to give 3 to 30 clue points, more for higher-level recipes',
          'Bows, crossbows, and ballistas melt for 5x Forge Cores',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 4,
    points: null,
    passives: [],
    unlocks: [],
    relics: [
      {
        id: 'ravaging-ripper',
        name: 'Ravaging Ripper',
        icon: 'Ravaging_ripper_perk.png',
        summary: 'Special attacks fire on their own, in a 3x3.',
        effects: [
          'If your weapon has a special attack, you can no longer activate it manually',
          'Instead, it has a chance to activate on every attack, using no energy, with a 2 tick cooldown',
          'Cheaper specials trigger more often: 60% at 25% cost, 40% at 50% cost, 27% at 100% cost',
          'Special attacks also strike a 3x3 area around the target',
        ],
        revealed: true,
      },
      {
        id: 'pyrrhic-reaver',
        name: 'Pyrrhic Reaver',
        icon: 'Pyrrhic_reaver_perk.png',
        summary: 'Effects not revealed yet.',
        effects: [],
        revealed: false,
      },
      {
        id: 'hardy-hellhound',
        name: 'Hardy Hellhound',
        icon: 'Hardy_hellhound_perk.png',
        summary: 'Shield tank. Damage reduction and reflection.',
        effects: [
          'While wearing a shield, take 1% less damage per 100 of your highest defence bonus, up to 50%',
          'Taking damage has a 1% chance to trigger Flask of Fervour: full HP, prayer, stats and spec energy, 6 ticks of invulnerability, and 3 waves of holy fire (3 minute cooldown, shortened by damage dealt)',
          'For 10 seconds after a special attack, reflect 5x incoming damage',
          'Recoil rings boost reflection: 1.5x from Recoil, 2x from Suffering. Neither ring loses charges',
        ],
        revealed: true,
      },
    ],
  },
  { tier: 5, points: null, passives: [], unlocks: ['Forge: Masterwork'], relics: [] },
  { tier: 6, points: null, passives: [], unlocks: ['Codex: Legendary Awakening (Epic to Legendary)'], relics: [] },
  { tier: 7, points: null, passives: [], unlocks: ['Codex: Ancient Awakening (Legendary to Ancient)'], relics: [] },
];

/** Revealed relics whose tier is not public yet. */
export const UNPLACED_RELICS: Relic[] = [
  {
    id: 'fortune',
    name: 'Fortune',
    icon: 'Fortune_perk.png',
    summary: 'Boss mystery boxes.',
    effects: [
      'Unlocks three mystery boxes for three different tiers of bosses',
      'Each mystery box gives rare, unique loot from that entire tier',
    ],
    revealed: true,
  },
];

export const relicById = new Map(
  [...RELIC_TIERS.flatMap((t) => t.relics), ...UNPLACED_RELICS].map((r) => [r.id, r]),
);
