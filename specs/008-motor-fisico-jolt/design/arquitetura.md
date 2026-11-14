# Registro de decisão — arquitetura do motor físico (T1.4)

Estado: aceito em 2026-11-13, revisado por `architect` (APPROVE WITH CHANGES, as 11 mudanças aplicadas; ver `evidence.md`, T1.4). Herdado por toda a fase 2 em diante.
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
| `saveState()` / `restoreState(data)` | entram no `PhysicsWorld` (hoje só no adaptador), com o escopo da seção 10 | T2.2 |
| `KIT_WORLD` | constante com os ajustes do mundo do kit (condições 1–3): passo 1/120, 20/2 iterações, sono 0,5 s a 0,08 m/s, slop 2 mm, push-out 2 mm, `slipSpeed` 2 cm/s, `contactReportSpeed`, `maxContacts` e `maxBodies` (o spike usa 4096 nos testes e 8192 na sala: um valor só). Jogo, sala e testes partem dela | T2.2 |
| `KIT_RAGDOLL_SOLVER` | constante dos 20/8 passes de ragdoll (condição 2) | T2.2 |
| `ContactBuffer.dropped` | linhas que passaram de `maxContacts` no passo, contadas **depois** do filtro de velocidade (só o que viraria linha): dano e som não somem calados; teste exige 0 nos cenários do C7 | T2.2 |
| `has(id)` | o corpo ainda existe (seção 9: linhas de contato podem citar corpo removido) | T2.2 |
| `jointAngles(id)` | já prometido no comentário do contrato e só no adaptador: o ragdoll precisa (fase 5) | T2.2 |
| `wheelContacts(id)` | só no adaptador hoje: a regra de sono do carro precisa (fase 6) | T2.2 |
| junta `slider` | gaveta e corrediça (`spec.md` §3); `JointDesc` só tem fixa, dobradiça e swing-twist | T2.2 (tipo), T4.4 (uso) |
| `tag` = −1 de verdade | hoje filho sem `tag` vira `0` (`shapes.ts:42`), forma simples devolve 0, e a leitura devolve o `uint32` cru (−1 viraria 4294967295, `queries.ts:30`): `child.tag ?? -1`, −1 nas formas simples, leitura com `\| 0` | T2.2 |
| `PhysicsLoop` e `SeamWorld` (seção 5) | um laço por mundo, sistemas registrados por fase; as costuras recebem `SeamWorld = Omit<PhysicsWorld, 'step' \| 'dispose' \| 'saveState' \| 'restoreState'>` | T2.2 |
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
- **Sem troca no meio do jogo** (C10): a escolha do solver é feita uma vez, na criação, e é **explícita**: `physics: PhysicsLoop |
  SeamWorld | 'own'`. Deixar a opção de fora dá erro (não cai calado no solver próprio). Até a T3.10, `'own'` é o padrão de produção pedido
  pelo `plan.md` D3, escrito por quem cria; a chave `PIECE_SOLVER`/`?solver=own` decide o que o boot da sala e o helper de teste passam.
  Ambas saem na T8.1. Todos os pontos de criação (69 `createDestructionRenderer(` e 10 `new PieceSystem(` nos testes de
  `game-destruction-three`, os de `game-floorplan-three`, `room.ts:450`) passam por um helper de teste, para mudar num lugar só.
- **Testes**: `tests/setup-physics.ts` de cada pacote cria o motor uma vez por arquivo e entrega `physicsWorld()` (um mundo **novo a cada
  chamada**, a partir de `KIT_WORLD` e das variáveis do C6: `JOLT_STEP`, `JOLT_ITERATIONS`, `JOLT_PUSHOUT`, `JOLT_SLOP`) e
  `physicsLoop()` (modo do jogo, seção 5); `afterEach` descarta todos. O teto de quatro mundos vivos do spike fica como trava do heap.
  `game-floorplan-three` ganha o seu `setup-physics.ts` (os goldens do D4 dependem dele).

## 4. Carga assíncrona

- `loadJolt()` carrega o wasm uma vez (promessa guardada); `createJoltEngine()` a reaproveita. A criação de mundo, corpos e o passo são
  síncronos.
- O navegador não compila um módulo desse tamanho de forma síncrona na thread principal: o boot espera o `await` antes do pacote da sala
  rodar (como o spike já faz em `build.mjs`), com o passo na tela de carregamento.
- Falha ao carregar o wasm é erro de boot (aparece na tela de carregamento); não há volta ao solver próprio em tempo de execução.

