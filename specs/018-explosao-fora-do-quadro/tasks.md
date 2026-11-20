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

## Fases seguintes

Só existem depois das decisões D1 a D3 do `spec.md`. O que qualquer caminho herda da 017 está em
`specs/017-quadro-da-explosao/design-onda.md` (§2.2 a §2.6, §3 e a lista de testes do §5).

## Prompt de execução

Só a Fase 0 pode ser executada: as fases seguintes dependem de D1, D2 e D3, que estão abertas.

```text
/oh-my-claudecode:autopilot Execute a Fase 0 da spec specs/018-explosao-fora-do-quadro/ (leia spec.md e tasks.md; leia também
specs/017-quadro-da-explosao/design-onda.md, specs/regras/14-workers.md e specs/regras/15-quadro-e-desempenho.md). Uma task por vez, num
worktree próprio (branch spec/018-explosao-fora-do-quadro, a partir da main). Tudo desta fase é protótipo descartável: nada de código vai
para a main, só a evidência.
Modelos: T0.1 e T0.5 🧠 → executor model=opus · T0.2 a T0.4 → executor model=sonnet.
Medições: máquina fria e quieta (carga < 1,5, processador longe do limite térmico), sob flock
~/.cache/adatechnology-game-kit/perf-measure.lock, pares alternados na mesma sessão, pnpm build e a página da sala refeitos; descarte rodada
com a página travada e diga que descartou. Régua: o comando de docs/desempenho-explosoes.md com ROOM_EXPLOSION_BUDGET=deadline.
Cada task fecha com typecheck dos pacotes tocados e os números em evidence.md.
Pare e pergunte antes de: qualquer coisa além da Fase 0, regravar golden ou fixture, abrir PR de código, decidir D1, D2 ou D3.
```
