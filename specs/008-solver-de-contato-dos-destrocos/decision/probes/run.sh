#!/bin/sh
# usage: run.sh <label> ; runs blast and hammer 3x each against :4284
S=/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/7f83ba4f-62ad-4c7e-8740-cec43c23b9d4/scratchpad
for k in blast hammer; do for i in 1 2 3; do
  node $S/probe.mjs 'http://127.0.0.1:4284/test-room.html' "$(cat $S/item6-escalation/A-probes/$k.js)" > $S/item6-escalation/A-probes/$1.$k.$i.out 2>&1
  tail -c 600 $S/item6-escalation/A-probes/$1.$k.$i.out; echo
done; done
