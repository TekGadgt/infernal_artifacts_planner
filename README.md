# Infernal Artifacts Planner

A static planning site for August's Infernal Artifacts League: relic paths, gear with affixes and Demonic Powers, Forge costs, and an achievement route.

Built with Astro and React islands. Plans save to localStorage and can be shared as a link or exported as JSON.

## Commands

| Command           | What it does                                                        |
| :---------------- | :------------------------------------------------------------------ |
| `npm run dev`     | Local dev server at `localhost:4321`                                |
| `npm run build`   | Build the static site to `./dist/`                                  |
| `npm run check`   | Type-check Astro and TypeScript files                               |
| `npm run sync`    | Re-pull affixes, powers, achievements, and relic icons from the wiki |

## Where the data lives

- `src/data/generated/affixes.json`, `powers.json`, `achievements.json`: parsed from the wiki's Affix list,
  Power list, and Achievements tables by
  `scripts/sync-wiki.mjs`. Don't edit these by hand; run `npm run sync` after the wiki updates.
  `npm run sync -- --offline` re-parses the cached copy in `wiki-cache/`.
- `src/data/relics.ts`: relic tiers, passives, and unlocks. Hand-maintained, because the relic pages aren't tabular.
  Add new tiers and relics here; `npm run sync` then downloads any new icons to `public/icons/`.
- `src/lib/playthroughs.ts`: League Prestiging rules (locked relics, Reloaded's extra relic, the maxed reward).
- `src/lib/forge.ts`: Forge costs, the per-loadout shopping list, and Forge work implied by planned gear.
- `src/data/league.ts`: rarity rules, variants, Forge/Codex/Outfitter costs, and the assumptions listed below.
- `src/data/builds.ts`: the Builds page: affix and power notes, reference builds, item sources, and where to farm.
  Hand-maintained. Each build piece names a game item, and the build fails if a piece can't roll its affixes, breaks a
  slot rule, or has no entry in `ITEM_SOURCES`. Mark advice "community" (from players) or "theory" (worked out here).

## Game data

`npm run import-game-data` builds `src/data/generated/game.json` and `game-affixes.json` from the
read-only Widget Log plugin's output in `scraper/out` (see `scraper/README.md`). It holds every gear
item that can roll affixes, the affixes and Demonic Powers each one can roll, and their weights. Item,
affix, and power definitions come from the client's data tables. Weights, and the utility, skilling,
and Juggernaut pools, come from the in-game Encyclopedia (`::info`) pages captured while browsing. The
importer prints how its results compare with the captured item pages and with the wiki.

## Share links

"Copy share link" packs the whole plan into the URL (`#p=…`) using the compact binary format in
`src/lib/share-codec.ts`. Links refer to affixes, powers, relics, and achievements by position in
`src/data/share-ids.json`. That list is **append-only**: `npm run sync` adds new ids to the end and never
removes or reorders entries, so old links keep pointing at the right things. Don't edit it by hand. The
small lists at the top of `share-codec.ts` (slots, rarities, and so on) follow the same rule. Format 4 links
record which game item each gear piece is; format 3 (Forge entries tied to gear pieces), format 2 (every playthrough), format 1 (one set of relic picks), and older
`#plan=…` links (deflated JSON) still load.

The achievement route is separate from the plan: it saves under its own localStorage key and shares as `#r=…`
on the Achievements page. A route link carries the route's name, order, and notes, but not completed
achievements or points, so whoever opens it keeps their own progress. Progress is kept per playthrough, following
the run selected on the relics page, because a League Prestige resets achievements.

"Copy as text" formats relics, a loadout, the Forge list, or the whole plan for pasting into Discord, and warns
when the text runs past Discord's 2,000-character limit.

## Assumptions to revisit as more is revealed

- **Tier ceilings.** The affix list gives roll thresholds per affix (mostly 0/60/90/105/115). The Forge's Improve
  tab uses 0/30/55/85/105. The planner allows both and labels tiers above the roll threshold as "improve only".
- **Primal** items are treated as allowing one tier past the item's natural roll ceiling.
- **Two-handed 1.75x** is applied to flat-stat affixes only (`STAT_AFFIXES` in `league.ts`).
- **Soul-brand and stamp eligibility** follow the wiki's slot column. The game's own counts differ slightly
  (59 weapon powers in game, 54 on the wiki).
- **Stamp and outfit costs** come from single examples (a whip stamp, a Smiths tunic). The Stitch Keep cost isn't public,
  so it adds nothing to the totals.
- **League points** follow the in-game panel's four sources. Achievements and Demonic Powers (the power-banking
  achievements) come from checked achievements, using the wiki list's points; the wiki list is about 4,800 points short of
  the in-game Achievements total. Collection log points are typed in, and skill prestiges count 225 points each.
- **Affix stat and skill groups** on the Affixes page match each affix's effect text against keywords
  (`STAT_GROUPS` in `AffixBrowser.tsx`), so a new affix may need its group added.
- **Critty City** lowers the Precise cap to 50% and shows the excess as crit damage. **Fiery Fashion**'s transmog
  powers aren't modelled.
