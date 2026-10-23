---
name: game-interactables
description: Use quando um objeto do mundo precisa ser interativo (porta, gaveta, tampa, botão, geladeira, baú, tomada, interruptor, rede elétrica, gás, água, assento, cama, cortina que balança, espelho) ou ter loot por semente. Runtime sem renderer; o jogo desenha o que o mundo reporta.
---

# @adatechnology/game-interactables

## Objetivo
Runtime sem renderer para objetos interativos: partes móveis (porta, gaveta, tampa, botão), recipientes com itens e loot determinístico, rede elétrica lógica (medidor, circuitos, tomadas, interruptores, aparelhos), combustível (botijão, carvão), rede de água lógica, assentos e camas, volumes macios que balançam sem bloquear, emissores de efeito, espelhos, colisores e dano. Não desenha nada e não exige `three`.

## Quando usar e quando não usar
- Use para o comportamento: o que está sob a mira, o que `act()` faz, estado de partes, energia, gás, água, conteúdo.
- Não use para desenhar (`game-interactables-three`), nem para o conteúdo dos objetos (`game-interactables-household`), nem para destruição (`game-destruction`; aqui só há tags e um delegate).

## Como usar
```ts
import { createWorld, poseOf, type ObjectSpec } from '@adatechnology/game-interactables'

const world = createWorld({
  locale: 'pt-BR',
  seed: 'level-1',
  items: { can: { id: 'can', category: 'food', size: [0.07, 0.11, 0.07], weight: 0.4, stack: 6 } },
  loot: { pantry: { fill: 0.7, entries: [{ type: 'can', weight: 1, qty: [1, 3] }] } },
  strings: { 'pt-BR': { 'prompt.door.closed': 'Abrir {name}', 'prompt.door.open': 'Fechar {name}', 'type.cupboard': 'armário' } },
  onEvent: (e) => console.log(e),
})
const cupboard: ObjectSpec = {
  type: 'cupboard',
  parts: [{ id: 'door', pivot: [-0.4, 0, 0.3], motion: { kind: 'hinge', angle: -Math.PI / 2 }, sweep: [-0.4, 0.3, 0.4, 1.1], label: 'prompt.door' }],
  containers: [{ id: 'main', access: 'door', volume: { center: [0, 0.5, 0], half: [0.4, 0.4, 0.25] }, slots: [{ pos: [0, 0.1, 0], max: [0.3, 0.3, 0.3] }], loot: 'pantry' }],
}
world.add('kitchen_cupboard', cupboard, { x: 2, y: 0, z: -1, ry: Math.PI })
world.fitSweep('kitchen_cupboard', 'door', (x, z) => isWall(x, z)) // a porta não atravessa parede

world.update(dt) // todo quadro
const look = world.target({ x, y, z, yaw, pitch }) // melhor interação ou null
if (look && pressedUse) look.act()
const pose = poseOf(spec.parts![0].motion, world.partT('kitchen_cupboard', 'door')) // pose relativa ao pivô
```
Convenções: coordenadas do spec são locais, frente em `+z`, origem no centro da pegada no chão, metros. `ry` gira em torno de `+y` como no three; `yaw` 0 olha para `-z`.

## API principal
`createWorld(options)` com `WorldOptions`: `locale`, `strings`, `items`, `loot`, `seed`, `grid`, `rain`, `wind`, `waterSupply`, `onEvent`, `canInteract`, `destruction`.

| Grupo | Membros |
|---|---|
| Objetos / quadro | `add`, `remove`, `get`, `objects`, `update(dt)` |
| Interação | `interactables()`, `target(eye, { reach, cone, filter, kinds, includeUnavailable })`, `act(id, actor?)` |
| Partes | `partT`, `setPart`, `fitSweep` |
| Acionar | `setDevice`, `setFixture`, `setBurner` |
| Recipientes | `contents`, `accessible`, `take`, `put`, `slotPosition` |
| Energia | `power.grid`, `setGrid`, `setBreaker`, `breaker`, `isPowered`, `isOn`, `pluggedInto`, `channel` |
| Combustível / água | `fuelLevel`, `isLit`; `water.setDefaultTank`, `level`, `refill`, `setRain`, `isFlowing` |
| Assentos / macios | `sit`, `stand`, `seatOf`; `push`, `sway`, `setWind` |
| Desenho | `emitters()`, `mirrors(eye, maxDistance?, count?)`, `colliders({ merge? })` |
| Dano / texto / save | `damage`, `hp`; `t`, `setLocale`; `serialize`, `load` |
| Avulsos | `rng`, `hashString`, `generateLoot`, `fitsSize`, `fitsSlot`, `poseOf`, `localToWorld`, `worldToLocal`, `rotY`, `rotateAxis`, `mergeColliders`, `resolveStrings`, `locales`, `format`, `pickLocale` |

`onEvent` emite `part`, `pickup`, `device`, `switch`, `fixture`, `burner`, `seat`, `damage`, `explosion`, `leak`, `message`, `power`, `container`. Textos do motor existem em `en` e `pt-BR`.

## Compõe com
- `game-interactables-household` (objetos prontos, devolvem `ObjectSpec`), `game-interactables-three` (desenha e sincroniza as partes), `game-props3d` (primitivas dos móveis).
- Specs carregam tags de `game-destruction` (`PartSpec.destruction`, `ObjectSpec.destruction`), sem depender dele; `destruction: { hitPart }` em `createWorld` repassa o dano.
- A casa gerada por `game-floorplan*` entrega `items` que o jogo transforma em objetos aqui.

## Ambiente de teste
- `examples/interactables-test-area`: módulo `TestableModule` para a sala de testes compartilhada (um item destrutível por tipo, animações, fluidos, cenários); `node build.mjs` gera `dist/furniture-area.js` e `dist/sala-moveis.html`; `node test.mjs` testa.
- `examples/interactables-showroom`: showroom 3D andável em primeira pessoa; `node build.mjs` gera `dist/showroom.html` (um arquivo, sem rede).
- Antes: `pnpm -r build` (os `build.mjs` exigem os pacotes compilados).

## Cuidados
- `fitSweep` limita a parte para sempre, mas os limites **não são salvos**: chame de novo depois de `load()`; `load` exige o mesmo conjunto de objetos já adicionados.
- Lâmpada ligada direto ao circuito (`kind: 'lamp'` com `circuit`, sem `plug` nem `part`) não ganha interação derivada: quem liga são interruptores e `setDevice`.
- `interactions` explícitas substituem as derivadas.
- Rótulos nunca levam dica de tecla ("E:"); o jogo põe a sua.
- Interação indisponível é ignorada pelo `target` salvo `includeUnavailable`; `reason` é chave de locale.
- Com `destruction` no `createWorld`, `world.hp` devolve `null`; `DamageSpec` e `world.damage` sem o delegate são deprecated.
- Aparelho ligado sem energia continua ligado, com `powered: false` e mensagem `no_power`.

## O que vem pela migração (spec 001)
- Nenhuma decisão do consolidado muda a API deste pacote. A9 (catálogo único) estende o `ItemDef` com peso, volume, empilhável, durabilidade, validade, raridade e receitas: o `items` do `createWorld` passa a receber esse catálogo.
- Concreto armado e tijolo na destruição (item a verificar) entram pelas tags `destruction.material`.
