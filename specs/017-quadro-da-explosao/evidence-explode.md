# T2.1: baratear o `world.explode` sem mudar a saída (2026-11-20)

Branch `spec/017-explode`. Um commit por item. Ganho em ms não medido aqui; régua do navegador depois (para todos os itens).
Guardas de cada item (rodados depois dele, nesta ordem): `game-destruction` (suíte inteira, mais `tsc`), `game-floorplan-three` (`blast-presentation`,
`exact-golden*`, `breach-*`, `structure-solves`, mais `tsc`), `game-test-room` (`step-equivalence`, `step-equivalence-window`). Todos verdes em A, B, C, D e F.
No fim: `pnpm check:layers` ok, `kit-audit --check --strict-clocks` ok (0 novos), eslint sem erro nos arquivos tocados.

## A. `implInRange` preguiçoso (`1d1eaf17a`)
`world.ts` `implInRange`: laço que para na primeira peça no alcance, sem montar o array de `implParts`; mesmas operações por peça, mesma ordem.
Rejeição por `implBoundsOf` não usada: os limites têm folga e a prova de mesma resposta não é trivial. Teste: `tests/blast-impl-range.test.ts`.

## B. `emit` com lista copiada só na escrita (`86f12a2e2`)
`listeners` guarda arrays imutáveis; `on`/`off` trocam o array. Mantida a semântica antiga: quem entra ou sai dentro de um `emit` não muda a lista
daquele `emit`; a lista tipada é lida depois dos ouvintes `'*'` (como antes). Inscrição repetida da mesma função continua ignorada. `base()` e o
spread por evento não foram tocados (a serialização do evento define o hash dos goldens). Teste `tests/event-listeners.test.ts` (passa também na versão antiga).

## C. `blastPart` e `wearJoints` (`fa27e0b43`)
`wearJoints` percorre `byPart` no lugar (o divisor continua o número de juntas fechadas no início). `blastPart` reaproveita `q` no lugar de
`faceOf` quando `o.st.rotation` e `p.q` são os mesmos objetos de quando foram lidos (ambos só são trocados por `applySoilPose`/`setPartPose`, nunca
alterados no lugar); senão chama `faceOf`. Nada que sorteia ou soma em ponto flutuante mudou de ordem.

## D. `knockOutUnits` e `unsupportedCells` (`da8c9f991`)
- `localHolesOf` calculado uma vez e passado a `cellFragments` (novo último parâmetro opcional `knownHoles`).
- filtro de furos por `holeInBox` (`breach.ts`), a mesma conta de `marksInBox` para um furo sem rotação, sem arrays.
- `unsupportedCells`: as linhas NÃO dependem só da grade (`rows` só tem as células de pé). O que depende só da grade, e agora fica guardado por
  grade (WeakMap, conferindo `thin`, a base e o número de células): a chave de linha de cada célula e a ordem das células ao longo da parede
  (ordenação estável uma vez). A ordem de criação das linhas (que define a de `loose`) segue a primeira célula de pé por índice.
Testes: `tests/unsupported-cells-layout.test.ts` (cópia da versão antiga como referência, bond running e stack, 320 máscaras aleatórias, grade nova vs repetida,
altura trocada) e `holeInBox` contra `marksInBox`.

## E. `solveStructure` dentro de `knockOutUnits`: DESFEITO, nada commitado
Troquei por `loosened(o, [], 'break', src)` (com `solveStructure` direto fora de operação). Os guardas mudaram: `blast-presentation`
(`RECORDED_BLAST_OUTCOME`, hash `6a4a72aa...` virou `ec4337d9...`) e `exact-golden` `destruction/fracture`. Desfeito.
Quem lê o estresse entre essa chamada e o fim do `run()`: `exposeRebar` (`p.st.stress` para o arqueamento das barras; chama `settleStructure` antes),
os `bearBeam`/`judgePlate` do solo (`st.load`; chamam `settleStructure` no laço), `applyWind`, `soilWeight` e `recomputeGroups` (`o.unsup`; só no `update`
e no assentamento). Nenhum desses é `blastPart`, `failPart` nem `bendByBlast`. Pela leitura nada deveria mudar, mas mudou: a causa não foi isolada
(candidatas: `solveStructure` não é idempotente, por `o.seeding`/`heldAsDesigned`; ou `recomputeGroups` que o assentamento chama a mais). Fica para análise com sonda.

## F. Corte da parede adiado para o pintar (`a86a7464a`)
`packages/game-floorplan-three/src/destruction/breach.ts`. Com a fila de corte ligada e a pintura em fila (ou `deferPaint` com `spall`), um evento sem
`opening` numa parede sem visão cria a visão "preguiçosa": `mask`, `core`, material e `bounds` só são feitos no primeiro uso (getters), e `cut` fica para
o início de `paint`. As listas de dano (`chips`, `spalls`, teto 64) são atualizadas na hora, na ordem dos eventos (a visão é a mesma de sempre).
`opening` continua cortando na hora. `drop` corta antes de descartar uma parede nunca cortada (o intervalo de vértices fica recolhido como antes),
`plain` e `dispose` toleram visão não cortada. A ordem das cascas na cena passa a seguir a ordem em que a parede foi atingida (`seatShell`, em um
`WeakMap`, não em `userData`: o `exactSnapshot` hasheia `userData`). Sem host (filas desligadas), caminho idêntico ao antigo (goldens `exact-golden` iguais).
Teste novo em `tests/breach-deferred-mask.test.ts`: parede só com spall/chip, nunca cortada, sem cascas antes do dreno e máscara igual à síncrona depois.
