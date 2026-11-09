---
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-test-room': patch
---

Oclusão de áudio sem travar o quadro da primeira explosão.

- `OcclusionSetup.budgetMs` (padrão 1 ms, em `OCCLUSION_DEFAULTS`) e `clock`: uma voz nova só é medida no `add`/`attach` quando o custo corrente de uma consulta (média móvel: metade da última, metade do que veio antes) cabe no tempo que resta ao quadro, então uma consulta cara (veículo no caminho) nunca roda ali; passou do orçamento, começa pela estimativa (voz medida vizinha, último resultado do ponto ou sem oclusão) sem consultar, e os `update` seguintes medem as que esperam dentro do orçamento (ao menos uma por quadro) e deslizam até a medida. A voz medida depois fica no valor exato da medida, igual à medida na hora.
- `DestructionWorld.raycast(origin, direction, maxDistance?, options?)` com `RaycastOptions`: `skipLoose` deixa de fora as peças que o `splitGroup` cortou (também depois de `serialize`/`load`); a parte que caiu mas ainda é do objeto (`collapsed`) continua contando; `minObjectRadius` deixa de fora objetos pequenos. Sem opções, nada muda.
- `createWorldOcclusion` da sala passa a ignorar peças soltas e objetos com raio menor que `OCCLUDER_MIN_RADIUS` (0,25 m, abaixo do comprimento de onda de 0,69 m da banda de 500 Hz da tabela de perda): parede, piso, porta e móvel em pé continuam ocluindo com a mesma perda.
