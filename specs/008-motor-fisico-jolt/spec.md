# Spec 008 — Jolt como motor físico único do kit

Decisão do dono em 2026-11-13. Substitui a spec 008 anterior ([`../008-solver-de-contato-dos-destrocos/`](../008-solver-de-contato-dos-destrocos/),
commit `5ae2a9aa`), que reescrevia o solver de contato próprio dos destroços. Aquela pasta fica como registro histórico, com as sondas da sala
(`decision/probes/`) que esta spec continua usando.

Fontes desta spec (lidas na íntegra, não por resumo): `GATE0-REPORT-jolt.md`, `DECISION-ENGINE-fable.md`, `REPORT-ENGINE-jolt.md`,
`DECISION-fable.md` §2 e `ENGINE-BRIEF.md`, na pasta de rascunho `item6-escalation/` da sessão de 2026-11-13. Código do spike: branch
`spike/engine-jolt`, worktree `adatechnology-game-kit-wt/engine-jolt`.

## 1. Problema

O kit tem física própria espalhada: o `PieceSystem` dos destroços (`game-destruction-three`), o andar arcade dos carros
(`game-vehicles-driving`), a separação da multidão (`game-crowd`) e o raio de `DestructionWorld.raycast`. Nenhum deles faz ragdoll, juntas que
quebram ou pilhas pesadas. O solver dos destroços falha a bacia (82/128 casos pelos critérios de energia) e lança peças na sala (blast: 0,22–0,60 m
de lift).

O kit precisa servir a um jogo tipo GTA (`CLAUDE.md` §2): destroços, props empurrados, ragdolls, veículos, multidão e consultas, todos no mesmo
mundo. Dois motores no kit não é aceitável.

## 2. Decisão

**Um motor de corpos rígidos para o kit inteiro: Jolt**, pelo pacote oficial `jolt-physics` do npm (publicado por jrouwe, autor do Jolt, MIT),
**versão fixada** (hoje `1.1.1`, variante `wasm-compat` de uma thread).

- **Sem fork.** Sem build próprio do wasm. Toda correção vive no nosso adaptador (`game-physics-jolt`) ou na costura do domínio
  (`engine-*.ts` de cada pacote).
- Nossas camadas de domínio continuam nossas e ficam **por cima** do motor (seção 4).

### 2.1 Por que Jolt (números do spike e do gate 0)

| Ponto | Jolt | Rapier (spike B) | Próprio (`74774f11`) |
|---|---|---|---|
| Bacia, 64 sementes × dt {0,05; 1/60}, C2–C4 | **128/128 passam** a 8, 10 e 20 iterações (gate 0) | 125/128 (padrão) | 46/128 |
| Sala, blast: peças acima de 3,5 cm (C2) | 2 / 1 / 2 (máx. 0,20 m) | 2–7 | 13 / 13 / 15 (máx. 0,54 m) |
| Sala, blast: dormindo no fim | 36/36 nas 3 rodadas | 17–32 de 36 | 34–36 de 36 |
| Ragdoll de 17 segmentos | dorme a 3,12 s; 2 quadros acima de 0,1 rad | errático entre ajustes | não tem |
| Ponte de JS que falta | nenhuma | limiares de sono, limite de junta multicorpo, força de junta, modificação de contato | — |
| 2 000 colisores estáticos, pôr / tirar | 7–10 ms / 0,9 ms | 15–27 / 28–50 ms | — |
| 1 000 raios de primeiro acerto | 1,6 ms | 1,8–2,1 ms | 9,1 ms |
| Determinismo | idêntico em Node, Chromium e Bun | idêntico entre processos | idêntico entre processos |
| Bundle (gzip) | +959 KB | +1,66 MB | 0 |

Os bloqueios do Rapier são API que falta nos bindings de JS; consertá-los exige manter um fork. Os do Jolt eram geometria e ajuste, e o gate 0
fechou cinco de seis (seção 2.2).

### 2.2 Gate 0 (2026-11-13): GO condicional

