#!/usr/bin/env bash
# Builds the Widget Log plugin and starts the installed August client with it loaded.
# Uses the client version and Java runtime the August Games Launcher last activated,
# so open the official launcher first whenever the game updates.
#
#   ./run.sh         the client plus Widget Log
#   ./run.sh --dev   also turns on RuneLite's developer tools (Widget Inspector, Var Inspector)
set -euo pipefail

DEV_JVM=()
DEV_ARGS=()
if [ "${1:-}" = "--dev" ]; then
  # RuneLite's developer mode requires assertions, but only in its own code: turning them on in the
  # game engine (osrs.*) trips an assertion while the map loads and crashes the client.
  DEV_JVM=(-ea:net.runelite...)
  DEV_ARGS=(--developer-mode)
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$HOME/Library/Application Support/august-games-launcher"
LIVE="$LAUNCHER/installs/august/live"

read -r DIGEST GENERATION < <(python3 -c '
import json, sys
a = json.load(open(sys.argv[1]))["active"]
print(a["digest"], a["generation"])' "$LIVE/activation.json")
VERSION="$LIVE/versions/$DIGEST/$GENERATION"
JAVA="$(find "$LAUNCHER/runtimes" -maxdepth 3 -path '*/bin/java' -type f | head -1)"
[ -d "$VERSION" ] || { echo "No client at $VERSION. Open the August launcher once." >&2; exit 1; }
[ -x "$JAVA" ] || { echo "No Java runtime under $LAUNCHER/runtimes." >&2; exit 1; }
echo "Client: $(ls "$VERSION" | grep -E '^client-.*\.jar$')"
echo "Java:   $("$JAVA" -version 2>&1 | head -1)"

# Compile against the client's own jars, for the runtime's Java version (17).
rm -rf "$HERE/build"
mkdir -p "$HERE/build/classes" "$HERE/out"
javac --release 17 -nowarn -cp "$VERSION/*" -d "$HERE/build/classes" $(find "$HERE/src" -name '*.java')
jar --create --file "$HERE/build/widget-log.jar" -C "$HERE/build/classes" .

# Same JVM flags the launcher uses, with this plugin added to the classpath.
exec "$JAVA" \
  -cp "$HERE/build/widget-log.jar:$VERSION/*" \
  -XX:+DisableAttachMechanism -XX:MaxRAMPercentage=25.0 -Xss2m -XX:CompileThreshold=1500 \
  -XX:+UseG1GC -XX:+UseStringDeduplication -XX:+ExitOnOutOfMemoryError \
  --add-opens=java.desktop/com.apple.eawt=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED \
  -Drunelite.channel=live -Duser.home="$HOME" \
  -Dwidgetlog.dir="$HERE/out" \
  ${DEV_JVM[@]+"${DEV_JVM[@]}"} \
  com.tekgadgt.widgetlog.Launch --sessionfile="$HOME/.augustrsps/session" ${DEV_ARGS[@]+"${DEV_ARGS[@]}"}
