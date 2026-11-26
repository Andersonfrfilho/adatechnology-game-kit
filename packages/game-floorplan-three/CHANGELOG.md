# @adatechnology/game-floorplan-three

## 4.1.1

### Patch Changes

- Updated dependencies [9412886]
- Updated dependencies [919616f]
  - @adatechnology/game-contracts@0.42.0
  - @adatechnology/game-destruction@0.30.0
  - @adatechnology/game-floorplan-structure@4.0.5
  - @adatechnology/game-render-three@0.4.6
  - @adatechnology/game-urban@0.7.1

## 4.1.0

### Minor Changes

- d7fa717: A cratera de uma carga no chão usa a energia real da carga. Os `specificEnergy` do solo são de joules reais (1 kg de TNT = 4,184 MJ; a granada de 800 kJ, a carga de contato de 4,2 MJ), mas o mundo de destruição entregava ao terreno o `energy` da escala de dano do arsenal (0,24 kg = 200 kJ): toda cratera saía com 1/5 da energia. `applyHit` explosivo agora lê `hit.tnt` vezes `TNT_JOULES` (exportado de `game-contracts`) quando o golpe traz `hasCharge` (novo em `Hit`: o mundo de destruição o marca quando a explosão recebeu `charge.tnt`, como a sala faz com toda carga do arsenal); sem carga dita, segue o `energy`. O PG-7V (0,45 kg) passa de 0,19 m para 0,39 m de fundo no solo do quintal.

  Os canos enterrados da casa (esgoto da NBR 8160 e águas pluviais da NBR 10844) quebram com cratera como a rede da rua: `createHouseBuriedPipes` (`game-floorplan-three`) lê o estágio de instalações e pergunta a `breachOf` de `game-urban`; o cano que a bacia alcança aparece no buraco, o que ela corta até a linha de centro quebra (vão) e vaza (`leakOfPipe`, novo em `game-urban`). `ModuleHost` ganha `onCrater` e `addTap` (`HostTap`), que a sala implementa com o terreno e o `game-fluids`; a área de casas liga os dois.

- 9f0a371: Nada fica no ar sobre uma cratera (CLAUDE.md §12). `wakeRegion` acorda também a peça cuja raiz está fora do disco (a peça cortada de um objeto inteiro, a calçada da casa, tem a raiz na origem do objeto) quando ela está no disco e o chão sob parte da sua pegada desceu mais de 5 cm; a que o disco só toca segue dormindo. `BuildOptions.groundSurfaces: false` (novo): quando o terreno do host desenha o lote (`groundLayoutOfPlans`: zonas, coberturas de chão e caminhos), a casa não desenha mais as próprias placas planas por cima dele — elas não podiam ser cavadas e ficavam como um tampo sobre a cratera. A área de casas da sala liga a opção.

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-destruction@0.29.5
  - @adatechnology/game-contracts@0.41.0
  - @adatechnology/game-urban@0.7.0
  - @adatechnology/game-floorplan-structure@4.0.4
  - @adatechnology/game-render-three@0.4.5

## 4.0.0

### Patch Changes

- Updated dependencies [dd746b4]
  - @adatechnology/game-interactables@0.6.0
  - @adatechnology/game-floorplan-interactables@6.0.0

## 3.1.1

### Patch Changes

- b3670e1: A chuva não passa por nada que tenha teto. Além das casas, agora alimentam o `RainCover` do host: os carros, ônibus e caminhões (`createVehicleRainCover` em `game-vehicles`, a cabine do `cabinEnclosure` mais o teto e as janelas que sobraram; caçamba aberta, moto, barco, avião, helicóptero e trator ficam descobertos; teto arrancado, para-brisa quebrado ou furo de 30 cm ou mais deixam a chuva entrar; o carro em movimento só gira o retângulo e a versão só sobe a cada 1 m ou 5 graus, `createVehicleRainCovers` em `game-vehicles-three` liga isso ao host), os prédios, torres de vigia, contêineres e barracas do `game-urban` (`builder.covers`, fora de `scene()`, então nada do que é desenhado muda; a área de teste e o distrito de referência alimentam o host) e, nas casas, a edícula, a sauna, a casinha de cachorro e o banheiro externo do lote (`createItemRainCover`). O `game-contracts` ganha `createFootprintRainCover` (retângulos girados que se movem) e `createFixedFootprintRainCover` (retângulos fixos respondidos por uma grade). Copas de árvore não seguram a chuva.
- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-destruction@0.29.4
  - @adatechnology/game-floorplan-structure@4.0.3
  - @adatechnology/game-render-three@0.4.4

## 3.1.0

### Minor Changes

- 2e803a4: Zumbis não atravessam mais paredes: as casas publicam paredes do térreo, muros, grades, portas e portões (`createHouseNavObstacles`, contrato `NavObstacleSource`) e a horda os grava na sua grade (`bindNavObstacles`). Contornam a parede, entram por porta ou portão aberto e pelo buraco de uma explosão, e batem na porta fechada até quebrá-la (a casa a mostra aberta).

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-destruction@0.29.3
  - @adatechnology/game-floorplan-structure@4.0.2
  - @adatechnology/game-render-three@0.4.3

## 3.0.1

### Patch Changes

- ed305c8: A luz de fora não atravessa mais paredes nem portas fechadas. A máscara de luz por cômodo nunca chegava ao shader (o laço das luzes pontuais mora no include `lights_fragment_begin`, que o renderer abre depois do `onBeforeCompile`): agora o include é aberto antes da troca. `effectLights` passa a tratar a luz cujo ponto não está em cômodo nenhum (poste da rua, fogo no quintal) como luz de fora: ilumina o lado de fora das casas e, dentro, só os cômodos atrás de uma janela externa ou de uma porta externa aberta voltada para ela; `update(houses, camera)` aceita a câmera para escolher as casas mais próximas. `effectLights` dá a máscara aos materiais da casa mesmo sem `lighting()`, e o preenchimento fraco ("indireta falsa") fica só com as lâmpadas dos cômodos.

## 3.0.0

### Minor Changes

