# 12. Objetos quebrados: nada flutua, nada invisível colide — **OBRIGATÓRIO**

Texto completo da seção 12 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-11-04, depois de latinhas paradas no ar sobre uma mesa caída e de um tampo de mesa preso no ar sobre uma perna só
("isso é crítico, nunca pode acontecer").

- **Nada quebrado fica parado no ar.** O que sobrou de um objeto que se apoiava em algo e perdeu o apoio vira corpo rígido dinâmico. Ele se
  apoia nos cantos de cada parte que restou (`contacts` da peça), não na caixa do objeto inteiro, e tomba quando o centro de massa sai do
  apoio: com uma perna só, sempre tomba; com as duas pernas de um lado, gira até o tampo bater no chão. Vale para móvel, item, suporte e carro.
  Estrutura (`structure`, `room`, `ground`) segue o caminho de carga do `game-floorplan-structure`. O que é pendurado (armário de parede,
  luminária) é segurado por onde está pendurado.
- **O que estava em cima cai junto.** A peça que dorme confere o próprio apoio (algumas por quadro, em rodízio) e acorda quando o apoio some.
  Também acorda no mesmo quadro em que o apoio começa a se mexer. Nunca é teletransportada: cai pela física.
  O contato segue a superfície do apoio: a normal é a da face do tampo inclinado, e o atrito é de Coulomb, estático enquanto o
  ponto segura e dinâmico enquanto escorrega. Passou de `atan(μ)`, o item escorrega para o lado que tombou.
- **Nenhum colisor sem geometria.** A colisão de um objeto quebrado é medida de novo a partir do que ainda está desenhado
  (`DestructionRenderer.shownBoxes`, por parte). A sala de teste mede o jogador contra essas caixas, nunca contra a caixa do objeto inteiro
  nem contra a pegada antiga. Cada destroço é uma peça com a própria caixa, que acompanha o corpo.
- **Nenhuma caixa guarda ar.** Uma peça desenhada em volta do ar (casinha, armário, banco de pernas) nunca colide como a caixa em volta de tudo: a lasca
  que nasce dentro de um sólido não para nunca, e o que cai em cima fica apoiado no nada. A peça feita pelo mesh api colide pelos **sólidos que o
  construtor desenhou** (`userData.solids`, spec 019), fixa e solta, sem ler vértice. Construtor novo entrega os sólidos; quem ainda adivinha pela malha
  (casa, veículo, catálogo antigo de móveis) é dívida contada no `hollow-catalogue.test.ts`, que só diminui. Guardas: `solids-catalogue.test.ts` (CI, todo o
  catálogo), `hollow-catalogue.test.ts` (CI) e `examples/test-room/hollow-test.mjs` (sala, fora do CI por §9, lista de dívida vazia).
- **Invariante em tempo de execução.** Depois de cada quebra, o renderer confere o objeto no update seguinte (`onBrokenChecked`). Se achar o que
  sobrou dele sem apoio, solta na hora. A sala registra a falha no log (`check`/`fail`, `invariant: broken_floating`): é bug de quem deveria ter
  soltado antes.
- **Teste de catálogo no CI** (`game-floorplan-three/tests/broken-catalogue.test.ts`, sem GPU): todo móvel do catálogo tem as pernas quebradas, e
  depois (1) nada parado fica sem apoio e (2) o raio que passa onde estava cada perna quebrada só encontra o que está desenhado. Peça nova entra
  no catálogo e passa por esse teste.
- **Nenhuma regra do kit gira uma peça.** O empurrão que o kit dá por conta própria (começar o tombo do que ficou sem pé, acabar com o equilíbrio numa
  beirada) só começa a queda: o peso faz o resto. O teste `game-floorplan-three/tests/broken-catalogue-spin.test.ts` (CI, sem GPU) solta cada móvel do
  catálogo como a sala solta, quebra as partes uma a uma do chão para cima (a perna, depois o que ela segurava, como os tiros fazem) e mede o canto mais
  rápido de toda peça que estava parada: nos passos logo depois da quebra ele não ganha mais de 4,5 m/s. Roda em cinco tamanhos (o do catálogo, três vezes
  mais comprido, três vezes mais fundo, três vezes mais alto e tudo a um terço), porque o defeito cresce com a proporção da peça: a mesa de 4,4 m da sala girava a 19,5 rad/s e a do catálogo,
  de 2 m, mal passava do limite. Peça nova entra no catálogo e passa por esse teste nos cinco tamanhos.
- **Destroço de qualquer comprimento deita e fica.** O pedaço que sobra de uma quebra (lasca, toco, meia tábua, tábua inteira) cai, deita no chão ou em cima de
  outro e para: não fica em pé na ponta, não sobe e não continua se mexendo. O teste `game-destruction-three/tests/long-debris-settles.test.ts` (CI) solta
  pedaços de 10 cm a 4,2 m, em três seções (tábua, ripa, viga), deitados e inclinados até 80°, com giro, uns por cima dos outros: nenhum sobe mais de 30 cm
  acima de onde quebrou, nenhum termina a mais de 45° nem com o meio a mais de 50 cm, e 12 s depois nenhum se mexe. O mesmo vale para o destroço que o próprio
  núcleo corta e lança: tampos de 0,5, 1,5, 3 e 4,4 m quebrados a tiro pelo mundo de destruição (`a table top shot apart by the world itself`). Regra de física nova no sistema de estilhaços é escrita pela velocidade da ponta (m/s), nunca em rad/s
  fixo: o que serve para uma lasca de 5 cm joga uma tábua de 4 m para cima.
- **Tudo que quebra sossega.** O teste `game-floorplan-three/tests/broken-catalogue-settles.test.ts` (CI) quebra cada móvel do catálogo até o fim, parte por
  parte, e 8 s depois confere que nada solto ainda se mexe, nem destroço nem peça. O que já falhava quando o teste foi escrito está contado em `KNOWN` (14
  móveis em 2026-11-28, 9 depois da spec 020: 7 com lasca pequena que não para, `shower` e `shower_large` com peça que não para), e essa lista só diminui: peça nova não
  entra nela, peça consertada sai.
- **O destroço grande é corpo rígido** (spec 020). O que sobra de uma quebra com 20 cm ou mais (`isBig`) e toda barra de armadura é movido por um corpo do
  motor na camada `rubble`: cai, apoia e deita como toda peça, encontrando o mundo fixo e outro destroço. A física leve do `FragmentSystem` fica só com a
  lasca. Ele não encosta em peça solta, pessoa ou carro (dívida declarada na spec). Regra nova de movimento para pedaço grande não se escreve no
  `FragmentSystem`.
