# Infernal Artifacts Planner

A static planning site for August's Infernal Artifacts League: relic paths, gear with affixes and Demonic Powers, and Forge costs.

Built with Astro and React islands. Plans save to localStorage and can be shared as a link or exported as JSON.

## Commands

| Command           | What it does                                                        |
| :---------------- | :------------------------------------------------------------------ |
| `npm run dev`     | Local dev server at `localhost:4321`                                |
| `npm run build`   | Build the static site to `./dist/`                                  |
| `npm run check`   | Type-check Astro and TypeScript files                               |
| `npm run sync`    | Re-pull affixes, powers, and relic icons from the wiki              |

## Where the data lives

- `src/data/generated/affixes.json`, `powers.json`: parsed from the wiki's Affix list and Power list tables by
  `scripts/sync-wiki.mjs`. Don't edit these by hand; run `npm run sync` after the wiki updates.
  `npm run sync -- --offline` re-parses the cached copy in `wiki-cache/`.
- `src/data/relics.ts`: relic tiers, passives, and unlocks. Hand-maintained, because the relic pages aren't tabular.
  Add new tiers and relics here; `npm run sync` then downloads any new icons to `public/icons/`.
- `src/data/league.ts`: rarity rules, variants, Forge/Codex/Outfitter costs, and the assumptions listed below.

## Assumptions to revisit as more is revealed

- **Tier ceilings.** The affix list gives roll thresholds per affix (mostly 0/60/90/105/115). The Forge's Improve
  tab uses 0/30/55/85/105. The planner allows both and labels tiers above the roll threshold as "improve only".
- **Primal** items are treated as allowing one tier past the item's natural roll ceiling.
- **Two-handed 1.75x** is applied to flat-stat affixes only (`STAT_AFFIXES` in `league.ts`).
- **Soul-brand and stamp eligibility** follow the wiki's slot column. The game's own counts differ slightly
  (59 weapon powers in game, 54 on the wiki).
- **Stamp and outfit costs** come from single examples (a whip stamp, a Smiths tunic).
