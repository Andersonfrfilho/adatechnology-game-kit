---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-floorplan-three': minor
---

Os canos de saída da casa (esgoto de vaso, chuveiro, pias, cozinha e área de serviço, e as descidas da calha) viram peças de destruição, e um furo de explosão na parede ou na laje por onde passam os expõe.

`game-contracts`: `PartSpec.hostedIn` (a peça está embutida, ou presa, em outra), `PartState.exposed` e o evento `reveal`.

`game-destruction`: uma peça com `hostedIn` que fica inteira dentro da caixa do hospedeiro não toma a onda da explosão nem tem a junta afrouxada pelo choque enquanto o hospedeiro está de pé. Quando um furo do hospedeiro (abertura, tijolos arrancados, ou o hospedeiro perdido) alcança a peça, ela aparece (`reveal`, `exposed`) e a junta com o hospedeiro abre: só o trecho dentro ou cruzando o furo se solta, o resto do traçado fica onde está, e um trecho preso pelos vizinhos fica pendurado no furo.

`game-floorplan-three`: `utilities/drains.ts` põe cada dreno de aparelho dentro da parede mais próxima, descendo pela laje até o pé da parede do térreo, em trechos cortados por `cutRun`, escondidos enquanto embutidos e presos pelo sólido onde estão. As descidas da calha saem em trechos entre as braçadeiras, presos à parede. A cena do time (`visor*`) não os desenha. O trecho de laje que só tinha a laje inteira como apoio agora se apoia no painel dela (o apoio se perdia quando a laje virava painéis).
