# Desenho T4b.1 — Horda densa e reação em cadeia (D10, D11, D12)

Escrito em 2026-10-31 a partir do código de hoje (`game-crowd` 0.2.6). Fecha os pontos da T4b.1 do `tasks.md` e é a entrada das
T4b.2 a T4b.10. Os identificadores são em inglês; os números são padrões de opção, ajustáveis por jogo (CLAUDE.md §2).

## Revisão 2 (2026-10-31)

Segunda passada do `architect` (APPROVE WITH CHANGES). Números refeitos por script a partir das fórmulas deste documento:

| Item | O que mudou | Seção |
|---|---|---|
| H-a | Com `frontCone` 0,5, o peso a ±30° é `w = (0,866 − 0,5)/0,5 = 0,732`, e o τ efetivo do hexágono é `0,97·0,732 = 0,710` (não 0,84): o limite plano é `250/0,290 = 862 N`, abaixo do `P_crit` do walker (1372 N). `frontCone` fica em 0,5; muro plano não derruba walker por pressão, só a **fila indiana** (N ≥ 6) e o **funil da porta** (fileiras 1 a 4). Recorrência, tabela do funil e faixa de quedas refeitas; a faixa passa de 2–25% para **1–16%** | §4.5, §5.2, §6.5, §13.1, §13.2, §15 |
| H-b | Escolhido: quem cambaleia **continua empurrando com a força inteira**; `staggerDrive` vira `staggerSpeed` e só reduz a velocidade de vontade. O campo fica linear e as contas da coluna valem sem ponto fixo. Tabela "N em fila" refeita (brute: nunca, pelo teto; devourer com walkers: 8) | §4.5, §5.1, §13.2 |
| H-c | `createBodyMaterial` não tem `customProgramCacheKey` (`body-material.ts:18-48`); a chave padrão é `onBeforeCompile.toString()`, igual com e sem o `BODY_CHUNK_EXT`. Passa a sobrescrever a chave **só** com `identity`/`segmentClips` | §10.3 |
| H-d | `instanced-runtime.test.ts:47` lê `batch.mesh.count`: o `Mesh` ganha um `count` espelhado em `geometry.instanceCount`, e o teste não muda. A troca `InstancedMesh` → `Mesh` **muda** a chave do programa (sem `USE_INSTANCING`) mesmo sem opção; inofensivo para os goldens (Node), mas a troca entra **antes** do registro da horda no `ProgramWarmup` (T4.6) | §10.3, §15 |
| H-e | Remoção do último (`i === j`): só a vaga vira corpo carregado, sem remapear | §7.3 |
| H-pool | Prioridade do pool vira opção (`thrown.priority`, padrão `'fastest'`), com a mudança visível registrada no `plan.md` D10 | §7.2, §7.3, `plan.md` D10 |

## Revisão 2026-10-31

Revisão do `architect` (opus, conferida contra o código): **aprovado com mudanças**. Todas aplicadas; os números foram conferidos de
novo no código (`game-crowd/src/crowd.ts`, `game-crowd-three/src/renderer.ts`, `game-characters-three/src/instanced/*`,
`game-contracts/src/blast-shove.ts`).

| # | Mudança pedida | Onde está |
|---|---|---|
| 1 | Pressão: o solver de contato não acumula força de coluna. Campo de pressão separado, um salto por passo, sem `μ|δ|/h²`; teste da coluna de N; meta de 2–25% refeita | §4.5 (campo), §5.1–5.2 (`criticalFactor` 2,0), §13.2 (testes "Coluna", "Espremidos") |
| 2 | Viés de ordem: Gauss-Seidel simétrico (ida e volta), `δ` de Jacobi dividido pelo número de contatos, teste de ordem de nascimento | §4.3, §12, §13.1 ("Ordem de nascimento") |
| 3 | Cenas de teste: centro da faixa perto da fila, entrada na R0 abaixo de 25 m, fila comprimida contra um muro, `fallsBeyondBlast` causal, números de aceite realistas | §12 (`CrowdUpdateContext.bandCentre`, contador), §7.2 (raios da m67), §13.1 |
| 4 | Atributos de vértice: hoje 6 + 4 (`instanceMatrix`) + 5 = 15 de 16. Lote vira `Mesh` + `InstancedBufferGeometry`; teste de `MAX_VERTEX_ATTRIBS` já | §10.3, §15 |
| 5 | `BODY_CHUNK` intacto byte a byte; código novo num segundo trecho com `USE_IDENTITY` e `USE_SEGMENT_CLIPS`; `instanced.test.ts` na lista do que não muda | §2, §10.3, §15, Aceite |
| 6 | Pool de arremessados: remapear na remoção (troca com o último), arremessado fora da integração, da gravidade, da separação e da grade; varredura célula a célula | §7.3 |
| 7 | 12 ossos, 24 texels; mapa de 17 segmentos para 12 ossos no `bakeSegmentClips` | §11.1.3 |
| 8 | Acessórios: pivôs diferentes por variante (`s`, `bulk`). Decidido: atributo próprio do lote de acessório, sem chamada a mais | §10.3 |
| 9 | Espalhamento de fase: limiar que fases independentes atingem. Decidido: fases independentes, `1 − R ≥ 0,25` em 99% | §13.3 |
| 10 | Teto de velocidade com a separação; energia com massa efetiva dos caídos; `crowd.damage` sorteia `R()` | §4.4, §7.2, §0 (decisão 2) |
| 11 | `crowd_area` no `fixedSimulate`; ordem do estado da bancada; assar todos os tipos antes de medir; linha de base de hoje antes dos orçamentos; 40 vizinhos numa compressão; Worker como saída | §14, §15 |
| 12 | `tasks.md` Fase 4b (T4b.2 passada linear; T4b.3 pool simulado no `game-crowd`; elos contados em passos) e `plan.md` D10; "agressividade" na personalidade | `tasks.md` Fase 4b, `plan.md` D10 e D11, §10.2 |
| — | Soma do monte depende de ordem; texturas RGBA32F com `NearestFilter`; hash do `unit()`; civis e passe de sombra no teto de chamadas | §6 (milímetros inteiros), §11.1.3, §10.1, §10.3 |

## 0. Decisões em uma página

| # | Decisão | Por quê |
|---|---|---|
| 1 | Tudo novo fica atrás de `CrowdOptions.physics`. Sem a opção, o código passa pelo mesmo caminho de hoje, sem nenhum sorteio a mais em `random` | Os goldens (`game-crowd.json`, civis, manada) reproduzem o jogo dos times quadro a quadro e precisam continuar idênticos bit a bit |
| 2 | Recursos novos nunca sorteiam do fluxo `random` compartilhado. Eles usam um hash por contador: `unit(identity, step, salt)`. O `crowd.damage` de hoje sorteia `R()` (mandíbula, `crowd.ts` 599); o caminho da física chama um `damage` interno que recebe o sorteio por parâmetro (`draw = () => unit(id, step, SALT_JAW)`). O `damage` público continua com `R()` | O fluxo `random` segue a ordem do jogo. Um sorteio a mais desloca todos os seguintes |
| 3 | A horda roda no `fixedSimulate` do `game-runtime`, com passo fixo `h = 1/60` s. O desenho interpola com o `alpha` do agendador | Só assim a mesma semente dá o mesmo resultado a 30, 60 e 144 fps |
| 4 | O contato é física de posição 2D sobre discos. Um impulso de empurrão por agente (`pushX`, `pushZ`) fica separado da velocidade de vontade (`vx`, `vz`) | A vontade continua sendo a do jogo; o empurrão é física e pode ser amortecido, limitado e provado |
| 5 | Impulso normal inelástico (Gauss-Seidel simétrico: ida em ordem de índice, volta em ordem inversa) mais correção de posição separada (Jacobi, ω = 0,5, dividida pelo número de contatos), em 2 iterações por passo | O impulso inelástico nunca aumenta a energia. A ida e volta tira o viés de ordem. A correção de posição não volta para a velocidade, então também não cria energia |
| 6 | A separação de hoje fica como está: ela é a vontade de não encostar. O contato só age abaixo de `0,25·build` de raio, dentro do raio da separação | Não há conflito entre as duas. Com a opção desligada nada muda |
| 7 | O equilíbrio é uma máquina própria (`balance`), separada de `state`: em pé → cambaleando → caído → levantando, e arremessado | A máquina de comportamento do jogo (e o golden dela) fica intacta |
| 8 | A pressão é um **campo à parte** do contato: cada agente recebe a própria força de vontade (`driveForce`) mais a parte da pressão de quem está atrás dele, do passo anterior (um salto por passo, Jacobi). Média exponencial; limiar crítico pela massa, pelo tipo e pela personalidade | O solver de contato não acumula força de coluna. O campo dá `N·driveForce` numa fila de N, sem viés de ordem. Uma fila de seis walkers derruba; um empurrão leve nunca; um bloco hexagonal contra um muro plano também não (862 N, §4.5): a queda por pressão vem da fila indiana e do funil da porta |
| 9 | O monte é um campo de alturas por célula da grade de navegação (`mound`), recalculado do zero a cada passo, somado em **milímetros inteiros** | Soma de inteiros é associativa: não depende de ordem. O desabamento sai sozinho: a base sai, a altura cai e a gravidade de `frame()` derruba quem estava em cima |
| 10 | `crowd.blast()` entra numa fila e é resolvido no começo do passo fixo seguinte, numa passada só sobre os agentes (todas as explosões daquele passo juntas). O empurrão usa o `blastShove` do `game-contracts` | Resolver no passo é determinístico. A mesma regra de empurrão já move os itens e os móveis da sala |
| 11 | O pool de arremessados (32) **simula** no `game-crowd` (arco, pouso que derruba outros) e é **desenhado** como instância comum do lote, com pose e tombo por atributo. O `game-crowd-three` só desenha | O pouso faz parte da cadeia, então precisa ser determinístico. Desenhar como instância não acrescenta chamada de desenho |
| 12 | Elos da cadeia de explosões: no máximo `chainLinksPerUpdate` (padrão 1) detonações de simulação por passo fixo, no `game-destruction`. Só a **apresentação** (efeito, luz, decalque, som) passa pelo `scheduler.budget` | O orçamento do agendador é medido em relógio de parede, e nada que mude a simulação pode depender dele |
| 13 | A variedade sai de uma `identity` por agente (hash de semente e número de série). Os eixos novos vão num atributo `iD` (vec4). Os acessórios são lotes por tipo de acessório, com o pivô da variante num atributo próprio | Zero chamada de desenho a mais por eixo de variedade. A identidade é a mesma em todo nível de detalhe e no impostor |
| 14 | O degrau 3 da D12 vira "clipes de segmentos em textura": 12 ossos × quadros (24 texels por quadro), uma textura para todos os lotes, lida pelo mesmo `bone` da geometria assada | O corpo instanciado já é animado por osso no shader; gravar a posição de cada vértice em textura seria caro e não serviria aos 20 corpos assados |
| 15 | O lote do corpo deixa de ser `InstancedMesh` e vira `Mesh` com `InstancedBufferGeometry` (`instanceCount`) | A `instanceMatrix` ocupa 4 dos 16 atributos e não é usada (a posição vem do `iA`). Sobra espaço para o `iD` com folga |
| 16 | O `BODY_CHUNK` fica igual byte a byte. O código novo do shader vai num segundo trecho, `BODY_CHUNK_EXT`, com `#ifdef USE_IDENTITY` e `#ifdef USE_SEGMENT_CLIPS`, ligado só quando o material recebe a opção | O teste de sha-256 do trecho do jogo (`instanced.test.ts`) continua valendo sem mudança |

## 1. O que já existe e é reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| Struct of arrays, capacidade 6000, `AGENT_FIELDS` | `game-crowd/src/store.ts` | Ganha os campos da §4.1, todos em `AGENT_FIELDS` (a remoção troca com o último) |
| Grade espacial de 1 m (`hHead`, `hNext`) só para a faixa R0 (até 35 m) | `crowd.ts` 991-1001 | O contato consulta a célula e as 8 em volta |
| Separação `0,31·(bᵢ+bⱼ)`, empurrão 2,2, a cada decisão R0 (20 Hz) | `crowd.ts` 1150-1182 | Fica igual (decisão 6) |
| `pile` por célula de 0,5 m, `tryStep`, `stepRelease`, `pileBlast`, `pileMax 160`, `pileTop 3,7` | `crowd.ts` 455-509 | O monte (`mound`) soma com `pile` em `groundAt`; o `pileBlast` passa a ser chamado por `crowd.blast` |
| Gravidade, subida (`climbSpeed 1,9`) e queda com atordoamento (`fallStun 3,2`) | `frame()` 923-967 | É o desabamento do monte, sem código novo de queda |
| Portas com `hit(index, damage)` | `doors.ts` | A pressão vira golpes discretos (§6.5) |
| Variantes assadas: 4+3+2+2+9×1 = 20 corpos × 3 níveis = até 60 lotes | `crowd-three/renderer.ts`, `characters-three/instanced/variants.ts` | São a base da variedade (D11) |
| Atributos por instância `iA`, `iB`, `iC`, `iCol`, `iEye`; animação de 12 ossos no vertex shader; pose `fallen` com a passada como progresso da queda; lote `InstancedMesh` (`body-batch.ts` 49) | `characters-three/instanced/body-chunk.ts`, `body-batch.ts`, `body-material.ts` | O lote vira `Mesh` + `InstancedBufferGeometry`; ganha o `iD` e a pose `stagger` pelo trecho `BODY_CHUNK_EXT` (§10.3) |
| Faixas com histerese de 10 m: R0 até 35 m; quem nasce começa na faixa 3 (`crowd.ts` 323) e desce enquanto `d < max − 10`, ou seja, entra na R0 a menos de **25 m** e sai a mais de 45 m. O centro é o jogador, ou `flowTarget` sem jogador (`crowd.ts` 975-980) | `crowd.ts` 1006-1013 | O contexto ganha `bandCentre` (§12) para as cenas sem jogador |
| `INSTANCE_POSES` (8 de 16 vagas), altura do chão codificada de −2 a 8 m | `game-characters/src/gait/profile.ts` | `stagger` entra no índice 8; o arremessado usa a altura codificada |
| `blastShove`, `DEFAULT_BLAST_SHOVE` (acoplamento 0,02, até 20 m/s, `lift` 0,3, queda `(1−d/r)²`) | `game-contracts/src/blast-shove.ts` | É a regra do empurrão da explosão na horda |
| `explodes.chain` (`shot`, `fire`, `explosion` com atraso), `primed`, `detonatePrimed` | `game-destruction/src/world.ts` 2021-2031, 3013-3045 | O elo da cadeia (§8) |
| Botijão P13 (`propane_p13`, 200 kJ, `explosion: [0,25; 0,6]` s, vaza), barril, tanque do carro (`car_fuel_tank`, `explosion: 0,6`) | `game-weapons/src/data/explosives.json`, `game-weapons-three/src/world-explosives.ts` | Os elos do `chain_horde` |
| Evento de host `explosion`, emitido nos dois caminhos (detonação do jogador e `explode` de uma peça) | `game-test-room/src/explosives.ts` 325, `room.ts` 483 | A horda ouve um só evento |
| Membros voando, sangue | `characters-three/instanced/flying-limbs.ts`; eventos `effect` (`limb`, `blood`) | Passam pela fila com orçamento (§7.5) |
| Área `crowd_area`: `count` até 3000, capacidade 4000, `seed`, métricas lidas por `room.metrics().module` | `crowd-three/src/bench/module.ts` | Os cenários `dense_wall` e `chain_line` e as métricas novas |

