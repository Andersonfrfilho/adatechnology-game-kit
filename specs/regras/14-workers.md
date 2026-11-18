# 14. Workers: tudo pelo coordenador — **OBRIGATÓRIO**

Texto completo da seção 14 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-11-18: o worker do chão da cratera baixou o pior quadro da cratera de 8–13 ms para 3,9–5,8 ms; o SDK passa a ter
um coordenador de workers configurável ou automático, que todo pacote e todo jogo usam, para as próximas implementações seguirem um padrão só.

- **Trabalho pesado fora do quadro passa pelo coordenador** do `@adatechnology/game-workers` (`createWorkerCoordinator`). Nenhum pacote cria
  `Worker`, `SharedWorker` ou `worker_threads` por conta própria; o pacote recebe um `WorkerCoordinator` (tipo de `game-contracts`) pelas
  opções, como `createCrowd({ physics: { workers } })`, e sem ele roda no quadro principal como antes.
- **O trabalho é uma categoria** (`TaskKind` sem estado, ou `ResidentKind` presa a um worker) com id `pacote.coisa`, faixa (`sim`, `build`,
  `background`), prioridade, latência em quadros e regra de atraso. As do kit têm id e padrão em `WORKER_KIND_ID` e `WORKER_KIND_DEFAULTS`
  (`game-contracts`); o jogo muda qualquer uma por id.
- **Kernel puro.** `run`/`step` só leem a entrada (semente de aleatório vai dentro dela); a mesma função roda no worker e no quadro principal.
  Nada de closures, DOM, three.js ou estado global no kernel.
- **Faixa `sim`: resultado num quadro fixo.** O que entra na física é enviado no quadro N e aplicado exatamente no quadro N + latência, pelo
  `collect`. Se o worker não respondeu, o quadro principal calcula ali mesmo e a resposta tardia é descartada. A física sai igual com 0, 1 ou 8
  workers. O quadro principal nunca espera um worker (sem `Atomics.wait` nem laço de espera no navegador).
- **Teste de equivalência no CI**: toda categoria nova passa por `checkTaskKind` (quadro principal, worker na mesma thread e `worker_threads`
  de verdade, bytes iguais); uma residente compara o estado do pacote inteiro sem worker, com worker a tempo e com worker sempre atrasado.
- **Medição na sala antes do merge** (§9: fora do CI e do pre-push): pior quadro e p99 da física com 0 workers e com o automático, e quantas
  tarefas foram entregues a tempo (`stats()`), com a trava `~/.cache/adatechnology-game-kit/perf-measure.lock` em toda medição de tempo e carga
  abaixo de 4. Print com os contadores na tela.
- **Aquecer na carga**: o jogo chama `warm(kinds)` antes da primeira explosão (sem isso o primeiro resultado cai sempre no fallback).
- **Arquivo do worker do jogo**: um só, com `installWorkerHost(self, [...kinds do kit, ...kinds do jogo])`; página de arquivo único usa
  `sourceSpawn` com o bundle do worker embutido.

Guia completo, API e tabela da repartição automática: `packages/game-workers/README.md`. Desenho com as inspirações (Naughty Dog, Unity,
Unreal, Frostbite, Bevy) e o mundo vivo em segundo plano: https://claude.ai/artifact/37JV3UkwhMtqz1mAHWeCEf.
