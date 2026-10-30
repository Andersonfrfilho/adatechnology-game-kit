# @adatechnology/game-terrain-three

three.js renderer for [`@adatechnology/game-terrain`](../game-terrain).

```ts
import { createTerrainRenderer } from '@adatechnology/game-terrain-three'

const view = createTerrainRenderer(THREE, { terrain })
scene.add(view.group)
// every frame:
view.sync(camera.position)
```

- Chunks nobody touched share one flat geometry (one draw call for a whole floor); a dug chunk gets a mesh that draws half or a quarter of its vertices far away (`lodDistance`).
- The pattern of each surface (grass, grout, planks, asphalt, slab joints) is drawn per pixel from the world position, so it never tiles or stretches; the edge between two materials stays sharp.
- Marks are instanced decals (not drawn beyond `markDistance`), thrown pieces are instanced, and rebar appears where a slab is dug past its cover.
- `createTerrainTestModule()`: a strip of each ground side by side to shoot, blow up, burn and drop weights on. `room.openArea('terrain')`.

## Português

Renderizador three.js do terreno: chunks intactos numa só geometria, chunks escavados com malha própria e LOD ao longe, padrão de cada piso por pixel, marcas e torrões instanciados, vergalhão onde a laje foi escavada além do cobrimento. `createTerrainTestModule()` traz as faixas de piso lado a lado para testar tiro, explosão, fogo e queda de peso.
