import { useMemo, useState } from 'react';
import { itemsWithAffix } from '../data/game';
import { SLOTS, affixes } from '../data/league';
import { ROMAN, fmt } from '../lib/rules';
import type { Affix, Category, Slot } from '../lib/types';
import ItemRolls from './ItemRolls';
import './Browser.css';

const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'offence', label: 'Offence' },
  { id: 'defence', label: 'Defence' },
  { id: 'utility', label: 'Utility' },
  { id: 'skilling', label: 'Skilling' },
];

// What an affix does, matched against its effect text. Combat groups only match
// combat affixes and skill groups only skilling ones, and an affix can be in several.
const STAT_GROUPS: { id: string; label: string; skilling: boolean; match: RegExp }[] = [
  { id: 'critical', label: 'Critical strikes', skilling: false, match: /critical/ },
  { id: 'damage', label: 'Damage and strength', skilling: false, match: /(?<!incoming )damage(?! reduction| reflected| while)|execute|flanking|penetration|piercing|echo chance|strength/ },
  { id: 'dot', label: 'Burn and bleed', skilling: false, match: /burn|bleed/ },
  { id: 'defence', label: 'Defence and mitigation', skilling: false, match: /defence|damage reduction|incoming damage|dodge|reflect|cheat death|immune|while moving/i },
  { id: 'healing', label: 'Healing and HP', skilling: false, match: /HP|heal|lifesteal|regeneration|food|eat / },
  { id: 'prayer', label: 'Prayer', skilling: false, match: /prayer/ },
  { id: 'summons', label: 'Summons and thralls', skilling: false, match: /summon|thrall|bloodworm/i },
  { id: 'special', label: 'Special attacks', skilling: false, match: /special attack/ },
  { id: 'loot', label: 'Drops and bracelets', skilling: false, match: /drop rate|bracelet/ },
  { id: 'general', label: 'Any gathering or production', skilling: true, match: /gather|production|skilling pet|crystal key|craft a tick|repetitions|process gathered/ },
  { id: 'farming', label: 'Farming', skilling: true, match: /seed|harvest|Hespori/ },
  { id: 'firemaking', label: 'Firemaking', skilling: true, match: /firemaking|burn|log is not consumed/i },
  { id: 'fishing', label: 'Fishing', skilling: true, match: /fish|clue bottle/ },
  { id: 'fletching', label: 'Fletching', skilling: true, match: /fletch|bowstring|arrow|ammunition|ammo/i },
  { id: 'herblore', label: 'Herblore', skilling: true, match: /herb|potion|secondary/i },
  { id: 'mining', label: 'Mining', skilling: true, match: /\bmin(e|ed|ing)\b|\bore\b|rock|swing|geode chance$|clue geode/ },
  { id: 'prayer-skill', label: 'Prayer training', skilling: true, match: /bone|ashes|altar|Prayer/ },
  { id: 'runecrafting', label: 'Runecrafting', skilling: true, match: /Runecrafting|\brune|essence/ },
  { id: 'smithing', label: 'Smithing', skilling: true, match: /smith|\bbars?\b|anvil|smelt|forge|flux/i },
  { id: 'thieving', label: 'Thieving', skilling: true, match: /thiev|pickpocket|stall/ },
  { id: 'warding', label: 'Warding', skilling: true, match: /Warding|Warded/ },
  { id: 'woodcutting', label: 'Woodcutting', skilling: true, match: /tree|chop|nest/ },
];

const inGroup = (a: Affix, group: (typeof STAT_GROUPS)[number]) =>
  (a.category === 'skilling') === group.skilling && group.match.test(a.tiers.at(-1)!.template);

const groupCounts = new Map(STAT_GROUPS.map((g) => [g.id, affixes.filter((a) => inGroup(a, g)).length]));

const slotList = (slots: Slot[]) =>
  slots.length >= 9
    ? `All except ${SLOTS.find((s) => !slots.includes(s.id))?.label.toLowerCase()}`
    : SLOTS.filter((s) => slots.includes(s.id))
        .map((s) => s.label)
        .join(', ');

export default function AffixBrowser() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [slot, setSlot] = useState<Slot | ''>('');
  const [ilvl, setIlvl] = useState<number | ''>('');
  const [stat, setStat] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return affixes.filter(
      (a) =>
        (category === 'all' || a.category === category) &&
        (!slot || a.slots.includes(slot)) &&
        (!stat || inGroup(a, STAT_GROUPS.find((g) => g.id === stat)!)) &&
        (!q || a.name.toLowerCase().includes(q) || a.tiers.some((t) => t.text.toLowerCase().includes(q))),
    );
  }, [query, category, slot, stat]);

  return (
    <div className="browser">
      <div className="browser__filters">
        <label className="field browser__search">
          Search
          <input className="input" type="search" placeholder="Name or effect, e.g. crit" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="field">
          Category
          <div className="segmented" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button key={c.id} role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          Stat or skill
          <select className="select" value={stat} onChange={(e) => setStat(e.target.value)}>
            <option value="">Any</option>
            {[false, true].map((skilling) => (
              <optgroup key={String(skilling)} label={skilling ? 'Skilling' : 'Combat'}>
                {STAT_GROUPS.filter((g) => g.skilling === skilling).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({groupCounts.get(g.id)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          Slot
          <select className="select" value={slot} onChange={(e) => setSlot(e.target.value as Slot | '')}>
            <option value="">Any slot</option>
            {SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field browser__ilvl">
          Item level
          <input
            className="input num"
            type="number"
            min={0}
            max={255}
            placeholder="Any"
            value={ilvl}
            onChange={(e) => setIlvl(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </div>
      <p className="muted browser__count" role="status">
        {shown.length} of {affixes.length} affixes
        {ilvl !== '' && `. Tiers that roll at item level ${ilvl} are lit.`}
      </p>

      <div className="affix-cards">
        {shown.map((a) => (
          <article key={a.id} className={`affix-card affix-card--${a.category}`}>
            <header>
              <h2>{a.name}</h2>
              <span className="tag">{a.category}</span>
              {a.food && <span className="tag">food</span>}
            </header>
            <p className="affix-card__meta">
              <span>{slotList(a.slots)}</span>
              {a.restriction && <span>{a.restriction}</span>}
              <span>
                Cap: {a.cap.text}
                {a.cap.note && <span className="muted"> ({a.cap.note})</span>}
              </span>
            </p>
            <table className="tier-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="num">ilvl</th>
                  <th>Effect</th>
                  <th className="num">Ancient</th>
                  <th className="num">Primal</th>
                </tr>
              </thead>
              <tbody>
                {a.tiers.map((t) => (
                  <tr key={t.tier} className={ilvl === '' ? undefined : t.ilvl <= ilvl ? 'lit' : 'dim'}>
                    <td>{ROMAN[t.tier]}</td>
                    <td className="num">{t.ilvl}</td>
                    <td>
                      {t.text}
                      {t.requirement && <span className="tier-table__req">{t.requirement}</span>}
                    </td>
                    <td className="num">{fmt(t.ancientMax)}</td>
                    <td className="num">{fmt(t.primalMax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ItemRolls rolls={itemsWithAffix(a.id)} slot={slot} chance="First roll" filter={`affix=${a.id}`} />
          </article>
        ))}
        {shown.length === 0 && <p className="muted">No affixes match. Try a shorter search or another slot.</p>}
      </div>
    </div>
  );
}
