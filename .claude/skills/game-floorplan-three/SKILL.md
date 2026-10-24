---
name: game-floorplan-three
description: Use quando precisar desenhar em three.js uma planta gerada (casa, sobrado, mansão, mercado, farmácia, prédio): paredes, portas, janelas, pisos, lajes, escadas, telhado, calhas, lote, móveis, luzes, espelhos e carros, ligada à destruição da estrutura (fratura, colapso, fileiras de tijolo, lascas, armadura aparente), ou quando precisar andar por vários andares (grade de 10 cm, escadas, oclusão). É o porte literal do Casa3DSDK e do AndaresSDK do Visor de casas 3D.
---

# @adatechnology/game-floorplan-three

## Objetivo
Pegar a planta de `game-floorplan` (com `game-floorplan-structure` registrado) e devolver a casa em three.js: um grupo por andar, lote, telhado, portas que giram, luzes por cômodo, espelhos, carros,
colisores e o que o jogador faz nela (alvo, interação, colisão, LOD por distância). A casa se liga ao mundo de `game-destruction`: cada peça sabe a faixa de vértices que ocupa na malha fundida.
Porte literal do `Casa3DSDK` e do `AndaresSDK`: mesma geometria, mesmos desenhos, mesmo sorteio por semente (a cena de seis plantas é igual à da página do time, nó a nó).

## Quando usar e quando não usar
- Use para: mostrar uma planta em 3D, deixar o jogador entrar, abrir portas, acender luzes, destruir paredes e lajes, andar por escadas, planejar o LOD de várias casas (`planLod`).
- Não use para: gerar a planta (`game-floorplan*`), a estrutura e as capacidades (`game-floorplan-structure`), o dano em si (`game-destruction`), o desenho de fragmentos e do mundo de dano (`game-destruction-three`),
  o objeto interativo (`game-interactables*`), a lógica de horda, triagem ou infecção (outros pacotes e o jogo).

## Como usar
```ts
import * as THREE from 'three'
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as structure } from '@adatechnology/game-floorplan-structure'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { create, createFloorNavigator, navigationDefOf, bindNavigator } from '@adatechnology/game-floorplan-three'

residential(engine, { region: 'br' }); structure(engine)
const plan = engine.generate('townhouse', { seed: 7, state: 'normal' })

const world = createDestruction({ seed: 1 })
const renderer = create(THREE, { destruction: world, destructionRenderer: createDestructionRenderer(THREE, { scene, world }), fleet, locale: 'pt-BR' })
const house = renderer.build(plan, { quality: 'high', night: false })
scene.add(house.group)
house.update(dt, performance.now(), camera.position) // por quadro: portas, roupa no varal, vento, LOD por distância

house.target({ x, y, z, floor, yaw, pitch }) // { text: 'E: abrir a porta', action, target } ou null
house.interact(eye); house.collide(x, z, floor, { radius: 0.24 }); house.toggleLight(roomId)

const navigator = createFloorNavigator()
navigator.register(navigationDefOf(house, { id: 'casa', own: true }))
bindNavigator(navigator, 'casa', house) // parede no estágio 2 abre células; parede e laje que caem mudam a grade
```

