import { RELIC_TIERS, UNPLACED_RELICS, relicById, type Relic } from '../data/relics';
import { usePlan } from '../lib/plan';
import './RelicPlanner.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const deepest = RELIC_TIERS.length;

function RelicCard({ relic, chosen, dimmed, onPick }: { relic: Relic; chosen: boolean; dimmed: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      className={`relic${chosen ? ' relic--chosen' : ''}${dimmed ? ' relic--dimmed' : ''}`}
      onClick={onPick}
    >
      <span className="relic__head">
        {relic.icon && <img className="relic__icon" src={`${base}/icons/${relic.icon}`} alt="" width={48} height={48} />}
        <span>
          <span className="relic__name">{relic.name}</span>
          <span className="relic__summary">{relic.summary}</span>
        </span>
      </span>
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

export default function RelicPlanner() {
  const [plan, setPlan] = usePlan();

  const pick = (tier: number, id: string) =>
    setPlan((p) => {
      const relics = { ...p.relics };
      if (relics[tier] === id) delete relics[tier];
      else relics[tier] = id;
      return { ...p, relics };
    });

  const chosen = RELIC_TIERS.map((t) => ({ tier: t, relic: relicById.get(plan.relics[t.tier]) }));
  const scaling = chosen.flatMap(({ relic }) => relic?.scaling?.map((s) => ({ ...s, relic: relic.name })) ?? []);

  return (
    <div className="relic-planner">
      <ol className="descent">
        {RELIC_TIERS.map((t) => {
          const choice = plan.relics[t.tier];
          return (
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
                </header>

                {t.relics.length ? (
                  <div className="tier__relics" role="radiogroup" aria-label={`Tier ${t.tier} relic`}>
                    {t.relics.map((r) => (
                      <RelicCard
                        key={r.id}
                        relic={r}
                        chosen={choice === r.id}
                        dimmed={!!choice && choice !== r.id}
                        onPick={() => pick(t.tier, r.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="unrevealed">Relics not revealed yet.</p>
                )}

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
          );
        })}
      </ol>

      <aside className="path-summary" aria-label="Your relic path">
        <h2>Your path</h2>
        <ol className="path-summary__list">
          {chosen.map(({ tier, relic }) => (
            <li key={tier.tier}>
              <span className="muted num">Tier {tier.tier}</span>
              {relic ? <strong>{relic.name}</strong> : <span className="muted">{tier.relics.length ? 'Not chosen' : 'Not revealed'}</span>}
            </li>
          ))}
        </ol>

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

        <h3>Tier not known yet</h3>
        {UNPLACED_RELICS.map((r) => (
          <div key={r.id} className="unplaced">
            {r.icon && <img src={`${base}/icons/${r.icon}`} alt="" width={32} height={32} />}
            <div>
              <strong>{r.name}</strong>
              <ul>
                {r.effects.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
