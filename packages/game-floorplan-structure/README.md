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

Tall buildings: `buildTower()` builds a frame with continuous columns, a concrete core with stairs and elevator shafts, a glass curtain wall, a flat
roof with its membrane and the mechanical floor (`addCore`, `addCurtainWall`, `addFlatRoof`, `addMechanicalFloor` add each one to any frame spec).
Wind: `buildTower({ wind: { speed, terrain }, damper: true })` sizes the tower for the wind and adds a tuned mass damper (`addTunedMassDamper`, `DAMPER_DEFAULTS`)
on the mechanical floor; both are off by default. The world needs `createDestruction({ wind: {} })`.

Skyscrapers: `buildSkyscraper({ storeys, height, bay, facade, ... }, preset)` turns a handful of numbers (`SKYSCRAPER_DEFAULTS`: 40 storeys, 3.6 m, 12 m bays, curtain wall, a plant floor every 20, a damper above 150 m, city wind, piles to the sand under soft clay) into the tower: columns and beams sized by the load, the core sized by the height (walls never thicker than a third of the storey, bars closer on the tall ones), a relay plant floor every N storeys (`mechanicalEvery`), a curtain wall or a punched masonry facade (`facade: 'punched'`, `addPunchedFacade`), and piles for the load and the soil (`pilesFor`, `PILE_DEFAULTS`). `skyscraperLayout` gives just the numbers, and `towerPlate` / `towerFloors` / `exteriorWindows` the room-level plan of the same layout, which `game-floorplan-commercial` (`office_tower`) and `game-floorplan-residential` (`residential_tower`) fill with rooms. Every number is an option of the layout or a field of the preset.

See `.claude/skills/game-floorplan-structure/SKILL.md` for the API and `MIGRATION.md` for the names the Visor de casas 3D used.
