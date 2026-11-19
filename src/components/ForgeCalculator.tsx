import { useState } from 'react';
import {
  AWAKENING_COST,
  IMPROVE_TIER_ILVL,
  LEGENDARY_TRANSPLANT_MULTIPLIER,
  OUTFITTER_STEPS,
  OUTFIT_PIECE_TOKENS,
  OUTFIT_RESOURCES,
  outfitPoints,
  STAMP_EXAMPLE_GEMS,
  TRANSPLANT_COST,
} from '../data/league';
import { usePlan } from '../lib/plan';
import { ROMAN } from '../lib/rules';
import type { ForgeOp } from '../lib/types';
import './ForgeCalculator.css';

interface Cost {
  gems: number;
  cores: number;
  embers: number;
  thread: number;
  bars: Record<string, number>;
  estimated: boolean;
}

const zero = (): Cost => ({ gems: 0, cores: 0, embers: 0, thread: 0, bars: {}, estimated: false });

function opCost(op: ForgeOp): Cost {
  const c = zero();
  switch (op.kind) {
    case 'transplant': {
      const row = TRANSPLANT_COST[(op.tier ?? 1) - 1];
      const m = op.ontoLegendary ? LEGENDARY_TRANSPLANT_MULTIPLIER : 1;
      c.gems = Math.floor(row.gems * m);
      c.cores = Math.floor(row.cores * m);
      break;
    }
    case 'awaken-legendary':
    case 'awaken-ancient': {
      const a = AWAKENING_COST[op.kind === 'awaken-legendary' ? 'legendary' : 'ancient'];
      c.gems = a.gems;
      c.cores = a.cores;
      c.embers = a.embers;
      break;
    }
    case 'stamp':
      c.gems = STAMP_EXAMPLE_GEMS;
      c.estimated = true;
      break;
    case 'outfit': {
      const s = OUTFITTER_STEPS.find((x) => x.id === op.step) ?? OUTFITTER_STEPS[0];
      // The Stitch Keep cost isn't public, so it adds nothing yet.
      c.gems = s.gems + (op.keep ? (s.keepGems ?? 0) : 0);
      c.cores = op.keep ? (s.keepCores ?? 0) : 0;
      c.thread = s.thread;
      c.bars[s.bars.replace(/^\d+\s+/, '')] = Number(s.bars.match(/^\d+/)?.[0] ?? 0);
      c.estimated = true;
      break;
    }
  }
  const n = Math.max(1, op.count);
  return {
    gems: c.gems * n,
    cores: c.cores * n,
    embers: c.embers * n,
    thread: c.thread * n,
    bars: Object.fromEntries(Object.entries(c.bars).map(([k, v]) => [k, v * n])),
    estimated: c.estimated,
  };
}

function sum(costs: Cost[]): Cost {
  return costs.reduce((acc, c) => {
    acc.gems += c.gems;
    acc.cores += c.cores;
    acc.embers += c.embers;
    acc.thread += c.thread;
    for (const [k, v] of Object.entries(c.bars)) acc.bars[k] = (acc.bars[k] ?? 0) + v;
    acc.estimated ||= c.estimated;
    return acc;
  }, zero());
}

const n = (v: number) => v.toLocaleString('en-US');

const OP_LABEL: Record<ForgeOp['kind'], string> = {
  transplant: 'Transplant',
  'awaken-legendary': 'Legendary Awakening',
  'awaken-ancient': 'Ancient Awakening',
  stamp: 'Stamp a power',
  outfit: 'Outfit upgrade',
};

