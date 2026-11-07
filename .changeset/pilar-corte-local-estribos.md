---
'@adatechnology/game-destruction': patch
'@adatechnology/game-floorplan-structure': patch
'@adatechnology/game-floorplan-three': patch
---

Foguete encostado num pilar corta o pilar ali, não some com ele inteiro. Antes, uma carga a menos de 35 cm de um pilar zerava os pontos de vida dele: o concreto fraturava em toda a altura, o pilar virava só a gaiola e a gaiola caía. Agora o pilar (peça longa armada) sempre guarda seu piso de pontos de vida e perde o concreto só onde a explosão alcança: uns 50 cm para um foguete de 200 kJ. A ferragem aparece ali. O concreto moldado (pilar, viga, parede de concreto) não desaba bloco a bloco sobre o vão, como a alvenaria: é uma peça só, presa pelos ferros.

Os pilares e as vigas ganham estribos (`memberStirrups`, a cada 15 cm, NBR 6118 18.4.3), que aparecem junto com as barras onde o concreto saiu e na gaiola de uma peça descascada. A bitola das barras de pilar e viga passa de 8 para 10 mm (`MEMBER_CAGE.diameter`, mínimo da NBR 6118 18.4.2.1).
