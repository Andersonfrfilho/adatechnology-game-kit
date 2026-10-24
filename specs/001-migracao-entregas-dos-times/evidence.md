# Evidências — Spec 001

## T0.1 — Ferramenta de golden "igual ao original"

> 🤖 Modelo: `sonnet`

**O que foi feito**

- `tools/golden/` (pacote privado `@adatechnology/golden-tool`, no workspace por `tools/*`): PRNG com semente (`createSeededRandom`),
  ambiente determinístico (`installDeterminism` / `withDeterminism`: `Math.random` com semente, `Date.now` e `performance.now`
  congelados, `requestAnimationFrame` em fila que só anda por `stepFrames`), hash estável da cena three.js (`snapshotScene`: nomes,
  geometria, vértices, caixa, cor de material e transformações arredondadas, nunca uuid), gravador de eventos, `createGoldenRecord`,
  `diffGolden` e `assertMatchesGolden` (diferença legível: primeiros eventos e nós que mudaram).
- Decisão: a **página** é gravada no Chrome headless por CDP (`bin/record.mjs`: servidor estático local, three.js r128 servido do disco,
  qualquer outra requisição externa recusada, bundle `dist/index.global.js` injetado antes dos scripts da página). O **SDK** é comparado
  no vitest, em Node, sem navegador. As páginas precisam de three.js real e de globais de `window`, que o happy-dom não cobre (sem
  WebGL nem canvas).
- Prova real: golden do `hatch` da **Garagem** (`artefatos/Xy9QydZTRyAfwxRMjzh1aT.html`) em
  `packages/game-vehicles-fleet/tests/fixtures/team-golden/garage-hatch.json` (3 estados + 2 cenários de batida como eventos), e
  `packages/game-vehicles-fleet/tests/team-golden.test.ts` compara o `compact_hatch` do SDK: cena intacta, danificada e modificada com o
  mesmo hash, e os mesmos eventos. O padrão já existente de `tests/helpers/golden.ts` do fleet (digest do original) continua intacto; a
  ferramenta nova o generaliza para qualquer página.
- Achado: a Garagem do time marca `frontBlood` na batida frontal (poças de sangue, 3 nós a mais no estado danificado). Sangue é conteúdo
  do jogo (`CLAUDE.md` §2), por isso o SDK não o tem; a captura usa `--param gameOnlyFlags=frontBlood` para deixar só essa flag de fora.

**Comandos e resultados**

```text
pnpm build                                  -> ok (24 pacotes, inclui tools/golden)
pnpm -r typecheck                           -> ok
pnpm --filter @adatechnology/golden-tool test -> 4 arquivos, 22 testes passando
pnpm --filter @adatechnology/game-vehicles-fleet test -> 859 passam, 12 falham (team-golden.test.ts: 3/3 passam)
pnpm lint                                   -> ok
node tools/golden/bin/record.mjs ... (duas vezes) -> JSON idêntico byte a byte (cmp)
```

**Falhas que já existiam (não são desta task)**: as 12 falhas do fleet são os goldens antigos de `midsize_sedan` (seda), `entry_hatch`
(popular) e `fastback_sedan` (civico), exatamente o caso V1 do consolidado; conferido com `git stash` que `midsize_sedan` falha igual sem
esta mudança (10 testes). A regeneração é a T0.3.

## T0.3

Modelo: `sonnet`.

### Melhoria 1: partículas de explosão do SDK

**Causa raiz.** `world.explode(point, energy, radius)` (`game-destruction/src/world.ts`, `blastWorld`) não emite nenhum evento. O evento
`explode` só sai de `failPart` quando uma peça com `explodes` quebra. O renderer só desenha fogo, clarão e fumaça preta em `onExplode`, que só
roda pelo evento. A granada da sala de testes (`detonate` em `game-test-room/src/room.ts`) chama `world.explode`: o muro caía, mas só
apareciam os detritos (`dust`, `chips`, na camada normal). Por isso a camada aditiva ficava em 0 e a fumaça da explosão nunca era emitida.
Material, blending, `depthWrite`, tamanho do ponto, opacidade e vida das partículas estavam certos: com o evento, 67 aditivas e 61 normais
com alpha maior que zero já no primeiro quadro.

**Correção.** `renderer.explode(point, energy, radius)` roda o mesmo `onExplode`; a sala de testes chama junto de `world.explode`.
Sem redesenhar a explosão (o porte do Laboratório segue na Fase 5, E1).

**Teste** (falha antes, passa depois): `game-test-room/tests/room.test.ts`, "grenade blast": granada `frag_grenade`, depois da detonação
as duas camadas (`destruction-particles-additive` e `destruction-particles`) têm mais de 30 partículas com alpha > 0, e a luz está na cena.
Antes: `expected 0 to be greater than 30`. Mais um teste unitário em `game-destruction-three/tests/renderer.test.ts`.

