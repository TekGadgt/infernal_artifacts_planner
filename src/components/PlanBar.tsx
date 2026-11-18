import { useEffect, useRef, useState } from 'react';
import { emptyPlan, importFromHash, parsePlanFile, shareUrl, usePlan } from '../lib/plan';
import type { Plan } from '../lib/types';
import './PlanBar.css';

function hasContent(p: Plan) {
  return (
    Object.keys(p.relics).length > 0 ||
    p.loadouts.some((l) => Object.keys(l.items).length > 0 || Object.values(l.soulBrands).some(Boolean)) ||
    p.forge.length > 0
  );
}

export default function PlanBar() {
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

  async function copyLink() {
    const url = await shareUrl(plan);
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Share link copied');
    } catch {
      window.prompt('Copy this link', url);
    }
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
    if (window.confirm('Clear relics, every loadout, and Forge costs from this plan?')) {
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
