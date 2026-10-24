---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

The weapons are the ones the Galeria 3D do Arsenal drew. `game-weapons-three` replaces the boxes with a port of the gallery builders (pistol, revolver,
rifle, bullpup, P90, break action, M2, rocket launchers, flamethrowers) for the 78 weapons in `data/models.json`, checked node by node against the page by
`tools/golden` (the .50 BMG bullet is the only difference: 12,7 mm real against 13,0 in the page), with a cartridge and a case per calibre from its
dimensions, worn-metal conditions (`new`, `used`, `worn`, `rusty`) and named parts. The weapon in the hands plays clips for the tool-animation
contract of `game-contracts`: fire, burst, slide and bolt cycle, jam (stovepipe, double feed, failure to extract, misfire), clear, safety lever and the seven
reloads (magazine swap, tube, top load, revolver, break action, belt, launcher and flamethrower), timed by the seconds the rule gives, with casings, spent
cartridges, magazines, muzzle flash, heat glow and smoke from a seeded generator. The generic archetypes keep their low-poly prop. The test area lays all 117
weapons and tools on up to six counters, asleep, each as one rigid body of its measures. `game-test-room` turns the jams of the weapon rule on again, calls
`draw()` when a tool is picked up (the trigger answers `drawing` for the rule's draw time), and binds X to clear a jam and B to the safety.
