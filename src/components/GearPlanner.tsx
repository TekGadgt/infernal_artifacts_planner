import { useMemo, useState } from 'react';
import {
  RARITIES,
  SLOTS,
  SOUL_BRAND_SLOTS,
  VARIANTS,
  affixById,
  affixes as ALL_AFFIXES,
  powerById,
  powers as ALL_POWERS,
  rarityById,
  variantById,
} from '../data/league';
import {
  gameAffixes,
  gamePowers,
  itemById as gameItemById,
  items as gameItems,
  nextRarity,
  powerStrength,
  powerWeight,
  type GameItem,
} from '../data/game';
import { affixLimits } from '../data/league';
import { OP_LABEL, costText, opCost, sumCosts } from '../lib/forge';
import { newLoadout, usePlan } from '../lib/plan';
import { activeRelics } from '../lib/playthroughs';
import {
  ROMAN,
  TIER_STATUS_TEXT,
  activePowers,
  affixesFor,
  baseValue,
  bestTier,
  describe,
  describePower,
  effectiveValue,
  fmt,
  itemIssues,
  loadoutIssues,
  loadoutTotals,
  multiplier,
  powersFor,
  tierStatus,
  type Issue,
} from '../lib/rules';
import type { Category, ForgeOp, Loadout, LoadoutKind, NamedLoadout, Plan, PlannedAffix, PlannedItem, Slot, Style } from '../lib/types';
import './GearPlanner.css';

const STYLES: { id: Style; label: string }[] = [
  { id: 'any', label: 'Any style' },
  { id: 'melee', label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'magic', label: 'Magic' },
];
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const CATEGORY_LABEL: Record<Category, string> = {
  offence: 'Offence',
  defence: 'Defence',
  utility: 'Utility',
  skilling: 'Skilling',
};

function newItem(): PlannedItem {
  return { name: '', rarity: 'legendary', variant: 'normal', ilvl: 100, style: 'any', twoHanded: false, affixes: [], powerId: null };
}

function slotBlocked(slot: Slot, kind: LoadoutKind, loadout: Loadout): string | null {
  if (slot === 'shield' && kind === 'skilling') return 'Skilling affixes do not roll on shields';
  if (slot === 'shield' && loadout.weapon?.twoHanded) return 'Two-handed weapon equipped';
  return null;
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="issues">
      {issues.map((i) => (
        <li key={`${i.level}:${i.text}`} className={i.level}>
          {i.text}
        </li>
      ))}
    </ul>
  );
}

// ---------- equipment grid ----------

function SlotTile({
  slot,
  label,
  item,
  selected,
  blocked,
  onSelect,
}: {
  slot: Slot;
  label: string;
  item?: PlannedItem;
  selected: boolean;
  blocked: string | null;
  onSelect: () => void;
}) {
  const rarity = item ? rarityById.get(item.rarity) : undefined;
  const errors = item ? itemIssues(slot, item).filter((i) => i.level === 'error').length : 0;
  return (
    <button
      type="button"
      className={`slot${selected ? ' slot--selected' : ''}${item ? ' slot--filled' : ''}${blocked ? ' slot--blocked' : ''}`}
      style={rarity ? ({ '--rarity': rarity.color } as React.CSSProperties) : undefined}
      onClick={onSelect}
      aria-pressed={selected}
      title={blocked ?? undefined}
    >
      <span className="slot__label">{label}</span>
      {item ? (
        <>
          <span className="slot__item">{item.name || rarity?.label}</span>
          <span className="slot__meta num">
            {item.affixes.length}/{rarity?.affixes[1]} affixes
            {item.powerId && item.rarity === 'legendary' ? ', power' : ''}
          </span>
          {errors > 0 && <span className="slot__alert" aria-label={`${errors} problems`} />}
        </>
      ) : (
        <span className="slot__empty">{blocked ? 'Blocked' : 'Empty'}</span>
      )}
    </button>
  );
}

// ---------- affix row ----------

