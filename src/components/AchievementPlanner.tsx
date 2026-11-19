import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_TIERS,
  LISTED_POINTS,
  MAX_PRESTIGES,
  POINT_SOURCES,
  PRESTIGE_POINTS,
  achievementById,
  achievements,
  type Achievement,
} from '../data/achievements';
import { MAX_PLAYTHROUGHS, RELIC_TIERS, relicById } from '../data/relics';
import { newPlaythrough, usePlan } from '../lib/plan';
import { DISCORD_LIMIT } from '../lib/plan-text';
import { PLAYTHROUGH_LABEL } from '../lib/playthroughs';
import {
  currentPoints,
  emptyProgress,
  pointsBySource,
  progressFor,
  routeFromHash,
  routeShareUrl,
  routeText,
  tierAt,
  useRoute,
  walkRoute,
  withProgress,
  type Route,
  type RunProgress,
} from '../lib/route';
import './AchievementPlanner.css';

const PAGE = 100;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const n = (v: number) => v.toLocaleString('en-US');

function useStatus(): [string, (s: string) => void] {
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(t);
  }, [status]);
  return [status, setStatus];
}

type SetProgress = (fn: (p: RunProgress) => RunProgress) => void;

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((d) => d !== id) : [...list, id]);

async function copy(value: string, setStatus: (s: string) => void, done: string) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(done);
  } catch {
    window.prompt('Copy this', value);
  }
}

// ---------- progress ----------

/** The League points panel's four sources: two from checked achievements, two typed in. */
function Sources({
  progress,
  setProgress,
  run,
  onShow,
}: {
  progress: RunProgress;
  setProgress: SetProgress;
  run: number;
  onShow: (source: Achievement['source']) => void;
}) {
  const points = pointsBySource(progress);
  const done = new Set(progress.done);
  const checks = (source: Achievement['source']) => {
    const list = achievements.filter((a) => a.source === source);
    return (
      <button type="button" className="link-btn" onClick={() => onShow(source)} title="Show these in the achievement list">
        {n(list.filter((a) => done.has(a.id)).length)} of {n(list.length)} checked
      </button>
    );
  };
  const setCount = (key: 'collectionLog' | 'prestiges', max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProgress((p) => ({ ...p, [key]: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) }));
  return (
    <section className="sources panel" aria-label="League points by source">
      <h2 className="sources__title">Points by source</h2>
      <p className="muted sources__run">{PLAYTHROUGH_LABEL[run]}</p>
      <ul className="sources__rows">
        {POINT_SOURCES.map((s) => (
          <li key={s.id} className="sources__row">
            <span className="sources__label">{s.label}</span>
            <span className="sources__bar" style={{ '--fill': Math.min(1, points[s.id] / s.max) } as React.CSSProperties}>
              <span className="num">
                {n(points[s.id])} / {n(s.max)}
              </span>
            </span>
            <span className="sources__how">
              {s.id === 'collectionLog' && (
                <input
                  className="input num"
                  type="number"
                  min={0}
                  max={s.max}
                  value={progress.collectionLog || ''}
                  placeholder="Points"
                  aria-label="Collection log points"
                  title="Copy the number from the League points panel in game"
                  onChange={setCount('collectionLog', s.max)}
                />
              )}
              {s.id === 'prestiges' && (
                <input
                  className="input num"
                  type="number"
                  min={0}
                  max={MAX_PRESTIGES}
                  value={progress.prestiges || ''}
                  placeholder="Count"
                  aria-label="Skill prestiges"
                  title={`${PRESTIGE_POINTS} League points per skill prestige`}
                  onChange={setCount('prestiges', MAX_PRESTIGES)}
                />
              )}
              {s.id === 'achievements' && checks('achievements')}
              {s.id === 'powers' && checks('powers')}
            </span>
          </li>
        ))}
        {LISTED_POINTS.achievements < POINT_SOURCES.find((s) => s.id === 'achievements')!.max && (
          <li className="sources__note muted">
            The wiki's achievement list adds up to {n(LISTED_POINTS.achievements)} of the {n(POINT_SOURCES.find((s) => s.id === 'achievements')!.max)}{' '}
            Achievements points shown in game, so a few achievements aren't listed yet.
          </li>
        )}
        <li className="sources__note muted">
          Demonic Powers points come from the power-banking achievements (Bank a power, or one at 60%). Check them in the list like any
          other achievement.
        </li>
      </ul>
    </section>
  );
}