- 5682afd: O item tirado de um móvel vai para a mão: `ModuleHost.takeInHand` (`HostTakenItem`) leva o item com as mãos que ele pede; o `take` de um item guardado diz qual é (`Interactable.itemType`); a área de casas entrega o item ao apertar E, e a sala fecha a mão nele com a regra de mãos e coldre (uma mão: a arma fica na outra). A sala passa a respeitar as mãos que a peça pede em vez de deduzi-las da massa.

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-interactables@0.5.0
  - @adatechnology/game-destruction@0.29.2
  - @adatechnology/game-floorplan-structure@4.0.1
  - @adatechnology/game-render-three@0.4.2
  - @adatechnology/game-floorplan-interactables@5.0.0

## 2.0.0

### Minor Changes

- 32547af: Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

  Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

  Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-floorplan@0.5.0
  - @adatechnology/game-floorplan-residential@8.0.0
  - @adatechnology/game-floorplan-structure@4.0.0
  - @adatechnology/game-floorplan-interactables@4.0.0
  - @adatechnology/game-interactables@0.4.0

## 1.2.0

### Minor Changes

- 9a2dcfb: Etapas da construção na ordem de uma obra brasileira: 0 planta, 1 fundação (baldrame impermeabilizado), 2 estrutura, 3 alvenaria, 4 instalações embutidas, 5 madeiramento do telhado (sobre a obra no osso), 6 telhas, calhas e condutores, 7 reboco e acabamento por dentro e por fora, 8 esquadrias, calçada e casa completa. `STAGE_LEVEL` exporta o nível de cada etapa. O madeiramento afasta caibros e ripas das faces da obra no osso (sem faces coincidentes antes do reboco); o reboco do telhado (oitões, beirais, platibandas) entra com o reboco.

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-destruction@0.29.1
  - @adatechnology/game-floorplan-structure@3.1.1
  - @adatechnology/game-render-three@0.4.1

## 1.1.0

### Minor Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

- 30a8199: Lado da casa das redes do bairro (spec 011, T2.8c): `engine.generate(id, { street: 'network' })` marca a entrada `serviceEntrance.street: 'network'` (ausente = `'own'`, todas as outras plantas iguais, goldens sem diff), põe o poste do padrão de 6 m no lote com o ramal ancorado a 5,7 m (sem quintal, o eletroduto sobe a fachada como pontalete até a mesma altura) e declara em `utilities.connections` os cinco pontos de ligação (energia com `installedKva`, telecom 0,6 m abaixo, saída da caixa de inspeção com `invert`, buzinote na divisa da frente, cavalete do hidrômetro). `connectionsInWorld` passa esses pontos para o mundo como `UtilityConnection`. No `-three`, uma casa em `'network'` nunca desenha os postes vizinhos nem a rede entre eles; com interativos o padrão é um objeto só (`service_entrance`). **Em `'network'`, `ElectricalInfo.pole` é o poste do padrão, não o da concessionária.**

### Patch Changes

- 89ab207: Os cabos da rede da rua não caem mais no chão quando a casa abre com o kit de interativos. O poste de entrada da casa, desenhado pelo kit (`service_entrance`), não é peça de destruição: os oito trechos da rede mais perto dele pediam `pole:<u>` como suporte, não achavam nada e entravam soltos no mundo. Agora cada trecho fica preso ao poste desenhado como peça na outra ponta do vão. Um trecho que nomeia um suporte que não foi construído entra em `structure.unheld` em vez de ficar solto em silêncio, e o teste `wire-anchors` constrói todas as tipologias (sem e com o kit) e exige que todo cabo esteja preso a uma peça que existe e que cada lado da rede termine num poste.
- Updated dependencies [30a8199]
- Updated dependencies [30a8199]
  - @adatechnology/game-floorplan-structure@3.1.0
  - @adatechnology/game-floorplan-interactables@3.0.0

## 1.0.1

### Patch Changes

- 33b7423: Instalações da casa como numa obra brasileira: nenhum cano no ar, nenhum cruzando porta ou janela.

  - Linha de gás em cobre (NBR 15526) embutida num rasgo da parede; onde há porta no caminho, desce ao contrapiso e passa sob a soleira. A mangueira do fogão (amarela, NBR 8613) entra com o fogão.
  - Esgoto (NBR 8160): pia, tanque e máquina saem do ponto na parede atrás da peça e descem nela; vaso e ralo descem direto pelo piso; no andar de cima, cruzam dentro da laje até a prumada; no térreo, terminam no contrapiso sobre o ramal enterrado.
  - Água fria (NBR 5626) e eletrodutos (NBR 5410) de sobrado descem pela parede de cada andar, trocando de prumada dentro da laje, sem atravessar cômodo de cima nem janela alta de pé-direito duplo; luz do térreo é alimentada pela laje sobre ela.
  - Água sob a pia entra com a pia; condutores pluviais entram com as calhas (nível 8); calçada de proteção e barrado cerâmico externo são o fim da obra (nível 8).
  - Fundação: baldrame impermeabilizado (betume) e cama de terra compactada só sob a casa, sem a faixa marrom em volta.

- Updated dependencies [33b7423]
  - @adatechnology/game-floorplan-structure@3.0.1

## 1.0.0

### Minor Changes

- cd5113c: Os canos de saída da casa (esgoto de vaso, chuveiro, pias, cozinha e área de serviço, e as descidas da calha) viram peças de destruição, e um furo de explosão na parede ou na laje por onde passam os expõe.

  `game-contracts`: `PartSpec.hostedIn` (a peça está embutida, ou presa, em outra), `PartState.exposed` e o evento `reveal`.

  `game-destruction`: uma peça com `hostedIn` que fica inteira dentro da caixa do hospedeiro não toma a onda da explosão nem tem a junta afrouxada pelo choque enquanto o hospedeiro está de pé. Quando um furo do hospedeiro (abertura, tijolos arrancados, ou o hospedeiro perdido) alcança a peça, ela aparece (`reveal`, `exposed`) e a junta com o hospedeiro abre: só o trecho dentro ou cruzando o furo se solta, o resto do traçado fica onde está, e um trecho preso pelos vizinhos fica pendurado no furo.

  `game-floorplan-three`: `utilities/drains.ts` põe cada dreno de aparelho dentro da parede mais próxima, descendo pela laje até o pé da parede do térreo, em trechos cortados por `cutRun`, escondidos enquanto embutidos e presos pelo sólido onde estão. As descidas da calha saem em trechos entre as braçadeiras, presos à parede. A cena do time (`visor*`) não os desenha. O trecho de laje que só tinha a laje inteira como apoio agora se apoia no painel dela (o apoio se perdia quando a laje virava painéis).