**Captura.** `node capturar.mjs` não rodou inteiro (as cópias locais `laboratorio.html` e `jogo-site.html` não existem nesta worktree). Rodei
só a versão SDK com um script igual, servindo `site/dist` recém-construído:
- com o site velho (porta 4801, outro processo): camada aditiva 0 partículas vivas, 576 na normal, como no README da comparação;
- com o site novo: 101 aditivas e 668 normais vivas (alpha máx 0,90 e 0,96), e faíscas e fogo visíveis no quadro de 0,25 s.
Os quadros ficaram fora do git (pasta de rascunho da sessão).

### Melhoria 2: lixo por quadro em `particles.ts`

`Pool.update` chamava `hexToRgb` duas vezes por partícula por quadro (dois arrays novos cada). A cor inicial e a final agora são
convertidas uma vez, em `spawn`, em dois `Float32Array` fixos (`rgbStart`, `rgbEnd`); o laço por quadro só interpola.
Comportamento igual: `tests/particle-colors.test.ts` foi escrito e passou **antes** da mudança (cor de override constante; fogo
`0xffc040 -> 0xc02000` com vermelho e azul coerentes com o progresso dado pelo verde) e continua passando depois.

### V1: goldens de `game-vehicles-fleet`

Antes: 868 testes, 12 falhando (`entry_hatch` = popular, 1; `midsize_sedan` = seda, 10; `fastback_sedan` = civico, 1). Não existe script gerador
(o golden veio do código original); a regeneração usou as mesmas funções do teste (`digest`, `legacyZoneId`, `zoneScenario`, `zoneOverall`) por um
teste temporário, já removido. Só mudaram os `hash` (contagens de objetos e de tipos, zonas, peças e saúde ficaram iguais, então é deslocamento
de geometria, não perda de peça):
- `entry_hatch`: cenário `rollover`;
- `midsize_sedan`: `intact`, `damaged`, `modified` e os cinco cenários;
- `fastback_sedan`: cenário `rollover`.
Causa provável: ajustes em `game-vehicles` (`fix(vehicles): add floor pan, tune glass and tank resistance`) depois do golden. Decisão V1: a página de hoje é o SDK.
Depois: `pnpm --filter @adatechnology/game-vehicles-fleet test` com 16 arquivos e 868 testes passando.


## T0.2

**Modelo:** opus (desenho validado por architect/opus em `design/T0.2-contrato-bancada.md`). Branch `work/spec001-t0-2`.

### O que foi feito

- `game-contracts`: `src/bench.ts` novo (`ModuleControl` número/booleano/escolha/ação, `ModuleLayer`, `ModuleMetric` puxado, `BenchChange`,
  `ControlPatch`, `ModuleBench`, `checkBench`). `module.ts`: `HostEvent` ganhou `mode`, `fault`, `clear`, `safety` e `rounds`/`mode` opcionais no
  `shot`; `HostTool` ganhou `mode`, `fault`, `safety`, `heat` opcionais; `ModuleHost.bench?`; `TestableModule.controls?/layers?/metrics?`.
  Tudo exportado no `index.ts`. Módulos atuais continuam compilando.
- `game-test-room`: `src/bench.ts` (store pura, `encodeBenchState`/`decodeBenchState` com entrada hostil), `src/metrics.ts` (fps e ms por
  janela de 0,5 s do `dt` real antes do `timeScale`; draw calls/triângulos de `gl.info.render`; objetos/fragmentos/partículas/decalques de
  `renderer.stats()` + `fluidView.stats()`), `src/bench-panel.ts` (painel `tr-panel tr-bench` entre animações e testes). `room.ts` só liga:
  `detachers` virou `Map` e recarregar um módulo chama o detacher antigo antes do novo `attach`; `checkBench` no `loadModule` (`mod.bench_ok` /
  `mod.bench_fail`); `ModuleHost` por módulo com `bench` (só quando declara algo e passa no check); mudanças iniciais após o `attach`; módulo
  ativo por `openArea` ou último carregado com bancada; `mode` emitido no Q; `rounds` e `mode` no `shot`; `TestRoom.bench()` e
  `TestRoom.metrics()`; opções `metrics` e `bench`. Textos novos em `en` e `pt-BR`.
- `examples/test-room/src/main.js`: passa `bench: { state, onChange }` e mantém `?bench=` com `history.replaceState`.
- Testes: `game-contracts/tests/bench.test.ts`, `game-test-room/tests/bench.test.ts` (inclui UI em happy-dom), `tests/metrics.test.ts`,
  casos novos em `tests/module-host.test.ts` e em `game-weapons-three/tests/weapons-area.test.ts` (o módulo aceita `mode`/`fault`/`clear`/`safety`).