## 5. Ordem do passo: um laço por mundo

No spike cada `PieceSystem` chama `world.step(dt)` dentro do próprio `update`. Com o mundo compartilhado isso daria um passo por sistema por
quadro, e cada `step` limpa `contacts`, `sensorEvents` e `brokenJoints` (`world.ts:589-591`): um sistema apagaria os eventos do outro.
**Decisão:** só o laço dá o passo, e o laço é dono do acumulador.

```ts
interface PhysicsFrame {
  /** Tempo do laço (s), somado por passo fixo. */
  readonly time: number
  /** Passos fixos que este quadro rodou (0 num quadro curto: as fases `contacts` e `rules` não agem sobre eventos velhos). */
  readonly steps: number
  /** Fração do passo que sobrou, para interpolar poses no desenho. */
  readonly alpha: number
}
interface PhysicsPhase {
  /** Antes de cada passo fixo `h`: alvos cinemáticos, controladores, entradas, forças. */
  beforeStep?(h: number, frame: PhysicsFrame): void
  /** Uma vez por quadro, depois dos passos: eventos de contato do quadro inteiro, sensores, juntas quebradas, regras do §12. */
  afterSteps?(dt: number, frame: PhysicsFrame): void
}
interface PhysicsLoop {
  readonly world: SeamWorld
  readonly frame: PhysicsFrame
  add(phase: PhysicsPhase, order: PhaseOrder): () => void
  /** `dt` limitado a `maxDt` (0,1 s): uma aba que volta depois de 5 s não roda 600 passos num quadro. */
  step(dt: number): void
}
```

- `createPhysicsLoop(world)` recusa um segundo laço para o mesmo mundo (`WeakSet`): dois sistemas que recebam o mesmo mundo não dão dois
  passos. As costuras recebem `SeamWorld` (sem `step`, `dispose`, `saveState`, `restoreState`): o TypeScript garante que nenhuma chama o passo.
- O laço chama, por passo fixo `h` (1/120): todos os `beforeStep(h)` → `world.step(h)`. O mundo deixa de limpar eventos a cada `step`; o laço
  chama `world.clearEvents()` no começo do quadro, e `contacts`, `sensorEvents`, `brokenJoints` cobrem o quadro inteiro.
- **Cinemáticos e personagens andam por passo fixo**: `moveKinematic(id, alvo, h)` e o `CharacterVirtual` rodam em `beforeStep(h)`, nunca com
  o `dt` do quadro (a 144 Hz, com passo de 1/120, alguns quadros rodam 0 passos e outros 1: o alvo com `dt` do quadro faria o agente passar ou
  ficar e empurrar destroço com a velocidade errada).
- As fases recebem o `dt` já limitado; em modo laço, nenhuma costura limita o seu (hoje `renderer.update` limita a 0,1 por conta própria,
  `renderer.ts:914`; passa a ler o do laço).

`PhaseOrder`, na ordem em que roda:

1. `crowd` (por passo) — as cápsulas dos agentes recebem o alvo cinemático do `game-crowd`. A simulação do `game-crowd` roda no seu ritmo,
   antes do quadro.
2. `actors` (por passo) — controladores de personagem, veículos (`driveVehicle`), itens segurados (cinemáticos), portas empurradas.
3. **passos fixos** — `world.step(h)` (atrito por corpo e rolamento por passo fixo, `atrito-por-corpo.md` §6).
4. `contacts` (por quadro) — linhas de `contacts` viram `hit` do `game-destruction` (dano, fratura) e som; `sensorEvents` (fumaça);
   `brokenJoints` (interativos).
5. `rules` (por quadro) — regras do §12 que continuam nossas: `onBrokenChecked`, tombar em apoio estreito, orçamento de peças acordadas
   (`maxAwake`), cratera e chão que muda, contador `fellThrough`.
6. desenho — fora do laço, com `alpha` para interpolar.

Dentro da mesma fase, a ordem é a de registro. Isso só é determinístico se o carregamento também for (casas e áreas carregadas sempre na mesma
ordem): o jogo carrega em ordem fixa.