- 78ac539: Os fios do poste do lote soltam-se em trechos que não vão com o poste. Antes, cada trecho da fiação pendia do poste por uma junta que sempre une; ao cair, o poste levava os fios que a explosão não tinha soltado e virava um corpo de 1000 kg com 26 caixas e 23 m de largura, e a varredura contínua (CCD) do Jolt custava 60 a 70 ms por passo. Agora o poste leva só o fuste, a travessa e os isoladores (950 kg, 10 caixas) e cada trecho de fio cai como peça sua, com o próprio cobre.

  `game-contracts`, `game-destruction`: `JointSpec.tears` (padrão falso). A parte `a` pende de `b` só enquanto `b` está de pé (em um grupo ancorado); com `b` solto a junta larga, e o fio de um poste que cai desce sozinho. Uma junta que não rasga continua unindo as duas partes em um grupo. Quem se segura em duas pontas, uma delas de pé (o fio do ramal preso à parede da casa), fica pendurado nela.

  `game-destruction-three`: as peças que um `tears` separou (o fio e o poste de que pendia) não se tocam mais: sem isso o poste de 950 kg, ao tombar, batia nos fios de 12 kg que ele acabava de largar e os lançava (C1 de 34 e 105 kg·m, C2 acima do limite em 4 de 10 rodadas). `JointState.tears` (contrato), `PieceSystem.tether`, e o renderizador marca os pares ao soltar os grupos.

  `game-floorplan-structure`: `Support.tears` chega à junta da especificação destrutível.

  `game-floorplan-three`: os trechos da grade e do ramal pendem do poste mais próximo por uma junta que rasga (`tears`); o trecho que fica dentro de laje ou parede, ou ao lado de um, continua preso a ela. Com `segmentLimits.wiring: Infinity` a fiação segue como o time desenhou (uma peça só). Goldens regravados: `destruction/breach`, `destruction/spall`, `destruction/fracture` e o resultado do blast (21 objetos a mais, os trechos).

- f17aebb: Janela e parede na explosão, como no mundo real:

  - O vão da janela fica livre: os tijolos que a parede desenha onde foi cortada param no batente, no peitoril e na verga, e nenhum aparece atrás do vidro.
  - O vidro de janela é lido como vidro comum de 4 mm (o desenho segue com 12 mm): uma granada na cozinha quebra as vidraças do cômodo e as próximas.
  - `PlanWindow.frame` e `BuildOptions.windowFrame` (`'wood'`, `'aluminium'`, `'frameless'`): moldura de madeira (lasca), de alumínio (amassa) ou blindex (vidro temperado de 8 mm, sem moldura). O padrão é madeira na casa simples e alumínio nas outras. Na sala: `?windowFrame=`.
  - O pilar de canto quebra nas duas paredes que se encontram nele, e a quina se desfaz.
  - As lascas batem na primeira face no caminho (parede, teto, móvel) e caem (`FragmentSystemOptions.sweep`), em vez de atravessar a parede e ficar presas dentro dela à vista.

- 08c5801: Menos chamadas de desenho nos piores quadros da explosão da casa, sem mudar o que aparece na tela.

  - `createStaticBatcher` ganhou `shadowOnly`: as malhas continuam desenhadas sozinhas para a câmera e deixam de projetar sombra enquanto estão no lote; cada lote (só posições, um por lado que o passe de profundidade desenha) entra só no mapa de sombra. Malha com sombra que depende do material (recorte por mapa, planos de corte, deslocamento, material de profundidade próprio) continua projetando a própria. A malha que muda volta a projetar a própria sombra, do formato novo, no quadro em que muda. `maxVertices` divide um grupo grande em lotes menores, para cada um caber num quadro do orçamento.
  - Casa (`game-floorplan-three`): as peças paradas projetam a sombra de poucos lotes só de sombra (`createHouseShadowBatches`, ligado por padrão em `house.update`; `shadowBatches: false` desliga, e `?shadowBatches=0` na sala compara). Na sala, a sombra da estrutura caiu de 231 para 16 chamadas por quadro. Quando um quarto das peças volta a projetar sozinha (explosão, corte de andar), os lotes são refeitos do que ficou de pé depois de 2 s sem mudança.
  - Veículo atingido (`game-vehicles-three`): as peças paradas entram em lote logo no golpe, em pedaços de até 16k vértices, e só as que mudam saem; as que saíram voltam a um lote novo, no formato amassado, depois de 1,5 s sem mudança. Antes, o carro esperava 1,5 s desenhando peça por peça (~620 chamadas por quadro, com sombra) e depois juntava tudo de uma vez (16 a 22 ms num quadro). No sedã a 60 quadros por segundo: de 95 quadros acima de 300 chamadas para ~10, nenhuma atualização acima de ~6 ms, e 70 + 37 de sombra no fim (eram 67 + 34).

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

- 65b522a: O que é preso no mundo real é preso no mundo da destruição: a casa carrega como um grupo só, e nada cai ou escorrega na carga. Novo tipo de junta `slide` (corrediça de gaveta, 100 de resistência, sai com a mão ou com chave de fenda, 3 s) em `JointKind` e `JOINT_DEFAULTS`; as gavetas dos móveis do `game-interactables-household` passam de `clip` para `slide`. Na casa (`game-floorplan-three`), cada peça declara onde se prende (`holder`, ou `holdOn: 'floor' | 'wall'` com `holdJoint`): muro do lote e poste fincados no chão com a junta que `JOINT_BY_MATERIALS` dá contra concreto (tijolo e concreto: argamassa), soleira assentada no baldrame, portão e porta da caixa de correio na dobradiça do muro ao lado (`slide` no portão de correr), porta do box na parede do banheiro, portas e gavetas dos móveis no piso onde o móvel está (`hinge`/`slide`), eletroduto aparente grampeado na parede, botijão apoiado no piso (`resting`), cano fora da parede preso na laje em que entra; com o poste preso, a fiação pendura nele. Só cai quando essa junta quebra. Limitação conhecida: as portas e gavetas dos móveis da casa ficam presas ao piso sob o móvel (a laje do andar, ou o chão no térreo) até o corpo do móvel virar uma parte do mundo da destruição; hoje elas só caem quando a dobradiça/corrediça quebra ou o piso vai. Peça que diz onde se prende e não acha nada (`holdOn` sem piso, parede ou chão sob ela) vai para `house.structure.unheld`, e o teste de carga exige essa lista vazia em todo o catálogo. Peças interativas abertas são medidas fechadas. O que se finca no chão segura como a base enterrada: `embedmentStrength` (game-destruction) dá a resistência da junta pela base enterrada no solo (`soils.json`, pressão básica × segurança, camada a camada) sobre a base de referência de `EMBEDMENT_DEFAULTS`; `postEmbedment` é a regra do poste (10% da altura + 0,6 m). `Support.strength` (game-floorplan-structure) leva a resistência até a junta. Na casa, o poste declara a base pela regra, o muro do lote o baldrame (`GROUND_BEAM_DEPTH`) ao longo do comprimento, e uma peça desenhada abaixo do terreno conta o que está enterrado; pé no terreno ou abaixo dele (o terreno lido no canto mais baixo da pegada) está ancorado, nunca solto.
- 334489c: `registerHouseQueues(renderer, budget)`: põe as filas do renderizador de casas (repintura das paredes e corte dos buracos, esta com `mustDrain`) no orçamento de quadro do jogo, na prioridade do contrato. Um jogo não precisa mais escrever `mustDrain` por conta própria.

