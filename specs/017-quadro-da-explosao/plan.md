# Plano — Spec 017, quadro da explosão

## Abordagem

Uma explosão vira um **trabalho em tiques**: o tique 0 faz o que o jogador vê no golpe (clarão, empurrão, furo do ponto de impacto, som) e
agenda o resto; os tiques seguintes, até a janela da D1, aplicam o dano às peças, cortam as paredes, resolvem a estrutura uma vez por objeto
no último tique e soltam os eventos. Tudo por unidades fixas por `tier`, nada pelo relógio, para os mesmos bytes (C4) valerem em toda máquina.

## Fases

1. **Fase 0 — Régua de partida.** A T4.1 da 010 (`regua-t41-b03516f37-r2.json`) é a base de C1–C3 e C6. Falta a rodada `PERF_MODE=gpu` do
   `perf.mjs` (C8) contra a `origin/main`.
2. **Fase 1 — Desenho (🧠).** Medir por dentro o `world.explode` (onde vão os ~30 ms: `blastWorld` por peça, dano, `withCollapses`, as 39
   `solveStructure`) e o `breach-cut` (~16 ms). Desenhar: o que fica no tique 0, a unidade de cada parte, a ordem dos tiques, como os eventos
   ganham o tique em que saem, como `drainDetached` e o `mustDrain` mudam (o `mustDrain` passa a drenar o que o tique entregou, não a explosão
   inteira). Validar com `architect` e com `engenheiro-estrutural` (a estrutura resolvida no fim muda o caminho de carga intermediário).
3. **Fase 2 — Trabalho da explosão em tiques** no `game-destruction` (mundo) e no `game-destruction-three` (eventos), atrás de uma opção, com o
   teste de mesmos bytes (C4) antes de ligar.
4. **Fase 3 — Corte da parede por unidades** no `game-floorplan-three` (`breach-cut`).
5. **Fase 4 — Ligar na sala e no preset**, regravar o que a D2 permitir, régua final e `perf.mjs`.

## Riscos

| Risco | Mitigação |
|---|---|
| A estrutura vista no meio da janela fica num estado que não existe no fim (parede sem apoio por 2 tiques) | Estrutura resolvida só no último tique; peças da janela não caem antes dele (T1.1 decide com o `engenheiro-estrutural`) |
| Um tiro ou golpe no meio da janela encontra a explosão pela metade | Regra da T1.1: um golpe novo força o resto da janela no tique dele (determinístico) |
| O ganho no Node não aparece no navegador (aconteceu na 010: 112 → 33 ms no Node, −15% na régua) | Toda task de desempenho fecha com a régua do navegador, não com o Node |
| Goldens mudam de quadro | D2: estado final igual, regravação só com aprovação do dono |
