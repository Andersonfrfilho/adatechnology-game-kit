# T3.1 — pintura da parede: o golpe leva só o impacto, o resto vai para a fila de prazo

Branch `spec/017-t31-pintura` (de `spec/017-quadro-da-explosao`). **O ganho de tempo NÃO foi medido**: a régua do navegador é da T4.2.

## O que mudou

- `packages/game-floorplan-three/src/destruction/breach.ts`, `drawIn` (~835): para onde vai a parede cortada, com fila ligada ao orçamento (`cutState.attached`):
  1. golpe com `opening`, ou golpe novo numa parede cuja pintura espera de um golpe anterior: `cutWalls` (fila `floorplan.breach-cut`, `mustDrain`);
  2. só `chips`/`spalls`: `dirty` (fila `floorplan.breach-paint`, comum, de prazo).
- **A fila de prazo é a `breach-paint` que já existia** (o `dirty`); nenhuma fila nova, nenhuma `mustDrain` nova, nenhum id novo. `DEFERRED_PRIORITY[BREACH_PAINT]` ganhou `minEveryFrames: 1` (`game-contracts/src/frame.ts`); a janela de 3 quadros é do `run` (ver "Revisão").
- `breach-paint`: 1 unidade = 1 parede. `run` pega a cada unidade a parede mais perto do último golpe da casa, empate por id (`nextDirty`, varredura sem alocação e sem ordenar). Sem orçamento (`paintState.attached` falso) mantém a ordem de entrada (o filho da cena fica na mesma ordem, senão o golden `destruction/fracture` muda: pego e corrigido nesta task).
- Golpe no meio da janela: `dirty` virou `Map<parede, época>`; a época avança a cada `pending(frame)` com quadro novo e a cada `run` da `breach-cut`. Parede pendente de época anterior que leva golpe novo vai para o `mustDrain`; mais de um evento do mesmo golpe não promove.
- **`fallen` novo**: `drop()` já pinta a parede de forma síncrona e a tira das duas filas (`host.fallen.add` síncrono, intacto). Ela nunca espera em fila.
- Sem host: nenhum ramo novo roda (`cutState.attached` falso), comportamento de antes.

## Testes

`tests/breach-paint-queues.test.ts` (novo, 10): só chips vai para a fila de prazo e não pinta no dreno do mustDrain; opening pinta no mustDrain e não espera na de prazo; parede caída pinta na hora e sai da fila; 1 unidade pinta 1 parede; ordem mais perto do golpe primeiro e igual em duas rodadas; `minEveryFrames` 3 sem `mustDrain`; golpe novo em parede pendente (outro quadro) vai ao mustDrain; segundo golpe no mesmo quadro não; `checkDeferredQueue` passa; sem host o caminho é o de antes.
Não coberto: a espera máxima por um orçamento real (só a constante e o contrato); com mais de 3 paredes pendentes e orçamento esgotado o orçamento roda 1 parede a cada 3 quadros, então a espera da última passa de 3 quadros.

`tests/breach-deferred-mask.test.ts` passa sem mudança.

## Gates

- `pnpm install --frozen-lockfile`; `pnpm --filter @adatechnology/game-floorplan-three... build`: ok.
- typecheck `game-floorplan-three` e `game-contracts`: sem erro.
- Testes: breach-queue, blast-presentation, exact-golden (44), stamp-mask, destruction, grenade-in-kitchen, breach-deferred-mask, breach-paint-queues: 94 passam. `game-contracts` 119 e `game-runtime` 61 passam.
- `pnpm check:layers`: 0 violações novas. `kit-audit --check --strict-clocks`: 0 novos, own-frame-clock 0.
- Goldens e fixtures: nenhum mudou (`exact-golden` passa sem regravar; a primeira versão mudava `destruction/fracture` e foi corrigida).

## Revisão (2026-11-19)

