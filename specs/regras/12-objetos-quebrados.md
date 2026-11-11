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
- **Invariante em tempo de execução.** Depois de cada quebra, o renderer confere o objeto no update seguinte (`onBrokenChecked`). Se achar o que
  sobrou dele sem apoio, solta na hora. A sala registra a falha no log (`check`/`fail`, `invariant: broken_floating`): é bug de quem deveria ter
  soltado antes.
- **Teste de catálogo no CI** (`game-floorplan-three/tests/broken-catalogue.test.ts`, sem GPU): todo móvel do catálogo tem as pernas quebradas, e
  depois (1) nada parado fica sem apoio e (2) o raio que passa onde estava cada perna quebrada só encontra o que está desenhado. Peça nova entra
  no catálogo e passa por esse teste.
