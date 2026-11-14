# Registro de decisão — arquitetura do motor físico (T1.4)

Estado: proposto em 2026-11-13, revisado por `architect` (ver `evidence.md`, T1.4). Herdado por toda a fase 2 em diante.
Base: `spec.md` (C1–C10, condições 1–10), `plan.md` D1–D3, código do spike em `spike/engine-jolt` (`game-physics`, `game-physics-jolt`,
`game-destruction-three/src/engine-*.ts`, `tests/setup-physics.ts`, `examples/test-room/build.mjs`), desenho `atrito-por-corpo.md`.

## 1. Camadas

```text
jogo / sala de teste ── cria o motor (await) e UM mundo, e o laço do passo
  └─ camadas de domínio (nossas): game-destruction, -floorplan-*, game-weapons, game-vfx, game-crowd, game-vehicles-driving, game-player
       └─ costuras por pacote (engine-*.ts): domínio → corpos, juntas, consultas; registradas no laço
            └─ @adatechnology/game-physics        contrato: tipos, constantes e helpers pequenos, sem motor
                 └─ @adatechnology/game-physics-jolt   adaptador: única dependência de jolt-physics
```

Regra: nenhum tipo do Jolt atravessa o contrato; nenhum pacote além do adaptador importa `jolt-physics`; nenhuma costura importa o adaptador
(recebe o mundo pronto). O `kit-audit` ganha a regra (T2.7).

## 2. Contrato final de `game-physics`

### 2.1 Fica (como está no spike, com tipos explícitos em todo export)

`Vec3`, `Quat`, `IDENTITY`, `ShapeDesc` (caixa, esfera, cápsula, cilindro, convexa, malha, height field, composto com `tag`), `Motion`,
`Layer`/`LAYERS`/`LAYER_PAIRS`, `Material`/`DEFAULT_MATERIAL`/`mixFriction`, `BodyDesc`, `Rolling`, `BodyId`/`JointId`/`VehicleId`/`RagdollId`,
`JointDesc`, `RagdollJoint`/`RagdollPart`/`RagdollDesc`, `WheelDesc`/`VehicleDesc`/`VehicleInput`, `RayHit`, `QueryFilter`, `ContactBuffer`,
`SensorEvent`, `WorldDesc`, `PhysicsWorld`, `PhysicsEngine`.

### 2.2 Muda ou entra

| Item | Decisão | Task |
|---|---|---|
| `penetration?` | deixa de ser opcional: a condição 6 (separar na criação) e o host dependem dele | T2.2 |
| `saveState()` / `restoreState(data)` | entram no `PhysicsWorld` (hoje só no adaptador): C8 e salvar jogo | T2.2 |
| `KIT_WORLD` | constante com os ajustes do mundo do kit (condições 1–3): passo 1/120, 20/2 iterações, sono 0,5 s a 0,08 m/s, slop 2 mm, push-out 2 mm, `slipSpeed` 2 cm/s. Jogo, sala e testes partem dela; o spike repete os números em três lugares | T2.2 |
| `ContactBuffer.dropped` | quantos contatos passaram de `maxContacts` no passo: dano e som não somem calados; teste exige 0 nos cenários do C7 | T2.2 |
| `PhysicsLoop` (seção 5) | helper pequeno: um laço por mundo, sistemas registrados por fase | T2.2 |
| controlador de personagem | `createCharacter(desc)` com tipos do contrato (hoje `JoltCharacter` só no adaptador) | T4.1 |
| `ignorePair` | fica até a T3.0c (regras antigas desligadas no modo Jolt); se nada mais usar, sai na T8.1 | T3.0c / T8.1 |

### 2.3 Sai do spike

- O gancho global `globalThis.__PIECE_PHYSICS__` (`pieces.ts:297`, `build.mjs`, `setup-physics.ts`): troca pela opção explícita da seção 3.
- "(spike)" nos comentários de cabeçalho e de pacote; `private: true` revisto (T2.3).
- As regras antigas do kit que compensavam colisor faltando (separar empurrando, recusa de movimento, levantar além da condição 6), no modo
  Jolt, na T3.0c. A rede `fellThrough` fica só como contador do C3b (tem de ficar em 0).

## 3. Um mundo por jogo, e quem o cria

- **O jogo (ou a sala) cria**: `const engine = await createJoltEngine()` no boot, antes de qualquer sistema que use física (C10), e então
  `engine.createWorld(KIT_WORLD)` uma vez, síncrono. Descarta ao sair (`world.dispose()`, condição 5).
