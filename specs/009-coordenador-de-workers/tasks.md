# Tasks — Spec 009, coordenador de workers

Leia `spec.md`, `plan.md`, `specs/regras/14-workers.md` e `packages/game-workers/README.md` antes de começar. Uma task por vez, na ordem.

## Gates de toda task

1. Typecheck e testes sem GPU dos pacotes tocados; lint dos arquivos alterados; `node tools/kit-audit/audit.mjs --check`.
2. Categoria nova: `checkTaskKind` (ou o teste de estado do pacote, para residente) com `worker_threads` de verdade no CI.
3. Migração que muda tempo de quadro: medição na sala da 4280 com a trava `perf-measure.lock` (§9, à mão), evidência em `evidence.md`.
4. Nada pronto sem print da sala mostrando o comportamento e os contadores do coordenador.

## Fase A — Base (PR #358)

- T1 ✅ Contratos em `game-contracts` e pacote `game-workers` (coordenador, plano de núcleos, host, spawns, `checkTaskKind`), 15 testes.
- T2 ✅ Multidão como residente `crowd.physics`: estado idêntico sem worker, com worker a tempo, sempre atrasado e com `worker_threads`.
- T3 ✅ Sala: coordenador da página na horda (`sourceSpawn`, `?workers=`), checagem no navegador com print dos contadores.
- T4 ✅ Regra §14, README, referência na skill `kit-base`.
- T5 Medir a horda na 4280 (helios): fração a tempo e tempo de física por quadro com `?workers=0` e automático; ajustar a latência (D1).

## Fase B — Chão da cratera

- T6 `groundTilesKind` (`destruction.ground-tiles`) em `game-destruction`, construído em cima do worker do chão da thread do desempenho
  (depois que o PR dele entrar na main): o protocolo próprio sai, o quadro fixo +2, o aquecimento e a contagem passam a ser do coordenador.
- T7 Equivalência (`checkTaskKind` com ladrilhos reais) e a mesma medição da sala; meta: pior quadro da cratera ≤ 5,8 ms, 100% a tempo.

## Fase C — Caixas das peças

- T8 `pieceBoxesKind` (`destruction.piece-boxes`) em `game-shapes` com o kernel `fitOrientedBoxes`; o renderer de `game-destruction-three`
  submete no quadro da quebra e aplica as caixas em N + 2 (as peças esperam como as do chão); o cache por pontos e triângulos fica antes da fila.
- T9 Equivalência e medição na sala (laje, parede de tijolo, carro).

## Fase D — Carga: colisores fixos, formas e normais

- T10 `staticCollidersKind` (`destruction.static-colliders`, faixa `build`): colisores fixos da casa gerados na carga, em fatias, com a
  promessa resolvida antes de a casa ficar sólida.
- T11 `shapesGenerateKind` (`shapes.generate`, faixa `build`): `createShapePool` passa a usar o coordenador quando recebe `workers` (a API
  antiga continua, marcada como legada); normais da malha calculadas dentro do mesmo kernel.
- T12 Medir o tempo de carga da sala e da casa com `?workers=0` e automático.

## Fase E — Preset e ferramentas

- T13 `game-kit-defaults`: `KIT_WORKER_KINDS`, `dist/kit-worker.js`, o texto do worker para página de arquivo único e `createKitWorkers()`
  ligado ao `game-runtime` (`tick` no início do passo fixo, `warm` na carga). Ligado por padrão (o resultado é o mesmo).
- T14 Painel do `game-devtools` com os contadores por categoria; `perf-gate` grava a fração a tempo e falha quando ela cai.
- T15 Reserva de núcleos para o Jolt multithread e o spawn do Electron (combinar com a thread do app desktop).

## Fase F — Mundo vivo em segundo plano

- T16 Contrato do retrato de região (`WorldRegionSnapshot`) e do evento de mundo em `game-contracts`; critério de distância por nível de
  detalhe (perto: simulação completa no quadro; longe: residente `world.region` na faixa `background`).
- T17 Residente `world.region` em `game-crowd` (horda e civis da região andando em passos de 10 quadros, rotinas, fome, deslocamento) e em
  `game-urban` (prédio caído, fogo que se espalha); eventos entram (explosão, barulho), mudanças saem.
- T18 Troca de nível de detalhe num quadro marcado: a região que o jogador deixa vira residente; a que ele alcança volta pelo retrato.
- T19 Faixa `background` pausa com a aba escondida e nunca atrasa o quadro (`late: 'drop'`); sem worker, roda em fatias do orçamento ocioso.
- T20 Cenário da sala: regiões longe com horda e incêndio, o jogador volta e vê o que mudou; print e medição com a trava.
