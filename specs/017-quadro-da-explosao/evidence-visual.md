# Evidência — T2.2, segunda metade: eventos visuais fora do quadro do golpe

Branch `spec/017-visual` (de `spec/017-quadro-da-explosao`). **O ganho em ms NÃO foi medido** (sem navegador/GPU, por regra de máquina); o que
está provado aqui é o comportamento por quadro e a igualdade dos goldens.

## O que mudou

- `packages/game-destruction-three/src/renderer.ts`
  - `destruction.events` segue `mustDrain` (única fila `mustDrain` do renderer; nenhuma nova). No quadro do golpe aplica os estruturais (no tique,
    como antes) e os **primeiros `IMPACT_VISUAL_EVENTS = 16` visuais** do quadro (`putOffVisual`, linha ~1305). O excedente vai para o
    `VisualBacklog`.
  - Fila nova `destruction.visual-events` (`visualQueue`, linha ~488): **não** é `mustDrain`; 1 unidade = 1 evento, ordem de emissão; id em
    `DEFERRED_QUEUE_ID`, prioridade 245 / `present` / `minEveryFrames: 1` em `DEFERRED_PRIORITY` (`game-contracts/src/frame.ts`).
  - Mesma disciplina da pintura da T3.1: com folga aplica enquanto cabe (`visualFits`: sobra do prazo >= custo do último evento); sem folga não
    começa; janela `VISUAL_WINDOW_FRAMES = 3` (quadro do golpe incluído): vencidos aplicam de qualquer jeito, e antes disso o devido é
    `ceil(mais antigos / (janela - idade do mais velho))` (`VisualBacklog.owed`). Sem relógio próprio: usa o `clock`/`deadline` do `run` e a
    contagem de quadros de `pending(frame)`.
  - "Um golpe" = os visuais drenados no mesmo número de quadro (`impactFrame`); reinicia quando chega visual em quadro diferente.
  - Ordem (item 3): `releaseVisualsBefore` aplica o backlog dos objetos que têm estrutural, antes dele, no fim do tique
    (`applyStructuralEvents`) e em qualquer drain que leve estrutural. Acréscimo além do pedido: `releaseVisualsBeforeSplit` aplica o backlog de
    objetos em `looseToCheck` antes de `splitChecked` (depois do split a peça sai de `partVis` e a marca se perdia; o teste de cena com grupo solto
    pegou isso).
  - Sem host nada muda: o adiamento só liga com a fila visual registrada num orçamento (`visualAttached`), `structuralInTick`, sem `workBudget`,
    sem flush e com número de quadro visto. `flush`, `detach` e `runWork` aplicam o backlog inteiro; `clear`/`dispose` o descartam; `releasePieces` tira os
    eventos do objeto.
- `packages/game-destruction-three/src/visual-backlog.ts` (novo): fila com idade em quadros, sem alocação por evento.
- Testes ajustados por causa da fila nova: lista de filas em `deferred-queues.test.ts` e `game-test-room/tests/room.test.ts`.

## Item 5 — visual não toca simulação (conferido)

`hole`, `crack`, `ricochet`, `debris`, `damage`, `melt`, `disassemble_progress` e os sem `case` (`reveal`, `stress`, `sway`, `blast`, `body`,
`fragment_hit`): nenhum sorteia em `this.rng`, cria corpo, mexe em malha de colisão ou escreve no `log`. Marcas usam `hashNumbers` e o gerador do
vfx (outro gerador). `damage`/`melt` só fazem `activate` (mapa de apresentação). O prólogo de todo `applyEvent` (`staticDirty`, `releaseBatched`,
`hitPoints.note`) só marca nova medição e recência; o evento estrutural do mesmo objeto vê o backlog já aplicado. Nenhum tipo foi movido na tabela.

## Limites conhecidos

- Visuais que precedem o último estrutural de um tique continuam aplicados no tique (não entram na contagem de `K`).
- Um evento do backlog pode ser aplicado depois de visuais de um golpe novo do mesmo objeto (a ordem é de emissão só dentro de cada golpe).
- `checkDeferredQueue` não foi aplicado à fila visual: com o orçamento ligado ela pode correr 0 unidades com eventos esperando (como a fila de pintura
  da T3.1; a janela é o que a move). Sem orçamento (sem `attach`) corre 1.

## Testes novos (`tests/visual-events-deferral.test.ts`, 13)

Com `createFrameBudget` real (`ms: 0`, relógio parado): 100 visuais -> quadro 1: 16; quadro 2: 58 (16 + 42); quadro 3: 100, na ordem. Com folga
(`ms: 100`): 100 no quadro 1. Tiro isolado (4): inteiro no quadro. Golpe seguinte reinicia o `K` (16 + 16 + 12). Estrutural segue esperando o tique.
Visual adiado de objeto que ganha `detach` é aplicado antes dele. Objeto com grupo solto: nada adiado. Standalone (`update`): 100 no mesmo
quadro, ordem; fila visual sem orçamento: nada adiado; `flush` aplica backlog e tudo; `detach` aplica o backlog; `dispose` e `release` descartam.

