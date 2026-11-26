# @adatechnology/game-destruction-three

## 0.26.6

### Patch Changes

- 9f0a371: Nada fica no ar sobre uma cratera (CLAUDE.md §12). `wakeRegion` acorda também a peça cuja raiz está fora do disco (a peça cortada de um objeto inteiro, a calçada da casa, tem a raiz na origem do objeto) quando ela está no disco e o chão sob parte da sua pegada desceu mais de 5 cm; a que o disco só toca segue dormindo. `BuildOptions.groundSurfaces: false` (novo): quando o terreno do host desenha o lote (`groundLayoutOfPlans`: zonas, coberturas de chão e caminhos), a casa não desenha mais as próprias placas planas por cima dele — elas não podiam ser cavadas e ficavam como um tampo sobre a cratera. A área de casas da sala liga a opção.
- Updated dependencies [d7fa717]
  - @adatechnology/game-terrain@0.9.5
  - @adatechnology/game-destruction@0.29.5
  - @adatechnology/game-contracts@0.41.0
  - @adatechnology/game-audio@0.15.5
  - @adatechnology/game-render-three@0.4.5
  - @adatechnology/game-shapes@0.4.5
  - @adatechnology/game-vfx-three@0.10.9

## 0.26.5

### Patch Changes

- Updated dependencies [7e40a5b]
  - @adatechnology/game-physics@0.3.0

## 0.26.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-audio@0.15.4
  - @adatechnology/game-destruction@0.29.4
  - @adatechnology/game-render-three@0.4.4
  - @adatechnology/game-shapes@0.4.4
  - @adatechnology/game-terrain@0.9.4
  - @adatechnology/game-vfx-three@0.10.8

## 0.26.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-audio@0.15.3
  - @adatechnology/game-destruction@0.29.3
  - @adatechnology/game-render-three@0.4.3
  - @adatechnology/game-shapes@0.4.3
  - @adatechnology/game-terrain@0.9.3
  - @adatechnology/game-vfx-three@0.10.7

## 0.26.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-audio@0.15.2
  - @adatechnology/game-destruction@0.29.2
  - @adatechnology/game-render-three@0.4.2
  - @adatechnology/game-shapes@0.4.2
  - @adatechnology/game-terrain@0.9.2
  - @adatechnology/game-vfx-three@0.10.6

## 0.26.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-destruction@0.29.1
  - @adatechnology/game-audio@0.15.1
  - @adatechnology/game-render-three@0.4.1
  - @adatechnology/game-shapes@0.4.1
  - @adatechnology/game-terrain@0.9.1
  - @adatechnology/game-vfx-three@0.10.5

## 0.26.0

### Minor Changes

- c88deea: `jitWarmUp` (ligado por padrão): o primeiro `createDestructionRenderer` roda uma explosão numa parede pequena fora da tela, num mundo e num renderizador próprios, tudo liberado, uma vez por motor. A primeira explosão do jogo deixa de custar o dobro: o primeiro segundo de física cai 14% na explosão e 12% no martelo da sala, por 0,37 s a mais no carregamento. `false` desliga; `{ engine }` aquece também os caminhos do motor. `warmUpDestructionJit` é exportado. `game-shapes-three` passa a dependência de `game-destruction-three`. Na sala de teste: `debris.jitWarmUp` e `?warmup=0`.
- b0a370f: O chão que o motor põe sob as peças custa menos, sem mudar o chão nem o que as peças fazem sobre ele.

  `game-terrain`: `Terrain.heightRange(minX, maxX, minZ, maxZ)` devolve os limites exatos da altura do terreno sobre um retângulo, lidos nos vértices que ele cobre (a altura entre vértices é uma mistura dos quatro ao redor), ou `null` quando o retângulo sai do terreno.

  `game-destruction-three`: com `terrainRangeAt` (opção do renderizador e do sistema de peças), um ladrilho que o terreno prova plano é assentado como laje sem ler as 25 921 amostras; qualquer relevo sob ele, uma cratera de um vértice inclusive, faz a leitura inteira como antes. `blastGroundTiles` (padrão 0, desligado: medido, 48 ladrilhos moveram cerca de 24 ms para o quadro da explosão e não melhoraram o pior quadro) assenta, na explosão, essa quantidade de ladrilhos ao alcance dela, os mais próximos primeiro, antes de as peças que ela solta precisarem deles. O sólido sob uma cratera refeito por uma mudança do chão reaproveita os cascos que a mudança não tocou.

  `game-physics`, `game-physics-jolt`: `ShapeDesc` composto aceita `reuseHulls`; o corpo guarda os cascos convexos da forma atual e a próxima forma dele pega os que são iguais bit a bit, em vez de montá-los de novo. Guarda só os cascos da forma atual, então a memória não cresce com as mudanças.

  `game-test-room`: a sala passa o `terrainRangeAt` do terreno dela.

- c71e079: Colisores fixos pelo coordenador de workers (spec 009, T10): `staticCollidersKind` (`destruction.static-colliders`, faixa `build`) com o núcleo puro `measureStaticPart`, que agora mede também no quadro principal; `RendererOptions.workers` (e `debris.workers` na sala) entrega as peças ao coordenador, opt-in porque a medida da sala não pagou. O preset hospeda a categoria.
- c4783d3: O quadro que corta a casa em peças deixa de recalcular o que não mudou, sem mudar o resultado. As caixas que `fitOrientedBoxes` ajusta a uma parte desenhada por uma faixa de uma malha unida são ajustadas antes do golpe, uma parte por vez, com no máximo 1 ms de cada quadro, e guardadas com os pontos e triângulos de onde saíram: quando a parte rompe, o corte lê as mesmas caixas (os mesmos números, bit a bit) em vez de ajustá-las; se o desenho mudou (um amassado), ajusta de novo. O cache é solto com o objeto (`unbind`, `dispose`). O hospedeiro da malha unida é reescrito uma vez por lote de `splitLoose`, não uma por peça.

  `RendererOptions.fitBoxesAhead` (padrão ligado): desligado, as caixas são ajustadas quando a parte rompe, como antes.

- 51c7f3d: O trabalho que uma explosão deixa (grupos soltos a cortar em peças, fragmentos a soltar, entulho a acordar) pode correr num orçamento de quadro em **unidades de trabalho**, nunca em tempo (spec 008, T3.8aa). Desligado por padrão: sem a opção nada muda.

  `game-physics`: `WorkBudget` (o árbitro: `budgetMs` × `unitsPerMs` / `tier` unidades por quadro, padrões 4 ms, 100 e 1, e `maxWaitFrames` 12, decisão do dono em 2026-11-16), `WorkQueue` (trabalho guardado como dado, por prioridade e chave estável, ao menos um por quadro, o que esperou o teto sai de qualquer jeito; salva e carrega) e `WORK_KINDS` (a ordem fixa em que as filas tiram do orçamento). `WakeQueue.release` aceita `limit`.

  `game-destruction-three`: `RendererOptions.workBudget` (`ExplosionWorkOptions`: as opções do `WorkBudget` mais `costs`, padrões em `WORK_UNIT_DEFAULTS`). Os eventos aplicam no próprio quadro (clarão, poeira, trincas); cada grupo solto espera numa fila, o mais perto do `focus` primeiro, desenhado e sólido no objeto até a vez dele; fragmentos e a fila de despertar tiram do mesmo orçamento. `splitWorkUnits` estima o custo de um corte pelo tamanho do trabalho, sem contar caixas já ajustadas.

  `game-test-room`: `debris.workBudget` (o jogador é a câmera); a página da sala lê `?workBudget=4`.

- 78ac539: Os fios do poste do lote soltam-se em trechos que não vão com o poste. Antes, cada trecho da fiação pendia do poste por uma junta que sempre une; ao cair, o poste levava os fios que a explosão não tinha soltado e virava um corpo de 1000 kg com 26 caixas e 23 m de largura, e a varredura contínua (CCD) do Jolt custava 60 a 70 ms por passo. Agora o poste leva só o fuste, a travessa e os isoladores (950 kg, 10 caixas) e cada trecho de fio cai como peça sua, com o próprio cobre.

  `game-contracts`, `game-destruction`: `JointSpec.tears` (padrão falso). A parte `a` pende de `b` só enquanto `b` está de pé (em um grupo ancorado); com `b` solto a junta larga, e o fio de um poste que cai desce sozinho. Uma junta que não rasga continua unindo as duas partes em um grupo. Quem se segura em duas pontas, uma delas de pé (o fio do ramal preso à parede da casa), fica pendurado nela.

  `game-destruction-three`: as peças que um `tears` separou (o fio e o poste de que pendia) não se tocam mais: sem isso o poste de 950 kg, ao tombar, batia nos fios de 12 kg que ele acabava de largar e os lançava (C1 de 34 e 105 kg·m, C2 acima do limite em 4 de 10 rodadas). `JointState.tears` (contrato), `PieceSystem.tether`, e o renderizador marca os pares ao soltar os grupos.

  `game-floorplan-structure`: `Support.tears` chega à junta da especificação destrutível.

  `game-floorplan-three`: os trechos da grade e do ramal pendem do poste mais próximo por uma junta que rasga (`tears`); o trecho que fica dentro de laje ou parede, ou ao lado de um, continua preso a ela. Com `segmentLimits.wiring: Infinity` a fiação segue como o time desenhou (uma peça só). Goldens regravados: `destruction/breach`, `destruction/spall`, `destruction/fracture` e o resultado do blast (21 objetos a mais, os trechos).

- 3b22fa3: Latas e garrafas: o piso de massa da peça cai de 0,2 kg para `MIN_PIECE_MASS_KG` (20 g), então a lata vazia de 50 g pesa 50 g nos choques; a massa da peça cai com o líquido que sai (bebido, despejado ou vazado, na densidade do líquido) pelo novo `DestructionRenderer.setPieceMass`, e a inércia de giro acompanha; o líquido de dentro da lata gira só metade do que um sólido de mesma massa (`LIQUID_SPIN_COUPLING`), em vez de ser tratado como sólido.

  O corpo de um recipiente segurado (cinemático no Jolt) também guarda a massa nova e a recebe ao ser solto; os refits de quebra mantêm a massa sem o líquido que saiu; a perda é medida em kg com histerese de 10 g, na peça que guarda o líquido, e uma recarga soma massa.

