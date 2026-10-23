---
name: game-test-room
description: Use quando precisar de uma sala de testes em primeira pessoa para three.js onde um módulo de uma lib é carregado, aberto em área própria, atirado, queimado, quebrado e verificado com cenários e log. Termos - sala de testes, test room, loadModule, openArea, módulo de teste, cenário, log de comportamento.
---

# @adatechnology/game-test-room

## Objetivo
Sala de testes reutilizável para three.js: o jogador anda, pega, joga, atira, bate, queima e desmonta os objetos de um catálogo, com log de
comportamento exportável (JSON/NDJSON) e cenários com checagem. Não conhece nenhum jogo nem nenhuma lib de domínio.

## Quando usar e quando não usar
- Use para exercitar um módulo (`TestableModule`) de qualquer lib e para escrever cenários automáticos (`run: ({ room, step, expect })`).
- Não ponha aqui arma, carro ou móvel: o específico fica no pacote da lib e num `examples/<lib>-test-area` que chama `room.loadModule`
  (CLAUDE.md, seção 4). A sala só tem o contrato genérico.
- Não use como motor do jogo; é ferramenta de teste.

## Como usar
Uma lib cria o módulo (só depende de `game-contracts`) e o jogo/exemplo o carrega:
```ts
// my-lib/test-module.ts
import type { TestableModule } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

export const CRATES: TestableModule = {
  id: 'crates',
  name: 'Crates',
  group: 'Crates', // aba do catálogo
  items: (locale) => [{
    id: 'crate',
    name: locale === 'pt-BR' ? 'Caixote' : 'Crate',
    movable: true,
    build: (THREE) => {
      const T = THREE as typeof THREE_NS
      const root = new T.Group()
      const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0x8a6a3a }))
      mesh.name = 'body'
      mesh.userData.destructionPart = 'body'
      mesh.position.y = 0.5
      root.add(mesh)
      return root
    },
    spec: { name: 'Crate', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0.5, 0] }] },
  }],
  area: () => ({
    placements: [{ item: 'crate', position: [0, 0, -4] }, { item: 'crate', position: [2, 0, -4], rotationY: 0.4, asleep: true }],
    view: { eye: [0, 1.7, 2], target: [0, 0.8, -4] },
  }),
  attach: (host) => {
    const off = host.on((event) => { if (event.type === 'shot') host.log('shot', { weapon: event.weapon }) })
    return off // desfaz tudo
  },
}
```
```ts
// jogo ou examples/<lib>-test-area
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'

const room = createTestRoom({ THREE, container: document.getElementById('app')!, locale: 'pt-BR', catalog: demoItems('pt-BR') })
const report = room.loadModule(CRATES) // { module, items, scenarios, ok, problems }
if (!report.ok) console.error(report.problems)
room.openArea('crates') // id do módulo ou o group; usa module.area(); sem area, enfileira os itens
const scenarios = await room.runScenarios()
```
Sem `area`, os itens vão em fileiras. `openArea` de um grupo sem módulo também funciona. Recarregar o mesmo módulo substitui itens e cenários.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createTestRoom(options)` | Cria a sala (`THREE`, `container`, `catalog`, `locale`, `area`, `initial`, `scenarios`, `ui`, ...) |
| `room.loadModule(module)` | Junta itens ao catálogo, roda `checkDestructible`/`checkAnimation`, registra cenários e chama `attach`; devolve `ModuleReport` |
| `room.openArea(group)` | Limpa a sala e monta a área do módulo (ou fileiras do grupo); aba do catálogo aberta |
| `room.spawn / clear / resetAll / spawned` | Objetos da cena |
| `room.setTool / use / grab / throwHeld / look / walk / update` | Dirigir a sala por script |
| `room.playAnimation(clipId)` / `room.animations()` | Clipes dos itens |
| `room.bench(moduleId?)` | Bancada do módulo ativo (ou do id): `controls`, `layers`, `value`, `set`, `setLayer`, `act`, `encode` |
| `room.metrics()` | Contadores da sala (`fps`, `frame_ms`, `draw_calls`, `triangles`, `objects`, `fragments`, `particles`, `decals`) e os do módulo ativo |
| `options.metrics`, `options.bench` | Quais contadores da sala (`false` para nenhum); estado da bancada (`state`) e `onChange(moduleId, encoded)` |
| `encodeBenchState`, `decodeBenchState` | Estado `id=valor;id=valor`; o decode trata a entrada como hostil |
| `room.runScenarios()` / `room.scenarios` | Cenários embutidos e os do módulo |
| `room.log` / `createLog` | Log de comportamento (`toNDJSON`, JSON) |
| `demoItems`, `brickWallSpec`, `buildFromSpec` | Itens de demonstração e desenho de uma spec em malhas |
| `resolveStrings`, `locales` | Textos `en` e `pt-BR` |
| `ModuleReport`, `ScenarioContext` | Resultado do carregamento; contexto `{ room, step, expect }` |

A tela já traz busca no catálogo (todas as abas, sem acento) e busca de testes.

## Compõe com
`game-contracts` (contrato do módulo), `game-destruction` e `-three`, `game-weapons`, `game-fluids` e `-three` (a sala os usa por dentro).
Libs de conteúdo (`-fleet`, `-household`, `-species`) entregam módulos; não importam a sala.

## Ambiente de teste
`pnpm --filter @adatechnology/game-test-room test` (vitest: `module.test.ts`, `module-host.test.ts`, `room.test.ts`, `scenarios.test.ts`,
`bench.test.ts`, `metrics.test.ts`).
Exemplos no repositório: `examples/test-room` (carrega `DEMO_MODULE`), `examples/weapons-test-area`, `examples/interactables-test-area`.
Query strings do exemplo: `?area=`, `?items=`, `?scenario=all|<id>`, `?lang=`, `?quality=`, `?ui=0`, `?bench=` (estado da bancada).

## Cuidados
- O `build` recebe `THREE` como `unknown`; nomeie as malhas e ponha `userData.destructionPart` com o id da peça para a destruição achá-las.
- Item com `impl` (destruição própria) não é movível; o `DestructibleImpl.id` deve ser o id que a sala passa.
- `attach` roda uma vez no `loadModule`; devolva o desfazer. Recarregar o módulo chama o desfazer anterior antes do novo `attach`.
  `ModuleHost.onFrame` roda a cada quadro simulado.
- A bancada é emprestada (`host.bench`) só a módulo que declara controles, camadas ou contadores e passa no `checkBench`. As mudanças iniciais
  chegam logo depois do `attach`, já com o estado de `options.bench.state` restaurado. A sala nunca mexe em `location`.
- Q emite `mode` quando o modo de tiro muda; `fault`, `clear` e `safety` ainda não são emitidos pela sala (Fase 1, T1.3).
- Id de módulo/item/clipe em snake_case. Nos cenários avance o tempo com `step(segundos)`, não espere tempo real.
- Sem `renderer` injetado a sala é dona do canvas e do laço.

## O que vem pela migração (spec 001)
Decisão E5: o contrato do módulo já tem bancada (T0.2); falta a Oficina de efeitos virar módulo do `game-vfx` carregado aqui. V5: módulos de veículos e vegetação viram `examples/vehicles-test-area` e `vegetation-test-area`. Cada área da página do kit abre o seu
ambiente via `?area=`. Nada disso existe ainda no pacote.
