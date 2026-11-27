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
