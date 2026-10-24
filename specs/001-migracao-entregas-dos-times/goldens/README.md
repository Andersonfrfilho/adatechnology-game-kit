# Goldens gravados das páginas dos times (staging)

Gravados por `tools/golden/bin/record.mjs` a partir de `artefatos/site__*.html` (cópias das páginas do repositório `Andersonfrfilho/zombiada`,
`site/pages/`, mesma versão das fontes em `sources/`). Cada arquivo fica aqui até o pacote que o consome existir; depois a task do pacote
**move** o arquivo para `packages/<pacote>/tests/fixtures/team-golden/`. Os goldens das plantas já estão em
`packages/game-floorplan/tests/fixtures/team-golden/`.

| Arquivo | Consumidor | Comando (na raiz, depois de `pnpm build`) |
|---|---|---|
| `vc3-structure.json` | `game-floorplan-structure` (T2.2c, `coarse`) | `node tools/golden/bin/record.mjs --page specs/001-migracao-entregas-dos-times/artefatos/site__visor-casas-3d.html --capture tools/golden/captures/floorplan-structure.js --out specs/001-migracao-entregas-dos-times/goldens/vc3-structure.json --ready "typeof PlantasSDK !== 'undefined'" --timeout-ms 900000` |
| `vc3-structure-detail.json` | mesma (leitura humana: JSON de cada peça, semente 1, estado normal) | o de cima com `--param seedTo=1 --param states=normal --param rows=1` |
| `house-area.json` | `game-destruction` / `examples/floorplan-test-area` (T2.3b, T2.6a): eventos do mundo dos 6 cenários do AC | `... --page .../site__area-casas.html --capture tools/golden/captures/house-area.js --ready "window.__testRoom"` |
| `gallery-silhouettes.json` | `game-floorplan-three` `lod/silhouettes` (T2.5a) | `... --page .../site__galeria-vale-cinzento.html --capture tools/golden/captures/gallery-silhouettes.js --expose rng,R,root,sobrado,laje,colonial,chalet,companyHouse,stilt,farmhouse,house,building --ready "globalThis.GoldenExposed && typeof GoldenExposed.sobrado === 'function'"` |
| `../packages/game-floorplan/tests/fixtures/team-golden/vc3-plans.json` | `game-floorplan` `tests/team-golden-vc3.test.ts` | `... --capture tools/golden/captures/floorplan-plans.js --out packages/game-floorplan/tests/fixtures/team-golden/vc3-plans.json` (`-detail`: `--param seedTo=1 --param rows=1`) |

Cada gravação foi repetida e saiu idêntica byte a byte. O golden de estrutura guarda um hash por lista (peças, apoios, partes e juntas do
`specDe` coarse e `vedacao`) e um por instalação; o `-detail` traz o JSON canônico das peças da semente 1 para ler a diferença.
