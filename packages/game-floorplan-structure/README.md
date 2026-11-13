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

## Weight of the roof

A roof pane weighs its covering over its sloped surface (`RoofCoveringDef.weight`, kN/m² of slope: ceramic tiles 0.70, fibre-cement 0.24, asphalt 0.25,
zinc 0.10, timber boards 0.20, canvas 0.006, thatch 0.45, a concrete slab 3.0), a rafter its 6 x 16 cm section over its sloped length, a coarse truss the pair
of rafters it stands for: a tile roof at 30° is about 0.85 kN/m² in plan (NBR 6120). The reproduction of the Visor de casas 3D (`visorSections`) keeps the
team's weights (a share of each part's box).

Every support that bears touches what it rests on in plan (`SUPPORT_WITHOUT_CONTACT`, swept over every template): only what touches carries. A roof member
bears on what it touches (2 cm); where the roof runs past the walls (over a terrace, a balcony, a wide doorway the bond beam does not cross) and a rafter or
truss reaches nothing, `addEaveSupports` makes the missing support: an eave beam along the eave line, on pillars of its own (from 0.65 m past the end of a
wall's plate it abuts, so never on the end of a shallower beam; only over a doorway, where no pillar can stand, does it bear on the plate), more pillars so
that no span passes 4 m where something can carry one, each on the bond beam, wall or pillar of the storey below (or of a lower one, running past the
balcony slabs between, as the column of stacked balconies does) or on the foundation; a pillar never stands in a doorway nor runs through a wall, a beam or
a lintel. Concrete with NBR 6118 sections (h ≥ L/10 over its longest span, at least 25 cm; pillars of the walls' section), timber posts and beam in a timber
house. The house renderer draws them in the facade's finish (or timber). The reproduction of the Visor de casas 3D keeps its team's supports.

The bond beam runs on over every door with a lintel, however wide: the masonry over the door is tied at its top as the wall beside it is (validated:
`MISSING_BOND_BEAM` / `BOND_BEAM_NOT_CONTINUOUS` on the masonry over a door too). Members of an eave line with only air between them within 4 m share one
eave beam (never a short one on a single pillar: `BEAM_SINGLE_SUPPORT`). Each slab an eave pillar runs through is cast on it, so it is braced per storey
(`COLUMN_TOO_SLENDER`: λ = l_e √12 / b over the longest braced stretch, at most 90, NBR 6118 15.8; pillars cast in masonry walls are braced by the wall).
A concrete pillar on the soil away from the strip footings of the walls stands on a footing of its own, `footing_pier_<pillar>` (0.6 m at least, NBR 6122;
`PILLAR_WITHOUT_FOUNDATION`), as the pillars of a unit's building base and the slab pillars do. A partition on an eave beam's line stops under its soffit;
a beam between pillars built along its line through a member it is not joined to is `OVERLAPPING_PARTS`.

Every footing on the soil (a pillar's, a porch's, a crawl space's pier) is sized by the load that comes onto it: A ≥ 1.05 N_k / σ_adm (`soilPressure`, kPa, default `ALLOWABLE_SOIL_PRESSURE` 200), never under 0.6 m, h ≥ (B − b)/3
(rigid footing), by the larger of the loads of the house with whole slabs and with its slabs framed (`SOIL_PRESSURE_EXCEEDED`). An eave post stands on a
bond beam, a pillar or a concrete beam (or structural masonry), never on infill, else it goes down to the foundation (`PILLAR_ON_INFILL`). A rafter or truss
running more than 1 m past what holds it over a slab bears on the slab through struts (pontaletes), so the slab takes the roof (`ROOF_OVERHANG_TOO_LONG`).
A partition cut under a beam records it in `soffit`, and the house renderer draws it up to its structural top.
Every concrete pillar is checked by its load (`pillar-design`, `PILLAR_OVERLOADED`): N_d = 1.4 N_k with e1,min = 0.015 + 0.03 h and, past λ 35, the
second order of the approximate curvature (NBR 6118 15.8.3.3.2) over its braced length, against a plastic section of C25 with CA-50 bars, at most 4% of
steel and ν = N_d/(A_c f_cd) ≤ 0.8. A pillar past it is grown (least side in 5 cm steps) to ν ≤ 0.6, again until the loads settle: the building base of a
high apartment comes to 40×40. The ceiling slab rests on the walls and plates of the rooms, never on a porch's posts.
Each slab panel is also as thick as its loads ask (`slab-design`: long-term deflection within span/250 and bending at x/d ≤ 0.45, C25, NBR 6118), with
finishes 1 kN/m², live 2 (floor) or 0.5 (ceiling), and the roof on struts, each member's weight spread along it over the panels of its slab, with the roof's
live load 0.5 kN/m² (`SLAB_UNDERSIZED`). In the kit's houses the span ratio still governs; a roof many times heavier makes the load govern.

## Structural masonry (NBR 16868)

`masonrySystem: 'structural'` (the typology `single_storey_structural` of `game-floorplan-residential`, or any masonry plan with
`{ masonryUnit: 'concrete_block_14_fbk6', masonrySystem: 'structural' }`) builds the walls as the structure:

1. No concrete pillars and no bond beam on pillars: every wall carries (`role: 'wall'`). Grouted cores with a bar (`StructurePart.grout`, plan coordinates
   along the wall; `construction.walls.groutBar`, Ø 12.5 mm) at each corner and junction (in the cell where the walls' lines cross, grouted once by one of
   the two walls: `coresAlong` reads the shared one, `doubledCores` finds a cell grouted twice), in the first cell of each free end and beside each jamb,
   at most every `GROUT_SPACING` (1.6 m), and under every beam of the slab that bears across the wall (local bearing: `beamBearings`, `addBearingCores`).
2. A reinforced bond beam course over the whole length of every bearing wall and lintels in U units (the channel of the unit), the bond beams of the walls
   tied over each corner and T (direct bond; in `units` detail the courses take turns over the square the walls share), the slab's beams carried by them.
3. The coordination of the unit (`moduleOf`: half a unit and a joint, 20 cm for the 39 cm block): rooms, doors and window jambs on the module, sills and
   heads on the courses (19 + 1 cm), a door's head at 2.20 m with its lintel a course of channel blocks over it (doors are openings of the structure
   too, `kind: 'door'`), a window's head at least a course under the top of the wall.
4. Its own validator (`structuralMasonryViolations`), which asks what structural masonry needs instead of the pillars of confined masonry:
   - the unit: `UNIT_NOT_STRUCTURAL`, `MISSING_CHANNEL_UNIT`; the steel: `GROUT_WITHOUT_BAR` (no bar, or under Ø 10 mm), `GROUT_STEEL_CONGESTED` (the two
     bars of a lap splice over 8 % of the cell);
   - the detailing: the core rules (`CORNER_WITHOUT_PILLAR` and the like, read as cores within the first cell), `OPENING_WITHOUT_GROUT`,
     `CONCENTRATED_LOAD_WITHOUT_GROUT`, `GROUT_CORE_DOUBLED`, `PILLAR_IN_STRUCTURAL_WALL`, `MISSING_BOND_BEAM`, `BOND_BEAM_NOT_CONTINUOUS`,
     `MISSING_GROUND_BEAM` (a foundation under every wall), `JUNCTION_NOT_INTERLOCKED`, `UNBONDED_MASONRY`, `OFF_MODULE`;
   - the strength (`pierDesigns`), pier by pier between the windows (each pier of the wall built for play carries its own load of the load path), with
     the walls interlocked at its corner or T up to 6 t each side as flanges in compression: NBR 16868-1 compression with bending,
     `N_d / (A R) + M_d / (1.5 W) ≤ f_d`, `N_d = 1.4 (G + Q)` at mid-height, Q the live loads of NBR 6120 (`liveLoads`: 1.5 kN/m² in the rooms of a
     dwelling, 2 in service areas, 0.5 on a ceiling slab, 0.25 in horizontal projection on a pitched roof, the water of the tank), `M_d` what bears on
     one face (a slab, a beam ending on the wall) t/6 off the axis, `f_d = 0.7 · 0.7 · fbk / 2` and A on the gross area (f_bk of NBR 6136 is on the
     gross area), W the pier's own section, `R = 1 - (λ / 40)³`, `λ = h_ef / t_ef` up to 24 (`WALL_TOO_SLENDER`), h_ef the height of a wall braced at
     its top, twice it free there. With the roof weighed by its covering, the 20 cm stub of `single_storey_structural` beside the bathroom door takes
     0.93 of the 6 MPa block and 1.39 of the 4 MPa one: the typology needs the 6 MPa class.
5. Only units graded `structural`; the destruction world carries the load through the walls (the same load path rule, shared by contact over the compliance
   of each path: laid masonry at `LAID_MASONRY_GPA` of `game-destruction`).

Not modelled yet: the U units drawn as such (the bond beam and lintels are drawn as concrete bands), the bars of the cores in the destruction world.
