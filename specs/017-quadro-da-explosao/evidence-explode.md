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

## F. Corte da parede adiado para o pintar: RETIRADO (`a86a7464a` revertido)
Feito e revertido (`git diff 49eee5cc2 -- packages/game-floorplan-three` vazio; o teste de máscara que ele acrescentou saiu junto). Motivo: sem ganho
mensurável na régua, e o adiamento tem um defeito: se o renderer amassa a malha entre o golpe e a pintura, o amassado entra na casca (a cópia de
`_p0` passa a ser lida tarde). A correção (guardar a cópia das posições por parede com corte pendente) foi escrita e testada, mas não vale manter
um item sem ganho.

## Testes acrescentados depois da revisão (B, C, D)
- B: `tests/event-listeners.test.ts`: evento emitido de dentro de um ouvinte e ordem `'*'`, `'*'`, tipado em cada evento.
- C: `tests/blast-moved-object.test.ts`: `setTransform` entre duas explosões; a segunda usa a pose nova.
- D: `tests/knock-out-units-fixture.test.ts` com `tests/fixtures/knock-out-units.json`, gravado com `world.ts`/`breach.ts` do commit anterior ao D
  (`fa27e0b43`): 62 eventos, hash dos eventos e do estado serializado iguais na versão nova.

## Medição e decisão (6 rodadas, modo de prazo, máquina quieta)
f0: 64,6 / 64,1 ms → 63,8 / 62,9 ms; rótulo `explode`: 20,5 → 19,4 e 20,2 → 19,8 ms. Os cortes A a D e F juntos tiram cerca de 1 ms do f0,
dentro do ruído de ±1,5 ms entre rodadas. A a D ficam (mesma saída, sem custo de manutenção); F sai. O ganho de A a D não é distinguível do ruído.
