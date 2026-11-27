# Integração das costuras novas na sala (TS.0)

> Desenho do `architect` (2026-11-26), Fase S da spec 008. As Fases 4 a 7 criaram as costuras no SDK (`createCrashParts`,
> `createRunOver`, `createAgentBodies`, `createDoorBodies`, `createCorpseBodies`, `createBlastQuery`, `RayBroadPhase`,
> `createEngineImpacts`), mas a sala e o preset ainda não as ligam: o carro da sala usa a colisão antiga. Esta fase liga tudo
> sem crescer o `room.ts` (§15) e sem citar o Jolt no contrato (§2).

## 1. Canal: a física chega ao módulo pelo host

- `ModuleHost` (`packages/game-contracts/src/module.ts`, depois de `pools?`) ganha `physics?: unknown` e
  `workers?: WorkerCoordinator`. `unknown` porque o contrato não depende do `game-physics`; o módulo confere com
  `isPhysicsServices`.
- `PhysicsServices` e `isPhysicsServices` moram no `game-physics`:

```ts
export interface PhysicsServices {
  readonly loop: PhysicsLoop
  readonly world: SeamWorld
  readonly blast: BlastQuery
  corpses(): CorpseBodies
  setInterest(interest: () => readonly Vec3[]): void
}
```

  Criados por `createPhysicsServices({ loop, budget? })`. Um laço por mundo; os cadáveres são um por mundo (o preset é dono
  do `interest`).
- O preset (`game-kit-defaults/src/world/physics-services.ts`, `servicesOf(physics)`) preenche `KitWorldPhysics.services`
  quando há laço. O `dispose` dos serviços roda antes do `physics.dispose()`.
- A sala repassa com `physicsHostOf(kit, workers)` em `packages/game-test-room/src/host-events.ts`, nas mesmas linhas do
  `room.ts` que já montam o host (zero linhas líquidas). Opção nova `workers?` em `createTestRoom`. `physicsHostOf` é
  exportado por `game-kit-defaults/world` para o jogo usar igual.
- Caminho `own` (`?solver=own`, `PIECE_SOLVER=own`): `host.physics` é `undefined` e cada costura mantém o comportamento
  antigo, até a T8.1.

## 2. Quem cria o quê

Cada módulo cria o que tem dono a partir de `services.loop`/`services.world` no `attach` e libera no `detach`/`onClear`
(§8): corpos de agentes, peças de batida, atropelamento, cápsulas, granada. A ordem de registro é a ordem determinística:
módulos registram na ordem fixa do preset.

## 3. PRs, em ordem

| PR | Tasks | Conteúdo |
|---|---|---|
| 1 | TS.1, TS.2, TS.3a | canal (`ModuleHost`, `PhysicsServices`, `servicesOf`, `physicsHostOf`); `hullPlanKind` em `KIT_WORKER_KINDS` (dep nova `game-kit-defaults` → `@adatechnology/game-vehicles-three/worker-kinds`); `rayBroadPhase` ligado quando `physics.loop !== null` (`KitWorldDebris` ganha `rayBroadPhase?`/`contactHits?`) |
| 2 | TS.4 | veículos: cascos método B e `createCrashParts` na sala; `CrashPartsOptions.world` estreita de `PhysicsWorld` para `SeamWorld` (sem cast) |
| 3 | TS.5 | armas: cápsulas e granada (`game-test-room/src/explosives.ts`) no motor |
| 4 | TS.6 | multidão e atropelamento (`createAgentBodies`, `createDoorBodies`, `createRunOver`); desligado com `hordeThread` |
| 5 | TS.7 | cadáveres: T5.4b/c/d (canal de instância, aplicador na sala, restaurar em mundo novo) |
| 6 | TS.8 | `contactHits` atrás de opção (medir o custo) e `blastQuery` |
| 7 | TS.9 | jogador: desenho próprio antes de implementar |
| 8 (opcional) | TS.10 | juntas na vitrine |

`createSensorVolumes` fica sem ligar até ter consumidor.

## 4. Testes

- `game-test-room/tests/physics-channel.test.ts`: o módulo recebe `PhysicsServices` no Jolt e `undefined` no `own`.
- `game-kit-defaults/tests/world-physics-services.test.ts`: serviços criados com laço, liberados antes do mundo.
- `workers.test.ts`: espera `WORKER_KIND_ID.VEHICLE_HULL_PLAN`.