| Bloqueio | Resultado | Números |
|---|---|---|
| B1 bacia | **PASSA** | 128/128 em C2–C4 a 8, 10 e 20 iterações; rede de "caiu pelo chão" disparou 0 vezes; nenhum centro abaixo do chão (o mais perto: 3,7 cm acima); pior C2 2,5 cm, pior C3 1,7 cm, sono mais lento 2,05 s; atualizar um ladrilho de 2 m custa 0,59–0,81 ms (limite 2,5) |
| B2 rolamento | **PASSA, margem fina** | granada de esfera em repouso a 4,83 s (limite 5) e 7,61 m (limite 8) no gate 0; **a granada desenhada (corpo, espoleta, alavanca) tem limite 6,5 s e 8 m, só com C_rr 0,015 e sem amortecimento (decisão do dono, 2026-11-26)**: 48 arremessos semeados em até 5,95 s e 7,39 m; 200/200 cápsulas dormindo a 5 s |
| B3 ragdoll | **PASSA com condições** | 20/8 passes: 2 quadros acima de 0,1 rad, dorme a 3,12 s; pilha de 100 corpos dorme a 9,47 s (limite 10) só com velocidade de sono 0,08 |
| B4 heap | **PASSA** | cena pior (3 002 corpos) usa 21 MB dos 128 MB fixos (16%); o mundo sozinho ~19,7 MB |
| C9 memória | **PASSA** | todo mundo criado e descartado devolve o heap ao mesmo byte |
| B5 custo | **MISTO** | bench 160+40: Jolt mediana 1,00–1,07 / p90 1,43–1,47 / p99 4,1–5,4 ms; próprio 0,70–0,72 / 1,26–1,29 / 1,9–2,6 ms (1,45× na mediana, 2× no p99) |
| B6 cauda da cascata | **FALHA** | 500 corpos acordados num quadro: quadro de despertar 11,7–13,1 ms, p99 5,9–6,4 ms. Com o listener de contato desligado: 9,5 ms e p99 3,0 |

**Decisão do dono sobre B6 (2026-11-13):** a regra de Coulomb estático/dinâmico sai do callback de JS por contato e vira **troca de atrito por
corpo**. O corpo usa o atrito estático enquanto está parado ou preso, e o dinâmico enquanto escorrega. Espera-se p99 ≈ 3 ms. Um quadro de despertar
de ≈ 9,5 ms na hora de um blast grande fica **aceito**, com orçamento (seção 5, condição 10).

O build próprio do wasm, que o gate 0 listava como saída para B6, **não** é usado.

## 3. O que o motor passa a ser dono

| Sistema | Papel do Jolt |
|---|---|
| Destroços soltos (`PieceSystem`) | corpos dinâmicos, contato, atrito, sono, chão e estáticos como colisores |
| Props (móveis empurrados, itens segurados e arremessados, granada, cápsulas) | corpos dinâmicos com resistência ao rolamento |
| Juntas de interativos (porta, gaveta, cortina, cabo) | dobradiça, deslizante, junta que quebra por impulso |
| Ragdoll (pessoa, zumbi, bicho) | o ragdoll do próprio Jolt (esqueleto, `Stabilize`, filtro pai-filho) |
| Veículos | corpo do chassi e veículo de rodas do Jolt |
| Multidão | cápsulas cinemáticas dos agentes, corpos no chão como correntes baratas, LOD |
| Consultas | broadphase: raio com todos os acertos, primeiro acerto, sobreposição de esfera, esfera varrida, sensores |
| Controlador de personagem | o `CharacterVirtual` do Jolt (degrau, rampa, empurrar) |

## 4. O que continua nosso

- Materiais, massa e inércia (o kit dá a massa; o motor não recalcula).
- Dano, fratura e destruição (`game-destruction`, `DestructibleImpl`).
- Caminho de carga e estrutura (`game-floorplan-structure`).
- Balística: o tiro acerta o que está **desenhado** (`surfaceRay`, `CLAUDE.md` §7). O motor só acha os candidatos.
- Sobrepressão do blast e fragmentos de Mott (`game-vfx`, `game-weapons`).
- As regras do §12: nada flutua, nada invisível colide, o que estava em cima cai junto, invariante `onBrokenChecked`.
- A simulação da multidão (`game-crowd`: campo de fluxo, separação, vagas de ataque). O motor não simula agentes vivos.
- O modelo de condução (`game-vehicles-driving`) como entrada; o motor executa.
- Zonas de dano dos veículos, como filhos marcados (`tag`) do composto.

## 5. Condições que saíram do gate (obrigatórias)

