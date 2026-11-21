#!/usr/bin/env node
// Builds src/data/generated/game.json from the Widget Log plugin's output (scraper/out):
// every gear item with the affixes and Demonic Powers it can roll, plus roll weights.
// Run with `npm run import-game-data`. Pass a different output folder as the first argument.
//
// Where each part comes from:
// - Items, affix tiers, and power settings: the client's data tables (scraper/out/data).
// - Weights, and which affixes can roll at all: the ::info Encyclopedia pages (scraper/out/dumps).
// - Utility, skilling, and a few narrow affixes: the Encyclopedia's "Items that can roll this" lists,
//   because the server decides those pools with rules the client doesn't carry.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] ?? join(ROOT, 'scraper/out');
const DATA = join(SRC, 'data');
const OUT = join(ROOT, 'src/data/generated');

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const table = (n) => readJson(join(DATA, `table-${n}.json`));
/** First value of a column. */
const g = (row, col) => row[col]?.[0]?.[0];
const list = (row, col) => row[col]?.[0] ?? [];
const slug = (s) => s.toLowerCase().replace(/['’!]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const strip = (s) => s.replace(/<[^>]+>/g, '').trim();

// ---------- tables ----------

// Every row id in August's tables (9876-9999) that names something, for resolving references.
const label = new Map();
for (const f of await readdir(DATA)) {
  const n = Number(f.match(/^table-(\d+)\.json$/)?.[1]);
  if (!(n >= 9876 && n <= 9999)) continue;
  for (const r of await readJson(join(DATA, f))) if (typeof g(r, '0') === 'string') label.set(r.row, g(r, '0'));
}

const AFFIX = await table(9981);
const POWER = await table(9934);
const POOL = new Map((await table(9933)).map((r) => [r.row, new Set(list(r, '2'))]));
const ITEM = await table(9932);
const SLOT_ROW = new Map((await table(9998)).map((r) => [r.row, g(r, '1')]));
const KIND = new Map((await table(9997)).map((r) => [r.row, g(r, '0')]));
const RARITY_ROWS = await table(9945);
const RARITY = new Map(RARITY_ROWS.map((r) => [r.row, g(r, '1')]));
// Items without their own upgrade chance use their rarity's, in basis points (epic 5%, legendary none).
const DEFAULT_UPGRADE = new Map(RARITY_ROWS.map((r) => [r.row, g(r, '12') ?? 0]));
// Item level to the strongest a Demonic Power can roll, in basis points, interpolated between points.
const [STRENGTH_LEVELS, STRENGTH_CAPS] = (await table(9952))[0]['2'];
const WEAPON_CATEGORY = new Map((await table(9929)).map((r) => [r.row, g(r, '0')]));
const ITEM_TYPE = new Map((await table(9931)).map((r) => [r.row, g(r, '0')]));
const UNIT = new Map((await table(9992)).map((r) => [r.row, g(r, '1')]));
const BASIS_POINTS = 159183;

// An item can have a base equipment row and an override row; the first value per column wins.
const EQUIP = new Map();
for (const r of await table(9928)) {
  const e = EQUIP.get(g(r, '0')) ?? {};
  for (const [c, v] of Object.entries(r)) if (c !== 'row' && !(c in e)) e[c] = v;
  EQUIP.set(g(r, '0'), e);
}
const DEFS = await readJson(join(DATA, 'items.json'));

const WEAR = { 0: 'head', 1: 'cape', 2: 'neck', 3: 'weapon', 4: 'body', 5: 'shield', 7: 'legs', 9: 'hands', 10: 'feet', 12: 'ring' };
const KIND_CATEGORY = { Offense: 'offence', Defense: 'defence', Utility: 'utility', Skilling: 'skilling' };

// Customised items carry a balance type instead of a weapon category. Only three powers look at
// the category (Aftershock, Arcane Echo, Blitz), so only those families need to map correctly.
const TYPE_CATEGORY = {
  Warhammer: 'Hammer', 'Dual Hammers': 'Dual Hammers', Maul: 'Maul', Thrown: 'Thrown', Blowpipe: 'Blowpipe',
  Shortbow: 'Bow', Longbow: 'Bow', 'Charged Shortbow': 'Bow', 'Charged Longbow': 'Bow',
  Crossbow: 'Crossbow', 'Charged Crossbow': 'Crossbow', Ballista: 'Ballista', 'Charged Ballista': 'Ballista',
  Halberd: 'Halberd', Scythe: 'Scythe', Spear: 'Spear', Whip: 'Whip', Claws: 'Claws', Dagger: 'Dagger',
  'Dual Dagger': 'Dual Dagger', 'Heavy Axe': 'Heavy Axe', Bulwark: 'Bulwark', Flail: 'Flail', 'Flail 1H': 'Flail',
  Mace: 'Mace', 'Tribrid Tecpatl': 'Tribrid Tecpatl', Godsword: 'Two Handed', 'Colossal Blade': 'Two Handed',
  'Saradomin Sword': 'Two Handed', Sword: 'Long Sword', 'Shadow Of Tumeken': "Tumeken's Shadow",
  Chinchompa: 'Chinchompa', Atlatl: 'Atlatl', Reprisal: 'Reprisal', 'Osmumten Fang': 'Dagger',
};

function weaponCategory(id, name) {
  const e = EQUIP.get(id) ?? {};
  if (e['14']) return WEAPON_CATEGORY.get(g(e, '14'));
  const type = ITEM_TYPE.get(g(e, '3'));
  if (type?.includes('Magic Weapon')) return /trident/i.test(name) ? 'Trident' : 'Magic Staff';
  return TYPE_CATEGORY[type] ?? type ?? null;
}

/**
 * The table's styles, or else every style the item gives a strength bonus to, or else every style
 * it gives an attack bonus to. Checked against the Encyclopedia's item pages, this matches August's
 * hybrid gear (spirit shields with bonuses to all three styles) where "strongest style" doesn't.
 */
function stylesOf(row, def) {
  if (row['3']) return list(row, '3').map((s) => label.get(s));
  const s = def.stats ?? {};
  const pick = (pairs) => pairs.filter(([, v]) => v > 0).map(([n]) => n);
  const strength = pick([['Melee', s.str], ['Ranged', s.rstr], ['Magic', s.mdmg]]);
  return strength.length
    ? strength
    : pick([['Melee', Math.max(s.astab ?? 0, s.aslash ?? 0, s.acrush ?? 0)], ['Ranged', s.arange], ['Magic', s.amagic]]);
}

// ---------- Encyclopedia pages ----------

/** Visible text under the Encyclopedia's detail pane, in order. */
function pageText(dump) {
  const out = [];
  const walk = (n) => {
    if (n.hidden) return;
    const t = strip(n.text ?? '');
    if (n.id.startsWith('3054:30') && (t || n.item)) out.push(t || `[item ${n.item}]`);
    for (const c of n.children ?? []) walk(c);
  };
  dump.widgets.forEach(walk);
  return out;
}

const SLOT_WORDS = new Set(['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'ammo']);
const STYLE_WORDS = new Set(['Melee', 'Ranged', 'Magic']);
const itemPages = new Map(); // name -> text
const affixPages = new Map(); // name -> { rollable, levels, weights, description }
const rollLists = new Map(); // affix or power name -> { total, pageCount, pages: Set, items: Set("name|ilvl") }

const dumpDir = join(SRC, 'dumps');
for (const f of (await readdir(dumpDir)).filter((f) => f.endsWith('_g3054.json')).sort()) {
  const t = pageText(await readJson(join(dumpDir, f)));
  if (t.length < 3) continue;
  const title = t[0].startsWith('[item') ? t[1] : t[0];
  if (t.includes('Item level')) itemPages.set(title, t);
  if (t.includes('Tiers') || t.includes('No item can roll this affix.')) {
    let i = 1;
    while (i < t.length && !SLOT_WORDS.has(t[i]) && !STYLE_WORDS.has(t[i])) i++;
    affixPages.set(title, {
      description: t[1],
      rollable: !t.includes('No item can roll this affix.'),
      levels: t.flatMap((s) => s.match(/^Lvl (\d+)\+/)?.[1] ?? []).map(Number),
      weights: t.flatMap((s) => s.match(/wt (\d+)$/)?.[1] ?? []).map(Number),
    });
  }
  const count = t.find((s) => s.startsWith('Items that can roll'));
  if (count) {
    const entry = rollLists.get(title) ?? { total: 0, pageCount: 1, pages: new Set(), items: new Set() };
    entry.total = Number(count.match(/\((\d+)\)/)[1]);
    const page = t.map((s) => s.match(/^Page (\d+) of (\d+)$/)).find(Boolean);
    if (page) {
      entry.pages.add(Number(page[1]));
      entry.pageCount = Number(page[2]);
    } else entry.pages.add(1);
    for (const s of t) {
      const m = s.match(/^(.+?)(?: Tier [IVX]+ ·)? Lvl (\d+)$/);
      if (m) entry.items.add(`${strip(m[1])}|${m[2]}`);
    }
    rollLists.set(title, entry);
  }
}

/** "Name · wt 300" lines on an item page. */
const pageWeights = (t) =>
  new Map(t.flatMap((s) => [...s.matchAll(/^(.+?) · wt (\d+)$/g)].map((m) => [m[1], Number(m[2])])));

// ---------- items ----------

const items = [];
for (const r of ITEM) {
  const id = g(r, '0');
  const def = DEFS[id];
  // The equip stats' slot wins: Hecate's wisdom is a staff in its stats and on Encyclopedia pages, but a shield in its cache definition.
  const slot = WEAR[def?.stats?.slot ?? def?.slot];
  if (!def || !slot) continue;
  const name = strip(def.name);
  items.push({
    id,
    name,
    slot,
    ilvl: g(r, '1'),
    rarity: RARITY.get(g(r, '2')) ?? 'common',
    upgrade: (g(r, '8') ?? DEFAULT_UPGRADE.get(g(r, '2')) ?? 0) / 100,
    styles: stylesOf(r, def),
    twoHanded: !!def.stats?.is2h,
    skilling: label.get(g(r, '4')) === 'Skilling equipment',
    neutral: label.get(g(r, '4')) === 'Neutral equipment',
    // Gauntlet gear and the like comes with fixed affixes (column 5) and rolls nothing random.
    fixed: !!r['12'],
    category: weaponCategory(id, name),
    pool: g(r, '6') ?? null,
  });
}
const itemKey = (it) => `${it.name}|${it.ilvl}`;

// ---------- affixes ----------

const affixRows = new Map();
for (const r of AFFIX) {
  const name = g(r, '1');
  if (!affixRows.has(name)) affixRows.set(name, []);
  affixRows.get(name).push(r);
}

// Pools for these come straight from the Encyclopedia's lists.
const LISTED = new Set(['Juggernaut', 'Expeditious Chance', 'Slaughter Chance']);
const isListed = (name, kind) => kind === 'Utility' || kind === 'Skilling' || LISTED.has(name);

const affixes = [];
const warnings = [];
for (const [name, rows] of affixRows) {
  rows.sort((a, b) => g(a, '11') - g(b, '11') || g(a, '10') - g(b, '10'));
  const kind = KIND.get(g(rows[0], '5'));
  const page = affixPages.get(name);
  const unit = UNIT.get(g(rows[0], '13')) === BASIS_POINTS ? 100 : 1;
  // Some rows repeat an item level; keep the tiers the Encyclopedia shows.
  const levels = page?.levels.length ? page.levels : [...new Set(rows.map((r) => g(r, '11')))];
  const tiers = levels.map((lvl) => {
    const r = rows.filter((x) => Math.max(1, g(x, '11')) === Math.max(1, lvl)).sort((a, b) => g(a, '10') - g(b, '10'))[0];
    return r ? { ilvl: g(r, '11'), min: g(r, '9') / unit, max: g(r, '10') / unit } : null;
  });
  if (tiers.some((t) => !t)) warnings.push(`${name}: Encyclopedia tier levels ${levels} don't all match the table`);
  affixes.push({
    id: slug(name),
    name,
    kind,
    category: KIND_CATEGORY[kind],
    slots: [...new Set(list(rows[0], '4').map((s) => SLOT_ROW.get(s)))],
    styles: list(rows[0], '6').map((s) => label.get(s)),
    template: g(rows[0], '2'),
    description: page?.description ?? g(rows[0], '3'),
    percent: unit === 100,
    tiers: tiers.filter(Boolean),
    weights: page?.weights ?? [],
    status: !page ? 'hidden' : page.rollable ? 'rollable' : 'unrollable',
  });
}

function affixPool(it) {
  if (it.fixed) return [];
  const out = [];
  for (const a of affixes) {
    if (a.status !== 'rollable') continue;
    if (isListed(a.name, a.kind)) {
      if (rollLists.get(a.name)?.items.has(itemKey(it))) out.push(a.id);
      continue;
    }
    // Neutral equipment (novelty weapons, robes, skill capes) only rolls from the listed pools.
    if (it.skilling || it.neutral || a.kind === 'Skilling') continue;
    if (!a.slots.includes(it.slot) || a.tiers[0].ilvl > it.ilvl) continue;
    if (a.styles.length && !a.styles.some((s) => it.styles.includes(s))) continue;
    out.push(a.id);
  }
  return out;
}

// Several affixes share one item list (Commanding and Hordemaster with Bloodworm Nest, for one), so
// only one of each was paged through. An incomplete list borrows a complete one with the same total
// that contains everything it has.
// Lists count item ids, but items sharing a name and level show as one entry, so completeness is
// judged by pages seen rather than by count.
const complete = (l) => l.pages.size >= l.pageCount || l.items.size >= l.total;
for (const a of affixes) {
  if (a.status !== 'rollable' || !isListed(a.name, a.kind)) continue;
  const l = rollLists.get(a.name);
  if (!l) {
    warnings.push(`${a.name}: no "Items that can roll this" list captured`);
    continue;
  }
  if (complete(l)) continue;
  const twin = [...rollLists.values()].find((o) => o !== l && o.total === l.total && complete(o) && [...l.items].every((k) => o.items.has(k)));
  if (twin) rollLists.set(a.name, twin);
  else warnings.push(`${a.name}: saw ${l.pages.size} of ${l.pageCount} pages of its item list`);
}

// ---------- powers ----------

// Boss powers have no Encyclopedia page and never roll on items.
const BOSS = new Set(["Zulrah's Coils", "Vorkath's Bomb", "Jad's Reflection", "Corp's Hunger", "Kraken's Grasp", "Nex's Siphon", "Cerberus's Maw", "KBD's Breath", 'Clue Resurgence']);
const GENERAL = [...POOL.keys()].find((k) => label.get(k) === 'General Melee');
const POOLED = new Set([...POOL.values()].flatMap((s) => [...s]));

const powers = POWER.map((p) => ({
  row: p.row,
  id: slug(g(p, '1')),
  name: g(p, '1'),
  slots: list(p, '3').map((s) => SLOT_ROW.get(s)),
  styles: list(p, '4').map((s) => label.get(s)),
  categories: list(p, '13').map((c) => WEAPON_CATEGORY.get(c)),
  extraItems: new Set(list(p, '16')),
  rollable: !BOSS.has(g(p, '1')),
}));

function powerPool(it) {
  if (it.skilling || it.fixed) return [];
  const allowed = it.pool ? POOL.get(it.pool) : new Set([...POOL.get(GENERAL), ...POWER.map((p) => p.row).filter((r) => !POOLED.has(r))]);
  return powers
    .filter(
      (p) =>
        p.rollable &&
        allowed.has(p.row) &&
        p.slots.includes(it.slot) &&
        (!p.styles.length || p.styles.some((s) => it.styles.includes(s))) &&
        (!p.categories.length || p.categories.includes(it.category) || p.extraItems.has(it.id)),
    )
    .map((p) => p.id);
}

// Power weights: one per power, with exceptions per slot (Bottomless Pantry differs on capes).
const seen = new Map(); // id -> Map(slot -> weight)
const powerNames = new Map(powers.map((p) => [p.name, p.id]));
for (const [name, t] of itemPages) {
  const lvl = Number(t[t.indexOf('Item level') + 1]);
  const it = items.find((i) => i.name === name && i.ilvl === lvl) ?? items.find((i) => i.name === name);
  if (!it) continue;
  for (const [n, w] of pageWeights(t)) {
    const id = powerNames.get(n);
    if (!id) continue;
    if (!seen.has(id)) seen.set(id, new Map());
    seen.get(id).set(it.slot, w);
  }
}
const powerWeights = Object.fromEntries(
  [...seen].map(([id, bySlot]) => {
    const counts = new Map();
    for (const w of bySlot.values()) counts.set(w, (counts.get(w) ?? 0) + 1);
    const weight = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const exceptions = Object.fromEntries([...bySlot].filter(([, w]) => w !== weight));
    return [id, Object.keys(exceptions).length ? { weight, bySlot: exceptions } : { weight }];
  }),
);
for (const p of powers) if (p.rollable && !powerWeights[p.id]) warnings.push(`${p.name}: no weight seen on any item page`);

// ---------- affix weights per item ----------

// Some affixes roll much less often in certain slots (Lethal on body armour, Penetrating on helms,
// food and prayer affixes on boots). Those use this curve instead of their own tier weights, keyed by
// the item level each tier starts at. Solved from the Encyclopedia's item pages; every reduced weight
// seen there fits it.
const REDUCED = { 0: 75, 60: 125, 90: 150, 105: 150, 115: 108 };
const tierOpen = (t, ilvl) => Math.max(1, t.ilvl) <= Math.max(1, ilvl);
const normalWeight = (a, ilvl) => a.tiers.reduce((n, t, i) => (tierOpen(t, ilvl) ? n + (a.weights[i] ?? 0) : n), 0);
const reducedWeight = (a, ilvl) => a.tiers.reduce((n, t) => (tierOpen(t, ilvl) ? n + (REDUCED[t.ilvl] ?? 0) : n), 0);

// Which affix and slot pairs are reduced isn't in the client data, so learn it from the item pages.
// Pairs no page shows keep their normal weights.
const affixByName = new Map(affixes.map((a) => [a.name, a]));
const reducedPairs = new Set();
const pageItem = (name, t) => {
  const lvl = Number(t[t.indexOf('Item level') + 1]);
  return items.find((i) => i.name === name && i.ilvl === lvl) ?? items.find((i) => i.name === name);
};
for (const [name, t] of itemPages) {
  const it = pageItem(name, t);
  if (!it) continue;
  for (const [n, w] of pageWeights(t)) {
    const a = affixByName.get(n);
    if (a && a.kind !== 'Skilling' && w !== normalWeight(a, it.ilvl) && w === reducedWeight(a, it.ilvl)) reducedPairs.add(`${a.id}|${it.slot}`);
  }
}

// Skilling tools split their roll weight evenly between affixes for the tool's own skill and general
// skilling affixes (those on 50 or more items, like Swift Hands). Each skill affix is scaled by the
// general affixes' total weight and each general affix by the skill affixes' total, over a base of 200.
const GENERAL_SKILLING = 50;
const isGeneral = (a) => (rollLists.get(a.name)?.total ?? 0) >= GENERAL_SKILLING;

function affixWeights(it) {
  const pool = affixPool(it).map((id) => affixes.find((a) => a.id === id));
  const base = pool.map((a) => (reducedPairs.has(`${a.id}|${it.slot}`) ? reducedWeight(a, it.ilvl) : normalWeight(a, it.ilvl)));
  if (!it.skilling) return base;
  const general = pool.map((a) => a.kind === 'Skilling' && isGeneral(a));
  const specific = pool.map((a, i) => a.kind === 'Skilling' && !general[i]);
  const sum = (mask) => base.reduce((n, w, i) => (mask[i] ? n + w : n), 0);
  const [specificTotal, generalTotal] = [sum(specific), sum(general)];
  if (!specificTotal || !generalTotal) return base;
  return base.map((w, i) => (specific[i] ? (w * generalTotal) / 200 : general[i] ? (w * specificTotal) / 200 : w));
}

// ---------- check against item pages ----------

let exact = 0;
for (const [name, t] of itemPages) {
  const lvl = Number(t[t.indexOf('Item level') + 1]);
  const it = items.find((i) => i.name === name && i.ilvl === lvl) ?? items.find((i) => i.name === name);
  if (!it) continue;
  const page = [...pageWeights(t).keys()];
  const derived = new Set([...affixPool(it), ...powerPool(it)].map((id) => affixes.find((a) => a.id === id)?.name ?? powers.find((p) => p.id === id).name));
  const missing = page.filter((n) => !derived.has(n));
  const extra = [...derived].filter((n) => !page.includes(n));
  if (!missing.length && !extra.length) exact++;
  else warnings.push(`${name}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
}

// Every affix weight an item page shows, against the weight computed for that item.
let weightChecks = 0;
const weightMisses = [];
for (const [name, t] of itemPages) {
  const it = pageItem(name, t);
  if (!it) continue;
  const ids = affixPool(it);
  const ws = affixWeights(it);
  for (const [n, w] of pageWeights(t)) {
    const i = ids.indexOf(affixByName.get(n)?.id);
    if (i < 0) continue;
    weightChecks++;
    if (ws[i] !== w) weightMisses.push(`${name} ${n}: page ${w}, computed ${ws[i]}`);
  }
}
if (weightMisses.length) warnings.push(...weightMisses.map((m) => `weight: ${m}`));

// ---------- write ----------

const affixIds = affixes.map((a) => a.id);
const powerIds = powers.map((p) => p.id);
const affixIndex = new Map(affixIds.map((id, i) => [id, i]));
const powerIndex = new Map(powerIds.map((id, i) => [id, i]));

const out = {
  importedAt: new Date().toISOString(),
  affixIds,
  powerIds,
  powerStrength: { levels: STRENGTH_LEVELS, percents: STRENGTH_CAPS.map((v) => v / 100) },
  affixes: Object.fromEntries(
    affixes.map(({ id, name, category, slots, template, description, percent, tiers, weights, status }) => [
      id,
      { name, category, slots, template, description, percent, tiers, weights, status },
    ]),
  ),
  powers: Object.fromEntries(powers.map((p) => [p.id, { name: p.name, rollable: p.rollable, ...powerWeights[p.id] }])),
  // [id, name, slot, ilvl, rarity, upgrade %, styles (M/R/A), two-handed, affix indexes, power indexes, affix weights]
  items: items
    .sort((a, b) => a.name.localeCompare(b.name) || a.ilvl - b.ilvl)
    .map((it) => [
      it.id,
      it.name,
      it.slot,
      it.ilvl,
      it.rarity,
      it.upgrade,
      it.styles.map((s) => ({ Melee: 'M', Ranged: 'R', Magic: 'A' })[s]).join(''),
      it.twoHanded ? 1 : 0,
      affixPool(it).map((id) => affixIndex.get(id)),
      powerPool(it).map((id) => powerIndex.get(id)),
      affixWeights(it),
    ]),
};
await writeFile(join(OUT, 'game.json'), JSON.stringify(out) + '\n');

// Rollable affixes the wiki doesn't list yet, in the wiki affix format, so the gear planner can use them
// without loading game.json.
const wikiIds = new Set((await readJson(join(OUT, 'affixes.json'))).affixes.map((a) => a.id));
const extra = affixes
  .filter((a) => a.status === 'rollable' && !wikiIds.has(a.id))
  .map((a) => {
    const unit = a.template.includes('{v}%') ? '%' : '';
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      slots: a.slots,
      restriction: a.styles.length ? `${a.styles.join(' and ')} gear only.` : null,
      food: false,
      cap: { value: null, text: 'None', note: null },
      tiers: a.tiers.map((t, i) => ({
        tier: i + 1,
        ilvl: t.ilvl,
        text: a.template.replace('{v}', `${t.min} to ${t.max}`),
        min: t.min,
        max: t.max,
        unit,
        template: a.template,
        ancientMax: null,
        primalMax: null,
        requirement: null,
      })),
      fromGame: true,
    };
  });
await writeFile(join(OUT, 'game-affixes.json'), JSON.stringify({ affixes: extra }, null, 2) + '\n');

// ---------- report ----------

const wiki = new Map((await readJson(join(OUT, 'affixes.json'))).affixes.map((a) => [a.id, a]));
const diffs = [];
for (const a of affixes) {
  const w = wiki.get(a.id);
  if (!w) continue;
  a.tiers.forEach((t, i) => {
    const wt = w.tiers[i];
    if (!wt) diffs.push(`${a.name} tier ${i + 1}: not on the wiki`);
    else if (wt.ilvl !== t.ilvl || wt.min !== t.min || wt.max !== t.max)
      diffs.push(`${a.name} tier ${i + 1}: wiki ilvl ${wt.ilvl} ${wt.min}-${wt.max}, game ilvl ${t.ilvl} ${t.min}-${t.max}`);
  });
}
const status = Object.groupBy(affixes, (a) => a.status);
console.log(`items: ${items.length}, item pages matching exactly: ${exact} of ${itemPages.size}`);
console.log(`affix weights on item pages: ${weightChecks - weightMisses.length} of ${weightChecks} match; reduced affix and slot pairs: ${[...reducedPairs].join(', ')}`);
console.log(`affixes: ${affixes.length} (${Object.entries(status).map(([k, v]) => `${k} ${v.length}`).join(', ')})`);
console.log(`not on the wiki: ${affixes.filter((a) => !wiki.has(a.id)).map((a) => `${a.name} (${a.status})`).join(', ')}`);
console.log(`powers: ${powers.length} (${powers.filter((p) => p.rollable).length} roll), weights for ${Object.keys(powerWeights).length}`);
console.log(`affixes missing weights: ${affixes.filter((a) => a.status === 'rollable' && a.weights.length !== a.tiers.length).map((a) => a.name).join(', ') || 'none'}`);
if (diffs.length) console.log(`\nwiki differences (${diffs.length}):\n  ${diffs.join('\n  ')}`);
if (warnings.length) console.log(`\nwarnings (${warnings.length}):\n  ${warnings.join('\n  ')}`);
