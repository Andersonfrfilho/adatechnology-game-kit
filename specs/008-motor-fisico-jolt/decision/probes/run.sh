#!/bin/sh
# usage: run.sh <label> [rounds]  ; runs blast and hammer against the room on :4284 (T3.8, by hand, never in CI), measured with the ruler of T3.4.
# PROBE is the scratchpad's `probe.mjs <url> <expression>` (injects the expression in the page). The ruler is transpiled from its TypeScript source (no bundler: it has no
# imports), so the bowl and the room read the same code; it stays in `tests/`, out of every published package.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-$HERE/out}
mkdir -p "$OUT"
RULER=$(node "$HERE/ruler-bundle.mjs")
for k in blast hammer; do for i in $(seq 1 "${2:-5}"); do
  EXPR="(async () => { const EnergyRuler = $RULER;
  return await $(sed "s/__KIND__/$k/" "$HERE/room.js"); })()"
  node "$PROBE" 'http://127.0.0.1:4284/test-room.html' "$EXPR" > "$OUT/$1.$k.$i.out" 2>&1
  tail -c 700 "$OUT/$1.$k.$i.out"; echo
done; done
