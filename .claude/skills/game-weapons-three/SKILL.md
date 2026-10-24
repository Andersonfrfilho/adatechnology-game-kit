---
name: game-weapons-three
description: Use quando precisar da apresentação em three.js das armas do game-weapons, como o modelo real da arma (portado da Galeria 3D do Arsenal), arma na mão com tiro, ciclo, pane, destravar, trava e as sete recargas, cápsulas e cartuchos por calibre, pente caindo, desgaste do metal, sons sintetizados e a área de testes de armas. Termos, viewmodel, arma na mão, cápsula, cartucho, som de tiro, balcão de armas, clipe de animação.
---

# @adatechnology/game-weapons-three

## Objetivo
Lado three.js do `@adatechnology/game-weapons`: os **modelos reais das 78 armas da Galeria 3D do Arsenal** (porte fiel dos construtores: pistola, revólver,
fuzil, bullpup, P90, basculante, M2, lançadores e lança-chamas), cartucho e estojo por calibre, a arma na mão tocando os **clipes** que o contrato de
`game-contracts` pede (tiro, rajada, ciclo, pane, destravar, trava e as sete recargas, no tempo que a regra dá), cápsulas, pentes e fumaça, o desgaste do
metal (nova, usada, gasta, enferrujada), sons sintetizados com WebAudio e a **área de testes de armas** (balcões com todas as armas e alvos) como `TestableModule`.
As armas que a Galeria não desenhou (os arquétipos genéricos, corpo a corpo, arco) continuam com o prop low-poly.

## Quando usar e quando não usar
- Use para mostrar e ouvir uma arma, ou para carregar a área de armas numa sala de testes.
- Não use para a regra (munição, tiro, recarga): é o `game-weapons`. Não traz mira, HUD nem dano.
- Outro renderizador pode ocupar o lugar: a animação padrão cumpre um contrato, não é obrigatória.