- c8b5c71: Spec 008 (fases 1–3 até a T3.8): motor físico Jolt Physics como opção do kit, desligado por padrão.

  - Pacotes novos: `game-physics` (contrato do motor, fila de despertar, medidor de custo) e `game-physics-jolt` (adaptador do Jolt). O Jolt é escolhido por `physics`; sem ele, o solver próprio segue como hoje.
  - Entulho de explosão opcional (`blastDebris`): as peças despertam em lotes, com o mínimo e o máximo ajustados pelo custo medido na máquina.
  - Colisores fiéis ao desenho:
    - a caixa só vale quando as faces estão cobertas;
    - se as faces não estão cobertas, a peça colide pelos triângulos (batentes e molduras não são mais placas maciças).
  - Portas e janelas sem peças nascendo umas dentro das outras.
  - Fiação e canos se soltam em trechos (`segmentLimits`), cortados em lajes e paredes.
  - O chão é montado ao longo do caminho de peças rápidas.
  - Os estilhaços de granada sorteiam por alvo: um objeto novo na cena não muda mais onde eles caem.
  - A mão empurra a porta que se afasta, em vez de seguir a folha (spec 004).

- fc1310c: Com o motor Jolt, as peças novas de um quadro entram no mundo de uma vez (`createBodies`: uma inserção na broadphase, ids na ordem da lista) e não uma a uma. Uma peça que dorme e sai do motor (some, é cortada pelo limite de peças vivas, é trocada) acorda o que dormia apoiado nela: antes, essas peças ficavam dormindo no ar. Uma peça acordada há um passo ou mais não precisa: o que se apoia nela está na mesma ilha, acordado. A que dormia no último passo do motor e foi acordada e removida no mesmo quadro precisa (o motor ainda não acordou o que estava em cima): também acorda. O passo em lote é medido como "sem regressão" (a queda de quadros acima de 5 ms está dentro do ruído).

  `game-destruction-three`: `EnginePieces.prepare` cria os corpos novos em lote (`makeBodies`); `EnginePieces.remove` de uma peça dormindo (ou que dormia no último passo do motor) acorda os corpos numa caixa ao redor da peça (`wakeAround`, margem de 0,1 m). `clear` não acorda ninguém.

- b37d94f: Spec 010, fases 1 e 3: passo fixo único e filas no prazo do quadro.

  - `game-physics`: `PhysicsLoop.stepFixed(steps)` roda passos inteiros vindos do agendador (`step(dt)` continua, com o próprio acumulador). **Quebra para quem implementa `PhysicsWorld`:** o membro `readActiveBodies(out)` passa a ser obrigatório (devolve só os corpos acordados).
  - `game-physics-jolt`: implementa `readActiveBodies`.
  - `game-render-three`: `createStaticBatchQueue` e a opção `queue` dos lotes estáticos, para o orçamento do quadro drenar a junção dos lotes.
  - `game-fluids-three`: `FilmManager.deferredQueue()`, a fila do filme de líquido no prazo do quadro; o tempo devido de um grid que sai é esquecido junto com ele.
  - `game-crowd`: o campo de fluxo passa a andar em células por passo (`cellsPerStep`) por padrão, não pelo relógio; `flow.ms` vale 0. Mesmo resultado em toda máquina.
  - `game-destruction-three`: `DestructionRenderer` ganha `interpolate`, `present`, `restoreStepPose`, `markMoved` e `deferredQueues` (desenho interpolado entre passos e filas registradas no orçamento); uma peça segurada pelo host (empurrar, carregar) é lida mesmo com o motor a dando como dormindo.
  - `game-test-room`: opção `frameTargetMs` (prazo do quadro); a pose do passo volta antes da fase `input`, para empurrar e carregar escreverem na pose do passo, não no desenho misturado do quadro anterior.
  - `game-destruction`: uma operação que lança exceção não passa estrutura e `detach` pela metade para a seguinte.

- adf4811: Com o motor Jolt, uma peça solta de várias partes (um poste com os fios) pode assentar o chão só sob a caixa de cada parte, e não sob a caixa de todas juntas. Desligado por padrão: o chão assentado é o mesmo de antes.

  `game-destruction-three`: `RendererOptions.tilesUnderParts` (e `PieceSystemOptions.tilesUnderParts`). Ligado, `EnginePieces.layGround` assenta os ladrilhos sob cada caixa de parte (`partBoxes`, com a mesma margem de 0,5 m, a mesma oscilação e os mesmos pontos do caminho). Uma peça de 23 m de largura feita de 26 partes finas assentava 72 ladrilhos (e o sólido de cada um); com a opção, assenta os que tem partes sob ou perto. Medido na sala: p99 do quadro do blast de 91 para 78 ms e máximo de 206 para 178 ms (T3.8v). Fica desligado porque, nas rodadas do blast, o poste que ganha energia (C1 acima de 5 kg·m) apareceu em 8 de 25 rodadas com a opção contra 2 de 25 sem ela; o dono decide.

  `game-test-room`: `debris.tilesUnderParts`, e `?tilesUnderParts=1` na página da sala.

- 232c3a6: Workers ligados por padrão (spec 009, T6, T7 e T13): `createKitWorkers` e `KIT_WORKER_KINDS` no preset, com o arquivo do worker do kit (`dist/kit-worker.js` e `dist/kit-worker.global.js`); o chão da cratera vira a categoria `destruction.ground-tiles` (`groundTilesKind`, entrada sem three.js `./worker-kinds`) e passa pelo coordenador com `createCoordinatorGroundPort`. A sala usa um coordenador por página, com o chão por ele por padrão (`?groundWorker=0` desliga, `?workers=N` escolhe quantos).
- 1fede95: A quina de pilar e parede quebra como obra:

  - `game-destruction`: um membro moldado (peça com `reinforcement`) dentro da caixa de uma parede de unidades (o pilar que fecha a ponta da parede, a verga, a cinta) tira da parede os tijolos daquele lugar, e o tiro, o golpe e o raio que caem ali (também no reboco por cima) vão para o membro.
  - `game-vfx`: `PIECES_DRAWN_VARIABLE`; com ela os efeitos de rombo e desabamento soltam só a poeira, sem os blocos de enfeite (até 1 m) que jogam numa cena sem pedaços de verdade.
  - `game-destruction-three`: os efeitos de evento vão com `piecesDrawn` (o renderer já desenha os pedaços); `BindOptions.marksOn` põe as marcas de uma peça sem malha própria nas malhas das peças que a desenham.
  - `game-floorplan-three`: o pilar sem malha própria leva as marcas nas paredes em que está.

- 6473d97: Alvenaria que perde o apoio tomba para um lado em volta do pé (os tijolos de cima saem mais rápido), em vez de cair reta e formar uma coluna de tijolos parados. Um pedaço só fica em cima de outro com o centro sobre ele; se o centro passa da borda, ele escorrega e cai. Tijolo inteiro que sai pela junta é desenhado como tijolo, não como entulho. O tiro em concreto, tijolo ou pedra abre uma cratera de material quebrado, de uns cinco calibres, em volta do furo.
- ca2dac7: Amortecimento de rolamento por material: além da resistência ao rolamento (C_rr), cada material da peça (`surfaceOf`: vidro e aço 0,02/s, madeira 0,4/s, borracha 0,3/s, tecido 1/s) e cada chão (`TerrainMaterial.rollingDamping`: concreto 0,3/s, cerâmica 0,1/s, grama 1,5/s, areia 2/s, lama 3/s) tiram uma parte do giro por segundo, e os dois se somam: a garrafa rola mais no piso liso, a tora para logo na grama. Cerâmica e madeira de piso passam a ter C_rr 0,008 e 0,01 (antes o 0,015 padrão). Contrato: `Rolling.damping` e `Material.rollingDamping`; o adaptador Jolt aplica os dois em todo corpo com `rolling` (`rollingImpulse`), e o `saveState` guarda o amortecimento. Terreno: `rollingDampingAt`. Renderizador: `terrainRollingDampingAt` (a sala de teste liga ao terreno). Em rampa a peça continua rolando, e um impulso a acorda e ela volta a rolar. Medição na sala: `examples/test-room/rolling-test.mjs`.
- 5da32ec: Grupos soltos viram peças logo depois da carga, não no primeiro evento: um objeto ligado (`bind`) ou redesenhado (`redraw`) que o mundo já entrega com grupos soltos (postes do lote, caixa de correio, porta de box, fiação da casa) tem esses grupos separados em peças no próximo `update` (ou na próxima drenagem da fila adiada), onde estavam, sem esperar um golpe. Antes eles ficavam desenhados e sólidos dentro do objeto até o primeiro evento (a porta do box sem parede ficava no ar, §12) e viravam peças todos dentro dos quadros da explosão. Sem `workBudget` a separação acontece na drenagem, depois dos eventos, respeitando o prazo; com `workBudget` continua na fila como antes. `autoSplit: false` mantém tudo no objeto. Objeto sem grupo solto não custa nada (e não conta como trabalho pendente na fila adiada). Uma peça separada na carga só dorme onde estava se o centro de massa estiver sobre o fecho dos pontos apoiados das suas partes (um tampo numa perna só tomba); móvel separado se apoia nos cantos das partes desenhadas (`contacts`). Só um `bind` novo conta como carga: `redraw` e `releasePieces` separam como ao vivo (um móvel quebrado restaurado tomba).

### Patch Changes