- **Entrega explícita**: cada costura recebe o mundo (ou o laço, seção 5) por opção na criação — `createDestructionRenderer(THREE, { physics })`,
  e o mesmo para veículos, jogador, multidão e interativos. Nenhum sistema cria mundo próprio (condição 4: um mundo ≈ 19,7 MB do heap fixo de
  128 MB).
- **Sem troca no meio do jogo** (C10): a escolha do solver é feita uma vez, na criação. Até a T3.10, costura sem `physics` usa o solver
  próprio (`plan.md` D3); a chave `PIECE_SOLVER`/`?solver=own` decide se o boot da sala e o `setup-physics.ts` passam o mundo. Ambas saem na T8.1.
- **Testes**: `tests/setup-physics.ts` de cada pacote cria o motor uma vez por arquivo e entrega `physicsWorld()` (um mundo por teste, criado a
  partir de `KIT_WORLD` e das variáveis do C6: `JOLT_STEP`, `JOLT_ITERATIONS`, `JOLT_PUSHOUT`, `JOLT_SLOP`); `afterEach` descarta todos. O teto
  de quatro mundos vivos do spike fica como trava de segurança do heap.

## 4. Carga assíncrona

- `loadJolt()` carrega o wasm uma vez (promessa guardada); `createJoltEngine()` a reaproveita. A criação de mundo, corpos e o passo são
  síncronos.
- O navegador não compila um módulo desse tamanho de forma síncrona na thread principal: o boot espera o `await` antes do pacote da sala
  rodar (como o spike já faz em `build.mjs`), com o passo na tela de carregamento.
- Falha ao carregar o wasm é erro de boot (aparece na tela de carregamento); não há volta ao solver próprio em tempo de execução.

## 5. Ordem do passo: um laço por mundo

No spike cada `PieceSystem` chama `world.step(dt)` dentro do próprio `update`. Com o mundo compartilhado isso daria um passo por sistema por
quadro. **Decisão:** só o laço chama `world.step`.

```ts
interface PhysicsPhase {
  /** Antes do passo: alvos cinemáticos, entradas, forças. */
  beforeStep?(dt: number): void
  /** Depois do passo: eventos de contato, sensores, juntas quebradas, regras do §12. */
  afterStep?(dt: number): void
}
interface PhysicsLoop {
  readonly world: PhysicsWorld
  add(phase: PhysicsPhase, order: PhaseOrder): () => void
  step(dt: number): void
}
```

`PhaseOrder`, na ordem em que roda em cada quadro:

1. `crowd` — `game-crowd` simula; as cápsulas dos agentes recebem o alvo cinemático (`moveKinematic`).
2. `actors` — controladores de personagem, veículos (`driveVehicle`), itens segurados (cinemáticos), portas empurradas.
3. **`world.step(dt)`** — passos fixos de 1/120 dentro (o atrito por corpo e o rolamento rodam por passo fixo, `atrito-por-corpo.md` §6).
4. `contacts` — linhas de `contacts` viram `hit` do `game-destruction` (dano, fratura) e som; `sensorEvents` (fumaça); `brokenJoints`
   (interativos).
5. `rules` — regras do §12 que continuam nossas: `onBrokenChecked`, tombar em apoio estreito, orçamento de peças acordadas (`maxAwake`),
   cratera e chão que muda, contador `fellThrough`.
6. desenho — fora do laço: o quadro lê as poses e desenha.

Dentro da mesma fase, a ordem é a de registro (determinística). **Caso de um sistema só** (testes, demos): uma costura que recebeu um
`PhysicsWorld` em vez de um `PhysicsLoop` cria o próprio laço e o chama no seu `update(dt)`, como o spike faz hoje; o jogo, que passa o laço,
chama `loop.step(dt)` uma vez por quadro e os `update` das costuras só desenham e aplicam regras. Assim os ~400 testes de
`game-destruction-three` que chamam `renderer.update(dt)` continuam valendo.

## 6. Camadas (`Layer`) por sistema

