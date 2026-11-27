# Tasks — Spec 008

Base: `fix/separate-pair-boxes-sat` @ `74774f11`; solver em `spike/piece-solver-rewrite` (`b8c84bd5`, `675e4b8c`). Leia `spec.md`, `plan.md` e
`decision/DECISION-fable.md` antes de começar. Numeração T1–T18 igual à da decisão. Cada task: typecheck, testes dos pacotes
`game-destruction` e `game-destruction-three`, commit isolado, evidência em `evidence.md`. Testes de GPU/navegador só à mão ou na rodada diária
(`CLAUDE.md` §9), nunca em commit. Commits só locais; push, PR e merge só com o ok do dono.

## Fase 0 — Critério e régua
> 🤖 Modelo: `opus` para o texto do critério, `sonnet` para a régua

- T1 ✅ Dono aprova C1–C8. **Feito em 2026-11-13**, com os números do `spec.md`.
- T2 Promover `tests/lift-measure.ts` a régua única: altura de energia, grupo de contato e "episódio", mais a coluna "atingida por contato
  rápido". Um só script de sala (`decision/probes/`), juntando as colunas de A e de B. Aceite: a régua reproduz as colunas comuns das sondas A e B na baseline.
- T3 Rodar a régua em baseline, A e B e gravar a linha de base em `evidence.md`. Aceite: tabela com as três colunas, bacia e sala.

## Fase 1 — Base limpa
> 🤖 Modelo: `sonnet`

- T4 Novo branch a partir do `origin/main` atual (depois de `release/casa-a-pa-2026-11-13` entrar), trazendo `spike/piece-solver-rewrite`
  (a base `74774f11` não está no `main`; o `main` tem 13 commits que ela não tem). Aceite: build, typecheck e testes do pacote iguais ao spike.
- T5 Tirar o código morto do spike: `PAIR_WARM` e `BOTTOM_UP` (`pieces.ts:163,165,892,897-903,1026-1036` no spike). Aceite: sem referência no código; testes iguais.
- T6 Testes unitários do `boxManifold`: face-face, aresta-aresta, margem, troca face/aresta (`EDGE_BIAS`), recorte. Hoje não há nenhum. Aceite: testes novos verdes.
- T6b Separar a geração de contatos (chão e pares) do `pieces.ts` (1770 linhas) num arquivo próprio, sem mudar comportamento. Aceite: golden e testes iguais.

## Fase 2 — Fechar o critério
> 🤖 Modelo: `sonnet` (T9 é 🧠 → `opus`)

- T7 **Repouso sem tremor.** Hipótese a testar primeiro: `goal = sep > 0 ? -sep/h : bounce` (`piece-solver.ts:169`) deixa um contato a 1 mm fechar a
  0,12 m/s por subpasso, que é `STILL_SPEED`. Tratar `sep <= SLOP` como encostado (goal 0). Deve atacar as 2 peças acordadas e a porta que balança 2 s.
  Aceite: C4 na bacia e na sala.
- T8 **Sono por grupo de contato**: o grupo dorme junto quando todo ele está calmo; acorda junto. Mantém `maxAwake`, `restPoints`, `wakeUnsupported`.
  Aceite: C4 e os testes de sono do §12.
- T9 🧠 **Pilhas pesadas: medir antes de construir.** Testes de pilha (5 peças; razão de massa 20:1). Só se falharem, manifold persistente: o `feature`
  atual é o índice no polígono recortado (`piece-solver.ts:348`) e muda com o recorte; trocar por (face de referência, vértice ou aresta de recorte).
  Warm start descartado quando a normal vira, a face de referência troca ou o conjunto de pontos do par muda (origem do "chute de cunha" de 0,2–0,4 m/s).
  Duas tentativas; se o chute persistir, ficar sem warm start entre peças e registrar. Decisão escrita em `design/T9-pilhas.md` e validada com `architect` antes de implementar.
- T10 **Trava de segurança que só tira energia**: só para peça em repouso sem golpe rápido, limita o ganho ao que falta para 3,5 cm. Cada acionamento
  conta e vai ao log da sala como `invariant: debris_launched` (mesmo padrão do `broken_floating`). Na bacia o contador tem que ser **zero**: a trava é rede, não solução. Aceite: C1 e C2 com contador zero.
- T11 Resolver os 4 testes fora da bacia: porta que não deita em 3 s, deriva de 2 mm no `separate-pair` (corrigir a causa; não afrouxar a tolerância
  sem motivo), `sheet-on-clutter` semente 40 (6,0 cm). Aceite: os quatro verdes.