- 96c27a1: Correções da auditoria: uma peça que dorme com o centro fora do disco de uma mudança do chão e fica até 1 cm dentro dele agora é acordada para o motor tirá-la (antes ficava 8 mm dentro para sempre); o conjunto de pares soltos por um fio rompido esquece o par quando uma das peças sai (§8). A régua de energia dos testes (R1–R3) deixa de perdoar subida de poste ao acordar, de desligar o C3 por energia declarada mínima e de perdoar o pulo num impacto.
- 737b677: Correções da auditoria do motor de física. `game-physics-jolt`: a regra "não colidir" entre dois corpos sai com o corpo removido (o Jolt reaproveita o número, e o próximo corpo herdava a regra: um caco caído sobre o poste parava dentro dele); a moto (duas rodas em linha) é lida com as suas 2 rodas e a roda motriz tem diferencial próprio; erro em `createBodies` não deixa mais corpos nem o vetor de ids no heap. `game-destruction-three`: uma peça que dormia no último passo do motor e é acordada e removida no mesmo quadro acorda o que estava em cima dela (§12); o teste da subida do chão mede a penetração real da ponta (8 mm, limite 1 cm); `pnpm test:jolt` roda os blocos só do modo Jolt, agora no CI.
- f693949: As caixas de uma parte desenhada por um trecho de malha mesclada (telhado, chapas da casa) são ajustadas no espaço dos próprios vértices e levadas até a peça pela pose (giro e translação), em vez de ajustadas nos pontos já no quadro da peça. A quebra da casa e o objeto movido reaproveitam as caixas ajustadas antes: na casa de teste de 4 partes, os ajustes no quadro da quebra caem de 3 para 0. Pose com escala, cisalhamento ou espelho continua no caminho exato; parte amassada ou lascada é ajustada de novo. As caixas podem diferir das de antes em até alguns por cento de volume, porque o ajuste depende do quadro nas bordas da amostragem (`ceil` do comprimento da aresta).
- 10f2df0: No modo Jolt, o chão que se deforma passa a ter as alturas do ladrilho alteradas no lugar, em vez de refazer o ladrilho todo. O chão resultante é o mesmo de um ladrilho recém-assentado.

  `game-physics`: `PhysicsWorld.updateHeights(id, region, heights)` e o tipo `HeightRegion`. Troca no lugar as alturas de um retângulo de um corpo estático de campo de alturas; devolve `false`, sem mudar nada, quando a engine não pode (não é campo de alturas, retângulo fora dele, altura fora da faixa com que o campo foi feito), e quem chama dá ao corpo uma forma nova (`setShape`).

  `game-physics-jolt`: `JoltWorld.updateHeights` sobre `HeightFieldShape::SetHeights`, com o retângulo alargado ao bloco do Jolt, as amostras acrescentadas escritas dos valores exatos (nunca relidas), a memória do wasm liberada e o broadphase avisado. O Jolt também requantiza os blocos à esquerda e acima dos escritos (até 4,4e-5 m por escrita, 1,8 mm em 50): quem escreve o mesmo campo várias vezes refaz a forma de vez em quando.

  `game-destruction-three`: o ladrilho marcado por `groundChanged` lê de novo só as amostras da região avisada (mais 25 cm), não toca no motor se nada ali mudou, escreve no campo só o retângulo que mudou (até metade do campo, quatro vezes seguidas; depois a forma é refeita dos valores exatos) e refaz o sólido sob o campo só quando as alturas mudaram.

- e3a9ee8: A estrutura de um objeto é resolvida uma vez por operação (`hit`, `explode`, `update`), não uma vez por parte perdida ou junta aberta: na explosão de 4 MJ no sobrado, 174 chamadas de `solveStructure` viram 39 (é resolvida de novo só quando algo lê cargas ou tensões no meio da operação). Muda o contrato do `detach`: `groups` são os grupos do objeto depois da operação inteira, e todos os `detach` da operação saem no fim dela, na ordem em que as juntas abriram, depois dos outros eventos (o `collapse` inclusive). `DestructionWorld.structureProbe()` conta as resoluções. `game-destruction-three`: uma fratura solta primeiro os grupos que a operação deixou soltos e só então vê se o que sobrou do objeto perdeu o apoio, então a ordem do `detach` e da `fracture` não muda como as peças se separam. A garantia vale para o mundo do `createDestruction`; os outros `DestructibleImpl` (veículos de `game-vehicles`, personagens de `game-characters`, que manda só a peça que saiu, `[[segmento, ...caídos]]`) continuam emitindo um `detach` por junta com os grupos daquele momento.
- f17aebb: Janela e parede na explosão, como no mundo real:

  - O vão da janela fica livre: os tijolos que a parede desenha onde foi cortada param no batente, no peitoril e na verga, e nenhum aparece atrás do vidro.
  - O vidro de janela é lido como vidro comum de 4 mm (o desenho segue com 12 mm): uma granada na cozinha quebra as vidraças do cômodo e as próximas.
  - `PlanWindow.frame` e `BuildOptions.windowFrame` (`'wood'`, `'aluminium'`, `'frameless'`): moldura de madeira (lasca), de alumínio (amassa) ou blindex (vidro temperado de 8 mm, sem moldura). O padrão é madeira na casa simples e alumínio nas outras. Na sala: `?windowFrame=`.
  - O pilar de canto quebra nas duas paredes que se encontram nele, e a quina se desfaz.
  - As lascas batem na primeira face no caminho (parede, teto, móvel) e caem (`FragmentSystemOptions.sweep`), em vez de atravessar a parede e ficar presas dentro dela à vista.

- 556586e: `game-destruction-three`: o terreno que assenta (entulho que sobe o chão alguns mm) não levanta mais uma peça solta que só o toca por uma ponta. Antes, `EnginePieces.groundChanged` erguia a peça inteira pelo tanto que o canto de uma caixa ficava sob o chão novo, a partir de 5 mm e sem velocidade; o poste de 1 t, cuja ponta de fio de 11 m encontrava o entulho, ganhava de graça massa x g x subida (6 a 8 kg·m por atualização, o C1 da sala). Até 1 cm o contato do motor resolve a sobreposição sozinho; só uma subida maior é erguida pelo kit, como antes.
- 6cc4abe: Two loose box pieces that overlap are now put apart by their real boxes, not by a circle of their largest half side, and nothing is launched doing it.
  `shapeContact` answers two box shapes with a separating-axis test (the 15 axes of two oriented boxes, per part), and `boxesAlongGround` gives the least
  overlap along the ground. `separatePair` takes back half the overlap per step, summed over every pair of a piece and bounded per piece at 1.5 m/s
  (`applyPushes`), never down. Side by side, the two go apart along the ground, split by mass. One over the other as deep as a contact (3 cm, plus what
  the closing speed sank them this step), only the upper rises, and a contact impulse at the point stops it sinking (`propped`: the support counts for its
  rest). Deeper, the two were made inside each other: they slide apart along the ground instead of the upper being lifted out. The resting gates
  (stacked, on a top, leaning on a part) no longer hide two pieces deep inside each other, nor two side by side. In a collapsed sobrado no chunk's centre
  rises more than 3.5 cm (it was up to 4.1 m with the plain separating axis). A piece split off with several parts (a board and its books) is landed on
  by its parts as drawn, not by the box around them.
