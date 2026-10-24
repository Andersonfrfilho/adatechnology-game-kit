---
name: game-vfx
description: Use quando precisar de explosão, fogo, fumaça, onda de choque, estilhaços, cratera, chama residual, tremor e clarão de tela num jogo, sem engine. Porte literal do Laboratório de Explosões, determinístico por semente, com LOD por distância e teto de explosões por área.
---

# @adatechnology/game-vfx

## Objetivo
Efeitos visuais sem renderizador, testáveis em Node. O compositor de camadas do Laboratório de Explosões (clarão e luz, bola de fogo que esfria em fumaça,
fumaça própria, onda de choque que empurra a fumaça, poeira rasteira, estilhaços e brasas, detritos em brasa, marcas no chão, cogumelo, fogo residual),
os laços de simulação e o estado da tela (tremor, clarão, e os efeitos de tela da Oficina de VFX). A mesma semente dá a mesma explosão: cada chamada
sorteia na mesma ordem do original. Unidades: metros, segundos.

## Quando usar e quando não usar
- Use para: uma explosão de explosivo ou de peça do mundo, fogo de poça ou de peça queimando, tremor e clarão de tela, orçamento de partículas e LOD.
- Não use para desenhar (é o `game-vfx-three`), para o dano da explosão (é `game-weapons` e `game-destruction`) nem para sangue e líquidos (`game-fluids`).

## Como usar
```ts
import { createGroundField, createVfx, LOD_LAB } from '@adatechnology/game-vfx'

const vfx = createVfx({ seed: 42, profile: 'high', ground: createGroundField(), explosions: catalogo, onRequest: (pedido) => host.atender(pedido) })
vfx.setCamera([x, y, z])
vfx.explosion('m67', [0, 0.1, 0], { seed: 7, direction: [1, 0, 0] })   // handle, ou null se o id não existe
vfx.update(dt)                                                           // todo quadro
const { puffs, sparks, chunks, glows, shocks, lights, marks } = vfx.pools()
```
- `randomMode: 'per_event'` (padrão): a semente do evento decide o visual, então um cliente de LAN repete a partir de poucos bytes. `'shared'` usa um fluxo só, como a página do time (goldens).
- `onRequest` recebe o que o efeito não faz sozinho: `crater` (cavar um chão seu), `blast_front` (vidros e personagens; `speed` 340 m/s: o host atrasa por distância) e `ignite` (personagens no raio pegam fogo).

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createVfx(options?)` | `VfxWorld` (`seed`, `randomMode`, `profile`, `lod`, `areaCap`, `ground`, `groundAt`, `wind`, `gravity`, `explosions`, `aliases`, `reducedMotion`, `onRequest`) |
| `explosion(id, ponto, { direction?, seed?, scale?, delay? })` | detona; `scale` aumenta raio, marcas e cogumelo; `delay` agenda (cadeia) |
| `fire({ point, radius, life, rate?, smoke?, grow?, startRadius?, follow?, offset?, smokeColor? })` | fogo de área que cresce, solta chamas que esfriam em fumaça e some; devolve handle |
| `push / stop / setLayer / layer / setCamera / forceLod / clear / time / catalog` | empurrar fumaça, parar fogo, camadas (`flash`, `fire`, `shock`, `smoke`, `shrapnel`, `mark`), câmera, LOD forçado, zerar |
| `update(dt)` | avança anéis, fumaça, faíscas, halos, ondas, detritos, fogos, luzes e tela, nessa ordem |
| `screen() / stats() / pools()` | tremor e clarão; contadores; as piscinas para desenhar (`items` em ordem de entrada) |
| `lehmer / lcg / streamFor` | geradores (Park-Miller do Laboratório, o do Padrão de Fluidos, fluxo de um evento) |
| `LOD_GAME / LOD_LAB / lodScale`, `AREA_CAP_GAME / createAreaCap` | faixas de distância (15/40/80 m ou 20/45/85 m) e o teto de 6 explosões em 4 s a 40 m (excedente a 0,3) |
| `PROFILES / EVENT_BUDGET / estimateCost` | tamanho das piscinas (`high`, `medium`, `low`), tetos por evento (400 partículas, 40 detritos, 4+2 luzes) e o custo da ficha |
| `createGroundField` | chão deformável de 60 m com células de 33 cm que as crateras cavam |
| `createSchedule / createScreenState / updateScreen / OrderedPool` | agenda (timers do último para o primeiro), estado da tela, piscina ordenada |

## Compõe com
- `@adatechnology/game-contracts`: o `EffectSink` que o `game-vfx-three` implementa e o `explosive` do evento `explosion`.
- `game-vfx-three`: desenha as piscinas (shaders do Laboratório, marcas, luzes, tela).
- `game-weapons`: os ids dos explosivos são as chaves do catálogo; `game-destruction` manda `explode` com o id do efeito; `game-fluids` ficará com o sangue e os respingos (T5.3).

## Ambiente de teste
O ambiente `vfx-test-area` (T5.2e) carrega o módulo de bancada do `game-vfx-three` na sala de testes: escolha da explosão por grupo, detonar de novo, distância, faixa de LOD, camadas, medidores e a ficha.

## Cuidados
- Ordem dos sorteios é contrato: mudar a ordem de um `random.next()` quebra os goldens (`tests/team-golden.test.ts`). Não reordene ao refatorar.
- Cores `0xRRGGBB` de fumaça, poeira e fogo viram linear **uma vez**, no spawn; detritos e luzes ficam como o r128 lia (sem conversão).
- Nenhuma alocação por quadro: as piscinas reaproveitam registros. Não guarde referência a um registro depois de um `update`.
- O `crater` pedido ao host é para quem tem terreno próprio; se o mundo recebeu `ground`, ele já cavou o seu.
- Testes de golden chamam `installPortableMath()` (Node 22 e 24 diferem no último bit de `Math.pow`).

## O que vem pela migração
`explosions.json` com os 16 perfis e `generic` (T5.1c), o renderizador three (T5.1d), os goldens do Laboratório (T5.1e); depois `play`, `burst`, `spawn` e `attach` com as receitas da Oficina, o corredor de efeitos e os efeitos de destruição, armas, veículos e tela (T5.2).
