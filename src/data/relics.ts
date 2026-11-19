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
  /** Combat relics can be reset with a Demonic Reset card and are left out of the prestige maxed reward. */
  combat?: boolean;
}

export const RELIC_TIERS: RelicTier[] = [
  {
    tier: 1,
    points: 1400,
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
          'Ensouled heads go straight to your bank on eligible tasks',
          'Upgrade the helm with Smithing (level 80) into a Battlehat, then a V\'s helm',
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
          'Smithed sapphire and emerald gear is excluded, and so are Task Treasure helm upgrades',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 3,
    points: 17500,
    passives: [
      '+300% drop rate',
      '16x XP rate',
      'Medium clues complete 5x faster',
      'NPC aggression lasts twice as long',
      'Your pets ignore enemy damage mitigation',
      'Automatically bank all gem shards',
      '5x Slayer Points gained',
      '-20 levels to weapon and armour equip requirements',
      '-5 minimum hit from bosses (tier 105 and below)',
      '50x Prayer XP from scattering demonic ashes',
    ],
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
    points: 45000,
    passives: [
      '+400% drop rate',
      '24x XP rate',
      'Acquire and complete clues 5x faster',
      '5 additional Slayer task picks per day',
      "Gain a Banker's Note",
      'Tier 4 relics can be reset with a Demonic Reset card',
    ],
    unlocks: [],
    combat: true,
    relics: [
      {
        id: 'ravaging-ripper',
        name: 'Ravaging Ripper',
        icon: 'Ravaging_ripper_perk.png',
        summary: 'Special attacks fire on their own, in a 3x3.',
        effects: [
          'If your weapon has a special attack, you can no longer activate it manually',
          'Instead, it has a chance to activate on every attack, using no energy, with a 2 tick cooldown',
          'Cheaper specials trigger more often: 60% at 25% cost, 40% at 50% cost, 27% at 100% cost. Special attack cost reduction counts',
          'Special attacks also strike a 3x3 area around the target',
        ],
        revealed: true,
      },
      {
        id: 'pyrrhic-reaver',
        name: 'Pyrrhic Reaver',
        icon: 'Pyrrhic_reaver_perk.png',
        summary: 'Lifesteal overheals, then hits harder.',
        effects: [
          'When lifesteal heals you, 5% chance to also heal up to 150 HP above your maximum',
          'While above your maximum health, deal 15% extra damage, or 50% against a weakness you exploit',
        ],
        revealed: true,
      },
      {
        id: 'hardy-hellhound',
        name: 'Hardy Hellhound',
        icon: 'Hardy_hellhound_perk.png',
        summary: 'Shield tank. Damage reduction and reflection.',
        effects: [
          'While wearing a shield, take 1% less damage per 100 of your highest defence bonus, up to 50%',
          'Taking damage has a 1% chance to trigger Flask of Fervour: full HP, prayer, stats and spec energy, 6 ticks of invulnerability, and 3 waves of holy fire in a 3-tile radius (3 minute cooldown, shortened by damage dealt)',
          'For 10 seconds after a special attack, reflect 5x incoming damage',
          'Recoil rings boost reflection: 1.5x from Recoil, 2x from Suffering. Neither ring loses charges',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 5,
    points: 87500,
    passives: ['+550% drop rate', '24x XP rate', '15% chance to double any loot received', 'Toxic orbs are not consumed on use'],
    unlocks: ['Forge: Masterwork'],
    relics: [
      {
        id: 'transmutation',
        name: 'Transmutation',
        icon: 'Transmutation_perk.png',
        summary: 'Alchemy that converts raw materials up or down a tier.',
        effects: [
          'Gain a reusable Transmutation Codex',
          'Low Alchemy becomes Divine Convergence and High Alchemy becomes Divine Divergence',
          'Convert up to 10 raw materials per cast to the tier above or below',
          'Products go to your bank, or to your inventory if the codex is set that way',
          'No level requirement. Each item gives a base 10 Magic XP',
          'Casts repeat automatically on stacks',
        ],
        revealed: true,
      },
      {
        id: 'liliths-libation',
        name: "Lilith's Libation",
        icon: 'Liliths_libation_perk.png',
        summary: 'Gathering summons Lilith for spirit rewards.',
        effects: [
          'Gathering has a 2% chance to summon Lilith',
          "Lilith grants Seren spirit rewards, plus a 50% chance of bonus Hecate's Mana",
        ],
        revealed: true,
      },
      {
        id: 'impus-infernus',
        name: 'Impus Infernus',
        icon: 'Impus_infernus_perk.png',
        summary: 'Treasure Goblins become Infernal Imps.',
        effects: [
          'Treasure Goblin spawns arrive as Infernal Imps instead, with the same odds and cooldown',
          'Infernal Imp loot gives 25% higher quantities',
          "Each kill also has a 50% chance of bonus Hecate's Mana",
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 6,
    points: 137500,
    passives: ['+700% drop rate', '32x XP rate', 'Ancient remnants are not consumed on use'],
    unlocks: ['Codex: Legendary Awakening (Epic to Legendary)'],
    relics: [
      {
        id: 'reloaded',
        name: 'Reloaded',
        icon: 'Reloaded_perk.png',
        summary: 'One extra relic from Tiers 1 to 3.',
        effects: [
          'Unlock one extra relic from Tiers 1–3 that you do not already have',
          'The extra relic works exactly as if you had picked it in its own tier',
          'This choice is permanent',
          'If you prestige after picking Reloaded, only Reloaded is locked',
        ],
        revealed: true,
      },
      {
        id: 'treasure-seeker',
        name: 'Treasure Seeker',
        icon: 'Treasure_seeker_perk.png',
        summary: 'Clues collect and solve themselves. Caskets upgrade.',
        effects: [
          'While you are online, solved clues are collected automatically, and the next clue of the same tier starts from your bank',
          '15% chance to solve a clue the moment you start it',
          '15% chance per casket opened to receive a casket of the next tier instead. Master caskets never upgrade',
          'Caskets can also contain a special Third Age cosmetic box',
        ],
        revealed: true,
      },
      {
        id: 'fortune',
        name: 'Fortune',
        icon: 'Fortune_perk.png',
        summary: 'Boss kills drop Fortune Boxes.',
        effects: [
          'Boss kills have a chance to award a Fortune Box, sent straight to your bank',
          'Bigger bosses roll more often. Tougher bosses draw from better box pools',
          'If your bank is full, the box goes to your inventory, or to the floor',
        ],
        revealed: true,
      },
    ],
  },
  {
    tier: 7,
    points: 200000,
    passives: ['+750% drop rate', '40x XP rate', 'Tier 7 relics can be reset with a Demonic Reset card'],
    unlocks: ['Codex: Ancient Awakening (Legendary to Ancient)'],
    combat: true,
    relics: [
      {
        id: 'fiery-fashion',
        name: 'Fiery Fashion',
        icon: 'Fiery_fashion_perk.png',
        summary: 'Powers on transmog items apply too.',
        effects: [
          'Demonic powers on items in your transmog slots also apply',
          "Each power still counts once, and you must meet the item's level requirements",
        ],
        revealed: true,
      },
      {
        id: 'critty-city',
        name: 'Critty City',
        icon: 'Critty_city_perk.png',
        summary: 'Prayer bonus becomes crit chance and damage.',
        effects: [
          'Gain the Infernal Codex: +50 prayer bonus while it is in your inventory',
          'Gain 0.2% critical strike chance and 0.2% damage per prayer bonus',
          'Critical strike chance is capped at 50%. Each 1% above the cap becomes +1% extra critical damage, up to +150%',
        ],
        revealed: true,
      },
      {
        id: 'captain-no-flicks',
        name: 'Captain No Flicks',
        icon: 'Captain_no_flicks_perk.png',
        summary: 'Omni prayer and doubled prayer bonuses.',
        effects: [
          'Unlock the Omni prayer: protection from melee, ranged, and magic at the same time',
          'Prayers give double their combat bonuses',
          'Deal 3% more damage per active prayer',
        ],
        revealed: true,
      },
    ],
  },
];

export const relicById = new Map(RELIC_TIERS.flatMap((t) => t.relics.map((r) => [r.id, r] as const)));
export const tierOfRelic = new Map(RELIC_TIERS.flatMap((t) => t.relics.map((r) => [r.id, t.tier] as const)));

// ---------- League Prestiging ----------

/** Ironman accounts can prestige twice, for three playthroughs in all. */
export const MAX_PLAYTHROUGHS = 3;
/** Reloaded grants one extra relic from these tiers. */
export const RELOADED_TIERS = [1, 2, 3];
