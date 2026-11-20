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

## Fase 5 — A explosão como frente de onda (D5 b)
> 🤖 Modelo: `sonnet` (T5.0 e T5.1 são 🧠 — desenho validado em `design-onda.md`; T5.9 → `code-reviewer` `sonnet` + `engenheiro-estrutural`)
>
> **Não construída.** A T5.0 foi feita em 2026-11-20 e não passou em C-a a velocidades físicas (`design-onda.md` §9); o dono fechou a D5
> como (a). As tasks abaixo ficam como registro do que a divisão da explosão exigiria, para a spec do worker (018).
>
> Só começa se o critério de entrada do `design-onda.md` §6 passar (C-a, C-b, C-c). Branch `spec/017-onda`, a partir da `main`.
> Com a onda desligada (padrão do kit) nenhum golden, fixture ou `serialize()` pode mudar, em nenhuma task.

- **T5.0 🧠** Critério de entrada: protótipo com a regra do §2.1, três pares alternados, 3 combinações de `waveSpeed`/`waveStart`.
  Números em `evidence.md`. Não passou em C-a: fechar a D5 como (a) e parar a fase.
- **T5.1 🧠** Mundo, o núcleo: `BlastOptions.waveSpeed`/`waveStart`, frente por tempo do mundo, conjunto por onda em `p.rt`, ordem por
  distância e ids, `NaN`, fim exato no raio, primeiro anel cobrindo a bola de fogo, ordem fixa dentro do `update` (§2.1, §2.2, §3 item 3).
  Testes 1, 2, 5, 6 e 11 do §5.
- **T5.2** Estrutura: peça em `o.collapsed` não flete entre apoios; invariante I1 por tique na casa da sala e na torre. Testes 3, 4 e 8.
- **T5.3** Uma frente só: `blastFrontSpeed`/`frontQueue` absorvidos (§2.4); `lightLeaksNear` por anel. Testes 9 e 12.
- **T5.4** Salvar no meio: campo `waves` no snapshot, só quando não vazio, versão 1 (§2.6). Teste 10.
- **T5.5** Evento `blast_front` (`game-contracts`, `EVENT_CLASS: structural`) e o empurrão dos pedaços e da alvenaria esfarelada nos anéis
  seguintes (`game-destruction-three`, §2.5 e §3 item 2); I2: grupo colapsado em T+1 separado no quadro de T+1; nenhum `broken_floating`
  em nenhum tique. Teste 7 e os três de `game-destruction-three`.
- **T5.6** Ligar: `DEFAULT_BLAST_WAVE` no `game-destruction`, padrão no `makeRoom` e no `game-kit-defaults`; o teste do fixture de 60 Hz
  passa `waveSpeed: Infinity`; fixture novo com a onda ligada; `step-equivalence-window` nos dois modos; log quando `blastScene` desliga a
  onda (§2.7, §4). Retorno do `explode`: `n` do log e quem lê `withCollapses` (§2.3).
- **T5.7** Régua e travas: variante do portão no mesmo PR (§15), `room-explosion.mjs` mede o padrão da sala, C-a/C-b/C-c com a implementação
  final (não com o protótipo), `perf.mjs` contra a `main` com a máquina quieta.
- **T5.8** Sala, à mão: explosão e cratera em primeira e terceira pessoa (§5 das regras); o atraso da parede de fora e o voo dos pedaços.
- **T5.9** Revisão (`code-reviewer` e `engenheiro-estrutural`), documentação (`docs/desempenho-explosoes.md`, README do `game-destruction`,
  regra §15), PR. Depois do merge: semear a base da rodada noturna.

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

### Fase 5 (frente de onda)

```text
/oh-my-claudecode:autopilot Execute a Fase 5 da spec specs/017-quadro-da-explosao/ (leia spec.md, tasks.md e design-onda.md inteiro antes
de começar; leia também specs/regras/15-quadro-e-desempenho.md e a seção C8 do evidence.md). Uma task por vez, na ordem do tasks.md, no
worktree da branch spec/017-onda. A T5.0 decide se a fase existe: sem C-a, pare e registre.
Modelos: T5.0 e T5.1 🧠 → executor model=opus, seguindo o design-onda.md já validado por architect e engenheiro-estrutural ·
T5.2 a T5.8 → executor model=sonnet · T5.9 → code-reviewer model=sonnet e engenheiro-estrutural.
Escalada: gate falhou 2x → sobe um nível (sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes dos pacotes tocados + check:layers + kit-audit --check --strict-clocks + commit isolado, evidência em
evidence.md. Com a onda desligada nenhum golden, fixture ou serialize() muda: rode os testes de golden do pacote em toda task.
Medições só com carga < 1,5 no começo, sob flock ~/.cache/adatechnology-game-kit/perf-measure.lock, pares alternados na mesma sessão, com
pnpm build e a página da sala refeitos; descarte rodada com a página travada (quadro ~10x) e diga que descartou.
Pare e pergunte antes de: regravar qualquer golden ou fixture existente, C-b ou C-c falhando com C-a passando, mudar o padrão do kit para
ligado, levar o mundo para um worker, merge do PR.
```
