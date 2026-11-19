import { useEffect, useRef, useState } from 'react';
import { emptyPlan, importFromHash, parsePlanFile, shareUrl, usePlan } from '../lib/plan';
import { DISCORD_LIMIT, planText, type TextScope } from '../lib/plan-text';
import type { Plan } from '../lib/types';
import './PlanBar.css';

function hasContent(p: Plan) {
  return (
    p.playthroughs.some((t) => Object.keys(t.relics).length > 0 || t.reloaded) ||
    p.loadouts.some((l) => Object.keys(l.items).length > 0 || Object.values(l.soulBrands).some(Boolean)) ||
    p.forge.length > 0
  );
}

const TEXT_LABEL: Record<TextScope, string> = {
  relics: "This run's relics",
  runs: "Every run's relics",
  loadout: 'Current loadout',
  forge: 'Forge list',
  all: 'Whole plan',
};

/** `text` is the summary this page offers first when copying as text. */
export default function PlanBar({ text = 'all' }: { text?: TextScope }) {
  const [plan, setPlan] = usePlan();
  const [status, setStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const latest = useRef(plan);
  latest.current = plan;

  useEffect(() => {
    const load = () =>
      importFromHash().then((shared) => {
        if (!shared) return;
        if (hasContent(latest.current) && !window.confirm(`Replace your current plan with the shared plan "${shared.name}"?`)) return;
        setPlan(shared);
        setStatus(`Loaded "${shared.name}"`);
      });
    load();
    // A share link pasted into an already-open tab only changes the hash.
    window.addEventListener('hashchange', load);
    return () => window.removeEventListener('hashchange', load);
  }, [setPlan]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(done);
    } catch {
      window.prompt('Copy this', value);
    }
  }

  const copyLink = async () => copy(await shareUrl(plan), 'Share link copied');

  function copyText(scope: TextScope) {
    if (menu.current) menu.current.open = false;
    const value = planText(plan, scope);
    const n = value.length.toLocaleString('en-US');
    copy(value, value.length > DISCORD_LIMIT ? `Copied ${n} characters, over Discord's ${DISCORD_LIMIT.toLocaleString('en-US')} limit` : 'Text copied');
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${plan.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'plan'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file: File) {
    const parsed = parsePlanFile(await file.text());
    if (!parsed) {
      setStatus('That file is not a planner export');
      return;
    }
    setPlan(parsed);
    setStatus(`Imported "${parsed.name}"`);
  }

  function reset() {
    if (window.confirm('Clear every relic pick, every loadout, and Forge costs from this plan?')) {
      setPlan(emptyPlan());
      setStatus('Plan cleared');
    }
  }

  return (
    <div className="plan-bar">
      <label className="plan-bar__name">
        <span className="visually-hidden">Plan name</span>
        <input
          className="input"
          value={plan.name}
          onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
          aria-label="Plan name"
        />
      </label>
      <div className="plan-bar__actions">
        <button className="btn" onClick={copyLink}>
          Copy share link
        </button>
        <details className="plan-bar__menu" ref={menu}>
          <summary className="btn btn--quiet">Copy as text</summary>
          <div className="plan-bar__menu-list">
            {[text, ...(['relics', 'runs', 'loadout', 'forge', 'all'] as TextScope[]).filter((s) => s !== text)]
              // With one playthrough, every run's relics are the same as this run's.
              .filter((s) => s !== 'runs' || plan.playthroughs.length > 1)
              .map((s) => (
                <button key={s} className="btn btn--quiet" onClick={() => copyText(s)}>
                  {TEXT_LABEL[s]}
                </button>
              ))}
          </div>
        </details>
        <button className="btn btn--quiet" onClick={exportFile}>
          Export
        </button>
        <button className="btn btn--quiet" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <button className="btn btn--quiet" onClick={reset}>
          Clear
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="plan-bar__status" role="status">
        {status}
      </p>
    </div>
  );
}
