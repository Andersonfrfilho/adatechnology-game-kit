# Jolt multithread: callbacks de contato e passo na cratera

Medido em 2026-11-17, `jolt-physics` 1.1.1, Chromium do Playwright 1.58 com GPU (headless), página isolada por origem
(`tools/serve-room`, COOP `same-origin` + COEP `require-corp`, `crossOriginIsolated === true` em todas as rodadas).

## 1. Risco (2): os callbacks JS do kit nas threads do Jolt

**Onde o kit registra callbacks em JS** (`packages/game-physics-jolt/src`):

| Callback | Arquivo | Roda durante o `Step`? | O que o kit perde sem ele |
|---|---|---|---|
| `ContactListenerJS` (`OnContactValidate`, `OnContactAdded`, `OnContactPersisted`, `OnContactRemoved`) | `contacts.ts` | **sim**, na thread do job que acha o contato | linhas de contato (dano por impacto, impulso, ponto, normal), sensores, parceiros (`touching`, atrito por corpo, resistência ao rolamento), restituição por média geométrica, pares ignorados, pontos de contato |
| `AssertFailedHandlerJS` | `world.ts` | só na build debug | nada na build release |
| `ObjectLayerFilterJS`, `BodyFilterJS` | `queries.ts` | não: só nas consultas, na thread de quem consulta | — |
| `StateRecorderJS` | `state.ts` | não: `saveState`/`restoreState` | — |
| `VehicleConstraintStepListener` | `vehicles.ts` | sim, mas é nativo (C++) | — |

Não há `BodyActivationListener` nem função de combinação de atrito/restituição em JS: o atrito é o do próprio corpo, misturado pelo Jolt.

**O que acontece na build multithread** (prova reproduzível: `node tools/jolt-threads/dist/cli.js probe-callbacks`, pilha de 1500 caixas):

| Workers | Listener JS | Resultado |
|---|---|---|
| 0 | ligado | roda; os 1500 contatos chegam na thread principal |
| 1 | ligado | **quebra**: `worker sent an error! ... Cannot read properties of undefined (reading 'hasOwnProperty')` |
| 4 | ligado | **quebra**, mesmo erro |
| 4 e 16 | desligado | roda |

O motivo, lido na build: o binding WebIDL do JoltPhysics.js chama o callback com
`Module.getCache(Module.ContactListenerJS)[ptr].OnContactAdded(...)` dentro de um `EM_ASM`, que roda **na thread que chamou**. O Jolt chama o
listener de dentro do job que achou o contato; com workers, esse job roda num Web Worker (pthread), cujo `Module` não tem o objeto JS criado na
thread principal. O Jolt não força uma thread só e não trava: o worker lança o erro e o passo morre. Com 0 workers todos os jobs rodam na thread que
chamou `Step`, por isso funciona.

**Segundo limite:** a build sobe 16 pthreads com o módulo (`PTHREAD_POOL_SIZE`). O Jolt cria as threads de job no construtor do `JoltInterface`,
na thread principal, que não pode esperar um worker novo nascer. Pedir mais que 16 trava a página para sempre (medido: 23 workers numa máquina de
24 threads, nenhuma sala depois de 10 minutos). `MAX_WORKER_THREADS = 16`; `?joltThreads=auto` usa `min(hardwareConcurrency - 1, 16)`.

**O que o kit faz agora:** `resolveJoltThreading` recusa workers com o listener JS (`JoltThreadingError`, `JOLT_WORKERS_WITH_JS_CALLBACKS`) e a sala
cai para a build single com aviso no console e em `window.__joltInfo.fallback`. A build multithread com 0 workers e o listener ligado é válida e é o
padrão do app de desktop. Workers só com `contactCallbacks: 'none'` (`?joltContacts=off`), que desliga as regras de contato: modo de medição.

**O que tiraria o limite** (nenhum feito aqui):

1. *Listener nativo com fila*: uma build própria do JoltPhysics.js com um `ContactListener` em C++ que grava os contatos (par, ponto, normal,
   velocidade de aproximação, sub-shape) num buffer com trava, a restituição por média geométrica via `PhysicsSystem::SetCombineRestitution` e os pares
   ignorados numa tabela nativa; o kit lê o buffer depois do `Step`, na thread principal. É o caminho certo, mas é um fork a manter (Emscripten, IDL,
   build a cada versão do Jolt).
2. *Reconstruir os contatos depois do passo* com consultas (`CollideShape` dos corpos ativos): sem fork, mas paga na thread principal o que o passo
   ganhou nas outras.
3. *Ficar em 0 workers* na build multithread: sem fork, pega só o SIMD.

## 2. Passo do Jolt na cratera

