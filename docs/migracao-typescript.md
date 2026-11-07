# Migração para TypeScript: o que já foi feito

Levantamento na main em 2026-11-03, atualizado em 2026-11-06. Atualize ao terminar cada passo (CLAUDE.md, seção 8).

## Já migrado

- [x] Todos os 56 pacotes de `packages/*` têm o `src` em `.ts` (nenhum `.js` sobrou)
- [x] `tsconfig.base.json` com `strict: true`, herdado por cada pacote
- [x] Script `typecheck` (`tsc --noEmit`) em todos os pacotes
- [x] Job `typecheck` no CI (`.github/workflows/ci.yml`)
- [x] Typecheck no pre-push (`.githooks/pre-push`)
- [x] `test-support/` em `.ts`
- [x] `tools/`: 177 arquivos `.ts`

## Falta tipar de verdade

### Pacotes com o strict desligado ou contornado
- [x] `game-floorplan-three`: strict ligado (o tsconfig só herda o `tsconfig.base.json`), `STRICT_OFF_KNOWN` vazio
- [x] `game-characters-three`: 8 arquivos com `// @ts-nocheck` (`rich/person-kit.ts`, `rich/person-builder.ts`, `rich/best-builder.ts` e 5 em `rich/accessories/`)
- [x] `game-shapes`: `primitives/earcut.ts` tipado (a cópia do Earcut do three com tipos; a lógica igual, a triangulação continua batendo com a do three)

### `any` explícito: de 4.979 em 240 arquivos para 28 em 3 (só a API de extensão do `game-vehicles`), contados em `eslint-suppressions.json`
Contratos primeiro, depois quem os outros importam, e os grandes por último, um PR por pacote:
- [x] Contratos: `game-contracts` 3 (registros de tipos heterogêneos, como compositores, geradores e postes, usam a forma de método, sem `any`)
- [x] Pequenos: `game-devtools` 5, `game-destruction` 2, `game-destruction-three` 4, `game-shapes` 2, `game-shapes-three` 7, `game-urban` 8, `game-vehicles-driving` 2, e 1 cada em `game-props3d`, `game-stories`, `game-vegetation`
- [x] `game-floorplan`: `Json` virou `unknown`; a planta (portas, paredes, janelas, portões, caminhos, lote, fachada), os slots, a grade de circulação e o resultado do `generate` (`FloorplanResult`) têm tipo próprio. Residential, rural, commercial, post-apocalyptic e structure ajustados ao resultado tipado
- [x] `game-floorplan-structure`: `Json = unknown`; instalações (luz, gás, água, solar, edícula) com tipos próprios exportados; `src` sem `any` (os que sobram estão nos testes)
- [x] `game-floorplan-interactables`: `Json = unknown`; o adaptador usa os tipos reais do kit (`World`, `ObjectSpec`, `HouseholdItem`) e exporta o plano tipado (`AdapterPlan`, `PlanEntry`); `src` sem `any`
- [x] Casas: `game-floorplan-residential`, `-commercial`, `-interactables`, `-structure` e `-post-apocalyptic` sem `any` (src e testes)
- [x] `game-floorplan-three` 536 → 0, com o strict ligado: o kernel sem a assinatura `any` (o que nenhum módulo declara é `unknown`), a destruição da casa com tipos próprios (`HouseStructure`, `HouseDestruction`, `BreachView` em `src/destruction/types.ts`), a brecha com a vista de parede tipada, e os testes
- [x] Adaptadores three: `game-interactables-three` 31, `game-vegetation-three` 40, `game-urban-three` 62 (o `type Three = any` virou `typeof THREE`)
- [x] `game-characters-three` sem `any`
- [x] `game-vehicles-three` sem `any`: o módulo da área usa `typeof THREE` e os tipos do three (o `MistThree` do para-brisa embaçado aceita o `Side` do three)
- [x] `game-vehicles`: 1.584 → 29. `src` e testes sem `any`; as referências de vinco e corte dos testes perderam o `eslint-disable` e ganharam tipos. Sobram os `[key: string]: any` de extensão da API pública (`api.ts` 26, `BuildContext` e `Kit` 1 cada), que só saem depois da frota tipada, porque a frota escreve campos livres neles
- [x] `game-vehicles-fleet` 2.247 → 0: os kits compartilhados (`createWaterAirKit`, `createPlanesKit`) com tipo próprio, as opções de cada peça (casco, hélice, rotor, cabine, torre, guidão, chassi) como interfaces, e os testes
- [ ] `game-vehicles` 28: os `[key: string]: any` de extensão da API pública (`api.ts` 26, `BuildContext` e `Kit` 1 cada). Trocar por `unknown` dá uns 2.600 erros na frota, que lê esses campos livres: vira um PR próprio, que declara cada campo
- Achados tipando o `game-vehicles` (corrigidos): `zoneDamageAt` devolve `{ main, list }` e `zonePoint` recebe o lado e devolve `{ p, dir }`, mas a API pública dizia outra coisa; `locate` e `partOfSurface` recebiam o ponto como número; o giro do `fling` era tipado como número; `broken` das lanternas também vale `'gone'`
- Achados tipando a frota (fechados): o `fogLamp` dos carros extras recebe o ponto da superfície (`SurfHit`) em todas as chamadas; `LampSpec.wrap` é tipado como comprimento (`number`); o `Gd.ux ? 0.5 : 0.5` da viatura da PM virou `Gd.at(0.5, …)`, que é o que a conta queria: o meio da grade da porta (x = −0,32 m), onde o texto é escrito, e de onde só se lê a profundidade da lataria
- [x] `tools/`: `vehicles-catalog`, `characters-catalog`, `compat-check` e `golden` sem `any` (os documentos falsos, o digest da frota, a frota leve e o snapshot exato com tipos estruturais)

### Fora dos pacotes, em JavaScript com JSDoc
- [x] Os 135 scripts de `examples/`, `tools/` e `site/` checados strict pelo `tsconfig.scripts.json` (CI: `pnpm typecheck:scripts`). A lista
  `tsconfig.scripts.checked.json` saiu: o check pega o `include` inteiro, então um script novo já entra checado.
- [x] O que cada página de teste põe no `window` para os scripts (sala, relatórios das áreas, showroom, sondas de som, perf, auditoria) tem tipo em
  `types/scripts-globals.d.ts`; a página que atribui e o script que lê quebram juntos
- Achados tipando os scripts (corrigidos no #213): os kits de veículo das áreas urbana e de clima recebiam `room.vfx` (o mundo de efeitos,
  `play(id, ponto)`) onde esperam um `EffectSink` (`play(pedido)`), e a fumaça, a poeira e o fogo desses carros sumiam (agora recebem `room.effects`);
  o `perf.mjs` lia `room.tool.id`, que não existe (é `def.id`), e o aviso de arma errada nunca disparava; o teste da área de móveis contava peças
  `'detached'`, que não é um status de peça
- Achados tipando o áudio (fechados): `createAudioEngine({ createContext })` aceita qualquer `BaseAudioContext`, e o `OfflineAudioContext` do
  `body-reel` e das medições C1–C10 entra sem cast; `unlockContext` e o `dispose` só retomam e fecham um contexto ao vivo (`isLiveContext`). O JSDoc do
  `loadContent` das histórias já aceitava texto ou objeto

### Regras
- [x] Regra "tudo tipado" no `CLAUDE.md` (seção 8)
- [x] `any` novo barrado pelo lint (contagem por arquivo em `eslint-suppressions.json`), `strict: false` e `@ts-nocheck` novos barrados pelo `pnpm check:packages`