## Como usar
```ts
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'

// room é um host de @adatechnology/game-contracts (a sala de testes, por exemplo)
const report = room.loadModule(createWeaponsTestModule({ locale: 'pt-BR' }))
room.openArea('weapons_area')
```
Só o modelo e o som, sem sala:
```ts
import * as THREE from 'three'
import { buildWeaponModel, createWeaponAudio } from '@adatechnology/game-weapons-three'
import { createArsenal } from '@adatechnology/game-weapons'

const arsenal = createArsenal({ locale: 'pt-BR' })
const def = arsenal.weapons.get('pistol_9mm')!
scene.add(buildWeaponModel(THREE, def)) // Group com as peças da arma
createWeaponAudio(0.6).shot(arsenal.muzzleEnergy(def.action.kind === 'firearm' ? def.action.caliber : '9x19'), def.category)
```
O modelo real de uma arma da Galeria e o que o contrato de animação precisa dele:
```ts
import { buildWeaponModelById, hasWeaponModel, applyCondition, modelKit } from '@adatechnology/game-weapons-three'

if (hasWeaponModel('ak_47')) {
  const model = buildWeaponModelById(THREE, 'ak_47')! // { id, root, inner, parts }: eixo longo em +x, coronha na origem, no comprimento real
  scene.add(model.root)
  applyCondition(modelKit(THREE), model, 'rusty') // new, used, worn ou rusty (os ids da regra)
}
```
`createWeaponFx({ THREE, scene, camera, arsenal, groundAt, audio, tool })` é o que o módulo cria em `attach`; alimente com `fx.handle(event, tool)` (eventos da
ferramenta do host) e `fx.update(dt)` a cada quadro. `tool: () => HostTool` dá o calor do cano e o combustível queimando (nenhum evento os anuncia).

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createWeaponsTestModule(options?)` | `TestableModule` com `id: 'weapons_area'`; expõe também `audio` e `fx`. Opções: `locale` (padrão `pt-BR`), `arsenal`, `sound`, `condition`, `seed` |
| `weaponsLayout(weaponItemIds, pitchOf?)` | posições dos balcões (até 6, em duas fileiras), armas lado a lado (cada uma com a sua faixa) e alvos (aço, compensado, concreto) |
| `createWeaponFx(options)` | arma na mão: as da Galeria tocam os clipes, as outras têm o prop de caixas; `handle`, `update`, `setCondition`, `inHand`, `casings`, `magazines`, `dispose` |
| `MODEL_ENTRIES`, `hasWeaponModel(id)`, `buildWeaponModelById(THREE, id)` | os 78 modelos da Galeria (`data/models.json`: construtor, medidas e opções por id) |
| `buildCartridge`, `buildCasing`, `cartridgeShape` | cartucho (em mm, como a Galeria mostra), estojo vazio (m) e a forma por calibre, das medidas do `CaliberDef.cartridge` |
| `modelKit(THREE)` | materiais e primitivas da Galeria (uma por namespace do three); `applyCondition(kit, model, id)` veste o desgaste |
| `createWeaponAudio(volume?)` | `shot(energyJ, category)`, `click`, `reloadStart/End`, `cycle`, `clink`, `thud`, `setVolume`, `dispose` |
| `buildWeaponModel(THREE, def)` / `buildProp` / `weaponProp` | modelo e spec (`DestructibleSpec` de caixas) de uma arma |
| `BODY_ACTIONS` | ids sem modelo próprio (`hand`, `kick`, `shove`, `fists`) |
| `WEAPON_ITEM_PREFIX`, `COUNTER_ITEM_ID` | prefixo `weapon_` dos itens e id do balcão |

## Compõe com
- `game-weapons` (dependência): arsenal e definições.
- `@adatechnology/game-contracts` (dependência): `TestableModule`, `HostEvent`, `HostTool`.
- `game-destruction` (devDependency): os alvos e armas soltas são specs de destruição.
- `game-test-room` (devDependency): carrega o módulo com `loadModule`. O pacote não faz parte do contrato genérico da sala (regra do projeto: nada de arma na sala).

## Ambiente de teste
`examples/weapons-test-area`: `node build.mjs` empacota o módulo em `dist/weapons-area.js` (global `WeaponsArea`) e gera `dist/sala-armas.html`
(sala de testes com a área carregada e aberta, um arquivo, sem rede). `node test.mjs` testa. No arquivo `src/entry.js`, `WeaponsArea.loadInto(room)`
carrega e abre a área. As áreas da página do kit abrem por `?area=`. Os testes do pacote ficam em `tests/weapons-area.test.ts`.

## Cuidados
- `three` é peer (`^0.160.0`): passe o seu `THREE`.
- O som só nasce no primeiro disparo vindo de clique ou tecla (política dos navegadores) e é no-op onde não há `AudioContext` (testes, workers).
- Cápsulas e partículas têm teto (900 partículas, 25 s de vida); o revólver só larga as cápsulas ao abrir o tambor e o basculante ao abrir os canos.
- O relógio é da regra: `reload`, `cycle` e `clear` trazem `duration`, e o clipe é escalado a ela; as etapas (`stage`) levam o clipe até o marcador, e o fim da fase o fecha.
- As armas da Galeria ficam no balcão como **um corpo rígido** (`body`, caixa do tamanho do modelo e a massa real); o modelo desenhado vai por cima, preso a ele. Armas no balcão nascem `asleep`.
- A cor vem do `ColorManagement` do three r160 (a Galeria convertia à mão no r128): o golden lê os valores lineares como a página.
- Itens não podem ter id começando por `weapon_` se não forem arma: a sala distingue pelo prefixo (por isso o balcão é `counter_weapons`).
- O som foi feito em 2026-10-23 sem base nas entregas dos times.

## Clipes e golden
- `src/animation/`: os tweens da Galeria (`tw`) viram `AnimationClipSpec` (`clip-builder.ts`: amostra a curva `ease` em 10 passos), por mecanismo: `shot-clips`, `cycle-clips` (ciclo e destravar), `reload-clips` (as sete recargas) e `magazine-clips`.
- Eventos de clipe (`muzzle_flash`, `eject_casing`, `drop_magazine`, `move_in`, `stuck_case`, `fly_jam`, `drop_tube`...) são tratados em `src/fx/viewmodel-events.ts`; o tocador é o `createToolClipPlayer` do `game-contracts`.
- `tests/gallery-models.test.ts` compara cada arma e cada cartucho, nó a nó, com o que a página produz (`tools/golden/captures/arsenal-models.js`, three r128): as 77 da Galeria batem, só o projétil do .50 BMG (13,0 na página, 12,7 no SDK) difere.

## O que ainda vem pela migração (spec 001)
- Sons: juntar a classe e o abafamento por distância do jogo com a energia do calibre (S2), sobre o `game-audio` genérico (S1); golden compara os parâmetros gerados, não o áudio.
- Efeitos de boca e explosivos passam a vir do `game-vfx-three` (E4).
