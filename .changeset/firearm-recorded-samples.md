---
"@adatechnology/game-audio": minor
"@adatechnology/game-weapons-three": minor
"@adatechnology/game-contracts": minor
---

Recorded firearm sounds: 231 takes cut from The Free Firearm Sound Library (CC0), the Restrained Firearms Soundpack and the Oculus Audio Pack 1 (CC BY 4.0) by `tools/sfx-sources/cut.mjs`. A shot plays the near and mid-distance takes of its calibre profile with a crossover by distance; each reload step plays its recording in the tier of the weapon's weight; a case's first bounce plays the recorded floor. Without the files the synthesized sounds play. `AnimationEventSpec.lead` fires a sound event early by real seconds, so the measured hit of each recording (`reload-sample-hits.json`) lands on the frame the part reaches its stop.