- T11b Varredura C6: bacia em 64 sementes x dt 0,05 e 1/60, `SOLVER_PASSES` 8/10/12, margens +-20%, como teste. Aceite: tudo verde; C5 e C8 verdes.
- T11c **Ponto de corte.** C1–C6 e C8 passam? Se não: parar, não ajustar mais constante, e decidir entre (a) A como está + T10, (b) reabrir a
  arquitetura. Revisão independente da decisão: `architect` com `model=fable`. Resultado em `evidence.md` e ao dono.

## Fase 3 — Custo
> 🤖 Modelo: `sonnet`

- T12 Laço sem alocação: `prepare` cria ~10 arrays por contato por subpasso (`piece-solver.ts:103-121,165`), `invInertia` devolve array novo a cada chamada
  (`:20`), `pieces.ts` cria `Map`/arrays e `{...contact}` por subpasso (`:872-905,1060`). Trocar por pool em `Float64Array` reaproveitado. Aceite: C5 e C8 intactos.
- T13 Resolver por grupo de contato, com saída antecipada quando a maior correção da passada fica abaixo de um limiar. Aceite: C6 intacto.
- T14 Medir C7, inclusive em AMD. Aceite: mediana e p90 <= 1,25x a baseline (`piece-bench.test.ts`) e `perf.mjs` sem regressão (à mão ou na rodada diária).

## Fase 4 — Goldens e sala
> 🤖 Modelo: `haiku` para recalibrar (T15), `sonnet` para validar (T16, T17)

- T15 Recalibrar os goldens de destruição do floorplan (breach, spall, fracture) e o hash do blast-presentation, comparando com o `origin/main` atual,
  num commit só e por último. As 6 falhas do floorplan são as mesmas em A e na baseline. Aceite: goldens verdes; diff explicado em `evidence.md`.
- T16 Sala: blast, martelo e deslizamento de terreno, 5 rodadas cada, com print. Atualizar o critério 5/10/17 de `docs/criterios-fisica-objetos.md`. Rodar
  `leak.mjs` (o pool novo não pode vazar) e `GPU_SCOPE=nightly` na mão antes do merge. Aceite: C1–C4 na sala; sem vazamento.
- T17 `README` do pacote e skill `game-destruction-three`: o que mudou para quem usa (peça de baixo sente o peso; peça dormindo acorda a 1 m/s; `onKnock`
  também entre caixas). Guardar `decision/REPORT-B-rapier.md` em `docs/` como "por que não Rapier em 2026-11".
- T18 Arquivar `spike/piece-solver-rapier` (não apagar) e remover os worktrees dos spikes. Aceite: branch preservada; worktrees fora.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes de `game-destruction` e `game-destruction-three`, `pnpm lint`, `node tools/kit-audit/audit.mjs --check`,
commit isolado, evidência em `evidence.md`. Nunca afrouxar tolerância, tirar teste ou desligar regra: corrigir a causa. Falha de gate 2x: sobe um
nível de modelo (haiku → sonnet → opus) e registra em `evidence.md`. Sem GPU/navegador em commit. PR aberto só ao fim e mostrado no Chrome do dono; merge só com o ok dele.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/008-solver-de-contato-dos-destrocos/ do repositório adatechnology-game-kit (leia CLAUDE.md §9 e §12,
spec.md, plan.md, tasks.md e decision/DECISION-fable.md antes de começar). Base: spike/piece-solver-rewrite (b8c84bd5, 675e4b8c) sobre
fix/separate-pair-boxes-sat @ 74774f11; a branch de produção parte do origin/main atual DEPOIS de release/casa-a-pa-2026-11-13 entrar (T4). A
spike/piece-solver-rapier fica arquivada, não apagada (commits com --no-verify). Crie um worktree próprio para a sessão. Uma task por vez, na ordem do
tasks.md. Os critérios C1–C8 foram aprovados pelo dono em 2026-11-13: não mude os números.
Modelos: Fase 0 T2 e T3 → executor model=sonnet (texto do critério já feito) · Fase 1 → executor model=sonnet · Fase 2 → executor model=sonnet, T9 🧠 →
opus (validar com architect antes de implementar) · ponto de corte T11c → architect model=fable (revisão independente) · Fase 3 → executor
model=sonnet · Fase 4 → T15 executor model=haiku, T16 e T17 executor model=sonnet · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm build + typecheck + testes de game-destruction e game-destruction-three + lint + commit isolado (só local), evidência em
evidence.md. Testes de GPU/navegador (sondas da sala, perf.mjs, leak.mjs) só à mão ou na rodada diária, nunca em commit. No ponto de corte (T11c), se
C1–C6 e C8 não passarem, PARE: não ajuste mais constante.
Pare e pergunte antes de: push, PR, merge, deploy, mudar a API pública do PieceSystem, qualquer [NEEDS CLARIFICATION].
```
