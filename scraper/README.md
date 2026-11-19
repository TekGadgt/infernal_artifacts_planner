# Widget Log

A read-only RuneLite plugin for the August client. It logs which interfaces open and close, and saves each
open interface's widgets (text, item ids, sprites, layout) to JSON whenever they change. It never clicks,
types, or sends anything to the server. Used to collect in-game data the wiki doesn't have yet.

## Run

Close the August client, open the August Games Launcher once if the game has updated, then:

```
./run.sh          # client + Widget Log
./run.sh --dev    # also RuneLite's developer tools (Widget Inspector, Var Inspector)
```

The script compiles the plugin against the installed client's jars and starts that client with the
launcher's own JVM settings. Your profile, settings, and Plugin Hub plugins load as usual (`~/.augustrsps`).

## Output

- `out/menus.log`: one line per interface opened, closed, or dumped, with the group id and its first few texts.
- `out/dumps/<time>_g<group>.json`: the widget tree of one interface at that moment.

Interfaces loaded at login (chatbox, orbs, side tabs) aren't dumped on their own. Use **Dump everything on
screen** in the Widget Log side panel for those, such as the League points panel.