## Gates (um pacote por vez)

- `pnpm install --frozen-lockfile`; build das dependências.
- typecheck: game-contracts, game-destruction-three, game-test-room, game-floorplan-three: 0 erros.
- game-destruction-three: 88 arquivos passaram, 19 pulados (681 testes).
- game-test-room: 66 arquivos, 480 + 1 (a lista de filas, ajustada), incluindo `step-equivalence` e `step-equivalence-window` sem mudar fixture.
- game-floorplan-three (golden-scene, exact-golden, team-golden-house-area, blast-*, breach-*, destruction): 9 arquivos, 125 testes.
- game-contracts (119) e game-runtime (61): passam.
- `pnpm check:layers`: sem violações novas. `kit-audit --check --strict-clocks`: 0 novos, 0 relógios novos.
- Nenhum golden/fixture mudou. `room.ts`: 5621 linhas (igual).

## Revisão (código reprovou `083277451`)

1. **Tique antes do quadro.** `applyStructuralEvents` agora deixa na fila, para o dreno do quadro, o visual de objeto sem estrutural no lote, sem
   split à vista e que não é peça acordada (`isLeftForFrame`); o visual de objeto com estrutural no lote segue aplicado antes dele, no tique.
   Só vale com o orçamento dono do backlog (`canPutOffVisuals`); sem host tudo sai no tique como antes. Testes na ordem de produção
   (tique, depois quadro): emite `detach` + 50 marcas em `o1` e 100 em `o2`: o tique aplica as 50 de `o1` antes do `detach` e nenhuma de `o2`; o quadro
   aplica as 16 primeiras de `o2` (mais 1 da fila, o piso do item 4) e deixa 83 no backlog. **Limite:** objeto que tem estrutural no lote (casa
   com `chip`/`stage` num golpe) continua com todos os visuais no tique; o ganho é nos objetos sem estrutural no lote.
2. `redraw`, `restore` e `unbind` descartam o backlog do objeto (testes dos três, mais `release` e `dispose`).
3. Peça acordada não adia (`isMovingPiece`); `runVisualBacklog` aplica, no começo, o backlog de objeto que virou peça (`releaseMovingPieces`).
4. `owed` no mínimo 1 com pendentes; `checkDeferredQueue` passa na fila (teste, com o prazo vencido corre uma unidade). Numa fila de quadro real,
   as vencidas além da primeira correm de qualquer jeito (a janela), como na pintura.
5. Teto `VISUAL_EVENTS_PER_FRAME = 96` por quadro sem folga; a janela estica além de 3 quadros quando o backlog passa do teto. 100 marcas saem
   em até 3 quadros; 1000 saem com no máximo 96 por quadro (mais as primeiras do golpe no primeiro), todas, em ordem.
6. O ponto de impacto (`HitPoints`) é gravado quando o evento é adiado, e a aplicação do backlog não grava de novo (`isBacklogApply`): o mais novo vence.
7. Cota `K` por objeto por quadro (`impactCounts`).
8. Testes por comportamento (tudo aplicado até o quadro N, ordem, monotonia, teto) em vez da fórmula 16/58/100; relógio falso que anda
   (cada som custa 0,1 ms, `ms: 2`) exercita `visualFits`/`lastVisualMs`. 24 testes, nenhum pulado.

Gates: typecheck destruction-three sem erro; destruction-three 692 testes; game-test-room 481 (inclui `step-equivalence*`); floorplan-three (golden,
blast, breach, destruction) 125; `check:layers` e `kit-audit --strict-clocks` sem novidade; nenhum golden mudou; `room.ts` 5621. Ganho em ms não medido aqui.

## Revisão 2 — por peça

A regra "objeto com estrutural no lote" mata o ganho quando a casa é um objeto só. Agora é por (objeto, peça): `TouchedParts` (`touched-parts.ts`),
reaproveitado entre lotes (sem alocação por evento).

### Levantamento: o que cada estrutural toma

