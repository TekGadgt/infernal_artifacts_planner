#!/usr/bin/env node
// Pulls the affix and demonic power tables from wiki.august.games and writes
// them to src/data/generated/*.json. Run with `npm run sync`.
// Pass --offline to re-parse the cached wikitext in wiki-cache/ without fetching.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'wiki-cache');
const OUT = join(ROOT, 'src/data/generated');
const WIKI = 'https://wiki.august.games/index.php';

const PAGES = {
  affixes: 'Infernal_Artifacts_League/Affixes/Affix_list',
  powers: 'Infernal_Artifacts_League/Demonic_Powers/Power_list',
};

const SLOTS = ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];

const offline = process.argv.includes('--offline');

async function loadPage(key) {
  const file = join(CACHE, `${key}.wiki`);
  if (offline) return readFile(file, 'utf8');
  const url = `${WIKI}?title=${encodeURIComponent(PAGES[key]).replace(/%2F/g, '/')}&action=raw`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetching ${url} failed: ${res.status}`);
  const text = await res.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, text);
  return text;
}

// ---------- wikitext helpers ----------

function clean(raw) {
  let note = '';
  let text = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<small>([\s\S]*?)<\/small>/g, (_, s) => {
      note += (note ? ' ' : '') + s.trim();
      return '';
    })
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  note = note.replace(/'''?/g, '').trim();
  return { text, note };
}

function parseCell(raw) {
  const m = raw.match(/^\s*((?:[a-z-]+="[^"]*"\s*)+)\|(?!\|)([\s\S]*)$/i);
  if (!m) return { rowspan: 1, content: raw };
  const rs = m[1].match(/rowspan="(\d+)"/);
  return { rowspan: rs ? Number(rs[1]) : 1, content: m[2] };
}

/** Parses every wikitable in `text`, expanding rowspans. */
function parseTables(text) {
  const tables = [];
  let table = null;
  let row = null;
  const flushRow = () => {
    if (table && row && row.length) table.rawRows.push(row);
    row = null;
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('{|')) {
      table = { headers: [], rawRows: [] };
    } else if (!table) {
      continue;
    } else if (line.startsWith('|}')) {
      flushRow();
      tables.push(expand(table));
      table = null;
    } else if (line.startsWith('|-')) {
      flushRow();
      row = [];
    } else if (line.startsWith('|+')) {
      // caption
    } else if (line.startsWith('!')) {
      table.headers.push(...line.slice(1).split('!!').map((h) => clean(parseCell(h).content).text));
    } else if (line.startsWith('|')) {
      row ??= [];
      row.push(...line.slice(1).split('||').map(parseCell));
    } else if (row && row.length) {
      row[row.length - 1].content += '\n' + line;
    }
  }
  return tables;
}

function expand({ headers, rawRows }) {
  const pending = [];
  const rows = rawRows.map((cells) => {
    const out = {};
    let ci = 0;
    headers.forEach((h, col) => {
      if (pending[col]?.remaining > 0) {
        pending[col].remaining--;
        out[h] = pending[col].value;
        return;
      }
      const cell = cells[ci++];
      if (!cell) return;
      const value = clean(cell.content);
      if (cell.rowspan > 1) pending[col] = { value, remaining: cell.rowspan - 1 };
      out[h] = value;
    });
    return out;
  });
  return { headers, rows };
}

function sections(text) {
  const out = {};
  const parts = text.split(/^==\s*([^=]+?)\s*==\s*$/m);
  for (let i = 1; i < parts.length; i += 2) out[parts[i].toLowerCase()] = parts[i + 1];
  return out;
}

const num = (s) => {
  const m = String(s ?? '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Finds the "A to B" range in an effect string and returns a template for it. */
function parseRange(text) {
  const m = text.match(/([+-]?)(x|tier |max )?(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)(%|x)?/i);
  if (!m) return { min: null, max: null, unit: '', template: text };
  const [whole, sign, prefix = '', lo, hi, unit = ''] = m;
  return {
    min: Number(lo),
    max: Number(hi),
    unit,
    template: text.replace(whole, `${sign}${prefix}{v}${unit}`),
  };
}

function parseSlots(text) {
  const t = text.toLowerCase();
  const except = t.match(/all except (\w+)/);
  if (except) return SLOTS.filter((s) => s !== except[1]);
  return t
    .split(/,|\band\b/)
    .map((s) => s.trim())
    .filter((s) => SLOTS.includes(s));
}

const slug = (s) => s.toLowerCase().replace(/['’!]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

// ---------- affixes ----------

function buildAffixes(text) {
  const secs = sections(text);
  const affixes = [];
  for (const category of ['offence', 'defence', 'utility', 'skilling']) {
    const [table] = parseTables(secs[category] ?? '');
    if (!table) throw new Error(`No table in the ${category} section`);
    const byName = new Map();
    for (const r of table.rows) {
      const name = r['Affix'].text;
      let affix = byName.get(name);
      if (!affix) {
        const notes = r['Notes']?.text;
        affix = {
          id: slug(name),
          name,
          category,
          slots: parseSlots(r['Slots'].text),
          restriction: notes && notes !== '–' ? notes : null,
          food: /food affix/i.test(notes ?? ''),
          cap: {
            value: /^none/i.test(r['Cap'].text) ? null : num(r['Cap'].text),
            text: r['Cap'].text,
            note: r['Cap'].note || null,
          },
          tiers: [],
        };
        byName.set(name, affix);
        affixes.push(affix);
      }
      const effect = r['Effect'];
      affix.tiers.push({
        tier: ROMAN[r['Tier'].text] ?? affix.tiers.length + 1,
        ilvl: num(r['Item level'].text) ?? 0,
        text: effect.text,
        ...parseRange(effect.text),
        ancientMax: num(r['Ancient max'].text),
        primalMax: num(r['Primal max'].text),
        requirement: effect.note || null,
      });
    }
  }
  return affixes;
}

// ---------- powers ----------

function buildPowers(text) {
  const [table] = parseTables(sections(text)['powers'] ?? '');
  if (!table) throw new Error('No table in the Powers section');
  const dash = (s) => (!s || s === '–' ? null : s);
  return table.rows.map((r) => {
    const effect = r['Effect'].text;
    const styles = r['Style'].text.split(/,/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    return {
      id: slug(r['Power'].text),
      name: r['Power'].text,
      effect,
      ...parseRange(effect),
      ancientMax: num(r['Ancient max'].text),
      primalMax: num(r['Primal max'].text),
      limits: dash(r['Limits'].text),
      slots: parseSlots(r['Slots'].text),
      styles,
      cooldown: dash(r['Cooldown'].text),
      sources: dash(r['Other sources'].text),
    };
  });
}

// ---------- main ----------

const [affixText, powerText] = await Promise.all([loadPage('affixes'), loadPage('powers')]);
const affixes = buildAffixes(affixText);
const powers = buildPowers(powerText);

await mkdir(OUT, { recursive: true });
// An offline re-parse hasn't fetched anything new, so it keeps the last sync date.
const stamp = offline
  ? await readFile(join(OUT, 'affixes.json'), 'utf8').then((t) => JSON.parse(t).syncedAt, () => new Date().toISOString())
  : new Date().toISOString();
await writeFile(join(OUT, 'affixes.json'), JSON.stringify({ syncedAt: stamp, affixes }, null, 2) + '\n');
await writeFile(join(OUT, 'powers.json'), JSON.stringify({ syncedAt: stamp, powers }, null, 2) + '\n');

// Share links refer to affixes, powers, and relics by their position in this
// list, so it is append-only: new ids go on the end and nothing is ever
// removed or reordered, or old links would point at the wrong thing.
const relicSourceForIds = await readFile(join(ROOT, 'src/data/relics.ts'), 'utf8');
const idsFile = join(ROOT, 'src/data/share-ids.json');
const ids = await readFile(idsFile, 'utf8').then(JSON.parse, () => ({ affixes: [], powers: [], relics: [] }));
const current = {
  affixes: affixes.map((a) => a.id),
  powers: powers.map((p) => p.id),
  relics: [...relicSourceForIds.matchAll(/^\s+id: '([a-z0-9-]+)'/gm)].map((m) => m[1]),
};
const added = [];
for (const key of ['affixes', 'powers', 'relics']) {
  for (const id of current[key]) {
    if (!ids[key].includes(id)) {
      ids[key].push(id);
      added.push(id);
    }
  }
}
await writeFile(idsFile, JSON.stringify(ids, null, 2) + '\n');
console.log(`share ids: ${added.length ? `added ${added.length}` : 'no new ids'}`);

// Relic icons named in src/data/relics.ts. Already-downloaded icons are kept.
if (!offline) {
  const relicSource = await readFile(join(ROOT, 'src/data/relics.ts'), 'utf8');
  const icons = [...relicSource.matchAll(/icon: '([^']+)'/g)].map((m) => m[1]);
  const iconDir = join(ROOT, 'public/icons');
  await mkdir(iconDir, { recursive: true });
  const missing = [];
  await Promise.all(
    icons.map(async (icon) => {
      const target = join(iconDir, icon);
      if (await readFile(target).then(() => true, () => false)) return;
      const res = await fetch(`${WIKI}?title=Special:FilePath/${encodeURIComponent(icon)}`);
      if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return missing.push(icon);
      await writeFile(target, Buffer.from(await res.arrayBuffer()));
    }),
  );
  console.log(`icons: ${icons.length - missing.length}/${icons.length}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
}

const counts = Object.groupBy(affixes, (a) => a.category);
console.log(
  `affixes: ${affixes.length} (${Object.entries(counts).map(([k, v]) => `${k} ${v.length}`).join(', ')})`,
);
console.log(`powers: ${powers.length}`);
const unparsed = affixes.flatMap((a) => a.tiers.filter((t) => t.min === null).map((t) => `${a.name} ${t.tier}`));
if (unparsed.length) console.log(`tiers with no numeric range: ${unparsed.join(', ')}`);