### Patch Changes

- ea549a5: Os canos escondidos na parede da casa feita por etapas (`constructionStages`, a casa da sala) saem em trechos como os da casa comum, e a soleira da porta de fora deixa de nascer dentro de quem a cerca.

  Canos: o traçado de cada cômodo era uma só peça escondida (uma caixa de 8 m por dentro de paredes e móveis, que o motor empurrava para fora por segundos). Agora a casa por etapas e a comum usam o mesmo `layWallRun`: cortado em cada laje e parede que atravessa e em `segmentLimits.pipe`, um trecho por peça, `hostedIn` a laje ou parede em que está (um furo ali o mostra), preso por ela ou pelo trecho ao lado e ligado ao anterior, os 3 kg do traçado divididos pelo comprimento. `segmentLimits.pipe: Infinity` continua desenhando o traçado inteiro (golden do time). `drawnEnds` passa para `utilities/segments.ts` e é dividido com os drenos.

  Soleira: nascia 4 cm dentro do chão e 1,4 cm dentro dos pilares, das vigas e dos batentes. Agora ocupa só o vão entre os batentes e livre das paredes, pilares e vigas, assenta no chão, com a base à altura da calçada.

- 1fede95: A quina de pilar e parede quebra como obra:

  - `game-destruction`: um membro moldado (peça com `reinforcement`) dentro da caixa de uma parede de unidades (o pilar que fecha a ponta da parede, a verga, a cinta) tira da parede os tijolos daquele lugar, e o tiro, o golpe e o raio que caem ali (também no reboco por cima) vão para o membro.
  - `game-vfx`: `PIECES_DRAWN_VARIABLE`; com ela os efeitos de rombo e desabamento soltam só a poeira, sem os blocos de enfeite (até 1 m) que jogam numa cena sem pedaços de verdade.
  - `game-destruction-three`: os efeitos de evento vão com `piecesDrawn` (o renderer já desenha os pedaços); `BindOptions.marksOn` põe as marcas de uma peça sem malha própria nas malhas das peças que a desenham.
  - `game-floorplan-three`: o pilar sem malha própria leva as marcas nas paredes em que está.

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [f17aebb]
- Updated dependencies [08c5801]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [b37d94f]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [1fede95]
- Updated dependencies [6473d97]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-destruction@0.29.0
  - @adatechnology/game-floorplan-structure@3.0.0
  - @adatechnology/game-floorplan@0.4.0
  - @adatechnology/game-render-three@0.4.0
  - @adatechnology/game-interactables@0.3.0
  - @adatechnology/game-floorplan-residential@7.0.0
  - @adatechnology/game-props3d@0.3.5
  - @adatechnology/game-shapes-three@0.4.1
  - @adatechnology/game-floorplan-interactables@2.0.0

## 0.14.2

### Patch Changes

- Updated dependencies [6b829c7]
  - @adatechnology/game-shapes-three@0.4.0
  - @adatechnology/game-props3d@0.3.4

## 0.14.1

### Patch Changes

- 0e0d121: Trocar a planta na bancada de casas não deixa mais nada da casa anterior no mundo. Os pedaços que se soltaram dela continuavam no mundo da destruição (invisíveis, colidindo e queimando), com o fogo, os fragmentos, as marcas no chão e as partículas que eram deles; a sala os guardava na lista de peças soltas.

  - `game-vfx`: `FireOptions.source`, `ExplosionOptions.source` e `SpriteSpawnOptions.source` dizem para quem um efeito foi feito, e `VfxWorld.clearSource(source)` tira de uma vez o fogo, as chamas, a fumaça, as brasas, o que a explosão jogou e os sprites dele.
  - `game-destruction-three`: os efeitos que o renderer faz para um objeto levam o id dele; `release(objectId)` tira do mundo os pedaços que se soltaram do objeto e todos os efeitos dele e dos pedaços (fogo, som do fogo, vazamentos, eventos na fila, fragmentos, marcas, ferragem, partículas), e desfaz a ligação; `releasePieces(objectId)` faz o mesmo mantendo a ligação (reset). `onReleased` avisa o host dos pedaços que saíram.
  - `game-floorplan-three`: a casa descartada (`dispose`, troca de planta, `clear`) chama `release`, e o `reset` chama `releasePieces`; a vista de rombo libera as formas dos tijolos ao sair.
  - `game-test-room`: a sala esquece os pedaços que o renderer soltou.

- Updated dependencies [f4cf94f]
- Updated dependencies [1849ae6]
- Updated dependencies [33d2474]
- Updated dependencies [71b5bef]
- Updated dependencies [d5850bb]
- Updated dependencies [fec8942]
  - @adatechnology/game-render-three@0.3.0
  - @adatechnology/game-destruction@0.28.0
  - @adatechnology/game-floorplan-structure@2.3.1

## 0.14.0

### Minor Changes

