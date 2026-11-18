import { useMemo, useState } from 'react';
import { SLOTS, affixes } from '../data/league';
import { ROMAN, fmt } from '../lib/rules';
import type { Category, Slot } from '../lib/types';
import './Browser.css';

const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'offence', label: 'Offence' },
  { id: 'defence', label: 'Defence' },
  { id: 'utility', label: 'Utility' },
  { id: 'skilling', label: 'Skilling' },
];

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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return affixes.filter(
      (a) =>
        (category === 'all' || a.category === category) &&
        (!slot || a.slots.includes(slot)) &&
        (!q || a.name.toLowerCase().includes(q) || a.tiers.some((t) => t.text.toLowerCase().includes(q))),
    );
  }, [query, category, slot]);

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
          </article>
        ))}
        {shown.length === 0 && <p className="muted">No affixes match. Try a shorter search or another slot.</p>}
      </div>
    </div>
  );
}