## 2. Camadas (D1)

| Pacote | Camada | O que entra |
|---|---|---|
| `game-contracts` | L0 | `HostEvent` `explosion` ganha `lethalRadius?` e `chain?: string` (aditivo). `blastShove` reaproveitado |
| `game-runtime` | L1 | Nada além da T4.1. A horda não o importa; quem a põe no `fixedSimulate` é a composição |
| `game-crowd` | L2 | `physics/contact.ts`, `physics/pressure.ts`, `physics/balance.ts`, `physics/mound.ts`, `physics/blast.ts`, `physics/thrown.ts`, `identity.ts`, `personality.ts` (um conceito por arquivo, menos de 200 linhas cada), os campos da store, as opções, os contadores e os eventos. Importa `blastShove` do L0. O pool de arremessados é simulado aqui |
| `game-characters` | L2 | `INSTANCE_POSES` ganha `stagger` no fim (os índices de hoje ficam). `WOUND_REGIONS`. `bakeSegmentClips(...)` amostra os clipes que o kit já tem (`animateProfile`, `humanPose`, `crawlPose`, `deadPose`) por osso, sem three |
| `game-characters-undead` | L3 | `crowd.json` ganha, por tipo, `balance` (§5.1), `personality` (faixas) e, por roupa, `looks` (paleta da calça e ids de acessórios). São só dados |
| `game-destruction` | L2 | `chainLinksPerUpdate` e o id de cadeia nos eventos `primed` e `explode` |
| `game-characters-three` | L4 | `BODY_CHUNK` sem mudança. Trecho novo `BODY_CHUNK_EXT` (`#ifdef USE_IDENTITY`: `iD`, pose `stagger`, inclinação e tombo, tinta dos ferimentos, paleta da calça; `#ifdef USE_SEGMENT_CLIPS`: clipes), só incluído quando `createBodyMaterial` recebe `{ identity }` ou `{ segmentClips }`. O lote vira `Mesh` + `InstancedBufferGeometry`. Também `createSegmentClipTexture`, o material do impostor, `bakeImpostorAtlas` e `createBlobShadowBatch` |
| `game-crowd-three` | L4 (a composição `crowd-three → characters-three` já está na allowlist) | Só desenha: escreve o `iD` a partir da store e do pool, faz o nível impostor, a regra das sombras, os lotes de acessórios, a interpolação por `alpha` e o tombo dos arremessados (lidos do `crowd.thrown`). A área de testes (`./testing`) ganha os controles de física, as cenas injetadas e as métricas |
| `examples/crowd-test-area` | L5 | Cenas `dense_wall` (parede `wallPiece` do `game-floorplan-three`, a mesma regra da casa) e `chain_line` (botijões e tanque pelos explosivos de mundo do `game-weapons-three`, carro pelo `game-vehicles-three` com a frota) |
| O jogo e a sala | L5 | Ligam `physics: CROWD_PHYSICS_DEFAULTS` |

O `game-crowd-three` não desenha parede, botijão nem carro (ele é L4 e não pode importar outro adaptador). A cena chega por opção:

```ts
/** A scene the composition (L5) injects into the crowd area: it writes the nav grid and the doors, places the agents, and draws its own pieces. */
export type CrowdBenchScene = {
  readonly id: string
  readonly name: Readonly<Record<string, string>>
  layout(grid: NavGrid, doors: Doors): void
  spawn(crowd: Crowd, count: number, unit: (k: number) => number): void
  /** Optional scripted events (blasts, shots) on the fixed step clock, for the scenarios and perf. */
  script?(crowd: Crowd, step: number): void
}
// CrowdTestModuleOptions
readonly scenes?: readonly CrowdBenchScene[]
readonly physics?: CrowdPhysicsOptions
```

## 3. Onde a horda roda no quadro

A T4b depende da T4.1. A composição registra:

```ts
host.onFrame((h) => crowdStep(h), { phase: 'fixedSimulate', order: 200 }) // after the player (100) and the destruction world (150)
host.onFrame((dt) => renderer.update(dt, { ...frame, alpha: scheduler.alpha }), { phase: 'present' })
```

Ordem dentro de `crowd.update(h)` com `physics` ligado. Os passos novos estão marcados com ★.

1. ★ `prevX/prevZ/prevY ← x/z/y` (para interpolar).
2. ★ `resolveBlasts()`: as explosões que chegaram desde o passo anterior (§7).
3. Fluxo e grade, como hoje (com `flow.cellsPerStep` no modo determinístico, §12).
4. O laço por agente de hoje: faixa, percepção, habilidade, vontade, integração e movimento contra a grade, e `frame()`.
   - ★ Um agente `THROWN` é pulado por inteiro: sem decisão, sem integração, sem `frame()` (a gravidade dele é a do pool), fora da separação (como vizinho e como agente) e fora da grade espacial.
   - ★ Um agente com `balance ≠ STANDING` pula a decisão: a vontade fica a 35% cambaleando e zero nos outros estados.
   - ★ A separação tem teto: `|Σ separação · separationPush| ≤ separationMax` (§4.4).
   - ★ A vontade é cortada contra o contato da frente (§4.5).
   - ★ A integração passa a mover por `vx + pushX`.
   - ★ A batida na grade zera também o `push` daquele eixo e marca o contato de parede do campo de pressão.
5. ★ `rebuildContactHash()`: limpa só as células usadas no passo anterior e insere os agentes R0 (menos os `THROWN`) nas posições novas.
6. ★ `contactStep()`: 2 iterações (§4.3).
7. ★ `pressureStep()`: um salto do campo de pressão (§4.5), lendo o campo do passo anterior.
8. ★ `balanceStep()`: média da pressão, cambaleio, queda, levantar, tropeço e pisoteio (§5).
9. ★ `moundStep()`: recalcula `mound` e encaixa a altura dos caídos (§6).
10. ★ `thrownStep()`: arco, pouso e derrubada (§7.3).
11. `killQFlush()`, como hoje. Cada `remove` (troca com o último) também remapeia o pool de arremessados (§7.3).

## 4. Modelo de contato

### 4.1 Campos novos na store

```ts
// game-crowd/src/store.ts — added to createStore and AGENT_FIELDS
pushX: f32(), pushZ: f32(),          // push velocity m/s (physics, separate from the will vx/vz)
mass: f32(),                          // kg = numbers.contact.baseMass · height · build²
pressure: f32(),                      // N, exponential mean of the field
field: f32(), fieldPrev: f32(),       // N, the pressure field of this step and of the previous one (double buffer, §4.5)
aimX: f32(), aimZ: f32(),             // unit will direction while driving, (0, 0) otherwise
directShove: f32(), blastStep: i32(), // horizontal speed of the last direct blast shove and its step (causal tag, §12)
balance: u8(), balanceTimer: f32(), fallCause: u8(),
identity: new Uint32Array(capacity),  // seeded identity (§10.1)
stability: f32(), tripFactor: f32(), driveFactor: f32(), reaction: f32(), cadenceFactor: f32(), aggression: f32(),
idle: u8(), gaitStyle: u8(), wounds: new Uint16Array(capacity), accessories: u8(), trousers: u8(),
clipBlend: f32(), leanX: f32(), leanZ: f32(), thrown: new Int8Array(capacity),
prevX: f32(), prevZ: f32(), prevY: f32(),
```

A memória extra é de cerca de 125 B por agente (750 KB a 6000 agentes). O campo duplo vai em `AGENT_FIELDS`, porque a remoção troca com o último no meio de um passo e o valor do passo anterior tem de ir junto. Eles existem mesmo com a opção desligada: a store não muda de forma, e o golden não lê esses campos.

### 4.2 Opções

```ts
export type CrowdContactOptions = {
  /** Body radius over build (default 0.25 → 0.5 m between two average bodies; the separation keeps them at 0.78 m when it can). */
  readonly radius?: number
  /** Iterations per fixed step in band R0 (default 2; 1 is allowed, 3 is the ceiling). */
  readonly iterations?: 1 | 2 | 3
  /** Push velocity damping per second: pushᵢ ← pushᵢ·exp(−friction·h) (default 6 → λ = 0.905 at 60 Hz). */
  readonly friction?: number
  /** Ceiling of the push velocity, m/s (default 3; a blast above it goes to the thrown pool or is clamped). */
  readonly maxPush?: number
  /** Ceiling of the position correction of one agent in one iteration, m (default 0.06). */
  readonly maxCorrection?: number
  /** Jacobi relaxation of the position correction (default 0.5). */
  readonly relaxation?: number
  /** kg of a body of height 1 and build 1 (default 70). */
  readonly baseMass?: number
  /** Ceiling of the separation term `|Σ sep · separationPush|`, m/s (default 1.5). Today it has none: in a crush with ~40 neighbours it could reach tens of m/s. */
  readonly separationMax?: number
}
```

Na criação, a horda verifica `2·radius·maxBuild < hashCell`. Com o maior `build` do pacote morto-vivo, cerca de 1,69, isso dá 0,85 m < 1 m: a célula mais as 8 vizinhas bastam. Se a conta falhar, `createCrowd` lança erro na hora (só na fronteira, padrão do kit).

### 4.3 Algoritmo de um passo (faixa R0)

```ts
// game-crowd/src/physics/contact.ts — pure over typed arrays, no closures over the crowd, so a Worker or WASM can run the same function (§11.2)
export type ContactView = {
  readonly n: number
  readonly x: Float32Array; readonly z: Float32Array
  readonly vx: Float32Array; readonly vz: Float32Array
  readonly pushX: Float32Array; readonly pushZ: Float32Array
  readonly mass: Float32Array; readonly build: Float32Array
  readonly band: Uint8Array; readonly balance: Uint8Array
  readonly correctionX: Float32Array; readonly correctionZ: Float32Array; readonly contactCount: Uint8Array // scratch
  readonly hashHead: Int32Array; readonly hashNext: Int32Array; readonly hashSide: number; readonly half: number
}
export type ContactParams = Required<CrowdContactOptions> & { readonly h: number }
export type ContactResult = { contacts: number; maxOverlap: number; overlapSum: number; impulseSum: number }
export type ContactSolver = (view: ContactView, params: ContactParams, out: ContactResult) => void
export const contactStep: ContactSolver
```

O contato só resolve **sobreposição e choque**. Ele não mede pressão (a pressão é o campo da §4.5).

Para cada iteração `k = 1..iterations`:

1. **Impulso (Gauss-Seidel simétrico, vizinhos pela grade).**
   - Ida: `i` de 0 a `n − 1`, cada par `(i, j)` com `j > i`. Volta: `i` de `n − 1` a 0, os mesmos pares. Cada par é resolvido duas vezes por iteração, uma em cada sentido: o agente de índice baixo não leva mais vantagem do que o de índice alto.
   - Para cada par em contato, com `d < rᵢ + rⱼ`, `n = (xᵢ − xⱼ)/d` e `w = v + push`:
     - `c = (wᵢ − wⱼ)·n`; se `c < 0` (estão se aproximando):
     - `μ = 1/(1/mᵢ + 1/mⱼ)` e `J = −μ·c` (restituição 0);
     - `pushᵢ += J·n/mᵢ` e `pushⱼ −= J·n/mⱼ`.
   - A massa usada é a efetiva: um caído (`FALLEN`, `GETTING_UP`) entra com `3·m`. Um arremessado (`THROWN`) não entra: não está na grade.
2. **Correção de posição (Jacobi).**
   - Cada par acumula `δᵢ += ω·(rᵢ + rⱼ − d)·n·(mⱼ/(mᵢ + mⱼ))` e o simétrico em `j`, e soma 1 em `contactCountᵢ` e `contactCountⱼ`.
   - No fim da iteração, cada `δᵢ` é **dividido por `contactCountᵢ`** (média, não soma: quem tem 6 vizinhos não leva 6 correções), limitado a `maxCorrection` e aplicado.
   - A posição não volta para a velocidade (*split impulse*).
   - O deslocamento não atravessa a grade: o mesmo `blockedAt` por eixo do laço de hoje.

Depois das iterações:

- `push ← push·λ`, com `λ = exp(−friction·h)` calculado uma vez na criação.
- `|push| ≤ maxPush`, por escala do vetor.

Na faixa R1, o resumo da §9. Nas faixas R2 e R3, nada.

**Viés de ordem.** O impulso de ida e volta, a correção pela média e o campo de pressão com buffer duplo (§4.5) não dependem da ordem dos índices na conta; o que sobra é o arredondamento de float32, que muda bits mas não o comportamento. O teste "Ordem de nascimento" (§13.1) prova isso com a mesma fila nascida da frente para trás e de trás para a frente.

### 4.4 A energia não cresce (prova e limite)

Seja `K = ½ Σ m̃ᵢ|wᵢ|²` a energia cinética da multidão, com `wᵢ = vᵢ + pushᵢ` e `m̃ᵢ` a massa efetiva (`3·mᵢ` para caídos, `mᵢ` para os outros; a mesma do impulso, senão a prova não fecha).

1. **Um impulso inelástico de par não aumenta `K`.**
   - O impulso só muda a componente normal relativa, de `c` para 0.
   - A variação é `ΔK = −½·μ̃·c² ≤ 0`, com `μ̃` pela massa efetiva: o resultado clássico da colisão perfeitamente inelástica.
   - Aplicados em sequência (ida e volta), cada um respeita isso. Por isso o passo de impulso não é Jacobi: impulsos somados em paralelo podem passar do ponto e criar energia.
