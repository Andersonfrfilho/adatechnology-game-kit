---
'@adatechnology/game-contracts': patch
'@adatechnology/game-destruction': minor
---

Overloaded structures now fail on a game-feel timescale. The overload damage was proportional to the excess alone (`(stress - 1) * maxHp * 0.5` per second), so a part at stress 1.02 took about 100 s to give way and a cascade of slightly overloaded columns took 30-70 s. It is now `min(0.6, 0.12 + 0.8 * (stress - 1))` of `maxHp` per second: stress 1.02 gives way in about 7 s, 1.1 in 5 s, 1.5 in 2 s and anything above 1.7 in 1.7 s (it was 0.3 s at stress 8: very high stress is slightly slower now). Still deterministic. Hosts that tuned capacities around the old timing may see structures fall sooner.
