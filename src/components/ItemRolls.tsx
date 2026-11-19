import { useState } from 'react';
import type { ItemRoll } from '../data/game';
import { SLOTS, rarityById } from '../data/league';
import { fmt } from '../lib/rules';
import type { Slot } from '../lib/types';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const PAGE = 25;
const slotLabel = (s: Slot) => SLOTS.find((x) => x.id === s)?.label ?? s;

/**
 * The items an affix or power rolls on, folded away until opened. With `slot`, only items in that slot.
 * `chance` names the odds column: an affix's first roll, or a power's chance.
 */
export default function ItemRolls({
  rolls,
  slot,
  chance,
  filter,
}: {
  rolls: ItemRoll[];
  slot?: Slot | '';
  chance: string;
  /** Query for the Items page that lists the same items, like "affix=attuned". */
  filter: string;
}) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const shown = slot ? rolls.filter((r) => r.item.slot === slot) : rolls;

  if (!rolls.length) return <p className="muted item-rolls__none">No item can roll this.</p>;
  return (
    <details className="item-rolls" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        Rolls on {shown.length.toLocaleString('en-US')} item{shown.length === 1 ? '' : 's'}
        {slot && shown.length !== rolls.length && <span className="muted"> in this slot, {rolls.length.toLocaleString('en-US')} in all</span>}
      </summary>
      {open && (
        <>
          <table className="tier-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Slot</th>
                <th className="num">ilvl</th>
                <th className="num">{chance}</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map(({ item, chance }) => (
                <tr key={item.id}>
                  <td>
                    <a href={`${base}/items/?item=${item.id}`} style={{ color: rarityById.get(item.rarity)!.color }}>
                      {item.name}
                    </a>
                  </td>
                  <td>{slotLabel(item.slot)}</td>
                  <td className="num">{item.ilvl}</td>
                  <td className="num">{fmt(chance)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="item-rolls__foot">
            {shown.length > limit && (
              <button type="button" className="btn btn--quiet" onClick={() => setLimit(shown.length)}>
                Show all {shown.length.toLocaleString('en-US')}
              </button>
            )}
            <a className="item-rolls__page" href={`${base}/items/?${filter}`}>
              Browse them on the Items page
            </a>
          </p>
        </>
      )}
    </details>
  );
}