2. **A correção de posição não toca `w`.** Ela não entra em `K`.
3. **Horda parada** (`v ≡ 0`, sem vontade, sem explosão): `w = push`.
   - O amortecimento dá `K' = λ²·K`.
   - O teto `|push| ≤ maxPush` só encolhe vetores.
   - Logo `K(t + h) ≤ K(t)` e `K(t) ≤ λ^(2t/h)·K(0)`. Em 60 s a 60 Hz, `λ^7200 ≈ e^(−720)`: zero na prática.
   - No float32 da store, tolera-se `K(t+h) ≤ K(t)·(1 + 1e−6)`, por arredondamento.
   - Um caído que levanta passa de `3·m` para `m` sem mudar `w`: `K` cai. Quem cai passa de `m` para `3·m` com `vx = vz = 0` e `push ← push/3` (o momento `m·push` se conserva), e a energia dele vai a `K/3` ou menos. A troca de massa nunca aumenta `K`.
4. **Horda andando:** a vontade injeta energia, mas cada agente fica limitado.
   - Hoje `dv = t·sp + Σ separação · separationPush` (`crowd.ts` 1177-1178), e o termo da separação não tem teto: cada vizinho soma até `1,26·rr ≈ 0,8` m, e numa compressão com ~40 vizinhos isso passaria de 70 m/s.
   - Com a física ligada: `|Σ separação · separationPush| ≤ separationMax` (padrão 1,5 m/s), por escala do vetor. Sem a física, nada muda.
   - Logo `|wᵢ| ≤ vmaxᵢ + separationMax + maxPush`, com `vmaxᵢ` a velocidade de perseguição dele já multiplicada pela personalidade.
   - E `K ≤ ½ Σ m̃ᵢ(vmaxᵢ + separationMax + maxPush)²`. A explosão é energia externa e explícita, também limitada pelo teto, ou sai para o pool.

Esse é o teste "a energia da multidão parada não cresce em 60 s" da T4b.6. Ele roda direto no `contactStep`.

### 4.5 Campo de pressão (um salto por passo)

O solver de contato não serve para medir força de coluna: o contato só muda o `push`, a vontade nunca é reduzida por ele, e um impulso chega a uns 2 vizinhos por passo. A pressão é por isso um campo próprio, em N, que anda **um salto por passo fixo** (é a "onda" da D10).

```ts
// game-crowd/src/physics/pressure.ts — pure over typed arrays, like the contact
export type CrowdPressureOptions = {
  readonly transmission?: number   // share kept per hop, τ (default 0.97)
  readonly cap?: number            // ceiling of the field per agent, N (default 6000)
  readonly frontCone?: number      // cos of the half angle that counts as "in front" (default 0.5 → 60°)
  readonly staggerSpeed?: number   // share of the will speed of a staggering agent (default 0.35); the field keeps the full drive
}
```

**Quem empurra.** O agente `i` empurra (`drivingᵢ`) quando está em pé, quer andar (`sp > 0,05`) e tem contato na frente: outro agente em pé `k` com `aimᵢ·n̂ᵢ→ₖ ≥ frontCone`, ou uma célula bloqueada da grade na direção da vontade. `aimᵢ` é a direção da vontade (`tx, tz` antes da separação), gravada na decisão; vale `(0, 0)` quando ele não quer andar. A força dele é `Dᵢ = driveForce(tipo)·driveFactorᵢ` em pé **e cambaleando**, e 0 nos outros estados.

**Quem está atrás.** `j` está atrás de `i` quando os dois se tocam e `i` está na frente de `j`: `wⱼᵢ = max(0, aimⱼ·n̂ⱼ→ᵢ − frontCone)/(1 − frontCone)`. O peso usa a vontade de quem empurra, não a ordem dos índices.

**Cambaleando empurra inteiro (decisão H-b).** Quem cambaleia continua com `Dᵢ` inteiro no campo; o `staggerSpeed` (35%) só reduz a velocidade de vontade dele (§3, passo ★). Assim o campo é linear: o da frente de uma fila de N é `D·(1 − τᴺ)/(1 − τ)`, sem ponto fixo que dependa de quem já cambaleou. A alternativa (cambaleante empurra com 35% a partir de `0,7·P_crit`) foi recusada: pela conta do `architect`, a frente da fila de walkers ficaria em 0,78 (N = 6), 0,94 (N = 10) e 1,01 (N = 12) de `P_crit`, ou seja, a fila só derrubaria a partir de 12 e o funil da porta quase nunca, e cada tabela passaria a depender de uma iteração de ponto fixo.

**Um salto.** Com o campo do passo anterior (`fieldPrev`), para todo agente em pé ou cambaleando na R0:

```
fieldᵢ = min(cap, Dᵢ + Σⱼ τ · fieldPrevⱼ · wⱼᵢ² / Wⱼ)        Wⱼ = Σₖ wⱼₖ  (agentes e paredes na frente de j)
```

- Numa fila indiana, cada um tem um só da frente (`w = 1`, `W = 1`): passa `τ·fieldPrev` inteiro. Depois de N passos, a frente tem `D·(1 − τᴺ)/(1 − τ)`: com τ = 0,97, de 0,99·N·D (N = 2) e 0,93·N·D (N = 6) a 0,87·N·D (N = 10).
- Num empacotamento hexagonal com as fileiras de frente para a vontade, cada um tem dois da frente a ±30°: `w = (cos 30° − frontCone)/(1 − frontCone) = (0,866 − 0,5)/0,5 = 0,732` cada, `W = 1,464`. Cada um da frente recebe `τ·fieldPrev·w²/W = τ·0,366·fieldPrev` de cada um de trás, e cada agente tem dois atrás: o τ efetivo é `τ·w = 0,97·0,732 = 0,710`. A recorrência fileira a fileira, a partir do muro, é `f_k = D + 0,710·f_(k+1)`, e a soma converge para `D/(1 − 0,710) = 3,45·D` = **862 N** com walkers (0,63 de `P_crit`). Com a geometria inicial da cena `queue` (±33,7°), `w = 0,664`, τ efetivo 0,644 e limite 2,81·D = 702 N.
- **Onde a pressão derruba.** Num muro plano, um walker nunca cai por pressão: 862 N exigiriam estabilidade abaixo de 0,63, e a personalidade vai de 0,75 a 1,25 (ele cambaleia abaixo de 0,90, que é `862/(0,7·1372)`). Um tipo fraco na frente, com walkers atrás, pode cair: `D_tipo + 0,710·862` dá 932 N para o runner (cai com estabilidade < 0,90), 842 N para o charred (< 0,85), 872 N para o blind (< 0,79). A queda por pressão em massa vem de dois arranjos que concentram força: a **fila indiana** (sem perda de lado, N ≥ 6 walkers, §5.1) e o **funil** em volta de uma porta (o fluxo radial multiplica a força por `(k+1)/k` a cada fileira, §13.2: as fileiras 1 a 4 passam do crítico). `frontCone` fica em 0,5: baixá-lo para 0 levaria o hexágono a 0,84 (limite 1563 N, 1,14 de `P_crit`), e o muro plano derrubaria a frente inteira, o que tiraria a cena `queue` (§13.1) de um teste de cadeia limpo e mudaria também o corte da vontade (abaixo).
- A parte que vai para uma parede (`k` = célula bloqueada) sai do campo. A parte que vai para uma célula de **porta** soma na carga da porta (§6.5).
- Caídos, levantando e arremessados têm `field = 0`, não empurram e não recebem: quem estava atrás de um caído perde o contato da frente e anda para cima do monte.
- `field` e `fieldPrev` trocam no fim do passo. Cada `fieldᵢ` lê só o passo anterior: a conta é Jacobi e não depende da ordem dos índices.
- Custo: O(contatos), a mesma vizinhança da grade já percorrida pelo contato.

**A vontade contra o contato.** Com a física ligada, a componente da vontade que entra no contato da frente é cortada: se `aimᵢ·n̂ᵢ→ₖ ≥ frontCone`, a velocidade de vontade ao longo de `n̂ᵢ→ₖ` não passa da de `k`. Quem está numa fila travada fica parado, e a força dele vai para o campo, não para a sobreposição.

**Média.** `P ← P + (field − P)·(1 − exp(−h/pressureTau))`, com `pressureTau` de 0,3 s (18 passos).

O contato não alimenta a pressão (sem `J/h` e sem `μ|δ|/h²`, que acompanhavam o ruído da sobreposição). Choque e explosão derrubam pelo `Δpush` (§5.2), não pelo campo.

## 5. Equilíbrio

### 5.1 Números por tipo (conteúdo, `game-characters-undead`)

```ts
// game-crowd/src/types.ts — optional on CrowdType; a type without it uses the defaults
readonly balance?: {
  readonly stability?: number      // multiplies the critical pressure (default 1)
  readonly trip?: number           // chance of tripping when entering a cell with a body (default 0.04)
  readonly driveForce?: number     // N (default 250)
  readonly canFall?: boolean       // false: already on the ground (crawler)
}
```

`P_crit = criticalFactor · m · 9,8 · stability`, com `criticalFactor` 2,0 (§5.2). A coluna "N em fila" é quantos do mesmo tipo, em fila indiana contra um muro, fazem o da frente passar de `P_crit` pelo campo da §4.5 (`min(6000, D·(1 − 0,97ᴺ)/0,03) > P_crit`, personalidade neutra, cambaleantes empurrando inteiro, §4.5). "N walkers" é o mesmo com o tipo na frente e N − 1 walkers atrás (`min(6000, D_tipo + 0,97·250·(1 − 0,97^(N−1))/0,03) > P_crit`). Conferido por script.

| Tipo | Massa (70·h·b²) | `stability` | `trip` | `driveForce` | `P_crit` (N) | N em fila | N walkers | Nota |
|---|---|---|---|---|---|---|---|---|
| walker | ~70 | 1,0 | 0,04 | 250 | 1372 | 6 | 6 | |
| runner | ~66 | 0,8 | 0,06 | 320 | 1035 | 4 | 5 | rápido e instável |
| crawler | — | — | 0 | 150 | — | — | — | `canFall: false`; vira obstáculo de tropeço de 0,25 m |
| brute | ~168 | 2,5 | 0,015 | 600 | 8232 | nunca (o teto do campo é 6000 N) | nunca (idem) | segura a fila (teste da T4b.2) |
| sniffer | ~70 | 1,0 | 0,04 | 260 | 1372 | 6 | 6 | |
| leaper | ~66 | 0,9 | 0,03 | 300 | 1164 | 5 | 5 | |
| bloater | ~125 | 0,7 | 0,06 | 200 | 1715 | 10 | 8 | |
| stalker | ~70 | 1,1 | 0,03 | 280 | 1509 | 6 | 7 | |
| blind | ~70 | 0,8 | 0,07 | 260 | 1098 | 5 | 5 | não vê o corpo |
| screamer | ~63 | 0,9 | 0,04 | 220 | 1111 | 6 | 5 | |
| charred | ~63 | 0,8 | 0,05 | 230 | 988 | 5 | 5 | |
| drowned | ~77 | 0,9 | 0,045 | 240 | 1358 | 7 | 6 | |
| devourer | ~77 | 1,2 | 0,035 | 300 | 1811 | 7 | 8 | |

### 5.2 Estados

```ts
export const BALANCE = { STANDING: 0, STAGGERING: 1, FALLEN: 2, GETTING_UP: 3, THROWN: 4 } as const
export const FALL_CAUSE = { NONE: 0, PRESSURE: 1, SHOVE: 2, TRIP: 3, LANDING: 4, COLLAPSE: 5, BLAST: 6 } as const
export type CrowdBalanceOptions = {
  readonly criticalFactor?: number   // P_crit = criticalFactor · m · g · stability (default 2.0 → 1372 N for a walker, ~5.5 drives)
  readonly staggerEnter?: number     // P/P_crit to start staggering (default 0.7)
  readonly staggerLeave?: number     // P/P_crit to stop, after staggerMin (default 0.4)
  readonly staggerMin?: number       // s (default 0.5)
  readonly fallRate?: number         // 1/s, rate = fallRate·(P/P_crit − 1)² above 1 (default 1.5)
  readonly shoveStagger?: number     // |Δpush| in one step that staggers, m/s (default 1.2)
  readonly shoveFall?: number        // |Δpush| that knocks down, m/s, times stability (default 2.5)
  readonly fallenMin?: number        // s on the ground before trying to get up (default 1.5, plus reaction)
  readonly releaseFactor?: number    // P/P_crit under which a fallen one may get up (default 0.3)
  readonly getUpSeconds?: number     // default 1.2
  readonly pressureTau?: number      // s of the exponential mean (default 0.3)
  readonly maxFallsPerStep?: number  // ceiling of new falls per fixed step (default 8)
  readonly maxFallen?: number        // ceiling of agents on the ground (default 300); above it a fall becomes a stagger
  readonly trampleDps?: number       // damage per second to a fallen body per 70 kg standing on it (default 6)
}
```

| De | Para | Condição |
|---|---|---|
| STANDING | STAGGERING | `P > staggerEnter·P_crit`, ou `|Δpush| > shoveStagger` num passo |
| STANDING / STAGGERING | FALLEN | `|Δpush| > shoveFall·stability(tipo)·stabilityᵢ` (explosão, pouso, choque); ou, estando STAGGERING, o sorteio `unit(id, step, FALL) < 1 − exp(−fallRate·(P/P_crit − 1)²·h)`; ou tropeço (§5.4) |
| STAGGERING | STANDING | `P < staggerLeave·P_crit` e `balanceTimer ≥ staggerMin` |
| FALLEN | GETTING_UP | `balanceTimer ≥ fallenMin + reaction`, `P < releaseFactor·P_crit` e ninguém em cima (`mound` acima do topo do próprio corpo ≤ 0,05 m) |
| GETTING_UP | STANDING | `balanceTimer ≥ getUpSeconds` |
| qualquer | THROWN | pela explosão (§7), se houver vaga no pool |
| THROWN | FALLEN | no pouso (§7.3) |

