# Migração para TypeScript: o que já foi feito

Levantamento na main em 2026-11-03. Atualize ao terminar cada passo (CLAUDE.md, seção 8).

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
- [ ] `game-floorplan-three`: `strict: false` e `noImplicitAny: false` no tsconfig (536 `any`)
- [ ] `game-characters-three`: 8 arquivos com `// @ts-nocheck` (`rich/person-kit.ts`, `rich/person-builder.ts`, `rich/best-builder.ts` e 5 em `rich/accessories/`)
- [ ] `game-shapes`: `primitives/earcut.ts` com `// @ts-nocheck` (código de terceiros portado)

### `any` explícito: 4.979 em 240 arquivos (src, testes e tools), contados em `eslint-suppressions.json`
Contratos primeiro, depois quem os outros importam, e os grandes por último, um PR por pacote:
- [x] Contratos: `game-contracts` 3 (registros de tipos heterogêneos, como compositores, geradores e postes, usam a forma de método, sem `any`)
- [x] Pequenos: `game-devtools` 5, `game-destruction` 2, `game-destruction-three` 4, `game-shapes` 2, `game-shapes-three` 7, `game-urban` 8, `game-vehicles-driving` 2, e 1 cada em `game-props3d`, `game-stories`, `game-vegetation`
- [x] `game-floorplan`: `Json` virou `unknown`; a planta (portas, paredes, janelas, portões, caminhos, lote, fachada), os slots, a grade de circulação e o resultado do `generate` (`FloorplanResult`) têm tipo próprio. Residential, rural, commercial, post-apocalyptic e structure ajustados ao resultado tipado
- [x] `game-floorplan-structure`: `Json = unknown`; instalações (luz, gás, água, solar, edícula) com tipos próprios exportados; `src` sem `any` (os que sobram estão nos testes)
- [x] `game-floorplan-interactables`: `Json = unknown`; o adaptador usa os tipos reais do kit (`World`, `ObjectSpec`, `HouseholdItem`) e exporta o plano tipado (`AdapterPlan`, `PlanEntry`); `src` sem `any`
- [ ] Casas, `any` que sobram (só nos testes, menos o post-apocalyptic): `game-floorplan-residential` 12, `game-floorplan-commercial` 13, `game-floorplan-interactables` 29, `game-floorplan-structure` 85, `game-floorplan-post-apocalyptic` 125
- [ ] `game-floorplan-three` 536 (junto com ligar o strict)
- [ ] Adaptadores three (`type Three = any` em `game-urban-three` e `game-vegetation-three` vira o namespace tipado do three): `game-interactables-three` 31, `game-vegetation-three` 40, `game-urban-three` 62, `game-characters-three` 66, `game-vehicles-three` 75
- [ ] Veículos: `game-vehicles` 1.584 e `game-vehicles-fleet` 2.247 (depois que os PRs de física dos carros entrarem)
- [ ] `tools/`: `vehicles-catalog` 14, `characters-catalog` 1, `golden` 1

### Fora dos pacotes, ainda em JavaScript
- [ ] `examples/*`: 17 salas de teste, todas em `.js` (`test-room` tem 10 arquivos, as outras 3 a 5)
- [ ] `tools/`: 40 arquivos `.js`/`.mjs`
- [ ] `site/`: 4 arquivos `.js`

### Regras
- [x] Regra "tudo tipado" no `CLAUDE.md` (seção 8)
- [x] `any` novo barrado pelo lint (contagem por arquivo em `eslint-suppressions.json`), `strict: false` e `@ts-nocheck` novos barrados pelo `pnpm check:packages`
