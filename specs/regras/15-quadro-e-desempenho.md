# 15. Quadro e desempenho: medir antes, um dono do tempo, custo pelo que se mexe — **OBRIGATÓRIO**

Texto completo da seção 15 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-11-18, depois da análise de arquitetura e desempenho daquele dia: em 30 dias entraram 108 commits `perf(...)`, e
os ~30 mais recentes não reduziram nenhuma das três causas de estrutura do pior quadro, porque nenhum partiu de uma tabela gravada. A correção
dessas causas é a [spec 010](../010-quadro-com-prazo/spec.md); esta regra impede que voltem.

## Medir antes de otimizar

- **PR `perf(...)` sem tabela não entra.** A descrição e o `evidence.md` da spec trazem a tabela por módulo antes e depois
  (`tools/gpu/room-explosion.mjs` com `ROOM_EXPLOSION_FRAME_PARTS=1`, ou `perf.mjs` para as fases dele), com o commit medido e o JSON ao lado.
- **A medição vale só assim:** `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, carga de 1 minuto abaixo de 4, GPU de verdade, e
  **na configuração que a página usa por padrão**. Número de GL por software, de contêiner ou de máquina carregada serve para contagens
  (chamadas de desenho, buffers), nunca para tempo. "Indicativo" não fecha task.
- **Ataque o maior módulo da tabela.** Se o que você vai otimizar não está entre os três maiores do pior quadro, escreva por que mesmo assim
  vale. Otimização que a régua não mostra não é ganho.
- **Build velho mede outra coisa:** `pnpm build` e a página da sala refeita antes de medir (já houve rodada que mediu o chão no quadro
  principal por causa disso). As pastas de `examples/` não estão no workspace do pnpm: `pnpm --filter @adatechnology/test-room-example build` não
  acha nada e sai com código 0. A página se refaz com `(cd examples/test-room && node build.mjs)`.
- **Comparação de dois builds confere que são dois.** Para medir antes × depois, guarde as duas páginas (`examples/test-room/dist/test-room.html`) e passe
  cada uma por `PERF_PAGE=`, com a outra em `PERF_OTHER_PAGE=`: **o `perf.mjs` para se as duas forem iguais** e grava `pageSha256` no JSON (em
  2026-11-20 seis rodadas mediram a página velha dos dois lados por causa disso).
- **Antes de medir, veja quem está usando a máquina** (`ps -eo pcpu,etimes,args --sort=-pcpu | head`): uma aba de navegador esquecida já prendeu um
  núcleo inteiro por mais de seis horas durante as medições da spec 017, e a carga nunca descia de 1,5.
- **A régua mede no modo de prazo** (`ROOM_EXPLOSION_BUDGET=deadline`, o padrão desde a spec 017). Número em modo de cota não vale para o f0: sem
  `frameStartMs` as filas recebem os 8 ms em todo quadro, até no que já estourou, e o f0 sai maior que no jogo. Uma base gravada em outro modo não é comparada.
- **Ganho menor que ~3 ms não se lê no total**, só no rótulo da tabela: a mesma versão varia ±2 ms entre sessões. Meça a base na mesma sessão, em
  rodadas alternadas (antes, depois, antes, depois), com a carga de 1 minuto abaixo de 1,5.
- O portão da régua (`room-explosion`) bloqueia o quadro da explosão: `f0Ms` ou `afterMs` pior que a base em mais de 15% e mais de 3 ms, **só a 1x, na variante
  padrão, com a base no mesmo modo** e com `ROOM_EXPLOSION_FRAME_PARTS=1`; sem isso ele diz `SEM COMPARAÇÃO NESTA RODADA` e não bloqueia. A base da rodada diária só
  melhora (`min` por métrica). Depois de mergear a mudança de modo, grave a base no modo de prazo com uma rodada conferida à mão (comando em `docs/desempenho-explosoes.md`).
- Continua valendo a §9: nada disso roda no CI nem no pre-push.

## Um dono do tempo do quadro

- **Trabalho adiado é uma `DeferredQueue`** (`game-contracts/src/frame.ts`) registrada no `FrameBudget` do host (`scheduler.budget.register`),
  com id em `DEFERRED_QUEUE_ID` e prioridade em `DEFERRED_PRIORITY`. Sem host, a fila drena por dentro por `drainDetached(queue, budgetMs)` (`game-contracts/src/frame.ts`) e o padrão é síncrono, como sempre
  foi (os goldens dependem disso).
- **Nenhum pacote cria relógio próprio** para fatiar trabalho: nada de constante `*_BUDGET_MS`/`*_SLICE_MS` nova nem `performance.now()`
  comparado com prazo fora do `game-runtime`. Cada relógio a mais soma no pior quadro sem ninguém ver. **A única exceção sancionada é
  `drainDetached`** (`game-contracts`), o caminho sem host de uma fila. A regra `own-frame-clock` do `kit-audit` barra o resto, e
  `node tools/kit-audit/audit.mjs --check --strict-clocks` é o portão (lista de pendentes vazia). A regra não enxerga relógio injetado (recebido
  por parâmetro): na revisão, confira esse caso à mão.
- **O orçamento é o que sobra do quadro**, não uma cota fixa: quem gasta mais na simulação deixa menos para as filas. É o modo de prazo do
  `game-runtime` (`targetMs` e `frameStartMs`, piso de 1 ms, sem dívida); quadro sem `frameStartMs` (headless, `advance`, testes) fica na cota.
- **Fila `mustDrain`** (`destruction.events`, `floorplan.breach-cut`) é só para o que precisa aparecer no quadro do golpe: drena por inteiro
  fora do prazo e é contada à parte (`mustDrainSpentMs`). Fila nova não entra nessa classe sem decisão do dono: o lugar onde isso é imposto é
  `budget.register`, que lança erro para `mustDrain: true` de id fora de `MUST_DRAIN_QUEUE_IDS` (`game-contracts`; um host com outra fila decidida pelo dono passa
  `mustDrainIds` ao orçamento ou ao agendador), e a auditoria avisa cedo (`tools/kit-audit/must-drain-allowed.json`).
- **Apresentação pesada** (pintura da parede, malha, marcas) vai numa fila de prazo com janela, no modelo da pintura da parede: unidade pequena
  (uma parede), não começa a que não cabe no que sobra do quadro, e a vencida pinta de qualquer jeito.
- **Fila só carrega apresentação.** O que muda a física ou estado semeado não depende de relógio: usa o `WorkBudget` em unidades
  (`game-physics`) ou roda no passo fixo.

## Um passo fixo, desenho interpolado

- **Tudo que anda pelo tempo e entra na física ou em estado semeado roda no passo fixo** (fase `fixedSimulate` do agendador, ou
  `beforeStep(h)` do `PhysicsLoop`), nunca com o `dt` do quadro. O `dt` do quadro é para câmera, animação, som e efeito visual.
- **Um acumulador só:** o do agendador. Ninguém cria outro. Decisão R2 (spec 010): o tique do agendador é 1/60 s e roda 2 passos de física de
  `h = 1/120` (`PhysicsLoop.stepFixed(2)`), no máximo 3 tiques por quadro; quem usa o laço sozinho segue com `step(dt)` e o acumulador dele. O
  banco de provas (`game-vehicles-proving`) já usa o passo do agendador.
- **Ainda fora do passo fixo:** o que a fase `input` faz na física (empurrar, objeto na mão, portas, ferramentas) integra com o `dt` do quadro e
  não dá o mesmo estado a 144 Hz. Passa para o tique numa spec própria; até lá o teste de 60/120/144 Hz roda sem entrada do jogador.
- **O desenho interpola** pela pose do passo anterior e o `alpha`; a simulação nunca lê a pose desenhada.
- **Evento que muda a simulação** é aplicado no fim do tique, sobre a pose do passo (`applyStructuralEvents`, `game-destruction-three`), e todo tipo de
  evento tem classe em `EVENT_CLASS` (`structural` ou `visual`; na dúvida, estrutural; tipo novo não compila sem classe). O teste de mesmos bytes
  (`step-equivalence-window.test.ts`) roda a 30, 60, 120 e 144 Hz e com tempo de quadro aleatório. Pendência conhecida: o caminho com `workBudget`
  desliga o modo tique e ainda lê a pose desenhada.
- Código novo de simulação testa o mesmo hash de estado a 60, 120 e 144 Hz.

## Custo pelo que se mexe

- **Laço por quadro percorre o que está acordado**, não o que existe. Peça, objeto ou fragmento dormindo custa zero por quadro: nenhuma
  chamada ao wasm, nenhuma matriz recalculada (`matrixAutoUpdate = false`), nenhuma leitura de `Map`.
- **Fronteira com o wasm em lote:** ler do heap (`vec3At`, `GetActiveBodies`), não uma chamada por corpo por campo.
- **Recalcular uma vez por lote de mudanças, não uma vez por mudança:** marcar sujo (`o.dirty`) e resolver no fim do `run()` ou do quadro.
  Vale para estrutura, grupos, caixas, lotes de desenho e pintura.
- **Sem alocação por quadro nem por evento** em caminho quente: arrays e vetores temporários reaproveitados, sem closure nova em laço, sem
  cópia de lista (`[...lista]`) só para percorrer.
- **Trabalho pesado e pontual** (corte, pintura, amassado, junção de lote) é fatiado numa fila ou vai para o coordenador de workers (§14);
  nunca inteiro no quadro do golpe.

## A sala não cresce

- `packages/game-test-room/src/room.ts` tinha 5.620 linhas em 2026-11-18 (a spec 005 pede menos de 1.200). **O número só diminui:**
  comportamento novo entra no pacote dono e chega à sala como módulo ou área (`TestableModule`, §4); na sala fica só a chamada.

## Dois caminhos, um padrão

- Enquanto a spec 008 não apagar o solver próprio: otimização nova mira o caminho Jolt; o solver próprio só recebe correção de erro.
- O que se mede e o que o CI roda é o padrão da página. Se você mudar o padrão, muda a variante do portão no mesmo PR.

## Antes do PR

1. Tabela antes e depois no `evidence.md` (se o PR mexe em tempo de quadro): régua com `ROOM_EXPLOSION_FRAME_PARTS=1` no modo de prazo, antes e depois, alternando.
2. `node tools/kit-audit/audit.mjs --check --strict-clocks` (relógio próprio, `Worker` direto) e `pnpm check:layers`.
3. Goldens sem diff; hash de eventos igual, ou a mudança levada ao dono antes.
4. `wc -l packages/game-test-room/src/room.ts` não maior que na `origin/main`.