- `P_critᵢ = criticalFactor · mᵢ · 9,8 · stability(tipo) · stabilityᵢ`, com `stabilityᵢ` da personalidade (§10.2).
- A pressão é a média exponencial do campo (§4.5): `P ← P + (field − P)·(1 − exp(−h/pressureTau))`. Vale 0 fora da R0, salvo o resumo da R1.
- **Por que 2,0 e não 0,8.** Com 0,8 (549 N), dois walkers e meio já derrubavam, e numa horda espremida contra uma porta quase todos passavam do crítico (83% com estabilidade 1, conta da §13.2). Com 2,0, a fila indiana derruba a partir de 6; o empacotamento hexagonal, que perde 29% por salto (τ efetivo 0,710), não derruba walker contra muro plano em profundidade nenhuma (limite 862 N); no funil da porta, só as fileiras 1 a 4 passam do crítico (4% dos agentes com estabilidade 1).
- **Teto de quedas:** os candidatos de cada passo são ordenados por `P/P_crit` (desempate pela `identity`, que não muda com a troca da remoção). Só os `maxFallsPerStep` primeiros caem; os outros cambaleiam.
- **No caído:** `state` fica como está (o comportamento volta igual quando ele levanta); `vx = vz = 0`; não ataca nem usa vaga de ataque; ainda pode receber dano. Um caído que morre vira corpo no lugar.

### 5.3 Sem pressão, zero quedas

Toda queda tem uma causa entre pressão acima do crítico, choque (`Δpush`), tropeço em corpo, pouso ou explosão. Sem contato forte e sem corpo no chão, nenhuma condição é verdadeira, por construção. É o teste "sem pressão, zero quedas".

### 5.4 Tropeço e pisoteio

- **Tropeço:** quando um agente em pé entra numa célula nova com `mound ≥ 0,15` m e anda a mais de 0,5 m/s, sorteia `unit(id, step, TRIP) < trip(tipo)·tripFactorᵢ·(speed/1,4)`. Quem já subiu no monte (`y ≥ mound − 0,1`) não tropeça: está andando por cima.
- **Pisoteio:** cada caído recebe `trampleDps · Σ(m_em_cima/70) · h`. "Em cima" são os agentes em pé cuja célula cai nas 3 células do corpo e que estão acima dele (`yⱼ > yᵢ`). O dano entra por `hurtOther` (sangue, morte adiada pela `killQ`).

## 6. Monte em qualquer lugar

```ts
export type CrowdMoundOptions = {
  readonly bodyThickness?: number    // m per cell of a lying body, times build (default 0.28)
  readonly corpseThickness?: number  // default 0.25
  readonly maxHeight?: number        // ceiling of mound per cell, m (default 1.6, about 5 or 6 bodies)
  readonly corpseRadius?: number     // corpses within this distance of the target count (default 35, band R0)
}
// Crowd
readonly mound: Uint16Array          // per nav cell (0.5 m), in whole millimetres, recomputed each fixed step
```

1. **Recálculo a cada passo, sem depender de ordem.**
   - Primeiro zera as células da lista de células tocadas no passo anterior.
   - Cada corpo deitado (agente `FALLEN` ou `GETTING_UP` na R0, ou corpo do registro a até `corpseRadius`) soma sua espessura em 3 células, ao longo do `renderYaw`: cabeça, tronco e pernas, a 0,5 m uma da outra.
   - Agente caído: `bodyThickness · build`. Corpo: `corpseThickness · build`.
   - **A soma é em milímetros inteiros:** cada espessura é arredondada uma vez para `round(espessura·1000)` e somada num `Uint16Array`. Soma de inteiros é associativa, então o monte sai igual qualquer que seja a ordem dos agentes (float32 somado em ordem diferente muda o último bit, e um limiar como `mound ≥ 0,15` podia virar). `groundAt` lê `mound[c]/1000`.
   - Custo: O(caídos + corpos ≤ 300 + 400).
2. **Teto de altura, sem depender de ordem.** Depois da soma, cada célula acima de `maxHeight` ordena os corpos dela pela `identity` (não pelo índice). Na ordem da `identity`, os que cabem até `maxHeight` ficam; os outros escorregam para a mais baixa das 8 vizinhas (desempate pelo número da célula), e o agente é movido junto. A decisão depende só de quem está na célula, não de quem foi somado primeiro. Se a vizinha também passar do teto, o corpo fica onde está, e o valor gravado é sempre `min(soma, maxHeight)`. Assim a altura do monte respeita o teto.
3. **O chão.** `groundAt(c)` passa a ser `max(regra de hoje, pile[c] + mound[c])` nas células livres e de porta aberta. O `blockedAt` usa a mesma soma, mantendo o degrau de 0,5 m de hoje: dá para subir 0,5 m por célula e não mais.
   - Quem anda sobe pela regra de hoje (`y += climbSpeed·h` até o chão).
   - O caído fica com `y = mound(c) − a própria espessura`.
4. **Escalar.** Escalador é quem está em pé, com `y ≥ 0,25` m, sem estar em `PILE_STEP` e com o chão vindo do `mound`. O contador é `stats.physics.climbers`.
5. **Desabamento.** Quando a base levanta, morre e é removida, ou é arremessada, o próximo recálculo já sai mais baixo. Quem estava em cima cai pela gravidade de `frame()`.
   - Com o equilíbrio ligado, o pouso acima de 0,6 m de queda faz cambalear, e acima de 1,0 m derruba, com causa `COLLAPSE`. A cascata sai daí.
   - Na pilha do muro, um `PILE_STEP` que cai, é arremessado ou morre chama `stepRelease` nele e nos `PILE_STEP` das células de trás da mesma coluna (`c − dir`), que viram `AIRBORNE` com `vy = 0`. Quem desce de mais de 1,0 m cai com causa `COLLAPSE`.
6. **Pilha no muro com pressão.** O tempo travado que leva ao `tryStep` cresce mais rápido com a pressão: `stuck += h·(1 + P/P_crit)`. `pileMax` e `pileTop` ficam como estão.

### 6.5 Porta empurrada

- A parte do campo de pressão que vai para uma célula de porta fechada (§4.5) soma na carga da porta: `doorLoad += parte·h`, em N·s.
- A cada `attackEvery` (1,5 s), a porta leva `doors.hit(door, doorLoad·pressureDamage)` e o acumulado zera. O padrão é `pressureDamage = 0,004` por N·s: no funil da `pen`, a fileira 1 chega a ~2960 N por agente (§13.2) e uns 2 encostam numa porta de 1,2 m, ~5700 N passados com τ: por 1,5 s, ~34 de dano por golpe. O teto de um agente (6000 N) dá 36 por golpe.
- São golpes discretos, não um por passo, para não disparar som e ruído 60 vezes por segundo.
- Os golpes de hoje continuam.

## 7. Explosão → horda

### 7.1 API

```ts
export type CrowdBlast = {
  readonly point: readonly [number, number, number]
  readonly energy: number          // J
  readonly radius: number          // m, injury reach
  readonly lethalRadius?: number   // m, everything inside dies
  readonly source?: string
  /** Id of the chain this blast belongs to (game-destruction `chain`), for the counters. */
  readonly chain?: string
}
export type CrowdBlastOptions = {
  readonly pointsPerKilojoule?: number   // damage at the centre per kJ before falloff (default 0.6 → m67 120 points)
  readonly throwSpeed?: number           // shove speed from which a body flies, m/s (default 4)
  readonly maxBlastsPerStep?: number     // default 8; more wait for the next step, in order
  readonly limbEffectsPerBlast?: number  // default 24; the rest summed into one blood effect
  readonly bloodEffectsPerBlast?: number // default 32
}
// Crowd
blast(blast: CrowdBlast): void          // enqueues; resolved at the start of the next fixed step
```

Evento novo, emitido depois da resolução:

```ts
blasted: { point: [number, number, number]; radius: number; reached: number; killed: number; thrown: number; fallen: number; chain?: string }
```

### 7.2 Resolução (uma passada)

`resolveBlasts()` pega até `maxBlastsPerStep` explosões da fila e faz **uma passada sobre os `n` agentes**. Cada agente testa as `k` explosões daquele passo: o custo é O(n·k), sem alocação, com `stats.physics.blastChecks = n·k`.

A passada é linear, não pela grade de 1 m, porque essa grade só tem a faixa R0. Uma explosão a 60 m do jogador precisa achar os agentes das faixas R1 a R3, e 6000 testes de distância custam menos de 0,05 ms.

Para cada agente `i` (centro em `y + 1,0·height`) e cada explosão:

1. `d` é a distância 3D. Se `d > radius`, nada acontece.
2. Dentro de `lethalRadius`, o agente morre.
   - Se `d < 0,5·lethalRadius`, é desmembrado: cada membro sai com chance `unit(id, step, LIMB+k) < 0,5`, pelos bits de `MISSING`, com `cut = 1`.
   - Os eventos `limb` e `blood` vão por agente até os tetos `limbEffectsPerBlast` e `bloodEffectsPerBlast`. Depois disso, um único `blood` com a soma de `amount`.
3. Fora do raio letal, `falloff = (1 − d/radius)²` e o agente leva o dano `{ region: 1, amount: energy/1000 · pointsPerKilojoule · falloff, distance: d, cut: falloff }`. Também leva uma batida num membro: a região sai de `unit(id, step, REGION)`, com metade do dano.
   - O dano passa pelo `damage` interno com o sorteio por parâmetro: `damageWith(i, hit, () => unit(id, step, SALT_JAW + k))`. O `crowd.damage` público (que sorteia `R()`, `crowd.ts` 599) não é chamado no caminho da física, e o fluxo `random` não anda (decisão 2).
4. O empurrão é `blastShove(blast, { position, mass: mᵢ })`, com as opções do host, e dá `{ speed, direction }`. A parte horizontal `speed·|direction_xz|` fica em `directShoveᵢ`, com `blastStepᵢ = step` (a marca causal da §12).
   - Se `speed ≥ throwSpeed` e o agente está a menos de `thrown.radius` do alvo, ele vira candidato ao pool (vivo ou morto).
   - Com o equilíbrio ligado, se não for candidato: `push += speed·direção horizontal` (com teto), mais a regra de `shoveFall`/`shoveStagger` (causa `BLAST`). Quem morreu entra como corpo na hora, já na pose de morte instanciada.
   - Com o equilíbrio desligado: atordoado (`STATE.STUNNED`) por `0,45 + falloff` s, com `vx`/`vz` vindos do empurrão. É o mesmo efeito do empurrão do jogador de hoje.
5. Por fim, `pileBlast(point, radius)` (o de hoje). Os caídos no raio recebem empurrão para fora e continuam caídos. Os corpos do registro não se mexem: o registro é imutável, e o efeito no visual é pequeno.

Os candidatos ao pool (dentro de `thrown.radius` do centro das faixas) são ordenados por `thrown.priority` (desempate sempre pela `identity`). O padrão, `'fastest'`, é a **velocidade, da maior para a menor**: os voos mais longos são os que mais se veem e os únicos que levam a cadeia além do cambaleio direto. Ordenar pela distância ao jogador encheria o pool com os voos curtos da borda (5 a 5,8 m), que pousam antes de 8,2 m.

**Mudança visível (registrada no `plan.md` D10).** Numa horda densa, com `'fastest'` as 32 vagas vão para os corpos mortos e desmembrados a menos de ~2 m do ponto (os mais rápidos), e os **vivos** da borda do arremesso (5 a 5,8 m) nunca voam: caem no lugar pela regra de `shoveFall`. Quem quiser ver vivos voando escolhe `'living'` (vivos primeiro, depois mortos, cada grupo do mais rápido ao mais lento): a cadeia por pouso encurta (os vivos da borda pousam antes de 8,2 m, dentro da queda direta), e o teste "Queda além da explosão" da §13.1 só vale com o padrão. A opção é determinística nos dois valores (mesma ordenação, outra chave).

**Os raios da m67 com os padrões** (`energy` 200 kJ, `radius` 15 m, `lethalRadius` 5 m; walker de 70 kg; `blastShove` com acoplamento 0,02, `lift` 0,3; centro do agente 0,7 m acima do ponto, então a parte horizontal da direção é ≈ 0,95 a mais de 4 m):

| O quê | Conta | Raio |
|---|---|---|
| Velocidade no centro | `√(2·200000·0,02/70)` = 10,7 m/s (abaixo do teto de 20) | — |
| Arremessado (`speed ≥ throwSpeed` = 4) | `(1 − d/15)² ≥ 0,374` | até 5,8 m (vivos entre 5 e 5,8 m; dentro de 5 m, mortos) |
| Queda direta (`|Δpush| > shoveFall` = 2,5, estabilidade 1) | `10,7·0,95·(1 − d/15)² > 2,5` | até **7,6 m**; com a personalidade (0,75 a 1,25), de 6,7 a 8,6 m |
| Cambaleio direto (`shoveStagger` = 1,2) | `(1 − d/15)² > 0,118` | até **9,9 m** |
| Brute (168 kg, `stability` 2,5) | 6,9 m/s no centro; precisa de `|Δpush| > 6,25` | nenhuma queda direta fora do raio letal |

Logo a "queda além da explosão" se mede contra o raio da queda direta (7,6 a 9,9 m), não contra o `radius` de 15 m, que é o alcance do dano. Os primeiros ocupam as vagas livres; os outros fazem o caminho do passo 4 sem pool.

### 7.3 Pool de arremessados

```ts
export type CrowdThrownOptions = {
  readonly pool?: number          // default 32
  readonly radius?: number        // only within this distance of the target (default 30 m)
  readonly landingRadius?: number // m around the landing point that is knocked (default 0.7)
  readonly fallDamage?: number    // damage per m/s of landing speed above 6 m/s (default 8)
  /** Who gets a slot when there are more candidates than slots: 'fastest' (default; dead and dismembered bodies near the blast fill it) or 'living' (living first, then dead, each fastest first) (§7.2). */
  readonly priority?: 'fastest' | 'living'
}
// game-crowd/src/physics/thrown.ts — fixed struct of arrays of `pool` slots, simulated in game-crowd; game-crowd-three only reads it
export type ThrownPool = {
  readonly agent: Int32Array        // agent index, or -1 for a dead body carried until it lands
  readonly identity: Uint32Array    // the agent's identity, checked against the store after each remap
  readonly corpse: (Corpse | null)[]
  readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array
  readonly prevX: Float32Array; readonly prevY: Float32Array; readonly prevZ: Float32Array
  readonly vx: Float32Array; readonly vy: Float32Array; readonly vz: Float32Array
  readonly pitch: Float32Array; readonly roll: Float32Array; readonly spinPitch: Float32Array; readonly spinRoll: Float32Array
  active(): number
}
// Crowd
readonly thrown: ThrownPool
```