function AffixRow({
  slot,
  item,
  planned,
  onChange,
  onRemove,
}: {
  slot: Slot;
  item: PlannedItem;
  planned: PlannedAffix;
  onChange: (p: PlannedAffix) => void;
  onRemove: () => void;
}) {
  const affix = affixById.get(planned.affixId);
  if (!affix)
    return (
      <li className="affix-row">
        <span className="issues error">Unknown affix {planned.affixId}</span>
        <button className="btn btn--quiet" onClick={onRemove}>
          Remove
        </button>
      </li>
    );
  const tier = affix.tiers.find((t) => t.tier === planned.tier) ?? affix.tiers[0];
  const value = baseValue(planned, tier, item);
  const effective = effectiveValue(planned, affix, item, slot);
  const mult = multiplier(affix, item, slot);
  const hasRange = tier.min !== null && tier.max !== null && tier.min !== tier.max;
  const step = Number.isInteger(tier.min) && Number.isInteger(tier.max) ? 1 : 0.01;
  const locked = item.variant === 'primal';
  const id = `${slot}-${planned.affixId}-${planned.tier}`;

  return (
    <li className={`affix-row affix-row--${affix.category}`}>
      <div className="affix-row__top">
        <span className="affix-row__name">{affix.name}</span>
        <select
          className="select affix-row__tier"
          aria-label={`${affix.name} tier`}
          value={planned.tier}
          onChange={(e) => {
            const next = affix.tiers.find((t) => t.tier === Number(e.target.value))!;
            onChange({ ...planned, tier: next.tier, value: next.max });
          }}
        >
          {affix.tiers.map((t) => {
            const status = tierStatus(affix, t, item);
            return (
              <option key={t.tier} value={t.tier} disabled={status === 'locked'} title={TIER_STATUS_TEXT[status]}>
                Tier {ROMAN[t.tier]} (ilvl {t.ilvl}){status === 'improve' ? ', improve only' : ''}
                {status === 'primal' ? ', Primal' : ''}
                {status === 'locked' ? ', locked' : ''}
              </option>
            );
          })}
        </select>
        <button className="btn btn--quiet affix-row__remove" onClick={onRemove} aria-label={`Remove ${affix.name}`}>
          Remove
        </button>
      </div>
      {hasRange && (
        <div className="affix-row__value">
          <input
            type="range"
            id={id}
            min={tier.min!}
            max={tier.max!}
            step={step}
            value={value ?? tier.max!}
            disabled={locked}
            onChange={(e) => onChange({ ...planned, value: Number(e.target.value) })}
            aria-label={`${affix.name} rolled value`}
          />
          <input
            type="number"
            className="input num"
            min={tier.min!}
            max={tier.max!}
            step={step}
            value={value ?? ''}
            disabled={locked}
            onChange={(e) => onChange({ ...planned, value: e.target.value === '' ? null : Number(e.target.value) })}
            aria-label={`${affix.name} rolled value`}
          />
          <span className="muted num affix-row__range">
            {fmt(tier.min)}–{fmt(tier.max)}
          </span>
        </div>
      )}
      <p className="affix-row__effect">
        {describe(tier, effective)}
        {mult !== 1 && effective !== null && <span className="muted"> (×{fmt(mult)})</span>}
      </p>
    </li>
  );
}

// ---------- item editor ----------

function GameFacts({ game }: { game: GameItem }) {
  const next = nextRarity(game.rarity);
  const strength = powerStrength(game.ilvl);
  const baseRarity = rarityById.get(game.rarity)!;
  return (
    <p className="editor__game">
      Item level {game.ilvl}, base <span style={{ color: baseRarity.color }}>{baseRarity.label}</span>
      {next && game.upgrade > 0 ? ` (${fmt(game.upgrade)}% to become ${next})` : ''}. Powers up to{' '}
      {strength >= 100 ? 'full strength' : `${fmt(strength)}%`}. Rolls from {game.affixes.length} affixes and {game.powers.length}{' '}
      powers. <a href={`${base}/items/?item=${game.id}`}>See its roll table</a>
    </p>
  );
}