1. **32 iterações de velocidade nos destroços** (`velocityIterations: 32`, opção do mundo, padrão do `KIT_WORLD`). **Decisão do dono 2026-11-14:** o piso de produção sobe de 20 para 32 (a pilha 20:1 só converge a ≥ 32; evidence T3.6b). Com 8–10, C1 falha (seção 7, bug 4); 8 e 10 **saem do C6**, que se avalia a partir do piso.
2. **Ragdolls com 20 passes de velocidade e 8 de posição** (`RagdollDesc.solverSteps`). Com os padrões do mundo (10/2), 20 quadros passam do limite.
3. **Velocidade de sono 0,08 m/s** no mundo (`sleepSpeed: 0.08`). Com o padrão do Jolt (0,03), a pilha de corpos e as correntes soltas não dormem em 10 s.
4. **Um mundo só por jogo.** Um mundo custa ≈ 19,7 MB do heap fixo de 128 MB. Nenhum sistema cria mundo próprio.
5. **Todo mundo é descartado.** Teste descarta o seu no `afterEach`; jogo descarta ao sair. O listener de assert do construtor é destruído
   junto (era o vazamento de 24–40 bytes por mundo).
6. **Peça criada dentro do chão é levantada na criação**, uma vez, nunca depois (`engine-pieces.ts`, `liftFor`). Até o chão ser sólido (bug 3),
   é isso que segura B1.
7. **Inércia pequena: contorno no adaptador.** O Jolt troca por 0,4·m (esfera de 1 m) toda inércia principal abaixo de ≈ 1e-6 kg·m². O
   adaptador cria o corpo com a inércia 1e6× maior e grava o valor certo logo depois (`INERTIA_SCALE`, `unscaleInertia`). Texto da issue para o
   Jolt na seção 5.1.
8. **Resistência ao rolamento por corpo** (`BodyDesc.rolling`, `setRolling`): momento C_rr × peso × raio contra o giro, só enquanto toca algo.
   Sem ela, a granada rola 30 m e nenhuma cápsula dorme.
9. **Atrito por corpo** (decisão B6): estático parado ou preso, dinâmico escorregando. Sem callback de JS por contato para atrito.
10. **Pico de despertar aceito:** o quadro em que uma ilha grande (≥ 300 corpos) acorda pode custar até **10 ms** (medido ≈ 9,5 ms), no máximo
    **um quadro por blast**. Fora desse quadro vale o orçamento do C7. Passar de 10 ms, ou dois quadros seguidos acima de 6 ms, reprova.

### 5.1 Issue para o Jolt (aberta em 2026-11-13: https://github.com/jrouwe/JoltPhysics/issues/2220)

```text
Title: Bodies with very small principal inertia get a 1 m sphere's inertia (0.4 * mass) instead of their own

Version: jolt-physics 1.1.1 (npm, wasm-compat), also reproducible from C++ per our reading.

A dynamic body whose principal moments of inertia are below roughly 1e-6 kg m^2 ends up with the inertia of a
solid sphere of radius 1 m (I = 0.4 * m) on every axis, instead of the inertia computed from its shape. For small
bodies (a 9 mm casing, a 1.5 cm chip) this is ~10 000x too large: they never stop rolling and never sleep.

Repro (pure Jolt, no wrapper):
  shape: CylinderShapeSettings(halfHeight 0.0095, radius 0.005, convexRadius 0.001)
  BodyCreationSettings: EMotionType_Dynamic,
    mOverrideMassProperties = EOverrideMassProperties_CalculateInertia,
    mMassPropertiesOverride.mMass = 0.004
  body.GetMotionProperties().GetInverseInertiaDiagonal()
Expected: about (6.9e6, 2.0e7, 6.9e6)   (I ~ 1.45e-7, 5.0e-8, 1.45e-7 kg m^2)
Actual:   (625, 625, 625)                (I = 0.4 * 0.004 = 1.6e-3 kg m^2)

The fallback looks like it triggers on an absolute threshold. A threshold relative to mass and size (or none,
as long as the moments are positive) would keep small bodies correct.

Workaround we use: create the body with mass and inertia scaled by 1e6, then write the true values back with
MotionProperties::SetInverseInertia / SetInverseMass right after creation.
```

## 6. Critérios de aceite C1–C10 — **APROVADOS** pelo dono em 2026-11-13 (seção 11)

