// Reference builds and notes for the Builds page.
//
// Two kinds of advice live here, and the page labels them:
// - "community": from build notes a player shared (one main author so far, so treat it as one opinion).
// - "theory": worked out from the game data and the community notes, not tested in game.
//
// Every build piece names a real game item. The Builds page checks each piece against that item's
// affix and power pools and the planner's slot rules when the site builds, so a piece that can't
// exist fails the build instead of reaching the page.

import { gameAffixes, gamePowers, itemById, type GameItem } from './game';
import { affixById, powerById, SLOTS } from './league';
import { itemIssues, type Issue } from '../lib/rules';
import type { NamedLoadout, PlannedItem, Slot, Style, Variant } from '../lib/types';

export type Verdict = 'core' | 'good' | 'situational' | 'skip';
export type Source = 'community' | 'theory';

export const VERDICT_LABEL: Record<Verdict, string> = {
  core: 'Core',
  good: 'Good',
  situational: 'Situational',
  skip: 'Skip',
};

// ---------- affix notes ----------
//
// Our own summaries: what each affix does, its cap, and how many top-tier rolls reach it.
// Top-tier counts assume Ancient items (+20%), as the endgame builds do.

export interface AffixNote {
  id: string;
  verdict: Verdict;
  note: string;
}

export const AFFIX_NOTES: AffixNote[] = [
  // Offence
  { id: 'arcane', verdict: 'core', note: 'Magic strength with no cap, so every roll adds damage. The safest offence pick on any magic piece.' },
  { id: 'brutal', verdict: 'core', note: 'Melee strength with no cap, so every roll adds damage. The safest offence pick on any melee piece.' },
  { id: 'heavy', verdict: 'core', note: 'Ranged strength with no cap, so every roll adds damage. The safest offence pick on any ranged piece.' },
  {
    id: 'elemental',
    verdict: 'core',
    note: 'Up to +75% damage per roll on air, water, earth and fire spells, capped at +300% across your gear: about four top rolls. No melee or ranged affix comes close.',
  },
  {
    id: 'precise',
    verdict: 'core',
    note: 'Crit chance, up to 10% a roll, capped at 100% from all sources. It takes many rolls to matter, so it pays off late. With the Critty City relic the cap drops to 50%, and crit chance above it becomes crit damage instead.',
  },
  { id: 'lethal', verdict: 'good', note: 'Adds to the 1.75x crit multiplier. Worth it once your crit chance is high; weak before that.' },
  {
    id: 'penetrating',
    verdict: 'core',
    note: 'Ignores part of a target’s protection prayer. One Ancient top roll gives 60% of the 75% cap, so a single roll anywhere does the job.',
  },
  {
    id: 'attuned',
    verdict: 'good',
    note: 'Removes part of a target’s defence-based mitigation, capped at 50%. Two top rolls pass the cap, so one is plenty.',
  },
  {
    id: 'juggernaut',
    verdict: 'good',
    note: 'Damage from your highest defence bonus. Only pays off if you also stack one defence stat (Warded, Grounded or Shielding), so it suits a shield slot in a tanky build.',
  },
  { id: 'echoing', verdict: 'situational', note: 'A chance to repeat each attack. Fine, but up to 16% a roll is small next to strength.' },
  {
    id: 'executioner',
    verdict: 'situational',
    note: 'Bonus damage below 40% HP. Only your strongest finisher effect counts, so it’s wasted next to Finisher or similar powers.',
  },
  { id: 'flanking', verdict: 'situational', note: 'Needs you to attack from the side or behind. Useful on bosses where that’s easy to do.' },
  { id: 'searing', verdict: 'situational', note: 'Each burn deals three hits of up to a third of your max hit, so a full burn is worth up to one extra max hit. Fine as a side bonus.' },
  { id: 'serrated', verdict: 'situational', note: 'Each bleed deals five ticks of a tenth of your max hit, so a full bleed is worth half a max hit. Fine as a side bonus.' },
  // Defence
  {
    id: 'guarded',
    verdict: 'core',
    note: 'Takes a flat amount off every hit, with no cap. Against bosses that hit often, it adds up faster than any other defence.',
  },
  {
    id: 'stalwart',
    verdict: 'core',
    note: 'Percent damage reduction, capped at 30%: about four Ancient top rolls. Stack it toward the cap, but rolls past it are wasted.',
  },
  { id: 'elusive', verdict: 'good', note: 'Dodge chance, capped at 20%. Two Ancient top rolls already pass the cap, so stop at one or two.' },
  { id: 'vital', verdict: 'good', note: 'Max HP with no cap. Solid, but Guarded and Stalwart cut more damage per roll.' },
  { id: 'vampiric', verdict: 'good', note: 'Heals a share of the damage you deal. Bleed and burn ticks don’t count. One roll covers most sustain.' },
  { id: 'fleetfooted', verdict: 'situational', note: 'Up to 50% less damage from attacks while you move. Strong if the fight keeps you walking.' },
  { id: 'purified', verdict: 'situational', note: 'Top tier makes you immune to poison and venom. A spare pair of boots with it covers the fights that need it.' },
  {
    id: 'grounded',
    verdict: 'situational',
    note: 'Magic defence. Mainly useful to feed Juggernaut or a reflect build. Warded (melee) and Shielding (ranged) work the same way.',
  },
  { id: 'barbed', verdict: 'situational', note: 'Reflects a share of each hit. Only worth it in a build designed around reflection.' },
  { id: 'bulwark', verdict: 'situational', note: 'Reflects more the more defence you have. Only worth it in a build designed around reflection.' },
  { id: 'undying', verdict: 'situational', note: 'A chance to survive a killing blow. Niche: a well-geared build rarely dies anyway.' },
  { id: 'bloodthirsty', verdict: 'skip', note: 'Heals on kill, which does little in long boss fights.' },
  // Utility
  {
    id: 'zealot',
    verdict: 'core',
    note: 'Damage per active prayer, capped at +16% per prayer and +50% in total. Four Ancient top rolls give 14.4% per prayer, which reaches the 50% total with four prayers active.',
  },
  { id: 'devout', verdict: 'core', note: 'Cuts prayer drain by up to 70%, which is its cap. One top roll keeps prayers up almost for free.' },
  { id: 'prosperous', verdict: 'core', note: 'Drop rate, capped at +50%: about three Ancient top rolls. Worth the utility slots on any farming set.' },
  { id: 'hordemaster', verdict: 'situational', note: 'Summons attack faster. Core for a minion build, otherwise skip.' },
  { id: 'commanding', verdict: 'situational', note: 'Summons hit harder. Core for a minion build, otherwise skip.' },
  { id: 'legion-echo', verdict: 'situational', note: 'An extra thrall per thrall type, if you already have thralls from a spell. Counts toward Pack Leader.' },
  { id: 'bloodworm-nest', verdict: 'situational', note: 'Extra bloodworms, if you already have one from another source. Counts toward Pack Leader.' },
  { id: 'blessed', verdict: 'situational', note: 'Prayer bonus. Worth stacking for things that scale with it: Hammerdin, and the Critty City relic, which turns prayer bonus into crit chance and damage.' },
  { id: 'gluttonous', verdict: 'situational', note: 'Eat faster. Helps while your defences are thin; less useful later.' },
  { id: 'hearty', verdict: 'situational', note: 'Food heals more. Helps while your defences are thin; less useful later.' },
  { id: 'renewing', verdict: 'situational', note: 'Faster natural regeneration. Handy for AFK training before you have lifesteal.' },
  { id: 'restorative', verdict: 'situational', note: 'More HP per regeneration tick. Handy for AFK training before you have lifesteal.' },
  { id: 'sparing', verdict: 'situational', note: 'A chance not to use up food. Good while you eat a lot; less useful later.' },
  {
    id: 'expeditious-chance',
    verdict: 'situational',
    note: 'Only rolls on slayer bracelets. Slayer’s Mark keeps you on task everywhere, so this matters mostly for slayer achievements.',
  },
  {
    id: 'slaughter-chance',
    verdict: 'situational',
    note: 'Only rolls on slayer bracelets. Slayer’s Mark keeps you on task everywhere, so this matters mostly for slayer achievements.',
  },
  { id: 'efficient', verdict: 'situational', note: 'Cheaper specials, and a higher proc chance for the Ravaging Ripper relic. Worth it with Ravaging Ripper or a build that specs by hand; skip it otherwise.' },
  { id: 'reverent', verdict: 'skip', note: 'Stronger prayer potions. Devout makes prayer drain small enough that you rarely need them.' },
];

