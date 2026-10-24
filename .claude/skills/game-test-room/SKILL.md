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
| `room.setTool / use / grab / throwHeld / look / walk / update` | Dirigir a sala por script (`setTool` toca o saque da regra: o gatilho responde `drawing` até acabar). `use(hold)` segura o gatilho por `hold` s e solta: granada de espoleta é cozinhada (sai no soltar com a espoleta que sobrou; `hold` além dela explode na mão). A Claymore dispara quando um corpo cruza o fio, e a carga posta ganha um marcador (`charge_marker`, e `charge_wire` no fio) |
| `room.waitUntilReady(maxSeconds?)` | Avança quadros até a ferramenta na mão não ter fase (saque, recarga, ciclo) e devolve os segundos esperados; use depois de `setTool` antes de `use` |
| `room.playAnimation(clipId)` / `room.animations()` | Clipes dos itens |
| `room.bench(moduleId?)` | Bancada do módulo ativo (ou do id): `controls`, `layers`, `value`, `set`, `setLayer`, `act`, `encode` |
| `room.metrics()` | Contadores da sala (`fps`, `frame_ms`, `draw_calls`, `triangles`, `objects`, `fragments`, `particles`, `decals`) e os do módulo ativo |
| `options.metrics`, `options.bench` | Quais contadores da sala (`false` para nenhum); estado da bancada (`state`: `{ [moduleId]: 'id=valor;...' }`) e `onChange(moduleId, encoded)` |
| `encodeBenchState`, `decodeBenchState` | Estado `id=valor;id=valor`; o decode trata a entrada como hostil |
| `room.runScenarios()` / `room.scenarios` | Cenários embutidos e os do módulo |
| `room.log` / `createLog` | Log de comportamento (`toNDJSON`, JSON) |
| `demoItems`, `brickWallSpec`, `buildFromSpec` | Itens de demonstração e desenho de uma spec em malhas |
| `resolveStrings`, `locales` | Textos `en` e `pt-BR` |
| `ModuleReport`, `ScenarioContext` | Resultado do carregamento; contexto `{ room, step, expect }` |

A tela já traz busca no catálogo (todas as abas, sem acento) e busca de testes.

Miniatura do item: `TestRoomItem.thumbnail` / `TestableItem.thumbnail` (URL ou `<svg…>` em linha) aparece acima do nome em cada botão do catálogo e dos resultados da busca, e no inspetor do item mirado (`InspectInfo.thumbnail`). A sala a desenha como `mask` CSS sobre a cor do texto: SVG de uma cor, tons em `fill-opacity`; uma URL precisa ser da mesma origem da página (ou ter CORS), e uma página `file://` não carrega miniatura por URL (use o SVG em linha). Item sem miniatura segue só com o nome.

## Compõe com
`game-contracts` (contrato do módulo), `game-destruction` e `-three`, `game-weapons`, `game-fluids` e `-three` (a sala os usa por dentro).
Libs de conteúdo (`-fleet`, `-household`, `-species`) entregam módulos; não importam a sala.

## Ambiente de teste
`pnpm --filter @adatechnology/game-test-room test` (vitest: `module.test.ts`, `module-host.test.ts`, `room.test.ts`, `scenarios.test.ts`,
`bench.test.ts`, `metrics.test.ts`).
A sala executa `host.command` pela regra do `game-weapons` na bancada (acessórios de qualquer instalação, no tempo que a regra dá) e mostra o que a ferramenta leva em `host.tool()`.

Exemplos no repositório: `examples/test-room` (carrega `DEMO_MODULE`), `examples/weapons-test-area`, `examples/interactables-test-area` (a página leva também o módulo de armas com os acessórios, para atirar nos móveis).
Query strings do exemplo: `?area=`, `?items=`, `?scenario=all|<id>`, `?lang=`, `?quality=`, `?ui=0`, `?bench=` (estado da bancada).

## Cuidados
- O `build` recebe `THREE` como `unknown`; nomeie as malhas e ponha `userData.destructionPart` com o id da peça para a destruição achá-las.
- Item com `impl` (destruição própria) não é movível; o `DestructibleImpl.id` deve ser o id que a sala passa.
- `attach` roda uma vez no `loadModule`; devolva o desfazer. Recarregar o módulo chama o desfazer anterior antes do novo `attach`.
  `ModuleHost.onFrame` roda a cada quadro simulado.
- Os efeitos são **um** mundo só (`game-vfx`): a sala o cria, o passa à destruição e o empresta como `host.effects` a todo módulo (`play({ effect, point })`); granada e foguete tocam o perfil do próprio explosivo e o evento `explosion` leva `explosive`. A tremida da câmera e o clarão de tela vêm dele (`TestRoom.applyCamera()` para quem renderiza por conta própria); `craters: true` troca o piso por um remendo deformável. O contador `particles` soma as piscinas dele.
- A bancada também mostra uma **ficha** (`host.bench.sheet(ficha)`: cartão com fatos, passos, cores e uma linha do tempo cuja cabeça de leitura segue um contador do módulo) e lista as opções com `group` sob `optgroup`; opções agrupadas nunca viram botões.
- A sala roda o filme dos líquidos (`createFilmManager` e `createFilmBridge` de `game-fluids-three`): um vazamento de combustível, óleo ou sangue pinga em grades perto da câmera; `clear` as libera.
- A bancada é emprestada (`host.bench`) só a módulo que declara controles, camadas ou contadores e passa no `checkBench`. As mudanças iniciais
  chegam logo depois do `attach`, já com o estado restaurado (o vivo, se o módulo está sendo recarregado; senão `options.bench.state[moduleId]`). Leitura de contador que lança mostra `n/a` e entra uma vez no log; ouvinte que lança não derruba os outros. A sala nunca mexe em `location`.
- Teclas da ferramenta: R recarrega, Q muda o modo de tiro (`mode`), **X destrava** a pane (`clear`) e **B liga ou desliga a trava** (`safety`). Pegar uma ferramenta chama `draw()`: o gatilho responde `drawing` pelo tempo da regra (0,35 s) e o host recebe `tool` com `duration`. O arsenal da sala tem as panes ligadas (a regra padrão); `arsenal` nas opções troca isso.
- Id de módulo/item/clipe em snake_case. Nos cenários avance o tempo com `step(segundos)`, não espere tempo real.
- Sem `renderer` injetado a sala é dona do canvas e do laço.

## O que vem pela migração (spec 001)
Decisão E5: o contrato do módulo já tem bancada (T0.2); a Oficina de efeitos é o módulo `vfx` do `game-vfx-three` (`examples/vfx-test-area`, T5.2). V5: módulos de veículos e vegetação viram `examples/vehicles-test-area` e `vegetation-test-area`. Cada área da página do kit abre o seu
ambiente via `?area=`. Nada disso existe ainda no pacote.