Revisão dos C1–C8 aprovados em 2026-11-13 (`DECISION-fable.md` §2) para um motor, conforme `DECISION-ENGINE-fable.md` §4, com os valores reais
do gate 0. **Altura de energia** de uma peça = `y do centro de massa + (|v|² + ω·Iω/m) / (2g)`; **ilha** = grupo de peças em contato.

| # | Critério proposto | Valor no gate 0 | Como se prova |
|---|---|---|---|
| C1 | **Nenhuma energia criada.** Por ilha, em cada update sem entrada externa (golpe, blast, chão que muda, rede), `Σ m·altura de energia` não sobe mais que `m_ilha·g·1 mm`. Uma só implementação da régua | 20 it.: 0/128 falham; 10 it.: 3/128 (0,5–2,9 mm); 8 it.: 8/128 (até 5,2 mm) | `bowl-energy.test.ts` com `BOWL_SEEDS=64` e `JOLT_ITERATIONS` 8, 10 e 20: 0 falhas nos três |
| C2 | **Peça em repouso não é lançada.** Ganho de altura de energia ≤ **3,5 cm** por episódio, contando como lançamento só se a ilha também violou C1 no episódio (transferência paga não é lançamento). **Decisão do dono 2026-11-14:** a bacia e a varredura usam este C2 condicionado; a coluna sem condição só é impressa, para informação | bacia: pior 2,5 cm; sala blast: 2/1/2 peças acima (máx. 0,20 m), martelo: 3/0/2 (máx. 0,11 m), régua antiga sem C1 | bacia: `bowl-energy.test.ts`; sala: sondas com a régua única, 5 rodadas, 0 lançamentos |
| C3 | **Correção de posição limitada.** Subida do centro de massa só pelo passe de posição ≤ 3,5 cm por peça por episódio | pior 1,7 cm | `bowl-energy.test.ts` (`c3Lift`) |
| C3b | **Nada abaixo do chão.** Nenhum centro abaixo do chão em nenhum update; a rede `fellThrough` dispara 0 vezes em teste | 0 disparos; mais perto 3,7 cm acima | `bowl-energy.test.ts` (`deepest`, `fellThrough`) |
| C4 | **Assenta.** Bacia: 100% dormindo em até 3 s após o último evento. Sala: todas as peças dormindo 3 s após o último evento, em 5 de 5 rodadas | bacia: mais lento 2,05 s; sala blast 36/36 ×3, martelo 36–37/37 | bacia: `bowl-energy.test.ts`; sala: 5 rodadas à mão (`CLAUDE.md` §9) |
| C5 | **§12 por comportamento.** Uma lista nomeada de comportamentos do §12, um teste cada, todos verdes; todo teste reescrito tem o motivo registrado em `evidence.md` (lista na seção 6.1) | 14 testes de `game-destruction-three` falham hoje | `pnpm --filter @adatechnology/game-destruction-three test` e `... game-destruction test` |
| C6 | **Robustez.** Bacia em 64 sementes × dt {1/30, 0,05, 1/60, 1/144} × iterações {20, 32} × push-out {−50%, 0, +50%}, mais pilha 20:1 e pilha de 5 peças: tudo passa no piso (32), e mais trabalho nunca piora. **Decisão do dono 2026-11-14:** 8 e 10 iterações saem do C6 (ficam em `SWEEP_ITS=8,10,20,32` para informação); 20 roda só para comparação | medidos só dt 0,05 e 1/60, 8/10/20 it. e 240 Hz (128/128 em C2–C4) | varredura como teste (`JOLT_STEP`, `JOLT_ITERATIONS`, `JOLT_PUSHOUT`) |
| C7 | **Custo por orçamento absoluto**, mediana e p99, na faixa de hardware nomeada (tabela 6.2), cobrado pela rodada diária (`perf-gate.mjs`). Transitório, enquanto os dois solvers existem: mediana do bench ≤ 1,25× o próprio | bench 160+40: 1,45× na mediana, 2× no p99 (o transitório **falha** hoje) | `BENCH=1 ... bench-pieces.test.ts`, `cascade.test.ts` caso 5b, rodada diária |
| C8 | **Determinismo.** Mesma semente e dt dão pose idêntica em dois processos, em Node, Chromium, Bun e Firefox; salvar → rodar → carregar → rodar dá estado bit a bit igual | Node, Chromium, Bun iguais; Firefox não medido; save/load bit a bit igual | teste de determinismo por processo (novo); Firefox à mão |
| C9 | **Memória (§8).** O heap do wasm volta ao mesmo byte após ciclos de criar e descartar; pico da cena pior ≤ 50% do heap; `leak.mjs` ganha a sonda do wasm | volta ao mesmo byte; pico 21 MB (16%); sonda do `leak.mjs` não existe | `heap.test.ts`; `leak.mjs` na rodada diária |
| C10 | **Sem troca de solver no meio do jogo.** O motor carrega antes de qualquer mundo existir; um mundo por jogo | room e testes já esperam o wasm antes | teste do boot da sala (sem GPU) e do `setup-physics.ts` |