// ---------- power notes ----------

export interface PowerNote {
  id: string;
  group: string;
  verdict: Verdict;
  note: string;
}

export const POWER_GROUPS = ['Any style: damage', 'Any style: AFK and utility', 'Any style: defence', 'Melee', 'Magic', 'Ranged'];

export const POWER_NOTES: PowerNote[] = [
  { id: 'pious-fury', group: 'Any style: damage', verdict: 'core', note: 'Up to +5% damage per active prayer, capped at +50%. It stacks with how you already play.' },
  {
    id: 'edgemasters-adrenaline',
    group: 'Any style: damage',
    verdict: 'good',
    note: 'Up to +40% damage at full special energy. Spending energy weakens it, so it suits builds that don’t spec by hand.',
  },
  {
    id: 'quickened',
    group: 'Any style: damage',
    verdict: 'good',
    note: 'Attacks one tick faster (never below 2 ticks). The rolled value has no effect, so any copy works, even from low-level gear.',
  },
  {
    id: 'slayers-mark',
    group: 'Any style: damage',
    verdict: 'core',
    note: 'Counts you as on task everywhere and strengthens your slayer helm’s bonus. Almost free value on a head or neck.',
  },
  {
    id: 'executioners-mark',
    group: 'Any style: damage',
    verdict: 'good',
    note: 'Bonus damage on low-health targets. Strong while your damage is low; replace it once better powers come along.',
  },
  { id: 'pack-leader', group: 'Any style: damage', verdict: 'good', note: 'Up to +8% damage per active summon, up to 4. It needs summons from somewhere else: a power like Guardian or Thrall Pact, or thrall and bloodworm affixes.' },
  {
    id: 'greater-imp-ascension',
    group: 'Magic',
    verdict: 'good',
    note: 'Gives you an imp if you have none, and turns your imps into Greater Imps with up to 60% more damage. A strong early power.',
  },
  { id: 'thrall-pact', group: 'Any style: damage', verdict: 'good', note: 'Keeps a matching Greater Thrall fighting with you. Good early help for any style.' },
  { id: 'guardian', group: 'Any style: damage', verdict: 'good', note: 'Summons a Guardian that fights with you. Good early help for any style.' },
  { id: 'imp-familiar', group: 'Any style: damage', verdict: 'good', note: 'One or two imps fight with you. Combines with Greater Imp Ascension.' },
  {
    id: 'arsonists-trail',
    group: 'Any style: damage',
    verdict: 'situational',
    note: 'Burns the tiles you walk over. Flat damage, so it matters most early and against enemies you can walk around.',
  },
  {
    id: 'berserker',
    group: 'Any style: damage',
    verdict: 'situational',
    note: 'More damage the lower your HP. Lifesteal and healing keep your HP high, so it’s hard to keep active.',
  },
  {
    id: 'sigil-of-finality',
    group: 'Any style: damage',
    verdict: 'situational',
    note: 'Charges up, then makes your next special a max hit, x2 to x3.5. Strong with a weapon whose special hits hard.',
  },
  {
    id: 'kbds-breath',
    group: 'Any style: damage',
    verdict: 'good',
    note: 'Boss power. Every third hit adds a breath attack, so it’s free damage in a shield slot that has nothing better.',
  },
  {
    id: 'jads-reflection',
    group: 'Any style: damage',
    verdict: 'good',
    note: 'Boss power. Hits that your overhead prayer fully blocks are reflected back at the attacker.',
  },
  { id: 'hammerdin', group: 'Any style: AFK and utility', verdict: 'good', note: 'Holy hammers hit everything around you, scaling with prayer bonus. The base of most AFK sets.' },
  { id: 'ricochet', group: 'Any style: AFK and utility', verdict: 'good', note: 'Ranged hits bounce to nearby enemies. Run it alongside Hammerdin for AoE.' },
  { id: 'spell-ricochet', group: 'Any style: AFK and utility', verdict: 'good', note: 'Magic hits bounce to nearby enemies. Run it alongside Hammerdin for AoE.' },
  { id: 'storm-touched', group: 'Any style: AFK and utility', verdict: 'situational', note: 'Chain lightning off melee and magic attacks. Extra AoE for an AFK set.' },
  { id: 'zeus-wrath', group: 'Any style: AFK and utility', verdict: 'situational', note: 'Smites up to 5 enemies around your target. Extra AoE for an AFK set.' },
  { id: 'exploding-attacks', group: 'Any style: AFK and utility', verdict: 'situational', note: 'Splash damage to up to 9 enemies. Extra AoE for an AFK set.' },
  { id: 'clue-resurgence', group: 'Any style: AFK and utility', verdict: 'good', note: 'Boss power. A finished clue can restart itself, up to 100% of the time. Where it drops isn’t confirmed.' },
  { id: 'loot-vacuum', group: 'Any style: AFK and utility', verdict: 'good', note: 'Loot can bank itself as it drops, up to 100% of the time. Great for long AFK sessions.' },
  { id: 'bark-skin', group: 'Any style: defence', verdict: 'situational', note: 'Absorbs part of incoming hits. Use it when a slot has no better power.' },
  { id: 'shielded-faith', group: 'Any style: defence', verdict: 'situational', note: 'Less damage taken while you hold a shield. Use it when a slot has no better power.' },
  { id: 'renewal', group: 'Any style: defence', verdict: 'situational', note: 'Restores HP over time, and restores prayer out of combat or after 30 seconds with no prayers on. Helpful early, especially for AFK training.' },
  {
    id: 'aftershock',
    group: 'Melee',
    verdict: 'core',
    note: 'Up to two extra hits per strike, and +10% damage on a hammer. It only works with hammers, mauls, bludgeons and extending chainmaces.',
  },
  { id: 'colossus-stride', group: 'Melee', verdict: 'core', note: 'One or two tiles of extra melee reach. Boots have few good affixes, so this power costs little to fit.' },
  { id: 'arcane-echo', group: 'Magic', verdict: 'core', note: 'Spellbook casts fire up to two extra projectiles. Works with staves and staff halberds only.' },
  {
    id: 'convention-of-the-elements',
    group: 'Magic',
    verdict: 'core',
    note: 'Up to +100% damage with the element of the moment. You have to switch spells as the element rotates.',
  },
  { id: 'sanguine-tithe', group: 'Magic', verdict: 'core', note: 'Up to +45% spell damage, for 10% of your current HP per cast. You need lifesteal or healing that keeps up.' },
  { id: 'overdraw-ballista', group: 'Ranged', verdict: 'good', note: 'One tick slower, but up to +85% max hit, and damage rolls twice keeping the higher.' },
  { id: 'snipers-perch', group: 'Ranged', verdict: 'good', note: 'Up to +50% damage at 10 tiles, less as you get closer.' },
  { id: 'point-blank', group: 'Ranged', verdict: 'situational', note: 'Rewards standing close, so it works against Sniper’s Perch and Eye of Armadyl.' },
  { id: 'eye-of-armadyl', group: 'Ranged', verdict: 'good', note: 'Halves the target’s mitigation, and adds damage per tile of distance up to 8 tiles.' },
  { id: 'headhunter', group: 'Ranged', verdict: 'situational', note: 'Every fifth hit on the same target is a headshot. Best on long single-target fights.' },
  { id: 'momentum', group: 'Ranged', verdict: 'situational', note: 'Builds charges over consecutive hits. Best on long single-target fights.' },
  { id: 'twisted-hunger', group: 'Ranged', verdict: 'situational', note: 'Scales with the target’s Magic level, so it only shines against high-Magic bosses.' },
  { id: 'trickshot-evasion', group: 'Ranged', verdict: 'situational', note: 'Dodge chance while moving. Only good in fights where you keep moving.' },
];