Cena: `test-room.html?area=floorplan&solver=jolt&blastDebris=1` + a configuração; casa `single_storey_a` semente 1 da bancada de casas, o mesmo C4 do
`tools/gpu/room-explosion.mjs` no solo solto mais perto da parede (a cratera), 600 quadros de 1/60 s com o laço da página parado. "Passo" é o tempo
de `world.stepFixed` (o `Step` do Jolt e o que o adaptador faz em seguida) por quadro; o quadro 0 (o da explosão) fica à parte. Uma rodada por
processo, cada uma sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock` e só com carga de 1 minuto abaixo de 4 (a carga do início de cada
rodada está na tabela). Dados brutos: `jolt-multithread.jsonl`; refazer:

```sh
pnpm measure:jolt-threads round --config mt4-off --round 1 --out docs/medicoes/jolt-multithread.jsonl   # sob o flock
node tools/jolt-threads/dist/cli.js report --in docs/medicoes/jolt-multithread.jsonl --out /tmp/tabela.md
```

Máquina: Intel(R) Core(TM) Ultra 9 275HX (24 threads). Cena: ?area=floorplan&solver=jolt&blastDebris=1, casa single_storey_a semente 1, C4 no solo solto ao lado (cratera), 600 quadros de 1/60 s, quadro 0 (despertar) à parte.

| Configuração | Válida p/ jogo | Rodadas | Passo Jolt média (ms) | p99 | pior | Passo no quadro 0 (mediana) | Update inteiro média | p99 | pior | Carga no início |
|---|---|---|---|---|---|---|---|---|---|---|
| single-thread (hoje), contatos JS | sim | 3/3 | 0.55 | 4.01 | 6.76 | 0.04 | 2.83 | 13.87 | 38.61 | 3.28, 1.1, 2.17 |
| multithread build, 0 workers, contatos JS | sim | 3/3 | 0.46 | 4.35 | 5.77 | 0.03 | 2.14 | 12.56 | 24.44 | 3.48, 3.32, 2.53 |
| single-thread, sem listener | não | 3/3 | 0.37 | 2.74 | 5.67 | 0.03 | 2.19 | 15.04 | 31.49 | 3.02, 2.67, 2.22 |
| multithread build, 0 workers, sem listener | não | 3/3 | 0.27 | 4.91 | 8.22 | 0.03 | 1.97 | 13.28 | 30.22 | 3.39, 2.19, 1.8 |
| multithread, 2 workers, sem listener | não | 3/3 | 0.3 | 4.88 | 7 | 0.03 | 2.01 | 14.13 | 28.14 | 2.92, 2.31, 3.21 |
| multithread, 4 workers, sem listener | não | 3/3 | 0.25 | 3.25 | 6.11 | 0.03 | 1.95 | 13.07 | 27.93 | 2.88, 2.19, 2.69 |
| multithread, auto = min(hardwareConcurrency-1, 16) workers, sem listener (16) | não | 3/3 | 0.4 | 6.38 | 55.19 | 0.04 | 2.71 | 17.46 | 57.67 | 1.37, 3.06, 2.56 |

Rodadas descartadas (registro): `hardwareConcurrency - 1` = 23 workers travou a página nas duas tentativas (pool de 16, seção 1), e 16 workers também
travou enquanto o aquecimento do JIT da destruição criava um segundo mundo pedindo mais 16. Corrigido: os mundos da página dividem o pool
(`createWorld` dá ao mundo o que sobrou, `dispose` devolve), e a linha `(16)` acima já roda com isso.

Leitura: o ruído entre rodadas da mesma configuração é do tamanho das diferenças (a média do single variou de 0,25 a 0,78 ms entre rodadas). Nenhuma
configuração com workers ficou fora desse ruído; 16 workers piorou o pior quadro (55 ms numa rodada).

## 3. Conclusão

1. **O passo do Jolt não é o gargalo da cratera.** Ele gasta em média 0,25 a 0,55 ms de um update de 2 a 3 ms, e o p99 do update (13 a 17 ms) vem
   do resto: sistema de peças, fila de despertar, chão, renderizador. Mesmo que os workers zerassem o passo, o p99 do quadro quase não mudaria.
2. **Workers não deram ganho medível**, nem sem o listener: 2 e 4 workers ficam no ruído da build de 0 workers, e 16 workers piora o pior quadro (custo
   de sincronizar 16 threads num passo de menos de 1 ms). Com o listener JS, nem rodam (seção 1).
3. **A build multithread com 0 workers e contatos JS é válida e não piorou** (média 0,46 contra 0,55 ms, dentro do ruído). É o padrão do app, porque
   não custa nada e deixa a porta aberta.
4. **O app resolve os cabeçalhos** (`crossOriginIsolated === true` em todas as rodadas e no app), mas isso sozinho não torna o Jolt multithread
   vantajoso nesta cena. Para valer a pena seriam necessárias as duas coisas: uma cena em que o passo do Jolt domine o quadro (milhares de corpos
   acordados ao mesmo tempo) **e** o listener de contato nativo (seção 1, item 1). Antes do fork, o ganho maior está em reduzir o custo do lado JS
   (peças, chão, despertar), que é onde o p99 está.

## 4. E a regra dos workers (§14)?

As threads daqui são as pthreads do próprio Jolt (a build `wasm-compat-multithread` as cria dentro do `JobSystemThreadPool`, para um único
`Step`, com memória compartilhada). Nenhum pacote do kit cria `Worker`: o adaptador só escolhe a build e passa `mMaxWorkerThreads`. Isso é
diferente do coordenador do `game-workers` (trabalho fora do quadro, resultado num quadro fixo) e fica desligado por padrão. Se um dia for ligado,
as pthreads do Jolt disputam os mesmos núcleos que o coordenador usa: a repartição automática do `game-workers` teria de contar com elas.