function Progress({
  progress,
  setProgress,
  run,
  canPrestige,
  onPrestige,
  relicFor,
}: {
  progress: RunProgress;
  setProgress: SetProgress;
  run: number;
  canPrestige: boolean;
  onPrestige: () => void;
  relicFor: (t: number) => string | undefined;
}) {
  const points = currentPoints(progress);
  const { reached, next } = tierAt(points);
  const doneCount = progress.done.length;
  const uncheckAll = () => {
    if (window.confirm(`Uncheck all ${doneCount} completed achievements in the ${PLAYTHROUGH_LABEL[run].toLowerCase()}?`))
      setProgress((p) => ({ ...p, done: [] }));
  };

  return (
    <section className="progress panel" aria-label="League points">
      <div className="progress__numbers">
        <div>
          <span className="progress__points num">{n(points)}</span>
          <span className="muted"> League points</span>
        </div>
        <p className="muted progress__next">
          {next ? (
            <>
              Tier {next.tier} at {n(next.points!)}: <strong className="num">{n(next.points! - points)}</strong> to go
            </>
          ) : (
            'Every relic tier unlocked'
          )}
        </p>
      </div>

      <ol className="track" aria-label="Relic tiers">
        {RELIC_TIERS.map((t, i) => {
          const from = i ? RELIC_TIERS[i - 1].points! : 0;
          const fill = Math.max(0, Math.min(1, (points - from) / (t.points! - from)));
          return (
            <li key={t.tier} className={t.tier <= reached ? 'track__tier track__tier--reached' : 'track__tier'}>
              <span className="track__bar" style={{ '--fill': fill } as React.CSSProperties} />
              <span className="track__label">
                <strong>T{t.tier}</strong> <span className="num muted">{n(t.points!)}</span>
              </span>
              <span className="track__relic">{relicFor(t.tier) ?? <span className="muted">No relic picked</span>}</span>
            </li>
          );
        })}
      </ol>

      <div className="progress__foot">
        <p className="muted">
          {n(doneCount)} of {n(achievements.length)} achievements done in the {PLAYTHROUGH_LABEL[run].toLowerCase()}.
        </p>
        <div className="progress__actions">
          <button className="btn btn--quiet" onClick={uncheckAll} disabled={!doneCount}>
            Uncheck all
          </button>
          {canPrestige && (
            <button className="btn" onClick={onPrestige} title="Achievements and League points reset; this run's progress is kept">
              Prestige: start the {PLAYTHROUGH_LABEL[run + 1].toLowerCase()}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- achievement list ----------

function AchievementRow({
  a,
  done,
  position,
  onToggleDone,
  onToggleRoute,
}: {
  a: Achievement;
  done: boolean;
  position: number;
  onToggleDone: () => void;
  onToggleRoute: () => void;
}) {
  return (
    <li className={`ach ach--t${a.tier}${done ? ' ach--done' : ''}`}>
      <label className="ach__check">
        <input type="checkbox" checked={done} onChange={onToggleDone} />
        <span className="visually-hidden">Done</span>
      </label>
      <div className="ach__body">
        <p className="ach__title">
          <strong>{a.name}</strong>
          <span className="ach__tier">{ACHIEVEMENT_TIERS[a.tier]}</span>
          <span className="ach__points num">{n(a.points)}</span>
        </p>
        <p className="ach__desc">{a.description}</p>
        <p className="ach__meta">
          {a.categories.map((c) => (
            <span key={c} className="tag">
              {c}
            </span>
          ))}
          {a.source === 'powers' && <span className="tag ach__powers">Demonic Powers points</span>}
          {a.rewards.length > 0 && <span className="muted"> {a.rewards.join(', ')}</span>}
        </p>
      </div>
      <button className={`btn ${position >= 0 ? 'btn--quiet ach__routed' : ''}`} onClick={onToggleRoute} title={position >= 0 ? 'Remove from the route' : 'Add to the end of the route'}>
        {position >= 0 ? `#${position + 1} in route` : '+ Route'}
      </button>
    </li>
  );
}

function AchievementList({
  route,
  setRoute,
  progress,
  setProgress,
  source,
  setSource,
}: {
  route: Route;
  setRoute: ReturnType<typeof useRoute>[1];
  progress: RunProgress;
  setProgress: SetProgress;
  source: string;
  setSource: (s: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState(-1);
  const [category, setCategory] = useState('');
  const [leagueOnly, setLeagueOnly] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [hideRouted, setHideRouted] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const done = useMemo(() => new Set(progress.done), [progress.done]);
  const position = useMemo(() => new Map(route.steps.map((s, i) => [s.id, i])), [route.steps]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return achievements.filter(
      (a) =>
        (tier < 0 || a.tier === tier) &&
        (!category || a.categories.includes(category)) &&
        (!source || a.source === source) &&
        (!leagueOnly || a.league) &&
        (!hideDone || !done.has(a.id)) &&
        (!hideRouted || !position.has(a.id)) &&
        (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.rewards.some((r) => r.toLowerCase().includes(q))),
    );
  }, [query, tier, category, source, leagueOnly, hideDone, hideRouted, done, position]);
  useEffect(() => setLimit(PAGE), [query, tier, category, source, leagueOnly, hideDone, hideRouted]);

  const unrouted = shown.filter((a) => !position.has(a.id));
  const toggleDone = (id: string) => setProgress((p) => ({ ...p, done: toggle(p.done, id) }));
  const toggleRoute = (id: string) =>
    setRoute((r) => ({
      ...r,
      steps: r.steps.some((s) => s.id === id) ? r.steps.filter((s) => s.id !== id) : [...r.steps, { id, note: '' }],
    }));
  const addShown = () => setRoute((r) => ({ ...r, steps: [...r.steps, ...unrouted.map((a) => ({ id: a.id, note: '' }))] }));

  return (
    <section className="ach-list" id="achievement-list" aria-label="Achievements">
      <div className="browser__filters">
        <label className="field browser__search">
          Search
          <input className="input" type="search" placeholder="Name, task, or reward" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="field">
          Tier
          <select className="select" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            <option value={-1}>Any tier</option>
            {ACHIEVEMENT_TIERS.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Category
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any category</option>
            {ACHIEVEMENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Counts toward
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Either</option>
            <option value="achievements">Achievements</option>
            <option value="powers">Demonic Powers</option>
          </select>
        </label>
        <div className="ach-list__toggles">
          <label className="browser__toggle">
            <input type="checkbox" checked={leagueOnly} onChange={(e) => setLeagueOnly(e.target.checked)} />
            League only
          </label>
          <label className="browser__toggle">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide done
          </label>
          <label className="browser__toggle">
            <input type="checkbox" checked={hideRouted} onChange={(e) => setHideRouted(e.target.checked)} />
            Hide routed
          </label>
        </div>
      </div>

      <div className="ach-list__count">
        <p className="muted" role="status">
          {n(shown.length)} achievements, {n(shown.reduce((s, a) => s + a.points, 0))} points
        </p>
        {unrouted.length > 0 && shown.length <= 300 && (
          <button className="btn btn--quiet" onClick={addShown}>
            Add {unrouted.length} shown to route
          </button>
        )}
      </div>

      <ul className="ach-rows">
        {shown.slice(0, limit).map((a) => (
          <AchievementRow
            key={a.id}
            a={a}
            done={done.has(a.id)}
            position={position.get(a.id) ?? -1}
            onToggleDone={() => toggleDone(a.id)}
            onToggleRoute={() => toggleRoute(a.id)}
          />
        ))}
      </ul>
      {shown.length > limit && (
        <button className="btn ach-list__more" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, shown.length - limit)} more of {n(shown.length - limit)}
        </button>
      )}
      {shown.length === 0 && <p className="muted">No achievements match.</p>}
    </section>
  );
}

// ---------- route ----------

function RoutePanel({
  route,
  setRoute,
  progress,
  setProgress,
  relicFor,
}: {
  route: Route;
  setRoute: ReturnType<typeof useRoute>[1];
  progress: RunProgress;
  setProgress: SetProgress;
  relicFor: (t: number) => string | undefined;
}) {
  const [status, setStatus] = useStatus();
  const [dragging, setDragging] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { start, lines } = walkRoute(route, progress);
  const done = new Set(progress.done);
  const end = lines.at(-1)?.total ?? start;

  const setSteps = (fn: (s: Route['steps']) => Route['steps']) => setRoute((r) => ({ ...r, steps: fn(r.steps) }));
  const move = (from: number, to: number) =>
    setSteps((s) => {
      if (to < 0 || to >= s.length || from === to) return s;
      const next = [...s];
      const [step] = next.splice(from, 1);
      next.splice(to, 0, step);
      return next;
    });
  const toggleDone = (id: string) => setProgress((p) => ({ ...p, done: toggle(p.done, id) }));

  const copyText = () => {
    const text = routeText(route, progress, relicFor);
    copy(text, setStatus, text.length > DISCORD_LIMIT ? `Copied ${n(text.length)} characters, over Discord's ${n(DISCORD_LIMIT)} limit` : 'Route copied as text');
  };
  const clear = () => {
    if (window.confirm(`Remove all ${lines.length} achievements from the route? Completed achievements stay checked.`)) setRoute((r) => ({ ...r, steps: [] }));
  };

  return (
    <aside className="route panel" aria-label="Your route">
      <label className="route__name">
        <span className="visually-hidden">Route name</span>
        <input className="input" value={route.name} onChange={(e) => setRoute((r) => ({ ...r, name: e.target.value }))} aria-label="Route name" />
      </label>
      <p className="muted route__sum">
        {lines.length ? (
          <>
            {lines.length} achievement{lines.length === 1 ? '' : 's'}, <span className="num">{n(end - start)}</span> points. Ends at <span className="num">{n(end)}</span>
            {tierAt(end).reached ? `, Tier ${tierAt(end).reached}` : ''}.
          </>
        ) : (
          'Add achievements with + Route, then drag them into the order you plan to do them.'
        )}
      </p>
      <div className="route__actions">
        <button className="btn" onClick={async () => copy(await routeShareUrl(route), setStatus, 'Route link copied')} disabled={!lines.length}>
          Copy route link
        </button>
        <button className="btn btn--quiet" onClick={copyText} disabled={!lines.length}>
          Copy as text
        </button>
        <button className="btn btn--quiet" onClick={clear} disabled={!lines.length}>
          Clear
        </button>
      </div>
      <p className="route__status" role="status">
        {status}
      </p>

      {lines.length > 0 && (
        <ol className="steps">
          {start > 0 && (
            <li className="steps__start muted">
              Starting from <span className="num">{n(start)}</span> points (collection log, prestiges, and achievements done outside the route)
            </li>
          )}
          {lines.map((l) => {
            const a = achievementById.get(l.step.id);
            const isDone = done.has(l.step.id);
            return (
              <li
                key={l.step.id}
                className={`step${isDone ? ' step--done' : ''}${dragging === l.index ? ' step--dragging' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDragging(l.index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragging !== null && dragging !== l.index) {
                    move(dragging, l.index);
                    setDragging(l.index);
                  }
                }}
              >
                <div className="step__row">
                  <span className="step__grip" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span className="step__n num">{l.index + 1}</span>
                  <input type="checkbox" checked={isDone} onChange={() => toggleDone(l.step.id)} aria-label={`${a?.name ?? l.step.id} done`} />
                  <span className="step__name" title={a?.description}>
                    {a?.name ?? `Unknown achievement (${l.step.id})`}
                  </span>
                  <span className="step__points num">+{n(l.points)}</span>
                  <span className="step__total num muted">{n(l.total)}</span>
                  <span className="step__tools">
                    <button className="icon-btn" onClick={() => move(l.index, l.index - 1)} disabled={l.index === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button className="icon-btn" onClick={() => move(l.index, l.index + 1)} disabled={l.index === lines.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setEditing(editing === l.step.id ? null : l.step.id)}
                      aria-label="Note"
                      aria-pressed={editing === l.step.id}
                    >
                      ✎
                    </button>
                    <button className="icon-btn" onClick={() => setSteps((s) => s.filter((x) => x.id !== l.step.id))} aria-label="Remove from route">
                      ×
                    </button>
                  </span>
                </div>
                {editing === l.step.id ? (
                  <input
                    className="input step__note-input"
                    autoFocus
                    placeholder="Note, e.g. do this while you're at the Forge"
                    value={l.step.note}
                    onChange={(e) => setSteps((s) => s.map((x) => (x.id === l.step.id ? { ...x, note: e.target.value } : x)))}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                  />
                ) : (
                  l.step.note && <p className="step__note">{l.step.note}</p>
                )}
                {l.unlocks.map((tier) => (
                  <p key={tier} className="step__unlock">
                    Tier {tier} unlocked at <span className="num">{n(l.total)}</span>
                    {relicFor(tier) && <span>: {relicFor(tier)}</span>}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

// ---------- page ----------

function RunTabs({ runs, active, progress, onSelect }: { runs: number; active: number; progress: Route['progress']; onSelect: (i: number) => void }) {
  if (runs < 2) return null;
  return (
    <div className="runs__tabs ach-runs" role="tablist" aria-label="Runs">
      {Array.from({ length: runs }, (_, i) => (
        <button key={i} type="button" role="tab" aria-selected={i === active} className="runs__tab" onClick={() => onSelect(i)}>
          <span className="runs__tab-name">{PLAYTHROUGH_LABEL[i]}</span>
          <span className="runs__tab-meta num">{n(currentPoints(progress[i] ?? emptyProgress()))} points</span>
        </button>
      ))}
    </div>
  );
}

export default function AchievementPlanner() {
  const [route, setRoute] = useRoute();
  const [plan, setPlan] = usePlan();
  const [loaded, setLoaded] = useStatus();
  const latest = useRef(route);
  latest.current = route;

  useEffect(() => {
    const load = () =>
      routeFromHash().then((shared) => {
        if (!shared) return;
        if (latest.current.steps.length && !window.confirm(`Replace your route with the shared route "${shared.name}"? Your completed achievements stay checked.`))
          return;
        setRoute((r) => ({ ...r, ...shared }));
        setLoaded(`Loaded "${shared.name}"`);
      });
    load();
    window.addEventListener('hashchange', load);
    return () => window.removeEventListener('hashchange', load);
  }, [setRoute, setLoaded]);

  // Progress follows the playthrough selected here and on the relics page.
  const runIndex = plan.activePlaythrough;
  const run = plan.playthroughs[runIndex];
  const progress = progressFor(route, runIndex);
  const setProgress: SetProgress = (fn) => setRoute((r) => withProgress(r, runIndex, fn));
  const relicFor = (tier: number) => relicById.get(run?.relics[tier] ?? '')?.name;

  const [source, setSource] = useState('');
  const showSource = (s: string) => {
    setSource(s);
    document.getElementById('achievement-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isLast = runIndex === plan.playthroughs.length - 1;
  const prestige = () => {
    const next = PLAYTHROUGH_LABEL[runIndex + 1].toLowerCase();
    if (!window.confirm(`Start the ${next}? A League Prestige resets achievements and League points, so it starts with nothing checked. Your ${PLAYTHROUGH_LABEL[runIndex].toLowerCase()} progress is kept, and your relic plan gets a ${next} to pick relics for.`))
      return;
    setRoute((r) => withProgress(r, runIndex + 1, () => emptyProgress()));
    setPlan((p) => ({ ...p, playthroughs: [...p.playthroughs, newPlaythrough()], activePlaythrough: p.playthroughs.length }));
  };

  return (
    <div className="ach-planner">
      {loaded && <p className="ach-planner__loaded">{loaded}</p>}
      <RunTabs
        runs={plan.playthroughs.length}
        active={runIndex}
        progress={route.progress}
        onSelect={(i) => setPlan((p) => ({ ...p, activePlaythrough: i }))}
      />
      <Progress
        progress={progress}
        setProgress={setProgress}
        run={runIndex}
        canPrestige={isLast && plan.playthroughs.length < MAX_PLAYTHROUGHS}
        onPrestige={prestige}
        relicFor={relicFor}
      />
      <p className="muted ach-planner__relics">
        Relic tiers show your picks for the {PLAYTHROUGH_LABEL[runIndex].toLowerCase()}. <a href={`${base}/relics/`}>Change them on the relics page</a>.
      </p>
      <div className="ach-planner__main">
        <AchievementList
          route={route}
          setRoute={setRoute}
          progress={progress}
          setProgress={setProgress}
          source={source}
          setSource={setSource}
        />
        <div className="ach-planner__side">
          <Sources progress={progress} setProgress={setProgress} run={runIndex} onShow={showSource} />
          <RoutePanel route={route} setRoute={setRoute} progress={progress} setProgress={setProgress} relicFor={relicFor} />
        </div>
      </div>
    </div>
  );
}