- b0b031b: O tiro na janela acerta o que está desenhado. `PartSpec.apertures`: vãos de uma peça (o vão da janela numa parede, a área do vidro num caixilho, o vão de uma grade com as barras); o raio que entra num vão segue, a não ser que bata numa barra. No detalhe `coarse` (o das casas), cada parede leva os vãos das suas janelas (`withWindowApertures`): antes, o tiro na janela batia no tijolo invisível da parede ou na caixa maciça do caixilho. O caixilho tem massa real (perfis de alumínio e peitoril: 18 kg numa janela de 1,4 m, antes 182 kg) e é aberto onde está o vidro; a grade virou peça de aço própria (`window_grille:*`), com as barras. O raio que passa pelo buraco aberto numa parede usa o mesmo referencial do objeto em todos os lugares.

  A área de casas abre direto numa casa pelo endereço (`?area=floorplan_area&template=mansion&seed=1&state=abandoned`, `floorplanAreaParams`), e planta registrada que nenhum grupo lista entra no grupo "Outros" da bancada.

  O pó e as fibras de uma peça desenhada pela casa (sem malha própria no renderizador) saem na cor padrão, em vez de um erro "failed to apply debris".

### Patch Changes

- Updated dependencies [b0b031b]
- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-destruction@0.27.0
  - @adatechnology/game-floorplan-structure@2.3.0

## 0.13.3

### Patch Changes

- Updated dependencies [dd8f202]
- Updated dependencies [9dc3676]
  - @adatechnology/game-destruction@0.26.0
  - @adatechnology/game-floorplan-structure@2.2.4

## 0.13.2

### Patch Changes

- f99694c: Tiro em pilar ou viga de concreto armado só tira concreto onde bate. A vida do pilar não decide mais o concreto: os tiros desgastam o bloco onde batem e nunca o deixam virar uma gaiola limpa de uma vez. Cerca de três tiros de fuzil no mesmo lugar soltam um bloco ali (antes eram seis), e a ferragem só aparece onde o concreto saiu, e não mais por baixo de uma cratera rasa, onde aparecia solta sobre a superfície. As pedras presas nas barras ficaram mais espaçadas, e só se apoiam numa face de concreto que ainda existe.
- Updated dependencies [f99694c]
- Updated dependencies [29abbc1]
  - @adatechnology/game-destruction@0.25.0
  - @adatechnology/game-floorplan-structure@2.2.3

## 0.13.1

### Patch Changes

- ef76d96: O jogador atravessa o buraco de uma granada de 40 mm pulando, como por uma janela. Para passar por um buraco desenhado na parede, o corpo conta por partes: a perna por cima de um peitoril de até meio metro, os quadris e os ombros com a largura deles, e a cabeça abaixada até 1,6 m. Nas vigas, na cinta e nas vergas, as pedras de concreto ficam presas nas barras de cima e de baixo, e as faces da quebra são as laterais do corte.

## 0.13.0

### Minor Changes

- f3c98a9: O corpo passa pelo buraco que o tiro ou a explosão abriu na parede. O `follow` da parede das casas (`wallPiece`) ganhou `blocks(x, z, raio, y0, y1)`, que diz se a parede, como está desenhada agora, segura um corpo naquele ponto: onde os tijolos saíram, o corpo passa; os pilares e o resto da parede seguram. Vale também para a parte da parede que se soltou e ficou em pé como peça (`owns` diz quais objetos do mundo ela responde). A sala de teste usa isso para o jogador: a parede de alvo deixou de ser um muro que fecha a arena de ponta a ponta (só os lados dela continuam fechados) e não é mais medida pela caixa inteira quando o seu `follow` responde por ela.

### Patch Changes

- 21b2d48: No corte de um pilar ou de uma viga, ficam pedaços de concreto presos nos vergalhões. Onde os blocos de concreto saíram, o desenho deixa pedras quebradas de concreto (formas irregulares, cada uma virada de um jeito) agarradas às barras dos cantos e assentadas nas faces da quebra acima e abaixo, mais ou menos em cada bloco (sempre os mesmos para o mesmo lugar), em vez da gaiola limpa.
- 5984ae4: O pilar de concreto lasca aos poucos onde os tiros pegam. Cada tiro que passa do cobrimento soma no bloco de concreto em que bateu; com uns seis tiros de fuzil no mesmo lugar o bloco se solta ali e os vergalhões aparecem, e o resto do concreto continua preso na ferragem. O núcleo atrás do bloco que saiu continua recebendo os tiros até o corte. Quando o pilar é cortado, sai só a faixa do corte: o concreto de cima fica na ferragem, preso na cinta, em vez de sumir de uma vez e deixar só a gaiola. Bala de pistola e chumbo de espingarda só marcam o cobrimento.
- Updated dependencies [5984ae4]
- Updated dependencies [779f9f4]
  - @adatechnology/game-destruction@0.24.0
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-floorplan-structure@2.2.2

## 0.12.5

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-destruction@0.23.2
  - @adatechnology/game-floorplan-structure@2.2.1

## 0.12.4

### Patch Changes

- 5f12ff1: O telhado se divide em trechos entre as tesouras. Cada água do telhado de duas águas vira um trecho por vão entre tesouras (`roof_a_0`, `roof_a_1`…; as pontas levam o beiral), e cada trecho se apoia só nas tesouras das suas bordas. Uma explosão quebra só os trechos ao seu alcance e o resto do telhado fica no lugar. O desenho segue a física: com a destruição ligada, as telhas de cada trecho são desenhadas como peça própria, então o trecho quebrado some sozinho. Opção nova `roofBays` (padrão: quando o detalhe não é `coarse`); o detalhe `coarse` do Visor continua com uma peça por água. O dimensionamento mantém caibros e trechos de telhado abaixo da redundância quando um pilar ou parede portante cai, como o `sizeStructure` do `game-destruction`.
- Updated dependencies [5f12ff1]
  - @adatechnology/game-floorplan-structure@2.2.0

## 0.12.3

### Patch Changes

- 366aa54: A grade e o peitoril da janela não ficam mais no ar quando a parede cai. Eram desenhados soltos, sem pertencer a nenhuma peça da estrutura, e ficavam parados onde estavam. Agora são desenhados com o caixilho da janela (`window_frame:*`), que cai junto com a parede que o segura.

## 0.12.2

### Patch Changes

