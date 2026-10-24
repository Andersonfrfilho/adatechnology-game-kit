---
name: game-characters-three
description: Use quando precisar desenhar personagens no three.js, como corpo instanciado de multidão, horda de zumbis, LOD, assar corpo, variantes, membro arrancado voando, lote de corpos na GPU, pose na GPU. Adaptador three.js do game-characters; o three entra pelo host.
---

# @adatechnology/game-characters-three

## Objetivo
Desenhar os corpos do `game-characters` no three.js. O três é passado pelo host (`createX(THREE, ...)`), nunca importado, então serve em bundler e em `<script>`.
Caminho **instanciado** (porte literal do corpo do jogo): `buildInstancedBody` (16/10/5 segmentos), `BODY_CHUNK` (a pose dos 12 ossos na GPU, byte a byte do jogo), `createBodyMaterial`, `createBodyBatch`, `bakeBody`/`bakeVariants` (regra ZVAR), `createFlyingLimbs` (40 pedaços).

## Quando usar e quando não usar
- Use para: horda de dezenas a milhares de corpos em poucas chamadas; membros arrancados; corpos assados por variante.
- Não use para regra de dano ou andar em números (é o `game-characters`).

## Como usar
```ts
import * as THREE from 'three'
import { buildInstancedBody, createBodyBatch, createFlyingLimbs, lodAt } from '@adatechnology/game-characters-three'

const time = { value: 0 }
const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 10 }), { max: 700, time })
scene.add(batch.mesh)
batch.begin(); batch.push({ a: [x, z, yaw, fase], b: [altura, porte, passada, pose], c: [mascara, infeccao, bracos, pele], color, eye }); batch.end()
const limbs = createFlyingLimbs(THREE, { random, effects: { onSplat } })
limbs.launch({ x, z, kind: 'leg', color, blood: { color, dried, bleeds: true } })
```

## API principal
| Função | Para que serve |
|---|---|
| `buildInstancedBody(THREE, { segments, body? })` | geometria única do corpo; `body` (BodySpec) move as juntas |
| `createBodyChunk({ hipHeight? })` / `BODY_CHUNK` | o trecho de shader |
| `createBodyBatch(THREE, geometria, { max, time })` | lote instanciado: `begin`/`push`/`end` |
| `bakeBody(THREE, builders, spec, lod)` / `bakeVariants` | assa um corpo rico numa malha instanciável; variantes por tipo |
| `lodAt(distancia)` | 0, 1 ou 2 (18 m e 55 m) |
| `createFlyingLimbs(THREE, { random, effects })` | membros que voam, quicam e ficam; `onLaunch`/`onSplat` ligam o sangue |

## Notas
- O lado é decidido pelo sinal de x (osso 2/4/7/9 em x negativo), qualquer que seja o nome no spec.
- O `buildInstancedBody` com `GUIDE` é um desvio assumido (P1): as juntas seguem o spec, os tamanhos das peças seguem as distâncias entre juntas.
