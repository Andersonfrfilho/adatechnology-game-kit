# @adatechnology/game-shapes-three

three.js drawing of @adatechnology/game-shapes buffers: BufferGeometry with three's own type and prototype, meshes per batch, part groups, InstancedMesh and LOD; a geometry namespace whose constructors are made by game-shapes (for ported code that reads new T.BoxGeometry); and mergeByMaterial on the core merge.

API completa: `packages/game-shapes-three/README.md`.

## Como usar
```ts
import { generate, buildPrimitive } from '@adatechnology/game-shapes'
import { toObject3D, toGeometry, shapeGeometries, mergeByMaterial } from '@adatechnology/game-shapes-three'

const { object, parts } = toObject3D(THREE, generate(schema), { materials })   // Group ou LOD
const T = shapeGeometries(THREE)            // THREE com Box/Cylinder/Cone/Sphere/Plane/Circle/Ring/Lathe/Torus/Extrude do game-shapes
new T.CylinderGeometry(0.05, 0.065, 1.1, 10) // instanceof THREE.CylinderGeometry, arrays iguais bit a bit
mergeByMaterial(THREE, root, space)          // o mesmo resultado do antigo game-props3d, agora sobre o merge do núcleo
```

## Regras
- Kit de pacote com código portado dos times: passe `shapeGeometries(THREE)` como `T`; o código continua igual ao original e os goldens não mudam.
- `toGeometry(..., { copy: false })` compartilha os arrays do cache: só leitura.
- Extrusão com curva, várias formas, caminho ou gerador de uv próprio cai no three (lista do T9 §7.3).
- Nomes das malhas: `static:<material>` e `part:<id>`, com `userData.material`, `userData.part` e `userData.ranges`.
