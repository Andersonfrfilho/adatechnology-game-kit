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