function OpRow({ op, onChange, onRemove }: { op: ForgeOp; onChange: (o: ForgeOp) => void; onRemove: () => void }) {
  const cost = opCost(op);
  return (
    <li className="op">
      <span className="op__name">{OP_LABEL[op.kind]}</span>
      <span className="op__controls">
        {op.kind === 'transplant' && (
          <>
            <select
              className="select"
              aria-label="Tier of the moved affix"
              value={op.tier ?? 1}
              onChange={(e) => onChange({ ...op, tier: Number(e.target.value) })}
            >
              {TRANSPLANT_COST.map((t) => (
                <option key={t.tier} value={t.tier}>
                  Tier {ROMAN[t.tier]} affix
                </option>
              ))}
            </select>
            <label className="op__check">
              <input type="checkbox" checked={!!op.ontoLegendary} onChange={(e) => onChange({ ...op, ontoLegendary: e.target.checked })} />
              Onto a Legendary
            </label>
          </>
        )}
        {op.kind === 'outfit' && (
          <>
            <select
              className="select"
              aria-label="Upgrade step"
              value={op.step ?? 'trim'}
              onChange={(e) => onChange({ ...op, step: e.target.value as ForgeOp['step'] })}
            >
              {OUTFITTER_STEPS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} to {s.grade}
                </option>
              ))}
            </select>
            <label className="op__check">
              <input type="checkbox" checked={!!op.keep} onChange={(e) => onChange({ ...op, keep: e.target.checked })} />
              Keep affixes
              {op.keep && op.step === 'stitch' && <span className="muted"> (Keep cost not revealed)</span>}
            </label>
          </>
        )}
        <label className="op__count">
          <span className="muted">×</span>
          <input
            className="input num"
            type="number"
            min={1}
            value={op.count}
            onChange={(e) => onChange({ ...op, count: Math.max(1, Number(e.target.value) || 1) })}
            aria-label="How many"
          />
        </label>
      </span>
      <span className="op__cost num">
        {n(cost.gems)} gems
        {cost.cores > 0 && `, ${n(cost.cores)} cores`}
        {cost.embers > 0 && `, ${n(cost.embers)} embers`}
        {cost.thread > 0 && `, ${n(cost.thread)} thread`}
        {cost.estimated && <span className="muted"> (estimate)</span>}
      </span>
      <button className="btn btn--quiet" onClick={onRemove} aria-label={`Remove ${OP_LABEL[op.kind]}`}>
        Remove
      </button>
    </li>
  );
}

type Step = (typeof OUTFITTER_STEPS)[number]['id'];