- **Fora do resto da física.** Um agente `THROWN` não decide, não integra, não passa pelo `frame()` (a gravidade dele é só a do pool), não entra na separação (nem como vizinho), não entra na grade espacial do contato e não entra no campo de pressão. A posição dele na store é escrita pelo pool a cada passo.
- **Remoção.** A store remove trocando com o último (`crowd.ts` 341-350). O `remove` interno chama `thrown.remap(i, j)` com o removido `i` e o movido `j`: a vaga que apontava para `j` passa a apontar para `i`; a vaga que apontava para `i` vira corpo carregado (`agent = −1`, `corpse` com o visual dele) e pousa como corpo. São no máximo 32 comparações por remoção. **Caso `i === j`** (o removido é o último da store, nada é movido): a vaga que apontava para `i` só vira corpo carregado, e não há remapeamento (aplicar "a vaga de `j` passa a `i`" depois apontaria a vaga convertida de volta para um índice que deixou de existir). Em teste, cada vaga confere `store.identity[agent] === identity`, e o teste das 50 remoções inclui a remoção do último índice enquanto ele voa.
- **Voo:** a cada passo, `vy -= g·h` e `pos += v·h`. O giro sai da identidade: até 8 rad/s, com sinal pelo hash.
- **Parede no caminho.** Se `|v|·h ≤ 0,25` m (até 15 m/s), basta testar `solidAt(x, z, y)` no ponto novo. Acima disso, o trecho do passo é varrido **célula a célula** pela grade de 0,5 m (DDA de Amanatides-Woo): a primeira célula sólida na altura do corpo para o voo ali. Ao bater, a velocidade horizontal zera e o corpo cai reto. Nada atravessa parede a 20 m/s (0,33 m por passo).
- **Pouso** (`y ≤ groundAt`):
  - Cada agente em pé a menos de `landingRadius` leva o choque inelástico de dois corpos: `Δpush = (m_t/(m_t + mⱼ))·|v_h|`, para fora, e passa pela regra de `shoveFall` com causa `LANDING`. Um corpo de 70 kg a 6 m/s dá 3 m/s num walker: derruba. A 4 m/s, 2 m/s: cambaleia. É a cadeia de corpos.
  - Som `impact`, efeitos `dust` e `blood`.
  - Vivo: `FALLEN` com dano `max(0, |vy| − 6)·fallDamage`.
  - Morto: entra no registro de corpos no ponto do pouso.
- **Alcance com a m67** (conta com o `blastShove` da §7.2, partindo do centro do corpo a 1 m de altura): um corpo a 1 m do ponto sai a 9,3 m/s, quase para cima (`v_h` 6,4, `vy` 6,8), voa 1,5 s e pousa a ~10,7 m; a 2 m, pousa a ~9,4 m; a 3 m, ~8,2 m; a 4 m, ~8 m. Só os corpos que estavam a menos de ~1,5 m pousam além do cambaleio direto (9,9 m), e só os que saem perto do eixo da fila caem em cima dela.
- **Desenho:** o arremessado é uma instância comum do seu lote, com pose `fallen`, altura codificada, tombo (`pitch`, `roll`) no `iD.w` e interpolação por `alpha` entre `prev` e a posição do pool. Não há malha nem chamada de desenho a mais.
- Membro arrancado e sangue continuam pela fila com orçamento (§7.5).
- Se um dia houver física rígida (Rapier/WASM), ela entra **só aqui**, atrás da mesma `ThrownPool`, como diz a D10.

### 7.4 Bandas

| Faixa | O que a explosão faz |
|---|---|
| R0 (≤ 35 m) | tudo: dano, empurrão, pool, quedas e a cadeia de contato |
| R1 (35–120 m) | dano, morte e queda direta (sem pool), mais o resumo da §9 |
| R2–R3 | dano e morte; quem cairia só fica atordoado |

### 7.5 Efeitos com orçamento

A horda só emite eventos. A composição faz o resto:

- põe `effect` (`limb`, `blood`, `dust`) e `sound` na fila `crowd.effects` do `scheduler.budget` (prioridade abaixo da explosão);
- desenha os membros pelo `flying-limbs` do `game-characters-three`, que tem limite próprio.

O que estoura o orçamento passa para o quadro seguinte. A simulação nunca espera a fila.

## 8. Cadeia de explosões

1. **O elo é o que o kit já tem:** `explodes.chain` com atraso físico. Por exemplo, o P13 tem `explosion: [0,25; 0,6]` s e vazamento com `igniteDelay`, o barril tem `[0,2; 0,4]` e o tanque do carro tem `0,6`. O atraso sai da semente do mundo (`drawChainDelay`).
2. **Teto de elos por passo, no `game-destruction`:**

   ```ts
   // DestructionWorldOptions
   /** Primed parts that go off per `update` (default Infinity: today). The rest wait for the next update, in the same order; their time is that update's. */
   readonly chainLinksPerUpdate?: number
   ```

   - Com `update(h)` no passo fixo e `chainLinksPerUpdate: 1`, dois elos nunca saem no mesmo passo de simulação.
   - Um elo segurado atrasa no máximo `k·h` s (16 ms por elo enfileirado).
   - É determinístico, porque conta passos e não milissegundos.
3. **Id de cadeia.**
   - O `explode` de uma peça e o `primed` que ele causa levam `chain: string`: o id da explosão raiz, `"<object>#<order>"`. Uma detonação sem causa abre uma cadeia nova.
   - A sala repassa `chain` e `lethalRadius` no `HostEvent` `explosion`, e a horda também (`CrowdBlast.chain`).
   - O contador `chainLinks` conta as explosões por cadeia.
4. **Apresentação com orçamento.** Clarão, fogo, fumaça, decalque, luz (`LightBudget`) e som de cada elo vão para a fila `explosion.present` do `scheduler.budget` (T4.2).
   - Com 4 subpassos num quadro lento, 4 elos chegam no mesmo quadro de desenho, e a fila espalha o custo deles.
   - O mundo e a horda já resolveram tudo no passo.
   - É isso que torna "nunca dois elos sem orçamento no mesmo quadro" verdadeiro, sem tirar o determinismo.
5. **Veículo:** o tanque do carro é a peça `car_fuel_tank` de sempre, no mesmo caminho. Nada novo no `game-vehicles`.

## 9. Faixas: completo perto, resumo longe

- **R0 (≤ 35 m, decisão a 20 Hz, movimento a cada passo):** contato com 2 iterações, equilíbrio, monte, pool e pisoteio.
- **R1 (35–120 m, decisão a 5 Hz):**
  - Sem par de contato. Na decisão da faixa, uma grade grossa de 2 m conta os agentes por célula.
  - Com densidade acima de 4 corpos por 4 m², a velocidade cai por `capacidade/densidade` e a pressão vira `(densidade − 4)·150 N`. A mesma regra de queda da §5.2 vale, com o sorteio na decisão.
  - O caído da R1 fica deitado, sem entrar no monte. Ao entrar na R0, ele passa a contar.
- **R2–R3:** nada de física. O agente que muda de faixa leva o `balance` consigo: um caído continua caído.

## 10. Variedade (D11)

### 10.1 Identidade

```ts
// game-crowd/src/identity.ts
export const mix32 = (value: number): number => { /* murmur3 fmix32 */ }
/** 0..1 from an identity, a step and a salt: the counter-based draw every new feature uses (never `random`). */
export const unit = (identity: number, step: number, salt: number): number => (mix32((mix32(identity ^ salt) + Math.imul(step + 1, 0x9e3779b9)) >>> 0) >>> 0) / 4294967296
export type AgentLook = {
  readonly trousers: number      // palette index (content: looks of the outfit)
  readonly accessories: number   // bits: 1 hair, 2 cap, 4 helmet, 8 backpack (content ids by outfit)
  readonly gaitStyle: number     // 0 normal, 1 limp left, 2 limp right, 3 drag, 4 lurch, 5 shamble
  readonly clipBlend: number     // 0..1 mix of the second clip
  readonly woundSeed: number
}
export const lookOf = (identity: number, type: CrowdType, outfit: CrowdOutfit): AgentLook
```

- `identity[i] = mix32(seed32 ^ mix32(serial))`, com `serial` contando os nascimentos da horda. Não sorteia do `random`.
- O `unit` mistura o sal antes do passo (`mix32(identity ^ salt)`) e só depois soma o passo vezes a razão áurea (`0x9e3779b9`). Com um só XOR de tudo, dois pares `(step, salt)` diferentes podiam cair no mesmo valor de entrada e repetir o sorteio.
- A cor da camisa, a pele, a altura, a largura, a variante e a fase continuam saindo do `random` na ordem do jogo (golden). A identidade só **acrescenta** eixos.
- O desenho lê tudo da store, não do lote. Por isso o mesmo agente tem o mesmo visual em LOD0, LOD1, LOD2 e no impostor.
- Quem perdeu o braço esquerdo (`missing`) continua sem ele em todos os níveis.
- As feridas (`wounds`: 6 regiões × 2 bits, nenhuma/leve/grave) saem do dano real (`damage`, `blast`, pisoteio), mais uma semente inicial vinda da idade da infecção.

### 10.2 Personalidade (T4b.8)

```ts
export type CrowdPersonalityOptions = {
  readonly speed?: readonly [number, number]      // chase and wander factor (default [0.9, 1.1])
  readonly reaction?: readonly [number, number]   // s added to getting up and to the alert hop (default [0.05, 0.35])
  readonly stability?: readonly [number, number]  // default [0.75, 1.25]
  readonly trip?: readonly [number, number]       // default [0.5, 1.5]
  readonly drive?: readonly [number, number]      // pushing will, and will to climb (default [0.7, 1.3])
  readonly cadence?: readonly [number, number]    // walk cadence factor (default [0.88, 1.12])
  readonly aggression?: readonly [number, number] // attack will (default [0.8, 1.2]): divides attackEvery, multiplies the bite chance and the will to take an attack slot
  readonly idle?: readonly number[]               // weights of sway, shuffle, head twitch, still (default [3, 2, 2, 1])
}
```

- Tudo sai de `unit(identity, 0, SALT_x)`, com uma distribuição triangular entre os extremos.
- Quando a opção está ligada, `chaseSpeed` e `wanderSpeed` são multiplicados na hora de nascer (depois dos sorteios do jogo).
- O avanço da fase vira `cadenceFactor · (cadenceBase + cadencePerSpeed · renderSpeed)`.
- Os limiares de queda e de subida no monte vêm daqui (`stability`, `trip`, `drive`). Por isso a reação em cadeia não é uniforme: uns caem, outros seguram, outros sobem.
- **Agressividade** (`aggression`, D11 e T4b.8): divide o `attackEvery` do agente, multiplica a chance de mordida e entra no desempate de quem pega uma vaga de ataque. Só vale com `personality` ligado; o golden não muda.
- **O que faz parado** é o `idle` (balançar, arrastar os pés, torcer a cabeça, ficar imóvel).
- **Som:** a composição passa `identity` como semente da voz para o `game-audio`, que já sorteia variante e tom.

### 10.3 Atributos por instância e chamadas de desenho

**Atributos de vértice, hoje.** A geometria tem 6 (`position`, `normal`, `bone`, `vcol`, `pivot`, `ppivot`; o `uv` é apagado). O lote é um `InstancedMesh` (`body-batch.ts` 49), então o three acrescenta a `instanceMatrix` (`mat4`, **4** vagas), que fica identidade e não serve para nada: a posição e o giro vêm do `iA` (`body-material.ts` 20-30). Mais os 5 por instância (`iA`, `iB`, `iC`, `iCol`, `iEye`): **15 de 16**. Não cabe nem o `iD`.

**Decisão: o lote vira `Mesh` + `InstancedBufferGeometry`.**

- `createBodyBatch` copia a geometria para uma `InstancedBufferGeometry` e cria um `Mesh` comum; o `count` vira `geometry.instanceCount`. Sem `USE_INSTANCING`, o three não declara a `instanceMatrix`, e o `project_vertex` deixa de multiplicar por ela (era identidade: o vértice sai igual).
- Libera 4 vagas: 6 + 5 = **11**, e com o `iD`, **12 de 16**. Sobram 4 para o futuro.
- O mesmo `createBodyBatch` serve o corpo da horda, os civis (`personBatch`, `renderer.ts` 119) e os corpos no chão (`plain`): a troca vale para todos de uma vez.
- O tipo público `BodyBatch.mesh` passa de `InstancedMesh` para `Mesh`. Quem lê é o `game-crowd-three` (`group.add`, `geometry.dispose`), a área de teste do `game-characters-three` e o teste `instanced-runtime.test.ts:47` (`expect(batch.mesh.count).toBe(2)`); o próprio `body-batch.ts` escreve `mesh.count` (linhas 54 e 77). Por isso o `Mesh` ganha um `count` espelhado: `Object.defineProperty(mesh, 'count', { get: () => geometry.instanceCount, set: (v) => { geometry.instanceCount = v } })`, com `instanceCount = 0` na criação (o padrão do three é `Infinity`). O teste continua sem mudança, e o tipo público é `Mesh & { count: number }`. O `limbs.mesh.count` da linha 75 é do `flying-limbs.ts`, que continua `InstancedMesh`. Nada usa `raycast` de instância. Anotado no changeset.
- **A chave do programa muda, mesmo sem opção.** Sem `InstancedMesh`, o parâmetro `instancing` do three é falso (`WebGLPrograms.js:198`), o programa perde `USE_INSTANCING` e a chave é outra; o vértice sai igual (a `instanceMatrix` de hoje é identidade, `InstancedMesh.js:35`). Os goldens não veem isso (rodam em Node e leem atributos, não programas). O que vê é o pré-aquecimento: a sonda da horda no `ProgramWarmup` (T4.6) tem de ser montada pelo próprio `createBodyBatch` e registrada **depois** desta troca, senão aquece o programa com `USE_INSTANCING` e o jogo liga o outro na primeira horda. Ordem: a troca do lote (sem opção nenhuma, só o tipo e o `count` espelhado) é um commit próprio, o primeiro da T4b.7, puxado para **antes** do registro da horda na T4.6.
- Empacotar `iCol` e `iEye` num `vec4` foi a alternativa recusada: mexe no `BODY_CHUNK` (que declara `attribute vec3 iCol; attribute vec3 iEye;`) e quebra o teste de sha-256.
- **Teste já na T4b.7:** soma as vagas do programa do corpo (atributos da geometria, mais `instanceMatrix` se for `InstancedMesh`, mais os de instância, `mat4` contando 4) e exige `≤ MAX_VERTEX_ATTRIBS − 2` (16 no WebGL2, folga de 2). Escrito antes da troca, o teste falha com o lote de hoje (15) e passa depois dela (12).