1. **Janela de 3 quadros (feito).** O orçamento só roda fila sem cota a cada `minEveryFrames` e com prazo vencido, então 20 paredes levavam ~60 quadros. Agora `minEveryFrames: 1` e o `run` (`breach.ts`, fila `BREACH_PAINT`) ignora o prazo para parede com idade >= `PAINT_WINDOW_TICKS` (3). A idade usa um contador de quadros (`strike.tick`) que avança uma vez por `pending(frame)` novo, tanto da fila de corte quanto da de pintura; o `run` do corte não avança mais nada. Parede vencida vem primeiro na escolha. Teste: orçamento sempre esgotado, todas as paredes da casa (>5) pintadas em até 3 quadros; com folga de prazo pinta mais de uma por quadro e para no prazo. Limite: com várias casas, o laço externo para no prazo entre casas, então uma casa atrás de outra pode esperar mais que a janela.
2. **Distância não finita (feito).** Vale `Infinity`; a parede ainda é escolhida (menor id). Teste com ponto de golpe NaN: a fila esvazia. (Os `bounds` NaN não são alcançáveis de fora do módulo; o NaN entra pelo ponto do golpe, que dá o mesmo efeito em todas as distâncias.)
3. **Promoção só com `opening` (feito).** Lasca/chip novo em parede pendente a deixa na fila de prazo e a idade não reinicia (`queueForPaint` só grava se ausente). Testes: eventos em quadros seguidos sem `opening` não promovem e, no tique 3, as paredes saem todas juntas; `opening` em parede pendente a leva ao `mustDrain`.
4. **Ordem dos filhos da cena (limite documentado, não forçado).** O que muda de ordem são os filhos do objeto `house` do breach: o `InstancedMesh` das unidades (`breach:<parede>`), adicionado ao fim em `paint` (`house.add(units)`). Só afeta ordem de desenho e o hash do golden; nada lê a ordem. Inserir na posição do antigo cobriria só a repintura, não a primeira pintura, então não resolve; comentário de uma linha no ponto. Sem host a ordem de entrada é mantida (o golden depende).
5. **`local(point)` por evento (feito).** `markStrike` escreve numa tupla pré-alocada, sem vetor novo. `lastStrike` segue sendo o ponto do último evento: os eventos `chip`/`spall`/`stage` não trazem o centro da explosão (documentado no comentário).
6. **Testes (feito).** Ordenação: 3 paredes enfileiradas da mais longe para a mais perto (a última atingida por último), saem da atingida para a mais longe; falha com ordem de inserção. Acrescentados `drop` e `restore` deixando as duas filas vazias. A fila de pintura dos testes agora é a do renderizador (a registrada no orçamento).

Gates: typecheck `game-floorplan-three` e `game-contracts` ok; 98 testes de breach/máscara/golden (exact-golden sem diff), contracts 119, runtime 61; `check:layers` e `kit-audit --check --strict-clocks` sem violação nova. Ganho de tempo continua NÃO medido.

## Revisão 2

1. **Casa atrás de casa (feito).** Saiu o `break` por prazo do laço sobre as casas (`breach.ts`, `paintQueue.run`); cada casa aplica a própria cota (item 2), então uma casa que gasta o prazo não segura as paredes vencidas de outra. Teste: casa A recebe parede nova por quadro, casa B tem 5 pendentes, prazo sempre vencido: B esvazia em 3 quadros.
2. **Espalhar (feito, por unidades, sem relógio).** `owedWalls`: com prazo vencido, cada quadro pinta no mínimo as paredes vencidas ou, se não há, `ceil(pendentes / (3 - idadeDaMaisVelha + 1))`; com folga de prazo continua pintando enquanto couber. Testes: 21 paredes enfileiradas num quadro (a casa de teste dá 21 vistas pendentes, não 20) saem 7, 7, 7 e nenhuma depois; enfileiramento escalonado (parede do quadro 2 sai até o quadro 5); com o `createFrameBudget` real (`ms: 0`, relógio parado, `drain('present')` + `drain('idle')`) a fila esvazia em 3 quadros.
   **Pior caso, em paredes por quadro:** rajada de N paredes num quadro: `ceil(N/3)` no 1º quadro, `ceil(restante/2)` no 2º, o resto no 3º (N=21: 7, 7, 7). Pior que isso: a escolha é "mais perto do golpe primeiro", não "mais velha primeiro", então paredes longe do golpe podem sobrar enquanto paredes novas e próximas entram; as que chegam a idade 3 pintam todas no mesmo quadro (no limite, até N-1 de uma rajada). **O custo em ms por parede não foi medido**: não sei dizer quantos ms é um quadro de 7 paredes.
3. **`markStrike` (feito).** Só roda com a fila de pintura ligada (`paintState.attached`); `restore` zera `hasStrike`.
4. **Janela sem número de quadro (feito).** O `run` da fila global conta como um quadro quando nenhum `pending(frame)` chegou desde o último `run` (`strike.polled`). Teste: `run` sem `pending` fecha a janela em 3 chamadas.
5. **Teste com o orçamento real.** `game-floorplan-three` não depende de `game-runtime`; o teste importa `../../game-runtime/src` por caminho relativo (o `check:layers` olha só `packages/*/src`, não os testes; sem violação nova). Nota do orçamento: o contador de quadros só avança com `drain('idle')` depois do `drain('present')`.

