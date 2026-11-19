import { MAX_PLAYTHROUGHS, RELIC_TIERS, relicById, type Relic } from '../data/relics';
import { newPlaythrough, usePlan } from '../lib/plan';
import {
  NON_COMBAT_RELICS,
  PLAYTHROUGH_LABEL,
  hasMaxedReward,
  lockedRelics,
  playthroughIssues,
  reloadedChoices,
} from '../lib/playthroughs';
import type { Plan, Playthrough } from '../lib/types';
import './RelicPlanner.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const deepest = RELIC_TIERS.length;
const RUN_SHORT = ['First', 'Second', 'Third'];

type CardState = 'open' | 'chosen' | 'extra' | 'dimmed' | 'locked' | 'conflict';

function RelicCard({ relic, state, note, onPick }: { relic: Relic; state: CardState; note?: string; onPick: () => void }) {
  const chosen = state === 'chosen' || state === 'extra' || state === 'conflict';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      aria-disabled={state === 'locked'}
      className={`relic relic--${state}${chosen ? ' relic--chosen' : ''}`}
      onClick={state === 'locked' ? undefined : onPick}
    >
      <span className="relic__head">
        {relic.icon && <img className="relic__icon" src={`${base}/icons/${relic.icon}`} alt="" width={48} height={48} />}
        <span>
          <span className="relic__name">{relic.name}</span>
          <span className="relic__summary">{relic.summary}</span>
        </span>
      </span>
      {note && <span className="relic__badge">{note}</span>}
      {relic.revealed ? (
        <ul className="relic__effects">
          {relic.effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {relic.scaling?.map((s) => (
            <li key={s.text} className="relic__scaling">
              From Tier {s.tier}: {s.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="unrevealed">Not revealed yet.</p>
      )}
    </button>
  );
}

function PlaythroughTabs({ plan, setPlan }: { plan: Plan; setPlan: ReturnType<typeof usePlan>[1] }) {
  const count = plan.playthroughs.length;
  const select = (i: number) => setPlan((p) => ({ ...p, activePlaythrough: i }));
  const add = () =>
    setPlan((p) => ({ ...p, playthroughs: [...p.playthroughs, newPlaythrough()], activePlaythrough: p.playthroughs.length }));
  const removeLast = () => {
    const last = plan.playthroughs[count - 1];
    if (Object.keys(last.relics).length && !window.confirm(`Remove the ${PLAYTHROUGH_LABEL[count - 1].toLowerCase()} and its relic picks?`)) return;
    setPlan((p) => {
      const playthroughs = p.playthroughs.slice(0, -1);
      return { ...p, playthroughs, activePlaythrough: Math.min(p.activePlaythrough, playthroughs.length - 1) };
    });
  };

  return (
    <div className="runs">
      <div className="runs__tabs" role="tablist" aria-label="Playthroughs">
        {plan.playthroughs.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === plan.activePlaythrough}
            className="runs__tab"
            onClick={() => select(i)}
          >
            <span className="runs__tab-name">{RUN_SHORT[i]} run</span>
            <span className="runs__tab-meta num">
              {Object.keys(t.relics).length} of {RELIC_TIERS.length} relics
              {playthroughIssues(plan, i).length > 0 && <span className="runs__tab-warn"> · check picks</span>}
            </span>
          </button>
        ))}
      </div>
      <div className="runs__actions">
        {count < MAX_PLAYTHROUGHS && (
          <button type="button" className="btn btn--quiet" onClick={add}>
            + Plan a prestige
          </button>
        )}
        {count > 1 && (
          <button type="button" className="btn btn--quiet" onClick={removeLast}>
            Remove {RUN_SHORT[count - 1].toLowerCase()} run
          </button>
        )}
      </div>
    </div>
  );
}

function ReloadedPicker({ run, locked, onPick }: { run: Playthrough; locked: Map<string, number>; onPick: (id: string) => void }) {
  const choices = reloadedChoices(run);
  const pickedLocked = run.reloaded ? locked.has(run.reloaded) : false;
  return (
    <div className="reloaded">
      <p className="reloaded__title">
        <strong>Reloaded extra relic</strong> <span className="muted">from Tiers 1–3</span>
      </p>
      <div className="reloaded__choices" role="radiogroup" aria-label="Reloaded extra relic">
        {choices.map(({ relic, tier }) => (
          <button
            key={relic.id}
            type="button"
            role="radio"
            aria-checked={run.reloaded === relic.id}
            className="chip"
            onClick={() => onPick(relic.id)}
          >
            {relic.icon && <img src={`${base}/icons/${relic.icon}`} alt="" width={20} height={20} />}
            {relic.name}
            <span className="muted num"> T{tier}</span>
            {locked.has(relic.id) && <span className="muted"> · locked earlier</span>}
          </button>
        ))}
      </div>
      {pickedLocked && (
        <p className="muted reloaded__note">
          An earlier playthrough picked this relic. The wiki doesn't say yet whether Reloaded can grant a relic that a prestige locked.
        </p>
      )}
    </div>
  );
}

export default function RelicPlanner() {
  const [plan, setPlan] = usePlan();
  const runIndex = plan.activePlaythrough;
  const run = plan.playthroughs[runIndex];
  const locked = lockedRelics(plan, runIndex);
  const issues = playthroughIssues(plan, runIndex);
  const conflictTiers = new Set(issues.map((i) => i.tier));
  const reloadedOn = Object.values(run.relics).includes('reloaded');
  const maxed = hasMaxedReward(plan, runIndex);

  const updateRun = (fn: (t: Playthrough) => Playthrough) =>
    setPlan((p) => ({ ...p, playthroughs: p.playthroughs.map((t, i) => (i === p.activePlaythrough ? fn(t) : t)) }));

  const pick = (tier: number, id: string) =>
    updateRun((t) => {
      const relics = { ...t.relics };
      if (relics[tier] === id) delete relics[tier];
      else relics[tier] = id;
      // Reloaded only grants a relic you don't already have, and goes away with Reloaded.
      const keepExtra = t.reloaded && Object.values(relics).includes('reloaded') && !Object.values(relics).includes(t.reloaded);
      return { relics, reloaded: keepExtra ? t.reloaded : null };
    });
  const pickExtra = (id: string) => updateRun((t) => ({ ...t, reloaded: t.reloaded === id ? null : id }));

  const chosen = RELIC_TIERS.map((t) => ({ tier: t, relic: relicById.get(run.relics[t.tier]) }));
  const extra = reloadedOn && run.reloaded ? relicById.get(run.reloaded) : undefined;
  const scaling = [...chosen.map((c) => c.relic), extra].flatMap(
    (relic) => relic?.scaling?.map((s) => ({ ...s, relic: relic.name })) ?? [],
  );

  function cardState(tier: number, r: Relic): { state: CardState; note?: string } {
    const choice = run.relics[tier];
    const lockedIn = locked.get(r.id);
    if (choice === r.id && lockedIn !== undefined) return { state: 'conflict', note: `Locked: picked in the ${RUN_SHORT[lockedIn].toLowerCase()} run` };
    if (choice === r.id) return { state: 'chosen' };
    if (reloadedOn && run.reloaded === r.id) return { state: 'extra', note: 'Extra relic from Reloaded' };
    const fromMaxed = maxed && !RELIC_TIERS.find((t) => t.tier === tier)?.combat;
    if (lockedIn !== undefined)
      return { state: 'locked', note: `Picked in the ${RUN_SHORT[lockedIn].toLowerCase()} run${fromMaxed ? ', active from the maxed reward' : ''}` };
    if (fromMaxed) return { state: 'extra', note: 'Active from the maxed reward' };
    return { state: choice ? 'dimmed' : 'open' };
  }

  return (
    <div className="relic-planner">
      <PlaythroughTabs plan={plan} setPlan={setPlan} />

      <ol className="descent">
        {RELIC_TIERS.map((t) => (
          <li key={t.tier} className="tier" style={{ '--depth': t.tier / deepest } as React.CSSProperties}>
            <div className="tier__rail" aria-hidden="true">
              <div className="tier__marker">{t.tier}</div>
            </div>
            <div className="tier__body">
              <header className="tier__head">
                <h2>Tier {t.tier}</h2>
                <span className="tier__points num">
                  {t.points ? `${t.points.toLocaleString()} points` : 'Points not revealed'}
                </span>
                {t.combat && <span className="tier__tag">Combat · resettable with a Demonic Reset card</span>}
              </header>

              {conflictTiers.has(t.tier) && (
                <ul className="issues">
                  {issues
                    .filter((i) => i.tier === t.tier)
                    .map((i) => (
                      <li key={i.text} className="error">
                        {i.text}
                      </li>
                    ))}
                </ul>
              )}

              {t.relics.length ? (
                <div className="tier__relics" role="radiogroup" aria-label={`Tier ${t.tier} relic`}>
                  {t.relics.map((r) => {
                    const { state, note } = cardState(t.tier, r);
                    return <RelicCard key={r.id} relic={r} state={state} note={note} onPick={() => pick(t.tier, r.id)} />;
                  })}
                </div>
              ) : (
                <p className="unrevealed">Relics not revealed yet.</p>
              )}

              {run.relics[t.tier] === 'reloaded' && <ReloadedPicker run={run} locked={locked} onPick={pickExtra} />}

              <div className="tier__extras">
                {t.unlocks.length > 0 && (
                  <p className="tier__unlocks">
                    <span className="muted">Opens: </span>
                    {t.unlocks.join(', ')}
                  </p>
                )}
                {t.passives.length > 0 && (
                  <details className="tier__passives">
                    <summary>Passive effects ({t.passives.length})</summary>
                    <ul>
                      {t.passives.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <aside className="path-summary" aria-label="Your relic path">
        <h2>{PLAYTHROUGH_LABEL[runIndex]}</h2>
        <ol className="path-summary__list">
          {chosen.map(({ tier, relic }) => (
            <li key={tier.tier} className={conflictTiers.has(tier.tier) ? 'path-summary__conflict' : undefined}>
              <span className="muted num">Tier {tier.tier}</span>
              {relic ? <strong>{relic.name}</strong> : <span className="muted">{tier.relics.length ? 'Not chosen' : 'Not revealed'}</span>}
            </li>
          ))}
          {reloadedOn && (
            <li>
              <span className="muted">Reloaded</span>
              {extra ? <strong>{extra.name}</strong> : <span className="muted">Pick an extra relic under Tier 6</span>}
            </li>
          )}
        </ol>

        {issues.some((i) => i.tier === null) && (
          <ul className="issues">
            {issues
              .filter((i) => i.tier === null)
              .map((i) => (
                <li key={i.text} className="error">
                  {i.text}
                </li>
              ))}
          </ul>
        )}

        {scaling.length > 0 && (
          <>
            <h3>Grows later</h3>
            <ul className="path-summary__notes">
              {scaling.map((s) => (
                <li key={s.relic + s.tier}>
                  <span className="muted">Tier {s.tier}:</span> {s.text} ({s.relic})
                </li>
              ))}
            </ul>
          </>
        )}

        {locked.size > 0 && (
          <>
            <h3>Locked by earlier runs</h3>
            <p className="path-summary__notes muted">
              {[...locked.keys()].map((id) => relicById.get(id)?.name ?? id).join(', ')}
            </p>
          </>
        )}

        {runIndex === MAX_PLAYTHROUGHS - 1 && (
          <>
            <h3>Maxed reward</h3>
            <p className="path-summary__notes">
              {maxed ? 'Reaching Tier 7 in this run turns on' : 'Reach Tier 7 in this run to turn on'} every non-combat relic at once (
              {NON_COMBAT_RELICS.length} relics from Tiers 1–3, 5, and 6), plus a maxed icon and a world broadcast.
            </p>
          </>
        )}

        <h3>League Prestiging</h3>
        <p className="path-summary__notes muted">
          Ironman, Hardcore, and Ultimate Ironman accounts can prestige twice, which resets skills, League points, relics, the
          collection log, achievements, and Codex powers. Each prestige locks the relics you picked. Group Ironman can't prestige.
        </p>
      </aside>
    </div>
  );
}
