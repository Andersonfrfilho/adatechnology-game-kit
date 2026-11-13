# Plano — Spec 008

Decisões de 2026-11-13, a partir de [`decision/DECISION-fable.md`](decision/DECISION-fable.md). Esforço: **3 a 4 semanas de uma pessoa** (o relatório A
dizia 2–3; é otimista por causa da varredura, dos goldens e da validação na sala). **Ponto de corte no fim da Fase 2.**

## D1 — Solver

O laço roda subpasso a subpasso para todas as peças móveis juntas: gravidade, contatos **antes** do movimento, uma passada de impulsos
sequenciais sobre todo o conjunto (10 passadas; normal, atrito de Coulomb em duas tangentes, resposta angular), movimento, passe de posição
(NGS, 4 rodadas) como split impulse (nenhuma velocidade empurra a peça para fora de uma sobreposição), e a lógica de apoio de antes (tombo,
rolamento, amortecimento). Chão e topos fixos usam os mesmos pontos de amostra de antes, agora especulativos. Entre caixas: `boxManifold` com
SAT e margem, recorte por face de referência (Sutherland-Hodgman) e pontos mais próximos entre arestas. O solver (`piece-solver.ts`) já é
isolado e não usa three.js.

## D2 — Critério

C1–C8 do `spec.md`, régua única de altura de energia (`tests/lift-measure.ts` promovida). A trava de segurança (T10) só tira energia e é rede, não solução.

## D3 — Branches

| Branch | Destino |
|---|---|
| `spike/piece-solver-rewrite` (`b8c84bd5`, `675e4b8c`) | base do trabalho de produção; não vai ao `main` como está |
| `spike/piece-solver-rapier` (`4749202d`, `21447f73`, `468d243f`) | **arquivada, não apagada** (commits com `--no-verify`); guardar o `REPORT-B` em `docs/` como "por que não Rapier em 2026-11" |
| branch de produção nova | parte do `origin/main` atual **depois** de `release/casa-a-pa-2026-11-13` entrar; traz o spike A por cima |

Os dois worktrees dos spikes saem depois que a Fase 1 fechar.

## D4 — Fases

| Fase | Entrega | Dias | Modelo |
|---|---|---|---|
| 0 | critérios (feito) e régua única | 2 | `opus` (texto) / `sonnet` (régua) |
| 1 | base limpa sobre o `main`, sem código morto, `boxManifold` testado | 2 | `sonnet` |
| 2 | fechar C1–C6 e C8: repouso, sono por grupo, pilhas, trava, 4 testes fora da bacia | 5–6 | `sonnet`; T9 🧠 `opus` |
| 3 | custo: laço sem alocação, saída antecipada, C7 inclusive em AMD | 3 | `sonnet` |
| 4 | goldens, sala, documentação | 3–4 | `haiku` (recalibrar) / `sonnet` (validar) |

## D5 — Ponto de corte (fim da Fase 2)

C1–C6 e C8 passam? Se não, **parar** e decidir entre (a) entregar A como está + trava T10, já muito melhor que a baseline, ou (b) reabrir a
arquitetura. Não seguir ajustando constante. A decisão é revisada por um agente independente (`architect`, `model=fable`) antes de ir ao dono.

## D6 — Regra de GPU

Testes de GPU/navegador (sondas da sala, `perf.mjs`, `leak.mjs`) rodam só à mão ou na rodada diária (`CLAUDE.md` §9), **nunca** em commit, CI ou pre-push.