- 8585829: Foguete encostado num pilar corta o pilar ali, não some com ele inteiro. Antes, uma carga a menos de 35 cm de um pilar zerava os pontos de vida dele: o concreto fraturava em toda a altura, o pilar virava só a gaiola e a gaiola caía. Agora o pilar (peça longa armada) sempre guarda seu piso de pontos de vida e perde o concreto só onde a explosão alcança: uns 50 cm para um foguete de 200 kJ. A ferragem aparece ali. O concreto moldado (pilar, viga, parede de concreto) não desaba bloco a bloco sobre o vão, como a alvenaria: é uma peça só, presa pelos ferros.

  Os pilares e as vigas ganham estribos (`memberStirrups`, a cada 15 cm, NBR 6118 18.4.3), que aparecem junto com as barras onde o concreto saiu e na gaiola de uma peça descascada. A bitola das barras de pilar e viga passa de 8 para 10 mm (`MEMBER_CAGE.diameter`, mínimo da NBR 6118 18.4.2.1).

- 52b5701: O concreto de um pilar ao lado de um corte não aparece mais cheio de furos pretos. Os tijolos que o mundo tirou atrás do pilar (a parede passa por trás dele) viravam crateras desenhadas no concreto do pilar; agora a cratera fica só do lado da parede, cortada na face do pilar.
- 472516c: O pilar ao lado de um corte não aparece mais rachado ao meio. O reboco arrancado pelos dois lados do pilar deixava uma faixa fina de reboco no meio da face, desenhada como um rasgo comprido. Agora o reboco sobre o pilar sai como uma folha só quando a alvenaria o arranca nas duas bordas, e o concreto inteiro aparece embaixo. O material das unidades da brecha passa a levar também a máscara do reboco (`breachMask`), ao lado da do núcleo.
- e66c9ca: A parede não desenha mais tijolo pendurado onde a explosão levou a alvenaria. As unidades do mundo e os tijolos desenhados não têm as mesmas juntas (o mundo junta tijolos e desloca as fiadas pela amarração), e o desenho só apagava um tijolo coberto em 90% pelo buraco. Num foguete que derruba o vão entre dois pilares, isso deixava uma coluna de tijolos quebrados em fiadas alternadas junto a um dos pilares, sem nada embaixo. Agora o tijolo sai quando o mundo levou a maior parte dele e a unidade sob o seu meio.
- Updated dependencies [71c2c92]
- Updated dependencies [b7e0d7c]
- Updated dependencies [cb9cc2e]
- Updated dependencies [76e5d44]
- Updated dependencies [8585829]
- Updated dependencies [4e2d44b]
  - @adatechnology/game-destruction@0.23.0
  - @adatechnology/game-floorplan-structure@2.1.8
  - @adatechnology/game-contracts@0.32.0

## 0.12.1

### Patch Changes

- 65147e9: Friction by material and round things that roll. A piece takes the Coulomb friction of the material it stands on (its lowest part): wood 0.4/0.3, steel 0.6/0.4,
  glass 0.4/0.35, ceramic 0.5/0.4, rubber 1.0/0.8, concrete 0.7/0.6, plastic and paper 0.4/0.3, fabric and foam 0.6/0.5 (`friction.ts`, with the sources), mixed between
  two surfaces by geometric mean: on a 25 degree wooden top a wooden box slides and a steel one holds. A piece whose drawing is round about one axis (a can, a bottle, a plate on
  its edge) or all three (a ball) is `round`: lying, it touches by the lowest point of each rim across the surface under it, rolls (v = w r) and is held back by rolling
  resistance (0.015) instead of the grip that stops a box from turning; standing, its rims hold it. What lands on a piece of several parts lands on the parts (a shelf's
  boards), not on the box around them, and a piece that loses parts to a split touches the ground by what is left. The test room's tests change where the old grip hid
  the physics: the bucket thrown by a blast rolls low, under a steel sheet's 60 cm of clearance, so it is stopped by a brick column; a walk shoves the 28 kg sofa a few cm.
- Updated dependencies [82f44ab]
- Updated dependencies [99183cb]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-destruction@0.22.0
  - @adatechnology/game-floorplan-structure@2.1.7

## 0.12.0

### Minor Changes

- 3f638d6: A área Casas oferece no catálogo a mesa de jantar, a mesa de centro e a escrivaninha das plantas, cada perna e tábua uma peça: o tiro quebra a perna que acerta e a mesa tomba sobre o que sobrou (opções `furniture` e `furnitureCatalog`).

## 0.11.2

### Patch Changes

- Updated dependencies [67edc92]
  - @adatechnology/game-destruction@0.21.0
  - @adatechnology/game-floorplan-structure@2.1.6

## 0.11.1

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [a6a6a8f]
- Updated dependencies [49272b6]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-destruction@0.20.0
  - @adatechnology/game-floorplan-structure@2.1.5

## 0.11.0

### Minor Changes

- 8888b33: The outer baseboard of the houses (and of `wallPiece`) is a destructible band of glazed ceramic tiles instead of decoration: each band is a piece of its own (`baseboard:<wall>:<side>`, `ceramic`, the mass of 12 mm of tile and adhesive), laid in 0.6 m tiles as its units (`BASEBOARD_TILES`) and glued to its wall. A shot craters the tile where it lands (and the round goes on into the wall), a kick or a nearby blast cracks the glaze with the ceramic's own sound, a charge against it shatters it, and it comes off when its wall goes.

### Patch Changes

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
- Updated dependencies [a3b0fd7]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-floorplan-structure@2.1.4

## 0.10.3

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-destruction@0.18.2
  - @adatechnology/game-floorplan-structure@2.1.3

## 0.10.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1
  - @adatechnology/game-floorplan-structure@2.1.2

## 0.10.1

### Patch Changes

- Updated dependencies [dbc0ef3]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-floorplan-structure@2.1.1

## 0.10.0

### Minor Changes

