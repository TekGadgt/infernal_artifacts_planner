import { useMemo, useState } from 'react';
import { SLOTS, powers } from '../data/league';
import { describePower, fmt } from '../lib/rules';
import type { Slot, Style } from '../lib/types';
import './Browser.css';

const STYLES: { id: Style | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'melee', label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'magic', label: 'Magic' },
  { id: 'any', label: 'Any style' },
];

export default function PowerBrowser() {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<Style | 'all'>('all');
  const [slot, setSlot] = useState<Slot | ''>('');
  const [sourced, setSourced] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return powers.filter(
      (p) =>
        (style === 'all' || p.styles.includes(style)) &&
        (!slot || p.slots.includes(slot)) &&
        (!sourced || p.sources) &&
        (!q || p.name.toLowerCase().includes(q) || p.effect.toLowerCase().includes(q)),
    );
  }, [query, style, slot, sourced]);

  return (
    <div className="browser">
      <div className="browser__filters">
        <label className="field browser__search">
          Search
          <input className="input" type="search" placeholder="Name or effect, e.g. bleed" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="field">
          Style
          <div className="segmented" role="radiogroup" aria-label="Style">
            {STYLES.map((s) => (
              <button key={s.id} role="radio" aria-checked={style === s.id} onClick={() => setStyle(s.id)}>
                {s.label}
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
        <label className="browser__toggle">
          <input type="checkbox" checked={sourced} onChange={(e) => setSourced(e.target.checked)} />
          Also obtainable without a Legendary drop
        </label>
      </div>
      <p className="muted browser__count" role="status">
        {shown.length} of {powers.length} powers
      </p>

      <div className="table-wrap">
        <table className="table power-table">
          <thead>
            <tr>
              <th>Power</th>
              <th>Effect</th>
              <th className="num">Ancient / Primal</th>
              <th>Slots</th>
              <th>Style</th>
              <th>Cooldown</th>
              <th>Other sources</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                <td>
                  {describePower(p)}
                  {p.limits && <span className="power-table__limit">{p.limits}</span>}
                </td>
                <td className="num">
                  {p.ancientMax === null ? '–' : `${fmt(p.ancientMax)} / ${fmt(p.primalMax)}`}
                </td>
                <td>{p.slots.join(', ')}</td>
                <td>{p.styles.join(', ')}</td>
                <td>{p.cooldown ?? '–'}</td>
                <td>{p.sources ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="muted">No powers match. Try clearing a filter.</p>}
    </div>
  );
}