- READMEs dos dois pacotes, skills `game-contracts` e `game-test-room`, changeset `module-bench.md` (minor nos dois pacotes).

### Desvios do desenho

- `checkBench` recebe um tipo nomeado `BenchDeclaration` (mesma forma do parâmetro inline do desenho), exportado.
- `BenchHandle.controls()`/`layers()` não tinham tipo de retorno no desenho: devolvem `BenchControl` (declaração com os patches, `disabled` e
  `value`) e `BenchLayer` (com `on`), exportados em `types.ts`.
- `RoomUi` ganhou também `benchVisible` (interno) para a sala só amostrar a 4 Hz quando o painel tem o que mostrar.
- Declaração de bancada inválida: o relatório falha e a sala **não** empresta `host.bench` (evita store com escolha sem opções).
- Controle desabilitado por `patch({ disabled: true })` recusa `set`/`act` (devolve `false`).
- Q emite `mode` só quando o modo muda (arma de modo único não gera evento).
- `encode` grava todos os controles (menos ações) e camadas em ordem de declaração, não só os que diferem do padrão.

### Gates

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-contracts test` | 3 arquivos, 16 testes passaram |
| `pnpm --filter @adatechnology/game-test-room test` | 9 arquivos, 83 testes passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 1 arquivo, 5 testes passaram |
| `pnpm lint` | exit 0 |


## T0.3 — fidelidade do sedã

Gravei a Garagem (`artefatos/Xy9QydZTRyAfwxRMjzh1aT.html`, three r128 local, seed 1, `frontBlood` fora) com a ferramenta da T0.1 para `hatch`,
`seda`, `popular` e `civico`. O `hatch` regravado ficou byte a byte igual ao fixture antigo (a ferramenta repete). `midsize_sedan`,
`entry_hatch` e `fastback_sedan` do SDK **batem com a página** nos três estados (`intact`, `damaged`, `modified`) e nos dois cenários
(`front_crash`, `rollover`): `assertMatchesGolden` sem diferença. Não há regressão do SDK; o conserto de V1 estava certo. Os três JSON entraram
em `packages/game-vehicles-fleet/tests/fixtures/team-golden/` e `tests/team-golden.test.ts` os compara (prova de fidelidade, não só de regeneração).

## Revisão da Fase 0

**Modelo:** sonnet. Branch `feat/spec-001-fase-0`.

### Achados e correção

| # | Achado | Correção |
|---|---|---|
| 1 | `fps`/`frame_ms` saíam do `dt` cortado em 50 ms e paravam durante cenário | O laço da sala passa o delta real (antes do `Math.min`) para `roomMetrics.frame` em todo quadro; `update(dt)` só alimenta quando a sala não é dona do laço, sem cortar. Testes: delta de 100 ms dá fps 10, e segue durante cenário |
| 2 | Um `?bench=` para todos os módulos | `options.bench.state` é `Record<moduleId, string>`; o exemplo usa `?bench.<moduleId>=`. Teste com dois módulos de mesmo id de controle |
| 3 | Recarregar módulo perdia o estado vivo | `loadModule` guarda `encode()` do store antigo e restaura dele; `options.bench.state[mod.id]` só semeia módulo ainda não visto. Teste |
| 4 | Falha de módulo derrubava a sala | `metric.read()` em try/catch (`n/a`, uma linha no log por contador); `emit` captura por ouvinte (uma linha por módulo) e `sendInitial`/`set` sempre chegam ao `changed()`. Testes |
| 5 | `record.mjs`: porta fixa, sem timeout, URL malformada, regex larga, seed | `--remote-debugging-port=0` + `DevToolsActivePort` do perfil; timeout por chamada CDP (30 s; `--timeout-ms` no `evaluate`); URL malformada responde 400; regex restrita ao CDN do three; `--seed` inteiro |
| 6 | Fidelidade da frota | Ver "T0.3 — fidelidade do sedã": igual |

Nits resolvidos: arquivos de `tools/golden/src` e `tests` em kebab-case; `as any[]` removido de `team-golden.test.ts`; `metricText` não mostra
`undefined`; módulo novo só toma o painel quando não há ativo (o README dizia "o último carregado"; agora é o primeiro com bancada); `dispose`
limpa `benches` e ouvintes; o painel só amostra com o pai visível (`getComputedStyle`); README do `tools/golden` lista o que não é congelado;
changeset `explode-renderer` avisa que `DestructionRenderer.explode` é membro obrigatório novo.

### Para depois (não feito de propósito)

- Cobertura do `sceneHash` (o que entra no hash, ex.: UVs, índices, materiais além de cor/opacidade).
- Vocabulário de `HostEvent` (nomes e dados dos eventos de ferramenta ainda não são fechados).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | todos os pacotes passaram (test-room 92, vehicles-fleet 874, tools/golden 22) |
| `pnpm lint` | exit 0 |

## Hotfix — goldens dependentes da versão do Node

**Corrige a premissa da T0.3/V1.** O texto acima ("Causa provável: ajustes em `game-vehicles` depois do golden"; "goldens desatualizados") estava errado. Os
goldens antigos de `midsize_sedan`, `entry_hatch` e `fastback_sedan` **não estavam defasados**: dependiam do Node. Passavam no CI (Node 22) e falhavam local (Node 24).
A regeneração local da PR #19 (a1426b6) só trocou um golden dependente do Node 22 por um dependente do Node 24, e o CI (main vermelha, run 40037879452) quebrou ao contrário.

**Prova** (Node 22.23.4 baixado do npm numa pasta de rascunho, sem mexer no Node do sistema; Node 24.22.0 local):
- `midsize_sedan` intacto: 373 objetos, 1 linha de cena difere, o `TubeGeometry` fechado de 918 vértices (`radialSegments` 5, raio 0,009, 40 pontos quase em linha em x≈2,2).
  Diferença nos vértices: de 2e-6 até **7,7e-4** (2718 de 2754 valores), ou seja, uma torção do anel, não ruído de 1 ulp. Por isso nenhum arredondamento resolve.
- Varredura de todos os 69 veículos × 8 estados (231.033 geometrias, bits do `Float32Array`): 411 geometrias diferem entre 22 e 24, em 22 veículos
  (`TubeGeometry` 296, mais 115 Box/Buffer/Shape derivadas de pontos de tubo), maior diferença nos tubos abertos 1,2e-7 (1 ulp float32), nos fechados de 5 lados 7,7e-4.
- Sonda de 200.000 entradas por função: `Math.pow` (expoentes 0,25, 1,7, 3) e `**` diferem entre 22 e 24; `exp`, `log`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`,
  `atan2`, `sinh`, `tanh`, `cbrt`, `hypot` e `sqrt` são idênticos. A hipótese "trigonometria" estava errada: é `pow`. O `CatmullRomCurve3` centrípeto do three usa
  `Math.pow(distância, 0,25)`, e o quadro de Frenet do tubo sobre pontos quase colineares amplifica o último bit.

