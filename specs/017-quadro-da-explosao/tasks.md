# Tasks — Spec 017, quadro da explosão

## Gates de toda task

- `pnpm --filter <pacote> typecheck` e `test` de cada pacote tocado; `pnpm check:layers` sem violação nova; `node tools/kit-audit/audit.mjs --check` 0 novos.
- Commit isolado por task; evidência em `evidence.md`.
- Nenhuma medição de tempo com carga de 1 minuto acima de 1,5 nem com outra sessão pesada; medir sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`.
- Goldens e hashes: só com a aprovação da D2.

## Fase 0 — Régua de partida
> 🤖 Modelo: `haiku`

- **T0.1** Rodada `PERF_MODE=gpu` do `perf.mjs` (tempestade, `dense_horde`, `chain_horde`) na `spec/010-pr` e na `origin/main`; tabela no `evidence.md` (base da C8).
  **Adiada para a régua final (T4.2) por decisão do dono em 2026-11-19:** duas tentativas morreram no tempo limite com a máquina carregada
  (`evidence.md`, T0.1); os números parciais são só indicativos. **Adiada, não feita.**

## Fase 1 — Desenho
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, validar com `architect` e `engenheiro-estrutural`)

- **T1.1 🧠 (feita, 2026-11-19)** `design-tiques.md`: f0 repartido no navegador, por que a D3 não cabe com a D2, etapas A, B e C, decisão D5.
  Validado com mudanças pelos dois revisores.
- **T1.2** Teste de mesmos bytes da janela (C4): a cena do `step-equivalence` com tempo de quadro aleatório (semente fixa) e a 30, 60, 120 e
  144 Hz dá o mesmo hash por tique. Mais: pintura adiada dá a mesma máscara que a pintura no f0; evento visual de uma peça aplica antes do
  estrutural dela; `splitLoose` sem `workBudget` deixa de decidir pelo relógio (`renderer.ts:2306`). Escrito antes da Fase 2.
  **Feita (2026-11-19):** quatro testes escritos antes da Fase 2, fixture e goldens sem diff; os dois `it.fails` (tique 31 em diante, `hole` depois do `detach`) ficaram para a T2.2; `splitLoose` sem relógio corrigido (`evidence.md`, T1.2).

## Fase 2 — Baratear o `explode` e classes de evento
> 🤖 Modelo: `sonnet`

- **T2.0 (feita, 2026-11-19)** Perfil no navegador: a sala usa `blastPlain` (o `reachAt` roda 0 vezes); `stagesOut` é parte do evento
  `fracture`; eventos adiáveis somam ~4 a 5 ms. Tabelas no `evidence.md`. (Resultado: `explode` ~22 ms, o maior item é `knockOutUnits`, 5,5 a 7,7 ms.)
- **T2.1** Etapa B do desenho (§4), pelos alvos medidos: `knockOutUnits` (perfil por dentro primeiro), `blastPlain`, `spallOuter`, o evento
  `fracture` e a cópia de ouvintes do `emit`. Um alvo por commit, com tabela antes/depois na régua. Mesma saída: goldens e fixture sem diff.
  **Em parte:** cortes A–D do `explode` entraram (~1 ms, dentro do ruído, nenhum bit muda); malha da casa por lote entrou (~1,7 ms em `rebuildHost`); item E (resolução estrutural em `knockOutUnits`) desfeito, mudou golden; item F (corte da parede adiado) e eventos visuais adiados não entraram (0 a ~1 ms); a etapa do `reachAt` não tem o que cortar (a sala usa `blastPlain`). Tabelas: `evidence.md`, rodadas 3 a 5.
- **T2.2** `destruction.events` em duas classes (lista no `design-tiques.md` §3): estrutural no quadro do golpe; visual (`hole`, `crack`,
  `debris`, `ricochet`) numa fila de prazo com espera máxima de 3 tiques.
  **Feita (2026-11-19), na forma do tique:** `EVENT_CLASS` e `applyStructuralEvents` no fim do tique, sobre a pose do passo; `step-equivalence-window` 4 de 4 passa (30/120/144 Hz e tempos aleatórios, solver próprio e Jolt); f0 sem mudança (0 ms), é correção de determinismo; o adiamento dos visuais não entrou (~1 ms). Pendência: o caminho com `workBudget` (`evidence-120hz.md`).
- **T2.3** Golpe no meio da janela: parede ou peça com trabalho pendente entra no `mustDrain` do golpe novo (teste).

## Fase 3 — Pintura da parede por unidades
> 🤖 Modelo: `sonnet`

- **T3.1** `floorplan.breach-cut`: `mustDrain` só para as paredes do impacto e as que têm `fallen` novo; o resto numa fila de prazo, 1 unidade =
  1 parede. `floorplan.breach-paint`: 1 unidade = 1 parede.
  **Feita (2026-11-20):** f0 de ~78 para ~65 ms no modo de prazo (−13); pintura da casa no quadro do golpe de 9 para 0,2 ms; quadro seguinte ~25 ms no pior, abaixo de 33,3 (`evidence.md`, T3.1).
- **T3.2 (bloqueada pela D5, não feita)** Etapa C (teto da janela no `splitWithin`, saída de cima para baixo) e gerador próprio de `spall`/`drip`/`leak`.

## Fase 4 — Ligar e medir
> 🤖 Modelo: `sonnet` (revisão final → `code-reviewer` `sonnet`)

- **T4.1** Ligar na sala e no preset (`game-kit-defaults`); regravar o que a D2 permitir.
- **T4.2 (adiada)** Régua final (C1, C2, C3, C6) nas condições da T4.1 da 010 e `perf.mjs` (C8); `room.ts` (C7).
- **T4.3** Documentação (`docs/desempenho-explosoes.md`, README do `game-destruction`, regra §15 se o `mustDrain` mudar).

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/017-quadro-da-explosao/ (leia spec.md, plan.md, tasks.md e design-tiques.md antes de
começar; leia também specs/010-quadro-com-prazo/evidence.md, seções T4.1, e specs/regras/15-quadro-e-desempenho.md). Uma task por vez, na
ordem do tasks.md, num worktree próprio (branch spec/017-quadro-da-explosao). A T1.1 está feita. Escopo desta rodada: T0.1, T1.2, T2.0 a
T2.3, T3.1 e a régua da T4.2. NÃO faça a T3.2: ela depende da decisão D5 do dono.
Modelos: Fase 0 → executor model=haiku · Fases 1 a 4 → executor model=sonnet · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes dos pacotes tocados + check:layers + kit-audit --check --strict-clocks + commit isolado, evidência em
evidence.md com tabela antes/depois e o JSON ao lado.
Medições de tempo só com carga < 1,5 e sob flock perf-measure.lock, com pnpm build e a página da sala refeitos; nada de teto pelo relógio no
que muda a simulação (mesmos bytes, C4). Nas T2.1, T2.2 e T3.1 os goldens e o fixture do step-equivalence não podem mudar.
Pare e pergunte antes de: qualquer golden ou fixture com diff, mudar a janela (D1), a T3.2/D5, levar o mundo para um worker, PR.
```
