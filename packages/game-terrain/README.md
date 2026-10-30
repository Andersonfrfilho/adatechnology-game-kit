# @adatechnology/game-terrain

Deformable ground with no three.js in it: a height field in chunks where every column has strata, each stratum a material of the destruction catalogue.

```ts
import { createTerrain, createTerrainImpl } from '@adatechnology/game-terrain'

const terrain = createTerrain({ bounds: [-50, -50, 50, 50], layout: { surface: 'lawn', zones: [{ rect: [-50, -4, 50, 4], surface: 'road' }] } })
world.register(createTerrainImpl(terrain, { id: 'ground' })) // shots, blows, blasts and flames of the destruction world reach it
terrain.heightAt(x, z) // what things stand on
```

## What it does

- **Profiles** (`TERRAIN_PROFILES`, replace or add through `profiles`): `lawn` (turf 5 cm, soil 1.5 m, rock), `dirt`, `sand`, `road` (asphalt 5 cm, gravel, soil), `concrete_slab` (12 cm with rebar at 3 cm), `tile_floor` (tile, mortar, slab), `wood_floor`, `stone_paving`.
- **Digging**: a blow removes `energy / specificEnergy` cubic metres (`TERRAIN_MATERIALS`, per blow type: ballistic, blunt, slash, explosive) as a bowl with the shape of the material. It takes the top stratum and spends what is left on the next. The strata end at the digging limit: **a slab is never pierced**, and a crater has a floor.
- **Fine marks**: a bowl under 1.5 cells stays a mark, not a change of the height field. Blows on the same mark grow it until it is dug in.
- **Budget** (`budget`): marks per area and in total (past it the closest two merge, then the oldest goes), thrown pieces, chunks redrawn per frame, cells checked for sliding, cells on fire.
- **What comes out**: soft ground heaps a rim and throws clods that land and join the height field, so they can be walked over; rigid material throws chips that stay as rubble. Loose ground slides to its angle of repose.
- **Fire**: `fire` of each material says how black it gets and whether it burns away and spreads: turf and wood char and carry the fire, concrete only soots.
- `serialize()` / `load()`: only what changed, as plain JSON.

Draw it with [`@adatechnology/game-terrain-three`](../game-terrain-three). The test room's floor is one of these.

## Português

Chão deformável: mapa de altura em chunks com estratos por coluna, cada estrato um material do catálogo de destruição. O golpe escava o estrato de cima e só passa ao de baixo quando ele acaba; a laje nunca é atravessada e a cratera tem fundo. Marcas finas de tiro com limite por área (fundem, depois reciclam a mais antiga); a terra removida vira borda e torrões que caem e somam na altura; areia escorrega até o ângulo de repouso; grama e madeira carbonizam e o fogo se espalha, concreto só escurece.
