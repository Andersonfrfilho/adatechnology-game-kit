# Plano — Spec 008, Jolt como motor físico do kit

Esforço total: **11 a 14 semanas de uma pessoa** (memo de decisão, seção 5). A estimativa do spike (5–7) deixa de fora goldens, testes
reescritos, validação na rodada diária de GPU e as surpresas do primeiro uso das APIs de ragdoll e veículo.

## D1 — Arquitetura

```text
jogo / sala de teste
  └─ camadas de domínio (nossas): game-destruction, game-floorplan-structure, game-weapons, game-vfx, game-crowd, game-vehicles-driving, game-player
       └─ costuras por pacote (engine-*.ts): traduzem o domínio em corpos, juntas e consultas
            └─ @adatechnology/game-physics        contrato: só tipos e helpers pequenos, sem motor
                 └─ @adatechnology/game-physics-jolt   adaptador: única dependência do jolt-physics
```

- **`game-physics`** (contrato). Formas (caixa, esfera, cápsula, cilindro, convexa, malha, height field, composto com `tag` por filho = id da
  parte), camadas e tabela de pares (`LAYER_PAIRS`), grupos de ragdoll, juntas (fixa, dobradiça, swing-twist, com impulso de quebra), ragdoll,
  veículo de rodas, consultas (`rayAll`, `rayFirst`, `overlapSphere`, `sphereCastAll`), eventos de contato em struct-of-arrays reaproveitado,
  sensores, `step(dt)` de passo fixo, `memoryInUse` e `dispose`. Nenhum tipo do Jolt atravessa o contrato.
- **`game-physics-jolt`** (adaptador). Libera todo objeto do Jolt que cria (§8). Guarda as correções do kit: inércia pequena (condição 7),
  rolamento por corpo (condição 8), atrito por corpo (condição 9), massa do kit preservada em `setShape` (bug 1), mistura de restituição.
  Carregamento assíncrono do wasm; criação do mundo síncrona.
- **Um mundo por jogo** (condição 4). O jogo cria o mundo depois do `await` do motor (C10) e o entrega a cada costura. Teste usa
  `setup-physics.ts`, que descarta os mundos no `afterEach`.
- **Ordem do passo** (decidida na fase 1): multidão → controladores e cinemáticos → `world.step` → eventos de contato para o dano → regras do
  §12 → desenho.
- **Ajustes do mundo** (condições 1–3): passo fixo 1/120, 32 iterações de velocidade (piso documentado, decisão do dono 2026-11-27: abaixo de 20, e na pilha 20:1 a dt 1/144, o kit não garante C1/C6; a produção, 120 Hz e 32 it., tem 0 falhas), 2 de posição, sono após 0,5 s abaixo de 0,08 m/s, slop
  2 mm, push-out 2 mm por iteração. Ragdoll sobrepõe 20/8.

### D1.1 — Atrito por corpo (decisão B6)

Hoje (`game-physics-jolt/src/index.ts`, `coulomb`, chamado em `OnContactAdded` e `OnContactPersisted`) a velocidade de deslize de cada contato
escolhe o coeficiente estático ou dinâmico, e a restituição é misturada por média geométrica. O `OnContactPersisted` roda para todo contato em
todo passo: é o custo de B6.

Alvo:
- Cada corpo dinâmico tem um estado `sticking | sliding`, decidido **depois** de cada passo pelos próprios dados: tocando algo e com velocidade
  tangencial nos pontos de contato abaixo de `slipSpeed` (2 cm/s) → `sticking`; acima → `sliding`. Corpo sem contato mantém o estado.
- O estado muda o atrito do corpo no Jolt (`SetFriction`) para o coeficiente estático ou dinâmico. A mistura entre dois corpos é a do Jolt
  (média geométrica), igual à do kit (`mixFriction`).
- Corpos estáticos não escorregam. A regra de mistura com estático é decidida em T1.1 (🧠): a mais simples é o estático entrar com o seu
  coeficiente estático e o corpo dinâmico levar a razão dinâmica/estática do par.
- Restituição: média geométrica só no contato novo (`OnContactAdded`), que já existe para os eventos. `OnContactPersisted` deixa de chamar JS
  de atrito; se o binding exigir o método, ele fica vazio e o custo é medido.