**Correção**: `tools/golden/src/portable-math.ts` (`portablePow`, `installPortableMath`): `Math.pow` feito só de `+ - * /`, `exp` e `log`.
`installDeterminism` instala (então o gravador da página também), e `packages/game-vehicles-fleet/tests/setup.ts` chama `installPortableMath()`.
A precisão do hash não mudou (4 casas): ela nunca foi o problema. Teste de 1 mm: `tools/golden/tests/scene-hash.test.ts` e `game-vehicles-fleet/tests/digest.test.ts`.
`tools/golden/tests/portable-math.test.ts` guarda os bits de `portablePow` e de cada função nativa de `Math` (canário: mostra qual função mudou num Node novo).
Depois da correção, a mesma varredura dá **0 de 231.033 geometrias diferentes** entre Node 22 e Node 24.

**Regeneração (uma vez, Node 24, conferida nos dois)**: `tests/fixtures/golden.json` mudou 22 hashes (contagens, zonas, peças e saúde iguais): `midsize_sedan` 8,
`taxi` 8, e 1 em cada `rideshare_hatch`, `light_4x4`, `fastback_sedan`, `family_hatch`, `entry_hatch`, `electric_hatch`, `classic_six_sedan`.
`team-golden/garage-seda.json` regravado da página (`bin/record.mjs`, Chrome headless, `--param key=seda --param gameOnlyFlags=frontBlood`): só a linha do tubo fechado
(`v918`) e os 3 hashes de cena mudaram; as gravações de `hatch`, `popular` e `civico` saíram **idênticas byte a byte** às existentes.

CI: `.nvmrc` (22) e o job `goldens-node-24` (golden-tool e as suítes sensíveis do fleet no Node 24, mais barato que dobrar as 16 fatias).

| Comando | Node 24.22.0 | Node 22.23.4 |
|---|---|---|
| `pnpm build` | exit 0 | (não repetido) |
| `pnpm -r typecheck` | exit 0 | (não repetido) |
| `pnpm lint` | exit 0 | (não repetido) |
| `pnpm -r test` | todos passam (fleet 875 em 18 arquivos, tools/golden 39) | fleet 875 em 18 arquivos; tools/golden 39 |