## 5. Riscos

- Ordem de registro = determinismo: não registrar corpos fora da ordem do preset.
- `contactHits` custa por contato: medir na faixa `test:cost` antes de ligar por padrão.
- O pacote do worker cresce com o `hullPlanKind`.
- `room.ts` não pode crescer (5 259 linhas na main).

## 6. Chão e mundo estático para os corpos dos módulos

Motivo: o carro da sala (`physical-car.ts`) virou corpo dinâmico do motor (PR #530) e, no mundo de produção, não tinha chão embaixo e caía. O chão do motor só seguia os corpos do próprio `EnginePieces`.

Desenho (opção B):

- **Contrato** (`game-physics/src/contract.ts`, sem citar Jolt): `SeamWorld.readAwakeBounds(out: Float64Array, skip?: ReadonlySet<BodyId>): number`. Uma linha por corpo dinâmico acordado e por personagem: `kind, id, minX, minY, minZ, maxX, maxY, maxZ, vx, vz` (10 números). Devolve o total de linhas e escreve só o que cabe (quem chama cresce o buffer e relê). Kinemático fica fora. No solver `own` devolve 0 (documentado).
- **Adaptador** (`game-physics-jolt`): `GetActiveBodies` → tipo de movimento → `GetWorldSpaceBounds` + `GetLinearVelocity`, mais os personagens guardados; `skip` filtrado antes de chamar o Jolt; sem alocação por chamada.
- **Dono do chão** (`game-destruction-three/src/engine-ground-follow.ts`), chamado no `prepare` do `engine-pieces.ts` logo depois de `layBlastGround`. Para cada linha de fora (skip = `byBody`): caixa xz + `TILE_MARGIN`, varrida por `v·(dt + AHEAD_S)` com `AHEAD_S = 0,15 s`, passo de 1 ladrilho até `MAX_PATH_STOPS`, como no `groundOf`. Ladrilho que falta debaixo do corpo é feito na hora (`layAt`), mesmo com worker; o à frente vai ao worker (`askAt`); ladrilho plano continua `flatAt`.
- **Despejo**: ladrilho que nenhum corpo acordado pediu há 600 atualizações e sem corpo não estático em cima (`overlapShape` em camadas ≠ static) sai do mundo (§8 do `CLAUDE.md`).
- **Mundo estático**: conferir (a) malha > `STATIC_SPAN` (3 m) fica fora (`renderer.ts`); (b) mundo novo enche aos poucos (`VERTICES_PER_UPDATE`); (c) veículo registrado como fixo vira caixas estáticas (`hostedSolids`) que colidem com o próprio carro físico.
- `keepGround` não entra (sem consumidor).

## 7. Jogador no motor (TS.9)

### 7.1 Hoje
- Sala: `player.update(dt)` no `input` de cada quadro (`room.ts:3991`), colisão própria (`colliders`, `blockers`, `footing` em `room.ts:653`: `solidsNear` + raio p/ baixo), pulo `GRAVITY=13`/`JUMP=4.6` (`player.ts:148-149`), agachar só baixa o olho, `kickLight` (`room.ts:686`) chuta peças leves, nocaute desliza + `onSlam`. 3ª pessoa (`avatar.ts`) lê `player.position`/`drawnFeet`.
- Jogo: `game-player` já aceita `PlayerWorld.controller` (`player.ts:496`); `createPhysicsController` (`physics-controller.ts:35`), `beforeStep` em `actors`.
- Adaptador: `CharacterVirtual` não é corpo (carro/destroço/raio passam); `pushCharacter` ignora y; forma fixa; gravidade 9,81 fixa; `saveState` sem personagens.

### 7.2 Quem cria
- `game-player/src/walker.ts`: `createWalker(services, {position, collider, stepHeight,…})` — personagem em `services.world`, `services.loop.add(…,'actors')`; `setIntent(vx,vz)`, `jump()`, `setStance(s)`; `afterSteps` guarda pés anterior/atual; `drawn(alpha,out)`; `park()`/`unpark(at)` com `overlapShape`; `dispose()` (§8).
- Sala: ponto de troca `Locomotion` em `player.ts`: `own` (código atual, movido sem mudar) e `engine` (`game-test-room/src/player-body.ts`, usa `createWalker` com `host.physics`). `room.ts` não cresce.
- Jogo usa o mesmo `createWalker` (ou `createPhysicsController`).

### 7.3 Contrato (sem Jolt)
1. `pushCharacter` respeita `impulse[1]` (queda consumida pela gravidade); pulo = push vertical apoiado.
2. `setCharacterShape(id,{radius,halfHeight}): boolean` — false se penetra; posturas em cache: em pé 1,80 / agachado 1,20 / deitado 0,60.
3. `CharacterDesc.shadow?: Layer` + `characterBody(id)`: cápsula-sombra cinemática que segue o personagem (destroço, tiro, blastQuery, atropelamento a veem).
4. `CharacterDesc.gravity?` (9,81) + `readCharacterGround(id,out)` (normal, velocidade, user do chão).

### 7.4 Passo fixo (§15)
Tecla → intenção no `input`; andar no `beforeStep(h)`; câmera na fase `present`, pés = lerp(anterior, atual, alpha do agendador — não `loop.frame.alpha`, que o `stepFixed` zera); olhar imediato; `Float64Array(6)` fixo.

### 7.5 Comportamentos
- Degrau/rampa/escada: `stepHeight` = `STEP_UP`, `maxSlopeDegrees` 45; `stepLag` pela diferença de pés.
- Empurrar: força 400 N; `kickLight` desliga no `engine`. Empurrão com E segue a regra do game-player; medir força dobrada (senão `setCharacterStrength`).
- Ser empurrado: `knockOf` → `pushCharacter` com y.
- Nocaute: batida se andou < metade do pedido e v ≥ `SLAM_MIN_SPEED` → `onSlam('obstacle')`; voltar a ter apoio do ar → `onSlam('ground')`.
- Agachar/deitar: `setStance` + `setCharacterShape`; false mantém agachado.
- Sentar/voar/veículo: `park()`; sair: `unpark` porta → lado oposto → teto, conferindo com `overlapShape`.
- Blockers sem corpo: veto (volta aos pés anteriores) como ponte; TS.9l mede quantos.
- 1ª = 3ª pessoa: mesmo estado interpolado.

### 7.6 own / determinismo / custo
`own`: nada muda. Ordem fixa no preset; replay grava intenção por tique; save/restore inclui personagens. Custo ~1/50 do limite (≤ 0,5 ms/50 personagens).

### 7.7 Tasks
| TS.9a | haiku | push y + gravity? | jolt test character: pulo v²/2g ±2 cm |
| TS.9b | sonnet | setCharacterShape | agacha sob barra 1,3 m; false ao levantar |
| TS.9c | sonnet | shadow/characterBody | tábua quica na sombra; carro atravessa (se agent); overlapShape acha |
| TS.9d | sonnet | readCharacterGround | plataforma móvel: velocidade bate |
| TS.9e | sonnet | personagens no saveState | salvar→2 s→restaurar→2 s bytes iguais |
| TS.9f | sonnet | createWalker | game-player test walker |
| TS.9g | sonnet | Locomotion na sala (só mover) | game-test-room test sem diff; room.ts ≤ 5259 |
| TS.9h | sonnet | player-body engine | physics-channel: own nada muda; Jolt cria e libera |
| TS.9i | sonnet | nocaute/batida | onSlam obstacle/ground |
| TS.9j | sonnet | park/unpark | saída bloqueada → teto, sem penetrar |
| TS.9k | haiku | avatar lê drawn | estado do avatar = drawn |
| TS.9l | sonnet | paridade de bloqueio own×engine | lista blockers sem corpo, falha se crescer |
| TS.9m | haiku | custo | test:cost 1 jogador + 200 corpos ≤ 0,05 ms mediana |
| TS.9n | à mão (§9) | check:room prints 1ª/3ª | shots/ |

### 7.8 Riscos
- Binding JS pode não expor `GetInnerBodyID` → sombra como corpo cinemático do adaptador com `moveKinematic` + filtro.
- 🧠 Gravidade do pulo (dono).
- 🧠 Camada da sombra (dono).
- Blockers sem corpo; empurrão duplo; latência de 1 tique; horda trava o jogador (sensação, dono vê no check:room).
- Seção 6: `readAwakeBounds` precisa incluir o personagem/sombra.

### Decisões do dono (2026-11-27)
- Pulo: gravidade real 9,81 e impulso 3,99 m/s (mesma altura de 0,81 m).
- Sombra do jogador na camada `agent` (carro não para nele; atropelamento igual ao dos agentes).
