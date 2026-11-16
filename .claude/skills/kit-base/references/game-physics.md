# @adatechnology/game-physics

Contrato de corpos rígidos do kit: corpos, formas, juntas, ragdolls, veículos, materiais, contatos, sono, raycast e o laço de passo fixo.
Só tipos e pequenos auxiliares. Não simula nada e não conhece motor: quem simula é o adaptador (`game-physics-jolt`).

API, uso e exemplos: `packages/game-physics/README.md`; campos e unidades em `packages/game-physics/src/index.ts`.

## Quando usar

- Um sistema precisa de corpo, forma, junta, ragdoll, veículo ou sensor: importe os tipos daqui (`BodyDesc`, `ShapeDesc`, `JointDesc`,
  `RagdollDesc`, `VehicleDesc`) e nunca importe o adaptador.
- Um jogo ou uma sala precisa do passo do mundo: `createPhysicsLoop(world)` dá o laço.
- Um pacote de domínio (destruição, veículos, multidão) recebe o mundo por opção: o tipo dele é `SeamWorld`.

## Quem é dono de quê

| Peça | Dono |
|---|---|
| Tipos da descrição (`BodyDesc`, `ShapeDesc`, `JointDesc`, `RagdollDesc`, `VehicleDesc`, `WorldDesc`) | este pacote |
| `PhysicsEngine`, `PhysicsWorld`, `SeamWorld` | este pacote (`SeamWorld` é o mundo sem `step`, `stepFixed`, `clearEvents`, `dispose` e as chamadas de save) |
| `KIT_WORLD` (passo de 120 Hz, passes do solver, limites de sono e de push-out) e `KIT_RAGDOLL_SOLVER` | este pacote |
| Materiais: `Material`, `DEFAULT_MATERIAL`, `mixFriction` (atrito de Coulomb estático e dinâmico, restituição, mistura por média geométrica) | este pacote |
| Camadas: `LAYERS`, `LAYER_PAIRS`, `Layer` | este pacote |
| `createPhysicsLoop`, `isPhysicsLoop`, `PhysicsLoop`, `PhysicsPhase`, `PhysicsFrame`, `PhaseOrder` | este pacote |
| Massa e forma de cada peça do jogo | o pacote de domínio (`game-destruction`, `game-vehicles`, ...) |
| Motor (Jolt), memória do motor, passo real | `game-physics-jolt` |

Regra: os pacotes de domínio dependem só deste pacote e recebem um `SeamWorld`. Nenhum deles importa o adaptador.

## Laço de passo fixo

- Um laço por mundo (`createPhysicsLoop` guarda o acumulador de tempo). Um segundo laço no mesmo mundo lança erro: dois sistemas nunca
  passam o mundo duas vezes.
- Fases (`PhaseOrder`): `crowd` e `actors` rodam antes de cada passo fixo; `contacts` e `rules` rodam uma vez por quadro, depois dos passos.
- `loop.add(phase, order)` devolve a função que tira a fase de volta.
- Na fase `beforeStep` use `h` (o passo fixo), nunca o `dt` do quadro.

## Como uma costura recebe a física

Toda costura que simula ou consulta corpos recebe `physics: PhysicsLoop | SeamWorld | 'own'`, escolhido uma vez, na criação. Ausente
lança erro (não cai calado no solver próprio). O resolvedor fica em `game-destruction-three/src/physics-option.ts`:

- `PhysicsLoop`: o hospedeiro passa o laço e dá o passo; a costura só registra fases.
- Mundo (com `stepFixed`): a costura faz o próprio laço e o passa dentro do seu `update`. Passar um mundo sem `stepFixed` lança erro.
- `'own'`: o solver próprio do kit, até ele sair.

Desenho: `specs/008-motor-fisico-jolt/design/arquitetura.md` (seções 3 e 5).

## Cuidados

- Unidades: metros, quilogramas, segundos; y para cima.
- A forma do corpo é a do desenho: a costura não cria colisor sem geometria (`CLAUDE.md` §12).
- Atrito e rolamento de cada corpo são do corpo, não do par: ver `game-physics-jolt` e `specs/008-motor-fisico-jolt/design/atrito-por-corpo.md`.

## Ambiente de teste

Não há testes próprios neste pacote (só tipos e o laço); os testes que rodam o contrato com o motor ficam em `packages/game-physics-jolt/tests/`.

## Despertar em lotes e custo (D4, spec 008)
- `WakeQueue` (despertar de entulho em lotes, mais perto do jogador primeiro, limitada) e `PhysicsCostMeter` (custo por corpo acordado, suavizado de `PhysicsFrame.stepMs` ÷ `world.activeCount`). Todo número é opção; padrões medidos: `DEFAULT_WAKE_COST_TARGET_MS` 4, `DEFAULT_MAX_WAKE_DELAY` 0,08 s, `DEFAULT_MAX_QUEUED_WAKES` 2048, `DEFAULT_MIN_WAKES_PER_FRAME` 8, `DEFAULT_PHYSICS_COST_PER_BODY_MS` 0,0022, `DEFAULT_WAKE_COST_PER_BODY_MS` 0,02, `DEFAULT_MIN/MAX_PHYSICS_PIECES` 24/300, `DEFAULT_PHYSICS_COST_TARGET_MS` 5, `DEFAULT_CHIP_SIZE` 0,15 m. `physicsPieceCount` e `chooseForPhysics` escolhem quantas e quais peças do blast viram corpo. `WakeQueue` e `PhysicsCostMeter` têm `saveState`/`restoreState` (e o medidor `reset`) para salvar e carregar bit a bit; o custo medido pelo relógio faz a simulação depender da máquina: o determinismo (C8) pede `debrisCost: { source: 'fixed' }` no renderer.
- `WorkBudget` e `WorkQueue` (T3.8aa): orçamento do quadro em **unidades de trabalho**, nunca em tempo (`budgetMs` × `unitsPerMs` / `tier`; padrões 4 ms, 100 unidades por ms, 30 quadros de espera máxima), um árbitro só de que todas as filas tiram em ordem fixa (`WORK_KINDS`: evento, corte, fragmento, ajuste antecipado, chão, corpo, despertar). `WorkQueue` guarda dados (prioridade, chave estável, unidades), solta o que cabe, pelo menos um por quadro, e o que esperou `maxWaitFrames` sai de qualquer jeito; os dois salvam e carregam. `WakeQueue.release` aceita `limit` (o que o orçamento deixa).
- `PhysicsFrame.stepMs`: milissegundos dos passos fixos do último quadro.
- `velocityIterations` é opção do mundo; padrão do `KIT_WORLD` 32 (decisão do dono, 2026-11-14).