**O shader.** O `BODY_CHUNK` fica byte a byte (teste `instanced.test.ts` 21-22, fixture `game-body-chunk.json`). O código novo vai em `BODY_CHUNK_EXT`, incluído depois dele só quando `createBodyMaterial` recebe `{ identity: true }` ou `{ segmentClips }`:

- `#ifdef USE_IDENTITY`: declara `attribute vec4 iD`; define `bodyAnimX(position, n)`, que chama o `bodyAnim` de sempre e depois aplica a pose `stagger` (índice 8, que o `BODY_CHUNK` trata como a pose padrão) como inclinação e balanço a partir do pé, a inclinação e o tombo do `iD.w` e o jeito de andar do `iD.y`; e os valores para a tinta dos ferimentos e a paleta da calça no fragmento.
- `#ifdef USE_SEGMENT_CLIPS`: a leitura da textura de clipes (§11.1.3) no lugar do `bodyAnim` para quem tem clipe.
- Sem as opções, o `onBeforeCompile` gera o mesmo texto de hoje (a escolha é em JavaScript, não por `#define`), e o material não sobrescreve `customProgramCacheKey`: a chave é a mesma da troca do lote acima (que já mudou por `USE_INSTANCING`), e o golden de instâncias do `game-crowd-three` não muda.
- **Com as opções, a chave tem de mudar à mão.** `createBodyMaterial` não define `customProgramCacheKey` (`body-material.ts:18-48`), e a chave padrão do three é `onBeforeCompile.toString()` (`Material.js:109-111`, entra na chave em `WebGLPrograms.js:366,408`). O texto da função é o mesmo com e sem o `BODY_CHUNK_EXT` (a escolha está numa variável do fecho), então um material com `identity` e outro sem teriam a mesma chave, e o three reusaria o programa do primeiro que compilou para os dois. Por isso, **só quando `identity` ou `segmentClips` está ligado**, o material define `material.customProgramCacheKey = () => '|body-ext:' + (identity ? 'i' : '') + (segmentClips ? 's' : '')` (o mesmo vale para a variante `depth` e para o `customDistanceMaterial`, que recebem as mesmas opções). Sem opção, a função padrão fica. Teste na T4b.7: dois materiais, com e sem `identity`, desenhados na mesma cena, dão duas chaves diferentes (pelo `programKeysOf` do `game-render-three`).

| Eixo | Hoje | Novo | Chamadas a mais |
|---|---|---|---|
| Tipo e variante assada | 20 corpos × 3 níveis | igual | 0 |
| Altura, largura | `iB.x`, `iB.y` | igual | 0 |
| Pele, tinta da idade | `iC.w`, `iC.y` | igual | 0 |
| Camisa | `iCol` | igual | 0 |
| Calça | `iCol·0,45` (derivada) | paleta própria, `iD.y` bits 0–3 | 0 |
| Membros faltando e quebrados | `iC.x` (10 bits) | igual | 0 |
| Feridas e sangue por região | — | `iD.x`: 12 bits mais 4 de frescor | 0 |
| Fase e passada | `iA.w`, `iB.z` | a cadência por personalidade entra na fase (CPU) | 0 |
| Jeito de andar | — | `iD.y` bits 4–6 (manca do lado, arrasta, cambaleia) | 0 |
| Mistura de clipes | — | `iD.z`: clipe B (4 bits) e mistura (8 bits) | 0 |
| Inclinação pelo empurrão; tombo do arremessado | — | `iD.w`: ângulo (8 bits) e quantidade (8 bits) | 0 |
| Pose `stagger` | — | índice 8 em `INSTANCE_POSES`, desenhada pelo `BODY_CHUNK_EXT` | 0 |
| Acessórios | — | `iD.y` bits 7–10. Um lote por tipo de acessório e nível (LOD0 e LOD1) | +8 fixas (4 tipos × 2 níveis), não por eixo nem por variante |
| Impostor | — | 1 atlas, 1 lote (§11.1) | +1 |
| Sombra-mancha | — | 1 lote de quadrados (§11.1) | +1 |

**Acessórios e o pivô de cada variante.** As 20 variantes assadas diferem em `s` e `bulk` (`renderer.ts` 99-101), então a cabeça e as costas ficam em lugares diferentes em cada uma. Um lote por acessório × silhueta seria 4 × 2 × 6 = 48 chamadas; foi recusado. **Decisão:** o acessório é assado uma vez, no pivô da cabeça (ou das costas) do corpo de referência, e o lote do acessório tem um atributo próprio por instância, `iAcc` (`vec4`: deslocamento `xyz` do pivô da variante em relação ao de referência, e `w` a escala da cabeça da variante). O `game-crowd-three` calcula esse deslocamento uma vez por variante, ao assar, a partir das juntas da variante. O lote do acessório não precisa de `iCol` nem de `iEye` (a cor vem do `vcol` e da identidade): 6 + `iA`, `iB`, `iC`, `iD`, `iAcc` = 11 vagas. É animado pelo mesmo `bodyAnimX` com o `bone` da cabeça (1) ou do tronco (0).

**Teto de chamadas** (por quadro, com qualquer número de agentes e qualquer variedade):

| Passe | Hoje | Novo |
|---|---|---|
| Principal: corpos (20 × 3) + `plain` | 61 | 61 |
| Principal: acessórios, impostor, mancha | — | 8 + 1 + 1 |
| Principal: civis (um lote por civil desenhado, `renderer.ts` 114-121) | C | C |
| Sombra (uma luz com sombra): lotes que projetam | LOD0 e LOD1: até 40, mais os civis (C) | só LOD0: até 20, mais os acessórios do LOD0 (4), mais C |
| **Total** | até 101 + 2C | até **95 + 2C** |

Nas fases `dense_horde` e `chain_horde` não há civis (C = 0): o teto medido é **95** (`renderer.info.render.calls`, que conta o passe de sombra). Com mais de uma luz com sombra, o passe de sombra conta uma vez por luz; a sala usa uma.

Os acessórios usam os construtores de cabelo e chapéu do kit: o conteúdo vem do `game-characters-people` e da roupa do `game-characters-undead`. A composição (L5) passa as geometrias por opção, `accessories: { kind, geometry(lod) }[]`. Nada é desenhado à mão (CLAUDE.md §1).

## 11. Escada de economia (D12)

### 11.1 Degraus 1 a 3, já na Fase 4b (`game-crowd-three` e `game-characters-three`)

1. **Sombra real só perto, mancha no resto.**
   - `LOD_CASTS_SHADOW` passa de `[true, true, false]` para `[true, false, false]`.
   - No LOD0, só os `nearShadows` (padrão 48) mais próximos da câmera vão para o lote que projeta sombra. Isso é feito por um segundo lote LOD0 com `castShadow = true`, alimentado pelos primeiros 48 em distância; os demais vão para o lote LOD0 sem sombra. São +20 chamadas fixas no passe principal, mas o passe de sombra cai de até 40 lotes para até 20.
   - **Decisão:** em vez do lote duplicado, uma opção mais barata é `castShadow` no LOD0 inteiro com `LOD_DISTANCES[0]` de 18 m, o que já limita a contagem pela distância. A medição da T4b.10 escolhe entre as duas. O padrão é a segunda (sem lote duplicado); o lote duplicado é o degrau 1b.
   - `createBlobShadowBatch(three, { max })` faz um disco escuro por agente fora do LOD0, num quadrado deitado, com `depthWrite false` e mistura multiplicativa. É uma chamada.
2. **Impostor depois do LOD2.**
   - Começa em `impostorFrom` (padrão 90 m) e vai até `farCull` (200 m, como hoje).
   - Atlas assado no carregamento a partir das geometrias LOD2: 6 silhuetas (magro, médio, largo, brutamonte, inchado, rastejante) × 8 ângulos × 8 quadros do andar, em células de 64 × 128 num 2048 × 1536.
   - Cada texel guarda o **grupo do segmento** (cabeça, tronco, braço esquerdo, braço direito, pernas) no canal R, o sombreado em G e a cobertura em A. O atlas é RGBA8 com `NearestFilter`: o grupo é um índice e não pode ser interpolado entre texels.
   - O shader pinta pelo grupo: pele com a tinta da idade, camisa `iCol`, calça da paleta. Ele descarta os grupos que `missing` tira. O quadro é `floor(fract(fase)·8)`.
   - A identidade (cores e membros) é a mesma do corpo de perto. O atlas é uma só textura: o impostor é **uma** chamada.
   - O material se registra no `ProgramWarmup` (A6: 0 programas durante o jogo).
3. **Clipes de segmentos em textura** (o "VAT" da D12, adaptado ao corpo do kit).
   - `bakeSegmentClips` (no `game-characters`, puro) amostra a 30 Hz, para cada clipe, a rotação (quaternion) e o deslocamento de cada um dos **12 ossos** do corpo instanciado (`body-chunk.ts` 2). Os clipes vêm do que o kit já tem: andar por perfil de tipo (`types.json` `gait`), cambalear, cair de frente, cair de costas, levantar, rastejar e arremesso.
   - **Mapa de 17 segmentos para 12 ossos.** Os clipes do kit animam os 17 segmentos do `game-characters` (`segment-tree.ts`); o corpo instanciado tem 12 ossos (`body-geometry.ts`). O lado vai pelo sinal de x da junta, como o `body-geometry` faz (osso "E" = x negativo):

     | Osso | Segmentos | Nota |
     |---|---|---|
     | 0 tronco | `torso` (pelve junto) | a pelve não tem osso próprio; a curva entre pelve e tronco se perde, e o osso 0 usa a transformação do `torso` |
     | 1 cabeça | `neck`, `head` | o pescoço vai com a cabeça; usa a do `head` |
     | 2 / 3 braço E / D | braço do lado | |
     | 4 / 5 coxa E / D | `thigh` do lado | |
     | 6 olhos | `head` | cópia do osso 1 (o olho é tag à parte para o brilho) |
     | 7 / 8 antebraço E / D | `forearm` e `hand` do lado | a mão vai com o antebraço |
     | 9 / 10 canela E / D | `shin` e `foot` do lado | o pé vai com a canela |
     | 11 mandíbula | `jaw` | |

   - `createSegmentClipTexture` faz uma `DataTexture` RGBA32F de **24 texels** de largura (12 ossos × 2: quaternion e deslocamento) por quadro. Cerca de 12 clipes × 45 quadros = 540 linhas, 24 × 540 × 16 B ≈ 207 KB, uma só textura compartilhada por todos os lotes. Filtro `NearestFilter` em `minFilter` e `magFilter`, sem mipmap: RGBA32F não é filtrável sem `OES_texture_float_linear`, e mesmo com ele a interpolação misturaria ossos vizinhos. A interpolação entre quadros é feita no shader, com duas leituras `texelFetch`.
   - Com `USE_SEGMENT_CLIPS`, o `bodyAnimX` lê o osso no quadro `início + fract(fase·velocidade)·duração` do clipe A, mistura com o clipe B por `iD.z` e aplica pelo `pivot` de sempre.
   - Fase, velocidade e mistura são por instância: nunca há passo sincronizado.
   - As poses procedurais de hoje continuam como caminho padrão. Os clipes cobrem o que o código procedural não faz bem (cambalear, levantar, quedas variadas).

### 11.2 Degraus 4 a 6, depois, sem mudar a API

A API pública continua `createCrowd(options) → Crowd`, com `crowd.update(h)` e a leitura de `crowd.store`.

4. **Horda num Web Worker.**
   - `createStore(capacity, allocate)` passa a aceitar um alocador. Com `options.memory: 'shared'`, os vetores tipados nascem num `SharedArrayBuffer`.
   - `createCrowdInWorker(options)` devolve o mesmo tipo `Crowd`: `update` manda o passo, a store é a memória compartilhada, e os eventos chegam por `postMessage` e são reemitidos.
   - **Exige isolamento entre origens:** `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` (ou `credentialless`). A sala aberta por `file://` não é isolada, então o `perf.mjs` teria de servir por HTTP local com esses cabeçalhos. Todo script de CDN precisa de `Cross-Origin-Resource-Policy`, e a hospedagem do jogo tem de mandar os cabeçalhos.
   - **Alternativa sem isolamento:** dois buffers trocados por `postMessage` (transferíveis), com um quadro de atraso.
5. **Solver de contato em WASM.**
   - `contactStep` já é uma `ContactSolver` pura sobre `ContactView`. A troca é `physics.contact.solver = wasmSolver`, sobre a mesma memória.
   - Paridade: o WASM faz a conta em f64 e grava em f32, como o JS, e o teste compara bit a bit com o solver JS em 3 cenas.
6. **WebGPU:** o layout `iA`–`iD` e o atlas continuam. A troca do renderizador fica no `game-crowd-three`. A simulação em compute shader precisa do solver em WGSL e fica para uma spec à parte, como a D12 diz.

## 12. Determinismo

| Fonte de diferença | Correção |
|---|---|
| `dt` variável por quadro | `crowd.update(h)` só no `fixedSimulate`, com `h = 1/60`, até 4 subpassos (T4.1). O teste conta passos, não segundos |
| O orçamento do campo de fluxo lê o relógio (`flow.clock`, `flowBudgetMs`) | Opção nova `flow.cellsPerStep` (padrão ausente = hoje). No modo determinístico, o orçamento é de células por passo (padrão 20000) |
| `attackPose` é escrito pelo desenho (`instances.ts`) e lido pela simulação (`crowd.ts` 1242) | Opção `physics.deterministic`: a histerese de `attackPose` passa para a simulação, no passo fixo. O desenho só lê |
| Sorteios novos no `random` | Proibidos. Tudo usa `unit(identity, step, salt)` |
| Ordem de processamento | O impulso é Gauss-Seidel de ida e volta; a posição é Jacobi pela média; o campo de pressão lê só o passo anterior; o monte soma inteiros; os desempates usam a `identity`. Nenhuma iteração sobre `Map`/`Set` de agentes. A remoção troca com o último, como hoje, e isso é determinístico. O que ainda depende da ordem dos índices é o arredondamento float32 do impulso: muda bits, não o comportamento (teste "Ordem de nascimento") |
| Explosão chegando no meio do quadro | Entra na fila e é resolvida no início do passo seguinte. O mundo de destruição também roda no `fixedSimulate` |
| Orçamento de tempo do agendador | Só para a apresentação. Nada da simulação espera fila medida em ms |
| Motor JavaScript diferente | `Math.exp` não tem arredondamento garantido entre motores. A promessa vale **no mesmo motor**: `λ` é calculado uma vez e as probabilidades usam `exp`. Determinismo entre navegadores fica fora do escopo |

