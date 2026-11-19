import { useEffect, useMemo, useState } from 'react';
import {
  affixLimits,
  gameAffixes,
  gamePowers,
  itemById,
  items,
  nextRarity,
  powerStrength,
  powerWeight,
  tiersAt,
  type GameItem,
  type GameStyle,
} from '../data/game';
import { SLOTS, rarityById } from '../data/league';
import { ROMAN, fmt } from '../lib/rules';
import type { Category, Slot } from '../lib/types';
import './Browser.css';
import './ItemBrowser.css';

const PAGE = 80;
const STYLES: (GameStyle | 'all')[] = ['all', 'Melee', 'Ranged', 'Magic'];
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'offence', label: 'Offence' },
  { id: 'defence', label: 'Defence' },
  { id: 'utility', label: 'Utility' },
  { id: 'skilling', label: 'Skilling' },
];
const slotLabel = (s: Slot) => SLOTS.find((x) => x.id === s)?.label ?? s;
const pct = (v: number) => `${fmt(v)}%`;

function readSelected(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get('item'));
  return itemById.has(id) ? id : null;
}

function AffixPool({ item }: { item: GameItem }) {
  const rows = item.affixes.map((id, i) => {
    const a = gameAffixes[id];
    const tiers = tiersAt(a, item.ilvl);
    // Like the Encyclopedia, show the best tier's range: what a roll at this item level can reach.
    const top = a.tiers[tiers.at(-1)! - 1];
    return { a, tiers, range: `${fmt(top.min)}–${fmt(top.max)}`, weight: item.affixWeights[i] };
  });
  const total = rows.reduce((n, r) => n + r.weight, 0);
  if (!rows.length) return <p className="muted">This item can't roll affixes.</p>;
  return (
    <>
      {CATEGORIES.map((c) => {
        const group = rows.filter((r) => r.a.category === c.id).sort((x, y) => y.weight - x.weight);
        if (!group.length) return null;
        return (
          <div key={c.id} className={`pool pool--${c.id}`}>
            <h4>
              {c.label} <span className="muted num">{group.length}</span>
            </h4>
            <div className="table-wrap">
              <table className="tier-table">
                <thead>
                  <tr>
                    <th>Affix</th>
                    <th>Tiers</th>
                    <th>Best tier</th>
                    <th className="num">Weight</th>
                    <th className="num">First roll</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(({ a, tiers, range, weight }) => (
                    <tr key={a.id}>
                      <td className="pool__name">{a.name}</td>
                      <td>
                        {ROMAN[tiers[0]]}
                        {tiers.length > 1 && `–${ROMAN[tiers.at(-1)!]}`}
                      </td>
                      <td>{a.template.replace('{v}', range)}</td>
                      <td className="num">{weight.toLocaleString('en-US')}</td>
                      <td className="num">{pct((weight / total) * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="muted pool__note">
        First roll is this affix's share of the item's total affix weight. Later rolls skip affixes already rolled and categories at their
        limit, so their odds shift.
      </p>
    </>
  );
}

function PowerPool({ item }: { item: GameItem }) {
  const rows = item.powers
    .map((id) => ({ p: gamePowers[id], weight: powerWeight(gamePowers[id], item.slot) }))
    .sort((a, b) => b.weight - a.weight || a.p.name.localeCompare(b.p.name));
  const total = rows.reduce((n, r) => n + r.weight, 0);
  if (!rows.length) return <p className="muted">This item can't roll a Demonic Power.</p>;
  return (
    <div className="table-wrap">
      <table className="tier-table">
        <thead>
          <tr>
            <th>Power</th>
            <th className="num">Weight</th>
            <th className="num">Chance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, weight }) => (
            <tr key={p.id}>
              <td className="pool__power">{p.name}</td>
              <td className="num">{weight}</td>
              <td className="num">{pct((weight / total) * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemDetail({ item }: { item: GameItem }) {
  const rarity = rarityById.get(item.rarity)!;
  const next = nextRarity(item.rarity);
  const limits = affixLimits(item.rarity, item.slot);
  const strength = powerStrength(item.ilvl);
  return (
    <article className="item-detail panel" style={{ '--rarity': rarity.color } as React.CSSProperties}>
      <header className="item-detail__head">
        <h2>{item.name}</h2>
        <p className="muted">
          {slotLabel(item.slot)}
          {item.twoHanded && ', two-handed'}
          {item.styles.length > 0 && ` · ${item.styles.join(', ')}`}
        </p>
      </header>
      <dl className="item-facts">
        <div>
          <dt>Item level</dt>
          <dd className="num">{item.ilvl}</dd>
        </div>
        <div>
          <dt>Base rarity</dt>
          <dd className="item-facts__rarity">{rarity.label}</dd>
        </div>
        <div>
          <dt>Rarity upgrade</dt>
          <dd>{next && item.upgrade > 0 ? `${pct(item.upgrade)} to become ${next}` : 'Cannot upgrade'}</dd>
        </div>
        <div>
          <dt>Demonic power</dt>
          <dd>{strength >= 100 ? 'Full strength' : `Up to ${pct(strength)} of full strength`}</dd>
        </div>
        <div>
          <dt>Affix limits</dt>
          <dd>
            {limits.count[0] === limits.count[1] ? limits.count[0] : `${limits.count[0]}–${limits.count[1]}`} affixes
            {limits.limits &&
              `, up to ${limits.limits.offence} off / ${limits.limits.defence} def${limits.limits.utility > 0 ? ` / ${limits.limits.utility} util` : ''}`}
          </dd>
        </div>
      </dl>
      <section>
        <h3>Affixes it can roll</h3>
        <AffixPool item={item} />
      </section>
      <section>
        <h3>Demonic Powers</h3>
        <p className="muted pool__note">Only Legendary items carry a power. These are the ones this item can roll once it is Legendary.</p>
        <PowerPool item={item} />
      </section>
    </article>
  );
}

export default function ItemBrowser() {
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<Slot | ''>('');
  const [style, setStyle] = useState<GameStyle | 'all'>('all');
  const [selected, setSelected] = useState<number | null>(readSelected);
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (!slot || i.slot === slot) && (style === 'all' || i.styles.includes(style)) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [query, slot, style]);
  useEffect(() => setLimit(PAGE), [query, slot, style]);

  const pick = (id: number) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set('item', String(id));
    history.replaceState(null, '', url);
  };
  const item = selected !== null ? itemById.get(selected) : undefined;

  return (
    <div className="items">
      <section className="items__list" aria-label="Items">
        <div className="browser__filters">
          <label className="field browser__search">
            Search
            <input className="input" type="search" placeholder="Item name" value={query} onChange={(e) => setQuery(e.target.value)} />
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
          <div className="field">
            Style
            <div className="segmented" role="radiogroup" aria-label="Style">
              {STYLES.map((s) => (
                <button key={s} role="radio" aria-checked={style === s} onClick={() => setStyle(s)}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="muted browser__count" role="status">
          {shown.length.toLocaleString('en-US')} items
        </p>
        <ul className="item-rows">
          {shown.slice(0, limit).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="item-row"
                aria-current={i.id === selected}
                onClick={() => pick(i.id)}
                style={{ '--rarity': rarityById.get(i.rarity)!.color } as React.CSSProperties}
              >
                <span className="item-row__name">{i.name}</span>
                <span className="item-row__meta num">
                  {slotLabel(i.slot)} · ilvl {i.ilvl}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {shown.length > limit && (
          <button className="btn items__more" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({(shown.length - limit).toLocaleString('en-US')} left)
          </button>
        )}
      </section>
      <div className="items__detail">
        {item ? <ItemDetail item={item} /> : <p className="muted items__empty">Pick an item to see what it can roll.</p>}
      </div>
    </div>
  );
}
