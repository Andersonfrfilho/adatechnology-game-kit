---
'@adatechnology/game-contracts': minor
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-urban': minor
'@adatechnology/game-urban-three': patch
'@adatechnology/game-floorplan-three': patch
---

A chuva não passa por nada que tenha teto. Além das casas, agora alimentam o `RainCover` do host: os carros, ônibus e caminhões (`createVehicleRainCover` em `game-vehicles`, a cabine do `cabinEnclosure` mais o teto e as janelas que sobraram; caçamba aberta, moto, barco, avião, helicóptero e trator ficam descobertos; teto arrancado, para-brisa quebrado ou furo de 30 cm ou mais deixam a chuva entrar; o carro em movimento só gira o retângulo e a versão só sobe a cada 1 m ou 5 graus, `createVehicleRainCovers` em `game-vehicles-three` liga isso ao host), os prédios, torres de vigia, contêineres e barracas do `game-urban` (`builder.covers`, fora de `scene()`, então nada do que é desenhado muda; a área de teste e o distrito de referência alimentam o host) e, nas casas, a edícula, a sauna, a casinha de cachorro e o banheiro externo do lote (`createItemRainCover`). O `game-contracts` ganha `createFootprintRainCover` (retângulos girados que se movem) e `createFixedFootprintRainCover` (retângulos fixos respondidos por uma grade). Copas de árvore não seguram a chuva.
