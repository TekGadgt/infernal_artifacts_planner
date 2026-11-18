// Compact binary encoding for share links.
//
// Every list in this file is append-only. Links store positions in these lists,
// so reordering or removing an entry would change what existing links mean.
// Affix, power, and relic ids come from src/data/share-ids.json, which
// `npm run sync` only ever appends to.

import shareIds from '../data/share-ids.json';
import type { ForgeOp, LoadoutKind, Plan, PlannedItem, Rarity, Slot, SoulBrandSlot, Style, Variant } from './types';

const FORMAT = 1;

const SLOTS: Slot[] = ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const VARIANTS: Variant[] = ['normal', 'ancient', 'primal'];
const STYLES: Style[] = ['any', 'melee', 'ranged', 'magic'];
const KINDS: LoadoutKind[] = ['combat', 'skilling'];
const BRANDS: SoulBrandSlot[] = ['weapon', 'armour', 'jewellery'];
const FORGE_KINDS: ForgeOp['kind'][] = ['transplant', 'awaken-legendary', 'awaken-ancient', 'stamp', 'outfit'];

type IdList = 'affixes' | 'powers' | 'relics';
const index = Object.fromEntries(
  (Object.keys(shareIds) as IdList[]).map((k) => [k, new Map(shareIds[k].map((id, i) => [id, i]))]),
) as Record<IdList, Map<string, number>>;

// ---------- writer ----------

class Writer {
  private bytes: number[] = [];