// ---------- builds ----------

/** [affix id, tier] */
export type BuildAffix = [string, number];

export interface BuildPiece {
  slot: Slot;
  /** Game item id. */
  item: number;
  /** Item level when it beats the base, e.g. crafted with Master's Mark. */
  ilvl?: number;
  /** Rarity to plan for, when the base rarity is lower (Legendary Awakening). */
  rarity?: 'legendary';
  affixes: BuildAffix[];
  power: string | null;
  note?: string;
}

export interface Build {
  id: string;
  name: string;
  style: Exclude<Style, 'any'>;
  source: Source;
  /** Who shared a community build. */
  author?: string;
  summary: string;
  variant: Variant;
  pieces: BuildPiece[];
  notes: string[];
}

export const BUILDS: Build[] = [
  {
    id: 'mage-endgame',
    name: 'Magic: endgame, before Masterwork',
    style: 'magic',
    source: 'community',
    author: '& Enjoyer',
    summary:
      'Arcane strength everywhere, Elemental close to its cap, crit, Guarded and Stalwart for defence, and Zealot, Devout and Prosperous for utility.',
    variant: 'ancient',
    pieces: [
      { slot: 'weapon', item: 60702, affixes: [['arcane', 4], ['precise', 5], ['arcane', 5]], power: 'arcane-echo' },
      {
        slot: 'head',
        item: 61879,
        affixes: [['arcane', 4], ['arcane', 4], ['attuned', 4], ['guarded', 4], ['guarded', 4], ['stalwart', 4]],
        power: 'slayers-mark',
        note: 'The original build had Devout here, but heads can’t roll utility affixes, so Devout moves to the shield and Stalwart takes its place. Poseidon’s crown (Olympian raid) rolls the same affixes.',
      },
      {
        slot: 'neck',
        item: 60690,
        affixes: [['zealot', 3], ['zealot', 3], ['penetrating', 5], ['precise', 5], ['arcane', 5], ['vampiric', 5]],
        power: 'sanguine-tithe',
        note: 'Amulet of the monarchs also works.',
      },
      {
        slot: 'body',
        item: 62813,
        affixes: [['arcane', 5], ['precise', 5], ['elemental', 3], ['stalwart', 5], ['guarded', 5], ['guarded', 5]],
        power: null,
      },
      {
        slot: 'shield',
        item: 27251,
        affixes: [['juggernaut', 3], ['arcane', 5], ['stalwart', 5], ['guarded', 5], ['stalwart', 5], ['devout', 5]],
        power: 'jads-reflection',
        note: 'Devil’s element (Olympian raid, hard) is a shield alternative at item level 115.',
      },
      {
        slot: 'cape',
        item: 62804,
        affixes: [['arcane', 5], ['prosperous', 5], ['prosperous', 5], ['grounded', 5], ['grounded', 5]],
        power: 'clue-resurgence',
      },
      {
        slot: 'legs',
        item: 62819,
        affixes: [['precise', 5], ['arcane', 5], ['elemental', 3], ['guarded', 5], ['guarded', 5]],
        power: 'pack-leader',
      },
      { slot: 'hands', item: 60699, affixes: [['elemental', 3], ['precise', 5], ['precise', 5]], power: 'quickened' },
      { slot: 'feet', item: 61876, affixes: [['precise', 5], ['precise', 5], ['elusive', 5], ['fleetfooted', 5]], power: null },
      {
        slot: 'ring',
        item: 30378,
        affixes: [['zealot', 3], ['zealot', 3], ['precise', 5], ['arcane', 5], ['arcane', 5]],
        power: 'convention-of-the-elements',
      },
    ],
    notes: [
      'Cast air, water, earth and fire spells: Elemental and Convention of the Elements only boost those, and Convention wants you to follow its element rotation.',
      'Sanguine Tithe costs 10% of your current HP per cast. Check that your lifesteal keeps up.',
      'Pack Leader needs active summons, and this build has none. The author suggests a thrall or bloodworm affix; Guardian or Thrall Pact in the free body power slot also works.',
      'The author leaves some affix and power slots free on purpose: fill them with whatever you need.',
      'The author expects Masterwork to boost these items further and free up affix slots. It isn’t planned here because so little is known about it.',
      'For smithed gear, the author recommends Master’s Mark, which makes it roll affixes as if up to 10 levels higher.',
      'Doubled affixes (two Arcane, two Guarded) come from transplanting an affix onto an item that already has it.',
    ],
  },
  {
    id: 'melee-endgame',
    name: 'Melee: endgame',
    style: 'melee',
    source: 'theory',
    summary:
      'The magic build’s plan applied to melee: Brutal everywhere, crit toward the cap, Guarded and Stalwart, and Zealot, Devout and Prosperous. Melee has no Elemental, so the slots it used go to more strength and crit.',
    variant: 'ancient',
    pieces: [
      {
        slot: 'weapon',
        item: 60708,
        affixes: [['brutal', 5], ['brutal', 5], ['precise', 5]],
        power: 'aftershock',
        note: 'One-handed, so you keep a shield. Aftershock only rolls on hammers, which this is.',
      },
      { slot: 'head', item: 28254, affixes: [['brutal', 5], ['brutal', 5], ['attuned', 5], ['guarded', 5], ['guarded', 5], ['stalwart', 5]], power: 'slayers-mark' },
      {
        slot: 'neck',
        item: 30376,
        affixes: [['zealot', 3], ['zealot', 3], ['penetrating', 5], ['precise', 5], ['brutal', 5], ['vampiric', 5]],
        power: 'pious-fury',
      },
      {
        slot: 'body',
        item: 28256,
        affixes: [['brutal', 5], ['precise', 5], ['lethal', 5], ['stalwart', 5], ['guarded', 5], ['guarded', 5]],
        power: 'guardian',
        note: 'Guardian keeps a summon up for Pack Leader.',
      },
      {
        slot: 'shield',
        item: 60696,
        affixes: [['juggernaut', 3], ['brutal', 5], ['stalwart', 5], ['guarded', 5], ['stalwart', 5], ['devout', 5]],
        power: 'kbds-breath',
      },
      {
        slot: 'cape',
        item: 62479,
        affixes: [['brutal', 5], ['prosperous', 5], ['prosperous', 5], ['warded', 5], ['warded', 5]],
        power: 'clue-resurgence',
        note: 'Warded stacks melee defence for Juggernaut.',
      },
      { slot: 'legs', item: 28258, affixes: [['brutal', 5], ['precise', 5], ['lethal', 5], ['guarded', 5], ['guarded', 5]], power: 'pack-leader' },
      { slot: 'hands', item: 60693, affixes: [['brutal', 5], ['precise', 5], ['precise', 5]], power: 'quickened' },
      {
        slot: 'feet',
        item: 61876,
        affixes: [['precise', 5], ['precise', 5], ['elusive', 5], ['fleetfooted', 4]],
        power: 'colossus-stride',
        note: 'Fleetfooted IV is enough: a top V roll on Ancient gear passes the 50% cap.',
      },
      {
        slot: 'ring',
        item: 30378,
        affixes: [['zealot', 3], ['zealot', 3], ['precise', 5], ['brutal', 5], ['brutal', 5]],
        power: 'edgemasters-adrenaline',
      },
    ],
    notes: [
      'Radiant oathplate (from Yama) is the other item level 120 melee set, and rolls the same affixes as Sanguine torva.',
      'The Sanguine Scythe and Hephaestus’ dual hammers are two-handed: they cost you the shield and its Juggernaut roll.',
      'Edgemaster’s Adrenaline wants full special energy, so don’t spec by hand with it.',
    ],
  },
  {
    id: 'ranged-endgame',
    name: 'Ranged: endgame',
    style: 'ranged',
    source: 'theory',
    summary:
      'The same plan for ranged: Heavy everywhere, crit toward the cap, and the long-range powers (Sniper’s Perch, Eye of Armadyl). The community thinks ranged is held back this league.',
    variant: 'ancient',
    pieces: [
      {
        slot: 'weapon',
        item: 60711,
        affixes: [['heavy', 5], ['heavy', 5], ['precise', 5]],
        power: 'eye-of-armadyl',
        note: 'One-handed, so you keep a shield.',
      },
      { slot: 'head', item: 27235, affixes: [['heavy', 5], ['heavy', 5], ['attuned', 5], ['guarded', 5], ['guarded', 5], ['stalwart', 5]], power: 'slayers-mark' },
      {
        slot: 'neck',
        item: 30376,
        affixes: [['zealot', 3], ['zealot', 3], ['penetrating', 5], ['precise', 5], ['heavy', 5], ['vampiric', 5]],
        power: 'pious-fury',
      },
      {
        slot: 'body',
        item: 27238,
        affixes: [['heavy', 5], ['precise', 5], ['lethal', 5], ['stalwart', 5], ['guarded', 5], ['guarded', 5]],
        power: 'snipers-perch',
        note: 'Sniper’s Perch and Eye of Armadyl both want distance. Don’t pair them with Point Blank.',
      },
      {
        slot: 'shield',
        item: 12817,
        rarity: 'legendary',
        affixes: [['juggernaut', 3], ['heavy', 4], ['stalwart', 4], ['guarded', 4], ['stalwart', 4], ['devout', 4]],
        power: 'kbds-breath',
        note: 'Epic at base, with a 75% chance to drop as Legendary instead. Otherwise Legendary Awakening gives it a power slot. At item level 100 it tops out at Tier IV. Ranged has no better shield with a known source.',
      },
      {
        slot: 'cape',
        item: 60531,
        rarity: 'legendary',
        affixes: [['heavy', 5], ['prosperous', 5], ['prosperous', 5], ['shielding', 5], ['shielding', 5]],
        power: 'clue-resurgence',
        note: 'Epic at base, with a 75% chance to drop as Legendary instead. Otherwise Legendary Awakening gives it a power slot. Shielding stacks ranged defence for Juggernaut.',
      },
      {
        slot: 'legs',
        item: 27241,
        affixes: [['heavy', 5], ['precise', 5], ['lethal', 5], ['guarded', 5], ['guarded', 5]],
        power: 'finisher',
        note: 'Pack Leader would need a summon, and the ranged body power is taken, so this uses Finisher.',
      },
      { slot: 'hands', item: 26235, affixes: [['heavy', 5], ['precise', 5], ['precise', 5]], power: 'quickened' },
      { slot: 'feet', item: 61876, affixes: [['precise', 5], ['precise', 5], ['elusive', 5], ['fleetfooted', 4]], power: null },
      {
        slot: 'ring',
        item: 30378,
        affixes: [['zealot', 3], ['zealot', 3], ['precise', 5], ['heavy', 5], ['heavy', 5]],
        power: 'edgemasters-adrenaline',
      },
    ],
    notes: [
      'Overdraw Ballista is the other strong weapon power, if you’d rather trade a tick of speed for bigger, luckier hits.',
      'Luminary armour (Olympian raid) rolls the same affixes as Masori (f).',
      'Edgemaster’s Adrenaline wants full special energy, so don’t spec by hand with it.',
    ],
  },
];