- A troca só acontece em corpos acordados; sono e determinismo não podem depender de ordem de iteração de `Map`.

Aceite em T1.3: B6 (p99 ≤ 4 ms, quadro de despertar ≤ 10 ms), B5 de novo, bacia 128/128 em C1–C4 a 20 iterações, Coulomb do C5 (comportamento 4)
e o bug 2 medido de novo.

## D2 — Migração por sistema, nesta ordem

Ordem pedida pelo dono: destroços, props, ragdoll, veículos, multidão, consultas e balística, reação em cadeia. Cada sistema entra pela sua
costura; a camada de domínio não muda de API.

| # | Sistema | Pacotes | O que muda | Regra que fica nossa |
|---|---|---|---|---|
| 1 | Destroços | `game-destruction-three` (`engine-pieces.ts`, `engine-ground.ts`) | `PieceSystem` passa pelo contrato; chão como height field + caixas de degrau, sólido (bug 3); estáticos pelas caixas desenhadas | §12 inteiro, rede contada, `maxAwake`, `onBrokenChecked`, cratera |
| 2 | Props | `game-interactables`, `game-interactables-three`, `game-player`, `game-items-three`, `game-weapons-three` | móvel empurrado, item segurado e arremessado, granada, cápsulas; juntas de porta, gaveta, cortina, cabo; controlador de personagem | loot, estado dos interativos, regra de rolamento |
| 3 | Ragdoll | `game-characters`, `game-characters-three`, `game-animals-three` | corpo morto vira ragdoll do Jolt (20/8, `Stabilize`); bicho quadrúpede | dano por segmento, desmembrar (troca de forma via `setShape`, bug 1) |
| 4 | Veículos | `game-vehicles`, `game-vehicles-driving`, `game-vehicles-three` | chassi + veículo de rodas; controle do arcade vira `driveVehicle`; regra de sono do carro | zonas de dano como filhos marcados; §7 do `CLAUDE.md` |
| 5 | Multidão | `game-crowd`, `game-crowd-three` | agentes como cápsulas cinemáticas; corpos no chão como correntes; LOD ragdoll → cápsula; porta que cede por junta | campo de fluxo, separação, vagas; `game-crowd` não muda de hash |
| 6 | Consultas e balística | `game-destruction`, `game-weapons`, `game-vfx`, `game-test-room` | broadphase sob `surfaceRay`; raio com vários acertos; blast (fragmentos, sobreposição); sensores de fumaça | o acerto final é a superfície desenhada |
| 7 | Reação em cadeia | `game-destruction`, `game-destruction-three`, `game-floorplan-three` | eventos de contato com impulso viram `hit`; despertar em massa (condição 10) | dano, fratura, caminho de carga |

## D3 — Chave do solver próprio

O solver próprio na base `74774f11` (já ancestral de `spike/engine-jolt`) continua medível até o corte:
- testes: `PIECE_SOLVER=own` (lido em `tests/setup-physics.ts` e `src/pieces.ts`);
- sala: `?solver=own` (`examples/test-room/build.mjs`).

Toda fase de destroços mede os dois lados na mesma máquina (C7 transitório). O padrão já é o Jolt no spike; na branch de produção o padrão
continua o solver próprio até a fase 3 passar nos seus gates (memo, "antes de qualquer merge", item 3). A chave e o solver próprio saem só na
fase 8, num commit próprio.

## D4 — Goldens que vão mudar

| Golden | Pacote | Por quê | Quando |
|---|---|---|---|
| `exact-golden`, `golden-scene`, `team-golden-house-area` (quebra, lasca, fratura) | `game-floorplan-three` | os pedaços passam a ser corpos do Jolt | fim da fase 3 |
| hash do `blast-presentation` | `game-floorplan-three` | destroços do blast | fim da fase 3 |
| sons de batida (`audio.test.ts`) | `game-destruction-three` | eventos de contato do motor | fim da fase 3 |
| testes do andar e da batida | `game-vehicles-driving` | o motor executa o carro | fim da fase 6 |
| `state-hash`, `team-golden` | `game-crowd` | **não deve mudar**: a multidão não passa pelo motor | conferir na fase 7 |
| goldens de geometria da frota (`golden-*`, `torn-panels-digest`) | `game-vehicles-fleet` | **não deve mudar**: geometria não depende do motor | conferir na fase 6 |