- 20cdc73: A peça que sai de um objeto (no carregamento, desde o #339, ou num golpe) é marcada como desenhada por `game-destruction-three` (`kind: 'piece'`): a auditoria "de onde vem cada peça desenhada" deixa de ver as peças feitas na carga como desenho sem origem. Os cenários da vegetação contam só os pedaços que saíram da própria planta: a pia e outros móveis da sala com um grupo solto na carga também criam `obj_N`, e o tiro de 9 mm e a cerca viva falhavam por contá-los.
- e987bbe: `fitOrientedBoxes(points, triangles?)` passa a aceitar também os triângulos da peça. Assim, uma peça desenhada por anéis de vértices, como poste, cano ou fio, é segurada pelo corpo inteiro, e não por placas nas pontas. O mesmo vale para um cano em L, que segue a curva e não vira uma placa de ar atravessando a dobra.

  O poste de concreto do lote colide como fuste de 7,5 m, com cruzeta e isoladores. Deitado, ele dorme em cerca de 2 s com o Jolt.

  Sem os triângulos, o resultado da função continua o mesmo de antes.

- da15205: Um fragmento parado (tijolo, lasca, pedaço de reboco) só segura o que está sobre a área de chão que ele de fato cobre: o teste de apoio (`pileUnder`) passou da caixa que o envolve (muito maior para um pedaço comprido virado de lado) para o casco convexo dos oito cantos visto de cima. Antes, um pedaço pequeno ficava dormindo no ar sobre o canto vazio da caixa de outro.
- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [b0a370f]
- Updated dependencies [f1c7229]
- Updated dependencies [10f2df0]
- Updated dependencies [e3a9ee8]
- Updated dependencies [51c7f3d]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [18bd23f]
- Updated dependencies [08c5801]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [8ebd34c]
- Updated dependencies [b37d94f]
- Updated dependencies [e987bbe]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [1fede95]
- Updated dependencies [6473d97]
- Updated dependencies [ca2dac7]
- Updated dependencies [1807dd8]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-destruction@0.29.0
  - @adatechnology/game-terrain@0.9.0
  - @adatechnology/game-physics@0.2.0
  - @adatechnology/game-shapes@0.4.0
  - @adatechnology/game-render-three@0.4.0
  - @adatechnology/game-audio@0.15.0
  - @adatechnology/game-vfx@0.16.0
  - @adatechnology/game-vfx-three@0.10.4
  - @adatechnology/game-shapes-three@0.4.1

## 0.25.0

### Minor Changes

- f4cf94f: A primeira explosão não liga programa nem decodifica som no meio do jogo.

  - `createProgramWarmup`: no primeiro desenho do aquecimento, todo objeto que projeta sombra entra nos mapas de sombra (sem o recorte pela câmera da sombra; `shadowCasters: 'visible'` volta ao de antes). O three r160 só liga o programa de profundidade de um objeto quando a passada de sombra o desenha, e o `compile` nunca faz isso: a parede texturizada da calçada da casa, fora da caixa do sol na carga, ligava o programa `USE_MAP ... DEPTH_PACKING 3201` quando entrava na caixa, no meio do jogo.
  - `shadowCasterProbes(THREE)`: sondas que projetam sombra com material iluminado, com e sem textura, nos três lados; a sala registra.
  - `explosionEffectIds(explosions?)` do `game-vfx`: toda explosão do catálogo de efeitos. A sala aquece todas (antes, uma lista à mão de nove, sem o P13, o barril, o tanque do carro e os foguetes).
  - `AudioEngine.preload(ids)`: decodifica agora os arquivos desses sons (e das variantes de um conjunto), uma vez só. `blastSoundIds()` do `game-destruction-three`: o estrondo de cada família, o eco distante, a cauda em lugar fechado, o fogo e os destroços por material. A sala pré-carrega esses e o `water_splash` na primeira tecla ou clique.

- 0e0d121: Trocar a planta na bancada de casas não deixa mais nada da casa anterior no mundo. Os pedaços que se soltaram dela continuavam no mundo da destruição (invisíveis, colidindo e queimando), com o fogo, os fragmentos, as marcas no chão e as partículas que eram deles; a sala os guardava na lista de peças soltas.

  - `game-vfx`: `FireOptions.source`, `ExplosionOptions.source` e `SpriteSpawnOptions.source` dizem para quem um efeito foi feito, e `VfxWorld.clearSource(source)` tira de uma vez o fogo, as chamas, a fumaça, as brasas, o que a explosão jogou e os sprites dele.
  - `game-destruction-three`: os efeitos que o renderer faz para um objeto levam o id dele; `release(objectId)` tira do mundo os pedaços que se soltaram do objeto e todos os efeitos dele e dos pedaços (fogo, som do fogo, vazamentos, eventos na fila, fragmentos, marcas, ferragem, partículas), e desfaz a ligação; `releasePieces(objectId)` faz o mesmo mantendo a ligação (reset). `onReleased` avisa o host dos pedaços que saíram.
  - `game-floorplan-three`: a casa descartada (`dispose`, troca de planta, `clear`) chama `release`, e o `reset` chama `releasePieces`; a vista de rombo libera as formas dos tijolos ao sair.
  - `game-test-room`: a sala esquece os pedaços que o renderer soltou.

- 33d2474: Destroço parado pode custar pouco (opcional: sem as opções nada muda). Orçamento de corpos acordados: acima de `maxAwakePieces` peças soltas (sugerido `SUGGESTED_MAX_AWAKE_PIECES`, 24), as mais antigas que já pararam (no chão, mais lentas que o limite de repouso, e a que está escorada só depois de manter a inclinação por 1,5 s) dormem onde estão, sem teletransporte; acima de `maxAwakeFragments` (sugerido 64) o mesmo vale para os fragmentos. A peça posta para dormir pelo orçamento guarda os pontos em que se apoiava e acorda quando qualquer um deles perde o apoio: a tábua escorada num degrau que sumiu cai, mesmo com o pé ainda no chão. Com `settledBatches` o destroço em repouso é desenhado em lote, um desenho por material (`createStaticBatcher` do `game-render-three`, que ganhou `materialKey` para juntar cópias iguais de um material): a colisão continua a de cada peça, e a peça atingida, acordada, amassada, escondida ou com qualquer evento volta a ser desenhada sozinha na hora. `settledBatchStats()` diz quantos lotes e quantas malhas. A sala de teste liga o desenho em lote; o orçamento fica desligado nela até decisão do dono (`debris.maxAwakePieces`/`maxAwakeFragments` ligam).

### Patch Changes

- c2897e4: A burning part's flame is shown only while something of the part is drawn. A part with no mesh of its own (the rafters and ridge of a gable roof, which the house does not draw) or one that broke or burnt away no longer leaves its fire hanging in the air at its spec position; the fire comes back if the part is drawn again. Which parts ignite, fire spread, burn rates and durations are unchanged.
- Updated dependencies [f4cf94f]
- Updated dependencies [0e0d121]
- Updated dependencies [1849ae6]
- Updated dependencies [33d2474]
- Updated dependencies [71b5bef]
- Updated dependencies [d5850bb]
- Updated dependencies [fec8942]
  - @adatechnology/game-render-three@0.3.0
  - @adatechnology/game-vfx@0.15.0
  - @adatechnology/game-audio@0.14.0
  - @adatechnology/game-destruction@0.28.0
  - @adatechnology/game-vfx-three@0.10.3

## 0.24.4

### Patch Changes

- b0b031b: O tiro na janela acerta o que está desenhado. `PartSpec.apertures`: vãos de uma peça (o vão da janela numa parede, a área do vidro num caixilho, o vão de uma grade com as barras); o raio que entra num vão segue, a não ser que bata numa barra. No detalhe `coarse` (o das casas), cada parede leva os vãos das suas janelas (`withWindowApertures`): antes, o tiro na janela batia no tijolo invisível da parede ou na caixa maciça do caixilho. O caixilho tem massa real (perfis de alumínio e peitoril: 18 kg numa janela de 1,4 m, antes 182 kg) e é aberto onde está o vidro; a grade virou peça de aço própria (`window_grille:*`), com as barras. O raio que passa pelo buraco aberto numa parede usa o mesmo referencial do objeto em todos os lugares.

  A área de casas abre direto numa casa pelo endereço (`?area=floorplan_area&template=mansion&seed=1&state=abandoned`, `floorplanAreaParams`), e planta registrada que nenhum grupo lista entra no grupo "Outros" da bancada.

  O pó e as fibras de uma peça desenhada pela casa (sem malha própria no renderizador) saem na cor padrão, em vez de um erro "failed to apply debris".

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-destruction@0.27.0
  - @adatechnology/game-audio@0.13.6
  - @adatechnology/game-vfx-three@0.10.2

## 0.24.3

### Patch Changes

- 9dc3676: O que cada material solta em tiro e explosão vem do material: `debrisLook`, `debrisFamily`, `debrisColor`, `dustColor` e `fragmentTone` (game-destruction) dizem, para cada material e evento (tiro, spall, estágios 1 a 3, ferragem exposta, fratura, explosão, colapso), o tipo de detrito, a cor, a poeira e a marca. Os efeitos de estágio e colapso do game-vfx passam a ser por família (`stage_crack_<família>`, `breach_dust_<família>`, `collapse_dust_<família>`, com `debrisColor`/`dustColor` em `values`), e `rebar_expose` solta lascas e pó de concreto com ferrugem em vez de lascas de madeira. O renderer passa a família e a cor da peça a esses efeitos, lança o estágio 1 do ponto do tiro (não da raiz do objeto) e pinta os detritos de fratura na cor do material. Antes, um tiro de AK na viga de concreto soltava lascas marrons de madeira.
- Updated dependencies [dd8f202]
- Updated dependencies [9dc3676]
  - @adatechnology/game-destruction@0.26.0
  - @adatechnology/game-vfx@0.14.0
  - @adatechnology/game-vfx-three@0.10.1

## 0.24.2

### Patch Changes

- 175efec: Nothing stays in the air after a blast: a holder of an area (shelf, counter, stand) holds what lay on it only where it is still drawn, and asleep fragments look at the floor under them again.
- Updated dependencies [f99694c]
- Updated dependencies [29abbc1]
- Updated dependencies [91bbed8]
  - @adatechnology/game-destruction@0.25.0
  - @adatechnology/game-vfx@0.13.0
  - @adatechnology/game-vfx-three@0.10.0

## 0.24.1

### Patch Changes

- 85f5172: O que continua saindo de um objeto quebrado acompanha o corpo. O farelo e a poeira que caem por alguns segundos de uma face quebrada (madeira, MDF, alvenaria, concreto) ficavam presos ao ponto do mundo onde o golpe acertou: quando o armário tombava, continuavam caindo onde ele estava de pé. Agora ficam presos à peça que quebrou e caem de onde ela está a cada quadro, inclusive quando um pedaço se solta e cai como corpo próprio; param quando a peça some. O fogo, o vazamento e o som de fogo de uma peça que se solta passam para o novo corpo e seguem com ele, em vez de apagar. Fogo, vazamento e farelo passam a ler a posição depois de os corpos se moverem no quadro, não um quadro atrás.

## 0.24.0

### Minor Changes

- 779f9f4: Os tijolos que saem inteiros de uma parede caem na cor do tijolo, e não mais como placas laranja. Os blocos de uma parede de unidades assentadas se soltam pelas juntas, então a face deles é a do próprio tijolo, não o miolo quebrado. O fragmento ganhou `unit` e o material ganhou `visual.unitColor` (no tijolo, o mesmo vermelho dos tijolos que a parede mostra), e o renderizador usa essa cor. O concreto moldado continua com a cor do miolo.

### Patch Changes

- Updated dependencies [5984ae4]
- Updated dependencies [779f9f4]
  - @adatechnology/game-destruction@0.24.0
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-audio@0.13.5
  - @adatechnology/game-vfx-three@0.9.1

## 0.23.2

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-vfx@0.12.0
  - @adatechnology/game-vfx-three@0.9.0
  - @adatechnology/game-audio@0.13.4
  - @adatechnology/game-destruction@0.23.2

## 0.23.1

### Patch Changes

- d9cec5c: Entulho para em cima do que ainda está construído, não só no terreno. Telhas que quebram caem sobre a laje e só escorregam para o chão as que passam da beirada; tijolos de uma parede que desmorona param no peitoril ou no que estiver embaixo. Cada caco mede o que tem embaixo com um raio para baixo no mundo de destruição (`surfaceAt`), uma vez onde cai e de novo só depois de andar meio metro.
- f1abc28: As telhas de barro de um telhado quebrado ficam no chão. A explosão que quebra uma água do telhado a desfaz em punhados de poucas telhas (até 160 pedaços, placas de 1,8 cm de espessura), e não mais em 24 placas do tamanho da água. Pedaço grande de qualquer forma, inclusive caco chato de telha ou de vidro, ganha corpo e fica no chão como entulho, em vez de sumir depois de 12 s. A cor do pedaço vem do que a peça mais tem desenhado (as telhas do telhado), não da primeira malha dela (a faixa de reboco).
- Updated dependencies [f1abc28]
  - @adatechnology/game-destruction@0.23.1

## 0.23.0

### Minor Changes

- 4e2d44b: O recalque e as trincas aparecem na tela: `PartState.settlement` (perfil de recalque ao longo da peça, seguido pela parede da baldrame e pelo que pende dela) e `Crack.stair` (trinca em escada pelas juntas, subindo para o lado que desceu, largura pela distorção). O renderizador desce e inclina a peça aos poucos pelo perfil e desenha a trinca em escada nas duas faces da parede como marca da peça.

### Patch Changes

- b7e0d7c: O vão de alvenaria que uma explosão derruba sai em tijolos e torrões de poucos tijolos, não em placas. Os pedaços eram juntados em no máximo 24 caixas por golpe (6 para o que cai), e um vão de 3 m virava placas de 0,6 a 1,2 m. Agora `clumpUnits` junta só tijolos inteiros, uma fiada e um tijolo de cada vez, até 96 torrões por golpe (24 para o que cai). O reboco que estava sobre eles sai em lascas de 2 cm de espessura das faces rebocadas. No desenho, o pedaço de material que esfarela (tijolo, bloco, concreto, reboco) tem cantos e arestas quebrados (`buildRubbleGeometry`), em vez de uma caixa cortada.
- abaa78d: O som do fogo para quando o fogo acaba. O renderizador passa a parear cada `burn_loop` com um único `burn_end` por peça (`startBurnSound` e `endBurnSound`): a parte que quebra, derrete ou perde o fogo sem evento de `burnout` ou `extinguish`, o objeto restaurado, o `clear` e a parte que acende de novo deixavam o ronco do fogo tocando para sempre. O ronco agora some em `FIRE_FADE_SECONDS` (fade curto, andado pelo `update`) em vez de cortar no seco, e `reset` e `dispose` param todo o laço.
- Updated dependencies [71c2c92]
- Updated dependencies [b7e0d7c]
- Updated dependencies [cb9cc2e]
- Updated dependencies [76e5d44]
- Updated dependencies [8585829]
- Updated dependencies [4e2d44b]
  - @adatechnology/game-destruction@0.23.0
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-audio@0.13.3
  - @adatechnology/game-vfx-three@0.8.1

## 0.22.1

### Patch Changes

- 2c1eb8d: Faster pieces and rays. An update split into steps for a round piece (so a can is not passed through) now splits only that piece and what closes in on it; the
  rest (a wall's bricks falling far from it) take the update whole, so their sweep against the world runs once instead of up to eight times. A ray tries each part of an
  object against its bounding sphere in the object's frame before its shape, so a ray through a house of a thousand bricks tests a handful. The floorplan destruction
  tests went from about 400 s to under 100 s on CI.
- Updated dependencies [2c1eb8d]
  - @adatechnology/game-destruction@0.22.1

## 0.22.0

### Minor Changes

- 65147e9: Friction by material and round things that roll. A piece takes the Coulomb friction of the material it stands on (its lowest part): wood 0.4/0.3, steel 0.6/0.4,
  glass 0.4/0.35, ceramic 0.5/0.4, rubber 1.0/0.8, concrete 0.7/0.6, plastic and paper 0.4/0.3, fabric and foam 0.6/0.5 (`friction.ts`, with the sources), mixed between
  two surfaces by geometric mean: on a 25 degree wooden top a wooden box slides and a steel one holds. A piece whose drawing is round about one axis (a can, a bottle, a plate on
  its edge) or all three (a ball) is `round`: lying, it touches by the lowest point of each rim across the surface under it, rolls (v = w r) and is held back by rolling
  resistance (0.015) instead of the grip that stops a box from turning; standing, its rims hold it. What lands on a piece of several parts lands on the parts (a shelf's
  boards), not on the box around them, and a piece that loses parts to a split touches the ground by what is left. The test room's tests change where the old grip hid
  the physics: the bucket thrown by a blast rolls low, under a steel sheet's 60 cm of clearance, so it is stopped by a brick column; a walk shoves the 28 kg sofa a few cm.
- 86b6253: Cans and bottles roll and knock each other. A round piece's moment of inertia about its axis is I = k m r^2 from where its mass is (hollow walls of known thickness a thin
  shell, k 1; the contents a solid, k 1/2; an empty hollow thing all shell; or `makePiece(id, { inertia })`), so a full can rolls down a slope at g (sin t - C_rr cos t) / 1.53
  and an empty one at / 2, with the rolling resistance of the softer surface by material (steel 0.002, wood 0.01, concrete 0.012, carpet 0.08). A round piece touches by the
  lowest point of each ring of its profile: a straight can rolls straight, a tapered bottle rounds its narrow end. Pieces with a round one among them meet by their shapes
  (capsules, and the boxes of the other's parts as drawn) and trade an impulse with the restitution of their materials (rubber 0.8, glass 0.7, steel 0.6, wood and plastic 0.5,
  concrete 0.4, fabric and paper 0.2), momentum kept; walls and fixed furniture bounce them by the same table. Every piece of several meshes is met by its parts from the moment it
  is made a piece (a board rests on a bench's slats, a can rolls under a table between its legs); what leans on another piece's part is not pushed off it, and a piece moving by
  the foot of another does not wake it unless that one rests on it. Candidates by sweep and prune, surfaces under a point by a grid: fifty cans rolling cost about 1.4 ms per
  frame on a loaded machine. In the test room a light piece at the feet is kicked by the walk as two bodies colliding (shoe on it, e 0.5) through its centre of mass, and one
  lower than a step is not leaned on and does not stop the player.

### Patch Changes

- Updated dependencies [722990b]
- Updated dependencies [82f44ab]
- Updated dependencies [99183cb]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-audio@0.13.2
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-destruction@0.22.0
  - @adatechnology/game-vfx@0.11.0
  - @adatechnology/game-vfx-three@0.8.0

## 0.21.0

### Minor Changes

- 304dcc8: Recorded sounds for the vehicles: 52 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. Hood opening (`car_hood_open`) and closing (`car_hood_shut`, which answers `car_hood_close`), car crashes by speed (`crash_dent`, `crash_fold` and `crash_wreck` answer `crash_light`, `crash_medium` and `crash_heavy`), horns of a car, a truck and a motorcycle (`horn_car`, `horn_truck`, `horn_bike`), the air brake of a truck (`air_brake`), tyres squealing on asphalt (`tire_skid_asphalt`) and rolling on gravel (`tire_roll_gravel`), and the idle of a truck and of a motorcycle (`engine_truck_low`, `engine_bike_low`). `createVehicleSound` rolls on gravel with its own loop when the surface is `dirt` and lets the air out of a truck's brakes as it stops (`VehicleSoundOptions.airBrake`); the proving area takes the engine profile and the horn from the vehicle's group (`engineProfileOfGroup`, `hornOfGroup`). The vehicle's hood opens with `car_hood_open` in the destruction sound. Recipes of the same ids stay as the fallback while a file decodes (new ones: `car_hood_open`, `horn_bike`, `air_brake`, `tire_roll_gravel`).

### Patch Changes

- Updated dependencies [304dcc8]
  - @adatechnology/game-audio@0.13.0

## 0.20.0

### Minor Changes

- 4e8b8b8: Recorded sounds for the grenade launcher and the rocket: 33 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `launcher_40mm` (the 40 mm thunk of the M79, M32 and M203) and `rocket_launch` (an RPG-7 firing, three shots cut from one field recording, and more) are played by `WeaponAudio.launch`; the break-open reload (`barrels_open` and `barrels_close`, the hinged barrels of the M79 and of the break-action shotguns, which share the cue; `breech_open`, `grenade_load` and `breech_close`, the breech of a rocket launcher) and the rocket loading (`rocket_load`, `rocket_seat`) are the cues of the reload clips, whose hits are measured in `reload-sample-hits.json`; `explosion_rocket` is the blast of the rocket family; `rocket_motor_loop` is the motor of a rocket in flight, which the test room plays as one loop that follows the rockets in the air (`ROCKET_MOTOR`) and stops when the last one has burst. The recipes of the same ids stay as the fallback while a file decodes (the motor has a new one, `ROCKET_MOTOR_LOOP`).

### Patch Changes

- Updated dependencies [4e8b8b8]
  - @adatechnology/game-audio@0.12.0

## 0.19.1

### Patch Changes

- Updated dependencies [89f1d9d]
  - @adatechnology/game-audio@0.11.0

## 0.19.0

### Minor Changes

- baaa7d4: Recorded wood splinters (by blow strength), axe and blade hits on wood, metal clangs, scrapes and pings, cloth rips and cloth thumps (by strength) replace the synthesized recipes of those impacts: 44 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `splinter`, `shot_wood`, `shot_metal`, `break_wood`, `impact_soft_blunt` and `break_fabric` are keys of the impact table now, and a blow sends its strength (`intensity`) so the light, medium or heavy take plays. The recipes of the same ids stay as the fallback while a file decodes.

### Patch Changes

- Updated dependencies [baaa7d4]
  - @adatechnology/game-audio@0.10.0

## 0.18.2

### Patch Changes

- Updated dependencies [67edc92]
  - @adatechnology/game-destruction@0.21.0

## 0.18.1

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [a6a6a8f]
- Updated dependencies [49272b6]
- Updated dependencies [5ce9f7b]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-destruction@0.20.0
  - @adatechnology/game-audio@0.9.4
  - @adatechnology/game-vfx-three@0.7.6

## 0.18.0

### Minor Changes

- 41760ac: Broken objects: nothing floats, nothing invisible collides. After each break the renderer checks what is left of the object on the next update (`onBrokenChecked`)
  and lets go at once what stood on something and lost it; whatever is not a structure loses its footing by the same rule as furniture. What lay asleep on a piece
  wakes in the same update that piece starts to move. `shownBoxes(objectId, partId?)` gives the world boxes of what is still drawn. The test room measures the player
  against those boxes (a broken leg leaves no collider), logs a `broken_floating` failure when the check had to let something go, and looks for what a thrown body
  hit from the hip to the shoulder. The floor plan's golden hashes of the two house destruction scenes change: debris asleep on pieces that move now wakes.
- e8cae79: A piece's contacts follow the surface it rests on: on another piece the push is along the normal of that piece's face (a tilted table top pushes across itself,
  not straight up), and friction is Coulomb in the plane of the surface, static while the point holds and dynamic while it slides (0.7 and 0.6 unless the piece
  says otherwise, mixed by geometric mean between two pieces). A box on a top tilted past atan(μ) slides down it toward the low side; gentler, it stays. Pieces on
  the top of another are no longer pushed sideways off it by the separation of pieces side by side. The floor plan's golden hashes of the three house destruction
  scenes change with the solver.

### Patch Changes

- 148cbbb: A loose piece of furniture touches the ground by the corners of each part left of it, not by the box around them all: a top left on one leg, or on the two legs of one
  side, has its centre of mass off what holds it and goes over until it lies on the floor.
- 8976efa: Grit and dust go on falling where a blow broke a hard face. A spall or a unit knocked out of masonry or concrete keeps shedding a pinch of grit and dust for 2 to 5 seconds, less and less as the loose bits run out; dust hangs 2 to 5 seconds before it settles and chips stay 2 to 4 seconds, long enough to reach the floor.
- Updated dependencies [a3b0fd7]
- Updated dependencies [3894641]
- Updated dependencies [8976efa]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-vfx-three@0.7.5
  - @adatechnology/game-vfx@0.10.1
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-audio@0.9.3

## 0.17.3

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
- Updated dependencies [5170e39]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vfx@0.10.0
  - @adatechnology/game-destruction@0.18.2
  - @adatechnology/game-audio@0.9.2
  - @adatechnology/game-vfx-three@0.7.4

## 0.17.2

### Patch Changes

- Updated dependencies [45fd34d]
  - @adatechnology/game-vfx@0.9.0
  - @adatechnology/game-vfx-three@0.7.3

## 0.17.1

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1
  - @adatechnology/game-audio@0.9.1
  - @adatechnology/game-vfx-three@0.7.2

## 0.17.0

### Minor Changes

- 2933abd: `impactSoundIds()` lists every sound a blow, ricochet or break on a material plays; the test room preloads them on the first key or click, so the first ricochet off a wall plays the recording instead of the synthesized recipe.

### Patch Changes

- Updated dependencies [dbc0ef3]
- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-vfx-three@0.7.1

## 0.16.0

### Minor Changes

- 02b8ea2: Madeira se despedaça pelo jeito que é feita (`MaterialDef.splitForm`): madeira maciça em lascas pontiagudas de vários tamanhos ao longo da fibra, e o toco de tábua quebrada com a ponta rasgada; compensado em farpas finas e lâminas que se separam em camadas; MDF em torrões granulados, sem fibra. O renderizador desenha lasca, toco rasgado, torrão e lâmina com poucas geometrias compartilhadas por forma; o resto continua caixa.

### Patch Changes

- fb985db: A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
- 61a4a79: Cover counts in a blast's push as it stood when the blast went off, and for light things too. `blastShove` takes the cover's share off the speed after the cap (`sqrt(reach) * min(maxSpeed, ...)`): a bottle behind a kitchen cupboard was thrown at the cap like one in the open, since a P13 gives a 0.5 kg body far more than the cap; in the open nothing changes. The destruction renderer reads the cover of each piece and shoveable body when a part of the world goes off, before the blast tears the cupboard apart or throws the stove into the line. The P13 push scenario reads the cover at the same moment and at the middle of what is drawn of each body, and bounds what a sheltered body may move by its share of what one of its kind went in the open nearer the blast.
- 54a1bcb: A wall that comes down after the house drew its holes no longer leaves as an invisible piece: the house renderer keeps the plain positions of the ranges it collapses (`userData.plainPositions`), and the destruction renderer draws them again when the part leaves the mesh (`showCollapsedRanges`, and `extract` for ranges of a merged mesh). The fallen wall is drawn where the world has it, so shots hit only what is drawn and its bullet marks stay on it instead of floating in the air.
- e587c5d: The renderer never drops an event that changes what is drawn. A blast floods the event queue with damage, melt and drip events; past its cap the queue now keeps taking breaks, collapses, detaches, fires and leaks, and drops only the cosmetic ones, so a wall the solver brought down is never left drawn standing.
- e59b4d4: Bare rebar no longer hangs in the air: a part's cage is drawn as a child of the drawing of its object, so a beam or a wall that comes down (a split piece) takes its bars with it, and a cage that gives way (`expose` with no bars) drops its bars as steel debris that falls, lies on the ground and stays there with a body (`FragmentSystem.spawn` with `lasting`). Bars still held by concrete stay where they are and keep bending under load.
- 296efd7: What lay on a support that is gone falls. A sleeping piece looks under it again, a few each update in turn, and wakes when none of its lowest points has the ground,
  a piece or a fixed top under it (the cans on a table whose legs broke, a book on a shelf that fell over); a fragment asleep over a ground that dropped does the same.
  Furniture that lost the parts it stood on is loose: with every leg broken the top comes down, with the legs of one end gone it goes over, and a piece that lost a part
  is the box of what is left of it. In the test room, a module's counter that became a piece no longer holds things up where it stood.
- Updated dependencies [fb985db]
- Updated dependencies [6c3877d]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [bf407ec]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0
  - @adatechnology/game-vfx@0.8.0
  - @adatechnology/game-vfx-three@0.7.0
  - @adatechnology/game-audio@0.8.0

## 0.15.4

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.15.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-vfx-three@0.6.0

## 0.15.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-destruction@0.16.0
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-vfx-three@0.5.2

## 0.15.1

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.15.0

### Minor Changes

- e522e32: Fire sounds by fuel: wood, fabric, plastic/rubber, a gas jet and a pool of fuel each play their own roar (`FIRE_FUEL_OF`, `FIRE_LOOP_OF`, `FIRE_CRACKLE_OF`, recorded loops with synthesized fallbacks); a gas jet and a fuel pool do not crackle. The renderer sends the burning material, a venting vessel burns as gas until it bursts, and `DestructionSound.reset()` puts every fire sound out. The test room gives a molotov's pool and a burning fuel stain the liquid fire sound and resets the fires on clear.

## 0.14.0

### Minor Changes

- 4dce01e: Recorded blasts and fire (Freesound CC0 field recordings) for the explosion and fire sounds: `blastFireSampleBank` and `BLAST_FIRE_SAMPLES` in game-destruction-three play the files under the same ids as the synthesized recipes, which stay as the fallback; the fire's roar is a crossfaded loop of recorded fires. game-audio: a looping sample sound now plays at its own `gain`, and `sfx:convert` drops manifest takes whose file is gone.
- fb6d690: Explosions and fire sound like what happened. `createDestructionSound` plays the family of each explosion from its effect (grenade, big charge, fuel vessel, car, pipe bomb, rocket, flashbang, molotov; `BLAST_KIND_OF`, changeable by option), the far rumble past 60 m and the indoor tail when the blast was confined; fire has its ignition "whoomp" (at most two at once when many parts catch together), a gas leak while a punctured vessel vents, a lower roar and crackles at the burning points (`update(dt)`). The renderer sends the explosion's effect, radius and confinement with `explode` (`SoundDetail`). game-audio adds the `kit` mix (the art scene chain plus a soft limiter with a −1 dBFS ceiling), now the default: a blast with its debris no longer clips the output. The room passes the thrown explosive's id to the renderer and ticks the fire crackles.
  A car's fuel tank names its explosion (`car_fuel_tank`), so it sounds and looks like a car going up.
- a27d5ae: A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.
- ebb9479: Foley of the hand. `game-audio` ships `FOLEY_BANK`: doors (wooden, metal, locked rattle, slam), fridge, microwave, drawers, item pickup by material, throw, can and bottle opening, gulps, chewing and first aid, under the ids of the sound list so a recorded take under the same id replaces the synthesised one. Each recipe draws pitch, timing and level from ranges (no two plays alike) and uses `FOLEY_FALLOFF`, which falls off faster and loses its highs with distance. `LEAF_FOLEY_SETS` groups the leaf sounds by kind (`fridge`, `microwave`, `drawer`, `wood_door`, `metal_door`).

  `TestableItem.sounds` (`ItemSounds`) lets an item name its leaf sound set per part, its pickup class, its opening sound and the sound of each use. The household fridges and microwave declare theirs; a vehicle's leaves are left to the vehicle bank (`game-vehicles-three`).

  `createDestructionSound` registers the foley bank and plays a key without a rule that is the id of a registered sound. The test room plays a leaf's set (the item's, else a drawer for a slide, else a metal or wooden door by material; a heavy leaf slams), and now sounds when an item is picked up, thrown, opened (can tab or screw cap) and while it is drunk or eaten. The doors keys `leaf_latch`, `leaf_creak_*`, `leaf_shut_*` and `leaf_rattle` are no longer sent by the room's doors.

- 29782fc: Impact sounds by material and kind of blow. Every destruction event a hit emits carries `blow` (the hit's `DamageType`). The renderer sends `onSound` a
  `detail.keys` list, most specific first (`impact_<material>_<blow>`, `impact_<material>`, `impact_<family>_<blow>`, `impact_<family>`, and `break_*` for
  fractures), before the legacy family key. `impactFamily` gives ceramic, the ground (soil, sand, gravel, turf), plastic, wax and plants their own family.
  `IMPACT_SOUND_KEYS` and `IMPACT_SOUNDS` add a sound for a bullet, a blow and a blade on metal, wood, glass and masonry, and own sounds for thin metal, MDF,
  ceramic, plaster, the ground, plastic, rubber, wax, soft things, paper and plants. The test room passes the keys through, and
  `examples/test-room/sound-audit-impacts.mjs` measures what each material plays for each blow in the real room.
- 4145cc9: Vehicle sounds that follow what the vehicle does. `game-audio`: a loop can carry a `falloff` and `pan`, and `set` takes a `position` (level and side from the listener, duller far away) and a `cutoff` (the first filter); the sink passes `params.cutoff` and the position through. `game-vehicles-three`: `VEHICLE_SOUND_BANK` and `createVehicleSound` — the engine as loops crossfaded by RPM at the firing frequency (car, truck, bike profiles), louder and brighter under load, an RPM guessed through gears for drivers without an engine model, the starter (catching with a flare, or failing), ignition off, tyres squealing on asphalt or hissing on dirt by slip, road noise by speed, crashes light / medium / heavy by speed, and car doors, trunk and hood. The vehicles area turns the key before the lane car pulls away. `game-test-room`: a leaf of an object tagged `vehicle` plays `vehicle_<door|trunk|hood>_<open|shut>`; `game-destruction-three` maps those to the car sounds, falling back to the old latch and metal shut when the vehicle bank is not loaded (`SoundKeyRule.fallback`).

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0
  - @adatechnology/game-vfx-three@0.5.1

## 0.13.0

### Minor Changes

- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.

### Patch Changes

- fab813c: Silent fallbacks now say so (spec 005, review item 12). `warnOnce(key, message)` in `game-contracts` warns once per key on the console, outside production. `createDestructionRenderer` and `createFluidRenderer` without `vfx`, `createViewmodel` (and `createWeaponFx`) without `effects` and `createWeaponAudio` without `engine` keep working with a world or engine of their own and warn once. The weapons test module makes its own audio only when it is first needed, so a room that lends the engine never triggers the warning.
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [cbb20a2]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
- Updated dependencies [65ccb0c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-vfx-three@0.5.0
  - @adatechnology/game-vfx@0.7.0

## 0.12.1

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vfx@0.6.0
  - @adatechnology/game-vfx-three@0.4.0
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-destruction@0.13.2

## 0.12.0

### Minor Changes

- b818f6a: A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

  A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.

- f911ab1: How long debris stays on screen is configurable per fragment: `fragmentLife` takes a rule `(fragment, objectId) => seconds` besides a number (0 = forever), so rubble can stay and chips can go by material, size or object. The test room takes `debris: { fragmentLife, maxFragments, particles }`, where `particles` tunes the dust, smoke and chip sprites by kind.
- 5d5e869: `onLoosened` is also called when furniture came apart and the renderer made what stayed a piece, with a new `cause` argument (`blast` or `apart`). The test room stops keeping the footprint of a table knocked over that way, so no invisible wall stays where it stood.
- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

### Patch Changes

- 385281b: Fragments (splinters, lumps, shards, a brick out of a wall) are named `fragment` and marked with the kit origin of `game-destruction-three`, so the scene audit no longer reports debris as a piece drawn outside the kit.
- 6ef4843: Pieces on the floor come to rest instead of trembling forever: separation no longer moves or wakes a sleeping piece, and a piece that keeps to the same spot (within 1 cm and 3°) for 1.5 s sleeps however its speed flickers, as a book propped on another does.
- 4eb330f: A shot breaks a brick or a concrete block where it lands instead of knocking the whole unit out: a crater a few centimetres across goes through the unit (about 6 cm for a pistol round, 10 for a rifle round), the rest of the unit stays, and small bits of the inside of the material fly out of both faces, most out of the far one. The rest of a unit comes out, in pieces, only once its craters took most of it. A wall, a partition or a column now loses its section across one height, so a slot shot along the base of a wall brings it down while the same rounds spread over its face leave it standing. The house renderer draws each crater as an irregular hole through the unit with the plaster broken off around it, and the marks of a shot (bullet holes, spalls) now sit on the face as drawn, not a few millimetres behind it.

  A pistol round on a plastered brick wall no longer draws a star of cracks and a flat orange disc: the plaster comes off in a ragged patch drawn by the house renderer, with the brick and its mortar under it and the bullet hole on the brick (the destruction renderer leaves its patch out on meshes marked `userData.drawnSpalls`). The destruction renderer also keeps ranges another drawing collapsed (`userData.collapsedRanges`) when it rewrites a merged mesh, so a broken wall comes back after a reset.

  The other materials take a round the same way: the concrete laid bare in a wall is one face with no joints, an opaque brittle body (a ceramic tub) cracks a hand around the hit in a dark shade of its own colour instead of black lines across the piece (glass keeps its long white cracks), and a hole in wood has a rim of torn fresh wood under it.

- A piece that is falling over is not put to sleep for keeping its place, and whether it already lies is measured on its own box: a lone leg whose top touched the board it was joined to stayed standing.
- 9c63053: A shot into MDF or wood left no hole: the lumps it tore off came as a `chip`, and the renderer cleared every mark inside it as if a brick had left the wall. The `chip` of what a blow tore off a face now carries `torn: true`, and the renderer and the house breach keep the hole and its marks.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [b58423f]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-destruction@0.13.0
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-vfx-three@0.3.6

## 0.11.1

### Patch Changes

- 73f3cf2: Crushed masonry takes the colour of its material: brick, concrete, plaster and stone get `visual.innerColor`, the `debris` event names the material of
  the bits when it is not the part's own (`material`, the plaster coat over a brick wall), and the renderer throws chips and dust and draws spalls in that
  colour (brick orange, plaster light, concrete grey) instead of the dark grey of the generic concrete impact.
- 2a1bb17: Wall damage stays where the shot lands. The house no longer redraws a whole wall as plain white blocks on the first brick that comes out: the wall keeps
  its geometry, plaster and paint, and is cut by a mask only where units came out, with a ragged edge of plaster and the bricks (in their mortar) or the
  rough concrete of a beam showing around the hole. Bullet holes, spalls and the impact marks of the effects go with the brick that comes out
  (`DecalPool.clearInside` in game-vfx). A bullet now wears only its stretch of a joint (`BULLET_JOINT_SPAN`), so a row of shots along a ten-metre wall no
  longer opens the whole mortar bed and brings the wall down.
- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0
  - @adatechnology/game-vfx@0.5.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-vfx-three@0.3.5

## 0.11.0

### Minor Changes

- f68acce: Cans dent where they are hit and are holed on the lid, the bottom and the rim as on the side. An item family can give its shell the real wall thickness (`rule.wall`: a drink can is 0.1 mm on the body and 0.25 mm on the ends, a food tin a bit more); `tagForDestruction` writes it as `userData.destructionThickness` and `specFromObject3D` uses it for the part, so a 9 mm goes through a lid even at a slant. With `tessellate.cylinder.capRings` (and `three` passed to `tagForDestruction`, as `buildItem` does) each cylinder of the model becomes one lathe with rings on its ends and rows as fine as its columns, and a model drawn as a lathe gets the same columns, so the lid and the bottom have vertices to dent. In the world a ductile sheet 0.5 mm thin or less folds deeper than a plate for the same blow (up to 4 times), on a patch no wider than 2.5 cm and never past near its middle, and the slit a blade cuts in it is pushed in around. A skin follows its shell past the degenerate triangles of a lathe. The liquid of an opaque container is not drawn through a narrow mouth (a can's tab) nor through the bullet holes drawn on it.

  The test room pushes what a round hits at the point of the drawn surface it meets, along that surface's inward normal (plus a share along it), with the momentum the round lost there: all of it when it stopped, through a thin shell only what the wall and the liquid inside took. A round on the right of a can pushes it away and to the left and spins it; before, it got the whole momentum of the round along the shot at the box the world sees.

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.
- 31fc87d: Each material answers each kind of blow its own way. New `MaterialDef.hits` (material × damage type): what a blow tears out where it lands (`tear`: `splinters`, `lumps`, `none`) and the joules per piece. A round into wood tears splinters of fresh wood out of the exit (and back out of the entry), MDF crumbles lumps, plywood splinters; a punch crumbles MDF, a kick splinters pine, hardwood and steel tear nothing. Snapping boards (MDF, plastic) also break where they are shot. `innerColor` for wood, plywood and MDF. Cases with shelves (`furnitureSpec`) are MDF.

  Loose pieces land on what is under them: on other pieces and on the drawn meshes of fixed objects (`PieceSystemOptions.staticTopAt`), so a falling shelf rests on the books below and a tipping panel on the chair in front. New `DestructionRenderer.solidsNear` gives the drawn boxes around a point. The test room's player walks by them: steps onto low debris (up to 45 cm), stops at taller things and kicks light pieces (books, boards) out of the way, instead of the scenery's old footprints.

- 31fc87d: A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

  `DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

  The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.

  Furniture that comes apart no longer leaves anything fixed: what stayed standing becomes a piece too, and a piece whose feet are too close for its height (a lone leg, a board on two legs in a line) falls over until it lies.

- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.

### Patch Changes

- eaedd22: Physics of the objects in the room (first object audited: the trash bin). The player no longer walks through spawned objects: what stands taller than a step blocks the walk, and the walk pushes what is light enough with the force of a person against the floor's grip (a 3 kg bin slides or tips, a 70 kg fridge only blocks); the walk moves in short steps so a long step cannot jump over a thin obstacle. A kick leaves the hip instead of the eye, so it reaches what is in front of the feet. A round through a ductile shell (plastic, sheet metal) leaves in it only the energy it took to cross it (two holes, the part does not burst); a blade with more energy than a thin wall takes goes through it (a knife into a plastic bin or a can). A burst of fragments over the live budget no longer builds the excess meshes only to fade them.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-vfx-three@0.3.4
  - @adatechnology/game-vfx@0.4.4

## 0.10.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3

## 0.9.0

### Minor Changes

- bf68a04: A shot book tears into loose pages instead of slabs as thick as the book. New `MaterialDef.sheet` (thickness of one sheet; paper 1 mm): a `tear` part thicker than a few sheets comes apart as layers of thin scraps, a little askew, three in four marked `Fragment.inner` (pages) and the rest cover. New `visual.innerColor` (paper: cream) colours the inner scraps and the fibres a hit throws out. The renderer lets those thin scraps glide and flutter down before they settle flat.

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2

## 0.8.2

### Patch Changes

- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-destruction@0.8.2
  - @adatechnology/game-vfx@0.4.1

## 0.8.1

### Patch Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.
- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1

## 0.8.0

### Minor Changes

- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- 642f290: `buildItem` takes `destructible: true`: each mesh gets the `game-destruction` material of its kit tag (`DESTRUCTION_MATERIAL_BY_TAG`), and models listed in `data/destruction.json` (the three cans) are hollow shells welded to one another with their label as a skin. The items test area draws its items that way. `specFromObject3D` understands `userData.destructionSkin` (such a mesh stays on the part it overlaps and never becomes a part of its own) and `root.userData.destructionMass` (the real weight, split between the parts); `buildItem` passes the item's `weight` that way.
- 8dc6775: Loose pieces and debris can be picked. Every mesh of a part now carries `userData.destructionPart` (part id) and `userData.destructionObject` (id of the world object it belongs to), including the meshes of a piece made by a collapse or detach and the mesh a vertex-range part gets when it leaves a merged mesh (they used to lose it). Fracture fragments, decals and ground stains carry `userData.destructionDebris = true` so a host can skip them in a raycast.
- bcf60c8: `specFromObject3D` reads `userData.destructionContains` (`{ fluid, liters }`) of a mesh onto the part it makes, so that part is a container: a hole through it emits a `leak`.
- d24de8a: Soil and foundations (T10 §8). `game-contracts`: `DestructibleSpec.soil` (`SoilProfile`, `SoilLayer`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`) and the `settle` event. `game-destruction`: soil classes with the NBR 6122 basic pressures (`SOILS`), footings as
  elastic-plastic springs (subgrade modulus of a rigid footing, safety 3), piles by Décourt-Quaresma (`pileCapacity`, `pileLength`), and the object as a
  rigid body on them with the 1/200 out-of-plumb and P-delta: it settles, a heavy building on soft soil sinks, leans and tips over, on piles to firm
  ground it holds; `buildFrame({ footing, raft, piles, soil })`; option `soil` (`SOIL_DEFAULTS`). Off unless a spec has `soil`. `game-destruction-three`:
  draws the settlement and tilt under a `destruction-soil` node. `game-floorplan-structure`: `toDestructibleSpec({ soil, foundation, piles, soils })`
  puts the house on a raft (with piles) or on footings under each wall (`RAFT_THICKNESS`, `PILE_AREA`).
- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

### Patch Changes

- 3ebc4d5: A dent is never silently invisible: when fewer than 3 vertices of a mesh fall inside the dent radius (a mesh coarser than the dent), `applyDent` widens the radius to 1.5 times the distance to the nearest vertex, so the nearest vertices are pushed in.
- 31e7483: A skin mesh (`userData.destructionSkin`: a label, a coat) now moves with the surface of the shell under it when the part is dented (nearest shell triangle, barycentric weights, `applyPartDent`), instead of being dented on its own grid, so the two meshes never cross whatever their vertex grids are.

  The dent of a part also uses one reach for all its meshes: `Visuals.dentReach` finds the radius that gives each mesh at least 10 vertices (and 1.5 times the distance to the nearest), the part takes the widest.

- 7b5efe4: `specFromObject3D` (and the renderer's part matching and piece measuring) now work in metres for a scaled root: the root's world scale is kept, only its position and rotation are removed. A model drawn in other units and shrunk with `root.scale` no longer gets an oversized destruction body.
- 5b1d53f: `DestructionWorld.vent(objectId, partId, { point?, normal?, diameter? })` opens a through opening in a container part like a valve does (a `leak` event, the level drops, no damage and no `hole` event; `Hole.vent` marks it) and `seal` closes it. A `heat` hit of 470 °C or more on a part that leaks flammable fluid lights the leak (a lighter or a torch held at a gas jet): it burns, or goes off by its `explodes.chain`. The renderer ends a leak when its opening is closed.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [5679830]
- Updated dependencies [e4663e1]
- Updated dependencies [1b1d611]
- Updated dependencies [9f7dadf]
- Updated dependencies [d610199]
- Updated dependencies [fa6ea00]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
- Updated dependencies [011e17a]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-vfx@0.4.0
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-audio@0.2.1

## 0.7.3

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-vfx-three@0.2.1

## 0.7.2

### Patch Changes

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).
- Updated dependencies [a41fcb7]
- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-audio@0.1.2
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-vfx@0.1.3
  - @adatechnology/game-vfx-three@0.1.3

## 0.7.0

### Minor Changes

- 968d7df: `renderer.explode(point, energy, radius, { report })` pushes each piece with the energy that reached its object (shelter and confinement of the `world.explode` results); without a report the old formula.

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction@0.7.0
  - @adatechnology/game-audio@0.1.1
  - @adatechnology/game-vfx@0.1.2
  - @adatechnology/game-vfx-three@0.1.2

## 0.6.0

### Minor Changes

- 0f9e616: `createDestructionSound(engine)` registers the material sounds of the art scene (`glass`, `wood`, `thunk`, `ping`, `clang`, `chip`, `crumble`, `thud`, `hiss`, `boom`, `burst`, `crack`) and the game's `explosion_boom` in `@adatechnology/game-audio`, and maps the renderer's `onSound` keys through a replaceable table (`art_scene` or `game` style). The renderer sends `burn_end` when a part goes out or finishes burning, and `burn_loop` is the fire loop that rises with the parts in flames. `game-audio` is a dependency.

### Patch Changes

- Updated dependencies [7fd46fb]
- Updated dependencies [0f9e616]
- Updated dependencies [3a8cc95]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-audio@0.1.0
  - @adatechnology/game-destruction@0.6.1
  - @adatechnology/game-vfx@0.1.1
  - @adatechnology/game-vfx-three@0.1.1

## 0.5.0

### Minor Changes

- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [3f89fd3]
- Updated dependencies [55037ce]
- Updated dependencies [51d16d1]
- Updated dependencies [4415620]
- Updated dependencies [aa2c014]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
  - @adatechnology/game-vfx-three@0.1.0
  - @adatechnology/game-destruction@0.6.0

## 0.4.0

### Minor Changes

- 86179cc: Desenha os eventos de parede: `spall` (remendo da cor do núcleo), `stage` 2 (fragmentos do tamanho da peça com os furos de `Fragment.marks` presos neles, a peça continua desenhada) e `expose` (vergalhão em cilindros instanciados, `renderer.rebarCount()`). A abertura cortada na malha fica para o renderizador de casas.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-destruction@0.5.0

## 0.3.3

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0
  - @adatechnology/game-destruction@0.4.2

## 0.3.2

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0
  - @adatechnology/game-destruction@0.4.1

## 0.3.1

### Patch Changes

- 76ae86f: Chain reaction of explosives (A11). A part with `explodes.chain` is set off by a bullet, fire or a blast within reach and explodes after the delay of that trigger (fixed or drawn from the seed); the world emits `primed` and then `explode`, a part goes off once, blasts resolve in order of time and the delays count from the blast that armed the part, so the timeline does not depend on the `dt` of `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `game-weapons` (fuel barrel, car tank, propane, pump, station tank). A bullet or a blast that would have destroyed such a part now arms it instead. `game-destruction-three` draws the fire of a part primed by a shot or fire.
- Updated dependencies [04929d4]
- Updated dependencies [76ae86f]
- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-destruction@0.4.0
  - @adatechnology/game-contracts@0.5.0

## 0.3.0

### Minor Changes

- 1920f22: `DestructionRenderer.explode(point, energy, radius)` draws a blast that has no exploding part (flash, fire, smoke, light, sound and a shove on pieces in range). `world.explode` emits no event, so a grenade used to leave only debris; the test room now calls the new method when a thrown explosive detonates.

  `explode` is a new **required** member of the `DestructionRenderer` interface: any implementer of the interface (a custom renderer, a test double) must add it.

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0
  - @adatechnology/game-destruction@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0
  - @adatechnology/game-destruction@0.3.1

## 0.2.0

### Minor Changes

- 4573613: `bind` can now draw a part by a vertex range of a merged mesh: `BindOptions.parts` values also accept `{ mesh, range: [v0, v1] }` (new exported type `MeshRange`, alone or in an array with plain meshes). Dents, char and heat colours (through vertex colours), melt and hole/crack decals apply only to that range. When the part detaches, collapses (the renderer now also splits loose groups on `collapse` events) or breaks, its faces are extracted into a new mesh for the loose piece and the range is collapsed in the merged mesh; `restore` and `clear` bring everything back. Invalid ranges throw from `bind`.

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [463c9cc]
- Updated dependencies [5603151]
- Updated dependencies [d913ace]
  - @adatechnology/game-contracts@0.2.0
  - @adatechnology/game-destruction@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [cbcbd82]
  - @adatechnology/game-destruction@0.2.0

## 0.1.1

### Patch Changes

- cb132c2: `userData.destructionPart` may be a string or an object `{ id, material?, parent?, kind? }` in `specFromObject3D` and `bind`; `parent` + `kind` add an explicit joint.
- 308a258: Tall thin pieces (a door off a fridge) now topple instead of balancing on an edge: a narrow support gets a topple push and the piece does not sleep until it rests on a stable support.
- 2363a12: Fragments and debris of vertex-coloured meshes use the average vertex colour (cached per mesh) times `material.color` instead of coming out white.
- Updated dependencies [930b9ab]
- Updated dependencies [745e342]
- Updated dependencies [cc23a66]
- Updated dependencies [d727a0c]
- Updated dependencies [f1e3349]
- Updated dependencies [fd82f4a]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1
  - @adatechnology/game-destruction@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 0256a5b: Initial release (0.1.0): three.js renderer for `@adatechnology/game-destruction` with vertex dents, hole and crack decals, char and heat glow, melting and puddles, fragments, loose pieces with light physics and pooled particles, plus `specFromObject3D` and `heatColor`.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [5feff74]
  - @adatechnology/game-contracts@0.1.0
  - @adatechnology/game-destruction@0.1.0