| Camada | Quem | Encontra |
|---|---|---|
| `static` | casa, lote, rua, móveis fixos e alvos (malhas desenhadas), chão (height field + volume sólido), carro estacionado como corpo fixo | tudo menos `static`, `agent`, `sensor` |
| `debris` | peças soltas dos destroços, cápsulas, lascas | tudo, inclusive `agent` |
| `prop` | móveis empurrados, itens, granada, ragdolls e corpos-corrente | tudo |
| `character` | jogador e controladores | tudo menos `sensor` como corpo (sensor só reporta) |
| `agent` | cápsulas cinemáticas da multidão | `debris`, `prop`, `character`, `vehicle`, `sensor`; **não** entre si (o `game-crowd` separa) nem com `static` |
| `vehicle` | chassi de carro andando | tudo menos `sensor` como corpo |
| `sensor` | fumaça, gatilhos | só reporta entrada e saída; nunca é parceiro de atrito nem `touching` (`atrito-por-corpo.md` §5) |

A tabela é `LAYER_PAIRS`, sem mudança. Consultas rodam numa camada própria do adaptador que encontra tudo menos sensores.

## 7. `user` e `tag`

- `user` (int32) é o índice do host na sua tabela (peça, objeto, agente, veículo); volta em consultas e contatos.
- `tag` (int32) de um filho de composto é o **índice da parte** no objeto do host (`DestructibleImpl` parts, zona de dano do veículo); `-1`
  quando o corpo não é composto ou o filho não tem parte. O par `(user, tag)` identifica a parte atingida; o espaço de `tag` é por `user`.
- Zonas de dano do veículo são filhos marcados do composto do chassi (`spec.md` §4).

## 8. Contrato do chão

- **`groundAt` é só terreno**: solo, lote, rua, cratera. Nunca topo de móvel, piso da casa ou laje: esses são colisores das malhas desenhadas
  (`static`), e entrar nos dois criaria chão em dobro. Hoje `engine-ground.ts` diz "a table top" entre os degraus do `groundAt`: sai na T3.0a.
- **Topos e estruturas como malha desenhada**: caixa orientada por parte desenhada; malha triangular só onde caixa não serve. Nenhum colisor
  sem geometria, nenhuma geometria sem colisor (§12, T3.0a/T3.0b).
- **Chão sólido** (bug 3, T3.1): height field por ladrilho de 2 m mais volume sólido por baixo (caixas ou prismas convexos), sem fork; o chão
  que muda é trocado no mesmo corpo (`SetShape`), para o que está em cima manter o cache de contato.
- O kit continua dono de cavar e de quando o chão muda (`game-terrain`); a costura só reflete.

## 9. Eventos de contato para o dano

- Só contatos **novos** (`OnContactAdded`) que fecharam acima de `contactReportSpeed` viram linha no `ContactBuffer` (struct-of-arrays
  reaproveitado, `ROW_CAPACITY` 4096): corpos, `user`, `tag`, ponto, normal de a para b, velocidade de aproximação e impulso estimado
  (`(1 + e)·v / (1/m₁ + 1/m₂)`, sem rotação). Contato mantido não gera linha.
- A costura dos destroços (T7.4) converte as linhas em `hit` do `game-destruction` na fase `contacts`, **sem alocar por quadro** (tabelas
  reaproveitadas); o som de batida lê as mesmas linhas (goldens de áudio mudam no fim da fase 3).
- `contacts` vale para a chamada inteira de `step` (todos os passos fixos dela); `dropped` conta o que passou do teto.
- Despertar em massa (condição 10): o quadro em que uma ilha de ≥ 300 corpos acorda pode custar até 10 ms, uma vez por blast; reprova
  passar de 10 ms ou dois quadros seguidos acima de 6 ms.

## 10. Memória e determinismo

- Todo objeto do Jolt criado pelo adaptador é destruído por ele (`J.destroy`, `RemoveBody`/`DestroyBody`, `Release`); o mundo é descartado
  pelo dono; o listener de assert é destruído com o mundo. C9: heap no mesmo byte após ciclos (`heap.test.ts`).
- Uma thread, passo fixo, nenhuma aleatoriedade no adaptador, nenhum resultado dependente da ordem de `Map`. `saveState` leva os bytes do
  Jolt mais o estado do adaptador (atrito, parceiros, `accumulator`). C8 em Node, Chromium, Bun e Firefox.

## 11. Consequências

- T2.2 implementa 2.2, 2.3 (gancho global), `KIT_WORLD` e o `PhysicsLoop`; T2.5 cobre o descarte.
- Toda costura nova (fases 3–7) recebe `physics` por opção e se registra numa fase do laço; nenhuma chama `world.step`.
- O teste de boot da sala (C10) confere que o mundo existe antes do primeiro sistema e que só há um.
