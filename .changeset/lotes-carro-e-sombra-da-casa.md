---
'@adatechnology/game-render-three': minor
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-floorplan-three': minor
---

Menos chamadas de desenho nos piores quadros da explosão da casa, sem mudar o que aparece na tela.

- `createStaticBatcher` ganhou `shadowOnly`: as malhas continuam desenhadas sozinhas para a câmera e deixam de projetar sombra enquanto estão no lote; cada lote (só posições, um por lado que o passe de profundidade desenha) entra só no mapa de sombra. Malha com sombra que depende do material (recorte por mapa, planos de corte, deslocamento, material de profundidade próprio) continua projetando a própria. A malha que muda volta a projetar a própria sombra, do formato novo, no quadro em que muda. `maxVertices` divide um grupo grande em lotes menores, para cada um caber num quadro do orçamento.
- Casa (`game-floorplan-three`): as peças paradas projetam a sombra de poucos lotes só de sombra (`createHouseShadowBatches`, ligado por padrão em `house.update`; `shadowBatches: false` desliga, e `?shadowBatches=0` na sala compara). Na sala, a sombra da estrutura caiu de 231 para 16 chamadas por quadro. Quando um quarto das peças volta a projetar sozinha (explosão, corte de andar), os lotes são refeitos do que ficou de pé depois de 2 s sem mudança.
- Veículo atingido (`game-vehicles-three`): as peças paradas entram em lote logo no golpe, em pedaços de até 16k vértices, e só as que mudam saem; as que saíram voltam a um lote novo, no formato amassado, depois de 1,5 s sem mudança. Antes, o carro esperava 1,5 s desenhando peça por peça (~620 chamadas por quadro, com sombra) e depois juntava tudo de uma vez (16 a 22 ms num quadro). No sedã a 60 quadros por segundo: de 95 quadros acima de 300 chamadas para ~10, nenhuma atualização acima de ~6 ms, e 70 + 37 de sombra no fim (eram 67 + 34).
