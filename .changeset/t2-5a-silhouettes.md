---
'@adatechnology/game-floorplan': minor
---

Silhuetas de longe (LOD) como dados de geometria, sem three (spec 001, T2.5a): `createTwoStoreyHouse`, `createSlabHouse`, `createColonialHouse`, `createChalet`, `createCompanyHouse`, `createStiltHouse`, `createFarmhouse`, `createDetachedHouse` e `createCityBuilding` devolvem as peças (caixa arredondada, prisma, cilindro, linha, placa), as janelas e a pegada de cada tipologia da Galeria do Vale Cinzento, com o mesmo gerador semeado da página. Os 16 casos conferem com o golden da galeria (hash de cena, Node 22 e 24). A cerca da casa de empresa acompanha a casa (a página a deixa na origem).
