# Análise de arquitetura e validação — 2026-11-28

Levantamento feito em 2026-11-28 (00:00–00:40 -03) sobre a `origin/main` (`80768a6b4`) e o conteúdo do PR #596 (mergeado às 03:06Z, durante a análise).
Nenhum código foi alterado. Cada afirmação traz o arquivo, o comando ou a URL que a sustenta. O que é dedução está marcado **[inferência]**; o que
não consegui conferir está marcado **[não conferido]**.

## 1. Resumo

1. **O problema não é falta de regra nem de teste; é que nada do que olha o jogo de verdade bloqueia alguma coisa.** A rodada diária está vermelha há
   14 dias seguidos, a main não tem proteção, e 20 scripts de navegador não são chamados por ninguém. O dono acha os defeitos porque é a única guarda
   que joga a sala e cujo resultado alguém lê.
2. **A spec 019 corrigiu a causa certa, mas só num caminho.** O móvel solto na sala colide pelas primitivas; o mesmo móvel dentro de uma casa tem as
   partes fixas fundidas na malha da casa e volta a ser adivinhado pelos vértices. Há pelo menos mais 13 lugares com o mesmo padrão de adivinhação.
3. **O ritmo de merge é maior que a capacidade de validar.** 37 PRs mergeados em 27/11, CI de 13–14 min, e o CI da main se cancela a cada merge. Depois
   das 23:01Z de 27/11 nenhum commit da main terminou o CI verde.
4. **A ordem do plano é: parar a linha, fazer as guardas que já existem valerem, e só então acrescentar as novas** (conferidor de mundo, testes de
   propriedade, robô, replay). Acrescentar guarda nova antes disso repete o que aconteceu com `settle-test.mjs`: existe desde 18/11, pegaria o
   sintoma da casinha **[inferência]** e nunca rodou.

## 2. Arquitetura

### 2.1 O que está certo e deve ficar

| Ponto | Evidência |
|---|---|
| Um dono para threads | um único `new Worker(` no kit: `packages/game-workers/src/node.ts:10` |
| Nenhum laço de quadro nos pacotes | único `requestAnimationFrame` é a tela de carga: `packages/game-kit-defaults/src/world/loading.ts:76` |
| Física escolhida num ponto só, Jolt padrão | `packages/game-kit-defaults/src/world/physics.ts:9`, `world/types.ts:52` |
| Medição de colisor pura e transferível (igual no worker e no quadro) | `packages/game-destruction-three/src/static-part-job.ts`, `worker-kinds.ts:41-48` |
| Dado externo validado na leitura | `built-solids.ts:25` rejeita a lista inteira se uma entrada não é sólido |
| Regras viradas em lint, com dívida contada | `eslint.config.mjs:27-58`, `eslint-suppressions.json` (28 `any`, 26 num arquivo) |
| Guardas de catálogo com lista de dívida nomeada que só diminui | `hollow-catalogue.test.ts:78` (14), `solids-catalogue.test.ts` (223 casos) |
| Um só desenhista de parede | `packages/game-floorplan-three/src/wall.ts:147` |
| A direção da spec 019 | a forma de colisão nasce no construtor; é o que Jolt, Blast e Chaos fazem (seção 5) |

### 2.2 Onde o kit adivinha em vez de carregar o dado

A spec 019 lista quatro caminhos de adivinhação e fecha um. Estado depois do #596:

| # | Onde | O que adivinha | Risco |
|---|---|---|---|
| 1 | `game-destruction-three/src/renderer.ts:3375` (`const built = mv.range ? null : builtSolidsOf(mv.mesh)`) | parte desenhada por faixa de malha unida nunca usa os sólidos | alto |
| 2 | `game-floorplan-three/src/interactables/bridge.ts:131-133` (`ivAccumulate(...); m.geometry.dispose()`) | as partes `static:` do móvel do household dentro da casa são fundidas na malha da casa sem a lista de sólidos, e caem no caso 1 | alto |
| 3 | `drawn-boxes.ts:2-19` (`BOX_VERTICES = 24`, `MAX_BOXES = 16`, `share 0.5/0.8`) | caixa por grupos de 24 vértices e limiar de preenchimento | alto |
| 4 | `static-part-job.ts:8-16` (`FIT = 0.01`, `FILL = 0.5`, `SOLID = 0.5`) | parte fixa: caixa ou triângulos por limiar | médio |
| 5 | `game-vehicles-three/src/collider-fit.ts:6-14,132` | colisor do veículo ajustado aos vértices | alto |
| 6 | `game-vehicles/src/zone-auto.ts:583-599` (875 linhas) | zona de dano pela medida da malha (`sx > 0.7 && sx > 5 * max(sy, sz)`) | alto |
| 7 | `game-vehicles/src/destructible/visual.ts:676,968` | forro da porta por tamanho e cor; barra do vidro por número de vértices | médio |
| 8 | `game-vehicles/src/stray-lamps.ts:29-34,97` | farol pela intensidade emissiva e pela posição | médio |
| 9 | `game-destruction-three/src/spec.ts:119,123,213` | material pelo nome (80 dicas), `/hollow/i` no nome vira `fill = 0.05`, sobra vira `'plastic'` | alto |
| 10 | `game-destruction/src/world.ts:813` (`out.joints ?? inferJoints(...)`) | junta entre partes por toque e material | médio |
| 11 | `game-floorplan-three/src/interaction/collision.ts:7-12` | colide ou não por regex do tipo (`rug|floor|...|mirror`) e limiar de altura | médio |
| 12 | `game-floorplan-three/src/destruction/pieces.ts:142-155`, `construction-stages/structural-stages.ts:112,159-162` | papel estrutural por regex do id, embora `role`/`beamKind` já existam | médio |
| 13 | `game-vehicles/src/cabin-space.ts:213-225` | motorista pela posição do quadril | baixo |
| 14 | `game-test-room/src/room.ts:2123`, `game-vehicles-three/src/test-area/module.ts:266-270` | cabeça e vidro por regex do nome da parte | baixo |

Os casos 1 e 2 foram conferidos por mim no código. O efeito no jogo — o móvel dentro da casa continuar com a colisão adivinhada — é
**[inferência]**: as partes que não são `static:` seguem como malha própria (`else root.add(m)`) e mantêm os sólidos.

**O canal por onde o dado passa também é frágil.** São 173 chaves distintas de `userData` em `packages/*/src`, 63 casts, e nenhuma declaração de tipo.
Só `kitOrigin` e o lançamento têm contrato em `game-contracts`. `destructionPart` e `destructionMaterial` são escritas por 7 e 5 pacotes e lidas por um.
A spec 019 pôs `solids` no mesmo canal: quando a lista não é válida, a malha "volta a ser medida pelo desenho" (`evidence.md`, A1) sem avisar
ninguém. Um erro no construtor vira a adivinhação antiga, em silêncio.

**Três decisões da spec 019 que mudaram a régua em vez do código** (todas declaradas no `evidence.md` ou no PR, nenhuma escondida):
- a guarda `hollow-test.mjs` passou a pular peça redonda (foi assim que `lantern_lamp` saiu da lista);
- `solids` entrou nas chaves que o golden bit a bit não lê (`tools/golden/src/exact-snapshot.ts`), então um sólido errado não muda golden nenhum;
- cilindro, cone e esfera colidem pela caixa da própria primitiva (dívida declarada).

### 2.3 Caminhos duplicados

| O quê | Números |
|---|---|
| Gerar colisor | 5 caminhos: `builtSolidsOf`, `hollowBoxesOf`, `fitOrientedBoxes`, `measureStaticPart`, `collider-fit.ts` |
| Catálogo de móveis | `game-floorplan-three/src/furniture/` (14 arquivos, 1.754 linhas) ao lado de `game-interactables-household` (4.206) e `game-props3d` (1.535); as 14 peças de `KNOWN` são do catálogo antigo |
| Física fora do Jolt | `game-test-room/src/own-locomotion.ts` (236 linhas, `GRAVITY = 13`), `game-crowd/src/physics/`, `game-vehicles-driving` (1.952) ao lado de `game-physics-jolt/src/vehicles.ts` (241) |
| Hospedeiro | a sala usa `createKitWorldSync` mas com física própria (`room.ts:236`); `createPhysicsLoop` é chamado em 4 lugares |
| Orçamento de quadro | três relógios próprios restantes: `fluids-three/src/film/manager.ts:17`, `physics/src/work-budget.ts:27`, `floorplan-three/src/house/shadow-batches.ts:12` |
| Utilitários copiados | `clamp` em 45 arquivos de 27 pacotes; gerador mulberry32 em 28 arquivos; FNV em 23; `GRAVITY` em 15 arquivos com três valores (9.81, 9.8, 13) |

A sala em que o dono testa não roda a física que o jogo vai rodar por padrão (`room.ts:236`: "its own physics... never 'jolt'"). Defeito achado
na sala pode não existir no jogo, e o contrário também **[inferência]**.

### 2.4 Código de produto fora dos pacotes

- `packages/game-test-room/src/room.ts`: 5.225 linhas; a regra 15 pede menos de 1.200 e só exige que não cresça
  (`specs/regras/15-quadro-e-desempenho.md:95,108`). Dentro dele há lógica de jogo: empurrar móvel (`:1326`), traçar tiro (`:2264`), golpe (`:2476`),
  recarga (`:4251`), comer e beber (`:3234-3335`), água (`:3507`). O #596 acrescentou fome e sede ao mesmo pacote. Isso contraria a regra 4
  ("nada de arma, carro ou móvel neles").
- `examples/`: só `reference-district` está no workspace pnpm; `**/*.mjs` está fora do lint (`eslint.config.mjs:10`); 94 arquivos `.js`/`.mjs` com
  14.998 linhas. Lógica que um jogo teria de copiar: `reference-district/src/game/`, `interactables-showroom/src/showroom.js` (cerca de 2.800 linhas,
  com laço próprio), `interactables-test-area/src/area.js` (728), `test-room/src/main.js` (monta 13 SDKs).
- `game-vehicles` é núcleo mas opera o grafo de cena: 51 `setFromObject`/`computeBoundingBox`, 64 leituras de `attributes.position`, 199 `userData`. O
  three entra injetado, então a regra 2 vale na letra e não no efeito.
