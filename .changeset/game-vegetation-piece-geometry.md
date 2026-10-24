---
'@adatechnology/game-vegetation': minor
---

Geometria das peças de madeira (spec 001, T7.2a, V8 do Viveiro): `PlantPiece`, `LotPiece` e `userData.destructionPart` ganham `radius`, `length`, `axis` e `base` nos troncos, galhos, caules, braços e raquetes, para a regra de corte saber a grossura, o comprimento e o rumo; `ctx.pieceGeom` deixa o arquétipo dar o seu. Confere com o bundle do artefato do Viveiro em 8 espécies e 5 sementes (`comparacoes/vegetacao/`).
