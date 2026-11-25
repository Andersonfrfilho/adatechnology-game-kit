# Tasks — Spec 018, a explosão fora do quadro principal

## Gates de toda task

- `pnpm --filter <pacote> typecheck` e `test` de cada pacote tocado; `pnpm check:layers`; `node tools/kit-audit/audit.mjs --check --strict-clocks` 0 novos.
- Commit isolado por task; evidência em `evidence.md`.
- Medição só com a máquina fria e quieta (carga < 1,5 no começo, processador longe do limite térmico), sob
  `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, pares alternados na mesma sessão; rodada com a página travada (quadro ~10x)
  é descartada e anotada. Em 2026-11-20 horas de medição seguida levaram o processador a 90–100 °C e encheram as séries de travadas.

## Fase 0 — Experimento: o worker paga a conta?
> 🤖 Modelo: `sonnet` (T0.1 é 🧠 — desenho do experimento com `opus`; nada desta fase vai para a `main` além da evidência)

- **T0.1 🧠** Sonda dentro do `explode`: repartir os 24–26 ms em (a) onda e geometria por peça (`waveWork`, `projectedArea`,
  `distanceToShape`), (b) `seesFireball`/`raycastInternal`, (c) `wearJoints`, (d) `knockOutUnits` sem o solve, (e) `solveStructure`,
  (f) `emit` e ouvintes. Na casa da sala, explosão e cratera, 3 rodadas. Sem isso não se sabe o que vale mover.
- **T0.2** Custo da fronteira: tempo de `serialize()` da casa da sala e de um `structuredClone` do snapshot; tamanho em bytes; tempo de
  montar a entrada plana das ~15 peças do primeiro anel e das ~505 de fora (medidas no `design-onda.md` §9).
- **T0.3** Protótipo descartável do caminho A só para a parte que a T0.1 mostrar como a maior e pura: kernel, entrada plana, aplicação do
  plano em N + 1; régua em pares alternados. Critério: tira pelo menos 15 ms do quadro do impacto e não põe nenhum quadro seguinte acima
  de 33,3 ms. Não passou: registrar e parar.
- **T0.4** Protótipo descartável do caminho C (`rebuildHost` como kernel na faixa `build`): quanto dos ~14 ms de eventos sai.
- **T0.5 🧠** Relatório com os números e a recomendação para a D1 (A, B, C, combinação ou desistir da meta), para o dono decidir.

## Fase 1 — Proposta de cortes na simulação de fragmentos
> 🤖 Modelo: `sonnet` (análise só de leitura; T1.2 é 🧠 — validar com `opus` antes de implementar, pois a escolha define cortes que outras tasks herdam)

Contexto: D1 e D3 decididas em 2026-11-21 (`spec.md` §4). O caso de referência é a M67; o dono pediu a proposta **antes** de qualquer mudança no
código de simulação. Esta fase não altera código.

- **T1.1** Proposta de cortes (só leitura e análise, nenhum código de simulação muda). Para o `explode` (M67 ~43–55 ms) e o `destrEvents`
  (M67 ~44–49 ms) do pior quadro, listar as opções de corte e, de cada uma: o que corta, o ganho esperado em ms (com a conta e o que é palpite),
  **quais goldens e hashes de eventos mudam** (ler os goldens, não supor), o que o jogador vê de diferente e se depende da D2 (marcar quais opções dependem: só as que atrasam o dano em relação ao clarão; as que mantêm o dano no tique da explosão não esperam a D2). A T1.1 em si não depende da D2. Incluir o corte
  "espalhar os impactos dos fragmentos por 2 ou 3 tiques" e dizer quantos quadros de latência ele cria. Medir o que faltar com a régua
  (`room-explosion`, M67, modo de prazo, pares alternados na mesma sessão). Entregar em `evidence.md` e levar ao dono.
  Comandos: worktree próprio por sessão; `pnpm build` e depois `(cd examples/test-room && node build.mjs)` (a régua recusa `dist` velho, #418); régua, no modo de prazo (padrão):
  `flock ~/.cache/adatechnology-game-kit/perf-measure.lock env ROOM_EXPLOSION_PAGE=<página> ROOM_EXPLOSION_OTHER_PAGE=<outra> ROOM_EXPLOSION_EXPLOSIVE=<m67|pipe_bomb|c4|molotov> ROOM_EXPLOSION_KINDS=blast ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_STAGE_THROTTLES=1 ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1 ROOM_EXPLOSION_FRAME_PARTS=1 ROOM_EXPLOSION_OUT=<json> node tools/gpu/perf-gate.mjs room-explosion`.
- **T1.2 🧠** Escolha dos cortes. **Depende do dono:** nenhuma task de implementação nasce antes de ele escolher entre as opções da T1.1 e, só
  para corte que atrasa o dano em relação ao clarão, de fechar a D2. Corte que mantém o dano no tique da explosão não espera a D2.

Fases de implementação: só existem depois da escolha da T1.2.

Estado em 2026-11-24: a proposta de espalhar a explosão foi entregue (`proposta-d2.md` e `evidence.md`), o dono escolheu o plano recomendado em 2026-11-23 e a explosão espalhada entrou
na `main` (#443, #444, #447, #448). A Fase 2 fecha o que ficou de fora (`spec.md` §6).

## Fase 2 — Fechar a explosão espalhada
> 🤖 Modelo: `sonnet` (T2.3 é 🧠 — validar com `opus` antes, porque muda em que quadro cada etapa roda)

- **T2.1** A M67 entra no portão da rodada diária ao lado do C4 (`tools/gpu/nightly-gpu.mjs`, `room-explosion`), com base gravada nesta máquina.
- **T2.2** Medir bomba de cano, C4 e M79 com o marca-passo ligado (régua `room-explosion`, `FRAME_SERIES=24`, pares alternados `blastPacing=0`
  e `1`), e registrar em `evidence.md`.
- **T2.3 🧠** Emendar as etapas do marca-passo: conferir no código em que quadro cada etapa (raios, onda, eventos) começa e, se uma etapa
  espera o quadro seguinte com folga, começar a próxima no mesmo quadro. Aceite: mesmos bytes com e sem pausa (`room-determinism.mjs`) e
  menos quadros segurados na M67.
- **T2.4** Decisão do dono: orçamento por custo medido em vez de contagem fixa, e o marca-passo ligado por padrão no kit
  (`game-kit-defaults`). Medir numa máquina AMD antes de fechar.
- **T2.5** Conferir qual solver a régua da rajada usa e, se for o solver próprio, medir no Jolt.

## Fases seguintes

O que qualquer caminho herda da 017 está em `specs/017-quadro-da-explosao/design-onda.md` (§2.2 a §2.6, §3 e a lista de testes do §5).

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a Fase 2 da spec specs/018-explosao-fora-do-quadro/ (leia spec.md, §6, e tasks.md antes de começar).
Uma task por vez, na ordem do tasks.md. Modelos: T2.1, T2.2 e T2.5 → executor model=sonnet · T2.3 🧠 → validar o desenho com architect
model=opus antes de implementar · revisão final → code-reviewer model=sonnet. Escalada: gate falhou 2x → sobe um nível e registra em evidence.md.
Cada task fecha com typecheck + testes + commit isolado; medições sob flock ~/.cache/adatechnology-game-kit/perf-measure.lock com a máquina
quieta, evidência em evidence.md. Pare e pergunte antes de: a T2.4 (decisão do dono), deploy, regravar golden ou fixture.
```
