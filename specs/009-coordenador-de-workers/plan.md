# Plano — Spec 009

## Camadas

- `game-contracts/src/workers.ts`: tipos (`WorkerCoordinator`, `TaskKind`, `ResidentKind`, `TaskHandle`, `ResidentHandle`, estatísticas),
  `WORKER_KIND_ID` e `WORKER_KIND_DEFAULTS`. Os pacotes de conteúdo dependem só disso.
- `game-workers`: coordenador, plano de núcleos, host do worker, spawns (navegador, fonte, Node, na mesma thread), `checkTaskKind`.
- Cada pacote dono declara a sua categoria junto do kernel (`crowdPhysicsKind` em `game-crowd`, `groundTilesKind` em `game-destruction`,
  `pieceBoxesKind` e `shapesGenerateKind` em `game-shapes`, ...) e recebe o coordenador pelas opções (`workers`).
- `game-kit-defaults`: `KIT_WORKER_KINDS`, o arquivo de worker do kit e `createKitWorkers()`, que monta o coordenador com tudo do kit.
- Sala: um coordenador por página (`window.__kitWorkers`), worker feito do texto embutido; `?workers=0|N|auto`.

## Decisões

- D1. Prazo contado no relógio do chamador (`at.frame`). Uma resposta só chega entre tarefas do navegador: vários passos fixos dentro do mesmo
  quadro desenhado caem no fallback a partir do segundo. A latência das categorias `sim` é escolhida em **quadros desenhados** quando o
  pacote passa o número do quadro do `game-runtime`; a multidão, que conta passos, usa latência 1 com 1 passo por quadro a 60 Hz. Medir na
  sala e ajustar por categoria (`kinds`).
- D2. Entrada de tarefa `sync` é copiada, nunca transferida (o fallback precisa dela); saída é transferida.
- D3. Worker que cai é recriado até 5 vezes; tarefa que derruba 2 workers roda no quadro principal.
- D4. Mundo vivo: a residente guarda o estado da região no worker (`late: 'drop'`), recebe eventos e devolve mudanças; perto do jogador a
  região volta para a simulação completa por um retrato aplicado num quadro marcado.

## Medição

Toda migração mede na sala da 4280 (helios, GPU real), com `flock ~/.cache/adatechnology-game-kit/perf-measure.lock` e carga abaixo de 4:
explosão na laje, cratera, martelo e a horda, com `?workers=0` e com o automático, rodadas intercaladas, p99 e pior quadro da física e a
fração entregue a tempo (`stats()`). Resultado em `evidence.md`.