// ---------- early game ----------

export const EARLY_GAME: { title: string; points: string[] }[] = [
  {
    title: 'What your item level allows',
    points: [
      'Affixes roll Tier II from item level 60, Tier III from 90, Tier IV from 105 and Tier V from 115.',
      'Improve goes further: Tier II from 30, III from 55, IV from 85 and V from 105. On early gear, improving a keeper gets you higher tiers than rolling for new drops.',
      'Demonic Powers are capped by item level too: about 35% strength at 60, 50% at 80, 70% at 90, and full strength from 100.',
    ],
  },
  {
    title: 'Making early gear count',
    points: [
      'Caps take many high-tier rolls to reach, so early on, uncapped stats give more per roll: your style’s strength, Guarded and Vital.',
      'Improve never fails, so put Forge materials into the few pieces you’ll keep, and melt the rest.',
      'Bank powers from your highest-level Legendary drops. A stamp uses the strength banked in your Codex, so one good copy covers every item you stamp it on later.',
      'Quickened works at any strength, so an early copy is as good as a late one.',
    ],
  },
];

// ---------- skilling ----------

export const SKILLING_NOTES: string[] = [
  'Affixed tools on your toolbelt stack with what you wear, so a skill’s affixes can come from both (confirmed by a moderator).',
  'Skilling outfit pieces don’t only roll their own skill’s affixes: check a piece’s Items page to see what else it can carry.',
  'The Ring of 3rd Age can roll almost every skilling affix, so one ring can serve whichever skill you’re training.',
  'For most skills, take whatever adds XP or speeds actions up. These stand out:',
];

