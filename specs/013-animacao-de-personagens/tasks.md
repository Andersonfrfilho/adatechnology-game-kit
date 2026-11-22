# Tasks — Spec 013

Leia `spec.md` e `plan.md`. Animação só fecha com print por câmera (§5). Testes de navegador nunca no CI (§9).

## Fase 0 — Referência
> 🤖 Modelo: `sonnet`

- T0.1 Roteiro na sala (`examples/test-room` e `player-test-area`) que grava a matriz da R0 em `shots/`; índice em `evidence.md`.
- T0.2 Medir no estado atual: deslize do pé por passo (0 a 7 m/s) e salto de junta nas transições. Confirma ou derruba as
  inferências A4 do levantamento; números em `evidence.md`.

## Fase 1 — Contratos do núcleo
> 🤖 Modelo: `opus` (T1.1 é 🧠)

- T1.1 🧠 `game-characters/src/anim/`: tipos e contrato do grafo, das camadas e das curvas; formato do `anim-graph.json`. Validar
  com `architect`.
- T1.2 `curves.ts` e `pose-clip.ts` com curva por chave; clipes atuais continuam dando os mesmos bytes sem curva declarada. Testes.
- T1.3 `graph.ts` e `layers.ts` (puros) com testes: transição, máscara, aditivo, fase compartilhada.

## Fase 2 — Locomoção
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 → `opus`)

- T2.1 🧠 `locomotion.ts`: velocidade 2D e giro; passada de corrida pela conta do chão; fase contínua. Testes R1 e R2 puros.
- T2.2 `game-characters-three`: `avatar.ts` consome o grafo atrás de `graph: true`, usando `humanPose`/`blendMoves` (R3).
- T2.3 Ré, lateral e diagonal; pulo, queda e transposição como estados (R5). `footfall.test.ts` estendido (critério 1).
- T2.4 Sala e `game-player` passam velocidade 2D; prints da matriz; remover o caminho antigo do `avatar.ts`.

## Fase 3 — Mira e camadas no jogo
> 🤖 Modelo: `sonnet`

- T3.1 `aim.ts` e uso no `avatar.ts` (R6); prints de mira alta, reta e baixa nas duas câmeras, uma arma por família.
- T3.2 Recuo e recarga em camada própria sobre a locomoção (`game-weapons-three` pede camada, não pose).
- T3.3 Fechar a spec 004 T5.1: remover `first-person/arms.ts`, tipos, preset e `FIRST_PERSON_CLIPS`; `ik.ts` para `player/`;
  teste R7 da 004 verde. Evidência também em `specs/004-corpo-unico/evidence.md`.

## Fase 4 — Reações e clipes
> 🤖 Modelo: `sonnet` (T4.3 → `haiku`)

- T4.1 `game-characters-people`: clipes de reação a tiro por região, cambalear, cair, morrer e levantar (humano e zumbi), com curvas.
- T4.2 Ligação no grafo e na sala: o tiro escolhe a reação pela região e pela energia. Prints.
- T4.3 Rever os 11 clipes de ataque com antecipação e acompanhamento (dados); teste de formato.

## Fase 5 — Pé no chão
> 🤖 Modelo: `sonnet` (depende do tornozelo da spec 014)

- T5.1 `foot-ik.ts` puro com testes (rampa, degrau, limite de extensão).
- T5.2 `avatar.ts`: alturas do chão por pé, compensação do quadril; prints em rampa e escada da sala.

## Fase 6 — Ragdoll
> 🤖 Modelo: `opus` (T6.1 é 🧠)

- T6.1 🧠 Desenho do ragdoll do corpo sobre o contrato do `game-physics` (juntas, limites, massas pelo rig, entrada e saída).
  Conferir o que falta da Fase 5 da spec 008 e validar com `architect`.
- T6.2 `rich/ragdoll.ts` e o que faltar no `game-physics-jolt`. Teste de determinismo (critério 4) e de memória (§8).
- T6.3 Sala: morte, explosão e atropelamento entram no ragdoll; limite simultâneo com degradação. Prints e `perf-gate`.

## Fase 7 — Multidão
> 🤖 Modelo: `sonnet`

- T7.1 `instanced/body-chunk`: mistura de duas poses; teste de equivalência com peso 0 e 1.
- T7.2 Impostor com estados (andar, correr, atacar, caído); textura de clipes por padrão dentro do orçamento. Medição na sala.

## Fase 8 — Fechamento
> 🤖 Modelo: `haiku` (T8.2 → `sonnet`)

- T8.1 READMEs, skill `kit-pessoas-bichos`, regra §5 se o roteiro de prints virar comando.
- T8.2 Revisão (`code-reviewer`) e matriz final lado a lado com a R0.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/013-animacao-de-personagens/ (leia spec.md, plan.md e tasks.md
antes de começar). Uma task por vez, na ordem do tasks.md.
Modelos: Fase 0 → executor model=sonnet · Fase 1 → opus (T1.1 🧠, validar com architect) · Fases 2, 3, 4, 5 e 7 →
executor model=sonnet (T2.1 🧠 → opus, T4.3 → haiku) · Fase 6 → opus (T6.1 🧠, validar com architect) ·
Fase 8 → executor model=haiku, revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + commit isolado, evidência em evidence.md.
Animação só fecha com print nas duas câmeras (§5); testes de navegador só à mão (pnpm check:<área>), nunca no CI.
Pare e pergunte antes de: remover o caminho antigo do avatar.ts (T2.4), a Fase 5 se a spec 014 não tiver entregue o tornozelo,
a Fase 6 se a Fase 5 da spec 008 estiver bloqueada, qualquer dúvida de regra §1.
```
