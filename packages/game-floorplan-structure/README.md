# @adatechnology/game-floorplan-structure

Structure pack for `@adatechnology/game-floorplan`: construction systems, the load path of every plan and its `DestructibleSpec`.

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register } from '@adatechnology/game-floorplan-structure'

register(engine)
const plan = engine.generate('townhouse', { seed: 7 })
plan.structure.parts // the parts that carry load, each with role, material, box, mass
plan.structure.supports // what each part rests on, down to 'ground'
```

A free-standing wall: `buildStructure(plan, { roof: false })` leaves the roof out, so a plan with one exterior wall stands as a house wall does (on the strip footing, with the bond beam on it). `wallPiece` of `game-floorplan-three` builds and draws such a wall; every wall of a scene or a game is made that way.

Structural validation: `validateStructure(structure, { doors, wallDetail })` checks a structure as a structural engineer would sign it and returns typed
violations (`{ code, part, message }`, codes in `STRUCTURAL_VIOLATION`): load paths (`FLOATING_PART`, `PILLAR_NOT_GROUNDED`), reinforced concrete by
NBR 6118 (`CONCRETE_BELOW_MIN_SECTION`: pillars of 19 cm and 360 cm², beams 12 cm wide and L/10 deep between point supports; `UNREINFORCED_CONCRETE`;
`BEAM_ON_WEAK_MASONRY`) and, in masonry, confined masonry: `MISSING_GROUND_BEAM`, `WALL_END_WITHOUT_PILLAR`, `CORNER_WITHOUT_PILLAR`,
`WALL_JUNCTION_WITHOUT_PILLAR`, `WALL_SPAN_WITHOUT_PILLAR` (more than `MAX_PILLAR_SPACING`, 4 m), `PILLAR_DOES_NOT_REACH_BOND_BEAM`, `MISSING_BOND_BEAM`,
`OPENING_WITHOUT_LINTEL`, `OPENING_WITHOUT_SILL`, `UNBONDED_MASONRY`, `MISSING_PLASTER`. `validateSpec(spec)` checks a spec built straight (towers,
skyscrapers) for load paths and sections; `countViolations` tallies them. Every typology of the floorplan packages runs through it in its
`tests/construction.test.ts`:

```ts
const plan = engine.generate('townhouse', { seed: 7 })
validateStructure(plan.structure, { doors: plan.doors }) // [] : nothing a structural engineer would refuse
```

A masonry house stands on reinforced concrete ground beams (`ground_beam_*`, viga baldrame, `GROUND_BEAM_DEPTH` deep, buried, anchored in the spec;
`groundBeams: false` leaves them out), with concrete pillars from the floor to the bond beam, a lintel over every opening (h = L/10, the wide doors on
jamb pillars) and a sill beam (`_sillbeam_`, `SILL_BEAM_DEPTH`) under every window.

Tall buildings: `buildTower()` builds a frame with continuous columns, a concrete core with stairs and elevator shafts, a glass curtain wall, a flat
roof with its membrane and the mechanical floor (`addCore`, `addCurtainWall`, `addFlatRoof`, `addMechanicalFloor` add each one to any frame spec).
Wind: `buildTower({ wind: { speed, terrain }, damper: true })` sizes the tower for the wind and adds a tuned mass damper (`addTunedMassDamper`, `DAMPER_DEFAULTS`)
on the mechanical floor; both are off by default. The world needs `createDestruction({ wind: {} })`.

Skyscrapers: `buildSkyscraper({ storeys, height, bay, facade, ... }, preset)` turns a handful of numbers (`SKYSCRAPER_DEFAULTS`: 40 storeys, 3.6 m, 12 m bays, curtain wall, a plant floor every 20, a damper above 150 m, city wind, piles to the sand under soft clay) into the tower: columns and beams sized by the load, the core sized by the height (walls never thicker than a third of the storey, bars closer on the tall ones), a relay plant floor every N storeys (`mechanicalEvery`), a curtain wall or a punched masonry facade (`facade: 'punched'`, `addPunchedFacade`), and piles for the load and the soil (`pilesFor`, `PILE_DEFAULTS`). `skyscraperLayout` gives just the numbers, and `towerPlate` / `towerFloors` / `exteriorWindows` the room-level plan of the same layout, which `game-floorplan-commercial` (`office_tower`) and `game-floorplan-residential` (`residential_tower`) fill with rooms. Every number is an option of the layout or a field of the preset.

See `.claude/skills/game-floorplan-structure/SKILL.md` for the API and `MIGRATION.md` for the names the Visor de casas 3D used.
