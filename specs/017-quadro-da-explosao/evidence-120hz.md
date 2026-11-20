# Evidência — divergência fora de 60 Hz (2026-11-19)

Base `1bbe3aa2e`, solver próprio e Jolt. Sondas temporárias (teste de rascunho copiado do `step-equivalence-window.test.ts`, apagado depois; nenhum código de
produção mudou).

## Divergência fora de 60 Hz — causa

**Resumo.** O estado diverge porque o `PoseTrail.blend` (desenho interpolado) escreve a pose *desenhada* em `piece.root` na fase `present` (`room.pose-present`,
ordem -1000, `simulation-phases.ts:38-43`), e a fila `destruction.events` é drenada **depois** disso, no `budget.drain('present')` (`scheduler.ts:~115`),
com a raiz ainda mostrando a pose desenhada. O `explode` aplicado nessa drenagem (empurrão `blastShove` sobre peças que já existem) lê `root.position` desenhado.
A 60 Hz o `alpha` é sempre 0 e o `blend(0)` escreve a pose *anterior* ao último passo, sempre a mesma; a 120/144 Hz o `alpha` muda por quadro (0,498 e 0,998
a 120 Hz) e o empurrão sai com outra pose de entrada. A simulação **lê a pose desenhada**, contra a §15 ("o desenho interpola; a simulação nunca lê a
pose desenhada"). O `restoreStepPose` só roda no início do próximo tique (`pieces.ts:846`, `renderer.update` e `room.pose-restore`), depois da drenagem.

### Experimentos

**E1 — qual subestado diverge primeiro, e quando (120 Hz contra 60 Hz, solver próprio).** Hash separado por tique de `world.serialize()`, lista de peças e
`fluids.stains()`:

```text
tick 28..30  world:true pieces:true stains:true  peças 1/1
tick 31      world:false pieces:false stains:true  peças 15/15   (stains nunca diverge)
```

Mesmo número de peças (15) e mesmo tique: **H1 não explica o 120 Hz** (a 30 Hz é outro caso: 15/1 no tique 31, a causa já conhecida). A primeira peça
diferente é `wooden_crate_2` (a caixa que já existia, 1 peça antes do golpe), só na posição: `z = -4.994259474512418` (60 Hz) contra `-4.994259472719755`
(120 Hz), `x` na 16ª casa; rotação, velocidade e velocidade angular **idênticas**. `world.state(caixa).position` diverge igual (o mundo recebe a pose da peça).

**E2 — onde a divergência nasce.** Sondas em `input`, `fixedSimulate` (início e fim), `lateSimulate`, fim de `present` e `idle`, com `root.z` da caixa
(rótulo `tick` é `ctx.tick`, que só soma depois do tique):

```text
60 Hz   fixed-start (tique 30)  root.z=-4.9999999585938895   (idêntico nos dois)
60 Hz   late                    root.z=-4.9999999585938895   alpha=0,000
60 Hz   present-end             root.z=-4.9999999585938895   (blend(0) = pose anterior; np 1 -> 15 só no idle)
120 Hz  late                    root.z=-4.9999999585938895   alpha=0,498
120 Hz  present-end             root.z=-4.999999956063197    (blend(0,498))   np 1 -> 15 no idle
        fixed-start (31)        root.z=-4.999999953513299 nos dois (restore devolve a pose do passo: nada diverge ainda)
        fixed-end (31)          60 Hz -4.994259474512418   120 Hz -4.994259472719755
```

Os eventos do golpe são aplicados no mesmo ponto nos dois (depois do tique 30, antes do 31, `np` 1 -> 15 no `idle` do mesmo quadro): **a ordem dos
eventos não difere**. O que difere é a pose que a raiz mostra nessa drenagem (`present-end`, antes do `idle`): pose anterior a 60 Hz, blend de 0,498 a 120 Hz.
A pose do passo (`fixed-start`) é igual; o empurrão sobre a caixa saiu diferente entre elas e o tique 31 integra a partir daí.

**E3 — prova por intervenção (solver próprio).** Um sistema `present` na ordem 0 (depois do `room.pose-present`, antes da drenagem) que chama
`room.renderer.restoreStepPose()`, e nada mais. Primeiro tique diferente contra a referência de 60 Hz, hash de todo o estado dos 120 tiques:

| Taxa | sem `restoreStepPose` | com `restoreStepPose` antes da drenagem |
|---|---|---|
| 120 Hz | 31 | **-1 (igual nos 120 tiques)** |
| 144 Hz | 31 | **-1 (igual nos 120 tiques)** |
| 30 Hz | 31 | 31 (a causa já conhecida: eventos depois de todos os tiques do quadro) |

**E4 — Jolt.** Mesmos testes com o laço Jolt: 120 e 144 Hz já dão -1 (idênticos nos 120 tiques) **sem** a intervenção. Com Jolt e laço a `PieceSystem` não grava
`PoseTrail` (`pieces.ts:858`: `!(this.engine && this.loop && !this.stepsItself)`), então não há pose desenhada para ler. O `it.fails` de Jolt falha pelos 30 Hz (causa já conhecida; os
tempos aleatórios não foram rodados à parte); a divergência de 120/144 Hz é **só do solver próprio**.

### Hipóteses

- H1 (eventos no quadro sem tique ou `dt` do quadro no renderer): **descartada** para 120 Hz. Mesma ordem e mesmo tique de aplicação (E2); `renderer.update` só roda
  no tique (`room.ts:4157-4175`); não varri todo consumo de `dt` de quadro, só mostrei que a divergência não depende dele (E3).
- H2 (a ação lê algo do quadro): descartada, hashes idênticos até o tique 30 inclusive (inclui o golpe).
- H3 (acumulador): confirmada **de forma indireta**: é o `alpha` do acumulador que entra, mas por `blend`, não porque a simulação leia `alpha`.
- H4 (só um solver): **parcial**: o solver próprio diverge a 120/144 Hz, o Jolt não (E4).

### Por que 60 Hz esconde

Quadro de 1/60 s dá `accumulator = 0` depois de cada tique, `alpha = 0`; `blend(0)` copia `previous` (`pose-trail.ts:57`), a pose anterior ao último passo, sempre a
mesma para uma sequência igual de tiques. A leitura da pose desenhada existe, mas é determinística; a 120 e 144 Hz (e com tempo de quadro aleatório) o `alpha` varia. Nenhum
teste de 60 Hz contra 60 Hz poderia vê-lo.

### Correção mínima correta

Duas, e a segunda é a da T2.2:

1. **Pontual (não aplicada).** `renderer.restoreStepPose()` antes da drenagem da fila `destruction.events` (início de `eventQueue.run`, `renderer.ts:~468`, ou um sistema
   `present` na ordem 0 em `registerSimulationPhases`). Fecha 120 e 144 Hz (E3). **Não apliquei:** depois da drenagem as raízes ficam desenhadas na pose do passo
   (sem blend) no quadro que teve evento, e refazer o `blend` depois da drenagem sobrescreve o que o evento mudou na raiz de peça que está no trilho (o `restore` do
   próximo tique grava `current` por cima). Isso muda o que se vê (um salto de até 1 passo nas peças acordadas, uma vez por quadro com evento) e não dá para
   verificar sem navegador. Também move o hash de 60 Hz (a referência da janela passa a ler a pose do passo, não a anterior); `step-equivalence.json` e os goldens do
   `game-floorplan-three` usam quadro síncrono (`isSynchronousFrame`, sem `present`) e não deveriam mudar, mas não rodei a suíte do `floorplan-three`.
2. **Definitiva (T2.2).** Aplicar os eventos estruturais dentro do tique (`fixedSimulate`, depois do `restoreStepPose` da ordem -100000), não em `present`: a leitura
   acontece na pose do passo e também fecha os 30 Hz. O que precisa mover: `eventQueue` do renderer (`renderer.ts:468`, `runBudgeted`) passa a ter uma drenagem
   estrutural chamada por `simulateFixed` depois de `world.update`; `registerFrameQueues` deixa a parte visual na fila de prazo. Precisaria ser regravado: o hash
   de eventos do `blast-presentation` e o hash da cena de `step-equivalence` se a ordem em que as peças nascem mudar em relação ao quadro síncrono de hoje
   (a drenagem passa de depois do `renderer.update` do quadro para dentro dele). Os `it.fails` de 30 e 120 Hz saem juntos.

Verificação do conserto da T2.2: tirar os dois `it.fails` do `step-equivalence-window.test.ts` e rodar com `restoreStepPose` fora do caminho.
