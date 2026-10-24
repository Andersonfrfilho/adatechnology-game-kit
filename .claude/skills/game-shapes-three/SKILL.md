---
name: game-shapes-three
description: Use quando precisar desenhar em three.js uma forma do game-shapes (malhas por material, peças móveis, InstancedMesh, LOD), trocar os construtores de geometria do three por versões do game-shapes num kit portado (T), ou juntar malhas por material (mergeByMaterial).
---

# @adatechnology/game-shapes-three

## Objetivo
Adaptador three.js do `game-shapes`. O three é passado pelo host; o pacote nunca o importa.

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