export const SKILLING_AFFIXES: { id: string; note: string }[] = [
  { id: 'become-the-event', note: 'A chance for seeds to grow instantly, up to 100% when stacked. Works on trees and Hespori.' },
  { id: 'essence-weaver', note: 'A chance not to use up essence, up to 75%. Doesn’t stack with the Tier 1 relic.' },
  { id: 'fire-stoker', note: 'Burns more logs at once, up to double per roll.' },
  { id: 'masters-mark', note: 'Armour and weapons you smith roll their affixes as if 2 to 5 item levels higher, up to +10. Many endgame crafts are smithed, so it matters for gear.' },
  { id: 'fletchers-mark', note: 'Bows, crossbows, blowpipes and ballistas you fletch roll their affixes as if 2 to 5 item levels higher, up to +10.' },
  { id: 'frugal', note: 'A chance to save production materials, up to 35%.' },
  { id: 'masterstroke', note: 'A chance to double production output, up to 35%.' },
  { id: 'lost-treasure', note: 'A chance to fish up clue caskets.' },
  { id: 'telekinetic-hands', note: 'A chance to bank what you gather. Works from tools on your toolbelt.' },
  { id: 'tireless-hands', note: 'Hundreds of extra gathering repetitions per action. Works from your toolbelt.' },
];