### 6.1 Comportamentos do §12 que o C5 nomeia (um teste cada)

1. Apoio perdido: o que sobrou cai e se apoia nos cantos das partes que restaram.
2. Tomba quando o centro de massa sai do apoio (uma perna: sempre; duas do mesmo lado: gira até o tampo bater).
3. O que estava em cima cai junto, no mesmo quadro em que o apoio começa a se mexer.
4. Coulomb: μ 0,4 em 25° escorrega (0,42 m em 1 s; esperado 0,47); μ 0,5 segura.
5. Normal da face inclinada do apoio, não do mundo.
6. Nenhum colisor sem geometria: o colisor vem do que está desenhado (`shownBoxes` por parte).
7. Invariante `onBrokenChecked` e catálogo quebrado (`broken-catalogue.test.ts`).
8. Lata em pé numa rampa de 10° anda ≤ 2 cm em 2 s (`rolling.test.ts`).
9. Peça que escorrega numa parede volta ao ponto do encontro (`sweep`).
10. Pouso duro e som de batida pelos eventos de contato.

Os testes que hoje usam uma peça dormindo como rampa fixa (7), tolerâncias do impulso antigo (4) ou topo que só existe como função (2) são
reescritos com apoio desenhado; o motivo de cada um vai para `evidence.md`.

### 6.2 Orçamentos do C7 (propostos, faixa "Intel Core Ultra 9 275HX, Node")

| Cenário | Mediana | p99 | Medido no gate 0 |
|---|---|---|---|
| Destroços 160 parados + 40 movendo (`renderer.update`) | ≤ 1,1 ms | ≤ 3,0 ms | 1,00–1,07 / 4,1–5,4 ms |
| Cascata de 500 corpos acordados (`cascade.test.ts` 5b), fora do quadro de despertar | ≤ 0,6 ms | ≤ 4,0 ms | 0,5 / 5,9–6,4 ms (3,0 sem listener) |
| Quadro de despertar da cascata de 500 | — | ≤ 10 ms (condição 10) | 11,7–13,1 ms (9,5 sem listener) |
| 20 ragdolls | ≤ 3,0 ms | ≤ 4,0 ms | 2,8 mediana / 3,3 p90 (spike) |
| 100 corpos empilhados como correntes | ≤ 2,5 ms | ≤ 4,0 ms | 2,2 / 2,6 ms |
| 10 carros andando | ≤ 0,5 ms | ≤ 1,0 ms | 0,15–0,25 ms mediana |
| 1 000 agentes cinemáticos | ≤ 0,5 ms | ≤ 1,0 ms | 0,29 ms |

A faixa AMD e as faixas mais fracas ganham a própria linha depois da medição (seção 8). Orçamento por faixa de custo medido, não por marca.

## 7. Bugs conhecidos a corrigir

1. **(Corrigido em `36753ec0`.) `setShape` perde a massa do kit.** Em corpo dinâmico, o Jolt recalcula a massa pela densidade da forma; a peça que quebra fica com a massa
   errada. Correção no adaptador: reaplicar massa e inércia do kit (com o contorno da condição 7) depois de toda troca de forma.
2. **Lata em pé numa rampa de 10° anda 2,14 cm em 2 s** (limite 2 cm, `rolling.test.ts`, "a standing can does not roll"). A regra antiga
   escondia isso amortecendo a velocidade linear. Corrigir a causa; não afrouxar o limite.
3. **O height field tem um lado só.** Só as caixas dos degraus são sólidas. B1 passa porque nenhuma peça nasce dentro do chão e os contatos
   ficam quentes; o chão que sobe por baixo de uma peça (cratera fechando, deslizamento) ainda pode prendê-la. Tornar o chão sólido sem fork.
