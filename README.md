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
- `src/lib/playthroughs.ts`: League Prestiging rules (locked relics, Reloaded's extra relic, the maxed reward).
- `src/data/league.ts`: rarity rules, variants, Forge/Codex/Outfitter costs, and the assumptions listed below.

## Share links

"Copy share link" packs the whole plan into the URL (`#p=…`) using the compact binary format in
`src/lib/share-codec.ts`. Links refer to affixes, powers, and relics by position in
`src/data/share-ids.json`. That list is **append-only**: `npm run sync` adds new ids to the end and never
removes or reorders entries, so old links keep pointing at the right things. Don't edit it by hand. The
small lists at the top of `share-codec.ts` (slots, rarities, and so on) follow the same rule. Format 2 links
hold every playthrough; format 1 links (one set of relic picks) and older `#plan=…` links (deflated JSON) still load.

## Assumptions to revisit as more is revealed

- **Tier ceilings.** The affix list gives roll thresholds per affix (mostly 0/60/90/105/115). The Forge's Improve
  tab uses 0/30/55/85/105. The planner allows both and labels tiers above the roll threshold as "improve only".
- **Primal** items are treated as allowing one tier past the item's natural roll ceiling.
- **Two-handed 1.75x** is applied to flat-stat affixes only (`STAT_AFFIXES` in `league.ts`).
- **Soul-brand and stamp eligibility** follow the wiki's slot column. The game's own counts differ slightly
  (59 weapon powers in game, 54 on the wiki).
- **Stamp and outfit costs** come from single examples (a whip stamp, a Smiths tunic). The Stitch Keep cost isn't public,
  so it adds nothing to the totals.
- **Reloaded** may pick any Tier 1–3 relic not already picked in that playthrough, including one an earlier prestige
  locked. The wiki doesn't say whether that's allowed; the planner flags it.
- **Critty City** lowers the Precise cap to 50% and shows the excess as crit damage. **Fiery Fashion**'s transmog
  powers aren't modelled.
