# Tasks — Spec 017, quadro da explosão

## Gates de toda task

- `pnpm --filter <pacote> typecheck` e `test` de cada pacote tocado; `pnpm check:layers` sem violação nova; `node tools/kit-audit/audit.mjs --check` 0 novos.
- Commit isolado por task; evidência em `evidence.md`.
- Nenhuma medição de tempo com carga de 1 minuto acima de 1,5 nem com outra sessão pesada; medir sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`.
- Goldens e hashes: só com a aprovação da D2.

## Fase 0 — Régua de partida
> 🤖 Modelo: `haiku`

- **T0.1** Rodada `PERF_MODE=gpu` do `perf.mjs` (tempestade, `dense_horde`, `chain_horde`) na `spec/010-pr` e na `origin/main`; tabela no `evidence.md` (base da C8).

## Fase 1 — Desenho
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, validar com `architect` e `engenheiro-estrutural`)

- **T1.1 🧠** `design-tiques.md`: perfil por dentro do `world.explode` e do `breach-cut` (instrumentação temporária, sem commit); o que fica no
  tique 0; unidade e ordem de cada parte; tique de saída de cada evento; mudança no `mustDrain`; golpe no meio da janela; estrutura no último tique.
- **T1.2** Teste de mesmos bytes da janela (C4): a cena do `step-equivalence` com tempo de quadro aleatório (semente fixa) e a 60, 120 e 144 Hz dá o
  mesmo hash por tique. Escrito antes da Fase 2, falha só onde a Fase 2 ainda não existe.

## Fase 2 — Explosão em tiques
> 🤖 Modelo: `sonnet`

- **T2.1** Mundo (`game-destruction`): `explode` agenda o trabalho e devolve o resultado do tique 0; o resto anda no passo fixo, por unidades. Opção desligada por padrão.
- **T2.2** Eventos (`game-destruction-three`): `destruction.events` drena o que o tique entregou; teto por unidades (D4).
- **T2.3** Golpe no meio da janela força o resto (teste).

## Fase 3 — Corte da parede por unidades
> 🤖 Modelo: `sonnet`

- **T3.1** `floorplan.breach-cut` por unidades por tique (D4), o furo do ponto de impacto no tique 0 (C5).

## Fase 4 — Ligar e medir
> 🤖 Modelo: `sonnet` (revisão final → `code-reviewer` `sonnet`)

- **T4.1** Ligar na sala e no preset (`game-kit-defaults`); regravar o que a D2 permitir.
- **T4.2** Régua final (C1, C2, C3, C6) nas condições da T4.1 da 010 e `perf.mjs` (C8); `room.ts` (C7).
- **T4.3** Documentação (`docs/desempenho-explosoes.md`, README do `game-destruction`, regra §15 se o `mustDrain` mudar).

## Perguntas pendentes (sem prompt de execução até fechar)

1. **D1 — janela da explosão:** quantos tiques de 1/120 s? Recomendação: até 6 (50 ms), com o impacto visível no primeiro.
2. **D2 — regravar o fixture da T3.2 e os goldens de explosão** que mudarem só de tique (estado final igual)?