4. **C1 falha com 8–10 iterações** (3/128 a 10, até 2,9 mm; 8/128 a 8, até 5,2 mm). **Decisão do dono 2026-11-14:** o piso de produção é 32 e 8 e 10 saem do C6 (condição 1, C6); o bug fica fechado como "não se corrige abaixo do piso".

## 8. O que não foi verificado

- Máquina AMD e CPUs fracas (todo custo foi medido em Intel, em Node).
- Firefox.
- ARM.
- A rodada diária de GPU (`nightly-gpu.mjs`) com o Jolt.
- A sonda do wasm no `leak.mjs` (hoje ele não enxerga a memória do wasm).
- A sala em GPU real: as sondas rodaram em SwiftShader, 3 rodadas, sem determinismo.
- O atrito por corpo existe desde `62da7619`; o B6 com ele foi medido na rodada Q4 (seção 11.1), só nesta máquina e com carga.

## 9. Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| O listener continua necessário para eventos de contato (dano, som) e sensores | o ganho de B6 fica menor que o medido sem listener | fase 1 mede com o listener só para eventos; se o p99 passar de 4 ms, parar e levar ao dono |
| Atrito por corpo perde a resposta por contato | peça que escorrega num apoio e está presa em outro recebe uma resposta só | teste do comportamento 4 do C5 e caso de dois apoios na fase 1 |
| Atrito misto com estático | o chão não tem estado "escorregando" | regra de mistura decidida na fase 1 (T1.1) |
| Restituição sem callback vira o máximo do Jolt | quique diferente do kit (média geométrica) | manter a mistura só no contato novo; testes de colisão de latas |
| Margens finas de B2 e B3 | granada de esfera a 4,83 s de 5 (a desenhada: 5,95 s de 6,5); pilha a 9,47 s de 10 | medir de novo em cada fase que toca rolamento ou sono |
| Heap fixo de 128 MB | cidade inteira pode passar de 50% | um mundo só; C9 na rodada diária; streaming de estáticos |
| Um mantenedor dos bindings de JS | correção upstream lenta | versão fixada; wasm guardado no lockfile; tudo no adaptador |
| Sem build publicado com `CROSS_PLATFORM_DETERMINISTIC` (#301 fechado, não lançado) | determinismo entre CPUs não garantido | C8 em mais runtimes; reavaliar a cada versão |
| Build multithread inutilizável com callback de JS | teto de desempenho | menos callback depois de B6; não planejado agora |
| Goldens recalibrados tarde | escondem regressão sem relação | goldens só no fim de cada fase, num commit só, com diff explicado |
| Dois solvers convivem nas fases 1–7 | código duplicado, testes em dobro | chave `PIECE_SOLVER`/`?solver=own` até o corte na fase 8 |
| Gate 0 B6 falhar de novo | sem saída prevista (build próprio descartado) | parar e levar ao dono |

## 10. Fora de escopo

- Fork do Jolt ou build próprio do wasm.
- Build multithread.
- Mudar a API pública do `PieceSystem` (`partBoxes`, `shownBoxes`, `onBrokenChecked`, `contacts`, cratera).
- Simulação da multidão pelo motor.
- Push, PR, merge e deploy: só com o ok do dono.

## 11. Decisões do dono (2026-11-13) — nenhuma pendência aberta

- **C1–C10 aprovados** (seção 6), com a régua abaixo. O dono escolheu "fechar a spec" depois da rodada Q4, levando a sala para o aceite da fase 3.
- **Régua do C2 e do C4:** no C2 só conta a energia que a ilha ganhou **sem entrada de fora** (golpe, blast, chão que muda, rede); no C4 o sono
  conta a partir da **última entrada de fora**.
- **(a) Sala no C4:** todas as peças dormindo até 3 s depois da última entrada de fora, em 5 de 5 rodadas. É aceite da T3.8, não condição para
  aprovar a spec.
- **(b) Orçamentos da tabela 6.2** valem na faixa "Intel Core Ultra 9 275HX, Node" até a medição em AMD.
- **(c) Transitório de 1,25× do C7 é gate** até o corte da fase 8 (barra a entrega). Na rodada Q4: 0,91×.
- **B6 (cascata de 500, fora do quadro de despertar) até a medição em AMD:** mediana das rodadas ≤ 4 ms e nenhuma rodada acima de 5 ms. Na
  rodada Q4: mediana 3,38 ms, 6 de 9 rodadas abaixo de 4 ms, máximo 4,64 ms.
- **AMD e ARM: só registrar**, não exigidos antes do merge. Firefox roda nesta máquina e entra no C8.
- **Issue do bug de inércia aberta com o ok do dono:** https://github.com/jrouwe/JoltPhysics/issues/2220. O contorno da condição 7 fica no
  adaptador até haver versão corrigida.

### 11.1 Rodada Q4 (2026-11-13): o que ela mostrou

Relatório em `item6-escalation/Q4-REPORT-jolt.md`; commits `72bb3a5e` … `c6c42d87` em `spike/engine-jolt`.

| Medida | Antes | Depois |
|---|---|---|
| Sala blast ×3, peças acima de 3,5 cm (régua da spec) | 0 / 0 / 0 | 2 / 2 / 3 |
| Sala martelo ×3, idem | 0 / 1 / 0 | 0 / 1 / 0 |
| Sala, rodadas com tudo dormindo ≤ 3 s | 4 de 6 | 4 de 6 |
| Rede `fellThrough` na sala | 0 | 215 numa rodada de blast |
| Bacia, 20 iterações | 128/128 | 128/128 |
| Bench 160+40, Jolt / próprio na mediana | 1,22× | 0,91× |
| Bench, razão do p99 | 2,16× | 1,50× |
| Pausas do coletor > 1 ms por 200 updates (Jolt) | 4–5 | 0–1 |
| Bytes alocados pela costura por update | 1 112 810 | ≈ 208 000 |

**Causa medida das falhas da sala:** o Jolt não tem a maior parte do que está desenhado. 329 das 351 malhas mescladas da casa (paredes, pisos,
telhado), as peças estruturais sem malha própria (vigas, pilares, caibros, vergas, lajes) e malhas largas da mesa e do alvo ficam fora do mundo.
As caixas do carro vêm das caixas de dano, alargadas pelos retrovisores. As regras antigas do kit (separar empurrando, levantar na criação, rede)
tentam compensar e brigam entre si: a versão que segurou a sala (1–2 peças acima, 6/6 dormindo, rede 0) derrubou a bacia para 127/128, e a que
devolveu a bacia trouxe a rede de volta. Por isso a sala passa a ser aceite da fase 3 (T3.0a–T3.0c, T3.1 e T3.8), depois de todo colisor existir.

## 12. Decisões do dono (2026-11-14)

- **D1. Iterações de velocidade dos destroços: piso de produção 20 → 32** (opção do mundo `velocityIterations`, padrão 32 no `KIT_WORLD`). A condição 1 muda. O C6 se avalia a partir do piso: 8 e 10 iterações saem dele (§5 condição 1, §6 C6, §7 item 4).
- **D2. Régua do C2:** a bacia e a varredura usam o C2 condicionado da spec (o ganho só conta se a ilha também violou C1); a coluna sem condição segue impressa, só para informação. **E** o empurro de tombamento do kit passa a derrubar a peça fina em pé sobre a aresta escorada noutra (§12: nada se equilibra de forma irreal): peça com apoio estreito parada sobre ele por 0,3 s perde quase todo o atrito até se mexer ou dormir; a bacia semente 61 a dt 1/144 deixa de formar a tenda.
- **D3. Teto de giro fica em 47 rad/s.** O teste "a rolling can knocks a still one on" passa a lançar a lata a um giro alcançável (1,5 m/s, 45 rad/s), com mais tempo de corrida; a tolerância não mudou.
- **D4. Depois de explosões:** (a) os destroços acordam em lotes do centro do blast para fora, em alguns quadros (frente de choque); (b) a quantidade de peças que entram na física por explosão sai do custo medido na máquina, entre um mínimo e um máximo; peça grande sempre entra, pedaço pequeno vira partícula visual sem colisão; (c) teto de destroços vivos, com os distantes e velhos dormindo ou sumindo. **"Deixa configurável":** todo número do D4 é opção com padrão documentado (mundo, sistema ou explosão), nunca constante; a iteração de velocidade também é opção do mundo (padrão 32). Números e opções em `evidence.md` (T3.6d) e no README do pacote.
