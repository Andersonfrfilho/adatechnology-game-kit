# Cortes de apresentação dentro dos eventos da explosão (spec 017)

Base: perfil em `evidence-perfil2.md` (seções A, B, C). Nenhum corte muda a simulação: `step-equivalence*`, `exact-golden` e `blast-presentation` passam sem regravar nada.

## Item 1 — `rebuildHost` uma vez por lote (feito, 6676e2c74)

`applyStructuralEvents` e `runBudgeted` envolvem o lote inteiro em `batchRebuilds` (o mecanismo que já existia, agora reentrante em volta do lote). Cada host da malha
fundida escreve na primeira mudança do lote e uma vez no fim, em vez de duas por fratura.

Quem lê a malha no meio do lote:
- `extract` lê as posições de `plainPositions`/`host.work` (não da geometria reescrita) e as normais da geometria. Normais de uma faixa só mudam com os vértices dela
  (amassado, derretimento, dobra): essas mudanças marcam o host como `urgent` e `extract` descarrega antes de ler. O colapso de outra peça não marca.
- `measureSolids`/`fitBoxes`/`fitSurface`/`positionsOf`: leem `host.work` mais a lista `collapsedRanges`, nunca a geometria reescrita; não dependem da escrita.
- Decals: `onFace` faz raycast na geometria; descarrega todos os hosts pendentes antes.
- `partColor`: escreve o atributo de cor, independente das posições.

Teste novo `packages/game-destruction-three/tests/batched-host-writes.test.ts`: mesma malha final (posições e normais) e 2 escritas em vez de 4; peça extraída no meio do lote
sai com as mesmas normais. Ganho em ms não medido aqui.

## Item 2 — sons sem custo no tique (feito, 3c90bc389)

Causa: `playSample` (game-audio `webaudio/engine.ts`) montava os nós do Web Audio (fontes, ganhos, panner, rota de oclusão) e emitia o evento dentro da chamada de `play`, no tique.
Só a receita passava pela fila `audio.voices`; as gravações (todos os `impact_*`, `shatter_glass`, `detach`) não. Agora, com `deferredStart`, a amostra é reservada em `play`
(limitador, escolha da tomada, vida da voz, choke) e construída pela fila; `urgent` continua síncrono, parar a voz na espera cancela, o início nunca fica no passado.

Teto: o game-audio não tem teto por quadro por som (só `maxConcurrent`/`cooldown` por grupo e `choke`, que mantém os últimos e não os primeiros). `createDestructionSound` ganhou
`samePerFrame` (constante `SAME_SOUND_PER_FRAME = 4`, ligada na sala sem aumentar `room.ts`, 5621 linhas); `update` abre o próximo quadro. Explosão e laços de fogo ficam de fora.
O som não entra no hash de `step-equivalence` (nem o `log`: a sala não registra `onSound`); o `onSound` do renderer e o `options.onSound` do host continuam sendo chamados para todos.

Testes novos: `game-audio/tests/sample.test.ts` (voz reservada e construída pela fila, parada na espera) e `game-destruction-three/tests/same-sound-per-frame.test.ts`. Ganho em ms não medido aqui.

## Item 3 — `case 'damage'` da casa (não feito)

Dois motivos, ambos por leitura:
1. O custo já é pequeno: `evidence-perfil2.md` A3 mede `houseDamage` em 0,10 ms para 337 eventos; o resto dos ouvintes da casa é `breach.spall`/`chip`.
2. Leem `Damageable.hp` na hora: o `case 'fracture'` do mesmo `handleEvent` (`before = d.hp`; `before > 0` decide chamar `cfg.onDamage`; adiar o dano muda quando `onDamage`
   dispara), `strikePiece` em `build/build.ts:257-261` (`hp <= 0 && before > 0` dispara a quebra no mundo) e o contrato público "o jogo lê `hp`" (`types.ts`, `colliderDamage`).
Sem ponto único de descarga garantido antes dessas leituras, não mudei.

## Gates

typecheck: game-audio, game-destruction-three, game-test-room. Suítes: game-audio (279), game-destruction-three (673), game-test-room (481), game-floorplan-three só
`blast-presentation`, `exact-golden`, `breach-*`, `destruction`, `test-area` (118). `pnpm check:layers` e `kit-audit --check --strict-clocks`: limpos.

## Revisão

Malha (item 1):
- M1: `onFace` e `extract` descarregam só o host da malha lida (`host.mesh === mesh`); `flushPendingRebuilds` (todos) só em `shownArea` e `clipToDrawn`. Teste: duas malhas, marcas intercaladas com `hide`: 6 escritas contra 8 sem lote, malhas e marcas iguais.
- M2: `afterSplit`, `measure`, `groupCentre`, `worldBox`, `localBox` de peça com host leem `host.work` (nunca a geometria reescrita): sem estado velho. Liam a caixa da geometria da malha fundida
  (`boundingBox`, anulada só na escrita) `shownArea` (renderer.ts, no evento `explode`) e `clipToDrawn`: ganharam o descarregamento antes da leitura.
- M3: `collapseRange`/`restoreRange` da casa (breach.ts) escrevem no array e em `userData.collapsedRanges`; a escrita do fim do lote refaz `arr.set(work)` + `collapseForeign` com a lista do momento, então o fim é o mesmo
  do caminho sem lote; a restauração por `plainPositions` (`showCollapsedRanges`, ao pegar a peça inteira) roda em `adoptSplit` e escreve direto, sem `rebuildHost`. Não provei que a casa nunca chame isso
  de dentro de um lote da destruição; o teste cobre o colapso/restauração direto no array no meio do lote e dá o mesmo resultado.
- M4: cada escrita do fim do lote em try/catch; a primeira falha é relançada depois de todos os hosts, e o erro do trabalho nunca é trocado. Teste incluído.
- M5: `extract` depois de amassado e derretimento com colapsos pendentes de outras peças: posição, normal, uv e cor iguais. Teste incluído.

Som (item 2):
- S1: `explode` (e a cauda interna), `shot_*` e as chaves `*_ballistic` saem com `urgent: true`; teste com a fila cheia e orçamento zero.
- S2: a rota de oclusão e a posição (copiada em `routed`) voltam a ser lidas no `play`; só `realizeSample` espera a fila.
- S3: `announce` e `requestedAt` voltaram para o `play`; a voz construída tarde começa em `max(instante pedido, currentTime)`; descartes por latência em `stats().lateDrops` (receita e amostra; `dispose` não conta).
  `stats().voices` conta as reservadas na fila: o `maxVoices` (32) e o `maxConcurrent` são avaliados no `play` como antes, então o limite de vozes não muda.
- S4: `samePerFrame`/`SAME_SOUND_PER_FRAME`, a opção na sala e o teste dele foram retirados; `room.ts` segue com 5621 linhas.
- S5: testes de descarte por `maxLatencyMs`, `stop`/`choke` em voz reservada, `dispose` com pendentes e `stats().voices`.

Gates: game-audio (282), game-destruction-three (675), game-test-room (481), game-floorplan-three (118, só os guardas), typecheck, `check:layers`, `kit-audit --check --strict-clocks`: limpos.