## API principal
| Função/tipo | Para que serve |
|---|---|
| `create(THREE, options)` (`createHouseRenderer`) | O renderizador: `build`, `newState`, `types` (tipo de móvel para builder), `mv`, `cars`, `materials`, `setNight`, `lighting`, `dispose` |
| `renderer.build(plan, { quality, night, cut, state, terrain, noPerimeter, pieces, building, drawCallBudget })` | A casa: `group`, `floors[]`, `ceilings[]`, `roof`, `lot`, `colliders`, `parts`, `doors`, `stairs`, `lights { list, byRoom }`, `cars`, `structure`, `destruction`, `stats` |
| `house.update(dt, time, focus)` / `show({ floor, cut, lot })` / `setLod(n)` | Quadro, visibilidade por andar, LOD manual (0 completo, 1 sem peças pequenas, 2 oculta) |
| `house.target` / `interact` / `toggleDoor` / `lightOn` / `toggleLight` / `collide` / `roomAt` / `message` | O que o jogador faz; textos de `locales` (`en`, `pt-BR`) |
| `house.damage(id, point, type, amount)` | Dano legado (hp da peça, `onDamage`) que vira golpe no mundo de destruição |
| `house.structure` / `house.destruction` | Peças com a faixa de vértices (`structure.meshesOf(id)`), `spec()`; adaptador do mundo (`activate`, `reset`, `piece`, `statistics`, `onEvent`) |
| `planLod(houses, focus, budget)` | Reparte o orçamento de draw calls entre casas: as mais próximas ficam completas |
| `createFloorNavigator()` | `register`, `blocked`, `level`, `stairTo`, `heading`, `ray`, `ceilingOf`, `occlude`, `openCells`, `closeCells`, `undoChanges` |
| `navigationDefOf(house, options)` / `bindNavigator(nav, id, house)` | Registro de uma casa construída; liga a grade à destruição |
| `createTranslator`, `locales`, `en`, `ptBR` | Textos que a casa mostra |

Opções injetadas (o pacote não lê globais): `fleet`, `reflector`, `props`, `interactives` (inclui o adaptador, que é código do jogo), `vegetation`, `textures`, `atlas`, `materials`, `seedKey`, `carKinds`, `hp`, `lod`, ganchos `on*`.

## Compõe com
- `game-floorplan` + `-residential`/`-commercial`/`-rural`/`-post-apocalyptic` (planta), `game-floorplan-structure` (peças, capacidades, `toDestructibleSpec`), `game-props3d` (builders de móvel),
  `game-destruction` e `game-destruction-three` (mundo, fratura, fragmentos, lascas, armadura), `game-vehicles-fleet` (carros), `game-vegetation` e `-species`, `game-interactables*` (kit interativo).

## Ambiente de teste
- `pnpm --filter @adatechnology/game-floorplan-three test`: golden da cena contra a página (`tests/golden-scene.test.ts`, seis plantas e o plano de LOD), estrutura, lote e telhado, destruição com mundo e renderizador reais, navegação, interação.
- Regravar o golden: `tools/golden/captures/house-scene.js` (comando em `specs/001-migracao-entregas-dos-times/goldens/README.md`).

## Cuidados
- A casa desenha uma parede por peça de estrutura (`wallDetail: 'coarse'`); o spec que ela registra mantém a montagem de alvenaria (tijolo, lascas, brecha) e põe o vergalhão do concreto armado nas lajes, vigas, pilares e escadas.
- As fileiras de tijolo só existem no LOD 0 e só para parede de alvenaria que chega ao estágio 2; no LOD 1 e 2 a parede é a caixa.
- Os ids do plano alimentam o sorteio por semente; para reproduzir uma cena desenhada com outros ids passe `seedKey`. Os sais (`'|varal'`, `'|luz'`...) e os prefixos `lp_`, `sw_`, `lamp_*_` vêm do time e não mudam.
- `game-props3d` sorteia com outro gerador que o do time: alguns builders (churrasqueira simples, atlas de quadros, cores do piso do lote, canteiro e plantas) não saem iguais à página; os pares do golden não os usam.
- Pontes (`interactives`, `vegetation`) incompletas: avisa uma vez (texto do idioma da casa) e desenha o móvel simples.
- `dispose()` tira a casa do mundo de destruição e solta as geometrias.

## O que vem pela migração
- `Casa3DSDK` (VC3 L39443–42734) e `AndaresSDK` (ML L7372–7557): portados; tabela dos nomes em `MIGRATION.md`; inventário em `specs/001-migracao-entregas-dos-times/inventario/casas-mapa.md` §1.2c.