- 15 arquivos de `packages/*/src` passam de 1.500 linhas (`game-destruction/src/world.ts` tem 6.674; `renderer.ts`, 4.291). O limite é só aviso
  (`eslint.config.mjs:62`).

## 3. Validação: por que o dono ainda acha os defeitos à mão

### 3.1 As guardas, o que olham e o que escapa

| Guarda | Onde roda | O que olha de fato | O que escapa |
|---|---|---|---|
| eslint, typecheck, `check-packages`, `check:layers` | pre-commit, CI | estilo, tipos, camadas (294 violações conhecidas) | comportamento |
| `tools/pre-push/checks.mjs` | pre-push | build, lint, typecheck e testes **só dos pacotes alterados** | dependentes; pulado com `--no-verify` (5 dos últimos 60 PRs: #549, #556, #557, #581, #596) |
| `kit-audit --check` | CI | peça desenhada fora do SDK dono, relógio próprio | 21 permitidos, 9 pendentes |
| `z-fighting.test.ts` (18 arquivos) | CI | faces coincidentes da peça **parada** | peça quebrada ou em pose; 16 listas de dívida |
| `solids-catalogue.test.ts` | CI | todo vértice dentro de exatamente um sólido | se o motor usa esses sólidos; só estático |
| `hollow-catalogue.test.ts` | CI | raios nas caixas do motor, móvel inteiro e solto | 14 peças em `KNOWN` (inclui `shelf_unit`); móvel dentro de casa |
| `broken-catalogue.test.ts` | CI (vermelho agora) | quebra **só os pés**, simula 5 s, confere apoio | peça ainda acordada é isenta (`:85`, `if (piece && !piece.sleeping) return false`); quebra parcial em outro lugar |
| `construction*.test.ts` (6) | CI | validador estrutural da casa recém-gerada | casa depois de dano |
| Goldens bit a bit (109 JSON) | CI | bytes iguais ao gravado | tudo o que o golden não lê; regravados com frequência (abaixo) |
| Equivalência e determinismo (8 arquivos) | CI | mesma cena fixa dá o mesmo resultado em dois caminhos | cena fixa |
| `game-test-room/tests` (90 arquivos) | CI | sala em Node, uma interação roteirizada por teste | sequência de interações, render |
| `shapes-bench --cost-check` | CI | custo de desenho do construtor | uso |
| `ci-ok` | CI | agrega os jobs | **não é obrigatório**: a main não tem proteção |
| Rodada diária (`nightly-gpu.mjs`) | timer 04:30 | 15 `test.mjs` de área, `scene.mjs`, `cost.mjs`, `leak.mjs`, `perf-gate`, `room-explosion` | vermelha há 14 dias; só avisa na área de trabalho |
| `room-determinism.mjs`, `rain-cover-shots.mjs` | só à mão | mesma explosão, hash por tick | ninguém chama |
| 20 scripts de navegador em `examples/` | ninguém chama | `settle-test`, `hollow-test`, `push-test`, `hands-test`, `doors-twist` e outros | tudo |
| Invariante em execução (`onBrokenChecked`, regra 12) | no jogo | objeto quebrado sem apoio, no update seguinte à quebra | só esse caso; registra no log da sala e ninguém coleta |

Classificação por família: 6 são exemplo fixo ou golden, 8 são invariante sobre catálogo parado, 6 olham o mundo depois de alguma interação. Das 6
que olham o mundo depois de interação, só `broken-catalogue` roda no CI, e com uma interação só. As outras estão na rodada diária ou órfãs.

### 3.2 As cinco causas

**Causa 1 — a guarda que olha a sala real não tem consequência.** A regra 9 diz: "Main com a rodada diária vermelha é a primeira coisa a corrigir
no dia". Os arquivos `STATUS` em `~/Documents/personal/adatechnology-game-kit-shots/nightly/` mostram `PASSED` em 13/11 e `FAILED` em todos os dias de
14/11 a 27/11. Em 27/11 a rodada morreu em 45 s no build da página (`Could not resolve "@adatechnology/game-vehicles/worker-kinds"`): nenhuma página
abriu. Os logs de 15 a 26/11 trazem sinais que ninguém tratou: `explosives_push_grenade` vermelho, `furniture_chair_thrown_at_wall: Impactos 0`,
`house_complete_trials: 171 de 174`. A falha só chama `notify-send` (`nightly-gpu.mjs:68-70,181-184`); não abre issue, não segura merge.

**Causa 2 — scripts escritos e nunca ligados.** `git grep` na `origin/main` não acha chamador para `hollow-test`, `settle-test`, `push-test`,
`hands-test` nem `doors-twist` em `tools/`, `.githooks`, `.github`, `package.json` ou nos `test.mjs`. O corpo do #575 e a regra 12 dizem que
`hollow-test.mjs` é guarda "da sala / rodada diária"; ele não está na lista de `browser-checks.mjs:95-104`. `settle-test.mjs` (explode todo móvel e
reprova peça acordada que continua se mexendo) descreve exatamente o sintoma da casinha.

**Causa 3 — as guardas conferem a peça parada; os defeitos aparecem depois de uma sequência.** Os cinco sintomas de 27/11:

| Sintoma | Por que nada pegou |
|---|---|
| Lascas sambando na casinha | `broken-catalogue` isenta peça acordada e só quebra pés (fato); `settle-test` é órfão (fato) |
| Tábua da estante no ar | só pés são quebrados, móvel sozinho; `shelf_unit` está na dívida `KNOWN` (fato). A tábua fica no ar depois de quebra parcial no meio **[inferência]** |
| Rodapé intacto após explosão | os testes são cenários fixos (`wall.test.ts:104-108,196`, `blast-trim.test.ts:23`); falta o invariante "acabamento cujo suporte quebrou não fica" **[inferência]** |
| Piso que some ao andar | nenhuma guarda anda e confere o chão desenhado **[inferência]** |
| Arma mudando de posição | `hands-test.mjs` é órfão (fato); os testes do CI rodam sem render e sem troca de câmera em sequência **[inferência]** |

Não há teste gerativo: `rg -l fast-check` dá zero. Não há gravação de entrada. A semente é por subsistema, com 24 `Math.random` em 16 arquivos de
`src`. Cada invariante vive dentro de um cenário; não existe um conferidor de mundo que se aplique depois de qualquer ação.

**Causa 4 — o golden virou ruído.** Em 14 dias, 72 de 1.056 commits da main tocaram os fixtures de golden; `exact-floorplan.json` foi tocado 37
vezes. Um teste regravado cinco vezes por dia não distingue regressão de mudança pretendida: quem regrava decide. E o golden bit a bit só protege o
que lê.

**Causa 5 — a guarda é ajustada quando reprova.** Em 27/11: peça redonda pulada no `hollow-test`, `solids` fora do snapshot, `--no-verify` no push
do #596, e "falhas vistas e descartadas" no `evidence.md` (quatro testes que falham com a máquina carregada e passam sozinhos). Cada decisão tem
justificativa escrita. Somadas, significam que a sessão que escreve o código também decide se a régua vale.

### 3.3 Como validar sem depender do dono

O que já existe e serve de base: `window.__testRoom` (`walk`, `look`, `push`, `kick`, `use`, `spawn`, `throwHeld`, `tool`, `update`, `resetAll`,
`metrics`; `examples/test-room/src/main.js:211-212`), `world.serialize()`, os predicados `rests`, `boxesHoldingAir`, `coincidentFacesOf`,
`unsupportedCells`, o roteirizador do distrito (`examples/reference-district/src/test/`, 901 linhas com `actions`, `scripts`, `runner`, `hash`) e
`room-determinism.mjs`.

1. **Conferidor de mundo único.** Uma função pura, num pacote, que recebe o mundo e devolve as violações: transformação com NaN, peça abaixo do
   chão, peça parada sem apoio, peça acordada há mais de N segundos sem entrada nova (o "sambar"), sólido de colisão com ar dentro, colisor sem
   desenho, acabamento sem suporte. Reúne os predicados que hoje estão dentro de testes. Liga por opção no jogo e sempre nos testes.
2. **Testes de propriedade sobre o conferidor** (Node, CI). Sequências aleatórias de ações — quebrar uma parte qualquer, explodir, empurrar,
   atirar, empilhar — sobre cada peça do catálogo e sobre uma casa pequena, com o conferidor depois de cada passo. A falha sai com a semente e a
   sequência encolhida. É o que troca "só os pés" por "qualquer parte".
3. **Robô de uso na rodada diária.** Dirige a sala pela `__testRoom` com semente, alguns minutos por área, com o conferidor ligado e a entrada
   gravada. Roteiro com marcadores, não aprendizado por reforço (seção 5).
4. **Replay determinístico.** Entrada e semente gravadas; hash do estado por passo. Todo defeito achado pelo dono vira um replay versionado que
   reprova até ser corrigido. Depende de semente única e de zero `Math.random` na simulação.
5. **Prova de que a guarda pega.** Cada guarda nova entra com um teste de mutação: religar a adivinhação antiga por opção e exigir que a guarda
   reprove. Sem isso, uma guarda verde não diz nada.

## 4. Processo

Medido em 2026-11-28:

| Fato | Valor | Como conferir |
|---|---|---|
| Worktrees | 94 (o pedido falava em 89) | `git worktree list \| wc -l` |
| Worktrees cujo HEAD já está na main | 46 de 93 | `git merge-base --is-ancestor` em cada um |
| Worktrees com último commit há 7 dias ou mais | 20 | idem |
| PRs mergeados por dia (UTC) | 10, 11, 16, 22, 46, 12, 37 de 21 a 27/11 | `gh pr list --state merged --search "merged:>=2026-11-21"` |
| Commits sem merge desde 20/11 | 638; 190 começam por `fix` (30%) | `git log origin/main --since=2026-11-20 --no-merges` |
| Duração do CI verde | 13–14 min | `gh run list --branch main --workflow CI --status success` |
| CI da main desde 27/11 00:00Z | 20 verdes, 7 falhas, 26 cancelados | `gh run list --branch main --workflow CI` |
| CI da main depois de 23:01Z de 27/11 | nenhum verde: 2 falhas, 18 cancelados | idem |
| Proteção da main | nenhuma; `rulesets` vazio; auto-merge desligado | `gh api repos/.../branches/main/protection` dá 404 |
| Causa dos cancelamentos | `concurrency: ci-${{ github.ref }}` com `cancel-in-progress: true` também na main | `.github/workflows/ci.yml:8-10` |
| PRs mergeados com o CI ainda rodando, que terminou vermelho | #575, #579, #580, #581 | `gh pr view` |
| #596 | mergeado às 03:06Z com `game-floorplan-three 7/10` em falha e 5 jobs sem terminar; o run dele na main foi cancelado 43 s depois pelo merge do #592 | `gh pr view 596 --json statusCheckRollup` |
| Sala 4280 | servida de `adatechnology-game-kit-wt/sala-4280-main`, parada em `ec022d029`, página feita às 22:56 de 27/11; a main já andou | `readlink /proc/<pid>/cwd` |

**Diagnóstico.** Os cancelamentos em sequência não são um acidente: o arquivo de CI manda cancelar. Com um merge a cada poucos minutos e 13 minutos
de CI, quase nenhum commit da main é validado, e quando a main quebra ninguém sabe qual merge quebrou (`laundry_tub` apareceu entre 23:56Z e 01:27Z,
num intervalo com 15 runs cancelados). O #596 juntou a spec 019 e nove PRs, quatro deles rascunhos "não revisados além de build, typecheck e testes",
num só merge de 2.458 linhas: o contrário de um commit isolado por mudança.

**O que mudar.**

1. **Main protegida, com `ci-ok` obrigatório e branch em dia com a main.** É a única forma de impedir que uma sessão mergeie no vermelho. A regra
   "posso mergear PR com CI verde" já existe; ela não foi seguida em pelo menos cinco PRs de 27/11.
2. **Fila de merge.** A fila nativa do GitHub testa cada PR sobre a base mais nova e os PRs à frente
   (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
   **[não conferido]** se ela está disponível para repositório público de conta pessoal: a página não diz, e este repositório não é de organização.
   Alternativa que não depende disso: `ci-ok` obrigatório com "branch em dia" e auto-merge, o que já serializa; ou uma sessão única com o papel de
   mergear, no modelo do bors (https://github.com/bors-ng/bors-ng).
3. **Main não cancela.** `cancel-in-progress` só para PR. Na main, todo commit termina o CI.
4. **Main vermelha para a linha.** Nenhum merge até voltar ao verde; reverter é o caminho padrão. É a regra da Rare ("no further commits are
   permitted until a change is rolled back") e do capítulo 23 do livro de engenharia do Google (seção 5).
5. **Limite de trabalho em andamento.** No máximo 3 sessões abrindo PR no kit ao mesmo tempo e 5 PRs abertos. Trinta e sete merges por dia com 30%
   de `fix` são retrabalho, não vazão. Vale conferir quantos desses `fix` corrigem algo que entrou na mesma semana **[não conferido]**.
6. **Dono da sala 4280.** Um serviço só, que refaz a página a cada main **verde** e mostra o commit na tela. Hoje o dono testa uma página de um
   worktree que já ficou para trás; um defeito que ele relata pode ser de um commit que nenhuma sessão está olhando. Não conferi se a página já
   mostra o commit na tela (ela grava `pageBuild`, regra 15).
7. **Worktrees.** Remover os 46 já contidos na main; a sessão que cria remove (regra já escrita no `CLAUDE.md` global). O limpador diário só remove
   os parados há 7 dias, e por isso não dá conta.
8. **Golden regravado pede um segundo par de olhos.** PR que toca fixture de golden leva um rótulo e não é mergeado pela sessão que o escreveu.

## 5. Comparação com referências

Só entra o que foi aberto e lido. O que ficou de fora está em 5.3.

### 5.1 Tabela comparativa

| Tema | Referência | O que faz | O kit hoje | Veredito |
|---|---|---|---|---|
| De onde vem a colisão | Jolt: a forma é dado próprio (`ShapeSettings`), convertida e guardada em cache; composto estático ou mutável; malha dinâmica "cannot calculate their mass and inertia" — https://jrouwe.github.io/JoltPhysics/ | forma declarada na origem | spec 019 para malha própria; adivinhação no resto (2.2) | existe e deve melhorar |
| | Nystrom, *Component*: o volume de colisão pertence ao componente de física e não conhece o gráfico — https://gameprogrammingpatterns.com/component.html | separação | `userData` não tipado como canal | existe e deve melhorar |
| | Ericson, *Real-Time Collision Detection*, seção 2.2.2 "Collision versus Rendering Geometry" (só o índice foi conferido) — https://shop.elsevier.com/books/real-time-collision-detection/ericson/978-1-55860-732-3 | geometrias separadas | idem | — |
| | Teardown: o volume de voxels é a própria colisão; oco é oco por construção — https://80.lv/articles/teardown-developer-breaks-down-multiplayer-and-voxel-destruction-tech | sem aproximação | lista de caixas giradas | certo para um kit de malha; não migrar para voxel |
| Suporte estrutural | Blast: grafo de suporte, ligação com centroide, normal e área; ilha nova vira ator — https://archive.docs.nvidia.com/gameworks/content/gameworkslibrary/blast/1.1/api_docs/files/pageintroduction.html | adjacência declarada | `inferJoints` por toque (`world.ts:813`); caminho de carga só na casa | falta e deve entrar |
| | Chaos: "a connection graph is initialized based on each fractured rigid body's nearest neighbors" — https://dev.epicgames.com/documentation/en-us/unreal-engine/destruction-overview | grafo na origem | idem | falta e deve entrar |
| | Red Faction: Guerrilla: "Artists had to become structural engineers" — https://www.cbsnews.com/news/red-faction-guerrilla-q-a | estrutura real | regra 11 e validador estrutural | certo, mantém |
| Orçamento da destruição | Guerrilla (Schneider, GDC 2009): destruição grande calculada diferente da pequena — https://www.gamedeveloper.com/design/gdc-2009---day-5-4---those-who-seek-destruction-find-luke | dois regimes | `FrameBudget`, filas com prazo (regra 15) | certo, mantém |
| Passo fixo | Fiedler, "Fix Your Timestep!" — https://gafferongames.com/post/fix_your_timestep/ ; Nystrom, *Game Loop* — https://gameprogrammingpatterns.com/game-loop.html | acumulador, desenho interpolado | regra 15, `step-equivalence.test.ts` | certo, mantém |
| Determinismo testado | Box2D v3: teste "Falling Hinges" em todo PR, compara passos até dormir e hash das transformações — https://box2d.org/posts/2024/08/determinism/ | hash no CI | cenas fixas no CI; `room-determinism.mjs` só à mão | existe e deve melhorar |
| | Jolt "Check Determinism": grava o estado, volta, refaz o passo e compara; cada build confere várias cenas, incluindo WASM — https://jrouwe.github.io/JoltPhysics/ | refazer o passo | não há | falta e deve entrar |
| | Factorio: CRC de mapas pequenos; "heavy mode" salva e recarrega a cada tick, a cada commit — https://factorio.com/blog/post/fff-60 , https://factorio.com/blog/post/fff-315 | estado fora do snapshot aparece | não há | falta e deve entrar |
| Destruição como comandos | Teardown: "each breakage event is split into a stream of deterministic commands" — https://blog.voxagon.se/2026/03/13/teardown-multiplayer.html | fluxo reproduzível | eventos com classe (`EVENT_CLASS`), sem gravação | existe e deve melhorar |
| Replay de entrada | Provinciano, GDC 2015: bugs "100% reproducible" (só a descrição da palestra) — https://www.gdcvault.com/play/1021825/Automated-Testing-and-Instant-Replays ; Age of Empires — https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond | defeito vira replay | não há | falta e deve entrar |
| Robô que joga | Croteam: bot por marcadores, sem render, fecha o jogo em cerca de 20 min — https://blog.playstation.com/archive/2015/09/25/how-croteam-built-a-bot-to-beat-its-ps4-puzzler-the-talos-principle/ ; Ubisoft, The Division — https://www.gamedeveloper.com/design/the-secret-ai-testers-inside-tom-clancy-s-the-division | acha "ficou preso" e colisão | `__testRoom` e o roteirizador do distrito, sem robô | falta e deve entrar |
| | EA SEED: aprendizado por reforço aumenta cobertura, mas levar à produção é "fundamentally a hard problem" — https://arxiv.org/abs/2103.15819 , https://arxiv.org/abs/2307.11105 | — | — | não fazer agora |
| Teste funcional com espera por estado | Riot: cerca de 5.500 casos em 18 min por build; nunca espera por tempo, só por condição; teste novo fica uma semana em quarentena — https://www.riotgames.com/en/news/automated-testing-league-legends | sem teste instável na frente do merge | 4 testes instáveis sob carga "descartados" | falta e deve entrar |
| Teste de propriedade | fast-check, teste baseado em modelo: comandos, falha encolhida e reproduzível por semente — https://fast-check.dev/docs/advanced/model-based-testing/ | sequências que ninguém escreveu | zero | falta e deve entrar |
| | PhyFu (ASE 2023): leis da física como oráculo; mais de 5 mil entradas com resultado errado em 4 motores — https://arxiv.org/abs/2307.10818 | oráculo sem valor esperado | não há | falta e deve entrar |
| Asserts de desenvolvimento | PhysX "checked build" — https://nvidia-omniverse.github.io/PhysX/physx/5.4.1/docs/BuildingWithPhysX.html ; Unreal `ensure` — https://dev.epicgames.com/documentation/en-us/unreal-engine/asserts-in-unreal-engine | avisa no momento do erro e segue | só `onBrokenChecked` | existe e deve melhorar |
| Depuração visual | Chaos Visual Debugger grava e reproduz a simulação — https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-visual-debugger-in-unreal-engine ; Jolt `DebugRenderer` | ver a forma de colisão sobre a malha | não conferi se a sala desenha os sólidos do motor | **[não conferido]** |
| Regressão visual | Unreal: tolerância porque "there's some constant variability in every pixel's color" — https://dev.epicgames.com/documentation/en-us/unreal-engine/screenshot-comparison-tool-in-unreal-engine | imagem com tolerância | bit a bit para estado; prints sem comparação automática | bit a bit para estado está certo; imagem fica para depois |
| Main sempre verde | Rare: "no further commits are permitted until a change is rolled back" — https://www.gamedeveloper.com/design/how-rare-automates-testing-for-ai-and-more-in-sea-of-thieves-part-4-of-4- ; Fowler — https://martinfowler.com/articles/continuousIntegration.html | parar a linha | main vermelha, merges seguem | falta e deve entrar |
| Pré-merge rápido e confiável | *Software Engineering at Google*, cap. 23: "only fast, reliable ones" — https://abseil.io/resources/swe-book/html/ch23.html | lento e instável ficam depois do merge, com consequência | a divisão existe (regra 9); a consequência não | existe e deve melhorar |
| Fila de merge | GitHub merge queue; bors (dois PRs verdes que quebram juntos) — https://github.com/bors-ng/bors-ng | testa o lote sobre a base nova | nenhuma | falta e deve entrar |

Repositórios abertos comparáveis para copiar a forma dos testes: Jolt (`UnitTests`, `PerformanceTest`, https://github.com/jrouwe/JoltPhysics), Box2D v3,
e Godot-Physics-Tests (cenas em código com monitores por prazo e testes marcados como falha esperada, https://github.com/fabriceci/Godot-Physics-Tests).

### 5.2 Onde as referências fazem diferente de "cada peça é uma lista de caixas giradas"

1. **Teardown** não aproxima: o que se desenha é o que colide. Não serve de modelo para um kit de malha, mas mostra o alvo: zero distância entre
   desenho e colisão.
2. **Blast e Chaos** guardam, além das formas, **o que segura o quê** (ligação com área e normal). A lista de sólidos da spec 019 não diz isso; a
   junta ainda é inferida por toque. Tábua da estante no ar e rodapé intacto são defeitos de suporte, não de forma **[inferência]**.
3. **Jolt** tem casco convexo, cilindro e esfera nativos e separa composto estático de mutável. Caixa para tudo é uma escolha do kit, não do motor.
4. **Frostbite** gera a forma automaticamente e deixa o artista corrigir (Kihl, SIGGRAPH 2010,
   https://www.advances.realtimerendering.com/s2010/Kihl-Destruction%20in%20Frostbite(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf).
   O kit não tem artista; o papel da correção manual tem de ser de um teste.

### 5.3 O que não foi possível conferir

- Eric Arnold, "Living in a Stressful World" (Red Faction: Guerrilla): não achei a palestra nem o artigo; o título pode estar errado.
- *Real-Time Collision Detection* e *Game Engine Architecture*: só os índices (Gregory, cap. 14 "Collision and Rigid Body Dynamics" e 10.2 "Debug
  Drawing Facilities", https://www.gameenginebook.com/toc.html). Não cito o texto.
- *Physically Based Rendering*: não coube; nada nesta análise é de renderização.
- The Finals: só a descrição da palestra da GDC 2024 (https://gdcvault.com/play/1034307/Engineering-Mayhem-Technical-Deep-Dive). Destruição no
  servidor não tem fala aberta de desenvolvedor.
- Palestra do Jolt na GDC 2022 e vídeos das palestras de Sea of Thieves, The Division, DICE AutoPlayers e Retro City Rampage: só as descrições.
- Chaos: tipos de colisão (implícita, convexa, level set) e ancoragem não estavam nas páginas abertas. Frostbite: física e Destruction 2.0/3.0.
- "Not Rocket Science Rule" (Graydon Hoare): página fechada; uso só o mecanismo, pelo README do bors.
- Havok Destruction, Bullet `btCompoundShape`, Noita: não pesquisados ou só o título.

## 6. Plano priorizado

Custo em dias de uma sessão com revisão. A ordem é a de execução. Os itens 1 a 4 não criam nada novo: fazem valer o que já existe.

| # | Item | Classe | Custo | Critério de aceite (comando) |
|---|---|---|---|---|
| 1 | **Parar a linha.** Corrigir `broken-catalogue/laundry_tub` (ou reverter o merge que o quebrou); nenhum merge antes disso | existe e deve melhorar | 0,5 | `gh run list --branch main --workflow CI --limit 1 --json conclusion --jq '.[0].conclusion'` imprime `success` |
| 2 | **Main protegida e sem cancelar.** `ci-ok` obrigatório, branch em dia, auto-merge ligado; `cancel-in-progress` só em PR; fila de merge se a conta permitir | falta e deve entrar | 0,5 | `gh api repos/Andersonfrfilho/adatechnology-game-kit/branches/main/protection --jq '.required_status_checks \| .strict, .contexts'` imprime `true` e contém `ci-ok`; depois de 24 h, `gh run list --branch main --workflow CI --limit 30 --json conclusion --jq '[.[] \| select(.conclusion=="cancelled")] \| length'` imprime `0` |
| 3 | **Rodada diária verde e com consequência.** Corrigir o build da página; a falha abre (ou atualiza) uma issue `nightly-red` e o pre-push recusa push enquanto ela estiver aberta há mais de um dia | existe e deve melhorar | 1–2 | `head -c 6 ~/Documents/personal/adatechnology-game-kit-shots/nightly/$(date +%F)/STATUS` imprime `PASSED`; `gh issue list --label nightly-red --state open --json number --jq length` imprime `0` |
| 4 | **Nenhum script de navegador órfão.** Os 20 entram em `browser-checks.mjs` ou são apagados; um teste de CI lista `.mjs` de teste sem chamador | existe e deve melhorar | 1 | `node tools/ci/orphan-scripts.mjs --check` (novo) sai com 0; `grep -c "settle-test\|hollow-test" tools/gpu/browser-checks.mjs` maior que 0 |
| 5 | **Limite de trabalho e limpeza.** Remover os worktrees já contidos na main; no máximo 5 PRs abertos e 3 sessões abrindo PR; PR que toca golden leva rótulo e outro revisor | falta e deve entrar | 0,5 | `git worktree list \| wc -l` imprime 15 ou menos; `gh pr list --state open --json number --jq length` imprime 5 ou menos |
| 6 | **Conferidor de mundo único** (`checkWorldInvariants`), reunindo `rests`, `boxesHoldingAir`, NaN, abaixo do chão, acordado sem entrada, acabamento sem suporte; ligado em todo teste que simula e, por opção, na sala (`window.__invariantFailures`) | falta e deve entrar | 2–3 | `pnpm --filter @adatechnology/game-destruction-three test -- world-invariants` passa; com a adivinhação antiga religada por opção (`KIT_COLLIDER=guess`, nova), o mesmo comando **falha** citando `dog_house` |
| 7 | **Testes de propriedade** (fast-check) no CI: sequências aleatórias de quebrar, explodir, empurrar e atirar em cada peça do catálogo e numa casa pequena, com o item 6 depois de cada passo; semente no log | falta e deve entrar | 3–4 | `FC_NUM_RUNS=200 pnpm --filter @adatechnology/game-floorplan-three test -- property` passa em menos de 5 min; `rg -l fast-check packages/*/tests \| wc -l` maior que 0; a quebra só dos pés sai de `broken-catalogue` |
| 8 | **Fechar a spec 019.** Os sólidos atravessam a fusão (`ivAccumulate`, faixas de malha); o catálogo antigo de móveis do floorplan sai; a queda para adivinhação é contada e reprova | existe e deve melhorar | 5–8 | `rg -n "KNOWN" packages/game-floorplan-three/tests/hollow-catalogue.test.ts` mostra a lista vazia; `node examples/test-room/hollow-test.mjs` sai com 0 e imprime `guessed: 0` para móvel dentro de casa; `ls packages/game-floorplan-three/src/furniture \| wc -l` imprime 0 |
| 9 | **Robô e replay na rodada diária.** Semente única (zero `Math.random` na simulação), entrada gravada, robô por marcadores dirigindo `__testRoom` com o item 6 ligado; todo defeito achado à mão vira arquivo em `tests/replays/` | falta e deve entrar | 5–7 | `rg -c "Math\.random" packages/*/src \| wc -l` imprime 0; `node tools/gpu/room-bot.mjs --seed 1 --minutes 5` (novo) sai com 0 e grava `invariantFailures: 0`; `node tools/gpu/room-replay.mjs tests/replays/*.json` (novo) dá o mesmo hash em duas rodadas |
| 10 | **Dado declarado em vez de deduzido.** Contrato tipado para o que hoje vai em `userData` (`game-contracts`); regra `guessed-semantics` no `kit-audit` com lista que só diminui (regex de id, material pelo nome, zona de veículo pela medida); material desconhecido é erro, não `'plastic'` | existe e deve melhorar | 1 para a regra, depois contínuo | `node tools/kit-audit/audit.mjs --check --rule guessed-semantics` (nova) sai com 0 contra a lista gravada; `rg -c "userData\.[a-zA-Z]+ as " packages/*/src \| awk -F: '{s+=$2} END {print s}'` menor que 63 |

**O que fica fora de propósito:** forma redonda exata no motor, comparação de imagem com tolerância, robô por aprendizado, voxel, e tirar a lógica
de jogo de `room.ts`. São reais, mas nenhum deles impede o dono de achar o próximo defeito à mão; os itens 1 a 7 impedem.

**Depois do item 8**, o passo seguinte de arquitetura é o construtor declarar também as ligações entre as primitivas (o grafo de suporte de Blast e
Chaos), para a junta deixar de ser inferida por toque.

## 7. O que precisa ser dito sem rodeio

- **O kit tem 15 regras e um problema de cumprimento.** A regra 9 já manda corrigir a rodada vermelha antes de tudo; ela ficou 14 dias vermelha
  enquanto entravam 638 commits. Escrever a regra 16 depois desta análise seria repetir o padrão. O plano acima tem zero regra nova nos quatro
  primeiros itens.
- **Guarda que a própria sessão pode desligar não é guarda.** `--no-verify`, lista de dívida, peça pulada, chave fora do golden, merge com check
  vermelho: tudo isso está ao alcance de quem escreve o código, e foi usado em 27/11. Os itens 2, 3 e 5 tiram essas decisões da sessão.
- **"A dívida só diminui" só vale se alguém contar.** Há pelo menos seis listas (14 móveis, 16 de z-fighting, 294 de camadas, 30 do kit-audit, 28
  `any`, `room.ts`). Não medi a tendência delas **[não conferido]**; sem um número semanal, a frase é uma intenção.
- **Um merge de 81 arquivos com nove PRs juntos, quatro sem revisão, foi pedido pelo dono.** Ele economizou uma noite e custou a rastreabilidade:
  se algo quebrar, o `git bisect` aponta para o #596 inteiro.
- **Mais sessões em paralelo não é mais entrega.** Com 30% dos commits sendo `fix`, o gargalo é a validação, e ela não se paraleliza abrindo mais
  sessões.

## 8. Arquitetura e futuro do projeto

As seções 2 a 6 respondem "por que o defeito escapa". Esta responde "para onde a arquitetura deve ir". Há mais opinião aqui do que nas outras; o
que é fato tem a evidência ao lado.

### 8.1 A malha é a fonte de verdade, e não deveria ser

Hoje o construtor desenha uma malha e todo o resto é deduzido dela: colisão (vértices), material (nome), zona de dano do veículo (medida), junta
(toque), papel estrutural (regex do id), farol (brilho). A lista da seção 2.2 é um defeito só, repetido 14 vezes. A spec 019 inverteu isso para a
forma de colisão de um tipo de peça.

A direção é inverter para tudo: **o construtor produz uma descrição da peça** (primitivas, material, papel, ligações entre partes, sólidos, zonas)
e a malha, o colisor, o grafo de suporte e as zonas de dano são **derivados** dela. É a separação entre dado primário e dado derivado do capítulo
*Dirty Flag* de Nystrom (https://gameprogrammingpatterns.com/dirty-flag.html) e é como Blast e Chaos guardam uma peça destrutível (seção 5).
Consequências práticas:

- `userData` deixa de ser o contrato entre pacotes; passa a ser só o ponteiro da malha para a descrição tipada.
- A adivinhação deixa de ser o caminho padrão com exceções e vira erro contado.
- As ligações declaradas dão o grafo de suporte para móvel, veículo e acabamento, não só para a casa. É onde estão a tábua no ar e o rodapé
  intacto **[inferência]**.

Custo: alto e gradual, uma família por vez (household já começou; depois catálogo antigo de móveis, casa, veículo). É o item 8 e o 10 do plano,
com um nome.

### 8.2 O kit não tem um jogo, e a sala está virando um

- 66 pacotes e cerca de 450 mil linhas em `packages/*/src`.
- O `package.json` do `zombiada` não depende de nenhum `@adatechnology/game-*` (conferido em `~/Documents/personal/zombiada/package.json`).
  O kit não tem consumidor.
- A lógica de jogar (empurrar, atirar, golpear, recarregar, comer, beber, fome e sede) mora em `game-test-room` (seção 2.4).
- A spec 011 (cena de referência "só pela API pública") está "em execução" desde 24/11 e diz o motivo certo: pronto "se prova numa cena de jogo que
  usa todos os pacotes do SDK, não na sala de testes".

O risco: quando o jogo começar, ele vai copiar `room.ts`, porque é lá que a integração entre os SDKs existe. O "teste do GTA" (regra 2) não foi
feito nenhuma vez; generalidade sem um segundo consumidor é hipótese. O que falta é um pacote de jogo (hospedeiro: laço, jogador, uso de item,
tiro, interação) que a sala e a cena de referência consumam igual, e a cena de referência como **o** critério de aceite do kit.

Isso também resolve um problema de validação: a sala roda com física própria (`room.ts:236`), então o dono testa à mão uma configuração que não é
a do jogo. O #594, aberto agora, trata de as salas de área carregarem o Jolt; não conferi o alcance dele.

### 8.3 Os pacotes dividem por substantivo; os módulos reais são monólitos

`game-destruction/src/world.ts` tem 6.674 linhas, `renderer.ts` 4.291, `room.ts` 5.225, e os arquivos da frota chegam a 5.014. Há 66 pacotes, mas a
complexidade está em cinco arquivos. Dividir mais pacotes não ajuda; o que ajuda é quebrar esses arquivos por fluxo de dado (medir, decidir,
aplicar, desenhar), que é também o que permite testar cada etapa sem montar o mundo. O limite de 1.500 linhas é só aviso; como erro com lista de
dívida, seguiria o padrão que o projeto já usa para `any`.

### 8.4 Conteúdo é código

A frota são mais de 25 mil linhas de TypeScript procedural. Sem artista, é uma escolha defensável: tudo é versionado e determinístico. O preço
aparece nos goldens: mudar uma peça muda bytes, e o golden bit a bit regrava (72 de 1.056 commits em 14 dias). Com a descrição da peça do item 8.1,
o golden passa a ser da descrição (pequena, legível, com diff que um revisor entende) e não da malha assada.

### 8.5 Determinismo é decisão de arquitetura, e ainda não foi tomada por inteiro

Há passo fixo, classes de evento (`EVENT_CLASS`) e testes de equivalência. Faltam semente única (24 `Math.random` em `src`), uma constante de
gravidade (três valores em 15 arquivos) e gravação de entrada. Sem isso não há replay nem teste por hash; com isso, a destruição como fluxo de
comandos (Teardown, seção 5) fica ao alcance, e é também a base de qualquer multijogador futuro. `rg` por `multiplayer|netcode|lockstep` só acha
menções na spec 008: não há decisão registrada. Se multijogador é um objetivo, a decisão tem de vir antes de mais conteúdo; se não é, vale escrever
que não é.

### 8.6 O que esta análise não cobriu

- **Streaming e escala de mundo.** O pedido citava streaming e eu não analisei: não li como o kit carrega e descarrega cidade, casas e física por
  distância, nem medi a cena de referência. As fontes abertas sobre streaming em jogos destrutíveis também renderam pouco (seção 5.3). É um
  levantamento à parte e é o maior risco técnico que ficou sem olhar: destruição total em escala de cidade, no navegador, com Jolt em WASM, não
  tem prova no repositório além da sala **[inferência]**.
- **Desempenho.** Não reli as medições; a regra 15 registra que 108 commits `perf` em 30 dias não reduziram as causas de estrutura do pior quadro
  até a spec 010.
- **A tendência das listas de dívida** (sobem ou descem) não foi medida.

### 8.7 Ordem sugerida para o futuro, depois do plano da seção 6

1. Cena de referência (spec 011) como critério de aceite do kit, jogada pelo robô do item 9.
2. Pacote hospedeiro de jogo, extraído de `room.ts`; a sala passa a ser um cliente dele.
3. Descrição da peça como fonte de verdade, família por família, com as ligações declaradas.
4. Levantamento de streaming e escala, com medição na cena de referência.
5. Só então o ZombiAdA, consumindo o kit pelo npm.

O custo de oportunidade a nomear: cada semana de conteúdo novo no kit sem consumidor aumenta a superfície que a validação não cobre e adia a
única prova que importa, que é um jogo rodando em cima dele.

## 9. Adendo — o que aconteceu enquanto a análise era escrita (28/11, 00:00–03:00 -03)

Três fatos da mesma madrugada confirmam o diagnóstico, e por isso ficam registrados:

1. **Dois PRs entraram com o próprio CI em falha, e nos dois a falha era num pacote dependente** que o pre-push não roda.
   - #594 trocou o `compileAsync` do three por uma espera própria em `game-render-three`; o teste de `game-test-room` que exigia a chamada antiga ficou
     vermelho.
   - #597 afastou as peças rentes dos veículos de 1 a 3 mm e regravou os goldens de `game-vehicles` e da frota, não os de `game-vehicles-three`
     ("ficam para o CI", push com `--no-verify`): 106 testes vermelhos.
   A correção foi o #601. A main voltou ao verde às 05:15Z, depois de seis horas sem um run completo.
2. **Uma correção de z-fighting mudou o colisor.** Entre os 106 testes havia uma regressão real (dois veículos 7 e 9 mm mais compridos que a medida
   do time, porque o emblema engrossou) e 51 falhas nos ledgers de "colisor onde nada é desenhado". No `entry_hatch`, encurtar 30 mm o piso e as
   paredes do cofre do motor fez a contagem subir até 8%. É o item 5 da seção 2.2 na prática: como o colisor do veículo é ajustado aos vértices,
   mexer num enfeite muda a colisão. O ledger subiu por decisão do dono, com a causa escrita no #601.
3. **Já existia no remoto uma branch `fix/main-verde`, de 25/11** (PR #514, "main verde de novo depois de #508, #511 e #512"). Recolocar a main no
   verde por dependente não testado foi feito duas vezes em três dias.

Estado dos itens do plano em 28/11, 03:10 -03: item 1 feito (#601); item 2 pela metade (#605 tira o cancelamento do CI da main; a proteção da branch
depende do dono); item 5 começado (22 worktrees já mergeados e limpos removidos, de 93 para 71).

## 10. Adendo — quem simula o quê, e as verificações que faltam (28/11)

Levantado em 2026-11-28 sobre `69d175833` (main depois do #615), só leitura (`rg`/`sed`); nenhum teste foi rodado. As linhas citadas são desse commit.

**O buraco que as seções 2 e 3 não viram.** A seção 2.2 lista onde o kit *adivinha a forma*. Não lista onde o kit *move coisas por conta própria*. As três
causas da "tábua que gira, fica em pé, sobe e treme" estavam em três sistemas: forma adivinhada (spec 019), alavanca errada numa regra do kit (#610) e
destroço grande simulado por uma física de lasca (#613, raiz na spec 020). As duas últimas são da mesma classe: **uma regra escrita para um tamanho,
aplicada a qualquer tamanho**. Cada uma ganhou um teste de um caso, e o dono achou a seguinte à mão. O que falta é um inventário de quem move e
testes que variem o tamanho sozinhos.

### 10.1 A. Inventário: movimento fora do motor de corpos rígidos

Modelos: **motor** = corpo do contrato (`game-physics/src/contract.ts`, Jolt); **motor+regra** = corpo do motor em que o kit escreve velocidade ou pose
por cima; **próprio** = integrador escrito à mão; **roteiro** = pose animada sem dinâmica.

| # | Onde | O que move | Modelo | Constantes veem o tamanho? | Guarda hoje | Risco |
|---|---|---|---|---|---|---|
| 1 | `game-destruction-three/src/fragments.ts:708-778` (`step`), `:820-845` (`pileUnder`), `:866-891` (`settle`) | todo destroço de fratura, inclusive o `isBig` (`:208-211`, `:469`: tábua de até 4,2 m) | próprio: Euler, chão pelo ponto mais baixo da caixa (`:719-731`), pilha por AABB, sem torque do peso, `settle` gira por `slerp` sem dinâmica | em parte: `TUMBLE_REACH` (`:742`) sim desde o #613; o resto não (10.2) | `long-debris-settles`, `long-debris-lies-down`, `settled-debris`, `fragment-wall`, `fragment-corner-support`, `support-lost`; `broken-catalogue-settles` com 11 móveis em `KNOWN` por destroço que não para | **alto** — já produziu a causa 3 e ainda tem dívida contada |
| 2 | `fragments.ts:503-517` (`blast`), chamado em `renderer.ts:3672` | todo destroço no raio de uma explosão | próprio: soma velocidade e giro | não: a mesma velocidade para 10 g e 30 kg, e o giro em rad/s é o número da velocidade em m/s (`:513`) | `blast-debris*.test.ts` existem; não abri. Nenhum varia tamanho **[inferência]** | **alto** |
| 3 | `game-destruction/src/world.ts:4401` (fratura geral), `:3505`, `:3540`, `:3937`, `:4579` | giro inicial de cada fragmento ao nascer | dado de entrada do item 1 | não: ±6, ±4, ±6, ±10 e ±15 rad/s por eixo, qualquer `f.size` | nenhum (`rg angularVelocity packages/game-destruction/tests` dá zero) | **alto** — a tábua de 4,2 m nasce com a ponta a até ~12 m/s por eixo |
| 4 | `renderer.ts:3009-3072` (`loosenIfFootless`), `:3135-3181` (`checkUndermined`), `:3188-3201` (`goOverIfBalanced`), `:3604-3625` (`tipIfTopHeavy`) | móvel que perdeu pé ou chão | motor+regra: impulso (`pieceSys.impulse`) ou giro escrito direto (`:3068-3069`) | `goOverIfBalanced` sim desde o #610 (`reachAlong`); `EDGE_NUDGE` não; limiares em metros absolutos | `broken-catalogue-spin` (3 tamanhos: largura e fundo; **não** altura, **não** 0,1x, **não** massa); só `drawn-solids.test.ts` cita `undermined` | **alto** — causa 2 |
| 5 | `engine-pieces.ts:1057-1170` (`topple`, `topplePush`), `:936-1019` (`outOfStatics`, levantar do chão), `:1676-1682` (caiu pelo chão), `:1696` (dormir) | peça do motor em equilíbrio estreito, peça nascida dentro de outra | motor+regra: aceleração angular somada, `setPose` (teletransporte), atrito trocado (`PROPPED_GRIP`) | `holdPush` (`:169-177`) é derivado de `g`, braço e inércia; `TOPPLE`, `WEDGE_LIFT`, `SINK`, `STILL_SPIN` não | `topple-energy`, `pieces-tipping`, `asleep-on-steep-top`, `engine-fast-chips` e `engine-ground-worker` (`fellThrough == 0`), `sweep-c6` | médio — só `fellThrough` é contado; os outros teletransportes não |
| 6 | `game-destruction-three/src/pieces.ts` (1.330 linhas) | peças, quando não há motor | próprio: solver de caixas do kit | parcial (`TIP_SECONDS`, `SEPARATE_SPEED` fixos) | `pieces-stack`, `pieces-tipping` e outros | médio — a regra 15 já o congela; não conferi qual caminho a sala 4280 usa hoje |
| 7 | `renderer.ts:2596-2609` | vergalhão solto de um pilar | vira destroço do item 1 (`lasting`) | não: ±0,75 rad/s para qualquer comprimento de barra | nenhum que eu tenha achado | médio |
| 8 | `game-floorplan-three/src/destruction/world.ts:192-210` | peça que cai e fragmentos da casa **sem** renderer (`if (R) return`) | próprio, numa linha: gira 0,5 s e congela no ângulo em que estiver, pousa em `b.hy`; fragmento gira pela velocidade linear | não | `blast-presentation`, `construction-stages` citam `animate`; não abri | médio — só no caminho sem renderer; quem usa esse caminho **[não conferido]** |
| 9 | `game-vfx/src/pools/chunk-motion.ts:15-63`, nascidos em `explosion.ts:214-245` | pedaços de explosão (0,07–0,45 m; `chunks.size` multiplica sem teto) | próprio; repouso arredonda `rx`/`rz` para um quarto de volta; chão = `sy * 0.45` em qualquer orientação | não | `pools.test.ts`, `world.test.ts`, goldens | médio — placa pode parar de pé e meio enterrada **[inferência]**; é só desenho, não colide |
| 10 | `game-vfx/src/workshop/debris.ts:118-140` | 500 caixas das receitas; a maior literal é o capô de `effects/vehicles/boom.ts:21` (1,6 × 0,06 × 1,2 m) | próprio; altura de apoio = metade do **menor** lado em qualquer orientação (`:127`); repouso em quarto de volta | não: `DEFAULT_SPIN = 12`, limiares 0,5 e 0,3 m/s | `workshop-golden` (bit a bit), `debris-contacts.test.ts` | médio — mesma classe da causa 3, em peça de 1,6 m |
| 11 | `game-vfx/src/pools/sparks.ts:64-80`, `puffs.ts`, `sprites/kind-pool.ts:234`, `workshop/meshes.ts:128-143`, `game-vehicles/src/particles.ts:269-319`, `game-weapons-three/src/fx/particles.ts:174` | faíscas, fumaça, partículas | próprio | não importa: sem forma | goldens de vfx | baixo |
| 12 | `game-weapons-three/src/engine-loose.ts:83-98` | cápsula e granada | **motor** (`createBody`, material e resistência de rolagem) | sim: massa pela densidade | `engine-loose.test.ts`, `room-loose-bodies.test.ts`, `casing-level.test.ts` | baixo — é o padrão a copiar |
| 13 | `game-weapons-three/src/box-fx.ts:333-355` | cápsula e carregador quando o host não dá mundo físico | próprio: giro ±10 a ±15 rad/s (`:276`), até 4 quiques | não, mas o tamanho é fixo | `world-effects`, `weapon-samples` | baixo |
| 14 | `game-test-room/src/explosives.ts:579-600`, `:555`, `:666` | projétil sem corpo no motor | próprio; gira a 8 rad/s fixos | não | `explosives.test.ts` | baixo |
| 15 | `game-vehicles/src/explosion.ts:187-190`, `:302-320` (`tickBoom`), `:352-380` (`tickFlying`) | o carro inteiro pula; para-choque voa | roteiro/próprio: `vy = sqrt(2·9,8·(1,0 ou 1,5))` para qualquer veículo, pousa em `B.y0`; peça pousa em `y = P.r` do referencial local | não: moto e ônibus pulam a mesma altura | `destructible.test.ts` cita; não abri | médio — sobe para alto se o mesmo veículo também for corpo do Jolt na cena **[não conferido]** |
| 16 | `game-characters-three/src/instanced/flying-limbs.ts:100-125`, `wounds/flying.ts:70-95` | membros arrancados | próprio; `FLOOR_Y = 0.07` e `FLOOR_OFFSET = 0.08` constantes | não; chão parece ser um plano fixo, não `groundAt` **[inferência]** | `wounds.test.ts`, `instanced-runtime.test.ts` | médio |
| 17 | `game-crowd/src/physics/` (2.151 linhas; `thrown.ts:173-180`), cápsulas cinemáticas em `engine-agents.ts:27` | multidão, corpo arremessado | próprio, com cápsula cinemática no motor | `MAX_SPIN = 8`; corpo de tamanho humano | `physics/thrown`, `determinism`, `state-hash`, `pen`, `knock-down` | baixo — é o subsistema próprio mais bem guardado (hash e determinismo) |
| 18 | `game-contracts/src/blast-knock.ts:95-125` | pessoa derrubada por explosão | próprio (atrito 7 m/s²) | tamanho humano | não procurei | baixo |
| 19 | `game-physics/src/engine-corpses-swap.ts:13-14,264-265` | cadáver ao trocar de nível (ragdoll, cadeia, cápsula) | motor+regra: levanta por passos (`LIFT_MAX = 0.05`, `BIRTH_LIFT_MAX = 3` m) | não | não abri | médio **[só as constantes foram lidas]** |
| 20 | `game-interactables/src/engine-leaf.ts:73-101`, `engine-soft.ts` | porta, gaveta, cortina | motor+regra: `setVelocity` com ganho fixo (`AIM_GAIN = 8`), `setPose` | não | `engine-parts.test.ts` | médio **[inferência: não li o laço inteiro]** |
| 21 | `game-test-room/src/room.ts:685-686` (chute), `:1330-1350` (empurrão), `:2129`, `:2985`, `:3164` (arremesso), `thrown-body.ts:8` | o que o jogador chuta, empurra e joga | **motor**, com impulso derivado (`(1+e)·m·M/(m+M)`, força em N, `velocidade × massa`) | sim, menos `THROW_SPIN = 8` rad/s | `push-load`, `room.test`, `strike`, `hand-use` | baixo |
| 22 | `game-terrain/src/debris.ts:60-80` | torrões de terra | próprio, 2 quiques | não; peças pequenas | `terrain.test.ts` | baixo |

Sem integrador em `src` pelo que o `rg` mostra: `game-items-three`, `game-props3d`, `game-vegetation*` (só geometria e `test-area`). Não abri:
`game-vehicles-driving` (dinâmica própria, 1.952 linhas, já citada em 2.3), `game-animals/src/ragdoll.ts` e `chain.ts`, `game-characters/src/body/ragdoll.ts`,
`game-fluids/src/film/`, `game-player/src/physics-controller.ts`, `own-locomotion.ts` (jogador, `GRAVITY = 13`).

Três leituras do quadro:

- **O padrão certo já existe no repositório**: itens 12 e 21 entregam o corpo ao motor com massa e material, e o que o kit dá é impulso derivado. Os
  itens 1 a 4 são o contrário, e são os que o dono viu.
- **Há uma régua de energia pronta e parada**: `game-destruction-three/tests/energy-ruler.ts` (C1 a C4 da spec 008: ilha não ganha energia, peça não
  sobe acima do último repouso, tempo até tudo dormir). Só `bowl-energy`, `stack-energy` e as sondas da spec 008 a usam. Ela mede peças, não
  destroços, e não roda no catálogo. Uma mesa a 19,5 rad/s num quadro é um ganho de energia que ela acusaria **[inferência: não rodei]**.
- **Os itens 9 e 10 são a causa 3 esperando a vez**: integrador de lasca, repouso por quarto de volta, apoio pelo menor lado, e peça de 1,6 m.

### 10.2 B. Constantes cegas ao tamanho

Generalização das causas 2 e 3. Cada linha é um número em unidade que não escala (rad/s, m/s, metros ou segundos absolutos) aplicado a corpo de
qualquer tamanho ou massa.

| Onde | Valor | Aplicado a | Por que estoura |
|---|---|---|---|
| `fragments.ts:513` | giro += (rnd − 0,5) · `k`, com `k` em m/s | todo destroço numa explosão | unidade trocada: `k` chega a 20 (`renderer.ts:3672`), ±10 rad/s por eixo; numa tábua de 4,2 m a ponta ganha 21 m/s além dos 20 do centro |
| `renderer.ts:3672` | `min(20, sqrt(E)·0,08)` m/s | todo destroço, qualquer massa | lasca de 10 g e meia tábua de 30 kg saem iguais; as peças usam `blastShove` (massa e área, `:3660`) e os destroços não |
| `world.ts:4401` (núcleo) | ±6 rad/s por eixo (e ±4, ±6, ±10, ±15 nas outras quatro) | fragmento de qualquer `f.size` | velocidade da ponta = ω · L/2: 0,3 m/s na lasca de 10 cm, 12,6 m/s na tábua de 4,2 m |
| `fragments.ts:177-178,760-763` | `TIP_TURN = 3` · `dt` · 10 = 30 rad/s² | destroço com o centro fora do apoio | aceleração da ponta de 63 m/s² (6 g) em 4,2 m; em 5 cm, 0,75 m/s² |
| `fragments.ts:887` | `slerp(q, dt · 7)` | destroço sendo deitado | velocidade angular = 7 · ângulo, sem colisão no caminho: a 80° a ponta de 4,2 m varre a ~20 m/s por dentro do que estiver ali |
| `fragments.ts:206` | lento = menos de ~0,11 m/s e ~0,45 rad/s | decide dormir | a 0,45 rad/s a ponta de 4,2 m anda a 0,94 m/s e a peça "está parada"; `pieces.ts:112` e `engine-pieces.ts:141` (`STILL_SPIN = 0.45`) repetem o mesmo limiar para móvel |
| `fragments.ts:736-740` | quica se `vy < −0,6`; devolve 0,25; giro × 0,55 | qualquer massa | uma viga de 30 kg quica como uma lasca |
| `fragments.ts:474` | `vel.y = max(vy, 0,3)` ao ser chutado | destroço grande de qualquer massa | salto fixo |
| `renderer.ts:131,3068-3069` | `EDGE_NUDGE = 1` rad/s direto na velocidade angular | móvel equilibrado numa aresta | o topo sai a altura × 1: 0,4 m/s num banco, 6 m/s numa estante de 6 m, acima do limite de 4,5 do próprio teste, que não varia a altura |
| `engine-pieces.ts:157,1067` | `TOPPLE = 3` · `min(altura, 1)` rad/s² | peça do motor em apoio estreito | acima de 1 m a aceleração angular não cai com o tamanho: com o centro de massa a 4 m do apoio ele ganha 12 m/s², mais que a gravidade |
| `renderer.ts:323,3179` | impulso `massa × 0,6` no centro dos pés perdidos | móvel que perdeu chão | o giro resultante é J·r/I: depende da inércia real; coberto em largura e fundo, não com massa concentrada (tampo leve em base pesada) |
| `renderer.ts:124,132-133,138` | `FEET_BAND = 0.03` m, `TIP_MIN_HEIGHT = 0.3` m, `TIP_STANDING_FEET = 0.1` m | decide o que é pé e o que tomba | a 0,1x (miniatura, item sobre a mesa) nada tem pé nem altura para tombar; a 10x a faixa de 3 cm não acha o pé de um rodízio |
| `engine-pieces.ts:193,202,969` | `SINK = 0.005` m; `WEDGE_LIFT = 0.1 · 2^n` m | peça dentro de outra | folha de 4 mm é mais fina que o afundamento tolerado; o levantamento dobra sem olhar o tamanho da peça |
| `pieces.ts:116,164` | `TIP_SECONDS = 3`, `SEPARATE_SPEED = 1.5` m/s | solver do kit | tempo de queda real cresce com a raiz da altura |
| `fragments.ts:164,167` | `BIG_LENGTH = 0.2`, `BIG_WIDTH = 0.03` | escolhe o regime do destroço | fronteira absoluta entre duas físicas: 19 cm e 21 cm se comportam diferente |
| `vfx/workshop/debris.ts:11,127,135` | `DEFAULT_SPIN = 12`; apoio pelo menor lado; repouso abaixo de 0,5 m/s | caixa de 5 cm a 1,6 m | ver item 10 de 10.1 |
| `vehicles/explosion.ts:187-190` | pulo de 1,0 ou 1,5 m; giro ±0,25 rad/s | qualquer veículo | moto e ônibus |
| `test-room/thrown-body.ts:8`, `interactables/engine-leaf.ts:13` | `THROW_SPIN = 8` rad/s; `AIM_GAIN = 8` 1/s | qualquer item jogado; qualquer folha de porta | pá de 1,1 m com a ponta a 4,4 m/s; portão largo com a borda rápida |

O critério para corrigir cada uma já está na regra 12: regra de física se escreve pela **velocidade da ponta** (m/s) ou por energia, nunca em rad/s fixo.

### 10.3 C. Verificações que projetos grandes usam, e o teste equivalente aqui

Tudo abaixo roda em Node no CI: o Jolt em wasm já roda no vitest (`packages/game-floorplan-three/tests/setup-physics.ts:6`), então a regra 9 não é obstáculo.
Custo é estimativa minha, não medida.

| Prática | De onde vem (conferido) | Teste concreto neste repositório | O que afirma | Custo | Comando de aceite |
|---|---|---|---|---|---|
| **Comparar com a solução fechada** | Jolt `UnitTests/Physics/PhysicsTests.cpp`: `TestPhysicsFreeFall`, `TestPhysicsApplyForce`, `TestPhysicsApplyTorque`, `TestPhysicsCollisionElastic`/`Inelastic` conferem posição e velocidade contra a cinemática | `game-destruction-three/tests/fragment-analytic.test.ts`: um destroço solto de `h`, sem giro, toca o chão em `sqrt(2h/g)` e desliza `v²/(2μg)`; o mesmo para peça do motor | os dois integradores do kit obedecem ao básico em 4 tamanhos | 0,5 dia; segundos | `pnpm --filter @adatechnology/game-destruction-three test -- fragment-analytic` |
| **Relação metamórfica de escala** | teste metamórfico (Chen, 1998; levantamentos de Segura 2016 e Chen 2018, lidos só pela Wikipédia); PhyFu (ASE 2023) usa leis físicas como oráculo e achou mais de 5 mil entradas erradas em 4 motores. A relação abaixo é dedução minha por análise dimensional, não vem de uma fonte | `scale-sweep.test.ts` em `game-destruction-three` e `game-floorplan-three`: o mesmo cenário a 0,1x, 0,3x, 1x, 3x e 10x de comprimento. Com `g` fixo, tempos escalam com `√s`, velocidades com `√s`, giros com `1/√s`. E trocar a densidade por `k` não muda a trajetória de corpo rígido sob peso e atrito | `ω(s)·√s` e `v(s)/√s` ficam numa faixa; massa × 10 não muda onde a peça para (fora de explosão) | 1–2 dias; dezenas de segundos | `pnpm --filter @adatechnology/game-destruction-three test -- scale-sweep` |
| **Monitor de invariante em execução** | Hypothesis: invariante "run after every step"; Solver2D (Catto) nomeia "energy creation" e "jitter" como critérios; asserts de desenvolvimento do PhysX e Unreal (seção 5) | promover `energy-ruler.ts` de `tests/` para `src` e passar toda escrita do kit em velocidade ou pose por um ponto só, com o **nome da regra**; contador por regra e entrada no log da sala (`invariant: kit_energy`, ao lado de `broken_floating`, `room.ts:377`) | nenhuma regra dá mais energia do que a queda disponível do centro de massa; nada acordado depois de N s sem entrada; nada acima da altura em que nasceu; nada dormindo em pose instável | 3–4 dias | `pnpm --filter @adatechnology/game-destruction-three test -- kit-energy` falha com `goOverIfBalanced` revertido por opção |
| **Propriedade com semente e encolhimento** | fast-check `commands` ("can efficiently shrink failing scenarios", replay por semente e caminho); Hypothesis imprime "a very short program" que reproduz | `property-break.test.ts` em `game-floorplan-three`: móvel × tamanho × ordem de quebra × ponto e energia do golpe, com os invariantes acima depois de cada passo | o que o `broken-catalogue-spin` afirma, sem alguém escolher "3x comprido" | 3–4 dias; orçado em minutos por `FC_NUM_RUNS` | `FC_NUM_RUNS=200 pnpm --filter @adatechnology/game-floorplan-three test -- property-break` |
| **Diferencial** | Solver2D: oito solvers nas mesmas amostras, com os mesmos parâmetros | `light-vs-rigid.test.ts`: o mesmo destroço lançado no `FragmentSystem` e como corpo do motor; compara eixo para cima, altura do centro e tempo até dormir | as duas físicas concordam no repouso; a diferença é lista contada que só diminui e vira o aceite da spec 020 | 1–2 dias | `pnpm --filter @adatechnology/game-destruction-three test -- light-vs-rigid` |
| **Determinismo por hash até dormir** | Box2D "Falling Hinges": em todo PR compara "the number of time steps it takes for all the bodies to go to sleep" e o hash das transformações; Rapier: `takeSnapshot()` + hash; Jolt tem `PhysicsDeterminismTests.cpp` (só o nome do arquivo conferido) | estender `determinism.test.ts`: além do hash, o **número de passos até tudo dormir** por móvel quebrado | regressão de "não sossega" aparece como passos a mais, sem depender de limiar | 1 dia | `pnpm --filter @adatechnology/game-destruction-three test -- determinism` |
| **Replay de entrada gravada** | Fiedler, "Fix Your Timestep!" (passo fixo é a pré-condição); Jolt README: replicar a simulação "by replicating its inputs" | a sala já tem log (`examples/test-room/src/main.js:209`, `__testRoom.log.toNDJSON()`, `packages/game-test-room/src/log.ts`), mas é log de comportamento; se ele basta para refazer a entrada **[não conferido]**. Teste: `tests/replays/*.ndjson` refeitos em Node com hash por passo | todo defeito achado à mão vira arquivo que reprova até ser corrigido | 5–7 dias (é o item 9 da seção 6) | `pnpm --filter @adatechnology/game-test-room test -- replays` |
| **Soak** | Godot-Physics-Tests: monitor de expiração (espera um prazo e julga); Box2D roda até dormir | rodada noturna em Node: catálogo quebrado até o fim, 60 s simulados, régua C4 (tempo até dormir) | acordados chegam a zero e a energia não sobe depois do último golpe | 1 dia; minutos, fora do CI de PR | `node tools/ci/soak-broken.mjs --seconds 60` (novo) sai com 0 |
| **Varredura de catálogo com dívida contada** | Godot-Physics-Tests: teste "expected to fail" para acompanhar regressão de defeito conhecido | já é o padrão (`KNOWN`). Falta um número só: soma de todas as listas, gravada por commit | a soma não sobe | 0,5 dia | `node tools/ci/debt-count.mjs --check` (novo) |

**Política de golden.** O golden bit a bit serve para o que é função pura de uma entrada pequena e muda raramente: plano de fratura, colisor de
uma peça, tabela de materiais. Ele esconde regressão em trajetória: qualquer mudança legítima de constante regrava, e quem regrava decide (seção
3.2, causa 4). Para movimento, a guarda é o invariante (parou, deitou, não ganhou energia, mesmos passos até dormir), não os bytes. O `workshop-golden`
do item 10 de 10.1 é o exemplo: grava o capô de pé se ele parar de pé.

**Não foi possível conferir** (cito só como pista, sem afirmar o conteúdo): o artigo do QuickCheck (Claessen e Hughes, ICFP 2000; a página da ACM
respondeu 403); as palestras de Catto na GDC (a busca devolveu os PDFs `SequentialImpulses_GDC2006`, `SoftConstraints_GDC2011` e
`UnderstandingConstraints_GDC2014` em box2d.org; não abri); as palestras de Gregorius; a suíte de testes do Bullet; os livros de Ericson, Millington e
Gregory (a seção 5.3 já registra que só os índices foram vistos); o conteúdo de `PerformanceTest`, `Samples` e `PhysicsDeterminismTests.cpp` do Jolt
(só as descrições do README e a lista de arquivos).

URLs abertas neste adendo: https://github.com/jrouwe/JoltPhysics , https://github.com/jrouwe/JoltPhysics/tree/master/UnitTests/Physics ,
https://raw.githubusercontent.com/jrouwe/JoltPhysics/master/UnitTests/Physics/PhysicsTests.cpp (os primeiros 100 mil caracteres),
https://box2d.org/posts/2024/08/determinism/ , https://box2d.org/posts/2024/02/solver2d/ , https://gafferongames.com/post/fix_your_timestep/ ,
https://fast-check.dev/docs/advanced/model-based-testing/ , https://hypothesis.readthedocs.io/en/latest/stateful.html , https://arxiv.org/abs/2307.10818 ,
https://en.wikipedia.org/wiki/Metamorphic_testing , https://github.com/fabriceci/Godot-Physics-Tests , https://rapier.rs/docs/user_guides/javascript/determinism .

### 10.4 D. Plano

Ordem por (causas desta semana que o item pegaria antes do dono) ÷ custo. Causa 1 = forma adivinhada; 2 = alavanca errada; 3 = destroço grande na
física de lasca. Entra depois dos itens 1 a 5 da seção 6 e substitui os itens 6 e 7 dela por algo mais estreito e mais barato.

| # | Item | Pegaria | Modelo | Aceite por comando |
|---|---|---|---|---|
| 1 | **Varredura de escala no que já existe.** `SIZES` do `broken-catalogue-spin` ganha altura 3x, tudo a 0,3x e massa 10x; `long-debris-settles` ganha o lançamento real do núcleo (`world.ts:4401`) em vez de fragmento montado à mão | 2 e 3 | `haiku` | `pnpm --filter @adatechnology/game-floorplan-three test -- broken-catalogue-spin` passa com 6 tamanhos; com `EDGE_NUDGE` como está, o caso "três vezes mais alto" reprova ou entra numa lista `KNOWN` nomeada |
| 2 | **Regra `size-blind-motion` no `kit-audit`.** Toda escrita em velocidade angular (`\.ang\.`, `angularVelocity`) ou `slerp` de pose em `packages/*/src` cujo lado direito não cita meia-medida, alcance ou inércia entra numa lista contada (as de 10.2 são a lista inicial) | 3 (o tombo de 1 rad/s fixo); não a 2, que era um braço de alavanca | `haiku` | `node tools/kit-audit/audit.mjs --check --rule size-blind-motion` sai com 0 contra a lista gravada, e com 1 se uma linha nova de rad/s fixo entrar |
| 3 | **Diferencial leve × rígido.** O mesmo destroço nas duas físicas, de 10 cm a 4,2 m | 3, direto | `sonnet` | `pnpm --filter @adatechnology/game-destruction-three test -- light-vs-rigid` passa com a lista de divergência gravada; a lista esvazia quando a spec 020 fechar |
| 4 | **Toda regra do kit passa por um ponto e é medida pela régua de energia**, com o nome da regra; destroços incluídos; contador por regra no log da sala | 2 (19,5 rad/s é energia criada) e 3 (subir acima de onde nasceu) | `opus` para decidir onde a régua mora e o contrato do ponto único; `sonnet` para ligar regra por regra | `pnpm --filter @adatechnology/game-destruction-three test -- kit-energy` passa; revertendo `reachAlong` para o maior lado por opção de teste, falha citando `goOverIfBalanced` |
| 5 | **Relação de escala e solução fechada** (`scale-sweep`, `fragment-analytic`) para os dois integradores do kit e, depois, para os itens 9, 10 e 15 de 10.1 | 3; a 2 só se o cenário incluir quebra de pé | `sonnet` | os dois comandos de 10.3 passam; `rg -c "KNOWN" packages/game-destruction-three/tests/scale-sweep.test.ts` mostra a dívida nomeada |
| 6 | **Teste de propriedade com semente** sobre móvel × tamanho × ordem de quebra × golpe, com os invariantes do item 4 | 2 e 3 sem ninguém escolher o tamanho; a 1 se o invariante "nenhuma caixa guarda ar" entrar junto | `sonnet` | `FC_NUM_RUNS=200 pnpm --filter @adatechnology/game-floorplan-three test -- property-break` passa em menos de 5 min e imprime a semente |
| 7 | **Regra `own-integrator` no `kit-audit`.** Os integradores de 10.1 viram lista contada; integrador novo fora do motor reprova | nenhuma das três; impede a quarta | `haiku` | `node tools/kit-audit/audit.mjs --check --rule own-integrator` sai com 0 contra a lista de 10.1 |
| 8 | **Passos até dormir no hash de determinismo, e soak noturno de 60 s** | 3 (8 s subindo e caindo) | `haiku` | `pnpm --filter @adatechnology/game-destruction-three test -- determinism` grava e compara `stepsToSleep`; `node tools/ci/soak-broken.mjs --seconds 60` sai com 0 |

**O que não fazer:**

- **Teto de velocidade angular ou de altura sem contador.** Um `min(ω, ωmax)` teria escondido as causas 2 e 3 e deixado a mesa "só um pouco torta".
  Todo limite que corta entra com contador exposto e teste que exige zero, como `fellThrough` (`engine-pieces.ts:1679`, cobrado em `engine-fast-chips.test.ts`).
- **Subir a régua quando ela reprova** (`EARLY_GAIN`, `LYING`, segundos de espera) ou pôr a peça em `KNOWN` na mesma sessão que escreveu o código.
- **Regra nova em rad/s, ou limiar novo em metros absolutos**, em qualquer dos sistemas de 10.1.
- **Exceção por móvel** (`if (type === 'table')`): o defeito é da proporção, não do tipo.
- **Golden de trajetória** como guarda de movimento.
- **Rever ou duplicar a spec 020 aqui**: o item 3 é o critério de aceite dela, não outra implementação.
- **Mais um teste de um caso** para o próximo sintoma. Se o dono achar outro, a pergunta é qual linha de 10.1 e qual invariante do item 4 faltou.

### 10.5 E. O que este adendo não conferiu

Nenhum teste foi rodado: os riscos de 10.1 e os estouros de 10.2 são leitura de código e conta à mão, não medição; "a régua acusaria" e "a placa
pararia de pé" são inferência. Os números de linha são de `69d175833`. Não abri os arquivos listados no fim de 10.1 nem os testes `blast-debris*`,
`destructible.test.ts`, `blast-presentation` e `construction-stages`, então "guarda hoje" nessas linhas vem do nome do arquivo. Não conferi se o item 8
de 10.1 (casa sem renderer) e o item 6 (solver do kit) ainda rodam em alguma página que o dono usa, nem se o veículo que pula (item 15) é ao mesmo
tempo corpo do Jolt. A busca por integradores foi por padrão de texto (`-= g * dt`, `+= v * dt`, giro somado): um integrador escrito de outra forma
(por exemplo com `lerp` de posição, ou mola) escapou, e é por isso que o item 7 do plano precisa ser regra e não esta lista. Não li a spec 020 nem o
trabalho em andamento dela. Os custos de 10.3 e 10.4 são estimativa. Das fontes, o que está em "não foi possível conferir" não sustenta nenhuma
afirmação deste adendo.
