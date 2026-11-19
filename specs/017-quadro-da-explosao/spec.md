# Spec 017 — Quadro da explosão

> Herda da spec 010 (`specs/010-quadro-com-prazo/`), que fechou sem cumprir a C8. Regra §15 (`specs/regras/15-quadro-e-desempenho.md`).

## 1. Problema

O quadro em que a explosão é aplicada (f0) custa **~90 ms a 1x** na sala (`jolt-d4-worker`; T4.1 da 010, segunda tomada:
blast 92,0, crater 98,4 ms de update mais `renderCpu`). A meta da 010 era 33,3 ms (perder no máximo um quadro). A 4x passa de 300 ms.

Conta do f0 a 1x (média blast/crater, ms; `specs/010-quadro-com-prazo/evidence.md`, "Conta do f0"):

| Parte | ms | O que é |
|---|---|---|
| `explode` | ~30 | `world.explode` síncrono (`game-destruction/src/world.ts:5828`, `blastWorld` + `withCollapses` + ~39 `solveStructure`) |
| `queues` (`floorplan.breach-cut`) | ~16 | corte da parede, `mustDrain` |
| `destrEvents` | ~12 | aplicar os eventos da explosão no renderer (`destruction.events`, `mustDrain`) |
| `action` | ~6 | `explosives.blastAt` fora do `explode` |
| `stagesOut` | ~6 | estágios da física chamados fora da física |
| resto do update | ~10 | sistemas, matrizes, áudio |
| `renderCpu` | ~9 | o desenho |

O que a 010 já tentou e não serve (evidência na 010): teto em ms no `mustDrain` (quebra os mesmos bytes, C5 da 010) e `workBudget` (aplica todo
evento no quadro dele; o f0 piora).

## 2. Objetivo

A explosão continua determinística e visível no quadro em que acontece, mas o trabalho dela se espalha por **unidades** (nunca por relógio)
num número fixo de tiques, de modo que nenhum quadro passe do prazo.

## 3. Critérios de aceite

| # | Critério | Como se mede |
|---|---|---|
| C1 | f0 inteiro (update + `renderCpu`) ≤ 33,3 ms a 1x, em `blast` e `crater` (média dos 3 piores f0) | régua da 010 (`tools/gpu/room-explosion.mjs`, mesmas condições da T4.1) |
| C2 | Nenhum quadro da janela da explosão (f0 até o fim do espalhamento) passa de 33,3 ms a 1x | idem, piores quadros por célula |
| C3 | O trabalho total da explosão (soma dos quadros da janela) não passa de 110% do da 010 T4.1 | idem, soma de `updateMs` da janela |
| C4 | Mesmos bytes: a mesma cena dá o mesmo hash por tique com tempo de quadro aleatório (semente fixa) e a 60, 120 e 144 Hz | teste no CI, como o `step-equivalence` da 010 |
| C5 | No f0 aparecem: clarão, empurrão, o furo do ponto de impacto e o som | teste de eventos do f0 + print na sala (§5 não se aplica: não é animação do jogador) |
| C6 | A 4x, o pior quadro não piora contra a T4.1 da 010 (75,5 / 161 / 59,5) | régua, 4x |
| C7 | `room.ts` não cresce (5.620 linhas ou menos) | `wc -l` |
| C8 | Tempestade, `dense_horde` e `chain_horde` não pioram contra a `origin/main` | `perf.mjs` com `PERF_MODE=gpu` (pendência herdada da T4.1 da 010) |

## 4. Fora do escopo

- Levar o mundo da destruição para um worker (§14). Fica registrado como caminho se o espalhamento por tiques não fechar a C1.
- A física da fase `input` (pendência da 010, spec própria).
- Explosões em cadeia (`chain_horde`) além de não piorar (C8).

## 5. Decisões

| # | Decisão | Estado |
|---|---|---|
| D1 | **Janela da explosão:** em quantos tiques de 1/120 s o trabalho pode se espalhar. Recomendação: até 6 tiques (50 ms, 3 quadros a 60 Hz), com o efeito visível do impacto no primeiro. | [NEEDS CLARIFICATION] dono |
| D2 | **Fixture da T3.2 regravado** (`game-test-room/tests/fixtures/step-equivalence.json`) e os goldens de explosão que mudarem de quadro (`RECORDED_BLAST_OUTCOME`, `exact-floorplan` `destruction/*`). O estado final igual; só muda em que tique cada evento entra. | [NEEDS CLARIFICATION] dono |
| D3 | **Caminho do `world.explode`:** dividir em passos por tique dentro do mundo (recomendado: mesmo processo, determinístico, unidades) antes de pensar em worker. | proposta, valida na T1.1 |
| D4 | **Unidade do teto** em `destruction.events` e `floorplan.breach-cut`: número de eventos/cortes por tique, fixo por `tier`, como o `WorkBudget` (spec 008 E2). | proposta, valida na T1.1 |
