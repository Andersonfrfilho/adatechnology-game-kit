---
name: game-contracts
description: Use quando precisar do contrato genérico entre módulos do game-kit (destruição, Hit, Shot, TestableModule, ModuleArea, ModuleHost, animação de item, contêiner de fluido) ou validar uma spec, um clipe ou um DestructibleImpl. Termos - contrato, módulo de teste, TestableModule, checkSpec, checkHit, shotToHit.
---

# @adatechnology/game-contracts

## Objetivo
O que todo módulo de jogo (veículo, móvel, planta, casa, arma) precisa conhecer, e nada além disso: tipos mais verificadores puros, sem
dependência de runtime. É o idioma comum pelo qual os SDKs se compõem sem importar uns aos outros.

## Quando usar e quando não usar
- Use ao escrever um módulo de uma lib que será carregado na sala de testes (`TestableModule`), ao produzir `Hit`/`Shot` de uma arma, ou ao
  validar dados (spec de destruição, clipe de animação, `DestructibleImpl`).
- Não use para lógica de jogo, three.js ou física: o pacote só tem tipos e checagens. A simulação é de `game-destruction`; a sala é de
  `game-test-room`.
- Não ponha aqui nada de domínio (arma, carro, móvel): o contrato é genérico (CLAUDE.md, seção 4).

