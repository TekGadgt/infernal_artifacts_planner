// League Prestiging rules: each prestige locks the relics picked in that
// playthrough, Reloaded grants one extra Tier 1–3 relic, and a third
// playthrough that reaches Tier 7 has every non-combat relic active at once.

import { RELIC_TIERS, RELOADED_TIERS, relicById, tierOfRelic } from '../data/relics';
import type { Plan, Playthrough } from './types';

// The UI calls each playthrough a run.
export const PLAYTHROUGH_LABEL = ['First run', 'Second run', 'Third run'];

/** Relics picked in earlier playthroughs, with the playthrough that locked each. */
export function lockedRelics(plan: Plan, run: number): Map<string, number> {
  const locked = new Map<string, number>();
  plan.playthroughs.slice(0, run).forEach((t, i) => {
    // Reloaded's extra relic is not locked by a prestige; only the tier picks are.
    for (const id of Object.values(t.relics)) if (!locked.has(id)) locked.set(id, i);
  });
  return locked;
}

/** Tier 1–3 relics that Reloaded can still grant in this playthrough. */
export function reloadedChoices(run: Playthrough) {
  const owned = new Set(Object.values(run.relics));
  return RELIC_TIERS.filter((t) => RELOADED_TIERS.includes(t.tier)).flatMap((t) =>
    t.relics.filter((r) => !owned.has(r.id)).map((r) => ({ relic: r, tier: t.tier })),
  );
}

/** The maxed reward: a third playthrough that reaches Tier 7. */
export function hasMaxedReward(plan: Plan, run: number): boolean {
  const last = RELIC_TIERS.at(-1)!.tier;
  return run === 2 && !!plan.playthroughs[run]?.relics[last];
}

export const NON_COMBAT_RELICS = RELIC_TIERS.filter((t) => !t.combat).flatMap((t) => t.relics);

/** Every relic active in a playthrough: tier picks, Reloaded's extra, and the maxed reward. */
export function activeRelics(plan: Plan, run = plan.activePlaythrough): Set<string> {
  const t = plan.playthroughs[run];
  if (!t) return new Set();
  const active = new Set(Object.values(t.relics));
  if (t.reloaded && active.has('reloaded')) active.add(t.reloaded);
  if (hasMaxedReward(plan, run)) for (const r of NON_COMBAT_RELICS) active.add(r.id);
  return active;
}

export interface RunIssue {
  tier: number | null;
  text: string;
}

export function playthroughIssues(plan: Plan, run: number): RunIssue[] {
  const t = plan.playthroughs[run];
  if (!t) return [];
  const issues: RunIssue[] = [];
  const locked = lockedRelics(plan, run);
  for (const [tier, id] of Object.entries(t.relics)) {
    const from = locked.get(id);
    if (from !== undefined)
      issues.push({
        tier: Number(tier),
        text: `${relicById.get(id)?.name ?? id} was picked in the ${PLAYTHROUGH_LABEL[from].toLowerCase()}, so it is locked here.`,
      });
  }
  if (t.reloaded) {
    const name = relicById.get(t.reloaded)?.name ?? t.reloaded;
    if (!Object.values(t.relics).includes('reloaded'))
      issues.push({ tier: null, text: `${name} is set as the Reloaded extra, but Reloaded isn't picked.` });
    else if (Object.values(t.relics).includes(t.reloaded))
      issues.push({ tier: null, text: `Reloaded can't grant ${name}: you already picked it.` });
    else if (!RELOADED_TIERS.includes(tierOfRelic.get(t.reloaded) ?? 0))
      issues.push({ tier: null, text: `Reloaded only grants relics from Tiers 1–3.` });
  }
  return issues;
}