```ts
export type CrowdPhysicsOptions = {
  readonly contact?: CrowdContactOptions | boolean
  readonly pressure?: CrowdPressureOptions          // needs contact
  readonly balance?: CrowdBalanceOptions | boolean      // needs contact
  readonly mound?: CrowdMoundOptions | boolean          // needs balance
  readonly thrown?: CrowdThrownOptions | boolean        // needs balance
  readonly blast?: CrowdBlastOptions
  readonly personality?: CrowdPersonalityOptions | boolean
  readonly door?: { readonly pressureDamage?: number }
  /** Flow budget in cells per step, attackPose in the simulation, positions kept for interpolation. */
  readonly deterministic?: boolean
}
// CrowdOptions
readonly physics?: CrowdPhysicsOptions
// CrowdUpdateContext (additive; absent = today: the player, or flowTarget without one, as in crowd.ts 975-980)
/** Centre of the relevance bands, for scenes without a player near the agents (tests, benches, cutscenes). */
readonly bandCentre?: readonly [number, number]
readonly flow?: { readonly radius?: number; readonly clock?: () => number; readonly cellsPerStep?: number }
// game-crowd exports
export const CROWD_PHYSICS_DEFAULTS: CrowdPhysicsOptions // everything on, deterministic, the numbers of this document
```

**Padrões:** `physics` ausente quer dizer comportamento de hoje, bit a bit. `crowd.blast` existe sempre; sem `physics`, faz só dano, morte, `pileBlast` e atordoamento. A sala de testes (`crowd_area`, com o controle `physics`) e o jogo passam `CROWD_PHYSICS_DEFAULTS`. Uma dependência que falta (por exemplo `mound` sem `balance`) faz `createCrowd` lançar erro com a lista do que falta.

Contadores novos em `crowd.stats.physics`, todos zerados no OFF:

```ts
physics: {
  contacts: number; maxOverlap: number; meanOverlap: number
  falls: [pressure: number, shove: number, trip: number, landing: number, collapse: number, blast: number]
  fallsBeyondBlast: number           // chain falls: cause shove/landing/collapse/trip within 240 steps of a blast, of an agent whose own direct shove from it was below shoveStagger
  fallen: number; staggering: number; climbers: number; moundMax: number
  thrownActive: number; thrownPeak: number; blastChecks: number; chainLinks: number
}
```

## 13. Plano de testes

Todos em `vitest`, sem three, com `flow: { cellsPerStep: 20000 }` e `physics: CROWD_PHYSICS_DEFAULTS`, salvo indicação. O driver de passo fixo é dos testes:

```ts
/** Runs `steps` fixed steps fed by frames of 1/fps, the scheduler's accumulator (at most 4 substeps). */
const runFixed = (crowd: Crowd, fps: number, steps: number, each?: (step: number) => void): void
```

### 13.1 T4b.2 (`game-crowd`)

Cena base `queue`:

- semente 11, pacote morto-vivo, grade padrão, `personality` ligado;
- **centro das faixas** `bandCentre: [0, −11]`, no meio da fila. Sem ele, o centro seria o `flowTarget` (a 50 m, faixa R1); com ele, todos ficam a menos de 12 m e entram na R0 já no primeiro passo (quem nasce está na faixa 3 e desce enquanto `d < max − 10`, ou seja, entra na R0 a menos de 25 m);
- 240 walkers (tipo 0) em empacotamento hexagonal: fileiras de 6 a cada 0,45 m, as ímpares deslocadas 0,3 m, vizinho mais perto a 0,54 m; de `z = −2` a `z = −19,55`, todos em `CHASE`;
- muro sólido (`CELL.SOLID`, 3 m) atravessando a rua em `z = −20,5`, e `flowTarget: [0, −60]` atrás dele: a fila anda para o muro e **se comprime contra ele** antes da explosão;
- 300 passos de compressão (5 s; o campo da §4.5 chega ao regime em ~40 saltos mais ~60 passos de média);
- granada m67 (`energy 200000`, `radius 15`, `lethalRadius 5`) em `(0, 0,3, −3)`, dentro das primeiras fileiras, no passo 300.

**O que a física desta cena alcança** (contas da §7.2 e da §7.3):

- antes da explosão, a frente encostada no muro chega a ~862 N (τ efetivo 0,710 no hexágono a ±30°, limite `250/0,290`; ~702 N com a geometria inicial a ±33,7°): 0,63 de `P_crit`. Nenhum walker cai por `PRESSURE` (precisaria de estabilidade abaixo de 0,63; a personalidade começa em 0,75, e só uma vizinhança inteira de `drive` perto de 1,3 levaria o limite a ~1120 N); os de estabilidade abaixo de ~0,90 cambaleiam na frente, a ~17 m da explosão, longe do contador da cadeia;
- queda direta (causa `BLAST`) até 6,7–8,6 m; cambaleio direto até 9,9 m;
- além de 9,9 m, a cadeia só chega por **pouso**: os corpos que estavam a menos de ~1,5 m do ponto (25 nesta cena, 12 deles lançados para o lado do muro) pousam entre 9,5 e 11 m com `v_h` de 6 a 6,7 m/s e derrubam quem está a 0,7 m (`Δpush` ≈ 3 m/s). Só caem em cima da fila os que saem a menos de ~10° do eixo dela (a fila tem 3,3 m de largura); os outros pousam no chão vazio. Daí o piso baixo do aceite;
- o empurrão pelo contato (a "bola de neve" dos corpos empurrados para dentro da fila) soma menos de 0,5 m/s além de 10 m: cambaleia, não derruba. Isso é o modelo, não uma falha: uma onda de quedas por contato puro além do cambaleio direto não é física com estes números.

| Teste | Aceite |
|---|---|
| Queda direta | Em 240 passos depois da explosão: ≥ 20 quedas com causa `BLAST`, todas de agentes a menos de 9,0 m do ponto (8,6 m mais folga) |
| Queda além da explosão | `stats.physics.fallsBeyondBlast` entre **2 e 15** nos 240 passos (se a implementação der menos de 2 com estes números, alarga-se a fila para 8 colunas em vez de baixar o piso). Cada uma é uma queda com causa `LANDING`, `SHOVE`, `COLLAPSE` ou `TRIP`, de um agente cujo `directShove` daquela explosão ficou abaixo de `shoveStagger` (1,2 m/s, ou seja, estava a mais de 9,9 m) |
| A onda anda no tempo | Toda queda contada em `fallsBeyondBlast` acontece pelo menos 30 passos depois da explosão (o voo mais curto que alcança 9,9 m dura ~0,8 s, 48 passos). A mediana do passo dessas quedas é maior que a mediana do passo das quedas `BLAST` |
| Brutamonte segura | Mesma cena, com a fileira em `z ≈ −9,7` (6,5 a 7 m do ponto) toda de brutes: **zero** quedas de brute. Na cena de controle (sem brutes), ≥ 50% dos walkers dessa fileira caem |
| Ordem de nascimento | A mesma `queue` nascida da frente para trás e de trás para a frente (os mesmos lugares, índices invertidos; as identidades seguem o lugar, por `serial` do lugar): o total de quedas depois da explosão difere em no máximo 10%, e `fallsBeyondBlast` em no máximo `max(1, 10%)` |
| Passo fixo | A cena `queue` a 30, 60 e 144 fps até 540 passos. Os `Float32Array` `x`, `z`, `y`, `pushX`, `pushZ`, `hp` e os `Uint8Array` `balance` e `state` são iguais byte a byte, assim como `n` e a sequência de eventos (`fall`, `kill`, `blasted`) |
| Uma passada | Uma explosão sobre 2000 agentes: `blastChecks === 2000`. Duas no mesmo passo: `4000` |
| Arremessados | `thrownPeak ≤ 32`. Todo arremessado pousa em ≤ 3 s. Pelo menos 1 queda com causa `LANDING`. Depois de remover 50 agentes no meio do voo (inclusive arremessados), cada vaga ativa confere `store.identity[agent] === identity` |
| Parede no voo | Explosão encostada num muro sólido, corpos a 15 e 20 m/s: nenhum pousa do outro lado |
| Sorteio isolado | Com a física ligada, a explosão não avança o fluxo `random`: o próximo `R()` depois do `blast` é o mesmo de uma horda gêmea sem a explosão |
| OFF intacto | `tests/team-golden.test.ts` sem nenhuma mudança e passando. Uma cena dos goldens com `physics: undefined` ou com `physics: {}` dá snapshots iguais |
| Sem explosão sem física | `blast()` com `physics` ausente: dano e morte, nenhum campo de física escrito |

### 13.2 T4b.6 (`game-crowd`)

**Coluna** (teste do campo, sem a cena `pen`): N walkers (personalidade desligada, estabilidade 1) em fila indiana, a 0,48 m um do outro, encostados num muro sólido, `flowTarget` atrás do muro, `bandCentre` na fila.

| Teste | Aceite |
|---|---|
| A frente soma a fila | Para N ∈ {2, 4, 6, 10}: depois de N passos, `field` do da frente dentro de ±25% de `N·driveForce` (o modelo dá 492, 956, 1392 e 2188 N, de 0,99 a 0,87·N·D; os de trás cambaleiam e continuam empurrando inteiro, §4.5). Depois de N + 60 passos, a média `P` também |
| Um salto por passo | No passo k < N, o `field` do da frente não passa de `D·(1 − τ^(k+1))/(1 − τ)` (ninguém além de k saltos atrás contribui ainda) |
| Limiar por tipo | Walkers: N ≤ 5 → zero quedas em 600 passos (N = 5 dá 1177 N, 0,86 de `P_crit`: cambaleia, não cai); N = 10 → ≥ 1 queda com causa `PRESSURE` (2188 N, 1,59: taxa `1,5·0,59² = 0,53`/s). N = 6 (1,015) fica fora do aceite: a taxa é 0,0004/s. Brute na frente de 20 walkers: zero quedas do brute (o campo dá ~4290 N, abaixo do teto de 6000 N e do `P_crit` de 8232 N) |
| Muro plano | 240 walkers em hexágono contra o muro (a cena `queue` sem a explosão), personalidade desligada, 600 passos: `field` da frente entre 650 e 1000 N (modelo: 702 a 862 N, conforme o ângulo depois da compressão) e zero quedas `PRESSURE` |
| Sem viés de ordem | A mesma coluna com os índices invertidos: `field` igual em cada lugar (soma Jacobi sobre os mesmos pares; igual ao arredondamento de float32, `≤ 1e−3` relativo) |

Cena base `pen`:

- uma caixa fechada de 30 × 30 m, com paredes sólidas (`CELL.SOLID`) de 3 m de altura, de `x ∈ [−15, 15]` e `z ∈ [−30, 0]`;
- porta fechada de 1,2 m em `(0, 0)` no eixo `x` (`doors.add(0, 0, 'x', 1.2)`);
- alvo em `(0, 4)`, do outro lado; `bandCentre: [0, −10]`;
- semente 21; N agentes pela mistura padrão de tipos, espalhados por `unit` em `z ∈ [−28, −10]`.

**De onde vem a meta de 1% a 16% de quedas** (N = 800, 30 s; refeita na revisão 2 por script, com as fórmulas da §4.5 e da §5.2). A horda converge para a porta e forma um semicírculo encostado na parede: 800 corpos a ~0,55 m dão um raio de ~12 m e K = 22 fileiras, com `n_k ≈ π·k` agentes na fileira k (Σ = 795). O fluxo radial concentra a força: o que a fileira k + 1 passa adiante se divide por menos agentes na fileira k. Em regime (walkers, `D` = 250 N, cambaleantes empurrando inteiro):

```
f_k = min(cap, D + τ·w · f_(k+1) · (k + 1)/k)      τ·w = 0,97 · 0,732 = 0,710,  f_23 = 0,  cap = 6000 N
```

| Fileira k (1 = na porta) | 1 | 2 | 3 | 4 | 5 | 6 | 10 | 14 | 18 | 22 |
|---|---|---|---|---|---|---|---|---|---|---|
| `f_k` (N) | 2963 | 1910 | 1559 | 1382 | 1276 | 1204 | 1048 | 941 | 760 | 250 |
| `f_k / P_crit` | 2,16 | 1,39 | 1,14 | 1,01 | 0,93 | 0,88 | 0,76 | 0,69 | 0,55 | 0,18 |
| `n_k` | 3 | 6 | 9 | 13 | 16 | 19 | 31 | 44 | 57 | 69 |

Fração dos agentes acima do crítico (estático, antes de qualquer queda), pesada por `n_k`:

| `criticalFactor` | Estabilidade 0,75 / 1,0 / 1,25 | Média da personalidade (triangular 0,75–1,25) | Cambaleando (`> 0,7·P_crit`), média |
|---|---|---|---|
| 0,8 (o desenho antigo) | 91% / 83% / 68% | 81% | — |
| 2,0 (o padrão) | 22% / 4,0% / 1,2% | **4,2%** | 35% |

Quem está acima do crítico só cai pelo sorteio de `fallRate·(P/P_crit − 1)²` por segundo (§5.2), então quem passa pouco do crítico pode levar mais de 30 s. Integrando a chance de cair pelo menos uma vez em 30 s sobre a personalidade, **sem renovação** (ninguém sai do lugar), dá **2,3%** dos 800. **Com renovação** (quem cai deixa de empurrar e de receber, os de trás sobem no monte e o lugar volta a ser ocupado; um ciclo de cair, `fallenMin` 1,5 s, reação e `getUpSeconds` 1,2 s, de 3 a 4 s, mais o tempo até a queda; no máximo 7 rodadas por lugar), dá **7,3% a 8,0%**. O aceite fica de **1% a 16%**: metade do valor sem renovação e o dobro do valor com renovação, porque a conta é de campo médio e a `pen` mistura tipos (runner, blind e charred caem antes; brute e bloater depois). As quedas por pressão desta cena vêm das fileiras 1 a 4 do funil; nenhuma do muro plano longe da porta. O histograma de `P/P_crit` (§15) confere o estático (≈ 4%) na T4b.6.

