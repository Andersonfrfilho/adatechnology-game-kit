# T3.1 — pintura da parede: o golpe leva só o impacto, o resto vai para a fila de prazo

Branch `spec/017-t31-pintura` (de `spec/017-quadro-da-explosao`). **O ganho de tempo NÃO foi medido**: a régua do navegador é da T4.2.

## O que mudou

- `packages/game-floorplan-three/src/destruction/breach.ts`, `drawIn` (~835): para onde vai a parede cortada, com fila ligada ao orçamento (`cutState.attached`):
  1. golpe com `opening`, ou golpe novo numa parede cuja pintura espera de um golpe anterior: `cutWalls` (fila `floorplan.breach-cut`, `mustDrain`);
  2. só `chips`/`spalls`: `dirty` (fila `floorplan.breach-paint`, comum, de prazo).
- **A fila de prazo é a `breach-paint` que já existia** (o `dirty`); nenhuma fila nova, nenhuma `mustDrain` nova, nenhum id novo. `DEFERRED_PRIORITY[BREACH_PAINT]` ganhou `minEveryFrames: 3` (`game-contracts/src/frame.ts`, era 4 por omissão): é a espera máxima do agendador.
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
