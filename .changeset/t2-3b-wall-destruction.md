---
'@adatechnology/game-destruction': minor
---

Paredes em camadas, estágios e armadura. Registro de montagens (`ASSEMBLIES`, `registerAssembly`, `assemblyPart`) com as 8 paredes de medida real (tijolo rebocado, bloco, concreto armado, drywall, madeira, tronco, chapa e vidro). Penetração soma `penetration x espessura` de cada camada, a camada de fora lasca primeiro (`spall`). Estágios 0 a 3 com brecha (0,25 m² dentro de 0,55 m: fragmentos do tamanho da peça, abertura, a peça fica; `stage`), gaiola de armadura (`expose`, `stripped`, capacidade residual, colapso progressivo por sobrecarga, corte com maçarico ou serra) e furos que ficam nos fragmentos (`Fragment.marks`). `sizeStructure` ganha `redundancyRoles` e `safetyByRole`. `DestructionOptions.breach` (`radius`, `blastFactor`). Goldens próprios em Node 22 e 24 (`@adatechnology/golden-tool` como devDependency).