- 8c11843: The first shot or blast on a wall no longer builds shader programs in play. `wallPiece` gives `warmUpProbes(THREE)`: the wall drawn with one brick shot out of it (the breach's shell and its bare bricks, instanced, lit and in the shadows), for a host to draw once at load; its `dispose` frees geometries and textures and leaves the materials to the host's warmup, which keeps the programs alive. A room's `SceneryObject` takes `warmUpProbes`, and the room draws them with its other probes; the test room passes the target wall's.
- f362db3: Structural validation and confined masonry. `validateStructure(structure, { doors, wallDetail })` and `validateSpec(spec)` return what a structure gets wrong as a real building, as typed violations with stable codes (`STRUCTURAL_VIOLATION`: load paths, NBR 6118 sections and steel, beam depth L/10, long beams on masonry, ground beam, pillars at ends, corners, junctions and every 4 m up to the bond beam, bond beam, lintel and sill beam, bonded bricks, plaster on both faces). Masonry houses on strip footings stand on reinforced concrete ground beams (`ground_beam_*`, `GROUND_BEAM_DEPTH`, anchored foundation in the spec; `groundBeams: false` leaves them out), every window gets a sill beam (`_sillbeam_`, `SILL_BEAM_DEPTH`) and lintels and sill beams bear on the jamb pillars, lintels are at least L/10 deep, wide doors get jamb pillars (`jamb_column_*`), short piers keep their jamb pillar, raised tank and balcony pillars are 0.2 m (`TANK_PILLAR_SIDE`; `visorSections: true` keeps the Visor's sections for the team's golden). The house renderer draws the pillars in the walls as structure, plastered a shade off the facade and 2.5 cm out of each face (`BuildOptions.pillars`, `'hidden'` as the Visor drew them).
- 1a5d6fc: Masonry walls stand on concrete pillars along their length, as in confined masonry: besides the corner pillars, every exterior masonry wall gets a 0.2 x 0.2 m reinforced concrete pillar at its free ends and door jambs, beside each window, where another wall meets it and at most every `WALL_PILLAR_SPACING` (4 m), from the floor to the bond beam, which rests on them (`StructureOptions.wallPillars`, `false` for the corner pillars alone; the free-standing `wallPiece` has four). The house renderer draws them under the wall's plaster: a shot or a blow that takes out the plaster and bricks next to one shows its concrete (and its bars when the concrete goes), the bricks stop at its faces, and a brick wall that falls leaves the pillars and the bond beam standing.

### Patch Changes

- fb985db: A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
- 54a1bcb: A wall that comes down after the house drew its holes no longer leaves as an invisible piece: the house renderer keeps the plain positions of the ranges it collapses (`userData.plainPositions`), and the destruction renderer draws them again when the part leaves the mesh (`showCollapsedRanges`, and `extract` for ranges of a merged mesh). The fallen wall is drawn where the world has it, so shots hit only what is drawn and its bullet marks stay on it instead of floating in the air.
- bf407ec: A reinforced member cast round its cage (a pillar or beam in concrete blocks) is cut through by a blast only at or near contact (`MEMBER_CUT_REACH`, half the breach reach); further off the blast takes the concrete it reaches out of it block by block and the cage holds it to what it rests on. The bare cage of a pillar keeps what its bars carry (`cageResidualCapacity`: perimeter bars by the steel's crushing strength, halved for buckling) instead of a flat 15%, so the end pillar of a wall stands on its cage under a light bond beam.
- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [61a4a79]
- Updated dependencies [f362db3]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [bf407ec]
- Updated dependencies [1a5d6fc]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0
  - @adatechnology/game-floorplan-structure@2.1.0

## 0.9.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.9.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-destruction@0.16.0
  - @adatechnology/game-floorplan-structure@2.0.2

## 0.9.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [11308d7]
- Updated dependencies [9314e78]
- Updated dependencies [f5cc423]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0
  - @adatechnology/game-floorplan-interactables@1.0.0
  - @adatechnology/game-floorplan-residential@6.0.1
  - @adatechnology/game-floorplan-structure@2.0.1
  - @adatechnology/game-shapes-three@0.3.1

## 0.9.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-floorplan-structure@2.0.0
  - @adatechnology/game-props3d@0.3.3
  - @adatechnology/game-floorplan-residential@6.0.0

## 0.8.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-destruction@0.13.2
  - @adatechnology/game-floorplan-structure@1.3.3

## 0.8.2

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-props3d@0.3.2

## 0.8.1

### Patch Changes

- 22d2135: Shots at the corners and ends of a wall no longer draw anything outside it. The structure's part of a wall reaches half the thickness past each end (to close a corner), and the breach view laid its bricks and bond-beam blocks on that part, so a hit near an end drew a grey block (the bond beam's concrete) and bricks up to 8 cm past the wall's edge. The units laid bare are now clipped to the box of the wall as the house drew it (`clipToBox`).

  A shot near a free side of a unit tears the corner off out to that side instead of leaving a crater inside it: the ends of the wall, its top, and the side a unit already knocked out left open, so the edge a torn corner leaves tears off in turn. How close counts grows with the round's energy (1.5 crater widths: about 11 cm for a 7.62, 7 cm for a 9 mm).

- Updated dependencies [22d2135]
  - @adatechnology/game-destruction@0.13.1

## 0.8.0

### Minor Changes

- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- 4eb330f: A shot breaks a brick or a concrete block where it lands instead of knocking the whole unit out: a crater a few centimetres across goes through the unit (about 6 cm for a pistol round, 10 for a rifle round), the rest of the unit stays, and small bits of the inside of the material fly out of both faces, most out of the far one. The rest of a unit comes out, in pieces, only once its craters took most of it. A wall, a partition or a column now loses its section across one height, so a slot shot along the base of a wall brings it down while the same rounds spread over its face leave it standing. The house renderer draws each crater as an irregular hole through the unit with the plaster broken off around it, and the marks of a shot (bullet holes, spalls) now sit on the face as drawn, not a few millimetres behind it.

  A pistol round on a plastered brick wall no longer draws a star of cracks and a flat orange disc: the plaster comes off in a ragged patch drawn by the house renderer, with the brick and its mortar under it and the bullet hole on the brick (the destruction renderer leaves its patch out on meshes marked `userData.drawnSpalls`). The destruction renderer also keeps ranges another drawing collapsed (`userData.collapsedRanges`) when it rewrites a merged mesh, so a broken wall comes back after a reset.

  The other materials take a round the same way: the concrete laid bare in a wall is one face with no joints, an opaque brittle body (a ceramic tub) cracks a hand around the hit in a dark shade of its own colour instead of black lines across the piece (glass keeps its long white cracks), and a hole in wood has a rim of torn fresh wood under it.

### Patch Changes

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
  - @adatechnology/game-floorplan-structure@1.3.2

## 0.7.0

### Minor Changes

- 2a1bb17: Wall damage stays where the shot lands. The house no longer redraws a whole wall as plain white blocks on the first brick that comes out: the wall keeps
  its geometry, plaster and paint, and is cut by a mask only where units came out, with a ragged edge of plaster and the bricks (in their mortar) or the
  rough concrete of a beam showing around the hole. Bullet holes, spalls and the impact marks of the effects go with the brick that comes out
  (`DecalPool.clearInside` in game-vfx). A bullet now wears only its stretch of a joint (`BULLET_JOINT_SPAN`), so a row of shots along a ten-metre wall no
  longer opens the whole mortar bed and brings the wall down.

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0
  - @adatechnology/game-floorplan-structure@1.3.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@5.0.0

## 0.6.0

### Minor Changes

- 2c9c963: Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.
- 31fc87d: Each material answers each kind of blow its own way. New `MaterialDef.hits` (material × damage type): what a blow tears out where it lands (`tear`: `splinters`, `lumps`, `none`) and the joules per piece. A round into wood tears splinters of fresh wood out of the exit (and back out of the entry), MDF crumbles lumps, plywood splinters; a punch crumbles MDF, a kick splinters pine, hardwood and steel tear nothing. Snapping boards (MDF, plastic) also break where they are shot. `innerColor` for wood, plywood and MDF. Cases with shelves (`furnitureSpec`) are MDF.

  Loose pieces land on what is under them: on other pieces and on the drawn meshes of fixed objects (`PieceSystemOptions.staticTopAt`), so a falling shelf rests on the books below and a tipping panel on the chair in front. New `DestructionRenderer.solidsNear` gives the drawn boxes around a point. The test room's player walks by them: steps onto low debris (up to 45 cm), stops at taller things and kicks light pieces (books, boards) out of the way, instead of the scenery's old footprints.

- 31fc87d: A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

  `DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

  The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.

  Furniture that comes apart no longer leaves anything fixed: what stayed standing becomes a piece too, and a piece whose feet are too close for its height (a lone leg, a board on two legs in a line) falls over until it lies.

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-floorplan-structure@1.3.0
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@5.0.0

## 0.5.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0
  - @adatechnology/game-floorplan-structure@1.2.3
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0
  - @adatechnology/game-floorplan-structure@1.2.2
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-destruction@0.8.2
  - @adatechnology/game-floorplan-structure@1.2.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.0

### Minor Changes

- 5b69fc2: `wallPiece` and `wallPlan`: a free-standing wall built and drawn as the walls of the houses (the houses' structure without a roof, drawn by the house renderer). `buildStructure` takes `roof: false`. The test room's target wall is now one of them.

### Patch Changes

- Updated dependencies [5b69fc2]
  - @adatechnology/game-floorplan-structure@1.2.0
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1
  - @adatechnology/game-floorplan-structure@1.1.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@3.0.0

## 0.3.0

### Minor Changes

- fa6ea00: Structure: a slab or beam is held by the sum of its supports (documented and tested: four columns share the load, each loss moves it to the rest, the
  slab falls when the capacity left is less than the load). New world option `structure: { safetyFactor }` (default 1) multiplies every load before it
  meets the capacities. `game-floorplan-three`: `SpecimenDef.sizing` (`safety`, `redundancy`, `safetyOthers`) sizes a specimen; the frame house of the
  area (`house_casa_portico`) is sized at 0.72 / 0.97 (four pillars: one lost 0.96, two lost fall), so `house_two_pillars` passes with the team's own
  sequence (two pillars) in the real room, and the extended hit sequence the module used as a workaround is gone.
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.

### Patch Changes

- dacab65: O three do núcleo é o `shapeGeometries(THREE)` do game-shapes-three: os modelos de primitiva do acumulador, as unidades da ruptura, os fragmentos, os espelhos e os espécimes da área de teste saem do game-shapes, iguais bit a bit e com cache por parâmetros entre renderizadores.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
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
- Updated dependencies [fcd0be6]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [5af569f]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-floorplan-structure@1.1.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-floorplan-residential@3.0.0
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.1

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.0

### Minor Changes

- 1cb7dc8: New package `@adatechnology/game-floorplan-interactables`: the team's `AdaptadorInterativos` ported (plan to objects of the interactables kit, wiring, gas, water, chairs, contents, doors fitted to the walls), every table a registry. `game-floorplan-three` uses it as the default of `interactives` (`adapter` still injects another, `adapterOptions` goes to `create`) and the bridge no longer misreads the plan (`floorY`, `panel`, `mats.floor`).

### Patch Changes

- Updated dependencies [1cb7dc8]
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.1.1

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2
  - @adatechnology/game-floorplan-structure@1.0.5

## 0.1.0

### Minor Changes

- bc11c7f: New package: the three.js renderer of `@adatechnology/game-floorplan` (spec 001, T2.4), a literal port of the team's `Casa3DSDK` and `AndaresSDK`. `create(THREE, options).build(plan)`
  draws walls, doors, windows, floors, slabs, stairs, roofs, gutters, lot, furniture (`game-props3d`), lights, mirrors, cars, solar panels, water and electrical. Each piece knows its vertex
  range in the merged mesh, so the house binds to the destruction of its structure (`game-destruction`, `game-destruction-three`): fracture and collapse hide the range, a masonry wall that reaches
  stage 2 is drawn again as instanced brick courses at LOD 0, and the renderer adds the spall decal and the rebar cage. `createFloorNavigator` is the AndaresSDK (10 cm grid per floor, stairs, occlusion),
  with `navigationDefOf` and `bindNavigator` to register a built house and follow its destruction. The scene equals the page's, node by node, for six plans (golden `vc3-house-scene.json`), and `planLod`
  gives the same levels. Fleet, interactables, vegetation and the mirror's `Reflector` are injected; texts come from `locales` (`en`, `pt-BR`); global `GameFloorplanThree`.
- 4c38dd2: Módulo de teste da casa para a sala de testes (`createFloorplanTestModule`): escolha de pacote, tipologia, semente e estado, casas construídas no mundo de destruição da sala, paredes que barram o jogador, porta com E, andares, nível de detalhe por orçamento, golpes pela bancada e os seis cenários estruturais do time mais um de tipologias.

### Patch Changes

- aa2bc27: The structure spec the house registers in the destruction world keeps what the pieces carry: the water tank holds its 500 L (so a hole leaks) and the gas cylinder explodes; the thin wall (`thickness`, `fill`) and the tags of each come along, so a 9 mm round goes through the tank.
- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-floorplan-structure@1.0.4
