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
