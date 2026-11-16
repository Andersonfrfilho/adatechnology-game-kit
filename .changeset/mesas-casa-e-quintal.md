---
'@adatechnology/game-test-room': minor
'@adatechnology/game-contracts': minor
---

`room.measure(itemId)`: largura, profundidade e altura do modelo de um item do catálogo na rotação 0 (null para um id que o catálogo não tem), a mesma medida que a mesa de testes usa para as fileiras. Serve à área que põe lado a lado peças de vários módulos, como a casa e o quintal nas mesas da sala (`?area=house_tables`).

`AreaPlacement.fixed`: a peça fica presa onde a área a pôs, sem física própria, seja qual for o item (um armário aéreo pendurado na parede, que solto no chão cai). Continua tomando tiro e quebrando; o que se solta dela cai.
