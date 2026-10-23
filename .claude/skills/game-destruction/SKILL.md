---
name: game-destruction
description: Use quando precisar de dano e destruição de objetos num jogo, sem engine, como amassar, furar, trincar, estilhaçar, queimar, derreter, desmontar com ferramenta, desabar estrutura ou receber tiro e explosão. Termos, destruição, dano, material, vidro, concreto, incêndio, fratura, parede, desmontar, colapso.
---

# @adatechnology/game-destruction

## Objetivo
Modelo de destruição independente de engine. Um objeto é um conjunto de **peças** (caixa, cilindro ou esfera com um material) ligadas por **juntas**.
O material decide o efeito do golpe; o mundo devolve tudo como **eventos** em espaço de mundo, que um renderizador desenha. Determinístico (semente) e
serializável. Não conhece nenhum jogo. Unidades: metros, quilogramas, segundos, joules, °C.

## Quando usar e quando não usar
- Use para: tiro, golpe, explosão, fogo, calor, vazamento, desmontar com chave de fenda, estrutura que desaba (colunas, lajes, paredes).
- Não use para desenhar nada (é o `game-destruction-three`), nem para decidir dano em pessoas ou zumbis (fica em `game-characters`).
- Regra do projeto: antes de reimplementar dano, material ou estrutura em outro pacote, use este.

## Como usar
```ts
import { createDestruction } from '@adatechnology/game-destruction'

const world = createDestruction({ seed: 42 })
world.on('*', (event) => console.log(event.type)) // dent, hole, crack, fracture, detach, ignite, melt, leak, explode...

const chair = world.add({
  name: 'chair',
  parts: [
    { id: 'seat', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.04, 0.4] }, position: [0, 0.42, 0] },
    { id: 'leg_fl', material: 'wood_soft', shape: { kind: 'box', size: [0.04, 0.4, 0.04] }, position: [0.18, 0.2, 0.18] },
  ], // juntas inferidas das peças que se tocam, salvo se passar `joints`
})

world.shoot([0, 1, 5], [0, 0, -1], 500, 9) // origem, direção, energia (J), calibre (mm)
world.hit(chair, { type: 'fire', point: [0, 0.4, 0], temperature: 1000, radius: 0.5, duration: 0.2 })
world.disassemble(chair, 'seat~leg_fl', 'screwdriver', 0.016) // progresso 0..1, -1 se a ferramenta não serve
for (const event of world.update(0.016)) console.log(event) // fogo, derretimento, calor, vazamento, explosão atrasada
```
Quem possui as transformações (renderizador ou física) chama `setTransform`; depois de um `detach`, `splitGroup` transforma o pedaço solto em objeto.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createDestruction(options)` | cria o `DestructionWorld` (`seed`, `materials`, `onEvent`) |
| `world.add / remove / register` | adiciona objeto por spec, ou hospeda um `DestructibleImpl` de um módulo |
| `world.hit / hitPart / explode / shoot / raycast` | aplica dano (`ballistic`, `blunt`, `slash`, `explosive`, `fire`, `heat`) |
| `world.update(dt)` | avança fogo, calor, derretimento, vazamento, sobrecarga estrutural; devolve eventos |
| `world.disassemble / workableJoints / nearestJoint` | desmontar juntas com a ferramenta certa |
| `world.setLiters / extinguish / reset / splitGroup / setTransform / setPartPose` | recipientes, apagar fogo, reparar, separar pedaço, sincronizar pose |
| `world.state / part / snapshot / serialize / load` | estado vivo (só leitura), cópia, JSON de ida e volta |
| `MATERIALS`, `guessMaterial(name)` | 26 materiais embutidos; adivinha o material pelo nome da malha |
| `buildFrame`, `sizeStructure` | estrutura de teste (colunas, lajes, paredes) e dimensionamento de capacidade |
| `inferJoints`, `JOINT_DEFAULTS`, `JOINT_BY_MATERIALS` | juntas (screw, bolt, weld, mortar, rebar...) |
| `checkDestructible`, `checkHit`, `IMPACT_CONTRACT` | validar um `DestructibleImpl` ou um golpe contra o contrato |
| `resolveStrings(locale)`, `locales` | nomes em `en` e `pt-BR` |

Eventos: `damage`, `dent`, `hole`, `crack`, `ricochet`, `debris`, `fracture`, `detach`, `disassemble_progress`, `ignite`, `extinguish`, `burnout`, `melt`,
`drip`, `leak`, `explode`, `stress`, `collapse`, `destroyed`.

## Compõe com
- `@adatechnology/game-contracts`: dono dos tipos de golpe, evento e `DestructibleImpl` (este pacote os reexporta).
- `game-weapons`: cada `Shot` vira `world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber)`.
- `game-fluids`: o evento `leak` vira `fluids.puncture(...)`; `setLiters` mantém o recipiente da peça em sincronia.
- `game-destruction-three`: desenha os eventos. Casas (`game-floorplan-*`) devem usar os materiais e a estrutura daqui (concreto, tijolo).

## Ambiente de teste
Não há `examples/` próprio. A "Sala de testes de destruição" do kit é uma build deste SDK dentro de `examples/test-room` (`node build.mjs` gera
`dist/test-room.html`, um arquivo só). A área abre com `?area=` na sala.

## Cuidados
- Um golpe tira `energy * 0.02 * damageScale` de vida. Passa por `energy > penetração (J/mm) * espessura (mm)`; ângulo raso conta caminho maior e pode ricochetear.
- Vidro e cerâmica (`shatter`) levam dano multiplicado por `fragility`: 9 mm quebra um vidro de 3 mm em um tiro.
- Fogo só leva a peça até a temperatura da fonte: fogueira (800 °C) nunca derrete aço (1450 °C).
- `state()` e `part()` são vistas **vivas**: não guarde entre quadros para comparar; use `snapshot`.
- Eventos e pontos estão em espaço de mundo; `register` de um impl só usa a transformação para raycast e alcance da explosão; `splitGroup` num impl lança erro.
- Aleatoriedade vem só da semente (nada de `Math.random`); `load` exige os mesmos materiais.
- Estrutura: sem `structure` o objeto se comporta como antes; capacidades brutas de material costumam ser absurdas, use `sizeStructure`.
- Explosão: fragmentos têm teto de 40 m/s.

## O que vem pela migração (spec 001)
- Concreto armado e tijolo como material e estrutura (apontado pelo dono em 2026-10-23), a verificar no artefato da Sala de destruição (V8: juntar as duas versões).
- Reação em cadeia de explosivos aqui (A11) e explosão do Laboratório com teto por área (E1).
- Dois raios de explosão, letal e de ferimento (E3): dados em `game-weapons`, dano em `game-characters`.
- Carro e parede da Galeria não são portados: usam este pacote (A8).
- Destruição passa a usar o futuro `game-vfx` para os efeitos (E4).