| Teste | Aceite |
|---|---|
| Sobreposição | N = 400, depois de 600 passos: `maxOverlap ≤ 0,12` m e `meanOverlap ≤ 0,03` m |
| Energia parada | `contactStep` direto: 300 corpos num quadrado de 8 × 8 m, `v ≡ 0`, `push` inicial `unit`·2 m/s, sem quedas. Para todo passo, `K(t+h) ≤ K(t)·(1 + 1e−6)`, com a massa efetiva da §4.4. Em 3600 passos (60 s), `K ≤ 1e−6·K(0)` |
| Separação com teto | N = 400 espremidos: `|dv − t·sp| ≤ separationMax + 1e−6` em todo agente R0 |
| Sem pressão, zero quedas | N = 200 em campo aberto (sem caixa), num disco de 24 m de raio em volta do `bandCentre` (densidade de 1 por 9 m², todos dentro dos 25 m de entrada na R0), `target: null` (vagam), 3600 passos: `falls` todos 0 e `staggering` máximo 0 |
| Espremidos no muro | N = 800, 1800 passos (30 s): entre **1% e 16%** caíram em algum momento, todas as quedas `PRESSURE` a menos de ~3 m da porta (fileiras 1 a 4, mais folga); no pico, `fallen ≤ maxFallen` (300). `climbers ≥ 10` no pico. Ao menos um agente com `y ≥ 0,5` |
| Teto do monte | Mesma cena com `mound.maxHeight = 0,9`: `max(mound) ≤ 900` mm em todos os passos |
| Monte sem ordem | `mound` igual inteiro a inteiro com a ordem dos agentes invertida (mesmos corpos nos mesmos lugares) |
| Porta pela pressão | N = 800: a porta cai em ≤ 30 s. Com `door.pressureDamage = 0`, a porta cai **depois** disso (só pelos golpes) |
| Levantar | N = 800. No passo 1200, alvo `null` e a porta é aberta (`doors.open`). No passo 2100, os caídos vivos são ≤ 10% do pico |
| Desabamento | Montagem à mão: três caídos empilhados na mesma célula e um agente em pé em cima (`y ≈ 0,84`). Remover a base (`remove`). Em ≤ 60 passos, o de cima tem `y` menor e está `STAGGERING` ou `FALLEN`, com causa `COLLAPSE` |
| Mesma semente | `pen` com N = 800 rodado duas vezes: tudo igual byte a byte |

### 13.3 T4b.9 (`game-crowd` e `game-crowd-three`)

Cena: 2000 agentes, semente 7, num quadrado de 60 × 60 m, `personality` ligado, `bandCentre` no meio.

**Fase: independente, não distribuída.** A fase continua saindo do `random` na ordem do jogo (`phase = R()·10`, `crowd.ts` 322), uma por agente, independente das outras; a cadência por personalidade (0,88 a 1,12) as afasta ainda mais com o tempo. Atribuir fases de propósito (ruído azul entre vizinhos) foi recusado: exige conhecer os vizinhos no nascimento, deixa de valer assim que eles andam e mudaria o sorteio do golden. O limiar então tem de ser um que fases independentes atingem: para 9 fases uniformes independentes, `P(1 − R ≥ 0,35)` é só 98,2%, abaixo dos 99% pedidos; `P(1 − R ≥ 0,25)` é 99,65% e `P(1 − R ≥ 0,2)` é 99,9% (Monte Carlo, 200 mil amostras). O padrão fica em **0,25**, com folga sobre os 99%.

| Teste | Aceite |
|---|---|
| Assinatura de aparência | Assinatura = hash(tipo, variante, camisa, calça, `round(height/0,02)`, `round(build/0,02)`, feridas, acessórios). Dos pares a menos de 3 m, no máximo 1% com assinatura igual |
| Fora de fase | Para cada agente, o ângulo `φ = 2π·fract(fase)` dele e dos 8 vizinhos mais próximos tem espalhamento circular `1 − R ≥ minPhaseSpread` (padrão 0,25) em ≥ 99% dos agentes, medido no passo 0 e de novo no passo 600. O coeficiente de variação da cadência entre os 9 é ≥ 0,05 |
| Mesma identidade em todo LOD | `createCrowdInstances`, com a câmera posta para forçar LOD0, LOD1, LOD2 e impostor, para 200 agentes sorteados. A assinatura decodificada da instância (`iCol`, `iC.x`, `iD.x`, `iD.y`, escala) é igual nos 4 |
| Mesma semente | Duas hordas com semente 7: assinaturas iguais. Semente 8: menos de 5% das assinaturas na mesma posição de índice são iguais |
| Prova visual | Print perto (câmera a 4 m) e longe (a 120 m), na `crowd_area` com 2000, em `specs/005-camadas-e-quadro/shots/` |

## 14. `perf.mjs`: fases `dense_horde` e `chain_horde`

O `perf.mjs` ganha `PERF_GPU=intel|nvidia` (contagem: intel 1000, nvidia 2000; no CI, 2000 em modo contadores) e `PERF_PHASES` para rodar só algumas fases.

**A `crowd_area` no quadro.** Hoje a área chama `crowd.update(dt)` no próprio `frame(dt)` (`bench/module.ts`, com o `dt` do quadro). Com a física, ela registra `crowd.update(h)` no `fixedSimulate` do `game-runtime` (§3), e o resto do `frame` (jogador, civis, manada, desenho) fica onde está. Sem a física, nada muda.

**O estado da bancada é aplicado nesta ordem**, sempre, qualquer que seja a ordem na URL:

1. `seed`: recria o mundo (`build(seed)`);
2. `scene`: `scene.layout(grid, doors)` escreve a grade e as portas;
3. `physics`: recria a horda com `physics` (ela nasce com as opções; trocar depois não vale);
4. `count`: os agentes nascem por `scene.spawn(crowd, count, unit)`, não pelo `place()` de hoje (que sorteia em volta do jogador e ignoraria a cena).

Depois, **assar todos os tipos antes de medir**: `renderer.bake()` para todos os tipos do pacote (hoje o assado é preguiçoso, `bakeSeen`, e o primeiro de cada tipo custaria um quadro longo dentro da medição). Cada fase de horda recarrega a página:

```js
await page.goto(`${url}?area=crowd_area&bench.crowd_area=scene=dense_wall;count=${HORDE};physics=1;seed=21`)
await page.waitForFunction((n) => window.__testRoom.metrics().module.agents >= n, HORDE)
```

A métrica de cada fase vem de `window.__testRoom.metrics().module`. A `crowd_area` passa a publicar:

`falls_pressure`, `falls_chain` (= `fallsBeyondBlast`), `falls_landing`, `climbers`, `mound_max`, `thrown_peak`, `max_overlap`, `chain_links`, `links_per_step_max`, `crowd_ms_p99` (tempo de `crowd.update` por quadro, somando os subpassos, medido pela área, fora da horda pura) e `draw_calls` (`renderer.info.render.calls`, com o passe de sombra).

**Linha de base antes dos orçamentos.** Os tetos de `crowd_ms_p99` (4 ms na nvidia, 6 ms na intel) são provisórios. Antes de qualquer código da física, a T4b.2 mede o `crowd.update` de **hoje** com 1000 e 2000 agentes todos na R0 (a cena `dense_wall` sem física), nas duas máquinas, e grava em `docs/desempenho-explosoes.md`. O orçamento final é a linha de base mais o custo da física medido na T4b.6; se a linha de base sozinha já passar de metade do teto, a escada da D12 começa pelo degrau 4 (a horda num Worker, §11.2) em vez de cortar iterações.

| Fase | Roteiro | Orçamento |
|---|---|---|
| `dense_horde` | Cena `dense_wall` (L5): parede de 30 m feita com `wallPiece` do `game-floorplan-three` e porta de 1,2 m, a mesma geometria escrita na grade da horda. N agentes nascem atrás dela; o corpo do jogador fica do outro lado da porta. Roda 30 s, sem explosão | Os de sempre (0 quadros acima de 33,4 ms, p99 ≤ 20 ms, 0 programas; no CI, contadores) e mais: `falls_pressure > 0`, `climbers > 0`, `max_overlap ≤ 0,15`, `mound_max ≤ 1,6`, `crowd_ms_p99 ≤ 4` (nvidia) e `≤ 6` (intel), provisórios até a linha de base, `draw_calls ≤ 95` |
| `chain_horde` | Cena `chain_line` (L5): N agentes vêm por uma rua de 12 m. No caminho, 6 `propane_p13` em fila, a 1,5 m um do outro, e um carro da frota com `car_fuel_tank` (explosivos de mundo do `game-weapons-three`, carro do `game-vehicles-three`). Quando a frente passa os botijões: 3 `m67`, 1 `pg7v`, 1 `molotov` e 10 tiros de fuzil na horda (pelo `equip`/`use` de hoje) | Os de sempre e mais: `falls_chain > 0`, `chain_links ≥ 4`, `links_per_step_max ≤ 1` (contado em passos fixos do mundo de destruição, não em quadros), `thrown_peak ≤ 32`, `falls_landing > 0`, `draw_calls ≤ 95` |

O `perf.json` grava os contadores de cada fase. A T4b.10 copia os números das duas máquinas para `docs/desempenho-explosoes.md`.

## 15. Riscos e plano de medição

| Risco | Medição | Saída |
|---|---|---|
| O golden muda com a opção desligada | `team-golden.test.ts` no CI; um teste novo com `physics: {}` | Todo código novo atrás de `if (physics…)`; nenhum sorteio novo |
| O shader do jogo muda | `game-characters-three/tests/instanced.test.ts` (sha-256 do `BODY_CHUNK`, fixture `game-body-chunk.json`) sem mudança e passando | Código novo só no `BODY_CHUNK_EXT`, incluído por opção do material |
| A pressão sai alta ou baixa demais (a meta de 1% a 16% é uma conta de campo médio, §13.2) | Histograma de `P/P_crit` na cena `pen` (contador opcional por faixa de 0,25), comparado com a fração estática prevista (≈ 4% acima do crítico, 35% acima de 0,7) | Ajustar `criticalFactor`, `transmission` e `driveForce` pelo teste "espremidos"; o teste "Coluna" não muda, porque fixa o campo e não a calibração |
| Custo da R0 com 2000 agentes espremidos: a célula e as 8 vizinhas têm ~40 candidatos (9 m² a ~4,6 corpos/m²). Por iteração, ida e volta do impulso mais a correção = 3 varreduras: 2000 × 40 × 3 × 2 iterações ≈ 480 mil testes de par por passo, mais o campo (~6 contatos por agente). A ~5 ns por teste em JS, ~2,4 ms por passo; a 30 fps, 2 subpassos, ~4,8 ms, acima dos 4 ms da nvidia | Linha de base de hoje (§14) e `crowd_ms_p99` no `perf.mjs`; o perfil da fase | Na ordem: a horda num Worker (degrau 4 da D12, já desenhado em §11.2, e a saída planejada se a linha de base mostrar que o JS na thread principal não cabe); 1 iteração; contato a cada 2 passos na metade mais longe da R0 (contado em passos, segue determinístico) |
| `hHead.fill(-1)` de 589 mil células, duas vezes por passo | Perfil | Limpar só as células tocadas (lista); com a opção desligada o caminho de hoje fica |
| Espiral da morte num quadro lento | `scheduler` com no máximo 4 subpassos (T4.1) | A horda fica em câmera lenta, não trava |
| Limite de 16 atributos de vértice (hoje 15: 6 + `instanceMatrix` 4 + 5) | Teste na T4b.7 que soma as vagas do programa do corpo e do acessório e exige `≤ MAX_VERTEX_ATTRIBS − 2` | Lote em `Mesh` + `InstancedBufferGeometry` (§10.3): 12 no corpo, 11 no acessório |
| Impostor e clipes compilando no jogo (A6) | `perf.mjs` com 0 programas | Os dois materiais se registram no `ProgramWarmup`; atlas e textura no carregamento |
| Sonda da horda aquecendo o programa errado (a troca `InstancedMesh` → `Mesh` muda a chave, §10.3; com opções, a chave só muda por `customProgramCacheKey`) | `perf.mjs` com 0 programas na primeira horda; teste das duas chaves (§10.3) | Troca do lote antes do registro da T4.6; sonda montada pelo `createBodyBatch`; chave própria só com opções |
| Arremessado atravessando parede | Teste: explosão encostada numa parede sólida, corpos a 15 e 20 m/s, nenhum pousa do outro lado | `solidAt` no ponto até 0,25 m por passo; acima disso, varredura célula a célula (§7.3) |
| Vaga do pool apontando para outro agente depois de uma remoção | Teste dos arremessados com 50 remoções no meio do voo | `thrown.remap(i, j)` dentro do `remove` (§7.3) |
| Agente preso no pé de um monte alto (o campo de fluxo não vê o monte) | Contador `stuck` por mais de 3 s na cena `pen` | O `tryStep` vale também contra o monte (`pile` ou `mound` na célula da frente) |
| Som e ruído de porta 60 vezes por segundo | Contagem de `sound` por segundo na cena `pen` | Golpes discretos a cada `attackEvery` |
| O passo 4 (Worker) exige COOP/COEP | — | Alternativa de buffers transferíveis já desenhada (§11.2) |
| Determinismo entre navegadores | — | Fora do escopo, documentado |

Medição na T4b.10: as duas fases nas duas máquinas, com `PERF_MODE=gpu`. Na PRIME, com o offload da NVIDIA, como no README da sala. Se não couber, sobe-se a escada pela ordem da D12, e o degrau usado e os números antes e depois ficam registrados.

## Aceite

```sh
pnpm --filter @adatechnology/game-crowd test            # goldens of today unchanged + T4b.2, T4b.6, T4b.9 (simulation side)
pnpm --filter @adatechnology/game-crowd-three test      # T4b.9 identity across LOD and impostor, instances golden unchanged
pnpm --filter @adatechnology/game-characters-three test # instanced.test.ts (BODY_CHUNK sha-256) unchanged; MAX_VERTEX_ATTRIBS budget
pnpm --filter @adatechnology/game-characters test
pnpm --filter @adatechnology/game-destruction test      # chainLinksPerUpdate, chain id, today's goldens with the default
pnpm -r typecheck
pnpm check:layers
node examples/crowd-test-area/test.mjs
node examples/test-room/perf.mjs                                      # CI: counters, 2000 agents
PERF_MODE=gpu PERF_GPU=nvidia PERF_PHASES=dense_horde,chain_horde node examples/test-room/perf.mjs
PERF_MODE=gpu PERF_GPU=intel  PERF_PHASES=dense_horde,chain_horde node examples/test-room/perf.mjs
```

## Perguntas em aberto

1. **A pressão da horda esmaga o jogador?** Hoje o jogador só é agarrado, golpeado e derrubado (`knock`). Recomendação: fora da Fase 4b. Ele continua fora do contato; numa spec de jogo, a pressão na frente dele vira `knock` e dano de esmagamento acima de um limiar. É uma escolha de jogabilidade do dono, não técnica.