Gates: typecheck ok; 104 testes de breach/máscara/golden (exact-golden sem diff, `breach-deferred-mask` intocado), contracts 119, runtime 61; `check:layers` e `kit-audit --check --strict-clocks` sem violação nova.

## Ajuste depois da régua

A régua do navegador (4 rodadas alternadas, carga ~1,3) mostrou: `breach-cut` no quadro do golpe de ~8,4 ms para 0, mas `breach-paint` no mesmo quadro de ~5,0 para ~8,0 ms. Causa: a cota mínima `owedWalls` (um terço das pendentes) valia já no quadro em que as paredes entram na fila, que é o quadro do golpe, o único sem folga.

Mudança (`breach.ts`, `owedWalls` e `ageOf`): o quadro do golpe pinta só 1 parede (o mínimo do contrato), a mais perto do golpe; só entram na cota as paredes de quadros anteriores. A idade passou a contar "quadros desde o quadro cujo dreno viu a parede" (`tick - entrada - 1`: o tique avança antes do `run`, então a parede que entrou na simulação do quadro tem idade 0 ao ser drenada). Resultado: 21 paredes de uma vez saem 1, 10, 10, e a janela continua de 3 quadros contando o do golpe (`PAINT_WINDOW_TICKS - 1` é a idade em que a parede vence). Com folga de prazo continua pintando enquanto couber (um tiro isolado pinta no próprio quadro); idades misturadas: a cota conta só as de idade >= 1.

Testes: `breach-paint-queues.test.ts` (21): 21 paredes dão [1, 10, 10, 0]; idades misturadas (a cota é `ceil(antigas / 2)`, as novas ficam fora); tiro isolado com folga pinta no quadro; escalonado (parede do quadro 2 sai até o quadro 4). Gates: typecheck, 105 testes de breach/máscara/golden (exact-golden sem diff, `breach-deferred-mask` intocado), `check:layers` e `kit-audit --check --strict-clocks` sem violação nova. O ganho do ajuste NÃO foi medido; a régua é de outra sessão.

## Ajuste 2

Medição no modo de prazo: f0 de ~78 para ~68 ms; `breach-cut` 9 para 0, mas `breach-paint` 0 para ~4 ms no quadro do golpe. Uma parede custa ~4 ms, o orçamento das filas no f0 é o piso de 1 ms e a fila começava "ao menos uma" parede.

Mudança (`breach.ts`, `queue.run`, `fitsDeadline`, `owedWalls`): com orçamento ligado a fila guarda quanto a última parede levou pelo relógio que o `run(deadline, clock)` recebe (nenhum relógio próprio) e não começa parede não vencida que não cabe no que resta (`restante > 0` e `restante >= custo`; sem histórico, `>= 1 ms`). Parede vencida pinta sempre; a cota dos quadros seguintes é `ceil(antigas / (3 - idadeDaMaisVelha))`; parede do quadro do golpe não entra na cota. Isso relaxa o "ao menos uma unidade" do contrato `DeferredQueue` só para esta fila (comentário no ponto): `run` pode devolver 0 com paredes esperando, e o progresso vem da janela. Conferido em `budget.ts`: `runEntry` só zera `waitingFrames` e soma 0 unidades, sem laço nem travamento. Sem orçamento (detached) segue "uma parede e depois até o prazo". O `run` de cada casa também conta como quadro quando ninguém consultou `pending(frame)` (os testes que chamam a fila da casa à mão dependem disso).

Sequência afirmada: 21 paredes de idade 0, prazo sempre vencido: 0, 11, 10, 0 por quadro; com o `createFrameBudget` real (`ms: 0`): 21 pendentes após o 1º quadro, esvazia no 3º. Custo estimado maior que a folga: não pinta; folga maior: pinta; sem histórico e folga < 1 ms: não pinta; vencida sem folga: pinta. `breach-queue.test.ts` ("uma parede por chamada com prazo vencido") foi reescrito para o contrato novo: 0 no quadro do golpe e o resto nas chamadas seguintes. Gates: typecheck, 107 testes de breach/máscara/golden (exact-golden sem diff, `breach-deferred-mask` intocado), `check:layers`, `kit-audit --check --strict-clocks` sem violação nova. O efeito em ms NÃO foi medido aqui.
