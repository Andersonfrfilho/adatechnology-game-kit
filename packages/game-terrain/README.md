# @adatechnology/game-terrain

Deformable ground with no three.js in it: a height field in chunks where every column has strata, each stratum a material of the destruction catalogue.

```ts
import { createTerrain, createTerrainImpl } from '@adatechnology/game-terrain'

const terrain = createTerrain({ bounds: [-50, -50, 50, 50], layout: { surface: 'lawn', zones: [{ rect: [-50, -4, 50, 4], surface: 'road' }] } })
world.register(createTerrainImpl(terrain, { id: 'ground' })) // shots, blows, blasts and flames of the destruction world reach it
terrain.heightAt(x, z) // what things stand on
```

## What it does

- **Profiles** (`TERRAIN_PROFILES`, replace or add through `profiles`): `lawn` (turf 5 cm, soil 1.5 m, rock), `dirt`, `sand`, `road` (asphalt 5 cm, gravel, soil), `concrete_slab` (12 cm with rebar at 3 cm), `tile_floor` (tile, mortar, slab), `wood_floor`, `stone_paving`, `mud`, `gravel_bed`, `dry_clay`, `snow`, `cobblestone`, `paver_floor`, `shallow_water`.
- **Digging**: a blow removes `energy / specificEnergy` cubic metres (`TERRAIN_MATERIALS`, per blow type: ballistic, blunt, slash, explosive) as a bowl with the shape of the material. It takes the top stratum and spends what is left on the next. The strata end at the digging limit: **a slab is never pierced**, and a crater has a floor.
- **Bars**: bare bars bend with each blow and give way at `yieldJoules`. A slab on the ground stays the floor; `suspended_slab` (`TerrainProfile.drop`) opens onto the floor below.
- **Fine marks**: a bowl under 1.5 cells stays a mark, not a change of the height field. Blows on the same mark grow it until it is dug in.
- **Budget** (`budget`): marks per area and in total (past it the closest two merge, then the oldest goes), thrown pieces, chunks redrawn per frame, cells checked for sliding, cells on fire.
- **What comes out**: soft ground heaps a rim and throws clods that land and join the height field, so they can be walked over; rigid material throws chips that stay as rubble. Loose ground slides to its angle of repose.
- **Fire**: `fire` of each material says how black it gets and whether it burns away and spreads: turf and wood char and carry the fire, concrete only soots.
- **Feet** (`footing` of a material): `footAt` is the height a foot stands at, `walkFactorAt` what is left of the speed, `press` the print it leaves (`createFootprints` keeps the trail of a walker, a wheel presses with `kind: 'rut'`).
- **Decals** (`decals()`): marks with no depth, under `budget.maxDecals`: cracks of a brittle crust (`cracks`), splats where the pieces of a wet ground land (`splats`), prints and ruts, rings on water.
- **Pieces** (`units` of a material): cobbles and pavers are not dug. A blow adds to the joules each piece has taken, and past `looseJoules` the piece comes off its bed whole and is thrown, showing the sand under it.
- **Loose stones** (`scatters`): gravel throws stones that stay as loose stones instead of joining the height field.
- **Water** (`water` of a profile): everything stands on the bed, which banks up to the shore. `waterAt` says the level; a blow reaches the bed with `blowShare` of its energy and reports `result.water`, so that the surface splashes and shows no crater while the bed is dug. It does not burn. `waterLift` is Archimedes for whatever is in it.
- `serialize()` / `load()`: only what changed, as plain JSON.

Draw it with [`@adatechnology/game-terrain-three`](../game-terrain-three). The test room's floor is one of these.

## Português

Chão deformável: mapa de altura em chunks com estratos por coluna, cada estrato um material do catálogo de destruição. O golpe escava o estrato de cima e só passa ao de baixo quando ele acaba; a laje no chão nunca é atravessada e a cratera tem fundo. Vergalhão exposto entorta a cada golpe e cede; laje sobre vão (`suspended_slab`) abre para o andar de baixo. Marcas finas de tiro com limite por área (fundem, depois reciclam a mais antiga); a terra removida vira borda e torrões que caem e somam na altura; areia escorrega até o ângulo de repouso; grama e madeira carbonizam e o fogo se espalha, concreto só escurece.

Lama afunda o pé, espirra e deixa pegada; a explosão espalha lama pelo chão em volta. Cascalho solta pedrinhas e faz pouca cratera. Barro seco racha. Neve guarda pegada e o fogo a derrete até a terra. Paralelepípedo e bloquete soltam peças inteiras, que deixam a areia à vista. Água rasa espirra sem cratera na superfície, escava o fundo, não pega fogo, e o que é mais leve que ela boia.