// ---------- where to farm ----------

export interface FarmSource {
  source: string;
  gives: string;
  notes?: string;
}

export const FARM_SOURCES: FarmSource[] = [
  {
    source: 'Olympian raid (hard mode)',
    gives:
      'Hecate’s wisdom, Heavenly crossbow, Hephaestus’ hammer, Devil’s element, Heatwave pendant, Divine handguards, Summoner’s wraps, Titanforged defender',
    notes: 'August’s custom raid. Entry costs some gp, which is small by the time you’re ready for it. The hard mode holds most of the best gear in all three builds.',
  },
  {
    source: 'Olympian raid (both modes)',
    gives: 'Poseidon’s crown, brassard and tassets, Poseidon’s trident, Cape of the seas, Talaria, Luminary armour, Titanforged armour and pavis, Heavenly bow, Kodai wand',
  },
  {
    source: 'Yama',
    gives: 'Oathplate helm, chest and legs, and Oathplate shards',
    notes: 'Upgrade each piece to Radiant oathplate with a Purifying sigil (five pieces, each a guaranteed solo Yama contract reward) and shards.',
  },
  {
    source: 'Nex and Azrael',
    gives: 'Damaged Torva, Zaryte vambraces, Nihil shards. Azrael (hard-mode Nex) also drops the Ancient blood ornament kit',
    notes: 'Damaged Torva and Nihil shards make Torva: the helm with a Neitiznot faceguard, the body and legs with Bandos gear. Then the kit makes Sanguine torva.',
  },
  {
    source: 'Dagannoth Kings (echo)',
    gives: 'Talisman and Eye of the monarchs',
    notes:
      'Unlock the echo kings by having all three dead at once, solo, without taking damage. The talisman makes the Emperor ring, the eye the Amulet of the monarchs. The talisman also goes into the Heatwave pendant and Devil’s element.',
  },
  { source: 'Sol Heredit (echo)', gives: 'Echo fanatic armour, Echo Dizana’s quiver, Echo splinters for echo crafting' },
  { source: 'Fortis Colosseum', gives: 'Sunfire fanatic armour, Dizana’s quiver, the Echo crystal for Echo boots' },
  { source: 'Theatre of Blood', gives: 'Judicator armour, Scythe of vitur. Hard mode adds the Sanguine ornament kit' },
  { source: 'Tombs of Amascut', gives: 'Tumeken’s shadow, Masori armour, Elidinis’ ward. Its bosses drop Masori crafting kits' },
  { source: 'Zulrah', gives: 'Tanzanite fang and mutagen, for the Tanzanite crest' },
];

