// Plain-text summaries of a plan, formatted for pasting into Discord.

import { SOUL_BRAND_SLOTS, SLOTS, affixById, powerById, rarityById, variantById } from '../data/league';
import { RELIC_TIERS, relicById } from '../data/relics';
import { OP_LABEL, costText, opTarget, pieceLabel, shoppingList, sumCosts, opCost } from './forge';
import { PLAYTHROUGH_LABEL, activeRelics, hasMaxedReward } from './playthroughs';
import { ROMAN, describe, effectiveValue, fmt, loadoutTotals } from './rules';
import type { NamedLoadout, Plan } from './types';

/** Discord's message limit without Nitro. */
export const DISCORD_LIMIT = 2000;

export type TextScope = 'relics' | 'runs' | 'loadout' | 'forge' | 'all';

export function relicsText(plan: Plan, run = plan.activePlaythrough): string {
  const t = plan.playthroughs[run];
  const lines = [`**${PLAYTHROUGH_LABEL[run]}: relics**`];
  for (const tier of RELIC_TIERS) {
    const relic = relicById.get(t.relics[tier.tier]);
    lines.push(`T${tier.tier} ${relic?.name ?? '—'}`);
  }
  if (t.reloaded && Object.values(t.relics).includes('reloaded')) lines.push(`Reloaded extra: ${relicById.get(t.reloaded)?.name ?? t.reloaded}`);
  if (hasMaxedReward(plan, run)) lines.push('Maxed reward: every non-combat relic active');
  return lines.join('\n');
}

/** Every playthrough's relics, for a prestige lineup. */
export function runsText(plan: Plan): string {
  return plan.playthroughs.map((_, i) => relicsText(plan, i)).join('\n\n');
}

export function loadoutText(plan: Plan, loadout: NamedLoadout): string {
  const lines = [`**${loadout.name.trim() || 'Untitled'}** (${loadout.kind} loadout)`];
  for (const { id: slot } of SLOTS) {
    const item = loadout.items[slot];
    if (!item) continue;
    const rarity = rarityById.get(item.rarity)!.label;
    const variant = item.variant === 'normal' ? '' : `${variantById.get(item.variant)!.label} `;
    const extras = [`ilvl ${item.ilvl}`, item.twoHanded && slot === 'weapon' ? '2h' : ''].filter(Boolean).join(', ');
    lines.push(`${pieceLabel(slot, item)} — ${variant}${rarity}, ${extras}`);
    for (const p of item.affixes) {
      const affix = affixById.get(p.affixId);
      const tier = affix?.tiers.find((x) => x.tier === p.tier);
      if (!affix || !tier) continue;
      lines.push(`  • ${affix.name} ${ROMAN[p.tier]}: ${describe(tier, effectiveValue(p, affix, item, slot))}`);
    }
    const power = item.powerId && item.rarity === 'legendary' ? powerById.get(item.powerId) : undefined;
    if (power) lines.push(`  • Power: ${power.name}`);
  }
  if (loadout.kind === 'combat') {
    const brands = SOUL_BRAND_SLOTS.map((b) => {
      const id = loadout.soulBrands[b.id];
      return id ? `${b.label.toLowerCase()} ${powerById.get(id)?.name ?? id}` : null;
    }).filter(Boolean);
    if (brands.length) lines.push(`Soul-brands: ${brands.join(', ')}`);
  }
  const totals = loadoutTotals(loadout.items, activeRelics(plan)).filter((t) => t.total !== null);
  if (totals.length)
    lines.push(
      `Totals: ${totals
        .map((t) => `${t.affix.name} ${fmt(t.total)}${t.unit}${t.over ? ' (over cap)' : ''}`)
        .join(', ')}`,
    );
  return lines.join('\n');
}

export function forgeText(plan: Plan): string {
  if (!plan.forge.length) return '**Forge**\nNothing planned.';
  const lines = ['**Forge**'];
  for (const g of shoppingList(plan)) {
    lines.push(g.loadout ? `${g.loadout.name.trim() || 'Untitled'}:` : 'Not tied to gear:');
    for (const p of g.pieces)
      for (const op of p.ops) {
        const target = opTarget(plan, op);
        const where = target ? `${pieceLabel(target.slot, target.item)} · ` : '';
        lines.push(`  • ${where}${OP_LABEL[op.kind]}${op.count > 1 ? ` ×${op.count}` : ''}: ${costText(opCost(op))}`);
      }
  }
  const total = sumCosts(plan.forge.map(opCost));
  lines.push(`Total: ${costText(total)}${total.estimated ? ' (some estimated)' : ''}`);
  return lines.join('\n');
}

export function planText(plan: Plan, scope: TextScope): string {
  const loadout = plan.loadouts.find((l) => l.id === plan.activeLoadout) ?? plan.loadouts[0];
  const parts: string[] = [];
  if (scope === 'all') parts.push(`__**${plan.name.trim() || 'League plan'}**__`);
  if (scope === 'relics') parts.push(relicsText(plan));
  if (scope === 'runs' || scope === 'all') parts.push(runsText(plan));
  if (scope === 'loadout') parts.push(loadoutText(plan, loadout));
  if (scope === 'all') for (const l of plan.loadouts) if (Object.keys(l.items).length) parts.push(loadoutText(plan, l));
  if (scope === 'forge' || (scope === 'all' && plan.forge.length)) parts.push(forgeText(plan));
  return parts.join('\n\n');
}