Regra: golden recalibrado só no fim da fase, num commit só, comparado com o `origin/main` atual, com o diff explicado em `evidence.md`. Falha
"pré-existente" só conta se também falhar no `origin/main` atual.

## D5 — Branches e rebase

- **Fases 0 e 1** no worktree `adatechnology-game-kit-wt/engine-jolt`, branch `spike/engine-jolt`. O spike está 88 commits à frente e 13
  atrás do `origin/main` (2026-11-13).
- **Fase 2 começa pelo rebase**: branch nova `feat/motor-fisico-jolt` num worktree próprio
  (`adatechnology-game-kit-wt/motor-fisico-jolt`), a partir do `origin/main` **depois** que `release/casa-a-pa-2026-11-13` entrar. Hoje ela não
  entrou (existe só local). Se ainda não tiver entrado, parar e perguntar.
- Traz por cima: os commits do spike que interessam (`game-physics`, `game-physics-jolt`, `engine-*.ts`, testes, boot da sala) e os da fase 1.
  Commits `spike(...)` viram commits limpos; nada vai ao `main` como está.
- Nunca no `main`. Commits locais. Push, PR e merge só com o ok do dono.

## D6 — Fases (memo seção 5, ajustadas pelo gate 0)

| Fase | Entrega | Semanas | Modelo |
|---|---|---|---|
| 0 Gate | B1, B2, B3, B4, B5, B6, C9 medidos; GO condicional | **feito** (2026-11-13) | — |
| 1 Atrito por corpo e arquitetura 🧠 | D1.1 implementado; B6 e B5 de novo; decisões de arquitetura (contrato final, ordem do passo, contrato do chão, eventos para o dano) num registro de decisão | 1 | `opus` |
| 2 Contrato e adaptador | rebase; pacotes de produção; versão fixada; licença; testes de descarte; bug 1; issue upstream (com ok do dono) | 1,5 | `sonnet`; scaffolding, README, skills `haiku` |
| 3 Destroços | chão sólido (bug 3); estáticos; §12 por comportamento (C5); bugs 2 e 4; C1–C6, C8 na bacia; régua única na sala; goldens no fim | 2–2,5 | `sonnet`; goldens `haiku` |
| 4 Props | controlador de personagem; segurar e arremessar; granada e cápsulas (B2); juntas de interativos | 1–2 | `sonnet`; tabelas e README `haiku` |
| 5 Ragdoll | B3 em produção; 20/8; desmembrar com `setShape`; regra da pilha 🧠 | 1,5 | `sonnet`; regra da pilha `opus` |
| 6 Veículos | mapa do arcade para o veículo de rodas 🧠; regra de sono; batida e capotagem | 1,5–2 | `sonnet`; mapa `opus` |
| 7 Multidão, consultas e reação em cadeia | cápsulas cinemáticas, correntes, LOD, porta; broadphase sob `surfaceRay`, vários acertos, blast, sensores; eventos para o dano e despertar em massa | 2 | `sonnet` |
| 8 Corte e validação | apagar o solver próprio e a chave; docs e skills; sala com print; rodada diária de GPU e `leak.mjs` com sonda do wasm à mão; AMD | 1 | `haiku` mecânico; `sonnet` validação |

## D7 — Antes de qualquer merge no `main`

1. Gate 0 registrado (feito, `GATE0-REPORT-jolt.md`).
2. C1–C10 aprovados pelo dono.
3. Chave do solver com o próprio como padrão até a fase 3 passar.
4. Nenhum teste de navegador ou GPU no CI nem em commit (`CLAUDE.md` §9).
5. Rodada diária de GPU e `leak.mjs` (com a sonda do wasm) verdes na branch, rodados à mão.
6. Uma medição em AMD.
7. TypeScript strict, sem `any` (`CLAUDE.md` §10).
8. Lockfile commitado e licença do Jolt (MIT) junto do pacote.

## D8 — Regra de GPU

Sondas da sala, `perf.mjs`, `perf-gate.mjs`, `leak.mjs` e `browser-checks.mjs` rodam só à mão ou na rodada diária (`CLAUDE.md` §9). Nunca em
commit, pre-push ou CI. A evidência deles vai para `evidence.md` com a data e a máquina.
