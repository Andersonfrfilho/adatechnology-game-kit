---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

Impact sounds by material and kind of blow. Every destruction event a hit emits carries `blow` (the hit's `DamageType`). The renderer sends `onSound` a
`detail.keys` list, most specific first (`impact_<material>_<blow>`, `impact_<material>`, `impact_<family>_<blow>`, `impact_<family>`, and `break_*` for
fractures), before the legacy family key. `impactFamily` gives ceramic, the ground (soil, sand, gravel, turf), plastic, wax and plants their own family.
`IMPACT_SOUND_KEYS` and `IMPACT_SOUNDS` add a sound for a bullet, a blow and a blade on metal, wood, glass and masonry, and own sounds for thin metal, MDF,
ceramic, plaster, the ground, plastic, rubber, wax, soft things, paper and plants. The test room passes the keys through, and
`examples/test-room/sound-audit-impacts.mjs` measures what each material plays for each blow in the real room.