## Como usar
```ts
import { checkSpec, checkAnimation, shotToHit, checkHit } from '@adatechnology/game-contracts'
import type { DestructibleSpec, Shot, TestableModule } from '@adatechnology/game-contracts'

const spec: DestructibleSpec = {
  name: 'Crate',
  parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0.5, 0] }],
}
const report = checkSpec(spec, { materials: ['wood_soft'] }) // { ok, problems, warnings }

const hit = shotToHit(shot, [0, 1, -3]) // Shot -> Hit (type 'ballistic')
const problems = checkHit(hit) // string[]; vazio quando o Hit cumpre IMPACT_CONTRACT
const clip = checkAnimation({ id: 'open', duration: 1, keys: [{ t: 0 }, { t: 1, parts: { body: { position: [0, 0.2, 0] } } }] }, ['body'])
```
O módulo de teste completo (com `area` e `attach`) está na skill `game-test-room`.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `checkSpec(spec, { materials? })` | Valida um `DestructibleSpec`: `{ ok, problems, warnings }` |
| `checkHit(hit)` | Problemas de um `Hit` segundo `IMPACT_CONTRACT` (`string[]`) |
| `checkDestructible(impl, { materials? })` | Valida um `DestructibleImpl` (`{ ok, problems }`) |
| `checkAnimation(clip, partIds)` | Valida um `AnimationClipSpec` contra os ids de peça |
| `shotToHit(shot, point, normal?)` | Transforma um `Shot` balístico em `Hit` |
| `IMPACT_CONTRACT` | Campos obrigatórios/opcionais do `Hit` por `DamageType` |
| `DestructibleSpec`, `PartSpec`, `Hit`, `DestructionEvent`, `ObjectState` | Dados da destruição |
| `DestructibleImpl` | Destruição própria de um módulo (`describe`, `hit`, `state`, ...) |
| `Shot`, `Use` | Tiro balístico e uso de arma não-balística |
| `ContainerSpec`, `ItemUseDef`, `LiquidId`, `FluidKind` | Fluidos |
| `AnimationClipSpec`, `ItemAnimationContract` | Animações de item |
| `TestableModule`, `TestableItem`, `ModuleItemFluid`, `ModuleScenario` | O que um módulo entrega à sala |
| `ModuleArea`, `AreaPlacement` | Como a sala monta a área do módulo (posições, `surface`, `asleep`, `view`) |
| `ModuleHost`, `HostTool`, `HostEvent` | O que a sala empresta ao módulo em `attach` (eventos de ferramenta: `tool`, `shot` com `rounds`/`mode` (sempre 1+ projétil), `misfire` (cartucho falhou, sem projétil), `reload` com `kind`/`duration`, `empty`, `mode`, `fault`, `clear`, `safety`, `cycle`, `stage`, `feed`; `duration` é o tempo que a regra deu à fase; `host.configureTool({ condition, ammo_quality })` recebe `Record<string,string>` pelos ids dos controles do módulo; `host.command(ToolCommand)` pede à ferramenta em mão `fit`, `remove`, `toggle`, `stock`, `underbarrel` ou `stance` e devolve `{ ok, reason?, seconds? }` (`HostTool` leva `attachments`, `stock`, `suppressed`, `underbarrelActive`, `mass`, `aimSeconds`; o evento `shot` leva `suppressed`) |
| `toolAnimationStep(event)`, `TOOL_CLIP`, `ToolAnimationStep` | Mapa do evento da ferramenta para o movimento (`play` de um clipe, `sync` com uma etapa, `finish`) |
| `createToolClipPlayer({ clips, rig, onEvent })`, `ToolRig`, `ToolAnimator`, `ToolClipSet` | Tocador de clipes sem renderizador: escala o clipe à duração da regra, aplica as poses na `ToolRig` e dispara os eventos do clipe |
| `scaleClip`, `sampleClip`, `checkToolClips`, `STAGE_EVENT` | Escala e amostra um clipe; valida o conjunto de clipes de uma ferramenta |
| `ModuleControl`, `ModuleLayer`, `ModuleMetric`, `ModuleBench`, `BenchChange`, `ControlPatch` | Bancada do módulo: controles, camadas e contadores declarados como dados; `host.bench` devolve as mudanças |
| `checkBench({ controls, layers, metrics })` | Valida a bancada (`{ ok, problems }`): ids snake_case únicos entre os três, `min < max`, `step > 0`, padrões válidos, `max > 0` |

## Animação de ferramenta (contrato para quem for plugar)
Qualquer renderizador anima a ferramenta na mão pelos mesmos passos, sem conhecer a arma: o módulo traz um `ToolClipSet` (clipes `AnimationClipSpec`
com ids `draw`, `shot`, `cycle`, `reload`, `reload_<kind>`, `feed`, `fault_<id>`, `clear_<id>`, `safety_on`...), a sala manda `HostEvent`, e
`toolAnimationStep` diz o que fazer. Eventos de clipe do tipo `stage` (`data.stage`) são marcadores: a etapa que a regra alcança (`stage`)
leva o clipe até o marcador, e o fim da fase (`reload end`) fecha o clipe. Poses são deslocamentos do repouso e uma chave que não cita a peça
significa repouso.
```ts
const player = createToolClipPlayer({ clips, rig, onEvent: (event) => spawn(event.type, event.data) })
host.on((event) => { const step = toolAnimationStep(event); if (step) player.apply(step) })
host.onFrame((dt) => player.update(dt))
```

## Compõe com
`game-destruction` (implementa o mundo e consome `Hit`), `game-weapons` (produz `Shot`/`Use`), `game-fluids`, `game-test-room` (carrega
`TestableModule`) e todo pacote de conteúdo (`-fleet`, `-household`, `-species`) que expõe um módulo.

## Ambiente de teste
`pnpm --filter @adatechnology/game-contracts test` (vitest: `contracts.test.ts`, `check-spec.test.ts`, `bench.test.ts`). Para ver um módulo funcionando, carregue-o
na sala com `room.loadModule`; o relatório devolvido usa estes mesmos verificadores.

## Cuidados
- `TestableItem.build`, `ModuleHost.THREE/scene/camera` são `unknown` de propósito (o pacote não depende de three.js): faça o cast no módulo.
- `DestructibleImpl.id` tem de ser o id que o host passa em `impl(root, id)`; eventos devem ter `object === id` e citar peças de `describe()`.
- `ModuleHost.on` e `onFrame` devolvem a função de cancelamento; `attach` deve devolver a que desfaz tudo.
- Id de módulo, item e clipe em snake_case; `checkAnimation` rejeita outro formato.
- `shotToHit` ignora `normal` (aceito só por compatibilidade).
- Eventos de ciclo da ferramenta têm nome genérico (`mode`, `fault`, `clear`, `safety`), nunca "jam"/"burst": servem a pistola de prego e a motosserra.
  `shot.shots` são projéteis; `shot.rounds`, cartuchos gastos.
- `ModuleMetric.read()` é puxado pela sala (~4 Hz, ou em `room.metrics()`): mantenha barato. `patch({ value })` não emite mudança.

## O que vem pela migração (spec 001)
Decisão E5 (feita na T0.2): o contrato do módulo de teste tem bancada (controles, camadas e contadores), base da bancada de efeitos que vira
módulo do `game-vfx`. Ainda por vir: os contratos de `game-characters` (dano por região usando o `Hit`); não use antes de existirem.
