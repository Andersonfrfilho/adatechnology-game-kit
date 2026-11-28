# 021 — Ponto único para as regras do kit, medido pela régua de energia

**Dono:** Anderson · **Aberta em:** 2026-11-28 · **Regras:** CLAUDE.md §12 (objetos quebrados), §15 (quadro), §3 · **Origem:** `docs/analise-arquitetura-e-validacao-2026-11.md` §10.4, item 4

## Problema

Em dois dias o dono achou à mão três causas do "mesmo" defeito (peça girando, tábua em pé). Duas eram regras do próprio kit criando energia: o empurrão de
`goOverIfBalanced` com o braço errado (19,5 rad/s num quadro, #610) e constantes em rad/s que não escalam. Cada regra empurrava a peça por um caminho diferente
(`pieceSys.impulse`, giro escrito direto, aceleração somada no motor) e nada media o que ela dava.

## O que muda

1. **Ponto único.** Toda escrita de velocidade que uma regra do kit faz numa peça por conta própria passa por um ponto com o nome da regra:
   `PieceSystem.ruleImpulse(rule, ...)`, `PieceSystem.ruleSpin(rule, ...)` e, no motor, `KitEnergyLedger.begin/end` em volta da escrita do `topple`.
   As regras ligadas: `goOverIfBalanced`, `checkUndermined`, `loosenIfFootless` (`EDGE_NUDGE`) e `topple` (`KIT_RULE`). Tiro, explosão e contato do motor
   não passam por ele.
2. **Régua.** `KitEnergyLedger` (`game-destruction-three/src/kit-energy.ts`) mede a energia cinética antes e depois de cada escrita (a escrita é
   instantânea: gravidade e contato não agem nela) e soma, por peça e por regra, o que a regra deu desde que a peça estava parada (um episódio).
3. **Limite derivado, não chutado.** Uma regra que só começa uma queda não pode dar mais do que o peso da própria peça liberaria:
   `m g (altura do centro de massa sobre o canto mais baixo - a menor altura em que ele pode ficar deitado ali)`, pela caixa da peça girada como está
   e com o peso onde as partes o põem (`massCentre`) (`fallEnergyOf`). A resolução da régua é 1 mm de altura de energia (`KIT_ENERGY_RESOLUTION`, o
   mesmo 1 mm do `C1_ALLOWANCE` da régua da spec 008): é também o limiar de "parada". Nada é cortado: o que passa é contado
   (`renderer.kitEnergy()`, por regra: escritas, episódios acima, pior fração e qual) e avisado (`RendererOptions.onKitEnergy`).
4. **Sala.** `game-kit-defaults` repassa o aviso como evento `kitEnergy`; a sala registra `check`/`fail` com `invariant: kit_energy`, o nome da regra,
   o que deu e a queda (`game-test-room/src/invariant-log.ts`, que também passa a registrar o `broken_floating`; `room.ts` não cresce).
5. **Teste `kit-energy`.** Móveis de pé (mesa, a mesa de 4,4 × 0,46 m da sala, cama, banco de 3 pés, bancada de 6 pés, estante) nos cinco tamanhos da
   varredura de escala (`broken-catalogue-spin`), em três cenários: peça perdendo os pés um a um, de pé perdendo um pé, de pé perdendo o chão sob um pé.
   Nenhuma regra dá mais que a queda; toda regra ligada é exercitada em todo tamanho.

## Critérios de aceite

- **A1** `pnpm --filter @adatechnology/game-destruction-three test -- kit-energy` passa.
- **A2** Revertendo a correção do #610 (`reachAlong` → maior meia-medida) o mesmo comando reprova nos cinco tamanhos e a mensagem começa por
  `goOverIfBalanced`.
- **A3** As guardas não mudam de limite e seguem verdes: `long-debris-settles`; em `game-floorplan-three`, `broken-catalogue`, `-spin`, `-settles`,
  `destruction-pieces-never-rise`, `furniture-laid-still`, `exact-golden`; em `game-test-room`, `step-equivalence` e `room`.
- **A4** `wc -l packages/game-test-room/src/room.ts` não maior que na `origin/main`.
- **A5** Comportamento das regras igual: o ponto único só mede (as mesmas escritas, na mesma ordem).

## Dívida achada pela régua (`KNOWN` do `kit-energy.test.ts`, só diminui)

Três casos já criavam energia quando o teste foi escrito. Corrigir muda o comportamento visível da regra: **decisão do dono**.

| Tamanho | Regra | Caso | Deu | Queda | Causa |
|---|---|---|---|---|---|
| 3x mais alto | `goOverIfBalanced` | mesa 4,4 m, perdendo os pés um a um | 199,2 J | 99,9 J | a mesa já tombou e está de lado; o empurrão é posto a partir do centro das caixas desenhadas (`centreOfBoxes`), a 1,08 m do meio da caixa em volta do qual o impulso gira: braço de 2,25 m onde o alcance é 1,17 m |
| 1/3 | `goOverIfBalanced` | cama, perdendo os pés um a um | 2,11 J | 1,07 J | `UNDERMINED_PUSH` é velocidade fixa (0,6 m/s): o que dá sobre a queda cresce com 1/tamanho (0,53 da queda no tamanho do desenho, 1,8 a um terço) |
| 1/3 | `checkUndermined` | cama, chão some sob um pé | 1,82 J | 1,03 J | o mesmo `UNDERMINED_PUSH` |

## Fora do escopo (o que falta)

- **Catálogo real.** O teste roda em móveis desenhados por caixas no próprio pacote: `game-destruction-three` não pode importar o catálogo
  (`game-floorplan-three` depende dele). Falta o mesmo teste sobre `defaultFurnitureCatalog()` em `game-floorplan-three`.
- **Regras ainda fora do ponto único:** `tipIfTopHeavy`/`tip` (giro por segundo aplicado em `pieces.ts`, solver do kit), o empurrão de
  explosão em destroço (`fragments.ts` `blast`, `rigid.push`/`shove` no renderer), `outOfStatics`/`putBack`/levantar do chão (`setPose`, teletransporte:
  energia potencial, não cinética), `holdPush` (dentro do `topple`, já medido junto), o giro inicial do fragmento no núcleo, e as regras dos sistemas
  próprios de 10.1 (vfx, veículos, multidão).
- **Destroço.** O `topple` mede também o corpo do destroço grande (`debris#`), mas nenhum cenário de destroço entra no teste.
- **Soma entre regras.** O limite é por regra; duas regras somadas na mesma peça não são comparadas com a queda juntas.