/** How to get each item the builds use. "Craft" lines name the skill, so you know when Master's or Fletcher's Mark helps. */
export const ITEM_SOURCES: Record<number, string> = {
  60702: 'Olympian raid (hard), or a Runecrafting craft from Poseidon’s trident',
  61879: 'Smithing 105 craft from Zulrah and Danger Snek drops',
  60690: 'Olympian raid (hard), or a Smithing craft with a Talisman of the monarchs',
  62813: 'Olympian raid, or a Crafting 100 loom craft',
  27251: 'Runecrafting 110 craft: Arcane spirit shield and Elidinis’ ward (Tombs of Amascut)',
  62804: 'Olympian raid, or a Crafting 100 loom craft',
  62819: 'Olympian raid, or a Crafting 100 loom craft',
  60699: 'Olympian raid (hard), or a Crafting loom craft',
  61876: 'Olympian raid, or a Smithing 100 craft',
  30378: 'Crafting 99: four Emperors rings, each from a Talisman of the monarchs (echo Dagannoth Kings)',
  60708: 'Olympian raid (hard), or a Smithing craft from the Titanforged maul',
  28254: 'Smithing 105: Torva (Nex) with Azrael’s Ancient blood ornament kit',
  28256: 'Smithing 105: Torva (Nex) with Azrael’s Ancient blood ornament kit',
  28258: 'Smithing 105: Torva (Nex) with Azrael’s Ancient blood ornament kit',
  30376: 'Crafting 99: three Monarchs amulets, each from an Eye of the monarchs (echo Dagannoth Kings)',
  60696: 'Olympian raid (hard), or a Smithing craft from three Avernic defenders',
  62479: 'Olympian raid, or a Smithing 100 craft with 6 Bandos components',
  60693: 'Olympian raid (hard), or a Crafting loom craft',
  60711: 'Olympian raid (hard), or a Fletching craft from a Zaryte crossbow',
  27235: 'Smithing 105: Masori mask (Tombs of Amascut) with an Armadyl helmet',
  27238: 'Smithing 105: Masori body (Tombs of Amascut) with an Armadyl chestplate',
  27241: 'Smithing 105: Masori chaps (Tombs of Amascut) with an Armadyl chainskirt',
  12817: 'Corporeal Beast’s Elysian sigil on a Blessed spirit shield, as in OSRS (not confirmed on August)',
  60531: 'Echo Sol Heredit (very rare), or a Prayer 90 and Smithing 90 craft from Dizana’s quiver and Echo splinters',
  26235: 'Nex and Azrael (rare)',
};