| Tipo | Peças que nomeia / alcance |
|---|---|
| `fracture` | `part` (some: `visuals.hide`); depois `splitLoose` separa TODOS os grupos soltos do mundo: as peças de `world.state(obj).groups[1..]` mudam de dono |
| `detach` | `parts` (as 2 do junta) e `groups` (os do fim da operação); `splitLoose` igual: peças de `groups[1..]` do estado |
| `collapse` | `parts` (a lista) e `splitLoose`: `groups[1..]` |
| `chip` | `part`, mas `clearDecals` varre os decals de TODAS as peças do objeto dentro da caixa do chip (centro, tamanho/2 + 0,05 m, `rotation`) e `decals.clearInside` do vfx: alcance por REGIÃO do mundo, delimitável porque a caixa vem no evento (`torn` volta antes: conta mesmo assim, por cautela) |
| `stage`, `dent`, `bend`, `burnout`, `expose`, `spall`, `drip`, `leak`, `ignite`, `primed`, `extinguish` | só a `part` (deformam, queimam ou soltam fragmento daquela peça; nenhum limpa marca de outra) |
| `explode` | nenhuma peça: empurra peças/objetos (viram corpo, as marcas seguem a malha); o objeto em movimento já não adia (`isMovingPiece`) |
| `settle`, `subside`, `destroyed` | o objeto inteiro (`settle`/`subside` mexem no nó do solo de todas as peças; `destroyed` encerra o objeto): regra por objeto só nesses |

`adoptSplit` move para o objeto novo as peças de `world.state(newId).parts` (os grupos soltos), com seus `PartVis`, malhas e decals; o `partVis` das peças
sai do objeto de origem: marca aplicada depois se perde. Por isso o grupo solto entra no conjunto.

### O que foi implementado

- Conjunto tocado = peças nomeadas + peças de `groups[1..]` (estado do mundo e `groups` do `detach`) + caixas de `chip`. Um visual vai no tique, antes
  do estrutural, só se `touches(evento)`: peça no conjunto, caixa de chip contendo o ponto do decal (`hole`/`exitPoint`/`crack`/`ricochet`/`debris`),
  objeto inteiro tocado, ou visual sem `part` de objeto com peça tocada. Os outros vão para o dreno (K por objeto) e o resto para o backlog.
- `releaseVisualsBefore` (backlog antes do estrutural) e `releaseVisualsBeforeSplit` (antes de `splitChecked`, com as peças dos grupos soltos de
  `looseToCheck`) e a decisão de não adiar passam a usar o mesmo critério por peça; `VisualBacklog.take` recebe o evento.
- `EventOrder` não mudou (o caminho síncrono, sem host, fica idêntico; os goldens dependem dele).
- Frequência (T2.0, 1 explosão): 11 `fracture`, 559 `damage` e 1 `explode`; `settle`/`subside`/`destroyed` não aparecem nas explosões medidas, então a
  regra por objeto que sobra quase nunca dispara.

### Teste na ordem de produção (`visual-events-per-part.test.ts`)

Um muro de 100 peças, bloqueio com `chip` em 3 peças e `fracture` em 1, 301 marcas (3 por peça + 1 numa vizinha dentro da caixa do primeiro chip):
**no tique 13 visuais** (as 12 das peças tocadas + a da vizinha dentro da caixa); **no quadro do golpe 17** (os 16 primeiros do objeto + 1 do piso da
fila); **no backlog 271**. Depois de drenar, as marcas por peça são idênticas ao caminho síncrono sem host, e um `chip` depois de marcas que esperavam
no backlog apaga as da sua caixa e só elas. Limite: acima de 48 marcas por malha (o teto do `Visuals`) quais são descartadas depende da ordem de aplicação.

Gates: typecheck destruction-three sem erro; destruction-three 695 testes; game-test-room 481 (inclui `step-equivalence*`); floorplan-three (golden,
exact-golden, blast, breach, destruction) 125, sem diff; `check:layers` e `kit-audit --strict-clocks` sem novidade; `room.ts` 5621. Ganho em ms não medido.

## Revisão 3

### 1. O que cada visual chama (`case` de `applyEvent`)

| Tipo | O que o `case` chama | Estrutural? |
|---|---|---|
| `damage` | `activate(object, part)` só para `heat`/`fire`/`explosive` (mapa de apresentação) | não |
| `hole` | `onHole`: `drawHoleMark` (decals `addCrack`/`addSpall`/`addHole` na malha), `vfx.burst` (faíscas, poeira), `sound` | não |
| `crack` | `onCrack`: `drawCrackMark` (decals `addStairCrack`/`addCrack`) e `impactSound`. **Não** chama `onFracture`: esse é o `case 'fracture'` (a linha apontada na revisão); `hide`, `spawnFragments`, `splitLoose` e `loosenIfFootless` só saem dele | não |
| `ricochet` | `vfx.burst('sparks')`, `partVis` (leitura), `sound` | não |
| `debris` | `vfx.burst` com `debrisOptions` (leitura de material/cor) | não |
| `melt` | `activate` e um chiado limitado por `throttles` (`sound`); **não** esconde a peça (`visuals.hide` só em `fracture` e em `drawPartState`, que é `redraw`) | não |
| `disassemble_progress` | `sound` limitado por `throttles` | não |
| `reveal`, `stress`, `sway`, `blast`, `body`, `fragment_hit` | sem `case`: só o prólogo comum (`staticDirty.add`, `releaseBatched`, `hitPoints.note`) | não |

