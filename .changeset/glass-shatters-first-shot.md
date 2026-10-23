---
'@adatechnology/game-destruction': minor
'@adatechnology/game-test-room': patch
---

Thin brittle shells that shatter now break on the first bullet. For materials with `fracture: 'shatter'` (glass, ceramic) ballistic damage is multiplied by the same `fragility(ductility, thickness)` factor that blunt hits already used: a 9 mm (about 500 J) now shatters a 4-6 mm window pane in one shot (a 5 kg pane took 6 before), a 2 cm glass block takes 4 (15 before) and a 5 cm block 8 (38 before). Ductile materials, shells 2 cm or thicker (factor up to x4.7 only for glass) and `crumble` materials such as tempered glass are unchanged apart from the thickness term. The test room scenario `glass_shatters` now expects the first shot.