// ---------- turning builds into planner loadouts ----------

const STYLE_OF: Record<string, Exclude<Style, 'any'>> = { Melee: 'melee', Ranged: 'ranged', Magic: 'magic' };

function styleOf(game: GameItem): Style {
  return game.styles.length === 1 ? STYLE_OF[game.styles[0]] : 'any';
}

export function pieceItem(piece: BuildPiece, variant: Variant): PlannedItem {
  const game = itemById.get(piece.item)!;
  return {
    name: game.name,
    rarity: piece.rarity ?? game.rarity,
    variant,
    ilvl: piece.ilvl ?? game.ilvl,
    style: styleOf(game),
    twoHanded: game.twoHanded,
    affixes: piece.affixes.map(([affixId, tier]) => ({ affixId, tier, value: null })),
    powerId: piece.power,
    gameId: game.id,
  };
}

export function buildLoadout(build: Build, id: string = crypto.randomUUID()): NamedLoadout {
  return {
    id,
    name: build.name,
    kind: 'combat',
    items: Object.fromEntries(build.pieces.map((p) => [p.slot, pieceItem(p, build.variant)])),
    soulBrands: { weapon: null, armour: null, jewellery: null },
  };
}

/** How you get a build piece's power: it rolls on the item, you stamp it, or it's a boss power. */
export function powerSource(piece: BuildPiece): 'rolls' | 'stamp' | 'boss' | null {
  if (!piece.power) return null;
  if (gamePowers[piece.power]?.rollable === false) return 'boss';
  return itemById.get(piece.item)?.powers.includes(piece.power) ? 'rolls' : 'stamp';
}

/**
 * Everything wrong with a build's pieces. Errors mean the piece can't exist in game; the page
 * refuses to build with any. Warnings (Improve-only tiers, free affix slots) are expected.
 */
export function buildIssues(build: Build): { slot: Slot; issue: Issue }[] {
  const out: { slot: Slot; issue: Issue }[] = [];
  const seen = new Set<Slot>();
  for (const piece of build.pieces) {
    const at = (level: Issue['level'], text: string) => out.push({ slot: piece.slot, issue: { level, text } });
    if (seen.has(piece.slot)) at('error', `Two pieces in the ${piece.slot} slot.`);
    seen.add(piece.slot);
    const game = itemById.get(piece.item);
    if (!game) {
      at('error', `No game item ${piece.item}.`);
      continue;
    }
    if (game.slot !== piece.slot) at('error', `${game.name} is ${game.slot} gear, not ${piece.slot}.`);
    if (!ITEM_SOURCES[piece.item]) at('error', `No source listed for ${game.name} in ITEM_SOURCES.`);
    for (const [id] of piece.affixes) {
      if (!affixById.has(id)) at('error', `Unknown affix "${id}".`);
      else if (!game.affixes.includes(id)) at('error', `${gameAffixes[id]?.name ?? id} doesn't roll on ${game.name}.`);
    }
    if (piece.power && !powerById.has(piece.power)) at('error', `Unknown power "${piece.power}".`);
    for (const issue of itemIssues(piece.slot, pieceItem(piece, build.variant))) out.push({ slot: piece.slot, issue });
  }
  const weapon = build.pieces.find((p) => p.slot === 'weapon');
  if (weapon && itemById.get(weapon.item)?.twoHanded && seen.has('shield'))
    out.push({ slot: 'shield', issue: { level: 'error', text: 'A two-handed weapon leaves no room for a shield.' } });
  return out;
}

export const slotLabel = (s: Slot) => SLOTS.find((x) => x.id === s)?.label ?? s;