Nenhum tipo mudou de classe; `EVENT_CLASS` e o teste que lista todos os tipos ficam como estavam. Nenhum visual sorteia em `this.rng`, cria corpo, mexe em
colisão ou escreve no `log`; portanto nenhum fixture/golden mudaria por reclassificação (e `step-equivalence*` passam).

### 2. Custo do conjunto tocado
`addLooseGroups` registra cada lista de grupos uma vez por lote (conjunto `groupsSeen`, por identidade da lista, limpo no `clear()`): um colapso de 500
fraturas com grupo solto de 800 peças soma 800 `Set.add`, não 400 mil. `world.state(obj).groups` está atualizado quando o evento é aplicado: o
`run` do mundo faz `settleAllStructure()` (que roda `recomputeGroups`) antes de `emitDetaches()` (`world.ts` ~729-738), e o renderer só aplica os
eventos depois que a operação voltou (no tique, ou no dreno do quadro). Pode estar mais NOVO que o evento (outra operação no meio), nunca mais velho; é o
mesmo estado que `splitLoose` lê.

### 3. Backlog indexado por objeto
`VisualBacklog` conta eventos por objeto: `releaseVisualsBefore`, `releaseVisualsBeforeSplit` e `releaseMovingPieces` só varrem o backlog quando algum
objeto tocado (ou peça em movimento) tem eventos esperando; o teste de caixa de chip só roda para objetos com `chip` no lote (`chipObjectSet`).

### 4. Teto do backlog por objeto
`VISUAL_BACKLOG_PER_OBJECT = 512`: ao passar disso o evento mais antigo do objeto é aplicado na hora em que o novo entra (`shiftOf`); o pior
descarregamento por `settle`/`subside`/`destroyed`/split fica em 512 por objeto. Teste: 3000 marcas num objeto, `pending() <= 512`, todas desenhadas.

### 5. `makePiece`
`pieceSys.create` cria o corpo acordado, e o empurrão de `loosen` pode esperar na fila `blastWakes`. `makePiece` agora aplica o backlog do objeto antes de
medir e criar o corpo (teste com `explode` + `shoveable`, e teste direto).

### 6. Caixa de chip
`clearDecals` apaga pelo centro do decal, que `onFace` projeta até `DECAL_SNAP` (3 cm) e eleva até 2,5 mm da face. Em vez de reimplementar `clearDecals`
(trocá-la poderia virar uma aresta de ponto flutuante nos goldens), a caixa do teste ganha essa folga (`DECAL_SNAP + DECAL_LIFT_MAX`, exportadas de `visual.ts`):
cobre o ponto cru mais o deslocamento máximo da projeção. Limite honesto: na cena de teste (caixas finas) `onFace` não chega a projetar, então a folga
está coberta por raciocínio e por um teste de borda, não por um caso em que a projeção a exija.

### 7. Quadro por número
O backlog guarda o número de quadro (`currentFrame`, só pelo número recebido em `pending(frame)`); a idade é `quadro - quadro de entrada`. Sem estado por
consulta: perguntar de novo no mesmo quadro não muda nada. O `run` sem número de quadro vale 1 unidade. `checkDeferredQueue` roda de verdade, com
preenchimento manual e com preenchimento por quadros do orçamento.

### 8. Testes (ordem de produção, comparando por posição e peça)
`visual-events-review.test.ts` (11) e `visual-wall.ts`: `fracture` no tique seguinte em peças com marcas na fila; `detach` e `collapse` com grupos reais;
`settle` e `destroyed`; `explode` com `loosen`; duas paredes na mesma explosão; borda da caixa do chip; mais de 48 marcas numa malha (em um golpe o
mesmo conjunto; entre golpes quais ficam acima do teto depende da ordem de aplicação: só aparência); teto do backlog; quadro idempotente. A assinatura é
a posição local de cada marca por peça, igual no caminho síncrono e no hospedado.

### Adiável depois da revisão (contagens T2.0, 1 explosão no `blast`)
Visuais: 559 `damage` + 68 `debris` + 20 `crack` = 647; estruturais: 11 `fracture`, 21 `detach`, 10 `stage`, 7 `spall`, 2 `chip`, 2 `dent` = 53. Os 647
continuam adiáveis; ficam no tique só os das peças tocadas (as nomeadas e as dos grupos que soltam), e no quadro os 16 primeiros por objeto.

Gates: typecheck sem erro; destruction-three 706 testes; game-test-room 481; floorplan-three (golden, exact-golden, blast, breach, destruction) 125; `check:layers` e
`kit-audit --strict-clocks` sem novidade; nenhum golden mudou; `room.ts` 5621. Ganho em ms não medido.