function OutfitPoints() {
  const [step, setStep] = useState<Step>('trim');
  const [outfit, setOutfit] = useState(OUTFIT_RESOURCES[0].outfit);
  const s = OUTFITTER_STEPS.find((x) => x.id === step)!;
  const [lo, hi] = s.levels;
  const resources = OUTFIT_RESOURCES.find((o) => o.outfit === outfit)!.resources.filter(([, level]) => level >= lo && level <= hi);
  return (
    <section className="panel forge__ref">
      <h2>Outfit progress bar</h2>
      <p className="muted">
        Each resource adds its level plus 10 points. {s.label} takes resources of level {lo}
        {hi === Infinity ? ' and above' : `–${hi}`}. Pieces cost {n(OUTFIT_PIECE_TOKENS)} skilling tokens each.
      </p>
      <div className="forge__step">
        <label className="field">
          Outfit
          <select className="select" value={outfit} onChange={(e) => setOutfit(e.target.value)}>
            {OUTFIT_RESOURCES.map((o) => (
              <option key={o.outfit}>{o.outfit}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Step
          <select className="select" value={step} onChange={(e) => setStep(e.target.value as Step)}>
            {OUTFITTER_STEPS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label} ({n(x.points)} points)
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Resource</th>
              <th className="num">Level</th>
              <th className="num">Points each</th>
              <th className="num">Needed alone</th>
            </tr>
          </thead>
          <tbody>
            {resources.map(([name, level]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="num">{level}</td>
                <td className="num">{outfitPoints(level)}</td>
                <td className="num">{n(Math.ceil(s.points / outfitPoints(level)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted forge__fine">The wiki lists resources for the Smiths, Prospector, and Lumberjack outfits so far.</p>
    </section>
  );
}

export default function ForgeCalculator() {
  const [plan, setPlan] = usePlan();
  const ops = plan.forge;
  const total = sum(ops.map(opCost));

  const setOps = (fn: (o: ForgeOp[]) => ForgeOp[]) => setPlan((p) => ({ ...p, forge: fn(p.forge) }));
  const add = (kind: ForgeOp['kind']) =>
    setOps((o) => [
      ...o,
      {
        id: crypto.randomUUID(),
        kind,
        count: 1,
        ...(kind === 'transplant' ? { tier: 1, ontoLegendary: true } : {}),
        ...(kind === 'outfit' ? { step: 'trim' as const, keep: false } : {}),
      },
    ]);

  return (
    <div className="forge">
      <section className="forge__queue">
        <div className="forge__add">
          {(Object.keys(OP_LABEL) as ForgeOp['kind'][]).map((k) => (
            <button key={k} className="btn" onClick={() => add(k)}>
              Add {OP_LABEL[k].toLowerCase()}
            </button>
          ))}
        </div>

        {ops.length ? (
          <ol className="ops">
            {ops.map((op) => (
              <OpRow
                key={op.id}
                op={op}
                onChange={(next) => setOps((o) => o.map((x) => (x.id === op.id ? next : x)))}
                onRemove={() => setOps((o) => o.filter((x) => x.id !== op.id))}
              />
            ))}
          </ol>
        ) : (
          <p className="muted forge__empty">Add the transplants, awakenings, and outfit upgrades you plan to make. The totals add up below.</p>
        )}

        <div className="crucible" aria-live="polite">
          <h2>You'll need</h2>
          <dl className="crucible__totals">
            <div>
              <dt>Upgrade gems</dt>
              <dd className="num">{n(total.gems)}</dd>
            </div>
            <div>
              <dt>Forge Cores</dt>
              <dd className="num">{n(total.cores)}</dd>
            </div>
            <div>
              <dt>Embers</dt>
              <dd className="num">{n(total.embers)}</dd>
            </div>
            <div>
              <dt>Brimstone thread</dt>
              <dd className="num">{n(total.thread)}</dd>
            </div>
            {Object.entries(total.bars).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="num">{n(v)}</dd>
              </div>
            ))}
          </dl>
          {total.estimated && (
            <p className="muted crucible__note">
              Stamp and outfit costs come from one example each (a whip stamp and a Smiths tunic). Real costs may differ, and the Stitch Keep cost isn't public yet.
            </p>
          )}
        </div>
      </section>

      <div className="forge__refs">
        <section className="panel forge__ref">
          <h2>Transplant costs</h2>
          <p className="muted">The donor item is destroyed, with its other affixes and its power. Opens at Tier 3.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Moved affix</th>
                  <th className="num">Gems</th>
                  <th className="num">Cores</th>
                  <th className="num">Onto Legendary</th>
                </tr>
              </thead>
              <tbody>
                {TRANSPLANT_COST.map((t) => (
                  <tr key={t.tier}>
                    <td>Tier {ROMAN[t.tier]}</td>
                    <td className="num">{n(t.gems)}</td>
                    <td className="num">{n(t.cores)}</td>
                    <td className="num">
                      {n(Math.floor(t.gems * 1.5))} + {n(Math.floor(t.cores * 1.5))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel forge__ref">
          <h2>Improve ceiling</h2>
          <p className="muted">
            Improve never fails. Each tier has 10 steps. Tiers IV and V cost Forge Cores. The highest tier you can improve to depends on item
            level:
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="num">Minimum item level</th>
                </tr>
              </thead>
              <tbody>
                {IMPROVE_TIER_ILVL.map((ilvl, i) => (
                  <tr key={i}>
                    <td>Tier {ROMAN[i + 1]}</td>
                    <td className="num">{ilvl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted forge__fine">
            Per-step costs are not public yet. The one example: Tier I step 3 on a level 40 platebody cost 166 gems and 140 Forge Dust.
          </p>
        </section>

        <OutfitPoints />
      </div>
    </div>
  );
}