**Dois modos, os dois testados.** Uma costura que recebeu `SeamWorld` cria o próprio laço e o chama no seu `update(dt)` (modo de um sistema,
como o spike: sincroniza, passo, lê de volta, regras). Uma costura que recebeu `PhysicsLoop` só registra fases; o jogo chama
`loop.step(dt)` e depois os `update(dt)` das costuras, que desenham. A ordem muda entre os dois (hoje `renderer.update` roda `checkBroken`,
`settlement` e `drainQueue` antes do passo e fragmentos e chão depois, `renderer.ts:912-933`). Por isso:
- `setup-physics.ts` dá também `tick(dt)` em modo laço (`loop.step(dt)` e então `renderer.update(dt)`);
- no mínimo os testes do C5 e o `audio.test.ts` rodam nos dois modos;
- o C8 (determinismo) e a sala medem o modo laço, que é o do jogo.

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
  quando o corpo não é composto ou o filho não tem parte. Hoje o adaptador grava 0 nesses casos e devolve o `uint32` cru: corrigido na T2.2
  (seção 2.2). O par `(user, tag)` identifica a parte atingida; o espaço de `tag` é por `user`.
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
- `contacts` vale para o quadro inteiro (o laço limpa no começo do quadro, seção 5); `dropped` conta o que passou do teto, depois do filtro de
  velocidade.
- **Corpo removido durante a fase `contacts`**: um contato vira golpe, o golpe fratura e a fratura chama `removeBody`/`setShape`; as linhas
  seguintes ainda citam o corpo. Regra: linhas podem citar corpo removido; quem lê confere com `has(id)` antes de usar; mudanças de corpo feitas
  na fase `contacts` valem a partir do próximo passo.
- **Esmagamento contínuo não gera linha**: laje que assenta sobre uma peça que já tocava não é contato novo. Carga parada continua no caminho de
  carga do `game-destruction`, não no evento de contato.
- Despertar em massa (condição 10): o quadro em que uma ilha de ≥ 300 corpos acorda pode custar até 10 ms, uma vez por blast; reprova
  passar de 10 ms ou dois quadros seguidos acima de 6 ms.

## 10. Memória e determinismo

- Todo objeto do Jolt criado pelo adaptador é destruído por ele (`J.destroy`, `RemoveBody`/`DestroyBody`, `Release`); o mundo é descartado
  pelo dono; o listener de assert é destruído com o mundo. C9: heap no mesmo byte após ciclos (`heap.test.ts`).
- Uma thread, passo fixo, nenhuma aleatoriedade no adaptador, nenhum resultado dependente da ordem de `Map`. C8 em Node, Chromium, Bun e
  Firefox, medido em modo laço.
- **Escopo de `saveState`/`restoreState`:** o `SaveState` do Jolt não registra **quais** corpos, juntas e veículos existem; só o estado de um
  mundo com os mesmos corpos, criados na mesma ordem. Logo: restaurar exige que o host recrie os mesmos corpos na mesma ordem; salvar o jogo é
  a descrição do host mais os bytes do mundo. Os bytes levam também o que o adaptador guarda e muda o contato: atrito, parceiros, `accumulator`,
  pares ignorados (`ignored`, enquanto existir), rolamento (`rollers`) e `stepCount`, e os mapas são gravados em ordem de chave (para salvar →
  restaurar → salvar dar os mesmos bytes). O teste bit a bit do C8 compara poses, ou a ida e volta salvar → restaurar → salvar, nunca bytes
  depois de qualquer restauração.

## 11. Decisões deixadas para a task dona

- **Corpo do personagem** (T4.1): o `CharacterVirtual` não tem corpo; destroço o atravessa e não gera linha de contato. Decidir se ganha corpo
  interno (`mInnerBodyShape`) na camada `character`.
- **Saída do sensor quando o corpo some**: hoje `OnContactRemoved` procura a entrada depois do `forget`, e a fumaça não avisa a saída (T7.3).
- **`QueryFilter.exclude`** para o atirador ou o carro pularem o próprio corpo (T6/T7.2).
- **Chão sólido num corpo só ou em dois** (T3.1): não verificado se o Jolt aceita height field dentro de composto estático. Se não, o chão são
  dois corpos e a troca no lugar vale só para o height field.

## 12. Consequências

- T2.2 implementa 2.2, 2.3 (gancho global), `KIT_WORLD`, `PhysicsLoop`/`SeamWorld`, `clearEvents`, a opção explícita e o helper de teste;
  T2.5 cobre o descarte.
- Toda costura nova (fases 3–7) recebe `physics` por opção e se registra numa fase do laço; nenhuma chama `world.step`.
- O teste de boot da sala (C10) confere que o mundo existe antes do primeiro sistema e que só há um.
