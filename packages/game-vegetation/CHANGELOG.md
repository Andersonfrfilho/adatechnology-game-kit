# @adatechnology/game-vegetation

## 0.2.0

### Minor Changes

- 0b3c030: Geometria das peças de madeira (spec 001, T7.2a, V8 do Viveiro): `PlantPiece`, `LotPiece` e `userData.destructionPart` ganham `radius`, `length`, `axis` e `base` nos troncos, galhos, caules, braços e raquetes, para a regra de corte saber a grossura, o comprimento e o rumo; `ctx.pieceGeom` deixa o arquétipo dar o seu. Confere com o bundle do artefato do Viveiro em 8 espécies e 5 sementes (`comparacoes/vegetacao/`).

## 0.1.0

### Minor Changes

- 13c8e6d: Initial release (0.1.0): deterministic procedural low-poly vegetation (15 archetypes, 3 LODs, conditions and seasons, scatter and lot merging, optional three.js adapter with shader wind and actor bend) plus a JSON pack of 71 species with en / pt-BR names and regional planting tables.
