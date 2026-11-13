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

See `.claude/skills/kit-casas/references/game-floorplan-structure.md` for the API and `MIGRATION.md` for the names the Visor de casas 3D used.

## Masonry units (`MASONRY_UNITS`)

Masonry walls are laid with a unit of the catalog (`MASONRY_UNITS`, `getMasonryUnit`, `registerMasonryUnit`). Each unit has its real sizes, material, mass,
strength (`fbk`), use (`sealing` / `structural`) and the U unit (canaleta) of its family:

| Unit | Size (W x H x L, cm) | Use | Finished wall | Pillar |
|---|---|---|---|---|
| `ceramic_block_9` | 9 x 19 x 29 | sealing | 12 cm | 14 x 30 (stands out of the wall) |
| `ceramic_block_14` | 14 x 19 x 29 | sealing | 17 cm | 14 x 30 |
| `ceramic_block_19` | 19 x 19 x 29 | sealing | 22 cm | 19 x 20 |
| `concrete_block_14` | 14 x 19 x 39 | sealing and structural | 17 cm | 14 x 30 |
| `concrete_block_19` | 19 x 19 x 39 | sealing and structural | 22 cm | 19 x 20 |
| `concrete_block_14_fbk6`, `concrete_block_19_fbk6` | the same, 6 MPa class (NBR 6136) | structural | 17 / 22 cm | none (structural masonry) |
| `solid_brick` | 10 x 5 x 20 | sealing and structural | 13 cm | 14 x 30 |

Everything else follows from the unit: the wall's thickness (`wallThicknessOf`: the unit and 1.5 cm of render on each face), the pillar flush with the units and
long enough for the 360 cm² of NBR 6118 (`pillarSectionOf`; 14 to 19 cm with the factor γn, `pillarLoadFactor`), the bond beam and lintels as wide as the wall and
the units drawn in the construction stages.

- **Default by typology:** the template declares `masonryUnit` (single-storey houses and townhouses: `ceramic_block_14`; mansion, market, pharmacy and the
  institutional buildings: `ceramic_block_19`).
- **Changed by the game:** `engine.generate(id, { masonryUnit: 'concrete_block_14' })`. The resolver the pack registers (`registerOptionResolver`) gives the plan
  engine the thickness before the walls are laid out. The Visor reproduction (`visorSections: true`) keeps the team's 15 cm walls.

## Structural masonry (NBR 16868)

`masonrySystem: 'structural'` (the typology `single_storey_structural` of `game-floorplan-residential`, or any masonry plan with
`{ masonryUnit: 'concrete_block_14_fbk6', masonrySystem: 'structural' }`) builds the walls as the structure:

1. No concrete pillars: every wall carries (`role: 'wall'`). Grouted cores with a bar (`StructurePart.grout`, plan coordinates along the wall) at each end,
   corner and junction, beside each opening, at most every `GROUT_SPACING` (1.6 m), and under every beam of the slab that bears across the wall (local bearing:
   `beamBearings`, `addBearingCores`).
2. Bond beams on every bearing wall and lintels in U units (the channel of the unit), the slab's beams carried by the walls.
3. The module of the unit (`moduleOf`: half a unit and a joint, 20 cm for the 39 cm block): rooms on it and doors on it.
4. Its own validator (`structuralMasonryViolations`): `UNIT_NOT_STRUCTURAL`, the grout rules (`CORNER_WITHOUT_PILLAR` and the like, read as cores,
   `OPENING_WITHOUT_GROUT`, `CONCENTRATED_LOAD_WITHOUT_GROUT`), `PILLAR_IN_STRUCTURAL_WALL`, `WALL_TOO_SLENDER` (h/t over 24), `OFF_MODULE` and
   `MASONRY_OVERSTRESSED`: the design load `N_d = 1.4 N_k` (the loads of `game-load-path`) over `f_d A R`, with `f_d = 0.7 · 0.7 · fbk / 2` on the net area
   plus the grouted cells and `R = 1 - (h / 40 t)³`. The piers of `single_storey_structural` pass with the 6 MPa block and not with the 4 MPa one.
5. Only units graded `structural`; the destruction world carries the load through the walls (the same load path rule, shared by contact over the compliance
   of each path: laid masonry at `LAID_MASONRY_GPA` of `game-destruction`).

Not modelled yet: the U units drawn as such (the bond beam and lintels are drawn as concrete bands), the bars of the cores in the destruction world.