  /** Unsigned LEB128. */
  uint(n: number) {
    let v = Math.max(0, Math.floor(n));
    while (v >= 0x80) {
      this.bytes.push((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    this.bytes.push(v);
  }

  str(s: string) {
    const b = new TextEncoder().encode(s);
    this.uint(b.length);
    this.bytes.push(...b);
  }

  /** 0 = none, 1 = id written out (not in the list yet), n + 2 = position n in the list. */
  ref(list: IdList, id: string | null | undefined) {
    if (!id) return this.uint(0);
    const i = index[list].get(id);
    if (i === undefined) {
      this.uint(1);
      this.str(id);
    } else this.uint(i + 2);
  }

  /** 0 = use the tier maximum, otherwise the value in hundredths, zigzag-encoded. */
  value(v: number | null, max: number | null) {
    if (v === null || v === max) return this.uint(0);
    const h = Math.round(v * 100);
    this.uint((h >= 0 ? h * 2 : -h * 2 - 1) + 1);
  }

  done() {
    return new Uint8Array(this.bytes);
  }
}

// ---------- reader ----------

class Reader {
  private at = 0;
  constructor(private bytes: Uint8Array) {}

  uint(): number {
    let n = 0;
    let scale = 1;
    for (;;) {
      if (this.at >= this.bytes.length) throw new Error('Share link is cut short');
      const b = this.bytes[this.at++];
      n += (b & 0x7f) * scale;
      if (b < 0x80) return n;
      scale *= 0x80;
    }
  }

  str(): string {
    const len = this.uint();
    if (this.at + len > this.bytes.length) throw new Error('Share link is cut short');
    const s = new TextDecoder().decode(this.bytes.subarray(this.at, this.at + len));
    this.at += len;
    return s;
  }

  ref(list: IdList): string | null {
    const n = this.uint();
    if (n === 0) return null;
    if (n === 1) return this.str();
    // A position past the end means the link came from a newer build; keep it visible as unknown.
    return shareIds[list][n - 2] ?? `unknown-${list}-${n - 2}`;
  }

  value(): number | null {
    const n = this.uint();
    if (n === 0) return null;
    const z = n - 1;
    return (z % 2 === 0 ? z / 2 : -(z + 1) / 2) / 100;
  }
}

const pick = <T>(list: T[], i: number, fallback: T) => list[i] ?? fallback;

// ---------- plan ----------

export function encodePlan(plan: Plan, maxValue: (affixId: string, tier: number) => number | null): Uint8Array {
  const w = new Writer();
  w.uint(FORMAT);
  w.str(plan.name);

  const relics = Object.entries(plan.relics);
  w.uint(relics.length);
  for (const [tier, id] of relics) {
    w.uint(Number(tier));
    w.ref('relics', id);
  }

  w.uint(plan.loadouts.length);
  w.uint(Math.max(0, plan.loadouts.findIndex((l) => l.id === plan.activeLoadout)));
  for (const l of plan.loadouts) {
    w.str(l.name);
    w.uint(KINDS.indexOf(l.kind));
    for (const b of BRANDS) w.ref('powers', l.soulBrands[b]);
    const items = Object.entries(l.items) as [Slot, PlannedItem][];
    w.uint(items.length);
    for (const [slot, it] of items) {
      w.uint(SLOTS.indexOf(slot));
      // rarity: 3 bits, variant: 2, style: 2, two-handed: 1
      w.uint(
        RARITIES.indexOf(it.rarity) |
          (VARIANTS.indexOf(it.variant) << 3) |
          (STYLES.indexOf(it.style) << 5) |
          ((it.twoHanded ? 1 : 0) << 7),
      );
      w.uint(it.ilvl);
      w.ref('powers', it.powerId);
      w.str(it.name);
      w.uint(it.affixes.length);
      for (const a of it.affixes) {
        w.ref('affixes', a.affixId);
        w.uint(a.tier);
        w.value(a.value, maxValue(a.affixId, a.tier));
      }
    }
  }

  w.uint(plan.forge.length);
  for (const op of plan.forge) {
    w.uint(FORGE_KINDS.indexOf(op.kind));
    w.uint(op.tier ?? 0);
    // onto Legendary, keep affixes, has a step, step is Gild
    w.uint((op.ontoLegendary ? 1 : 0) | (op.keep ? 2 : 0) | (op.step ? 4 : 0) | (op.step === 'gild' ? 8 : 0));
    w.uint(op.count);
  }
  return w.done();
}

/** Returns a version 2 plan shape for normalizing; ids are regenerated. */
export function decodePlan(bytes: Uint8Array, maxValue: (affixId: string, tier: number) => number | null): Plan {
  const r = new Reader(bytes);
  const format = r.uint();
  if (format !== FORMAT) throw new Error(`Unsupported share link format ${format}`);
  const name = r.str();

  const relics: Record<string, string> = {};
  for (let n = r.uint(); n > 0; n--) {
    const tier = r.uint();
    const id = r.ref('relics');
    if (id) relics[tier] = id;
  }

  const loadoutCount = r.uint();
  const activeIndex = r.uint();
  const loadouts: Plan['loadouts'] = [];
  for (let n = loadoutCount; n > 0; n--) {
    const lName = r.str();
    const kind = pick(KINDS, r.uint(), 'combat');
    const soulBrands = Object.fromEntries(BRANDS.map((b) => [b, r.ref('powers')])) as Plan['loadouts'][number]['soulBrands'];
    const items: Partial<Record<Slot, PlannedItem>> = {};
    for (let i = r.uint(); i > 0; i--) {
      const slot = pick(SLOTS, r.uint(), 'head');
      const bits = r.uint();
      const ilvl = r.uint();
      const powerId = r.ref('powers');
      const itemName = r.str();
      const affixes: PlannedItem['affixes'] = [];
      for (let a = r.uint(); a > 0; a--) {
        const affixId = r.ref('affixes') ?? 'unknown';
        const tier = r.uint();
        const value = r.value();
        affixes.push({ affixId, tier, value: value ?? maxValue(affixId, tier) });
      }
      items[slot] = {
        name: itemName,
        rarity: pick(RARITIES, bits & 7, 'legendary'),
        variant: pick(VARIANTS, (bits >> 3) & 3, 'normal'),
        style: pick(STYLES, (bits >> 5) & 3, 'any'),
        twoHanded: ((bits >> 7) & 1) === 1,
        ilvl,
        powerId,
        affixes,
      };
    }
    loadouts.push({ id: crypto.randomUUID(), name: lName, kind, items, soulBrands });
  }

  const forge: ForgeOp[] = [];
  for (let n = r.uint(); n > 0; n--) {
    const kind = pick(FORGE_KINDS, r.uint(), 'transplant');
    const tier = r.uint();
    const flags = r.uint();
    const count = r.uint();
    forge.push({
      id: crypto.randomUUID(),
      kind,
      count: Math.max(1, count),
      ...(tier ? { tier } : {}),
      ...(flags & 1 ? { ontoLegendary: true } : {}),
      ...(flags & 2 ? { keep: true } : {}),
      ...(flags & 4 ? { step: flags & 8 ? ('gild' as const) : ('trim' as const) } : {}),
    });
  }

  return {
    version: 2,
    name,
    relics,
    loadouts,
    activeLoadout: loadouts[activeIndex]?.id ?? loadouts[0]?.id ?? '',
    forge,
  };
}