/** Problems that need the game's item data: affixes and powers outside the item's pool. */
function gameIssues(item: PlannedItem, game: GameItem | undefined): Issue[] {
  if (!game) return [];
  const issues: Issue[] = [];
  for (const p of item.affixes) {
    const a = gameAffixes[p.affixId];
    if (!game.affixes.includes(p.affixId)) issues.push({ level: 'warn', text: `${a?.name ?? p.affixId} doesn't roll on ${game.name}.` });
  }
  if (item.powerId && item.rarity === 'legendary' && !game.powers.includes(item.powerId))
    issues.push({ level: 'warn', text: `${gamePowers[item.powerId]?.name ?? item.powerId} doesn't roll on ${game.name}. You'd need to stamp it.` });
  return issues;
}

function ItemEditor({
  slot,
  kind,
  item,
  forge,
  onChange,
  onRemove,
}: {
  slot: Slot;
  kind: LoadoutKind;
  item: PlannedItem;
  forge: ForgeOp[];
  onChange: (fn: (i: PlannedItem) => PlannedItem) => void;
  onRemove: () => void;
}) {
  const [allPowers, setAllPowers] = useState(false);
  const [allAffixes, setAllAffixes] = useState(false);
  const rarity = rarityById.get(item.rarity)!;
  const game = item.gameId !== undefined ? gameItemById.get(item.gameId) : undefined;
  const pool = game && !allAffixes ? new Set(game.affixes) : null;
  const eligible = affixesFor(slot, kind, ALL_AFFIXES).filter((a) => !pool || pool.has(a.id));
  const issues = [...itemIssues(slot, item), ...gameIssues(item, game)];
  const full = item.affixes.length >= rarity.affixes[1];
  const slotLabel = SLOTS.find((s) => s.id === slot)!.label;
  const limits = affixLimits(item.rarity, slot).limits;
  const slotItems = useMemo(() => gameItems.filter((i) => i.slot === slot), [slot]);
  const affixChance = useMemo(() => {
    if (!game) return new Map<string, number>();
    const total = game.affixWeights.reduce((n, w) => n + w, 0);
    return new Map(game.affixes.map((id, i) => [id, (game.affixWeights[i] / total) * 100]));
  }, [game]);

  /** Typing a known item's name links the piece to it and fills in what the game knows. */
  const rename = (name: string) =>
    onChange((i) => {
      const matches = slotItems.filter((g) => g.name.toLowerCase() === name.trim().toLowerCase());
      const match = matches.find((g) => g.ilvl === i.ilvl) ?? matches.at(-1);
      if (!match) {
        const { gameId: _, ...rest } = i;
        return { ...rest, name };
      }
      return {
        ...i,
        name: match.name,
        gameId: match.id,
        ilvl: match.ilvl,
        twoHanded: match.twoHanded,
        style: match.styles.length === 1 ? (match.styles[0].toLowerCase() as Style) : 'any',
      };
    });

  const counts: Partial<Record<Category, number>> = {};
  for (const p of item.affixes) {
    const cat = affixById.get(p.affixId)?.category;
    if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const addAffix = (id: string) => {
    const affix = affixById.get(id);
    if (!affix) return;
    const tier = bestTier(affix, item);
    onChange((i) => ({ ...i, affixes: [...i.affixes, { affixId: id, tier: tier.tier, value: tier.max }] }));
  };

  const powerPool = game ? new Set(game.powers) : null;
  const powerOptions = allPowers ? ALL_POWERS : powerPool ? ALL_POWERS.filter((p) => powerPool.has(p.id)) : powersFor([slot], ALL_POWERS);
  const powerChance = useMemo(() => {
    if (!game) return new Map<string, number>();
    const ws = game.powers.map((id) => powerWeight(gamePowers[id], game.slot));
    const total = ws.reduce((n, w) => n + w, 0);
    return new Map(game.powers.map((id, i) => [id, (ws[i] / total) * 100]));
  }, [game]);
  const power = item.powerId ? powerById.get(item.powerId) : undefined;

  return (
    <div className="editor" style={{ '--rarity': rarity.color } as React.CSSProperties}>
      <header className="editor__head">
        <h2>{slotLabel}</h2>
        <button className="btn btn--quiet" onClick={onRemove}>
          Clear slot
        </button>
      </header>

      <div className="editor__fields">
        <label className="field editor__name">
          Item
          <input
            className="input"
            value={item.name}
            list={`game-items-${slot}`}
            placeholder={slot === 'weapon' ? 'e.g. Abyssal whip' : 'e.g. Infinity top'}
            onChange={(e) => rename(e.target.value)}
          />
          <datalist id={`game-items-${slot}`}>
            {slotItems.map((g) => (
              <option key={g.id} value={g.name} label={`ilvl ${g.ilvl}`} />
            ))}
          </datalist>
        </label>
        <label className="field">
          Rarity
          <select
            className="select editor__rarity"
            value={item.rarity}
            onChange={(e) => onChange((i) => ({ ...i, rarity: e.target.value as PlannedItem['rarity'] }))}
          >
            {RARITIES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}, {r.affixes[0] === r.affixes[1] ? r.affixes[0] : `${r.affixes[0]}–${r.affixes[1]}`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Item level
          <input
            className="input num"
            type="number"
            min={0}
            max={255}
            value={item.ilvl}
            onChange={(e) => onChange((i) => ({ ...i, ilvl: Math.max(0, Math.min(255, Number(e.target.value) || 0)) }))}
          />
        </label>
        <label className="field">
          Variant
          <select
            className="select"
            value={item.variant}
            onChange={(e) => onChange((i) => ({ ...i, variant: e.target.value as PlannedItem['variant'] }))}
            title={variantById.get(item.variant)?.note}
          >
            {VARIANTS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.multiplier !== 1 ? ` (+${Math.round((v.multiplier - 1) * 100)}%)` : ''}
              </option>
            ))}
          </select>
        </label>
        {kind === 'combat' && (
          <label className="field">
            Gear style
            <select className="select" value={item.style} onChange={(e) => onChange((i) => ({ ...i, style: e.target.value as Style }))}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'combat' && slot === 'weapon' && (
          <label className="editor__check">
            <input type="checkbox" checked={item.twoHanded} onChange={(e) => onChange((i) => ({ ...i, twoHanded: e.target.checked }))} />
            Two-handed (stat affixes ×1.75)
          </label>
        )}
      </div>

      {game ? (
        <GameFacts game={game} />
      ) : (
        item.name.trim() && <p className="muted editor__game">Not an item the game lists for this slot, so any affix the slot allows is offered.</p>
      )}

      <section className="editor__section">
        <div className="editor__section-head">
          <h3>Affixes</h3>
          <span className="muted num">
            {item.affixes.length} of {rarity.affixes[1]}
          </span>
          {limits && kind === 'combat' && (
            <span className="editor__limits">
              {Object.entries(limits).map(([cat, limit]) => (
                <span key={cat} className={`tag tag--${cat}${(counts[cat as Category] ?? 0) > limit ? ' tag--over' : ''}`}>
                  {CATEGORY_LABEL[cat as Category]} {counts[cat as Category] ?? 0}/{limit}
                </span>
              ))}
            </span>
          )}
        </div>

        {item.affixes.length > 0 && (
          <ol className="affix-list">
            {item.affixes.map((p, idx) => (
              <AffixRow
                key={idx}
                slot={slot}
                item={item}
                planned={p}
                onChange={(next) => onChange((i) => ({ ...i, affixes: i.affixes.map((a, j) => (j === idx ? next : a)) }))}
                onRemove={() => onChange((i) => ({ ...i, affixes: i.affixes.filter((_, j) => j !== idx) }))}
              />
            ))}
          </ol>
        )}

        {rarity.affixes[1] === 0 ? (
          <p className="muted">Common items have no affixes.</p>
        ) : (
          <label className="field editor__add">
            <span className="visually-hidden">Add an affix</span>
            <select className="select" value="" disabled={full} onChange={(e) => addAffix(e.target.value)}>
              <option value="">{full ? `${rarity.label} items are full at ${rarity.affixes[1]}` : 'Add an affix…'}</option>
              {(['offence', 'defence', 'utility', 'skilling'] as Category[]).map((cat) => {
                const group = eligible.filter((a) => a.category === cat);
                if (!group.length) return null;
                return (
                  <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                    {group.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}: {a.tiers[0].template.replace('{v}', 'X')}
                        {affixChance.has(a.id) && ` (${fmt(affixChance.get(a.id)!)}% first roll)`}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
        )}
        {game && (
          <label className="editor__check">
            <input type="checkbox" checked={allAffixes} onChange={(e) => setAllAffixes(e.target.checked)} />
            Include affixes this item can't roll
          </label>
        )}
      </section>

      {kind === 'combat' && (
        <section className="editor__section">
          <div className="editor__section-head">
            <h3>Demonic Power</h3>
            {item.rarity !== 'legendary' && <span className="muted">Legendary items only</span>}
          </div>
          {item.rarity === 'legendary' && (
            <>
              <select
                className="select"
                value={item.powerId ?? ''}
                onChange={(e) => onChange((i) => ({ ...i, powerId: e.target.value || null }))}
                aria-label="Demonic Power"
              >
                <option value="">No power planned</option>
                {powerOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.styles.includes('any') ? '' : ` (${p.styles.join(', ')})`}
                    {powerChance.has(p.id) && `, ${fmt(powerChance.get(p.id)!)}%`}
                  </option>
                ))}
              </select>
              <label className="editor__check">
                <input type="checkbox" checked={allPowers} onChange={(e) => setAllPowers(e.target.checked)} />
                {game ? "Include powers this item can't roll" : 'Include powers the wiki lists for other slots'}
              </label>
              {power && <PowerDetail power={power} />}
            </>
          )}
        </section>
      )}

      {forge.length > 0 && (
        <section className="editor__section editor__forge">
          <h3>Forge work</h3>
          <p>
            {forge.map((op) => OP_LABEL[op.kind] + (op.count > 1 ? ` ×${op.count}` : '')).join(', ')}:{' '}
            <span className="num">{costText(sumCosts(forge.map(opCost)))}</span>.{' '}
            <a href={`${base}/forge/`}>Edit on Forge costs</a>
          </p>
        </section>
      )}

      {issues.length > 0 && (
        <section className="editor__section">
          <IssueList issues={issues} />
        </section>
      )}
    </div>
  );
}

function PowerDetail({ power }: { power: NonNullable<ReturnType<typeof powerById.get>> }) {
  return (
    <div className="power-detail">
      <p>{describePower(power)}</p>
      <p className="muted">
        {power.max !== null && (
          <>
            Ancient max {fmt(power.ancientMax)}, Primal max {fmt(power.primalMax)}.{' '}
          </>
        )}
        {power.cooldown && <>Cooldown {power.cooldown}. </>}
        {power.limits}
      </p>
      {power.sources && <p className="muted">Also from: {power.sources}</p>}
    </div>
  );
}

// ---------- soul-brands ----------

function SoulBrands({
  brands,
  onChange,
}: {
  brands: NamedLoadout['soulBrands'];
  onChange: (b: NamedLoadout['soulBrands']) => void;
}) {
  return (
    <section className="brands panel">
      <h2>Soul-brands</h2>
      <p className="muted brands__note">
        Always active, no item needed. Opens at Tier 2. The lists follow the wiki's slot column, which is close to the game's but not
        exact (the game offers 59 weapon powers; the wiki lists 54 for the weapon slot).
      </p>
      {SOUL_BRAND_SLOTS.map((b) => (
        <label key={b.id} className="field">
          {b.label}
          <select
            className="select"
            value={brands[b.id] ?? ''}
            onChange={(e) => onChange({ ...brands, [b.id]: e.target.value || null })}
          >
            <option value="">Nothing branded</option>
            {powersFor(b.itemSlots, ALL_POWERS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </section>
  );
}

// ---------- summary ----------

function LoadoutSummary({ loadout: named, relics }: { loadout: NamedLoadout; relics: ReadonlySet<string> }) {
  const { kind, items: loadout } = named;
  const totals = loadoutTotals(loadout, relics);
  const powers = kind === 'combat' ? activePowers(named) : [];
  const issues = loadoutIssues(loadout);

  return (
    <section className="summary">
      <div className="summary__totals">
        <h2>Loadout totals</h2>
        <IssueList issues={issues} />
        {totals.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Affix</th>
                  <th>From</th>
                  <th className="num">Total</th>
                  <th className="num">Cap</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.affix.id} className={t.over ? 'summary__over' : undefined}>
                    <td>
                      <span className={`cat-dot cat-dot--${t.affix.category}`} aria-hidden="true" />
                      {t.affix.name}
                      {t.rolls > 1 && <span className="muted"> ({t.rolls} rolls)</span>}
                    </td>
                    <td className="muted">{t.slots.map((s) => (s.rolls > 1 ? `${s.slot} (${s.rolls})` : s.slot)).join(', ')}</td>
                    <td className="num">
                      {t.total === null ? describe(t.affix.tiers.at(-1)!, null) : `${fmt(t.total)}${t.unit}`}
                    </td>
                    <td className="num" title={t.cap.note ?? undefined}>
                      {t.cap.value === null ? <span className="muted">None</span> : t.cap.text}
                      {t.over && <span className="summary__over-label"> over cap</span>}
                      {t.converts && <span className="summary__converts"> excess becomes crit damage</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Add affixes to an item to see your totals against each cap.</p>
        )}
      </div>

      {kind === 'combat' && (
        <div className="summary__powers">
          <h2>Active powers</h2>
          {powers.length ? (
            <ul className="power-list">
              {powers.map((p, i) => (
                <li key={i} className={p.duplicate ? 'power-list__dupe' : undefined}>
                  <strong>{p.power.name}</strong> <span className="muted">from {p.source}</span>
                  <span className="power-list__effect">{describePower(p.power)}</span>
                  {p.duplicate && <span className="power-list__warn">Duplicate: only the stronger copy counts.</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Give a Legendary item a power, or pick a soul-brand.</p>
          )}
          {relics.has('fiery-fashion') && (
            <p className="muted">Fiery Fashion: powers on your transmog items also apply. They aren't counted here.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- compare ----------

function LoadoutCompare({ plan, loadout, relics }: { plan: Plan; loadout: NamedLoadout; relics: ReadonlySet<string> }) {
  const others = plan.loadouts.filter((l) => l.id !== loadout.id);
  const [otherId, setOtherId] = useState('');
  const other = others.find((l) => l.id === otherId);
  if (!others.length) return null;

  const mine = new Map(loadoutTotals(loadout.items, relics).map((t) => [t.affix.id, t]));
  const theirs = other ? new Map(loadoutTotals(other.items, relics).map((t) => [t.affix.id, t])) : new Map();
  const order: Category[] = ['offence', 'defence', 'utility', 'skilling'];
  const rows = [...new Set([...mine.keys(), ...theirs.keys()])]
    .map((id) => ({ a: mine.get(id), b: theirs.get(id), affix: (mine.get(id) ?? theirs.get(id))!.affix }))
    .sort((x, y) => order.indexOf(x.affix.category) - order.indexOf(y.affix.category) || x.affix.name.localeCompare(y.affix.name));
  const powerNames = (l: NamedLoadout) => new Set(l.kind === 'combat' ? activePowers(l).map((p) => p.power.name) : []);
  const myPowers = powerNames(loadout);
  const theirPowers = other ? powerNames(other) : new Set<string>();

  const cell = (t: ReturnType<typeof mine.get>) =>
    !t ? <span className="muted">–</span> : t.total === null ? 'Yes' : `${fmt(t.total)}${t.unit}`;
  const name = (l: NamedLoadout) => l.name.trim() || 'Untitled';

  return (
    <section className="compare">
      <div className="compare__head">
        <h2>Compare</h2>
        <label className="field">
          <span className="visually-hidden">Compare with</span>
          <select className="select" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            <option value="">Compare with another loadout…</option>
            {others.map((l) => (
              <option key={l.id} value={l.id}>
                {name(l)} ({KIND_LABEL[l.kind].toLowerCase()})
              </option>
            ))}
          </select>
        </label>
      </div>
      {other &&
        (rows.length || myPowers.size || theirPowers.size ? (
          <>
            {rows.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Affix</th>
                      <th className="num">{name(loadout)}</th>
                      <th className="num">{name(other)}</th>
                      <th className="num">Difference</th>
                      <th className="num">Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ a, b, affix }) => {
                      const diff = a?.total != null && b?.total != null ? a.total - b.total : null;
                      const unit = (a ?? b)!.unit;
                      return (
                        <tr key={affix.id}>
                          <td>
                            <span className={`cat-dot cat-dot--${affix.category}`} aria-hidden="true" />
                            {affix.name}
                          </td>
                          <td className={`num${a?.over ? ' compare__over' : ''}`}>{cell(a)}</td>
                          <td className={`num${b?.over ? ' compare__over' : ''}`}>{cell(b)}</td>
                          <td className={`num ${diff ? (diff > 0 ? 'compare__up' : 'compare__down') : 'muted'}`}>
                            {diff === null
                              ? a && !b
                                ? `only ${name(loadout)}`
                                : b && !a
                                  ? `only ${name(other)}`
                                  : '–'
                              : diff === 0
                                ? 'same'
                                : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}${unit}`}
                          </td>
                          <td className="num muted">{(a ?? b)!.cap.value === null ? 'None' : (a ?? b)!.cap.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {(myPowers.size > 0 || theirPowers.size > 0) && (
              <div className="compare__powers">
                {[
                  { label: name(loadout), only: [...myPowers].filter((p) => !theirPowers.has(p)) },
                  { label: name(other), only: [...theirPowers].filter((p) => !myPowers.has(p)) },
                ].map(({ label, only }) => (
                  <p key={label + only.length}>
                    <span className="muted">Powers only in {label}:</span> {only.length ? only.join(', ') : 'none'}
                  </p>
                ))}
              </div>
            )}
            <p className="muted compare__note">Over-cap totals are marked red. Both columns use this run's relics.</p>
          </>
        ) : (
          <p className="muted">Neither loadout has affixes or powers planned yet.</p>
        ))}
    </section>
  );
}

// ---------- loadout management ----------

const KIND_LABEL: Record<LoadoutKind, string> = { combat: 'Combat', skilling: 'Skilling' };

function LoadoutTabs({ plan, onSelect, onCreate }: { plan: Plan; onSelect: (id: string) => void; onCreate: (kind: LoadoutKind) => void }) {
  return (
    <div className="loadouts">
      <div className="loadouts__tabs" role="tablist" aria-label="Loadouts">
        {plan.loadouts.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={l.id === plan.activeLoadout}
            className={`loadouts__tab loadouts__tab--${l.kind}`}
            onClick={() => onSelect(l.id)}
          >
            <span className="loadouts__tab-name">{l.name.trim() || 'Untitled'}</span>
            <span className="loadouts__tab-meta num">
              {KIND_LABEL[l.kind]}, {Object.keys(l.items).length}/10
            </span>
          </button>
        ))}
      </div>
      <div className="loadouts__new">
        <button className="btn btn--quiet" onClick={() => onCreate('combat')}>
          New combat loadout
        </button>
        <button className="btn btn--quiet" onClick={() => onCreate('skilling')}>
          New skilling loadout
        </button>
      </div>
    </div>
  );
}

function LoadoutHeader({
  loadout,
  canDelete,
  focusName,
  onRename,
  onDuplicate,
  onDelete,
}: {
  loadout: NamedLoadout;
  canDelete: boolean;
  focusName: boolean;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="loadout-head">
      <label className="loadout-head__name">
        <span className="visually-hidden">Loadout name</span>
        <input
          key={loadout.id}
          className="input"
          value={loadout.name}
          placeholder="Name this loadout"
          autoFocus={focusName}
          onFocus={(e) => focusName && e.target.select()}
          onChange={(e) => onRename(e.target.value)}
        />
      </label>
      <span className="tag">{KIND_LABEL[loadout.kind]} loadout</span>
      <div className="loadout-head__actions">
        <button className="btn btn--quiet" onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          className="btn btn--quiet"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? undefined : 'A plan needs at least one loadout'}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------- page ----------

export default function GearPlanner() {
  const [plan, setPlan] = usePlan();
  const [selected, setSelected] = useState<Slot>('weapon');
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const active = plan.loadouts.find((l) => l.id === plan.activeLoadout) ?? plan.loadouts[0];
  const { kind, items: loadout } = active;
  const item = loadout[selected];
  const blocked = slotBlocked(selected, kind, loadout);

  const updateActive = (fn: (l: NamedLoadout) => NamedLoadout) =>
    setPlan((p) => ({ ...p, loadouts: p.loadouts.map((l) => (l.id === active.id ? fn(l) : l)) }));
  const setLoadout = (fn: (l: Loadout) => Loadout) => updateActive((l) => ({ ...l, items: fn(l.items) }));
  const updateItem = (fn: (i: PlannedItem) => PlannedItem) =>
    setLoadout((l) => ({ ...l, [selected]: fn(l[selected] ?? newItem()) }));
  const removeItem = () =>
    setLoadout((l) => {
      const next = { ...l };
      delete next[selected];
      return next;
    });

  const select = (id: string) => {
    setJustCreated(null);
    setPlan((p) => ({ ...p, activeLoadout: id }));
  };
  const create = (k: LoadoutKind) => {
    const n = plan.loadouts.filter((l) => l.kind === k).length + 1;
    const fresh = newLoadout(k, `${KIND_LABEL[k]} ${n}`);
    setJustCreated(fresh.id);
    setPlan((p) => ({ ...p, loadouts: [...p.loadouts, fresh], activeLoadout: fresh.id }));
  };
  const duplicate = () => {
    const copy: NamedLoadout = { ...structuredClone(active), id: crypto.randomUUID(), name: `${active.name} copy` };
    setJustCreated(copy.id);
    setPlan((p) => {
      const at = p.loadouts.findIndex((l) => l.id === active.id);
      return { ...p, loadouts: [...p.loadouts.slice(0, at + 1), copy, ...p.loadouts.slice(at + 1)], activeLoadout: copy.id };
    });
  };
  const remove = () => {
    const filled = Object.keys(active.items).length;
    if (filled && !window.confirm(`Delete "${active.name || 'Untitled'}" and its ${filled} planned item${filled === 1 ? '' : 's'}?`)) return;
    setPlan((p) => {
      const at = p.loadouts.findIndex((l) => l.id === active.id);
      const loadouts = p.loadouts.filter((l) => l.id !== active.id);
      return { ...p, loadouts, activeLoadout: loadouts[Math.max(0, at - 1)].id };
    });
  };

  return (
    <div className="gear">
      <LoadoutTabs plan={plan} onSelect={select} onCreate={create} />
      <LoadoutHeader
        loadout={active}
        canDelete={plan.loadouts.length > 1}
        focusName={justCreated === active.id}
        onRename={(name) => updateActive((l) => ({ ...l, name }))}
        onDuplicate={duplicate}
        onDelete={remove}
      />

      <div className="gear__main">
        <div className="gear__left">
          <div className="paperdoll" aria-label="Equipment slots">
            {SLOTS.map((s) => (
              <div key={s.id} style={{ gridRow: s.row, gridColumn: s.col }}>
                <SlotTile
                  slot={s.id}
                  label={s.label}
                  item={loadout[s.id]}
                  selected={selected === s.id}
                  blocked={slotBlocked(s.id, kind, loadout)}
                  onSelect={() => setSelected(s.id)}
                />
              </div>
            ))}
          </div>
          {kind === 'combat' && (
            <SoulBrands brands={active.soulBrands} onChange={(soulBrands) => updateActive((l) => ({ ...l, soulBrands }))} />
          )}
        </div>

        <div className="gear__editor panel">
          {item ? (
            <ItemEditor
              slot={selected}
              kind={kind}
              item={item}
              forge={plan.forge.filter((op) => op.loadout === active.id && op.slot === selected)}
              onChange={updateItem}
              onRemove={removeItem}
            />
          ) : (
            <div className="editor__empty">
              <h2>{SLOTS.find((s) => s.id === selected)!.label}</h2>
              {blocked ? (
                <p className="muted">{blocked}.</p>
              ) : (
                <>
                  <p className="muted">Nothing planned for this slot.</p>
                  <button className="btn btn--hot" onClick={() => updateItem((i) => i)}>
                    Plan an item
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <LoadoutSummary loadout={active} relics={activeRelics(plan)} />
      <LoadoutCompare key={active.id} plan={plan} loadout={active} relics={activeRelics(plan)} />
    </div>
  );
}
