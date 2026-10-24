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

## T1.1 (parte A)

Modelo: `sonnet` (desenho validado pelo `architect`/opus: `design/T1.1-dados-das-armas.md`). Parte A = tasks 1, 2 e 3 do §5 do desenho, em 3 commits.
As tasks 4a e 4b (regra do `WeaponRuntime`) e os testes (d) a (f) ficam para os passos seguintes.

### O que foi feito

| Commit | Conteúdo |
|---|---|
| 1 `feat(weapons): tipos de dados de armas…` | Tipos do §2 do desenho (`CaliberDef` com ruído/estojo/cartucho, `WeaponTimings`, `WeaponDimensions`, ação `launcher`, `ExplosiveDef`, falha/condição, `WeaponRules`, `WeaponEvent`), `DEFAULT_RULES` (`src/rules.ts`) e `RELOAD_STAGES` (`src/reload-stages.ts`, frações dos quadros-chave da Galeria). Desenho incluído |
| 2 `feat(weapons-catalog): extrator…` | `tools/weapons-catalog/` (extratores da Galeria, Arsenal, Laboratório e jogo; `decisions.json`; `build.ts` com `--check`), dados gerados, `archetypes.json` (ex-`weapons.json`, sem ruído nas armas de fogo), `base/calibers.sdk.json` congelado e `models.json` da Galeria. Testes (a) e (b) |
| 3 `feat(weapons): registro…` | `createArsenal` com explosivos, `patch`/`remove`/`include`, `rules` (merge profundo), `strings`, `checkArsenal` (todos os problemas de uma vez), `energy()`; exports `EXPLOSIVES`, `ARCHETYPE_IDS`, `checkArsenal`; locale en e pt-BR; teste (c) `catalog.test.ts` e `arsenal-options.test.ts` |

### Contagens

| | Antes | Agora |
|---|---|---|
| Calibres | 18 | **28** (10 novos: 9×18, 5,7×28, .44 Mag, .50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 WM, .408 CheyTac) |
| Armas de fogo reais (`firearms.json`) | 0 | **73** (71 da Galeria + Remington 700 .300 WM + M79) |
| Lançadores (`launchers.json`) | 0 | **6** (RPG-7, M72, AT4, Carl Gustaf M4, lança-chamas M2 e caseiro) |
| Arquétipos (`archetypes.json`) | 42 | 42 (os 17 de arma de fogo sem `noise`; frag, bomba caseira e molotov com `explosive`) |
| Explosivos | 0 | **17** |
| `WEAPONS` | 42 | 121 (79 reais + 42 arquétipos) |
| Modelos 3D da Galeria (`models.json`) | 0 | 78 (77 + a variante .300 WM) |

### Desvios do desenho (e por quê)

1. **Ação `flame` ganha `family?` e `timings?`** (o desenho só dava `timings` ao fogo e ao lançador): o tempo de troca de tanque da Galeria (1,1 s) e a família `flame` não tinham onde morar. Aditivo e opcional.
2. **`weapon.ts` tocado na task 1**, três linhas: `capacity` de `launcher`, `case 'launcher'` devolvendo `empty` (o `switch` deixa de compilar com a ação nova) e `res.noise = a.noise ?? cal.noise ?? 0` (o `noise` virou opcional; sem isso nem o typecheck passa). Comportamento igual: o calibre ainda não tinha ruído.
3. **Tipos de estado e `create()` ficaram para a 4a/4b**: `WeaponState`, `TriggerResult` e as opções `condition`/`ammoQuality` do `create` exigem o runtime; adicioná-los agora quebraria `WeaponRuntime implements WeaponState`. `WeaponEvent`, `WeaponRules` e os tipos de pane/condição já estão.
4. **`WeaponRules.heat` com `number`** em vez dos literais `140`, `120`…: o jogo troca esses números (regra "tudo configurável"); os literais do desenho são os padrões.
5. **Lançadores e M79 têm `archetype`** (`shotgun_pump_12` e `shotgun_double_12`, de onde vem o coice): o teste (c) pede arquétipo em toda arma real.
6. **Ruído do calibre das 3 faixas sem linha no §12** (357 Mag, 5,45, .30-30 = 300; .300 WM, .338, .408 = 600) vem do nível "alto/extremo" do §04 pelo mesmo mapa do §12. Marcado `derived` no `decisions.json`.
7. **`base/calibers.sdk.json` é cópia do `calibers.json` de antes**, e `calibers.json` agora é gerado (ordem do desenho, não a de antes).
8. **Throwables regenerados no registro, além do `archetypes.json`**: `createArsenal` faz `energy`/`noise`/`radius` do arremessável seguir o explosivo (assim `patch.explosives` propaga). O molotov mantém o `radius` 1,5 e o `fire` 700 °C/1,5 m/12 s do SDK (raio letal 0 não vale como raio do fogo; teste existente).
9. Ruído do frag 400→500, da bomba caseira 350→450, do molotov 60→40; energia da bomba caseira 100 kJ→43,2 kJ e raio 4→3, frag raio 6→5: consequência de "regenerados da def" (Arsenal §13 e Hopkinson).

### Escolhas que não vinham das fontes (REF/derivadas) — confirmar com o dono

Todas estão em `decisions.json` com `source: reference` ou `derived`.

- **Lançadores**: velocidade de saída (RPG-7 117 m/s, M72 145, AT4 285, Carl Gustaf 255, M79 76), distância mínima de armar 10 m e sopro 5 m (Arsenal §13, valem para todos), coice = coice da escopeta de bomba × kick da Galeria / 1,6. Nenhuma fonte do time dá velocidade nem coice de foguete.
- **M79 como arma**: cano 0,356 m e massas 2,7/2,93 kg (REF do M79 real); comprimento 0,73 m da Galeria.
- **Massa do projétil dos 10 calibres novos** (REF) e velocidade do .300 WM e .408 (REF 900 m/s); arrasto de todos os novos.
- **Temperatura do fogo** dos explosivos de combustível (700 °C, a do molotov do SDK): as fontes só dão raio e duração.
- **Energia da Claymore**: 102,4 kJ (Q4 "usar 102 até decisão"); a escala de Hopkinson não vale para cone.
- **Rimfire/aro e tipo de estojo**: os de calibre sem entrada no desenho (20 ga: `shell`/`shell`).
- **Cadência do arremesso `volley` da Boito** = 180 rpm (Q2, "escopeta 180"); o desenho não dá número para basculante.

### Conflitos entre fontes não cobertos pelo desenho (não decidi; registrar)

1. **Tipo de estojo do 5,7×28**: a função `caseType` da Galeria (linha 513) devolve `rifle` (calor 4,5 por tiro na P90); o desenho manda `pistol` (calor 3). Segui o desenho.
2. **Molotov no jogo**: `EXP.molotov` do `jogo.js` tem `fer: 0`; Laboratório e Arsenal dizem 4 m. Segui Laboratório/Arsenal (desvio registrado em `sources.test.ts`).
3. **Taurus 82**: o Arsenal diz "Nunca engasga" (§06) e a Galeria não dá `rel` (padrão 1, ou seja, engasga como as outras).
4. **Calibres sem linha na Galeria**: `.380 ACP` e `20 ga` têm arma no SDK e/ou §04 mas nenhuma arma da Galeria os usa; ficam só como calibres.
5. **Armas citadas só no §04** (Ruger Mk IV, Taurus TH380, Walther PPK, Glock 22, S&W Model 10, Ruger GP100, M1 Garand, AR-15): sem linha no §06 nem na Galeria, não entraram.
6. **Carl Gustaf M4** não tem linha no Arsenal §13; raios, ruído e nível vêm do AT4 (Q5, como o desenho manda).
7. **Remington 700 no Arsenal §07** tem a ficha do calibre .308; a variante .300 WM fica sem velocidade da arma (usa a do calibre, 900 REF) e herda a precisão (MOA).
8. **Arco e besta** (`arrow`, `crossbow_bolt`) não têm `caseType`; a regra de calor (4b) precisa de um padrão para eles.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-weapons test` | 66 passaram (47 antigos, 12 de `catalog.test.ts`, 7 de `arsenal-options.test.ts`) |
| `pnpm --filter @adatechnology/weapons-catalog-tool test` | 14 passaram (`sources.test.ts` 13, `catalog-up-to-date.test.ts` 1) |
| `pnpm --filter @adatechnology/weapons-catalog-tool catalog:check` | `up to date` |
| `pnpm --filter @adatechnology/game-test-room test` e `game-weapons-three test` | 92 e 5 passaram |
| `pnpm lint` | exit 0 |

Os 47 testes antigos de `game-weapons` continuam verdes sem alteração (nenhum precisou de `rules: { faults: false }` ainda: a pane é da 4b).
`pnpm -r test` inteiro passa de 2 min neste ambiente; os pacotes que tocam armas foram rodados à parte, como acima.

## T1.1 (parte B)

Modelo: `sonnet` (a regra do `WeaponRuntime` está desenhada no §3 de `design/T1.1-dados-das-armas.md`; nada exigiu `opus`). Parte B = tasks 4a, 4b, 5 (testes (d) e (f)), 6 e 7 do §5 do desenho, em 5 commits.

### O que foi feito

| Commit | Conteúdo |
|---|---|
| 4a `feat(weapons): regra de manuseio…` | Velocidade e ruído por arma, `timings` resolvidos (`src/fire.ts`), `draw()` com fase e status `drawing`, ciclo manual (pump, ferrolho, alavanca), recarga `auto`/`full`/`one_by_one` com `RELOAD_STAGES` (`src/reload.ts`), fila de eventos com `drain()`, `roundTimes`, salva (`volley`), `locked` da pistola, `WeaponState`/`TriggerResult` completados |
| 4b `feat(weapons): panes…` | Pane por cartucho no gerador `seed ^ 0x6a09e667` (`src/faults.ts`), `clearFault`, `setSafety`, calor com decaimento em passos de até 1/60 s (`src/heat.ts`), `condition` e `ammoQuality` (opções do `create` e `set*`), rajada de ruído, lançador mínimo (`Use` `throw` com a energia e o raio letal do explosivo, `perRocket` de calor) |
| 5 `test(weapons): testes da regra…` | `tests/rules.test.ts` (29 testes): taxa de pane por condição em 20 mil tiros (±3σ), mistura de panes por família, revólver sem trava, desobstruir, trava, M16A2 e Boito, calor, etapas, ruído, dispersão da semente 7 igual com pane ligada |
| 6 `test(weapons): golden da Galeria…` | `tools/golden/captures/arsenal-gallery.js`, `tests/fixtures/team-golden/gallery-heat.json`, `tests/team-golden.test.ts` (4 testes) |
| 7 `feat(test-room,weapons-three): …` | Sala: `rules: { faults: false }` e mapeamento dos eventos da arma para os do host (`src/host-events.ts`); `HostTool` com `fault`, `safety` e `heat`; README, SKILL, changeset, inventário (§7) |

### Resultado do golden (e)

O gravador recusava o `RoundedBoxGeometry` e os outros complementos do three r128 (jsDelivr). Foi estendido: `--addon <arquivo>` (repetível) serve `OrbitControls`, `RoundedBoxGeometry` e `RoomEnvironment` do `node_modules`, e `GoldenTool.stepFrames` passou a existir de fato (o README já o prometia; faltava ligar). O teste numérico da fórmula da linha 798 **não** foi necessário: a Galeria real foi gravada (`artefatos/C96Cxhb4bTA9bbojV4ctKH.html`, seed 1, quadros de 1/60 s).

Para a gravação não depender do sorteio da página, a captura troca `Math.random` por 0,99 (nunca engasga). A captura clica Atirar 5 vezes (40 quadros entre cada) e Rajada (10 tiros, 90 quadros) em Glock 17, AK-47, Remington 870 e Browning M2 .50 ("M2" do desenho = Browning M2, não o lança-chamas) e lê "Calor h%" e a munição.

Resultado: **o SDK bate com a página em todos os passos** (calor arredondado e cartuchos gastos nas 4 armas; ex.: AK-47 47% e 10 cartuchos a menos depois da rajada, M2 100%). O teste foi sensível: com 30 quadros entre tiros em vez de 40 ele falha. A ordem por quadro é `trigger` e depois `update`, como a página (tween soma, `stepWeapon` esfria). A Remington aparece com 7 na página (`'6+1'`) e 6 no SDK (`capacity` é o carregador); por isso o teste compara **cartuchos gastos**, não a munição absoluta.

### Decisões aplicadas (as do pedido)

- **Arco e besta**: sem `caseType`, somam 0 de calor e nunca engasgam (`heatPerRound` e `rollFault`).
- **Taurus 82**: fica como na Galeria (`faultFactor` 1). Pergunta para o dono abaixo.
- O resto da lista da parte A segue como está em `decisions.json`.

### Desvios do desenho (e por quê)

1. **Nenhum teste antigo precisou de `rules: { faults: false }`** (item (f)): os 47 testes de `weapons.test.ts` seguem verdes sem mudança porque cada um tem semente fixa e nenhum sorteio de pane cai nos seus tiros. É determinístico, mas frágil a mudança de semente; se algum dia um deles falhar por engasgo, a correção é essa opção no teste.
2. **`weapon.ts` ficou com ~550 linhas** (o desenho previa ~200 com `fire.ts` e `reload.ts`). Fora do arquivo foram `fire.ts`, `reload.ts`, `faults.ts` e `heat.ts`; o que sobra é o estado da arma e os `fire*` de cada ação (melee, chama, extintor, arremessável, lançador, arma de fogo), que usam o mesmo estado. Dividir por ação é refatoração à parte (sugestão para a T1.5, quando o lançador sair do mínimo).
3. **`roundTimes`** é medido a partir do **início da chamada** (`start` do `trigger`), não do primeiro cartucho; com a arma pronta é o mesmo número (M16A2: k·0,075).
4. **Misfire de revólver/basculante** devolve `status: 'misfire'` com `rounds: 1` e sem `shots`; o evento `shot` só sai quando há projétil, e `misfire` vira `shot{shots:0, rounds:1}` no host.
5. **`reload('one_by_one')`** só vale em arma que carrega assim (tem `perRound`); nas outras vira `auto`. Revólver em `auto` é sempre `one_by_one` (`full` = speed loader), como o desenho diz; tubo e ferrolho vazios usam o `empty` das etapas (fecha com o ciclo).
6. **`setSafety(on)` devolve o estado atual**; só vale para armas que recarregam (fogo e lançador) e só emite `safety` quando muda.
7. **Lançador mínimo**: ruído do disparo = `noise` da ação (hoje 0, nenhuma fonte dá ruído de disparo do foguete); a explosão tem o próprio ruído no explosivo. Recarga do lançador funciona (`rocket_seat`/`tube_drop`+`tube_seat`); o lança-chamas segue sem recarga até a T1.5.
8. **Área de armas**: com 121 armas nos três balcões (39 lugares), as armas empilhariam no último balcão. Apliquei o filtro previsto (`def.archetype === undefined`) em `game-weapons-three/src/area.ts` e ajustei a contagem do teste; as 42 voltam a ser as mesmas de antes. Reverter na T1.3.
9. **Sala de teste**: os eventos de `tool`, `shot`, `empty`, `mode` e `reload` deixaram de ser emitidos à mão e saem do `drain()` da arma (após o gatilho, `Q`, recarga e a cada quadro, para todas as armas já pegas). `setTool` ainda emite `tool` direto e **não** chama `draw()`: ligar o saque faria o gatilho responder `drawing` por 0,35 s (T1.3).
10. **`GoldenTool.stepFrames`** e `--addon` no gravador (ver acima).

### Perguntas para o dono

1. **Taurus 82**: o Arsenal §06 diz "nunca engasga", a Galeria não dá `rel` (então engasga como as outras, `faultFactor` 1). Mantive a Galeria. Quer `faultFactor` baixo (por exemplo 0,1) ou 0?
2. **`capacity` com câmara**: a Galeria conta `'6+1'` como 7 na munição; o SDK conta 6 e guarda `chamber: 1` só como dado. A recarga tática deveria deixar +1 na câmara?
3. **Ruído do disparo do lançador**: usar o ruído do calibre mais próximo (330?) ou o do explosivo? Hoje é 0.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-weapons test` | 99 passaram (66 de antes + 29 de `rules.test.ts` + 4 de `team-golden.test.ts`) |
| `pnpm --filter @adatechnology/weapons-catalog-tool test` | 14 passaram |
| `pnpm --filter @adatechnology/game-test-room test` | 94 passaram (92 + 2 de `host-events.test.ts`) |
| `pnpm --filter @adatechnology/game-weapons-three test` | 5 passaram |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro) | exit 0, nenhum arquivo de teste falhou |
| `node examples/weapons-test-area/build.mjs && test.mjs` | `ok: bundle` |

Modelo da execução: `sonnet`.

## T1.4 — Som do tiro (S2)

Modelo da execução: `sonnet`. Branch `work/spec001-t1-4`.

### O que foi portado

| Origem | Linhas | Destino |
|---|---|---|
| Jogo `sfx` (`artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`): tabela `P` `[corte, volume, duração]` | L62101-L62104 | `GAME_SOUND_CLASSES` (`game-weapons-three/src/audio/shot-sound.ts`), valores literais; `|| [1000, 0.5, 0.1]` = `FALLBACK_SOUND_CLASS` |
| Jogo `sfx`: abafamento `att = vol / (1 + d² × 0.004)`, corte `P[0] / (1 + d × 0.01)`, silêncio com `att < 0.01` | L62091-L62093, L62105 | `GAME_DISTANCE_CURVE` e `computeShotSound` |
| Jogo `sfx`: envelope (ganho de uma vez, queda exponencial até 0,001 em `P[2]`), ruído branco de 1,5 s, início em `Math.random()` do buffer | L62078-L62083, L62106-L62108 | `classBurst` em `audio.ts`; buffer e início saem do `createRng` do kit (semente) |
| Jogo: calibre → classe (`12ga` escopeta, `9x19` pistola, `308` rifle, o resto fuzil) | L68697 | `computeShotSound` (escopeta pelo cartucho, mão pela categoria, resto por faixas de energia que reproduzem os quatro calibres do jogo) |
| Jogo: `recarga` e `vazio` tocados na troca de arma, recarga e arma vazia | L68644-L68662 | classes `reload`/`empty` dentro de `MECHANICAL_SOUNDS` (`dry_fire`, `magazine_out`, `rounds_in`...) |

Nomes em inglês: `pistola→pistol`, `escopeta→shotgun`, `fuzil→rifle`, `rifle→long_rifle` (7,62×51), `impacto→impact`, `carne→flesh`, `passo→step`, `vidro→glass`, `madeira→wood`, `recarga→reload`, `vazio→empty`, `explosao→explosion`.

### API

- `computeShotSound({ caliber? | energyJ?, category?, distance?, volume?, suppressed?, indoors? }, options?)` → `{ soundClass, energyJ, audible, cutoff, gain, duration, crack, body }` (puro).
- Energia (S2): fator `base + span × k` (k de 0 a 1 em escala log, 50 J a ~15,8 kJ) dividido pelo fator na energia de referência da classe (`CLASS_REFERENCE_ENERGY`: 500, 2700, 2100, 3500 J = os calibres do jogo no SDK), então os calibres do jogo dão exatamente o som do jogo. Crack (alto) e corpo (grave) seguem só a energia, como já era no SDK.
- `createWeaponAudio(volume?, options?)`: `seed`, `classes`, `distance`, `energy`, `referenceEnergy`, `classOf`, `bands`, `suppressor`, `indoors`, `mechanical`, `createContext`. Métodos novos: `shotSound`, `mechanical(id)`, `event(weaponEvent)`, `play(classe, volume, distância)`; `shot` aceita `extras`. Os métodos antigos continuam (o `fx.ts` não mudou).
- `MECHANICAL_SOUNDS` (uma entrada por id de `RELOAD_STAGES`, mais `dry_fire`, `misfire`, `feed`, `cycle`, `mode`, `safety_on/off`, `jam`, `clear_start/end`) e `mechanicalSoundOf(event)` para a T1.3 ligar eventos da regra a sons.
- `game-weapons` passa a exportar `createRng` (mulberry32 já usado pela regra).

### Desvios

1. **A Galeria não tem som** (`armas-itens__galeria-3d-arsenal.js` não usa `AudioContext` nem osciladores; nenhum `Oscillator` no arquivo). Só `recarga` e `vazio` têm base no jogo; os cliques metálicos de ferrolho, ferrolho, pane, desobstruir, trava e cilindro são do SDK (a mesma síntese `metal` da versão anterior), com frequências por etapa escolhidas por mim. Se o dono quiser outros timbres, é troca de dados em `MECHANICAL_SOUNDS`.
2. **Supressor e ambiente fechado** não existem no jogo: multiplicadores meus (supressor: volume ×0,3, corte ×0,6, sem crack, corpo ×0,5; fechado: duração ×1,5, corte ×0,85), todos configuráveis.
3. O ruído do calibre (`noise`, metros) não entra no som: no jogo ele só atrai zumbis (`emitNoise`).
4. O jogo escolhe a classe pelo id do calibre; o SDK tem 28 calibres, então a classe vem de faixas de energia (pistola < 1000 J, fuzil < 3000 J, rifle longo acima), por categoria de mão e pelo cartucho de escopeta, substituíveis por `classOf` e `bands`.
5. Buffer de ruído de 1,5 s como no jogo (era 0,6 s); o `Math.random` foi trocado pelo gerador com semente (buffer, início e tom da cápsula).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-weapons test` | 99 passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 32 passaram (5 de antes + 27 de `audio.test.ts`: fórmulas do jogo nos quatro calibres a 0, 10, 60 e 120 m, silêncio acima de ~157 m, monotonia por energia e distância, supressor e ambiente, opções, determinismo e `AudioContext` falso) |
| `pnpm lint` | exit 0 |

Modelo da execução: `sonnet`.

## T1.2 — Contratos de animação da arma (A5)

### O que entrou

- **`game-contracts/src/tool-animation.ts`**: o contrato genérico (sem arma, sem three.js) pelo qual uma regra dirige qualquer renderizador.
  `toolAnimationStep(event)` traduz o `HostEvent` em `play` (clipe, variante, duração, repetição), `sync` (etapa) ou `finish`;
  `createToolClipPlayer({ clips, rig, onEvent })` toca `AnimationClipSpec` escalados à duração que a regra deu, aplica as poses em uma
  `ToolRig` e dispara os eventos do clipe; `scaleClip`, `sampleClip` e `checkToolClips` são as peças puras. Interface `ToolAnimator` para quem
  implementar o seu. Os marcadores de etapa são eventos de clipe `stage` com `data.stage`.
- **`HostEvent`** ganha `cycle`, `stage` e `feed`; `tool`, `reload` e `clear` (início) levam `duration` (segundos da fase, tirados do `phase`
  `{id,start,end}` da arma) e `reload` leva `kind`.
- **`game-test-room/src/host-events.ts`**: mapeia `cycle`, `reload_stage` e `feed` (antes `null`) e passa a duração do `phase` ativo; a sala o
  lê em `flushEvents` logo antes de esvaziar os eventos.

### Desvios do desenho (e por quê)

1. **A regra não foi alterada**: a duração sai de `WeaponState.phase`, não de um campo novo em `WeaponEvent`, para os 99 testes de `game-weapons` ficarem iguais.
2. **`toHostEvent`** troca o terceiro parâmetro (`recoil`) por `{ recoil, phase }` (quebra para quem chamava direto; só a sala chama).
3. O tocador fica em `game-contracts` (e não em um pacote novo) porque é puro e sem dependência; o pacote já guardava `checkAnimation`.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-contracts test` | 24 passaram (16 + 8 de `tool-animation.test.ts`) |
| `pnpm --filter @adatechnology/game-weapons test` | 99 passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 5 passaram |
| `pnpm --filter @adatechnology/game-test-room test` | 96 passaram (95 + 1 de ciclo e recarga; `host-events.test.ts` reescrito) |
| `pnpm lint` | exit 0 |
| `node examples/weapons-test-area/build.mjs && test.mjs` | `ok: bundle and room page` |

Modelo da execução: `sonnet`.

## T1.5

Modelo: `sonnet` (nenhuma decisão estrutural nova; o desenho da T1.1 §2/§3 e o consolidado A11/E1 bastaram). Branch `work/spec001-t1-5`, 4 commits: divisão do `weapon.ts`, contratos, lançador/arremessáveis/lança-chamas, reação em cadeia.

### O que foi feito

| Commit | Conteúdo |
|---|---|
| `refactor(weapons): divide weapon.ts…` | `weapon.ts` (614 linhas) virou `weapon-core.ts` (estado e relógio, 219), `weapon-commands.ts` (91), `weapon-firearm.ts` (129), `weapon-shared.ts` (59) e `weapon.ts` (gatilho, 136), em classes abstratas encadeadas. Sem mudança de comportamento: os 99 testes e as sementes ficaram iguais. |
| `feat(contracts): …` | `Use` ganha `explosive`, `trigger`, `armDistance`, `injuryRadius`, `stunSeconds` no `throw` e os usos `place` e `backblast`; `PartSpec.explodes.chain` (`ExplosionChain`); evento `primed`. Aditivo. |
| `feat(weapons): lançador completo…` | `ExplosiveBody`, `blastEffect`, `backblastEffect`, `throwableUse`, `launcherUses`; `rules.explosives`; `explosive-weapons.json` (flashbang, dynamite, c4, claymore); `chain` e `explosion` nos explosivos; `tests/explosives.test.ts` (18) + 2 em `catalog.test.ts`. |
| `feat(destruction): reação em cadeia…` | `chain.ts` (`explosivePart`), `prime`/`detonatePrimed` em `world.ts`, evento `primed`, fogo da peça armada no renderizador; `tests/chain.test.ts` (12) + 1 de renderizador. |

### Valores portados (fonte)

| Valor | De onde |
|---|---|
| Distância mínima de armar 10 m; sopro 5 m; foguete físico com queda; "abaixo disso, bate sem explodir" | Arsenal §13 (texto "Bazucas"), já em `launcherCommon` |
| Gravidade 9,8; quique no chão 0,35 da queda e 0,6 do deslocamento; parede 0,4 | `jogo.js` `explosionsUpdate` 68300-68312 |
| M67: espoleta 4 s (o jogo usa 3,5 e foi rejeitado na T1.1); bomba de cano 3 s | Arsenal §13; SDK |
| Molotov explode no primeiro choque, fogo 4 m por 9 s (antes 1,5 m por 12 s no arquétipo do SDK) | `jogo.js` `fogoRes` 68068; `explode` 68231 |
| Flashbang atordoa 4 s num raio de 10 m | Arsenal §13; Lab `SC.flash` |
| Claymore: cone de 60° (meio ângulo 30°), letal 15 m, ferimento/alcance 50 m, só com fio; atrás, nada | Arsenal §13; Lab `PROF.claymore` e `SC.claymore` |
| C4 só dispara com `remote` | Arsenal §13 ("com detonador") |
| Lança-chamas: alcance M2 6 m, caseiro 3,6 m; combustível 9 s e 5 s | `launchers.json` (T1.1, Galeria `WEAP` + SDK), testes novos |
| Cone do sopro 19° (atan 0,35) | Lab `backblast()` ~785 (desvio lateral ±0,35) |
| Botijão: tiro 1,4 s, explosão 0,25 a 0,6 s | `jogo.js` `exploDamage` 68173-68180 |
| Barril: tiro 1,2 s, explosão 0,2 a 0,4 s | `jogo.js` `exploDamage`; Lab `SC.barril` (t>1,2) |
| Tanque do carro: 3 a 8 s após metade do hp, explosão 0,6 s | `jogo.js` `exploDamage` (hp < 300 de 600; dano > 400) |
| Bomba do posto: tiro 1,0 s, vizinha 0,4 s depois; tanque do posto 2,0 s depois da última bomba | Lab `SC.posto` 968-995 (1,0; 1,4; 1,9; 2,3; 4,3 s) |

Tudo isso mora em `tools/weapons-catalog/decisions.json` (fonte, razão) e foi regenerado pela ferramenta; `catalog:check` está verde.

### Decisões e desvios

1. **Divisão do `weapon.ts` por herança**: quatro classes abstratas (núcleo, comandos, arma de fogo) e `WeaponRuntime` final. O estado mutável compartilhado impede funções soltas sem passar o estado inteiro; a herança manteve o diff mecânico.
2. **Contratos**: o arremesso continua `throw` (a sala de teste só trata esse tipo e ignora os novos). Foguete = `throw` com `trigger: 'impact'` e `armDistance`. Carga posta (Claymore, C4) = `place`. A sala (`room.ts`) não mudou.
3. **Fuso da molotov**: o `ExplosiveDef` passa a mandar no arremessável (fuse e fogo, além de energia/ruído/raio). O teste "molotov carries fire" mudou de 1,5 m/12 s para 4 m/9 s, com a fonte na linha do teste.
4. **Quatro arremessáveis novos** (`flashbang`, `dynamite`, `c4`, `claymore`) ficam num arquivo à mão e apontam `archetype: 'frag_grenade'`; assim a área de armas (só arquétipos até a T1.3) continua com os mesmos balcões.
5. **Cadeia: tiro ou explosão que mataria a peça a arma em vez de despedaçar** (`hp` fica em 1 e a peça é armada). Sem isso o atraso do jogo (vazar 1,2 s, explodir 0,2 a 0,4 s depois) nunca apareceria, porque o dano da explosão em joules passa o hp do barril.
6. **O atraso conta do instante da explosão que armou**, não do fim do quadro: a linha do tempo é a mesma com `dt` de 0,01 ou 0,5 (teste).
7. **Escalonamento do Laboratório não é reproduzido**: no `SC.posto` as bombas explodem em 1,0, 1,4, 2,3 s por roteiro. Pelas regras, toda bomba dentro de 12 m é armada junto (0,4 s) e explode em 1,4 s; o carro em 1,0 + 0,6 s; o tanque em 3,0 s (o Laboratório 4,3 s). A ordem é por tempo, depois objeto e peça.
8. **Carro, faixa média**: no jogo, explosão de dano 200 a 400 incendeia o motor (3 a 8 s) e acima de 400 explode em 0,6 s. Aqui toda explosão no alcance usa 0,6 s (uma faixa só); o fogo e o tiro usam 3 a 8 s.
9. **Lança-chamas**: sem mudança de regra (alcance, combustível e fogo já saíam da T1.1); entraram só os testes de alcance e combustível. Recarga do tanque (1,1 s) segue não ligada, como na T1.1.
10. **Cozinhar a granada** (segurar antes de arremessar, Arsenal §13) não foi feito: o gatilho dispara no apertar (teste antigo "uma vez por puxada") e cozinhar pede soltar para arremessar.

### Perguntas para o dono (escolhas de negócio que as fontes não cobrem)

1. **Espoleta da dinamite e do flashbang**: sem número nas fontes (o Laboratório usa 2,1 s só na demonstração). Usei os 4 s da M67 (`decisions.json`, Q7). Quer outro valor?
2. **Temperatura que arma pelo fogo**: o Arsenal diz "explode com tiro ou fogo", sem graus. Usei 300 °C (`FIRE_PRIME_C`, ou `explodes.atC`). Quer outra?
3. **Atraso do fogo no botijão, barril, bomba**: o jogo só trata tiro e explosão. Igualei o atraso do fogo ao do vazamento do tiro (1,4 s, 1,2 s, 1,0 s). Quer outro?
4. **Dano do sopro atrás do lançador**: o Arsenal só diz "fere quem estiver a 5 m". A regra dá `falloff` linear de 1 a 0 e o cone de 19° (derivado do Laboratório); o dano em pontos é do `game-characters`. Cone e queda estão certos?
5. **Fio da Claymore**: nenhuma fonte dá comprimento ou ângulo do fio; hoje o host decide quando "o fio foi tocado" e chama `trigger('wire')`.
6. **Ruído do disparo do lançador**: continua 0 (pergunta 3 da T1.1 em aberto).
7. **Massas dos arremessáveis novos** (referência real, sem fonte do time): flashbang 0,23 kg, dinamite 0,5 kg, Claymore 1,6 kg; o C4 usa 0,57 (Galeria). Quer outras?
8. **Cozinhar a granada**: quer que segurar o gatilho encurte a espoleta e o arremesso saia ao soltar? Muda a semântica de `held` das granadas.
9. **Tanque subterrâneo do posto**: só responde a fogo e a explosão (não a tiro); ok?

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-weapons test` | 119 passaram (99 + 18 de `explosives.test.ts` + 2 de `catalog.test.ts`) |
| `pnpm --filter @adatechnology/weapons-catalog-tool test` / `catalog:check` | 14 passaram / atualizado |
| `pnpm --filter @adatechnology/game-destruction test` | 96 passaram (84 + 12 de `chain.test.ts`) |
| `pnpm --filter @adatechnology/game-destruction-three test` | 47 passaram (46 + 1) |
| `pnpm --filter @adatechnology/game-test-room test` | 94 passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 5 passaram |
| `pnpm lint` | exit 0 |

Modelo da execução: `sonnet`.

## T1.3 — `game-weapons-three`: os modelos e a animação da Galeria

### O que entrou

- **Modelos (porte, não reescrita)**: `src/models/` traz os construtores da Galeria com as mesmas peças, medidas e ordem de criação (a ordem entra no hash): pistola (11
  estilos), revólver, fuzil (50 armas, em receptor, cano, guarda-mão, empunhadura e carregador, coronha e acessórios), bullpup, P90, basculante, M2, os quatro lançadores
  e os dois lança-chamas. Os 78 ids de `data/models.json` constroem seu modelo; o do ar livre (`buildWeaponModelById`) estica a arma ao comprimento real como o `fitLength`
  da página. Peças ganham nome (`slide`, `mag`, `bolt`, `trigger`...) por `partRegistry`. Materiais e primitivas em `models/kit.ts`, uma por namespace do three; o addon
  `RoundedBoxGeometry` foi portado sobre o `THREE` do host (`models/rounded-box.ts`), porque o host empresta o namespace e não importa addons.
- **Cartucho e estojo por calibre**: `buildCartridge` (a `cartridge(a)` da página, em mm) a partir de `CaliberDef.cartridge`, com a forma derivada do aro e do estreitamento
  do estojo (`cartridgeShape`); `buildCasing` (estojo vazio, em metros) e `buildRound` (cartucho inteiro) usam as mesmas medidas, no lugar dos quatro tamanhos fixos da página.
- **Clipes** (`src/animation/`): cada `tw` da Galeria virou um tween e `composeClip` o transforma em `AnimationClipSpec` (amostra a curva da página em 10 passos). Há um
  conjunto por modelo: `shot` e `shot_last` (corrediça fica atrás na última), `misfire`, `empty`, `cycle` (pump 0,5 s, ferrolho 0,82 s, alavanca 0,55 s: os mesmos
  `timings.cycle` da regra), `reload`, `reload_empty` e `reload_one_by_one` com as sete recargas, `feed`, `fault_*`, `clear_*`, `safety_on/off`, `mode` e `draw`.
  Os marcadores `stage` de cada recarga vêm de `RELOAD_STAGES`, na fração em que a regra os põe.
- **Arma na mão** (`src/fx/`): `createViewmodel` toca os clipes pelo `createToolClipPlayer` do T1.2, com o relógio da regra, e trata os eventos de clipe: clarão, estojo,
  pente que cai (cópia do pente com a física da página), cartucho entrando (`moveIn`), cápsula presa na janela (`stuckCase`) que voa ao destravar, tubo descartável, foguete
  e jato de fogo (`fireHeavy`), brilho do cano e fiapo de fumaça (`stepWeapon`). Tudo sorteia de uma semente (`createRandom`); o `Math.random` que restou é o ruído do
  sintetizador de som (`audio.ts`), que a S1 troca.
- **Desgaste (`QUAL`)**: `applyCondition(kit, model, 'new' | 'used' | 'worn' | 'rusty')` troca os materiais como `applyQuality`; opção `condition` do módulo e `fx.setCondition`.
- **Área de armas**: o filtro `archetype === undefined` saiu; 117 armas e ferramentas (as 121 menos os 4 gestos do corpo) em até 6 balcões, em duas fileiras, cada arma com a
  sua faixa (`weaponsLayout`), `asleep`. Cada arma da Galeria é um corpo rígido (`body`, caixa do modelo com a massa real) com os meshes presos a ele por `destructionPart`.
  Os arquétipos, o corpo a corpo e o arco seguem com o prop de caixas (`box-fx.ts`).
- **Sala de testes**: `rules: { faults: false }` saiu (a regra padrão com panes vale na sala); `setTool` chama `draw()` e o evento `tool` carrega a duração; **X** destrava
  e **B** liga a trava (R e Q seguem); mensagens de pane e trava no HUD (pt-BR e en); a ajuda lista R, Q, X e B. Eventos `cycle`, `stage` e `feed` chegam aos módulos.

### Golden (o "igual ao original")

`tools/golden/captures/arsenal-models.js` roda **a página** (Chrome headless, three r128, o artefato `C96Cxhb4bTA9bbojV4ctKH.html`): corta de dentro do IIFE da página os
construtores (do `T = THREE` até os explosivos, mais `casingMesh`) e devolve a cena de cada arma e de cada cartucho. Fixtures em
`packages/game-weapons-three/tests/fixtures/team-golden/`: `gallery-models.json` (9 armas, uma por construtor, com as linhas de cada nó: Glock 17, S&W 686, AK-47,
Steyr AUG, FN P90, Boito, Browning M2, RPG-7 e lança-chamas M2) e `gallery-model-hashes.json` (as 77 e os 22 cartuchos, só o hash).

| Comparação | Resultado |
|---|---|
| 9 armas, nó a nó (tipo, posição, quaternion, escala, geometria, cor, opacidade) | **idênticas** |
| 77 armas da Galeria, hash da cena | **77 de 77 idênticas** (a variante Remington 700 .300 WM sai igual à base) |
| 22 cartuchos, hash da cena | **21 de 22 idênticos**; o .50 BMG difere só pelo projétil (13,0 mm na página, 12,7 mm no SDK, decisão A6 da T1.1); com 13,0 o teste bate |

### Desvios do desenho (e por quê)

1. **Só o que o r128 para o r160 obriga**: (a) cores: a página chama `convertSRGBToLinear` à mão, o r160 converte sozinho no `Color.set`, então o código não chama; o teste lê os
   valores lineares e arredonda como o r128 (`getHexString` truncado). (b) `RoundedBoxGeometry`: mesmo algoritmo e mesmos vértices (conferido contra o `jsm` do r128 e do r160), mas
   feito sobre o `BoxGeometry` do host; o `type` da geometria segue `BoxGeometry` como na página. Nada mais mudou; **nenhuma diferença de forma, medida ou material**.
2. **Gravação**: usei o gravador por página (`bin/record.mjs`) com uma captura que corta os construtores do próprio texto da página (eles estão num IIFE, sem global).
3. **Nomes**: as peças móveis ganham nome; a página não nomeia nada, então o hash do teste ignora os nomes (`ignoreNames`).
4. **Curva**: o `ease` da página vira chaves lineares amostradas em 10 passos por tween (erro máximo de 0,4% do movimento); os valores finais e os tempos são os da página.
5. **Relógio da regra**: o tempo dos clipes é o da página, escalado à duração que a regra dá (recarga, ciclo, destravar). Destravar leva 1,2 s na regra contra 0,3 a 0,6 s da página;
   recargas por cartucho esticam com o número de cartuchos. A parte que não escala é o que a regra não conhece (os 0,24 s de cada cartucho entrando).
6. **Coisas que a Galeria não faz e entraram**: o seletor ou a alavanca de trava gira (a página só o desenha), o saque levanta a arma (a página não tem mãos), e `mode` mexe no
   seletor. São movimentos pequenos, ligados a peças que já existiam; sem peça de trava no modelo, o clipe não existe.
7. **Misfire (nega)**: na regra do SDK uma nega em revólver e basculante só gasta o cartucho (clipe `misfire`) e nas outras armas trava (clipe `fault_misfire`, o mesmo gesto): igual à página.
8. **Lançador**: a regra emite `shot` com `shots: 0` (é um arremesso); o host agora diz `shots: 1` para o lançador, e só a nega (`misfire`) chega com 0. O lança-chamas não emite
   evento algum, então o jato sai da queda do combustível (`tool().ammo`).
9. **Capacidade do 686**: a regra dá 7 e o modelo da Galeria tem 6 câmaras; a recarga ejeta 6 cápsulas. Dado, não código.
10. **Saque na sala**: todo teste que pega uma arma e atira em seguida espera 0,4 s (a regra responde `drawing` por 0,35 s); a sala e os exemplos foram ajustados.

### Perguntas para o dono

1. **Arquétipos sem modelo**: as 42 armas genéricas (`pistol_9mm`, `rifle_5_56`...) e o corpo a corpo seguem como caixas porque nenhuma entrega os desenhou. Quer que cada arquétipo
   use o modelo da marca que o aponta (`archetype`), ou o time de armas desenha os genéricos?
2. **Capacidade do 686 e das revólveres de 7 tiros**: a Galeria desenha 6 câmaras para todos. O SDK diz 7. Manter o dado (7) e desenhar 6, ou 7 câmaras só nesse modelo?

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-contracts test` | 24 passaram |
| `pnpm --filter @adatechnology/game-weapons test` | 99 passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 53 passaram (5 de antes, 33 do golden, 10 da arma na mão, 4 dos clipes, e a área ganhou 1) |
| `pnpm --filter @adatechnology/game-test-room test` | 99 passaram (96 + 2 de X/B e saque + 1 de lançador) |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro) | exit 0, nenhum arquivo falhou |
| `node examples/weapons-test-area/build.mjs && node examples/weapons-test-area/test.mjs` | `ok: bundle and room page` |
| Chrome real (headless): `dist/sala-armas.html`, AK-47 na mão atirando | sem erro de execução; 49 meshes na mão; 126 posicionamentos |

Modelo da execução: `sonnet`.

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

Modelo da execução: `sonnet`.

## T1.6 — Goldens por arma e `weapons-test-area` com os controles novos

Modelo da execução: `sonnet`. Branch `feat/spec-001-fase-1` (sobre T1.1 a T1.5 e o hotfix). Fecha a Fase 1.

### O que foi integrado

| Item | O que entrou | Onde |
|---|---|---|
| 1. Som na mão e na área | O tiro toca `computeShotSound` com `{ caliber, distance }` (energia do calibre, `muzzleEnergy × chumbos`); os eventos da regra tocam `mechanicalSoundOf` por `audio.event` (etapas de recarga, ciclo, pane, destravar, trava, vazio, nega, modo); o lançador toca a classe `explosao` do jogo; a explosão (evento novo `explosion` do host) toca pela distância da câmera. `Math.random`: nenhum restou em `game-weapons-three/src` (a T1.4 já tinha semeado; conferido por `grep`) | `fx/viewmodel.ts`, `audio/host-events.ts`, `box-fx.ts`, `area.ts` |
| 2. Explosivos na área | A sala arremessa e põe pelo `ExplosiveBody`: espoleta, armar por distância (`dud` abaixo de 10 m), `blastEffect` (cone da Claymore, zona do jogador), `backblastEffect`, `renderer.explode`; Y detona cargas postas. Barril (2), botijão P13 e tanque do carro no canto leste (x 8,6 a 11,2; z -8 a -9,3) com `explodes.chain` do `ExplosiveDef` | `game-test-room/src/room.ts`, `game-weapons-three/src/world-explosives.ts` |
| 3. Bancada | Camadas `muzzle_flash`, `casings`, `magazines`; controles `condition` (regra e materiais), `ammo_quality`, `sound_distance` (0 a 200 m); métricas `casings_live`, `magazines_live`, `heat` (máx. 100). Disparar, rajada e destravar seguem teclas | `area.ts`, `fx/layers.ts` |
| 4. Modelos dos arquétipos | Decidido: cada arquétipo veste o modelo da primeira marca (menor id) que o aponta **e atira do mesmo jeito**; corpo a corpo, arco e besta sem ponteiro ficam com o prop | `ARCHETYPE_MODELS` em `models/index.ts` |
| 5. Goldens por arma | 125 armas, 989 passos; cada arma: saque, trava, cada modo de tiro, vazio, recarga automática, completa e um a um, pane forçada e destravar | `game-weapons/tests/weapon-goldens.test.ts`, `tests/support/weapon-scenario.ts`, `tests/fixtures/rule-goldens/weapon-scenarios.json` (162 KB, uma linha por passo) |
| 6. Área, vitrine e miniatura | Texto de controles, `catalog.mjs` (121 armas, explosivos, reação em cadeia), miniatura regravada | `examples/weapons-test-area`, `site/catalog.mjs`, `site/thumbs/weapons-test-area.jpg` |

### Decisões

1. **Arquétipo só empresta modelo de quem atira do mesmo jeito.** Os lançadores (`rpg_7`, `m72_law`, `at4`, `carl_gustaf_m4`) têm `archetype: shotgun_pump_12` nos dados; pela regra "menor id" o `at4` daria um tubo de foguete à escopeta. A condição é `action.kind` igual ao do arquétipo. Resultado: 15 arquétipos com modelo (`pistol_9mm` → `beretta_92fs`, `pistol_45` → `colt_m1911`, `revolver_357` → `sw_686`, `revolver_38` → `taurus_82`, `smg_9mm` → `cz_scorpion_evo_3`, `shotgun_pump_12` → `cbc_pump_military_3_0`, `shotgun_semi_12` → `aa_12`, `shotgun_double_12` → `boito_double_barrel`, `rifle_7_62x39` → `ak_47`, `rifle_5_56` → `ak_12`, `rifle_bolt_308` → `fn_scar_h`, `sniper_338` → `accuracy_awm`, `anti_materiel_50` → `barrett_m82a1`, `carbine_22` → `cbc_122`, `flamethrower` → `improvised_flamethrower`); `pistol_22` (nenhuma marca o aponta), o corpo a corpo, o arco, a besta, as ferramentas e os arremessáveis seguem com o prop. O comprimento do modelo é o da marca, não o do arquétipo.
2. **Explosão vira evento do host** (`HostEvent.explosion`) em vez de o módulo ouvir a sala: aditivo, genérico (não cita arma), e é o que deixa a área tocar o som por distância. Também sai das peças do mundo (`explode` do destruidor).
3. **`ModuleHost.configureTool({ condition, ammoQuality })`**: o módulo não tinha como mudar a regra da arma na mão. O host aplica à ferramenta em mãos e às seguintes (`toolSettings`). Genérico (desgaste e qualidade da munição valem para qualquer ferramenta).
4. **Raio do mundo = alcance de ferimento.** A explosão arremessada passa a chamar `world.explode` com `injuryRadius` (antes o raio letal da arremessável), igual ao da peça armada em cadeia (`explodes.radius = injuryRadius`): o mesmo explosivo faz o mesmo estrago no mundo, arremessado ou em cadeia. A energia cai com a distância.
5. **Cone da Claymore no mundo**: `world.explode` é esférico; para o cone, cada objeto do cone leva uma explosão própria no seu centro, com a energia vezes a queda de `blastEffect`. Atrás, nada (teste com duas cadeiras).
6. **Fio da Claymore e detonador**: a mesma tecla (Y) dispara `remote` e depois `wire` (pergunta 5 da T1.5 segue aberta).
7. **Golden regrava sozinho se o arquivo não existe** ou com `UPDATE_GOLDEN=1`; com ele existindo, compara. Duas armas (a sala e o jogo) rodam com `faults: false`, exceto o passo da pane (`faultChance: () => 1`).
8. **Explosivos do mundo sem `game-destruction` como dependência**: o `game-weapons-three` monta o `explodes` à mão (o mesmo conteúdo de `explosivePart`) porque o bundle global (`index.global.js`) só embute o `game-weapons` e a dependência nova mudaria o pacote.

### Desvios e limites

- **Vitrine em 1,5 quadro por segundo** no Chrome headless (SwiftShader): a área tem 5.962 chamadas de desenho e 1,5 milhão de triângulos com as 121 armas nos balcões com modelo real. Em GPU não medi. Para a verificação no navegador escondi as armas dos balcões (`root.visible = false`; a regra e a física seguem), e a sala foi a 60 fps. Se a área precisar rodar em máquina fraca, o caminho é instanciar os balcões ou carregar o modelo só da arma mirada (decisão de negócio de desempenho, abaixo).
- **O canto dos explosivos não é seguro contra granada**: fica a 17 m do jogador e a 12,5 m do alvo mais próximo, mas uma M67 (alcance de ferimento 15 m) jogada nos alvos arma os barris (é o comportamento pedido: explosão primando vizinha). Para testar por tiro basta mirar o barril de 17 m, como o teste do navegador.
- A miniatura mostra o AK-47 na mão sobre os balcões; as demais miniaturas não foram regravadas (`capture-thumbs.mjs --only=<exemplo>` agora existe para isso).
- A Galeria não tem som: os timbres das etapas de recarga seguem os da T1.4 (SDK).

### Verificação no Chrome real (headless, `site/dist` servido em porta local)

`node site/build-site.mjs`, `python3 -m http.server`, Chrome `--headless=new` com um `AudioContext` embrulhado que conta nós, via DevTools:

| Verificação | Resultado |
|---|---|
| Área abre sem erro de execução | Sem exceção nem `console.error`; só um 404 de `favicon.ico` |
| Módulo e bancada | 134 itens; controles `condition`, `ammo_quality`, `sound_distance`; métricas `casings_live`, `magazines_live`, `heat` |
| Fuzil atira com som | AK-47: munição 30 → 29; 2 rajadas de ruído (clarão e corpo do tiro) e 5 osciladores; 1 cápsula no ar |
| Recarga com som | 5 fontes de ruído nas etapas |
| Barril em cadeia por um tiro | Os 4 explosivos do mundo `broken` (barril, botijão, barril, tanque do carro, explosões em 8,98, 9,27, 9,29 e 9,60 s do relógio) |
| Granada | `explode` no log: 1 entrada, 200.000 J, 15 m |

### Perguntas para o dono (escolhas de negócio que as fontes não cobrem)

1. **Desempenho da área**: 5.962 chamadas de desenho com 121 modelos reais nos balcões. Aceitável, ou quer instanciar/ocultar o que está longe?
2. **Som do lançador**: usei a classe `explosao` do jogo a 60% (o lançador não tem calibre). Quer outro timbre?
3. **Som da explosão pelo alcance** (`0,4 + 0,04 × raio`, no máximo 1): valor meu. Quer outra curva?
4. **Claymore e fio**: ainda é o jogador quem aperta Y; quer que algo que cruze o fio (objeto ou jogador) dispare sozinho?
5. **Estado "usada", "gasta" e "enferrujada" na bancada**: valem para todas as armas ao mesmo tempo. Quer por arma?
6. **Modelo dos arquétipos**: o comprimento é o da marca (um `pistol_9mm` com o corpo de uma Beretta). Quer esticar ao comprimento do arquétipo?

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 (ESLint: sem problemas) |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0; nenhum arquivo falhou |
| `pnpm --filter @adatechnology/game-weapons test` | 247 passaram (119 de antes + 128 do golden por arma: 125 armas + cobertura + repetição) |
| `pnpm --filter @adatechnology/game-weapons-three test` | 90 passaram (80 de antes + 10 de `integration.test.ts`: som do tiro e distância, sons mecânicos, explosão por distância, bancada, estado da arma, camadas, modelos dos arquétipos e a cadeia dos barris) |
| `pnpm --filter @adatechnology/game-test-room test` | 104 passaram (99 + 4 de `explosives.test.ts` + 1 de `configureTool`) |
| `pnpm --filter @adatechnology/game-contracts test` | 24 passaram |
| `pnpm --filter @adatechnology/game-destruction test` / `-three` | 96 / 47 passaram (sem mudança) |
| Golden da Galeria (modelos e calor) | verde (`gallery-models.test.ts` 33, `team-golden.test.ts`) |
| `node examples/weapons-test-area/build.mjs && node test.mjs` | `ok: bundle and room page` |
| `node site/build-site.mjs` e `node site/capture-thumbs.mjs <url> --only=weapons-test-area` | site gerado (4 exemplos, 23 pacotes) e miniatura regravada |
| Chrome real, `site/dist` em `127.0.0.1:4811` | ver a tabela acima: sem erro, tiro com som, recarga com som, cadeia por um tiro, granada |

Commits (todos terminam com o `Co-Authored-By` de Opus 5.5): `test(weapons)` golden por arma; `feat(test-room,contracts)` explosivos da regra na sala; `feat(weapons-three)` modelos dos arquétipos; `feat(weapons-three,test-room)` som, bancada e explosivos do mundo; `feat(site,examples)` vitrine; `test(test-room)` `configureTool`; e o de documentação (skills, changesets, inventário, evidência).

Modelo da execução: `sonnet`.

## Revisão da Fase 1

Correção dos achados da revisão de código da Fase 1 (branch `feat/spec-001-fase-1`). Cada item foi um commit pequeno, com teste que falha sem a correção quando o achado era de comportamento.

### Achados e correções

| Id | Achado | Correção |
|---|---|---|
| S1 | Área de armas com ~5.962 chamadas de desenho e 1,5 M de triângulos | `buildModeledProp` agrupa os meshes do modelo por material, assa a matriz relativa ao grupo em geometria clonada não indexada e emite um mesh por material (`userData.destructionPart = 'body'`, `castShadow = false`). A junção é um port local de `mergeGeometries` (`src/merge-by-material.ts`, só `position`, `normal`, `uv`): o pacote recebe `THREE` do host e não importa `three/addons` (mesma decisão do `rounded-box.ts`), então o IIFE continua precisando só de three. A arma na mão não mudou (modelo com pivôs). Arquétipos que só emprestam o modelo de uma marca (`ARCHETYPE_MODELS`, 15 armas) saem do balcão ao lado da marca: seguem no catálogo (`items()`) e na mão. `matrixAutoUpdate = false` **não** foi usado: o destruidor move os meshes ao quebrar a peça e a matriz travada ignoraria o movimento |
| S2 | `team-golden` passaria em silêncio se o nome mudasse | Exige mais de um passo gravado e o `selected` como primeiro |
| S3 | `sources.test.ts` frouxo | Conta as linhas do §06 (67), tipos e guarda no lugar de `any`, `DEFAULT_RULES` importado do pacote `@adatechnology/game-weapons` (devDependency nova da ferramenta), mais duas asserções de texto cru (linha da Glock 17 na Galeria, linha do AK-47 no §06) |
| S4 | Subsistema de explosivos dentro do `room.ts` | `packages/game-test-room/src/explosives.ts` com contexto injetado (`room.ts` 2.408 → 2.203 linhas, `explosives.ts` 301). O projétil sem explosivo detona pela mesma função dos demais (log, evento do host, parte do jogador, fogo) e voa com `rules.explosives.gravity` (9,8), não 9,81 |
| S5 | `configureTool` específico e misfire como `shot` de 0 | `configureTool(settings: Readonly<Record<string, string>>)` com os ids dos controles do módulo (`condition`, `ammo_quality`); misfire virou o evento `{ type: 'misfire', weapon }` (genérico: "o cartucho foi gasto e nada saiu"), `toolAnimationStep`, `toHostEvent`, sons, viewmodel e box-fx ajustados. Cresce a união `HostEvent`: **quebra para `switch` exaustivo** (changeset `minor`) |
| S6 | `DRAW_SECONDS = 0.4` fixo nos cenários | `room.waitUntilReady(maxSeconds?)` lê a fase da ferramenta e espera mais um quadro (o gatilho julga o quadro por onde começa: sem esse quadro, o primeiro puxão ainda respondia `drawing`). README, SKILL e changeset dizem que `setTool` toca o saque |
| S7 | `random.ts` duplicava `createRng`; `ease` em dois lugares | Usa `createRng` do `game-weapons`; `ease` vem de `clip-builder.ts` |
| S8 | `drainBlasts` limitado a 64 | Esvazia a fila (termina porque a peça explode e é preparada uma vez). Teste: 100 cargas sem atraso numa chamada e uma chapa dentro do alcance de todas; sem a correção sobram blasts para a chamada seguinte (a vida da chapa muda depois) |
| S9 | Detalhes | Comentário de `withCollapses` de volta ao lugar; ruído do áudio com deslocamento `rng() * max(0, 1,5 - duração)` (teste de que nenhuma rajada passa do fim do buffer); o resto do quadro atravessa o atraso nas repetições do player de clipes (`time += dt - delay`, teste com passos variáveis); `coneBlast` por caixa (centro, cantos e ponto mais próximo; fallback à origem para objeto sem mesh) com o raio `CONE_BLAST_RADIUS`, teste com uma viga cuja origem fica atrás da carga |
| Nits | | `scaleClip` com duração zero sem NaN; `checkToolClips` exige duração > 0; `radius` duplicado de `blastNumbers` removido; `checkArsenal` valida `defaultCondition` e `defaultAmmoQuality`; `deepMerge` ignora `__proto__`, `constructor`, `prototype`; `weaponsLayout` lança quando as armas não cabem (ou uma é maior que o balcão) |

### Chamadas de desenho e triângulos da área de armas (S1)

Medido no Chrome real (`google-chrome-stable --headless=new`, SwiftShader), abrindo `examples/weapons-test-area/dist/sala-armas.html` pelo CDP, três quadros seguidos com o mesmo valor. A contagem é a das chamadas `drawElements`/`drawArrays` do WebGL (o mesmo que `renderer.info.render` conta, mais a passada do mapa de sombra, por isso é o dobro do número da T1.6, que lia só a passada principal).

| | Chamadas de desenho por quadro | Triângulos por quadro |
|---|---|---|
| Antes | 11.929 | 6,41 M |
| Depois | 902 | 1,70 M |

Queda de 13x nas chamadas e de 3,8x nos triângulos (as armas do balcão deixaram de projetar sombra). Destruição verificada no mesmo Chrome: tiro de `barrett_m82a1` por cima da `weapon_ak_47` no balcão, a parte `body` passa de `intact` para `damaged` com 1 furo, sem erro de execução. No Vitest, o teste de `weapons-area.test.ts` cobre os dois casos (um mesh por material e a peça tomando o tiro).

### Fica como seguimento

- Tamanho de `world.ts` (destruição), `types.ts` e `area.ts` além do que o S4 tirou do `room.ts`.
- Fio da Claymore por corpo (quem cruza o fio dispara): pergunta ao dono, ainda aberta.
- Clipe de destravar de 1,2 s contra 0,4 a 0,6 s da Galeria: pergunta ao dono.
- Duplicação entre os explosivos do mundo (`world-explosives.ts`) e `explosivePart` da destruição.
- Triângulos: 1,7 M ainda é muito para máquina fraca; o caminho seguinte é instanciar por modelo ou carregar só a arma mirada (a pergunta 1 da T1.6 segue aberta).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 (sem erro) |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0; nenhum arquivo falhou |
| `game-weapons` / `game-weapons-three` / `game-test-room` / `game-contracts` | 249 / 94 / 108 / 27 passaram |
| `game-destruction` / `-three` | 97 / 47 passaram |
| `tools/weapons-catalog` / `tools/golden` | 16 / 39 passaram |
| Goldens (`team-golden`, `weapon-goldens`, `gallery-models`) | verdes dentro da suíte acima |
| `node examples/weapons-test-area/build.mjs && node test.mjs` | `ok: bundle and room page` |
| Chrome real, área de armas | sem exceção nem `console.error`; 902 chamadas; tiro no balcão causa dano |

Commits (todos terminam com o `Co-Authored-By` de Opus 5.5): `perf(weapons-three)` balcão; `test(weapons,weapons-catalog)` goldens e fontes; `refactor(test-room)` explosivos; `feat(contracts,test-room,weapons-three)` misfire e `configureTool`; `feat(test-room)` `waitUntilReady`; `refactor(weapons-three)` rng e ease; `fix(destruction)` fila de blasts; `fix(test-room)` cone por caixa; `fix(contracts,weapons-three)` clipes e ruído; `fix(weapons,weapons-three)` validações; `docs(skills)`; `test(contracts)` tipo da pose; e o de evidência.

Modelo da execução: `sonnet`.

## Decisões do dono (2026-10-24)

Respostas do dono às perguntas abertas da T1.1B, T1.3, T1.5, T1.6 e da Revisão da Fase 1. Cada decisão virou uma linha decidida na seção 2 do `consolidado.md` (A13 a A19) e, onde é dado, entrou em `tools/weapons-catalog/decisions.json` (`modelChambers`, `reliability`, `timings.clear`, extras de `dynamite`, `flashbang` e `claymore`), com os arquivos gerados refeitos pela ferramenta (`catalog:check` verde).

| # | Decisão | O que mudou | Fontes | Testes |
|---|---|---|---|---|
| 1 | S&W 686 e revólveres de 7 tiros: o dado vence | O modelo desenha tantas câmaras quanto a capacidade (`options.chambers`, gerado; padrão 6; arquétipo emprestado fica com 6). Desvio da página: o golden da Galeria exclui o `sw_686` (`OWNER_DEVIATIONS`) e um teste próprio confere 7 câmaras no 686, 6 nos outros e que o hash difere do da página; a recarga solta 7 cápsulas | Arsenal §06 e a regra (7); Galeria desenha 6 | `gallery-models.test.ts`, `viewmodel.test.ts`, `sources.test.ts` |
| 2 | Taurus 82 não é especialmente confiável | `faultFactor` 1 mantido (sem "nunca engasga"); registrado em `decisions.json` `reliability` | Galeria (sem `rel`) contra Arsenal §06 | `sources.test.ts` |
| 3 | Cozinhar a granada: sim | Ver abaixo | — | `cooking.test.ts` (12), `weapons.test.ts`, 3 da sala, goldens regravados |
| 4 | Claymore, minas e cargas de fio disparam por fio de tropeço | Ver abaixo | derivado (ver abaixo) | `tripwire.test.ts` (6), 6 da sala |
| 5 | Destravar fica em 1,2 s (regra); a animação estica | Sem mudança de código; só registrado | Arsenal §10 | — |
| 6 | Espoleta do flashbang: M84, 1,0 a 2,3 s da alavanca | `fuseRange` genérico no `ExplosiveDef`, sorteado por arremesso na regra, em fluxo próprio (`seed ^ 0xbb67ae85`) | [Wikipedia M84](https://en.wikipedia.org/wiki/M84_stun_grenade), [SAM.gov](https://sam.gov/opp/ec681d45302a4afb8e4c4b6f4ea50cd1/view), GlobalSecurity XM84 | `fuse.test.ts` |
| 7 | Espoleta da dinamite: pavio de segurança, cerca de 131 s/m ±10% | `fuseLength` (m) × `burnRate` (s/m) com `burnTolerance`; padrão 0,03 m (3,93 s, cerca de 4); `setFuseLength`, controle `fuse_length` da bancada e `patch.explosives` fazem pavio longo; de `rules.explosives.placeFuseFrom` (10 s) a dinamite é posta no chão acesa | [Chemring](https://www.chemring.com/~/media/Files/C/Chemring-V3/documents/energetics/heds/safety-fuze-apr22.pdf), [Primetake 9504](https://www.primetake.com/wp-content/uploads/sites/5/2016/03/9504.pdf), 30 CFR 57.6502 | `fuse.test.ts` (conversão, tolerância com semente, fluxo separado, pavio longo), `explosives.test.ts` da sala |

### Cozinhar a granada (decisão 3)

- **Regra (`game-weapons`):** arremessável com espoleta de tempo e que não é posto no chão cozinha. O puxão tira o pino (evento `cook` `start`, `fuse` = espoleta inteira) e não devolve uso; a cada quadro `trigger` confere o tempo; `release(origin?, direction?)` **devolve** o arremesso com o que sobrou (`use.fuse`, `use.cooked`, evento `throw`); segurar além da espoleta devolve um `throw` com `inHand`, `fuse` 0 e velocidade zero (evento `burst`, no instante exato `início + espoleta`), uma vez só. Impacto (molotov, lançadores), remoto, fio e carga posta agem no puxão, como antes. A espoleta do flashbang e da dinamite é sorteada na hora de puxar o pino.
- **Sala (host):** o clique segurado chama `trigger` por quadro; ao soltar (ou ao trocar de ferramenta) a sala chama `release` e aplica o arremesso; emite o evento `cook` do host. `room.use(hold)` faz o mesmo por script. Dica de animação: `TOOL_CLIP.COOK` (começa com a espoleta como duração, termina no arremesso ou na explosão); nenhuma arma tem clipe ainda, então é só contrato. Sem som novo.
- **Desvios assumidos:** `WeaponState.release` agora devolve `TriggerResult | null`; os goldens das 4 armas de espoleta (`frag_grenade`, `pipe_bomb`, `flashbang`, `dynamite`) ganharam os eventos `cook:start` e `cook:throw` (só essas 8 linhas mudaram).

### Fio de tropeço e marcador (decisão 4)

- **Dado:** `ExplosiveDef.tripwire` (`length`, `angleDeg`, `height`); padrão em `rules.explosives.tripwire`: 10 m na direção do cone, a 0,15 m do chão. **Derivado:** buscas e o FM 23-23 (acesso negado no globalsecurity.org na verificação) não trouxeram comprimento conferível para o kit do M18A1; 10 m fica dentro do raio letal de 15 m do cone. É configurável por explosivo (`patch.explosives.claymore.tripwire`) e pelas regras.
- **Regra:** o `Use` `place` traz `tripwire`; `tripwireSegment(use)` dá o segmento (ângulo anti-horário visto de cima, fio sempre horizontal).
- **Sala:** ao pôr a carga ela põe um marcador (`charge_marker`, estaca com bandeira) e, havendo fio, desenha `charge_wire`; todo quadro testa a caixa de cada corpo (`bodies` do contexto: jogador como coluna do chão aos olhos e cada objeto da sala; futuros personagens entram por aí) contra o segmento e, ao cruzar, detona (`cause: 'wire'`, ação `tripwire` no log). Quem já estava sobre o fio ao pôr é deixado passar até sair. Y só dispara o `remote` (C4); a Claymore deixou de responder a Y.
- **Limites:** o teste é de sobreposição por quadro (sem varredura): corpo mais rápido que a espessura da caixa por quadro pode atravessar. A verificação genérica mora na sala (`segment-box.ts`), não no mundo da destruição.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 |
| `game-weapons` / `game-weapons-three` / `game-test-room` / `game-contracts` | 277 / 94 / 118 / 27 passaram |
| `game-destruction` / `-three` | 97 / 47 passaram |
| `tools/weapons-catalog` | 17 passaram |
| `node examples/weapons-test-area/build.mjs && node test.mjs` | `ok: bundle and room page` |
| `pnpm --filter @adatechnology/weapons-catalog-tool catalog:check` | up to date |

Commits (todos terminam com o `Co-Authored-By` de Opus 5.5): `feat(weapons-three,weapons-catalog)` câmaras, Taurus e destravar; `feat(weapons,weapons-three,test-room)` espoletas; `feat(weapons,contracts,test-room)` cozinhar a granada; `feat(weapons,contracts,test-room)` fio de tropeço e marcador; e o de documentação (README, skills, changesets, evidência).

Modelo da execução: `sonnet`.

## T1.7 (1–4)

Modelo: `sonnet` (o desenho 🧠 da T1.7 já decidiu a estrutura; aqui só execução e escolhas locais). Branch `feat/spec-001-t1-7`, 4 commits sobre a Fase 1. Ficam para o passo seguinte: T1.7.5 (armas novas, calibres `4_6x30` e `32acp`, M134), T1.7.6 e T1.7.7 (three.js e bancada).

### O que foi feito

| Task | Commit | Conteúdo |
|---|---|---|
| T1.7.1 | `feat(weapons,contracts,test-room): tipos aditivos…` | `attachment-types.ts`; `WeaponDef.mounts/fitted/stock`; fases `fit`/`stock`/`switch`; eventos `attachment`, `toggle`, `stock`, `underbarrel`; `TriggerResult.suppressed` (e no evento `shot`); `HostEvent` e `TOOL_CLIP.STOCK`/`TOGGLE` (`toolAnimationStep` mapeia `stock` e `toggle`); `toHostEvent` da sala repassa os quatro. Testes e goldens existentes intactos. |
| T1.7.2 | `feat(weapons-catalog): acessórios do §11…` | Parser do §11 (18 linhas dos 6 cartões); `build-attachments.ts` → `attachments.json` (30 acessórios); `build-mounts.ts` → `mounts`/`fitted`/`stock` em `firearms.json` das opções do `models.json` e das chaves novas do `decisions.json` (`threads`, `mountNotes`, `stocks`, `attachments`, `integral`, `arsenalFeatures`); REF do comprimento recolhido das 7 armas sem ficha. Cada número do §11 citado em `decisions.attachments` leva `from` (trecho do texto) e a geração falha se o trecho não está na linha; toda linha do §11 tem de ser acessório ou feature listada; todo acessório tem fontes e razão, e `reference` exige URL. `tests/accessories.test.ts` (11 testes). |
| T1.7.3 | `feat(weapons): regra de acessórios…` | `attachment-effects.ts` (`resolveLoadout`), `attachments.ts` (`canFit`, plugin `isCompatible`), `weapon-attachments.ts` (camada da cadeia: `fit`/`remove`/`toggle`/`setStock`/`setStance`/`aimSeconds`/`snapshot`; `arsenal.restore`), `rules.attachments`/`aim`/`stock`, `ArsenalOptions.attachments`/`patch`/`remove`/`isCompatible`, supressor improvisado (fluxo `seed ^ 0x3c6ef372`), mochila de munição (capacidade 500), tripé (apoio), ruído suprimido. `tests/attachments.test.ts` (23). |
| T1.7.4 | `feat(weapons,weapons-catalog): lança-granada sob o cano…` | `m203`, `gp_25`, `ag36` em `launchers.json` (decisões `underbarrelLaunchers`, gerados), explosivo `vog_25` (cópia da `m79_40mm`), segundo `WeaponState` (`underbarrel`, `useUnderbarrel`) que reusa a regra do lançador da T1.5. `tests/underbarrel.test.ts` (13) e 1 em `accessories.test.ts`. |

### Goldens de regra do desenho (§3 "Testes")

| Golden | Onde | Resultado |
|---|---|---|
| Toda arma sem acessório inalterada | `weapon-goldens.test.ts` (128 cenários) e `attachments.test.ts` ("weapons as they ship") | Nenhuma linha existente do fixture mudou; o fixture ganhou 33 linhas, as 3 armas novas (`m203`, `gp_25`, `ag36`). |
| UMP-45 + supressor subsônico ×0,25 | `attachments.test.ts` | ruído = base × 0,25 |
| M4 + supressor ×0,4 e dano −5% | idem | ruído × 0,4; energia × 0,95; `suppressed` no resultado e no evento |
| AK-47 + estendido: 45 cartuchos, recarga ×1,15 | idem | cápsula 45, fase de recarga = base × 1,15, sobra volta à reserva ao tirar |
| M4 + M203 atirar / trocar / recarregar | `underbarrel.test.ts` | troca 0,8 s com fase e evento; gatilho vira `throw` de `m79_40mm`; recarga pelas etapas `breech_open`/`round_in`/`breech_close`; munição própria |
| MP5A3 coronha recolhida | `attachments.test.ts` | saque ×0,8, mira ×0,85, coice vertical ×1,3, dispersão ×1,15, depois da fase |
| Supressor improvisado quebra no tiro sorteado | idem | quebra entre o 30º e o 60º, mesma semente = mesmo tiro, direções idênticas às da arma sem o supressor |
| Ida e volta fit/remove | idem (toda peça de fábrica de toda arma) | números do def exatos |
| Matriz de compatibilidade | `attachments.test.ts`, `underbarrel.test.ts` | M203 só em `colt_m16a2` e `colt_m4a1`; GP-25 em `ak_12`, `ak_47`, `ak_74`, `akm`, `sks`; AG36 só no `hk416` |
| Catálogo: acessório com fonte, criação com razão | `tools/weapons-catalog/tests/accessories.test.ts` | verde |
| M134 nos três modos | — | **T1.7.5** (a arma ainda não existe) |

### Desvios do desenho (e por quê)

1. **Campos a mais nos tipos**: `AttachmentDef.secondReload` (acoplador: o desenho não tem como dizer "segunda recarga"; o efeito de recarga ×0,5 vale a cada segunda troca), `AttachmentDef.stowable` (a marca da bandoleira para o `game-items`), `FittedAttachment.shotsLeft` (sobra de tiros do supressor caseiro, para o snapshot refazer o mesmo), `WeaponEvent` `stock` ganha `kind` (a sala escolhe `fold`/`collapse` pelo tipo).
2. **Recusa `rejected`** (plugin `isCompatible`) e status de gatilho **`busy`** (acessório, coronha ou troca em andamento); o desenho tinha seis recusas e nenhum status para o trabalho em curso.
3. **O encaixe vale no fim da fase**: `fit`/`remove`/`setStock`/`useUnderbarrel` emitem o evento e abrem a fase na hora (a sala lê a duração dela) e a mudança entra quando a fase acaba. Tempo 0 aplica na hora.
4. **Família de recarga nova `underbarrel`** (etapas `breech_open`, `round_in`, `breech_close`, as do desenho): reusar `break` mudaria os eventos do M79 e quebraria o golden. A variante de clipe `ugl` fica para a T1.7.6.
5. **Luz e laser só valem ligados** (`on: true`); de fábrica, desligados.
6. **O lançador some do arsenal** quando a arma-lançador sai (`remove.weapons`/`include`); sem isso `include` quebraria o arsenal inteiro. Acessório do jogo apontando para lançador inexistente continua erro do `checkArsenal`.
7. **`rail_adapter` não virou acessório**: é só a geometria `rail()` da Galeria (T1.7.6).
8. **Encaixe `stock` (buffer_tube) não foi criado**: não há acessório de coronha; a coronha é regra da arma.
9. **Só armas com rosca levantada têm encaixe de boca** (`decisions.threads`); as com freio de fábrica e sem rosca têm `fixed_muzzle_device` (o freio sai e volta, o supressor não entra). Pistolas não têm encaixe de boca: nenhuma fonte dá cano roscado.
10. O fixture de goldens ganhou as 3 armas novas e `catalog.test.ts` os novos totais (18 explosivos); nada existente mudou.

### Escolhas que não vinham das fontes (REF/derivadas), para o dono confirmar

1. **Rosca**: UMP-45 (`5/8×24`), Taurus T4 e IMBEL IA2 (`1/2×28`, padrão AR) são `derived`, sem página conferida.
2. **Comprimento recolhido do M14 EBR** (0,81 m): derivado (889 mm do Mk 14 menos 79 mm de curso do adaptador VLTOR). As outras seis são REF com URL: IA2 0,60, T4 0,767, M4 Benelli 0,889, SPAS-12 0,82, MRAD 1,055, M200 1,187.
3. **Tipos de coronha**: UMP-45 passa a `fold` (direita), MAC-10 a `retract` e Kriss Vector a `fold_retract` (direita), contra o que a Galeria desenha.
4. **GP-25 também no SKS**, porque a regra do desenho é "`bayo` → `gp25`" e a Galeria dá `bayo:1` ao SKS; o GP-25 real é de AK. Quer tirar o SKS?
5. **Tempo da troca para o lançador**: 0,8 s (`rules.attachments.switchSeconds`), sem fonte; a lista aprovada não tem esse número.
6. **Números derivados que o desenho não aprovou**: limites do supressor (12,7 mm e 6500 J; filtro de óleo 9 mm e 2500 J), mira ×1,1 (ACOG), ×1,15 (3–9×), ×1,25 (6–24×), ×1,2 (noturna e térmica), bateria 40 h e 8 h, tambor de 75 cartuchos com recarga ×1,3, cano serrado (dispersão ×1,6, alcance ×0,6, saque ×0,8), cano longo (velocidade ×1,03), bandoleira (saque ×0,85), tripé (coice ×0,4, dispersão ×0,7), massas de todos os acessórios, cone/`visibleFrom` do laser (120 m, 30 m).
7. **GP-25**: cano de 260 mm derivado; recarga e coice dos três lançadores sob o cano herdados do M79; AG36 a 76 m/s.
8. **Browning M2 com tripé integral**: o apoio já está nos números da arma (a M2 é sempre montada).
9. **Velocidade do som** 343 m/s (constante física, em `rules.attachments.speedOfSound`).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 (nenhum erro) |
| `pnpm -r typecheck` | exit 0 (nenhum erro) |
| `pnpm lint` | `ESLint: No issues found` |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0; nenhum arquivo falhou |
| `game-weapons` / `game-contracts` / `game-test-room` / `game-weapons-three` | 316 / 29 / 118 / 94 passaram (eram 277 / 27 / 118 / 94: +39 de regra, +2 de contratos) |
| `tools/weapons-catalog` | 29 passaram (eram 17: +12 de `accessories.test.ts`); `catalog:check` atualizado |
| `game-destruction` / `-three` | 97 / 47 passaram |

Commits (todos terminam com o `Co-Authored-By` de Opus 5.5): `feat(weapons,contracts,test-room)` tipos; `feat(weapons-catalog)` dados; `feat(weapons)` regra; `feat(weapons,weapons-catalog)` lançador sob o cano; e o de documentação (README, skill, changeset, evidência).

Modelo da execução: `sonnet`.

## T1.7.5

Modelo: `sonnet`. Branch `feat/spec-001-t1-7`. Armas novas, calibres `4_6x30` e `32acp` e M134 em três modos. A lista completa, com a origem de cada número, está em `inventario/armas-itens.md` §3.5.

### O que entrou

- **5 portadas por citação**: `hk_mp5sd3`, `fn_parafal`, `taurus_t4_civil`, `taurus_th380`, `mossberg_500_cruiser`. **16 criações**: `hk_mp5k`, `hk_ump9`, `mini_uzi`, `hk_mp7a1`, `hk_g36`, `hk_g36k`, `hk_g36c`, `fn_m249`, `fn_minimi_para`, `fn_mag`, `rpk`, `sig_mpx`, `mg3`, `pp19_bizon`, `vz61`, `m134`. Tudo de `decisions.creations` (cada número com `source` e `reason`; REF com URL, conferido por `tests/creations.test.ts`); os JSON gerados não foram editados à mão. Fontes consultadas: páginas da Wikipedia (infobox) de cada arma; a página do fabricante não foi reconferida (nota em cada número).
- **M134**: na mão com caixa de 200 (padrão), com `ammo_backpack` (500) e no tripé (`tripod`, apoio). Dados reais: 7,62×51, 801 mm, cano 559, 39 kg, 3000 rpm (`rpmRange` 2000 a 6000). Atraso de aceleração dos canos (`spin`: 0,5 s e 1,0 s de manutenção) derivado e configurável.
- **Modelos**: 21 entradas em `models.json`; construtores novos `m134` (seis canos num pivô `barrels`, que gira um sexto de volta por tiro) e carregador helicoidal do Bizon, com golden próprio (`new-weapon-models`). Os 77 hashes da Galeria não mudaram.
- **GP-25** só em arma com a opção `ak` (`decisions.gp25Mount`): o SKS saiu (resposta à dúvida 4 da T1.7 1–4).
- **Área de armas**: 4 colunas de balcão; o M134 no tripé é o item `m134_tripod`, parado, longe dos balcões. Goldens de regra: o fixture só ganhou 244 linhas (nenhuma existente mudou).

### Números derivados para o dono confirmar

1. `taurus_th380`: **nenhum** número tem fonte (a página do fabricante não existiu): 165/90 mm, 0,55 kg, 12+1 são derivados da G2C. A marca é decisão do dono.
2. `m134`: caixa de 200 cartuchos, `spin` 0,5 s / 1,0 s.
3. `fn_parafal`: massa 4,0 kg (meio da faixa do desenho), lado da dobra da coronha (direita); `hk_g36*`: lado da dobra (esquerda); G36K/G36C e MP5SD3 (805/610), Minimi Para (893/766) e MP5K (2,0 kg) são valores do desenho T1.7, não reconferidos.
4. `hk_ump9` fica com 2,3 kg (Wikipedia) em vez dos 2,1 do desenho; `sig_mpx` usa cano de 203 mm (a página não casa cano e comprimento).
5. `taurus_t4_civil` (878 mm, 805 recolhida), `mossberg_500_cruiser` (720 mm, 2,7 kg), cadência semi de 120.
6. Velocidade herdada da arma-base do Arsenal §07 quando o calibre é o mesmo (MP5K, Mini Uzi, FN M249, Minimi Para, ParaFAL, T4 civil, Cruiser): o cano mais curto não foi descontado.
7. Tempos de recarga: todos derivados (arma irmã, Q5); `rpk` herda `rel` 0,4 do AK-47; `fn_mag` 750 rpm e fita de 100.
8. Calibres: ruído 150 m (classe "médio") e arrasto derivados; `.32 ACP` a 276 m/s; massas dos dois acessórios integrados (`integral_suppressor` 0,45 kg, `integral_optic_3x` 0,3 kg).
9. Regra: o fator subsônico entra nos números base de peça de fábrica subsônica; o calor ×1,5 do supressor integral não é aplicado (calor sai do calibre).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 (sem achados) |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 |
| `game-weapons` / `game-weapons-three` / `game-test-room` | 351 / 123 / 118 passaram (eram 337 / 94 antes dos novos testes) |
| `tools/weapons-catalog` | 35 passaram (eram 29: +6 de `creations.test.ts`); `catalog:check` atualizado |
| `examples/weapons-test-area` | build e `test.mjs` ok (com a página `sala-armas.html`) |

Modelo da execução: `sonnet`.

## T1.7.6–7

Modelo: `sonnet`. Branch `feat/spec-001-t1-7`. Os modelos dos acessórios, a coronha com pivô, os clipes e sons novos (T1.7.6) e a bancada de acessórios na área de armas, mais o módulo de armas na página de móveis (T1.7.7). Contrato: `design/T1.7-armas-e-acessorios.md` §2, §3 "Renderizador" e §4.

### O que foi feito

| Task | Commit | Conteúdo |
|---|---|---|
| (base) | `feat(contracts,test-room): comando do módulo à ferramenta…` | A sala não tinha caminho para acessório: `ModuleHost.command(ToolCommand)` (`fit`, `remove`, `toggle`, `stock`, `underbarrel`, `stance`), `HostTool` com `attachments`, `stock`, `suppressed`, `underbarrelActive`, `mass`, `aimSeconds`, e `suppressed` no evento `shot`. A sala executa pela regra na bancada. Tudo aditivo. |
| T1.7.6 | `feat(weapons-three): acessórios no modelo da arma…` | `parts.frames`, `parts.fittings`, `parts.stockMeshes` (só registram; a cena padrão é a mesma); `rigStock` e `rigUnderbarrel` depois da construção; `fitAttachmentModels` com registro `ATTACHMENT_MODELS` substituível por `attachmentModels`; um construtor para cada um dos 28 acessórios com modelo (portes e criações, lista em `inventario/armas-itens.md` §3.6); clipes `stock_*`, `toggle`, `reload_ugl`, `shot_ugl`; sons `stock_fold`, `light_click`, `attach`; o viewmodel segue `tool().attachments`, atira o lançador e usa o som silenciado. |
| T1.7.7 | `feat(weapons-three,examples): bancada de acessórios…` | `accessory-bench.ts`: um campo por encaixe (só o compatível), botões, teclas L, K, V e U, botão direito mira com zoom pela óptica; camadas `attachments` e `beams`; métricas de massa, mira, acessórios e silenciada; pt-BR e en. `interactables-test-area` carrega o módulo de armas. |
| site | `feat(site): …` | `catalog.mjs` (resumo e controles das duas áreas) e a miniatura da área de armas (M4 com supressor, lanterna e laser ligados). |
| docs | `docs(spec-001): T1.7.6–7 …` | skills `game-weapons-three`, `game-contracts` e `game-test-room`, changeset, inventário §3.6 e esta seção. |

### Teclas e mouse da área de armas (conferido nos bindings reais da sala antes de escolher)

| Entrada | Já era | Agora |
|---|---|---|
| L, K, U | livres | luz, laser, troca para o lançador sob o cano (U de "under") |
| V | chute (`kick`) quando não se segura item com uso | dobra ou abre a coronha **onde a arma tem coronha que mexe**; nas outras o evento passa e V segue sendo o chute |
| botão direito | agarra ou arremessa (`secondary`) | mira **onde a arma atira**; em mão vazia, ferramenta ou arma que não atira, segue agarrando |
| X | destrava a pane | igual (outra frente de trabalho vai torná-lo sensível ao contexto com o sentar; aqui fica como está) |

Os ouvintes entram na fase de captura da `window` e só consomem o evento quando a arma na mão tem o que fazer com ele.

### Desvios do desenho (e por quê)

1. **Contrato novo na sala** (`command`, campos de `HostTool`): o desenho não dizia como o módulo manda a arma encaixar algo, e a sala é dona do estado. Genérico (nada de arma no nome do tipo além de "ferramenta").
2. **V e botão direito** têm dono na sala (chute e agarrar); a regra acima os divide pela arma na mão em vez de tirar o que existia.
3. **`rigStock` e `rigUnderbarrel`** são dois passos pós-construção (o desenho só falava de `rigStock`): o pivô `ugl` precisa existir antes do `createModelRig` para o clipe de recarga do lançador alcançá-lo.
4. **Sem modelo**: `sawn_off_barrel` e `long_barrel` (o cano é uma peça só nos construtores) e as miras integradas que a arma já desenha (`integral_optic_*`). A regra funciona; só não há o que desenhar.
5. **Quadros** (`parts.frames`): o `rifle` e o `m134` gravam os números; pistolas, revólveres, bullpup, P90, basculante, M2 e lançadores têm os quadros **medidos do modelo** (`deriveFrames`), então a posição do acessório nesses é aproximada.
6. **Tempo de encaixe é o da regra** (2, 15 ou 30 s por instalação do acessório); a bancada passa `install: 'bench'` e registra no log "Encaixando X (N s)". Não há animação de encaixe (o contrato não pede): só o som `attach` e o modelo aparecendo no fim da fase.
7. **Óptica variável** (3–9×, 6–24×, noturna, térmica) dá zoom pelo primeiro número (`zoom[0]`); sem roda do mouse para variar (a roda troca de ferramenta na sala).
8. **Números derivados**: luz de 150 cd, tempo do clipe da coronha de 0,6 s quando a regra não dá duração, deslize de 5 cm do tubo do lançador, abertura do feixe do laser de 2,5 mm, posição da mochila (55 cm atrás da coronha), extensão do carregador de 50% do comprimento. Nenhum vem de fonte; todos cosméticos.
9. **Página de móveis**: o módulo de armas carrega **antes** do de móveis para o painel seguir mostrando a bancada de móveis (a sala usa o último módulo com bancada). Lá o botão direito também mira com arma de fogo na mão; E e G seguem agarrando.
10. Dependência nova em `game-weapons-three`: `game-interactables-three` (o cordão da bandoleira e da correia); entra no IIFE do pacote, que passou a 539 KB.
11. O teste de integração da bancada (`integration.test.ts`) mudou só nas listas de controles, camadas e métricas, que cresceram.

### Verificação em Chrome de verdade (headless, SwiftShader, página sem rede)

Script em `scratchpad/check/browser-check.mjs` (fora do repositório), sobre a sala com o módulo criado à mão para espiar o áudio. Erros de console: **nenhum**.

| Pedido | Resultado |
|---|---|
| Área carrega sem erro, relatório do contrato | `ok: true`, 153 itens, nenhum problema |
| Supressor no M4 e tiro | encaixou (`suppressed: true`); o tiro chamou `audio.shot` com `{ caliber: '5_56x45', suppressed: true }`; ganho do tiro do calibre 1,078 sem e 0,323 com o supressor |
| M203 e granada | encaixou, `U` trocou (`underbarrelActive: true`), o tiro gastou a granada (1 para 0) e 5 entradas `explode` no log da sala |
| Coronha | MP5A3 recolhida (`stock: 'collapsed'`, pivô 0,151 m, os 0,15 m dos dados); G36 dobrada meio giro (3,142 rad) |
| Luz e laser | ligados por L e K; `SpotLight` visível com ângulo 0,2618 rad (30° de cone); o ponto do laser desenhado na parede |
| Mira | campo de visão de 72° para 20,59° com o ACOG (4×: 20,6° pela conta) e de volta a 72° ao soltar |
| Bug achado só no navegador | o raio do laser quebrava com os sprites da fumaça (`raycaster.camera` nulo); corrigido dando a câmera ao `Raycaster`. Sem teste próprio: a cena do happy-dom não tem sprites; o script do navegador é o que cobre |

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 (sem achados) |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 |
| `game-weapons-three` | 157 passaram (eram 123: +23 de `attachment-models.test.ts`, +11 de `accessory-bench.test.ts`) |
| `game-test-room` | 121 (eram 118: +3: `command`, campos do `HostTool` e `suppressed`) |
| `game-contracts` / `game-weapons` / `tools/weapons-catalog` | 29 / 351 / 35, sem mudança |
| Hashes | os 77 da Galeria e os 21 do golden próprio, iguais (`gallery-models.test.ts`, `new-weapon-models.test.ts`) |
| `examples/weapons-test-area` | build e `test.mjs` ok (confere os controles da bancada no pacote) |
| `examples/interactables-test-area` | build ok; `test.mjs` 10/12: o módulo de armas carrega e o supressor encaixa nas duas línguas; **as 2 falhas são anteriores** (`furniture_trash_bin_crushed`, marreta na lixeira, nas duas línguas), iguais no commit-base `f11bbae` |
| `examples/test-room` | `test.mjs` com 1 falha (`load_rental_car_module`, 9 mm no para-brisa), **igual no commit-base** |
| `docker build -f site/Dockerfile .` | exit 0 |

Modelo da execução: `sonnet`.

## Regressões dos exemplos

Duas verificações dos exemplos de navegador falhavam desde a Fase 1 e o CI não as rodava. Reproduzidas com Chrome headless (Playwright 1.64, `NODE_PATH` apontando para ele), `node examples/<x>/build.mjs && node examples/<x>/test.mjs`.

| Verificação | Causa raiz | Evidência | Correção |
|---|---|---|---|
| `test-room` · `load_rental_car_module` (9 mm no para-brisa) | O commit `95a9b9b` (arma na mão com os clipes do contrato) faz `setTool` chamar `tool.draw()`: a ferramenta passa a ter fase de saque e o gatilho responde `drawing` até ela acabar. O cenário do módulo de demonstração disparava logo após `setTool('pistol_9mm')`. O mesmo commit já corrigira os `test.mjs` (`room.update(0.4)`) e os cenários da sala (`waitUntilReady`), mas não esse. | Com `room.waitUntilReady()` depois do `setTool`: 23/23 cenários. | `examples/test-room/src/demo-module.js`: `room.waitUntilReady()` após o `setTool`. |
| `interactables-test-area` · `furniture_trash_bin_crushed` (pt-BR e en) | Duas causas. (1) Mesma fase de saque: o primeiro golpe da marreta era perdido (a verificação acusava 2 golpes onde 1 basta). (2) A verificação lia o amassado da peça `plastic` (a maior pela ordenação), mas a lixeira é um anel de 16 cunhas e o golpe de frente acerta `plastic_2`; o golpe de 300 J lança a lixeira de 3 kg (31 m/s) contra a parede e os golpes seguintes pegam no ar. O teste só passava no commit-base porque a queda amassava 2 mm justo a cunha `plastic` (acaso da física); a partir de `95a9b9b` a queda amassa `plastic_5` e `plastic` fica intacta. A física do golpe é a mesma antes e depois (acerto em `plastic_2`, 30 mm, hp 16/22). | Bisect (worktree destacado, removido): `8918ed4` e `76ae86f` passam; `95a9b9b` falha; o log mostra `dent plastic_2 30 mm` nos dois lados e a diferença só na cunha amassada pela queda. | `examples/interactables-test-area/src/scenarios.js`: `waitUntilReady` após o `setTool`, e a verificação passa a olhar qualquer peça quebrada ou amassada (a marreta amassa o plástico que acerta, não uma cunha específica); o laço para no primeiro golpe que causa dano. Resultado: 1 golpe, 1 amassado. |

Nenhuma regra de jogo mudou de propósito: o comportamento intencional da Fase 1 (saque antes do primeiro disparo) é o que o teste não acompanhava.

### Portões

| Portão | Resultado |
|---|---|
| `pnpm build`, `pnpm -r typecheck`, `pnpm lint` | exit 0 |
| `examples/test-room` `test.mjs` | 23 passam, 0 falham |
| `examples/interactables-test-area` `test.mjs` | 12/12 (pt-BR e en) |
| `examples/weapons-test-area` `test.mjs` | ok |

### CI

Novo job `examples` em `.github/workflows/ci.yml`, incluído no `ci-ok`: `pnpm build`, Playwright 1.58.2 e Chromium instalados fora do workspace (`NODE_PATH`), build e verificação dos três exemplos. Medido localmente: build do monorepo 18 s, três verificações 31 s; com `pnpm install` e o download do Chromium estima-se de 3 a 4 min no runner (limite do job: 10 min). Não vale separar em matriz: o custo é dominado pela instalação.

## Revisão da T1.7

Modelo: `sonnet`. Branch `feat/spec-001-t1-7`. Achados da revisão de código das T1.7.6–7 e da regra de acessórios.

### O que foi feito

| # | Achado | Correção | Teste |
|---|---|---|---|
| 1 | O raio do laser aceitava malha com ancestral oculto, media a cada quadro e repetia os nomes dos nós como literais | `laser-raycast.ts`: `isVisibleInScene` olha a cadeia de ancestrais, o raio é medido no máximo 30 vezes por segundo (a última distância vale entre as medições), e `VIEWMODEL_NODE_NAME` e `IN_HAND_NODE_NAME` são usados pelo viewmodel e pelo `box-fx` | `laser-raycast.test.ts`: ancestral oculto, os dois nomes de nó, a taxa de 30 Hz |
| 2 | O botão direito engolia cliques de painéis, campos e sobreposições | Só mira quando o alvo é o canvas da sala ou o ponteiro está travado (`pointerLockElement`). O README de `interactables-test-area` não existe: a documentação foi para o README do `game-weapons` (seção de acessórios), que cobre a área de armas que a página de móveis também carrega | `accessory-bench.test.ts`: clique em botão fora da sala não é consumido, ponteiro travado mira |
| 3 | `syncUnderbarrel` dava lançador novo a cada re-encaixe (granadas infinitas) | O estado do lançador fica guardado por id do acessório ao sair (com o relógio) e volta ao re-encaixar, posto em dia pelo tempo que ficou fora | `underbarrel.test.ts`: dispara, tira, recoloca, munição 0 e reserva 3 |
| 4 | O inverso das peças de fábrica dependia da ordem | `cancelShipped` tira dos dois lados os mesmos objetos de modificador (um a um) antes da soma e do produto | `attachments.test.ts`: a ida e volta confere todos os campos do `Loadout` e `action` por `toBe(def.action)` em toda peça de fábrica; novo teste do barrett_mrad com três peças reencaixadas em ordem inversa. O código antigo também passava (a diferença seria só de ponto flutuante), então o teste trava a exatidão sem provar a falha antiga |
| 5 | Ligar e desligar a lanterna recompilava shaders (muda o número de luzes) | **Escolha:** o `SpotLight` fica `visible` com intensidade 0 enquanto a lanterna está encaixada; `setOn` só muda a intensidade. Uma recompilação por encaixe ou remoção, que já leva segundos de trabalho. Pré-compilar exigiria o renderer, que o módulo não tem | `attachment-models.test.ts` e `accessory-bench.test.ts`: `visible` segue verdadeiro, intensidade 0 e maior que 0 |
| 6 | Desenho da área de armas | Medido abaixo | — |
| 7 | `supported` do bipé sem como exercitar | Controle booleano `supported_stance` na bancada, manda `stance { supported }`; volta a falso quando a ferramenta muda | `accessory-bench.test.ts` (controle e comando) |

Nits: `suppressed` do resultado só é verdadeiro se todas as balas foram silenciadas (o supressor caseiro pode quebrar na rajada); `setStance` sai cedo se nada mudou; `wearAttachments` sai cedo sem peça com tiros contados; a lista de acessórios é comparada por quadro com `attachmentsKey` (quantidade, id, encaixe e ligado) em vez de `JSON.stringify`; material da lente da mira e geometrias das argolas da bandoleira são descartados ao tirar; fonte da massa vazia do M134 em `decisions.json` passou a `owner`; o changeset cita os membros novos obrigatórios de `WeaponState` e `Arsenal`.

### Chamadas de desenho e triângulos da área de armas (revisão)

Mesmo método da S1: Chrome real (`google-chrome-stable --headless=new`, SwiftShader), `dist/sala-armas.html` aberto pelo CDP, contagem das chamadas `drawElements`/`drawArrays` (e as instanciadas) do WebGL, que inclui a passada do mapa de sombra, em três janelas de 6 s com o mesmo valor.

| | Chamadas por quadro | Triângulos por quadro | Meshes visíveis | Com sombra |
|---|---|---|---|---|
| S1 (Fase 1) | 902 | 1,70 M | — | — |
| Antes das correções (`0b79a43`) | 1.099 | 1,65 M | 965 | 140 |
| Depois das correções | 1.099 | 1,65 M | 965 | 140 |

As correções não mexem no caminho de desenho (o valor é o mesmo). O aumento sobre a S1 (+22% nas chamadas, triângulos 3% abaixo) acompanha o conteúdo que a T1.7.5 trouxe (21 armas novas e o M134 no tripé, um mesh por material cada): 965 meshes na passada principal mais 140 com sombra dão as 1.099 chamadas. Não é "muito acima" da S1, então **não foi adicionado** o esconder por distância. Segue o seguimento já registrado (instanciar por modelo ou carregar só a arma mirada) se uma máquina fraca precisar.

### Portões da revisão

## Miniaturas das armas

Pedido do dono: miniaturas realistas de perfil nos menus de item, em vez de só o nome. Desenho livre do Wikimedia Commons onde existir; senão, o perfil lateral do nosso modelo 3D.

### Passo 1: perfil gerado do modelo (`tools/weapon-thumbnails`)

| Item | Resultado |
|---|---|
| Ferramenta | monta o modelo (galeria, arquétipo emprestado, ou o prop de caixas dos balcões, visto de cima por estar deitado), projeta ortogonalmente com z-buffer por software, traça o contorno (arestas de célula, giro à direita nos cantos) e simplifica (Douglas-Peucker). Sem dependência de geometria: o traçador tem 60 linhas e o resultado é o mesmo a cada execução |
| Saída | 148 SVG em `packages/game-weapons-three/assets/weapon-svg/generated/`: 145 armas (todas menos `hand`, `kick`, `shove`, `fists`) e os 3 explosivos de mundo (`fuel_barrel`, `propane_p13`, `car_fuel_tank`) |
| Forma | viewBox 800x200 (4:1), margem de 12, `currentColor`, aço mais claro (`fill-opacity=".6"`) sob polímero e madeira |
| Tamanho | 320 KB no total, média de 2 KB, maior 6,6 KB (limite de 12 KB, imposto na geração e no teste) |
| Determinismo | `generate` duas vezes: mesmo hash do diretório (`md5sum` de todos os arquivos); o teste compara cada arquivo com o que a ferramenta escreve hoje |
| Limite conhecido | as 31 armas sem modelo da galeria saem do prop de caixas (silhueta retangular de uma peça); só o modelo 3D real ganha perfil detalhado |

### Campo `thumbnail` e menu

- `TestableItem.thumbnail?` (contrato) e `TestRoomItem.thumbnail` / `InspectInfo.thumbnail` (sala): URL de imagem ou `<svg…>` em linha.
- A sala desenha a miniatura como `mask` CSS sobre a cor do texto: SVG de uma cor segue o tema e os tons vão em `fill-opacity`. Aparece no catálogo, nos resultados da busca e no inspetor do item mirado. Aspas na fonte não saem do `url()` (teste).
- `createWeaponsTestModule({ thumbnailBase })` (padrão `weapon-svg/`) preenche o campo de toda arma, dos explosivos de mundo e da M134 no tripé. `build-site.mjs` copia `assets/weapon-svg` para `site/dist/weapon-svg` e as páginas das áreas apontam para `../weapon-svg/`.
- Limite: a máscara por URL exige mesma origem (ou CORS); numa página `file://` (a `sala-armas.html` solta) a miniatura por URL não carrega e o item segue só com o nome. Quem precisar passa o SVG em linha.

### Passo 2: Wikimedia Commons

Busca pela API do MediaWiki com User-Agent descritivo (sem e-mail), 0,55 s entre pedidos, 3 buscas por arma (limite de 10), progresso gravado em disco a cada arma (`search/<id>.json`), 114 temas pesquisados e 73 com candidato licenciado. Depois, duas varreduras amplas (silhuetas de armas e `game-icons`) para achar séries que o filtro por título não pegava. Escolha a olho numa folha de contato (perfil lateral **daquele** modelo). Só `image/svg+xml` com Domínio público, CC0, CC BY ou CC BY-SA; autor, licença, página e arquivo original vêm do `extmetadata`.

Segurança do download: cada arquivo foi saneado (sem script, `on*`, `foreignObject`, `href` externo, DOCTYPE/entidade, instrução de folha de estilo), desenhado no Chromium como `<img>` com rede bloqueada e **reduzido a um contorno traçado** pelo mesmo traçador. O markup baixado nunca entra no repositório: cada arquivo de `commons/` é a raiz e um ou dois caminhos (teste confere o formato com uma expressão regular).

| Resultado | Quantidade |
|---|---|
| Miniaturas do Commons adotadas | **18** (AK-47, Barrett M82A1, Benelli M4, Beretta 92FS, M4A1, M16A2, M1911, Desert Eagle, Glock 19, MP5A3, MP5K, MAC-10, Sako TRG-42, Steyr AUG A1, SVD, Uzi, faca de estilete, Skorpion vz. 61) |
| Licenças | CC BY-SA 4.0: 9 · CC BY 3.0: 5 · CC0: 2 · CC BY-SA 3.0: 1 · Domínio público: 1 |
| Geradas (as outras) | 130 |
| Tamanho dos 18 | 81 KB, maior 9,6 KB |

Rejeitadas de propósito: sinalização, mapas, logotipos, diagramas e fotos que o filtro por título trouxe; desenhos diagonais de ícone (taco, martelo, FN FAL, Winchester, Thompson) que ficariam pequenos no 4:1; o MP7 (16 KB, limite de 12); e o Glock 17 (o único livre era o 19X, outro modelo). Os ícones `game-icons` (CC BY 3.0, Skoll) aceitos são os de perfil horizontal claro (M1911, Desert Eagle, MP5K, MAC-10, Skorpion).

`LICENSE-NOTE.md`: os arquivos de `commons/` mantêm a licença do original e são **obra derivada** (CC BY-SA continua CC BY-SA); `CREDITS.md` e `manifest.json` saem de `commons-sources.json`. O resolvedor prefere `commons/` e cai para `generated/`.

### Verificação no navegador

Chromium headless (Playwright, GL por software) contra `site/dist` servido por HTTP (`/weapons-test-area/?lang=en`): 149 botões do catálogo com miniatura (o resto são alvos e balcão), os 148 SVG responderam 200, **nenhum erro de console**, a busca por `ak-47` mostra o botão com `url("../weapon-svg/commons/ak_47.svg")`, e ao mirar no AK-47 o inspetor traz a miniatura (140x28) acima de `AK-47 › body`. Captura: `scratchpad/menu-final.png` (fora do repositório).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 (`No issues found`) |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 (a primeira rodada achou a lista de controles da bancada em `integration.test.ts` sem `supported_stance`; corrigido e rodado de novo) |
| `catalog:check` (`tools/weapons-catalog`) | `up to date` |
| `examples/weapons-test-area` `test.mjs` | `ok: bundle and room page` |
| `examples/interactables-test-area` `test.mjs` | 12/12 passam (en; pt-BR igual) |
| `examples/test-room` `test.mjs` | todos passam, `OK` (as capturas e o log gerados não foram commitados) |
| `docker build -f site/Dockerfile .` | exit 0 |

| `pnpm lint` | exit 0 (sem achados) |
| `pnpm -r test` (inteiro) | exit 0 |
| `game-test-room` | 128 (eram 121: +7 de `thumbnail.test.ts`) |
| `game-weapons-three` | 164 (eram 157: +7 de `thumbnails.test.ts`) |
| `tools/weapon-thumbnails` | 23 (novos: traçador, z-buffer, bitmap, determinismo, tamanho de todos os assuntos, manifesto, os arquivos do disco são os que a ferramenta escreve) |
| `game-contracts` / `game-weapons` / `tools/weapons-catalog` | 29 / 351 / 35, sem mudança |
| `examples/weapons-test-area` | build e `test.mjs` ok (confere `../weapon-svg/` no bundle) |
| `examples/interactables-test-area` | build ok; `test.mjs` 10/12: as 2 falhas (`furniture_trash_bin_crushed`, marreta na lixeira) são **anteriores**, iguais no commit-base (conferido com `git stash` e reconstrução) |
| `docker build -f site/Dockerfile .` | exit 0; a imagem serve `/srv/weapon-svg` com `generated/` (148), `commons/` (18), `manifest.json`, `CREDITS.md` e `LICENSE-NOTE.md` |

Modelo da execução: `sonnet`.

## T2.3a–b

Modelo: `sonnet`. Branch `work/spec001-t2-b` (sobre `feat/spec-001-fase-2`), grupo B da Fase 2: estrutura e destruição das paredes (centro da fase, desenho `design/T2.1-casas-estrutura-e-destruicao.md` §3, §4, §6).

### O que foi feito

| Commit | Conteúdo |
|---|---|
| `feat(contracts): camadas, armadura, peças, brecha…` (T2.3a) | `PartSpec.layers/reinforcement/units/breach` (`SurfaceLayer`, `Reinforcement`, `PartUnits`, `PartBreach`), `PartState.stage/stripped/opening`, `DamageStage`, `Fragment.marks` (`FragmentMark`), eventos `spall`, `stage`, `expose`; `checkSpec` valida os campos novos; rótulos `en`/`pt-BR` dos eventos. Tudo opcional: nenhum módulo existente mudou. |
| `feat(destruction): paredes em camadas…` (T2.3b) | `assemblies.ts` + `data/assemblies.json` (8 montagens), `layers.ts`, `breach.ts`, `rebar.ts`, estágios/brecha/gaiola em `world.ts`, `sizeStructure({ redundancyRoles, safetyByRole })`, `DestructionOptions.breach`, testes e 8 goldens próprios. |
| `feat(destruction-three): desenha spall, estágio 2…` | `spall` (remendo), `stage` 2 (fragmentos com os furos presos), `expose` (cilindros instanciados), `rebarCount()`. |
| docs (este) | README e skills, changesets, `inventario/casas-mapa.md` §1.4b, esta seção. |

### Comportamento medido (todos com semente, sem `Math.random`)

| Caso | Resultado |
|---|---|
| 9 mm (486 J) em tijolo rebocado, 60 tiros | lasca (`spall`) e fura (nenhum furo passante), no máximo estágio 1 |
| 7,62 (3300 J) em tijolo rebocado, 40 tiros | fura de lado a lado (lasca entrada e saída), no máximo estágio 1 |
| 7,62 em concreto armado, 80 tiros | só trinca, nenhum furo passante, eventos `stage` = `[1]`, a parede não abre |
| mesma carga de 1330 J no tijolo rebocado | para na camada (limiar 1380 J = 1260 do tijolo + 2 × 60 do reboco); depois que o reboco lasca no ponto, passa (1320 J) |
| marreta (128 J) em tijolo rebocado | estágio 1 no 1º golpe, estágio 2 no **47º** golpe: abertura de raio 0,284 m, fragmentos de no máximo 0,23×0,075 m, a peça fica |
| C4 (345,6 kJ) e RPG (200 kJ) em concreto armado | estágio 2 de uma vez, `expose` só dos vergalhões dentro da abertura, a parede fica |
| golpe que zera o hp do concreto armado | `fracture` em **20 painéis** de 0,6×0,42 m (grade 4×5 do ARS), `stage` 3, `expose` com 26 barras (14 + 12, a 0,18 m), a peça fica como gaiola (`stripped`) |
| RPG num pilar de pórtico (2 pilares, laje, telhado) | `expose` e estágio 3 do pilar em t=0; sobrecarga (tensão 3,5); gaiola cede em 1,7 s; o outro pilar (tensão 1,17) cai em 5,5 s; `collapse` de pilar, laje e telhado em **7,1 s**. Com `residualCapacity` 0,9 nada cai em 60 s |
| tiro na abertura e na gaiola | atravessa sem evento; raycast passa pela abertura |
| furos ficam nos pedaços | 12 furos de 9 mm antes da queda: 12 `marks`, todos dentro da caixa do fragmento (máximo 12 por fragmento); furo na região da brecha sai com o fragmento |
| gaiola sem carga | `workableJoints` lista a junta `rebar` para `cutting_torch` e `saw`; 20 s de maçarico abre (`detach` `by: 'tool'`) |
| 6 cenários do AC numa spec equivalente | pilar de canto: laje fica; dois pilares: laje e telhado caem (90 s); divisória cai sozinha; vidro fura no 1º tiro e quebra; caixa vaza; botijão explode e danifica a parede ao lado |
| `sizeStructure` com `redundancyRoles: ['column','wall']` | sem os papéis, perder uma parede portante passa de 1,06; com eles fica em 0,97 |

Goldens próprios (sequência de eventos) em `packages/game-destruction/tests/fixtures/wall-golden/*.json`, gravados no Node 24 e conferidos no Node 22 (`npx -y node@22 … vitest run`: 155 passam). `UPDATE_GOLDEN=1` regrava.

### Desvios do desenho

1. **`stage` leva `fragments`** (opcional, além de `opening`): o contrato dizia só a abertura, mas o evento `fracture` esconde a peça no renderizador, então os fragmentos da brecha precisam de outro canal.
2. **Brecha em área, sem tabela de pontos**: a área de um golpe é `dano / (hpPerKg × densidade) / espessura do núcleo`; o sopro multiplica por `breach.blastFactor` (padrão **6**, novo; sem isso 345,6 kJ de C4 dão 0,13 m² e nunca passam de 0,25). Abertura da largura da peça (pilar, verga estreita) **corta a peça** (fratura) em vez de abrir. Raio e fator são opções (`DestructionOptions.breach`), a área é por montagem.
3. **Tamanho da unidade**: `units.size[2]` (0,11 m do tijolo) não é usado; o fragmento leva a profundidade física inteira da parede (0,09 + 2 × 0,02), para não deixar buraco na malha. Argamassa dos tijolos: `plaster` e `concrete` (não existe material `mortar`).
4. **Juntas `rebar` de peça armada não desgastam** com golpe ou sopro (só maçarico, serra, ou a própria gaiola cedendo). Sem isso a explosão que expõe a gaiola já a soltaria da fundação (a junta tem 1500 de vida e o sopro dá 10 000).
5. **Gaiola**: `hp` = `maxHp` da peça (sobrecarga a gasta em 1,7 s a 7 s conforme a tensão), tiro atravessa, `expose` com `bars: []` diz que a gaiola acabou (sem campo novo).
6. **Furos nos fragmentos valem para qualquer peça**, não só as escalonadas: todo `fracture` de peça com furo agora traz `marks` (os testes existentes continuam verdes).
7. **Drywall e madeira simplificadas**: montante de aço e barrotes não são peças (entram em `buildWallSpecimen`, T2.2d); a massa por m² fica abaixo da real (madeira 18 kg/m²). `log_wall` usa `fill` 0,785 (tora redonda), `concrete_block_wall` 0,55 (bloco vazado).
8. **Renderizador**: o remendo da lasca usa o eixo fino da caixa do mundo como normal (certo para parede reta); `rebarCount()` é método à parte porque `stats()` é comparado por igualdade em teste. **Falta para a T2.4c**: abrir a abertura na malha da parede (colapsar a faixa de vértices), fiadas de tijolo instanciadas, normal exata do remendo.
9. **Vidro do AC** ("quebra depois de N tiros"): com a fragilidade do SDK (vidro de 6 mm) o 1º tiro fura **e** quebra; o teste mantém a asserção do AC (furou no 1º, quebrou em até 12).
10. `PartRuntime` ganhou `spalls`, `breach`, `removed` (opcionais); `serialize`/`load` agora clonam o runtime por peça (antes era cópia rasa).

### Escolhas de negócio (padrão reversível, para o PR)

- Raio de 0,55 m e área de 0,25 m² (do desenho); fator de sopro 6; capacidade residual 0,15 (do desenho); energias de teste: 9 mm 486 J, 7,62×51 3300 J, marreta 128 J (4 kg a 8 m/s), C4 e RPG do `explosives.json`.
- N da marreta (47 golpes) é consequência do modelo; o dono pode pedir outro valor mexendo no `breach.area` da montagem.
- `fill` e espessuras das 8 montagens são do desenho quando dadas; o resto (drywall 0,0125 + 0,0125, madeira 0,012 compensado, chapa 0,6 mm, tora 0,2 m, vidro 6 mm) é referência real, sem fonte do time.

## T2.2a–b — goldens das casas e regras do Visor de casas 3D no `game-floorplan`

### T2.2a (`tools/golden`)

- **Gravador:** flag `--expose a,b,c` (`bin/expose-in-page.mjs`, com teste): no fim do último IIFE inline da página publica `globalThis.GoldenExposed` com leitura e escrita de cada nome (dá para trocar um `let`, como o `R` da Galeria). Também: `GoldenTool.hashText` (FNV-1a) e correção de um atraso de 30 s por execução (um `Fetch.continueRequest` sem resposta segurava o processo e depois derrubava com rejeição não tratada).
- **Páginas:** as fontes do VC3, da Galeria e da área de casas não estavam em `artefatos/` (o VC3 só existia em `site/pages/` do repositório do time); copiadas para `artefatos/site__visor-casas-3d.html`, `site__galeria-vale-cinzento.html` e `site__area-casas.html` (mesma versão das fontes em `sources/`).
- **Capturas:** `floorplan-plans.js` (17 modelos x sementes 1–25 x 3 estados = 1275 plantas; um evento por planta com contagem e hash `fnv` de cada lista: cômodos, paredes, aberturas, móveis, itens de estado, lote), `floorplan-structure.js` (peças, apoios, `specDe` coarse e `vedacao`, partes e juntas, mais um hash por instalação), `house-area.js` (6 cenários da área de casas na própria sala da página, com todos os eventos do mundo: 2734 eventos, os 6 passam) e `gallery-silhouettes.js` (16 silhuetas, hash de cena). O gás (`botijao_gas`) e os caminhos da edícula ficam fora das listas de planta e entram no golden de estrutura (T2.2c/e).
- **Onde ficaram:** plantas em `packages/game-floorplan-post-apocalyptic/tests/fixtures/team-golden/vc3-plans(.-detail).json` (desvio do desenho: o pacote do motor não pode depender dos pacotes de conteúdo sem ciclo, e o teste precisa dos quatro); estrutura, área de casas e silhuetas em `specs/001-migracao-entregas-dos-times/goldens/` (README com o comando de cada um) até os pacotes consumidores existirem.
- **Repetição:** cada gravação rodou duas vezes e saiu idêntica byte a byte.

### T2.2b (motor e conteúdo)

Regras R do VC3 portadas: `playerRadius` 0,24 (grade de 10 cm que descarta células a menos do raio de uma parede, passada relaxada a 0,12), folga de porta e janela por modelo, janelas distribuídas no trecho de parede (R10) e janela obrigatória (R43), `blocksWindow` com `windowHeight`/`overhead` e `OVERHEAD_TOP` 2,15, vaga de carro (`parking.ts`), `partesUteis`, caminho de toda porta externa (`paths.ts`, R07), caixa de correio (R20), abajur (R64), `single_storey_a` R66, caixa d'água fora do quintal (R23), estados (janela tapada garantida, barricada cobre a zona da porta, colchão em casa apertada, roupas e manchas). Detalhes e tabela no `MIGRATION.md` do motor. Ganchos novos: `registerResultExtension` (`after`, `seedKey`; roda depois do estado e antes do relatório de zonas), stub `registerFindsProvider`/`findsFor`, `registerViewerLayer` (camada do visor 2D com caixa de seleção e legenda, para a estrutura da T2.2c) e ganchos genéricos para o pacote rural (`noWalls`, `cumulativeCeilings`, `reservations`, `paths`, `DoorDef.edge`, `LotConfig.extraZones`, `StyleDef.fenceHeight`, `floorFree`, `exactOnly`).

**Ajustes pedidos pelo coordenador:** o tipo de mobília do motor passou a `FurnitureDef` (antigo `ItemDef`, sem exportar um segundo), com `windowHeight`/`overhead`; `FindsQuery { place, container, state, rng, day?, region?, footprint?, key? }`, `FindStack { itemId, count, data? }`, `TemplateDef.place`. **Estrutura na planta:** a extensão de resultado já cobre `result.structure` (ordem, fluxo semeado) e o visor ganhou a API de camada; a estrutura em si é T2.2c.

**Fidelidade com a página do time:** 12 modelos x 25 sementes x 3 estados = **900 de 900 plantas iguais em todas as listas** (cômodos, paredes, aberturas, móveis, itens de estado, lote), traduzindo ids pelas tabelas dos `MIGRATION.md` (`vc3-id-map.json`, gerado por `build-vc3-id-map.mjs`). Conferência extra, não gravada: sementes 26–150, 4500 plantas, 0 diferenças. Fora: os 5 modelos rurais (375 plantas gravadas), que o teste lista como pendentes e vai falhar quando a T2.2f os registrar.

**Quebras esperadas (documentadas):** não há mais igualdade com o porte antigo (VP) — não existiam fixtures VP; o `MIGRATION.md` dizia "0 diferenças" e ganhou aviso. A suíte de propriedades mudou em três pontos: caminho pode chegar ao portão por outro caminho ou pela vaga, caminho de prédio colado na rua tem `from` nulo, e a média de itens de quintal do modelo médio caiu de 8 para 7,5 (sem a caixa d'água de quintal).

**Mantido do SDK:** zoneamento, visor 2D, idiomas, `registerPass`, suíte de propriedades.

**Não portado (fora do T2.2b):** caixa d'água/instalações/estrutura (T2.2c–e), cores dos tipos de cômodo rurais, lampiões sem rede, estilo, itens e bibliotecas rurais (T2.2f).

### Perguntas para o dono

1. Os caminhos que ligam a edícula do quintal ao caminho principal (`cam_quintal.edicula.*` na página) ficaram para a T2.2e junto com as edificações; confirma?
2. Localização do teste de fidelidade das plantas: ficou no pacote `-post-apocalyptic` (único com os três pacotes de conteúdo); se preferir no motor, a alternativa é um ciclo de devDependencies.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `game-contracts` | 29 passaram (27 + 2) |
| `game-destruction` | 155 passaram (97 + 58), também no Node 22 |
| `game-destruction-three` | 53 passaram (47 + 6) |
| `game-test-room` / `game-weapons` | 118 / 277 passaram (cadeia e explosivos verdes) |
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 |

| `pnpm -r test` (inteiro, em segundo plano) | exit 0 |
| golden-tool (Node 24 / Node 22.23.4) | 43 / 43 passaram |
| `game-floorplan` / `-residential` / `-commercial` / `-post-apocalyptic` (Node 24 e 22) | 17 / 16 / 9 / 106 passaram nos dois |

Modelo da execução: `sonnet`.

## T2.5 — silhuetas de longe e interiores completos (grupo E da Fase 2)

Modelo: `sonnet`. Branch `work/spec001-t2-e` (sobre `feat/spec-001-fase-2`). Desenho: `design/T2.1-casas-estrutura-e-destruicao.md` §1 (linhas "Silhuetas / LOD de longe" e "Interiores"), §4, §6, §7 item 3 e §8. Fonte: `sources/mapa__galeria-vale-cinzento.js` (silhuetas L187 e L1136–1142; interiores L771–L1117).

### Commits

| Commit | Conteúdo |
|---|---|
| T2.5a | silhuetas como dados de geometria em `game-floorplan/src/silhouettes` |
| T2.5b | `supermarket`, `drugstore`, `gun_shop` + infraestrutura (`interiors/`, `interiorFindsHints`, locales `interiors-*.json`, `place` e `construction` em `market` e `pharmacy`) |
| T2.5c | `police_station`, `emergency_room`, `school` (uso `institutional`, zona `zc` o aceita) |
| T2.5d | `gas_station`, `church`, `metalworks` |
| T2.5e | `farm` (estilo `farm`, zona `za`) e `triage_tent` em `game-floorplan-post-apocalyptic` |
| docs | skills, README, inventário, esta seção |

### T2.5a — silhuetas

- **Onde:** `packages/game-floorplan/src/silhouettes/` (`createTwoStoreyHouse`, `createSlabHouse`, `createColonialHouse`, `createChalet`, `createCompanyHouse`, `createStiltHouse`, `createFarmhouse`, `createDetachedHouse`, `createCityBuilding`, `createSilhouetteRandom`). Escolha: o `game-floorplan-three` ainda não existe (outra task) e criar o esqueleto dele aqui colidiria com a T2.4a; o motor é o pacote mais baixo que o `-three` e qualquer outro consumidor já importam, e a geometria é só dado (sem three), então fica em `game-floorplan` e o `-three` só desenha a lista de peças. Mover para `-three/src/lod/silhouettes` depois é troca de caminho.
- **Formato:** `Silhouette { parts, windows, footprint }`; peças `group`, `box` (com o raio da caixa arredondada da página), `prism`, `cylinder`, `line`, `sign`; janelas são instâncias (`isLit`). Mesmo gerador semeado da página (`mulberry32`), com as mesmas sorteios na mesma ordem.
- **Teste:** `tests/silhouettes.test.ts` constrói a cena em Node com three ^0.160 (`tests/silhouette-scene.ts`, só de teste), `installPortableMath`, e compara as **16 cenas** do golden com o hash da galeria linha por linha: **16 de 16 iguais**, no Node 22 e no 24. O golden saiu de `specs/.../goldens/` para `packages/game-floorplan/tests/fixtures/team-golden/gallery-silhouettes.json` (README dos goldens atualizado).
- **Desvio (corrige bug da página):** a cerca da casa de empresa é filha do grupo da casa (a página a põe na raiz com coordenadas locais, então fica na origem se a casa não está na origem). A ordem das linhas do hash não muda, então o golden continua valendo.
- Dependências novas de desenvolvimento em `game-floorplan`: `three ^0.160.1`, `@types/three ^0.160.0`, `@adatechnology/golden-tool`.

### T2.5b–e — interiores

Cada prédio é um módulo em `packages/game-floorplan-commercial/src/interiors/<prédio>.ts` (modelo, itens, bibliotecas de slots e dicas de achado); `interiors/index.ts` os lista. Tipos de cômodo reusam os da paleta residencial (`shop`, `counter`, `stockroom`, `office`, `hall`, `dining`, `living`, `bedroom`...) para não deslocar o fluxo semeado da paleta de nenhuma planta; o nome do cômodo vem do id e do rótulo (en e pt-BR).

**Como o programa é conferido** (`tests/interiors.test.ts`, 10 prédios x 6 asserções; `game-floorplan-post-apocalyptic/tests/triage.test.ts`): tamanho, pé-direito, uso e `place`; cômodos com largura e profundidade da cena; contagem de cada equipamento **igual em 25 sementes** (equipamento da cena é `required`); `validate()` vazio em 25 sementes; cada pino `loot` da galeria vira uma dica de achado com equipamento daquele cômodo; nomes en e pt-BR. A suíte de propriedades das plantas (`floorplan.test.ts`, tamanhos sorteados, 3 estados) roda todos os modelos novos; ela só deixa de exigir variação de layout entre sementes (`layouts vary across seeds`) dos interiores, que são cenas autorais.

**Fidelidade por prédio** (G = medida da galeria; "estado" = vem do estado pós-apocalíptico, não do modelo; "cena" = zumbi, texto, luz e efeito, que ficam no jogo):

| Prédio | Igual à galeria | Desvios |
|---|---|---|
| `supermarket` 18x13x3,4 | 3 caixas 1,2x2 com caixa registradora, 4 gôndolas de 7 m, prateleira de fundo de 12 m (6 módulos), padaria, açougue 5x4,5 com câmara fria, estoque 5x3,6 com prateleira de 4,4 m, 2 freezers (da descrição) | gôndolas correm no sentido da largura (G: da profundidade); balcão de padaria 3,8 (G 4) e de açougue 3,6 (G 4,8) pela folga de porta do motor; escritório 3x1,9 (G 2x1,9) e corredor de serviço 2x1,9 acrescentado; gôndola derrubada, porta travada, corpos: estado e cena |
| `drugstore` 11x9x3,2 | sala de manipulação 3x2,5, depósito de controlados 3x2,2 com grade, balcão de 6 m (3 módulos), prateleira de fundo (4 módulos de 1,8), prateleira lateral (3 módulos), geladeira de vacinas, cofre | porta de aço de 4 m vira porta de aço de 2,4; sem porta de serviço; carro e porta forçada: estado |
| `gun_shop` 20x9x3,2 | salão 12x9, estande 8x9 com 4 raias de 2 m e 4 alvos, rack de 9 m, vitrine de 7 m, bancada de recarga 2,2, 3 troféus | depósito blindado 2,4x2 é suposição (G só tem a porta no fundo); porta salão-estande acrescentada; dono, cartuchos, armadilha: cena |
| `police_station` 16x11x3 | celas 2,5x6,5 (x2), sala do delegado 4,6x3,5, 3 mesas, quadro 3,6, 6 armários, depósito de evidências 1,8x3,5, viatura no pátio da frente | arsenal 2,4x3 e vestiário 2,4x4,5 têm medida inventada (G dá só a porta e os armários); recepção aberta para o salão; zumbis presos, quadro de fotos: cena |
| `emergency_room` 18x11x3 | pronto-socorro 18x6,5 (3 macas, carrinho, 6 cilindros), alas 8x4,5 com 2 leitos e monitor cada, UTI 2x4,5 | UTI ganha 1 leito e 1 monitor (G não tem); macas empilhadas e fita de quarentena: estado |
| `school` 18x15x3 | biblioteca 5,5x5,9, cozinha, refeitório com 2 mesas de 3 m, corredor com 9 armários, sala 10x6,5 com lousa de 5 m, mesa do professor e 16 carteiras, quadra 8x15 | porta da sala de aula em x=9,2 (G 5,5: carteiras na frente dela); quadra tem 2 tabelas (G: 25 colchões = estado de abrigo); entrada pela quadra |
| `gas_station` 22x7x3 | loja 14x7 com 3 corredores de 4 m, balcão, 4 geladeiras, troca de óleo 6x7 com 2 colunas do elevador, prateleira e 4 tambores, pista com 3 ilhas e 4 colunas da cobertura | baia deslocada 1 m; banheiro externo 2x2 (G 1,6x1,6) e depósito de ferramentas 2x5 acrescentado; carro no elevador, fila de carros, placa de giz, cadeia de explosões: estado e cena (a cobertura é estrutura, T2.2c) |
| `church` 12x20x7 | salão 12x4, nave 12x12,8 com 14 bancos (2 colunas a 2,6 m do eixo), altar com cruz, sacristia 2,6x3,2 com armário e mesa, torre do sino 3x3 no lote, 4 vitrais | armário de doações na parede direita (G na esquerda, onde caem os vitrais); vitrais espaçados igualmente (G em posições fixas); doentes acorrentados, grupo de fé: cena |
| `metalworks` 30x20x8 | 4 prensas, 3 porta-pallets de 4,5 m, esteira de 16 m, empilhadeira, 6 tambores, 2 mesas de refeitório e geladeira, 6 armários, porta de enrolar de 5 m nos fundos | a G é planta aberta: ganhou paredes (refeitório, recepção, estoque, vestiário); forno 6 m a oeste (G fora da sala); escritório de 8,5x3 no chão (G é mezanino a 3 m de altura); horda dormente, esteira animada: cena |
| `farm` 12x9x3 + lote | casa sede 12x9, fogão a lenha, mesa de 2x1, rede, 2 pilares da varanda, poço, galinheiro 4x3, curral 22x10, celeiro 10x14, silo de 6 m, galpão 11x9, trator, espantalho, 10 fardos | G é planta aberta com meia parede (aqui sala, cozinha e quarto); cama no quarto (G na sala); layout espelhado e compactado no lote (galpão no quintal dos fundos); segundo trator ao lado do galpão; animais, estrada, horda, casa pregada: estado e cena |
| `triage_tent` 16x10x3,4 | lados LIMPO e MORDIDO 8x10, 6 catres em cada, 6 caixas médicas, cavalete com fuzis | divisória baixa de 1,6 m vira parede; um fluxo de entrada por lado; formulários no chão: estado |

**`farm` fica em `-commercial`** (§7 item 3): estilo `farm` próprio (`commercialStyles`, cores em `regions/br`, perfil de decoração com cortina em toda janela), uso `agricultural` e zona `za` na região `br`; o comercial não depende do rural.

**`triage_tent` como modelo, não como estado** (padrão reversível; o consolidado C5 diz "estado ou conteúdo do jogo"): um estado transforma um prédio que já existe, e a tenda não tem prédio hospedeiro; o pacote de gênero a registra como modelo com estilo `military_camp` (paleta emprestada do primeiro pacote de conteúdo registrado; sem pacote de conteúdo a tenda não é registrada) e `place: 'triage'`. Trocar por estado é mover os itens da `triageItems` para um plugin sem mudar o programa.

**Achados:** cada pino `loot` da galeria virou uma entrada de `interiorFindsHints[idDoModelo]` (`room`, `container` = categoria do equipamento que existe na planta, `tags` descritivas, nunca id de item: o catálogo de itens é da fase 3); `TemplateDef.place` leva o lugar para o `FindsQuery.place`. Pinos `perigo`, `quebra` e `cena` não são achado e ficam como notas de cena no jogo.

**Estrutura:** todos declaram `construction: 'masonry'` (§8: prédio é pórtico de concreto com vedação; a estrutura em si é da T2.2c), o triage declara `canvas`.

### Escolhas de negócio (padrão reversível, para o PR)

1. `market` e `pharmacy` não mudam de planta (só ganham `place` e `construction`): são o comércio de esquina; o mercado e a farmácia da galeria são os modelos novos `supermarket` e `drugstore`. Juntar os dois pares é trocar os ids nos testes.
2. Ids em inglês: `emergency_room` (G "Pronto-socorro", o inventário sugeria `hospital_er`), `metalworks` (G "Metalúrgica/Galpão", o inventário sugeria `factory`).
3. Uso `institutional` (delegacia, pronto-socorro, escola, igreja), `industrial` (metalúrgica), `agricultural` (fazenda); `zc` passou a aceitar `institutional` e a zona `za` é nova.
4. Equipamentos obrigatórios e posições fixas: a planta varia por tamanho, estado e decoração, não por sorteio de móveis; quem quiser variação troca as bibliotecas (registro).
5. Itens novos têm categoria própria e `exactOnly` quando a cena dá a medida (um `gondola_run` de 7 m não entra no sorteio de `gondola_shelf`).
6. Zumbis, corpos, sangue, textos da lousa e luzes não entram nos modelos (cena e estado).

### Portões

- `pnpm build`, `pnpm -r typecheck` e `pnpm lint`: limpos em cada commit.
- Testes por pacote: `game-floorplan` 37 (20 de silhuetas), `game-floorplan-commercial` 69 (60 de interiores), `game-floorplan-post-apocalyptic` 142 (inclui a suíte de propriedades com todos os modelos novos e `triage.test.ts`).
- Silhuetas no Node 22 e 24: 20 de 20 passam nos dois.
- Final: `pnpm -r --no-bail test` sai com 0 (a primeira rodada falhou por tempo em `game-weapons-three`, pacote alheio, com a máquina sob carga 10 a 38; passou na repetição); `docker build -f site/Dockerfile .` passou.
- Um commit (T2.5c) foi feito antes de eu ler a falha do pronto-socorro na suíte de propriedades (faltava cômodo de tipo `living` para o estoque do estado fortified); corrigido e emendado no mesmo commit antes de qualquer push.
- `testTimeout` de 30 s no pacote comercial: o teste de zoneamento gera 12 modelos x 7 zonas.

## T2.2f–g

Modelo: `sonnet`. Branch `work/spec001-t2-f` (sobre `feat/spec-001-fase-2` com as regras do VC3 no núcleo). Commits: `feat(game-floorplan-rural)…` (T2.2f) e `feat(game-floorplan-residential): casa de laje…` (T2.2g); esta seção é o terceiro.

### T2.2f — `game-floorplan-rural`

- Pacote novo `@adatechnology/game-floorplan-rural` 0.1.0 (ESM + IIFE `GameFloorplanRural`): `wood_frame_house`, `a_frame_chalet`, `log_cabin`, `shack`, `campsite`, estilo e paleta `rural` (receita `mid` com tabela e fluxo próprios), perfil de decoração, 28 itens, 23 bibliotecas de slots (estendem `living` e `laundry` do residencial), nomes en / pt-BR, marca `region: 'br'`, `construction` (`wood_frame`, `log`, `improvised`, `canvas`) e `place` (`house`, `cabin`, `shack`, `camp`). `MIGRATION.md` com as tabelas de ids; elas entram em `vc3-id-map.json`.
- Motor (mínimo): `TemplateDef.config` (vai para `result.config`), `Plan.options` (o `reservations` do modelo precisa da semente) e `engine.paletteStyles`. Residencial: o passe de decoração põe lampiões (`ceiling_oil_lamp`, `oil_lamp`) nos planos `power: 'offgrid'`, no mesmo ponto do fluxo da página (sem luz de teto).
- **Golden:** as 375 plantas rurais gravadas na T2.2a passam (5 modelos x 25 sementes x 3 estados, todas as listas); o teste não lista mais pendentes (17 de 17 modelos). Conferência extra, não gravada: gravei de novo a página (sementes 26–100, 5 modelos, 3 estados) e o pacote confere **1125 plantas, 0 diferenças**.
- `steps` das portas de entrada vêm da elevação da fundação (laje 0,2, vazio 0,6, porão 0,5, pilotis 0,9, cabana 0,5), como a página faz na montagem da estrutura.

### T2.2g

- `budget_slab_house`: `floorRange [1, 3]`, `floorsFn`, opções `floors` (padrão 1: as 75 plantas da página continuam iguais) e `randomFloors`. Andares de cima: 2 quartos + banheiro; escada reta na margem esquerda em `result.config.sideStair`; esperas de vergalhão na laje do topo em 60% (sempre no térreo único, como a página).
- Barraco: `result.config.power: 'tap'` (gato); decoração segue como rede (luz de teto).
- Testes: pacote rural (26: registro, textos nos 2 idiomas, 13 variantes x 30 sementes x 3 estados válidas com caminho em toda porta, regras rurais), residencial (+6 da laje), suíte de propriedades do post-apocalyptic com variantes rurais e de 2 e 3 andares (a checagem de escada vira "escada lateral" quando há `sideStair`).

### Escolhas de negócio (padrão reversível, para o PR)

1. `budget_slab_house` sem `floors` continua com 1 andar (a página); o sorteio uniforme 1–3 da Galeria é `randomFloors: true`.
2. Andar de cima: quarto da frente (5 m), quarto dos fundos e banheiro; a escada é dado de configuração (não item), um lance de 3,9 m por andar; no 3º andar o quarto dos fundos usa só cama de solteiro (porta da escada come parede).
3. `use` do camping é `recreational`; casas são `residential_single`. `place`: `house`, `cabin` (chalé e cabana), `shack`, `camp`.
4. Opções renomeadas em inglês (tabela no MIGRATION do rural); cor de telhado do modelo vai em `facade.roofColor`.
5. Cor de parede e piso de `porch`, `tent` e `camp` não herdam a da sacada (o motor não tem alias de tipo na paleta).

### Perguntas para o dono

1. Com 200 sementes (`FULL=1`) os modelos rurais têm raras plantas que a própria página também gera (idênticas): alpendre da cabana com centro inalcançável (sementes 53, 68, 123, 167, 173), pouso de escada bloqueado por vaso no chalé (187), quarto do barraco com 29% de área alcançável (200) e estado abandonado sem cadeira caída no barraco (90). Mantive o porte fiel (suíte padrão, 25 sementes, passa); corrijo na página e no porte juntos se quiser.
2. A laje com andares: a escada na margem esquerda tapa a porta lateral da cozinha por cima? (ela passa acima de 2,6 m; confirma o desenho?)
## Fase 5 — grupos A e B

Branch `feat/spec-001-fase-5` (de `main`), worktree `spec001-fase-5`. Contrato: `design/T5-efeitos.md`. Cada task é um commit isolado, na ordem do prompt (T5.0, T5.1a, T5.3b, T5.1b, T5.1c, T5.1d, T5.1e). Os grupos C (destruição, fluidos, armas e sala de testes passam a usar o mundo de efeitos), D (Oficina de VFX e bancada) e E (filme de fluidos) não foram começados.

### T5.0 — capturas e fixtures

- `--expose` no gravador: mesma implementação da T2.2a (`feat/spec-001-fase-2`, commit `822cbdb`), trazida com `git checkout feat/spec-001-fase-2 -- tools/golden/{bin,src,tests}` (`expose-in-page.mjs`, `hashText`, o teste), para as duas branches convergirem no merge. A linha do README é a mesma.
- Capturas: `explosion-lab.js` (16 cenas), `vfx-workshop.js` (modo `effects` e modo `fluids`), `fluid-standard.js` (5 cenas x 5 fluidos). Cada gravação saiu idêntica byte a byte repetida e entre Node 22.23.4 e 24.22.0 (o gravador roda o V8 do Chrome; o Node só roda o script).
- Desvios do contrato, todos de método:
  - O Laboratório não é guiado por `frame` da página (tem `IntersectionObserver` e renderiza): a captura chama as funções `update*` da página, na ordem do `frame`, a 1/60 s. `blast` é chamado direto, sem os zumbis, as janelas (`WINDOWS.length = 0`) nem a física de arremesso; o estado global que a página guarda entre cenas (`clock`, `xlIdx`, `decalY`, `flashDecay`, `lodNow`) é zerado por cena para a cena poder ser reproduzida sozinha.
  - Hashes de pool são de estado em `number` (4 casas), não dos buffers `pA/pD/pC` em float32 (o arredondamento de float32 vira fronteira de hash). Os buffers entram como amostra com tolerância (primeira e sexta linha escritas no quadro, `puffGeo.instanceCount`: puffs nascidos depois do `updatePuffs` do mesmo quadro ainda não estão no buffer).
  - A Oficina tem 40 definições; sem chuva, neblina, faróis e o filme sobram 36 (o contrato diz 34), por opção de parâmetro: 54 execuções. O filme dos 4 fluidos é a captura `mode=fluids`.
  - `renderer.render` é silenciado nas páginas da Oficina e do Padrão de Fluidos: a gravação leva segundos.
- Fixtures: Lab 770 KB, Oficina 1,9 MB, filme da Oficina 4 KB, Padrão de Fluidos 24 KB. O do Laboratório foi para `packages/game-vfx/tests/fixtures/team-golden/` na T5.1e; os outros ficam em `specs/.../goldens/` até a T5.2c e a T5.3d.

### T5.1a e T5.3b

- Contratos: `effects.ts`, `ModuleHost.effects`, `explosive` no `explosion`, `explodes.effect` e `explode.effect`, `ChoiceOption.group` (o `checkBench` recusa grupo vazio ou partido), `ModuleBench.sheet` e `BenchSheet`. Tudo aditivo.
- Fluidos: valores do time por padrão (sangue 0x3B1D14 e 600 s, combustível 60 s sem marca, água 180 s), `old_blood` e `bile` novos, `splash` com `tint`. Valores antigos (sangue 0x4A0506 e 1200 s, combustível 120 s com marca, água 600 s) listados no changeset. Dois testes que dependiam dos tempos antigos foram ajustados. Decisão minha: viscosidade/densidade/brilho de `old_blood` (4/1060/0,7) e `bile` (6/1020/0,75) e efeitos de beber (`disgust`) não vêm do time; ficam como padrão configurável.

### T5.1b a T5.1d — `game-vfx` e `game-vfx-three`

- Porte literal do Laboratório: compositor de camadas na ordem do `blast`, com os sorteios na mesma ordem (cada função de camada declara a ordem dos `rr`), laços de simulação na ordem do `frame`, luzes, fogo, cogumelo, crateras com `GroundField` em float32 (o `dent` sorteia por célula, então o chão tem de viver no núcleo puro).
- Piscinas de registros reaproveitados em ordem de entrada (`OrderedPool`): sem alocação por quadro; a mais antiga sai quando cheia (detritos: um parado primeiro); halo de detrito vira posição fixa quando o detrito sai.
- Teto de área (40 m no plano, 4 s, 6, 0,3), `LOD_GAME` e `LOD_LAB`, `PROFILES`, `estimateCost` igual à ficha do Laboratório nos 16 perfis, agenda do último para o primeiro.
- Os 16 perfis em `explosions.json` por id de explosivo de `game-weapons` (+ `generic` e os dois apelidos), gerados do `PROF` da fonte, com `sources` (linha). Todos os 18 explosivos de `game-weapons` respondem.
- Renderizador three: shaders verbatim (`encodings_fragment` virou `colorspace_fragment`; `extensions.derivatives` saiu), luzes com cores cruas do r128 e `lightScale` π (luzes físicas do r160), marcas criadas no instante do evento (acompanham o chão daquele momento), `EffectSink`, `applyCamera`, sobreposição de tela.
- Achado pelo golden: o renderizador deve seguir a câmera também em `play` (antes do primeiro `update` o LOD usava a câmera na origem); corrigido e com teste.

### T5.1e — fidelidade do Laboratório

| Teste | Resultado |
|---|---|
| `game-vfx/tests/team-golden.test.ts` (puro: `randomMode: 'shared'`, `LOD_LAB`, `profile: 'high'`, `areaCap: false`) | 16/16 cenas: detonação (LOD, contagens, tela, fluxo), 400 primeiros spawns, contagens por quadro, camadas, estado das piscinas em 0,08, 0,25, 0,5, 1, 2 e 4 s, fluxo final |
| `game-vfx-three/tests/team-golden.test.ts` | 16/16: hash da cena das marcas (malhas conformadas, pedras da borda), casca e anel do choque, buffers dos puffs (float32, tolerância 2e-3) |
| Node 22.23.4 e 24.22.0 | iguais (`installPortableMath` no setup; `Math.hypot` e `Math.atan2` do chão dão o mesmo nas duas) |

Fidelidade do Laboratório: **16/16**.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| floorplan, residential, commercial, rural (Node 24 e 22.23.4) | 18 / 23 / 9 / 26 passaram nos dois |
| post-apocalyptic (golden VC3 + propriedades; Node 24 e 22.23.4) | 175 passaram nos dois |
| `pnpm -r test` (inteiro, em segundo plano) | todos os pacotes passam; na execução paralela o worker do post-apocalyptic perdeu um RPC do vitest ("Timeout calling onTaskUpdate", 175 passaram), e sozinho dá exit 0 |
| `docker build -f site/Dockerfile .` | exit 0 |
## T2.2c–e — `game-floorplan-structure`: estrutura, detalhe de parede, instalações

Modelo: `sonnet`. Branch `work/spec001-t2-c` (sobre `feat/spec-001-fase-2`, depois de T2.2a–b e T2.3a–b), grupo A+B da Fase 2: estrutura das casas e o caminho de carga (desenho `design/T2.1-casas-estrutura-e-destruicao.md` §1, §2, §3, §8, §9).

### T2.2c — pacote novo, sistemas construtivos, `buildStructure`, `toDestructibleSpec`, telhado, visor 2D

**Fidelidade com a página do time (golden `coarse`):** 12 modelos x 25 sementes x 3 estados = **900 de 900 plantas iguais** em todas as listas gravadas: peças (`pecas`), apoios, partes e juntas do `specDe` coarse e `vedacao`
(capacidades incluídas, a 3 casas), e em `niveis`/`elevacao`, `construcao`, `telhado` e `caixaDagua`. O teste traduz o SDK de volta para o vocabulário do time (`tests/team-vocabulary.ts`, ids e chaves em português) e confere os hashes gravados
(`tests/fixtures/team-golden/vc3-structure.json`, movido de `specs/.../goldens/`). Os 5 modelos rurais ficam de fora (T2.2f) e o teste lista exatamente eles como ausentes.

**O que entrou:**

| Peça | Onde |
|---|---|
| `JUNTA_SIS`, `construcaoPadrao`, `TELHA_MAT`/`TELHA_JUNTA` | `registry.ts` (`registerConstructionSystem`, `registerRoofCovering`), `presets.ts` (`masonryConstruction` e os dados dos 5 modelos rurais como funções: `woodFrameConstruction`, `chaletConstruction`, `logCabinConstruction`, `shackConstruction`, `campConstruction`), `construction.ts` (`options.construction`, `TemplateDef.construction`) |
| `montarEstrutura` (L10360–10632) | `structure/*.ts` (fundação, paredes, pratos e pilares, varanda/alpendre, laje do andar, sacadas, degraus, escadas, telhado, barrotes do forro) com ids em inglês (`MIGRATION.md`) |
| `montarEstruturaLona` | `structure/canvas.ts` |
| `estruturaExtras` (caixa d'água, chaminé, poço) | `structure/tank-parts.ts`, `structure/extras.ts`; a caixa d'água do plano (`montarCaixaDagua`, L9279) em `water-tank.ts` (veio na T2.2c porque a estrutura a carrega; golden igual) |
| `specDe` e `cargasProjeto` | `to-destructible-spec.ts`, `loads.ts` |
| camada "estrutura" do visor 2D | `viewer-layer.ts` + `viewer.html` (a legenda passa a ser traduzida pelo visor) |

**Caminho de carga (testado no mundo de `game-destruction`, `tests/load-path.test.ts`):**

| Cenário | Resultado |
|---|---|
| varanda, pilares tirados (alvenaria com pilar de concreto, casa wood frame e cabana de tronco, com pilar de madeira) | cai só a cobertura da varanda; casa, telhado principal e piso ficam |
| um de três pilares da varanda | a cobertura fica nos outros dois |
| `coarse` (como o time): cobertura da varanda também apoiada na parede da casa | fica de pé (por isso a diferença de propósito abaixo) |
| laje plana, pilares de canto (pórtico) | um pilar: a laje fica; dois: a laje cai |
| sobrado em pórtico, dois pilares do térreo | laje de cima e as duas águas caem; com um pilar nada cai |
| mercado (prédio em pórtico por padrão) | um pilar: o telhado fica; todos: cai |
| wood frame, serrar os montantes da parede da frente | caem a parede, o prato e a água do telhado em cima dela (caibros e `roof_a`); a outra água e as outras paredes ficam |
| barraco | a parede de chapa cai sozinha, o telhado fica nos prumos |

**Diferenças de propósito (só fora do `coarse`):** (1) o telhado de duas águas vira caibros por lado e cumeeira em vez de tesouras inteiras: sem isso a tesoura apoiada nos dois pratos nunca cai com uma parede só; a massa do telhado é igual (a menos de 2%); (2) a cobertura da varanda se apoia só nos pilares dela (a amarra com a parede não carrega); (3) prédio em pórtico (apartamento, comercial ou 3+ andares) carrega pelos pilares e vigas (`structure.framed`, `portico` padrão).

**Desvios do desenho:** `sizeStructure` do `game-destruction` dá as mesmas capacidades do `specDe` (a 1e-16) nas casas de parede portante, e **difere nas vigas de prédio em pórtico**: a regra N-1 do `sizeStructure` vale para todas as peças, a do time só para pilar e parede portante. Para o golden ficar igual, `toDestructibleSpec` dimensiona com a própria carga em repouso (`loads.ts`, 50 linhas, mesma regra do mundo); um teste confere que as duas regras concordam nas casas de parede portante. A caixa d'água do plano (L9279) entrou aqui, não na T2.2e.

**Escolhas de negócio (padrão reversível, para o PR):** tipo de cômodo do alpendre `porch`, porta de degraus `type: 'steps'`, zíper `'zipper'`, tenda `kind: 'dome' | 'tunnel'`, escada do porão `type: 'basement_stairs'` (o pacote rural da T2.2f confirma ou muda); camada de estrutura no visor começa desligada; `framed` por heurística (apartamento, comercial, 3+ andares); capacidades de caixa d'água por estilo (budget 500, mid 1000, mansion 3000, resto 2000) configuráveis por `tankCapacities`.

### T2.2d — `wallDetail` panels e units, `buildWallSpecimen`

Comportamento novo (sem original do time); o `coarse` segue o golden da T2.2c.

| Peça | Resultado |
|---|---|
| `panels` (padrão) | cada parede cortada nas janelas: pilaretes (papel da parede), peitoril (`partition`), verga de concreto armado (`beam`, 0,2 m de apoio nos pilaretes, `reinforcement` da montagem, vergalhão a 0,18 m) e a parede acima da verga (papel da parede); o vão da porta ganha `lintel_<porta>` (verga de concreto armado; cabeçote de madeira nas casas de madeira) apoiada nas paredes ao lado, que carrega a cinta ou o prato; montagem de `game-destruction` em cada peça (reboco, estágios, brecha) |
| massa | preservada: a massa da parede é repartida pelas peças por volume. `single_storey_a`, `townhouse`, `high_end_contemporary`, `market`: a soma das peças de cada parede = a massa da parede (< 1%) e o total da casa também; corpos de prova de 7 montagens, inteiros e com porta ou janela, com a mesma massa |
| `units` | tijolo (0,23 x 0,075), bloco (0,39 x 0,19) e painel de concreto armado (0,6 x 0,42, grade 4 x 5) assentados em amarração, cada unidade sobre as duas de baixo; a capacidade da peça é dividida pela largura da unidade (a casa continua de pé: tensão máxima 0,65). `single_storey_a`: 10 067 unidades; `mansion`: 70 403 em 0,9 s |
| parede de tronco | fiadas de toras de 0,26 m (10 por parede de 2,6 m) cortadas nas aberturas; cada tora sobre as de baixo. Tirar a tora de baixo derruba as de cima; uma tora do meio tirada, o resto fica |
| `buildWallSpecimen` | corpo de prova de 2,4 x 2,1 m sobre soleira ancorada: inteiro, com porta (2 pilaretes, verga, parede acima) ou janela (+ peitoril); `units`: 200+ tijolos ou 20 painéis; os dois pilaretes tirados derrubam verga e parede acima, um só não |

Gate extra: o spec detalhado da casa fica de pé por 60 s (nada quebra sozinho) em 3 modelos; `panels` de uma mansão (302 peças) monta em poucos ms.

**Desvios:** a espessura física da peça é a da montagem (0,13 m no tijolo rebocado), não os 0,15 m do plano; o material das peças continua o da estrutura (`brick`) mas o núcleo da montagem de bloco é concreto (massa vem da estrutura, não da montagem); janela e porta do corpo de prova ficam em 0,33 e 0,8 da altura (a altura da porta de verdade não está na planta: 2,1 m, constante `DOOR_HEIGHT`).

### T2.2e — instalações, edícula e conteúdo por estado

**Fidelidade com a página do time:** as sete listas do golden de instalações (`gas`, `gasBottles`, `electrical`, `solar`, `plumbing`, `outbuildings`, `outbuildingPaths`) conferem em **900 de 900 plantas** (12 modelos x 25 sementes x 3 estados). O teste traduz o SDK de volta para o vocabulário do time (`tests/team-utilities.ts`); os ids dos móveis voltam por posição
(captura nova `tools/golden/captures/floorplan-item-ids.js`, gravada duas vezes com saída idêntica, `tests/fixtures/team-golden/vc3-item-ids.json`, 1,9 MB). Antes de gravar, conferi 36 plantas contra as linhas completas da página (captura de depuração, fora do repositório): zero diferenças depois de dois acertos (a geladeira
média de loja também liga numa tomada, e o sorteio da edícula usa o nome de fluxo do time `edif:quintal.edicula`, agora em `streamOf`).

| Peça | Onde |
|---|---|
| `montarGas` (botijão ao lado, em nicho externo, sob a bancada, ou encanado com medidor) | `utilities/gas.ts`; o botijão entra em `result.items` como `cooking_gas_cylinder` (registrado no catálogo, 13 kg) |
| `montarEletrica` (tomadas, entrada de energia, quadro, interruptores, circuitos, eletrodutos), modos `rede`, `gato` (barraco), `offgrid` | `utilities/electrical*.ts`, `wall-points.ts`; modo por `TemplateDef.energy(options, w, d)` |
| `montarSolar`, `montarHidraulica` | `utilities/solar.ts`, `plumbing.ts` |
| `montarEdificacoes`, `caminhosEdificacoes` | `utilities/outbuildings.ts` (caminhos em `result.lot.paths`) |
| `CONTEUDO`, `sorteiaConteudo`, `aplicaConteudo` | `utilities/content-tables.ts`, `content.ts`, `result.contents`: pergunta ao `engine.findsFor` e cai nas tabelas do time quando ninguém responde; regras de estado em `CONTENT_STATES` (`registerContentState`) |

Testes de comportamento (`tests/utilities.test.ts`): todo modelo tem instalações e passa no `engine.validate` (12 modelos x 8 sementes x 3 estados); gás em pelo menos duas posições; botijão externo fora da casa e o de baixo da bancada escondido; aparelho com tomada a até 1,2 m e chuveiro com tomada própria a 1,10 m; chave no lado do trinco; barraco (`tap`) sem medidor e com ligação a 2,6 m; cabana `offgrid` sem instalação, só a fonte (`solar` ou `lamp`); solar no telhado ou em rack de laje; edícula com porta de 0,85 m, 2 janelas, móveis dentro e caminho; geladeira com mais mantimento fortificada do que normal e normal mais do que abandonada, comida estragada na abandonada; um provedor registrado responde antes do padrão.

**Escolhas de negócio (padrão reversível):** as regras de estado (`fortified`, `abandoned`) do conteúdo ficam em `CONTENT_STATES` neste pacote até o catálogo de itens (Fase 3) e o pacote do gênero (G7: multiplicadores do estado em `-post-apocalyptic`) assumirem; ids de item de conteúdo em inglês (`water_bottle`, `canned_tuna`, `spoiled_food`...) são provisórios para o catálogo da Fase 3; `gaveteiro` e `sapateira` do time não têm categoria equivalente no SDK e ficam sem conteúdo; o botijão de cozinha é um tipo novo (`cooking_gas_cylinder`, 0,36 x 0,36 x 0,48) ao lado do `gas_cylinder` externo do residencial.
| `pnpm -r test` (inteiro, em segundo plano) | exit 0, nenhuma falha |
| `game-vfx` e `game-vfx-three` em Node 22.23.4 | 161 e 59 testes passam |
| `docker build -f site/Dockerfile .` | exit 0 |

Modelo da execução: `sonnet` (nenhum portão falhou duas vezes, sem escalada).

## T5.3a–d — filme de fluidos (grupo E)

Branch `work/spec001-t5-e` (de `feat/spec-001-fase-5`, com a T5.3b). Contrato: `design/T5-efeitos.md` §1 (Padrão de Fluidos e fluidos da Oficina), §3, §4, §6 e §7. Um commit por task: T5.3a (`game-fluids/src/film`), T5.3d (goldens), T5.3c (renderizador three, abaixo).

### T5.3a — `game-fluids` film

- Porte literal de F60-114 em `film/deposit.ts` (`dep`, `blob`, `stroke`, `splat`), `film/simulate.ts` (`bbox`, `mob`, `step`, `age`; passo de 180 Hz limitado à caixa molhada, no máximo 6 por quadro ou `maxSteps`, 9 na Oficina), `film/drops.ts` (F250-278: anel de gotas, voo, `land`), `film/sources.ts` (pingo F282, fonte F288, arrasto F291) e `film/layout.ts` (F12-42: grade dobrada sobre parede, calçada, meio-fio e rua; `PADRAO_LAYOUT` e `WORKSHOP_LAYOUT` são dois ajustes de `createFoldedLayout`). `layoutFromSurfaces({ floor, wall?, curb?, center })` monta a dobra a partir de `SurfaceSpec` (a grade 160 x 160 de 2 x 2 m por padrão); `curb` é a superfície mais baixa para onde o meio-fio desce.
- Perfis em `data/film-profiles.json` (sangue, sangue antigo, bile, óleo de motor, combustível; F46-55 e W583-586), com `spikes` (bile 0,3, W578), `landsAsBlob` (óleo e combustível, W691) e `maxAmount` (teto da espessura do centro: 2,6; bile 4 na Oficina). Padrão = a Oficina; o Padrão de Fluidos roda a bile com `{ spikes: 1, maxAmount: 2.6 }` e óleo e combustível com `{ landsAsBlob: false }` (o contrato só nomeava `spikes` e `landsAsBlob`; `maxAmount` é a terceira diferença da Oficina, W691).
- O relógio de secagem é em segundos de simulação (`update({ dt, dryingSeconds })`; o jogo escala). Sem `Math.random`: o host passa `random`. `createFilmLcg` é o gerador do Padrão (F17-18).
- `FilmSimulator` (interface do passo e da secagem; o CPU é o golden de referência) e `film.setWeather({ rain })`: chuva 1 para a secagem e espalha 1,5 vezes (gancho; sem efeito até o `game-weather`).
- Regras que diferem entre as duas páginas ficam em `layout.rules` (anel de 600 ou 400 gotas, gota que passa a borda cai no meio-fio só no Padrão, caixa de fuga, fórmulas do pingo), não em condicionais espalhadas.

### T5.3d — fidelidade do filme

| Teste | Resultado |
|---|---|
| `game-fluids/tests/film-golden.test.ts`: Padrão de Fluidos, 5 cenas x 5 fluidos, hash de `h` e `dry`, células molhadas e lançamentos em 0,5, 1, 2, 5 e 10 s | 25/25 |
| `game-fluids/tests/film-workshop-golden.test.ts`: `fluidos` da Oficina, 4 fluidos, mesmos instantes | 4/4 |
| Node 22.23.4 e 24.22.0 | iguais (`installPortableMath` nos dois testes) |

Fidelidade do filme: **29/29**, bit a bit (hash do campo inteiro, 4 casas).

- O Padrão roda as 25 combinações num filme só, como a página: o cursor do anel de gotas e o resto de tempo do passo atravessam as cenas (`clear` não os zera, igual a `clearAll`). A Oficina zera o resto de tempo a cada opção (`setup`) e mantém o cursor.
- O relógio do teste repete o do gravador (`elapsed += 1000/60`, `dt = (agora - antes) / 1000`): o resto do passo de 1/180 s cai na fronteira do `>=` e só bate com os mesmos bits.
- **Oficina: a página usa o fluxo de `Math.random` com outros consumidores** (os 3 sorteios do tremor de câmera por quadro, as partículas do `burst` e da neblina, 8 sorteios cada). Para a Oficina o teste reproduz essa intercalação e a confere contra uma gravação nova, `vfx-workshop-fluids-trace.json` (`--param mode=trace` em `vfx-workshop.js`): contagem acumulada de `Math.random` no início de cada quadro, em todas as 4 opções (a igualdade é a primeira asserção do teste), e a posição do braço do zumbi que pinga (a página anima o zumbi; não há como reconstruí-la sem ele), uma por quadro, em texto para não perder bits. A gravação `mode=fluids` refeita com `H` exposto saiu idêntica byte a byte à da T5.0.
- Verificação de sensibilidade: trocar `spikes` da bile no teste do Padrão quebra as combinações de bile, óleo e gasolina que seguem (o estado atravessa as cenas).

### Perf do filme (CPU, Node 24, máquina de desenvolvimento)

| Cenário | Média por quadro |
|---|---|
| Padrão, grade 256 x 396, cena "tiro na parede" (356 gotas), 600 quadros | 1,4 ms (pior quadro 13 ms: as 330 gotas do disparo) |
| Grade 160 x 160 com 6 respingos, 300 quadros | 0,54 ms |


## T5.1f–g

Branch `work/spec001-t5-c` (de `feat/spec-001-fase-5`, com `game-vfx`/`game-vfx-three` prontos e Laboratório 16/16). Dois commits, um por task.

### O que trocou

| Onde | Antes | Agora |
|---|---|---|
| `game-destruction-three` `onExplode` | cinco jatos de `ParticleSystem` + `PointLight` própria | `vfx.explosion(ev.effect ?? 'generic', p, ...)`, escala `raio/15` só no `generic`; id fora do catálogo cai no `generic`; fica o empurrão nas peças e fragmentos e o som |
| fogo de peça (`emitFire`) | acumuladores de `spawn('fire'/'smoke')` por quadro | um `vfx.fire` por peça queimando, seguindo a caixa da peça, parado quando a peça deixa de queimar (`extinguish`, `burnout`, `restore`, `clear`); peça preparada por tiro ou fogo ganha uma chama de `delay` segundos |
| `RendererOptions` | `explosionLight` | `vfx` (mundo compartilhado; o hospedeiro o passa) e `camera`; sem `vfx` o renderizador cria mundo e camada três próprios e os passa no `update` |
| `renderer.explode` | 3 parâmetros | `explode(ponto, energia, raio, { effect, direction, visual })`; `visual: false` deixa só empurrão e som |
| `game-destruction` | explosão atinge o vidro na hora | opção `blastFrontSpeed` (padrão desligado; 340 = som): o vidro quebra `distância/velocidade` depois, em `update`; evento `explode` leva `effect` |
| sala de testes | `renderer.explode` desenhava | **um** `createVfxRenderer` (sobreposição no contêiner), mundo passado à destruição, `host.effects` a todo módulo, `explosives.ts` com `vfx.world.explosion(explosivo, ponto, { direction })`, `explosive` no evento `explosion` (granada e peça que explode), `applyCamera` em volta do `gl.render` (e `TestRoom.applyCamera()`), métrica `particles` soma as piscinas, opção `craters` (remendo deformável no lugar do piso) |
| `game-weapons-three` | explosivo do mundo sem efeito | `explodes.effect` = id do explosivo (barril, botijão, tanque do carro) |

### O que **não** trocou, e por quê

O contrato manda detritos, fogo de contato, gotas e vazamentos para `vfx.burst`/`vfx.spawn` (`SpriteKind`) e apagar `particles.ts`. **Esse pool de sprites não existe no `game-vfx` desta branch**: o
`VfxWorld` da T5.1b/d não tem `burst`, `spawn` nem `SpriteKind` (a tabela de perfis lista a coluna de sprites, mas o compositor só tem puffs, faíscas, brilhos, pedaços, choques e anéis), e o desenho (§2.3) põe esse
pool e o executor de receitas na T5.2a, que roda em outro worktree. Para não duplicar nem colidir com ela, **não criei o pool aqui**. Ficam, então, no mesmo estado e sem regressão:

- `game-destruction-three/src/particles.ts` e `ParticleKind` (detritos, faíscas de ricochete, cinzas, vapor, gotas, vazamentos, `emit`): trocar é uma edição de uma linha por chamada quando o pool chegar, e então apagar o arquivo.
- `game-fluids-three/src/particles.ts` (`ParticlePool` de respingo e vapor): mesmo motivo (`drips` e `steam` são do pool de sprites).
- `game-weapons-three`: o clarão do viewmodel e a fumaça da Galeria ficam (como manda o desenho). `muzzle_*`, `impact_*`, penetração e cápsulas de jogador remoto são **receitas** da Oficina (T5.2a); o catálogo de `game-vfx` hoje só tem explosões, então `host.effects.play` não tem o que tocar. Fumaça `muzzle_smoke`: pendente da receita e de conferir o golden T1.3.
- `renderer.emit('fire'|'smoke'|'foam'|'sparks', ...)` da sala (chama de zona de fogo, lança-chamas, extintor): são tipos do pool de sprites.

### Testes mudados

| Teste | Mudança e motivo |
|---|---|
| `game-test-room` `room.test.ts` "grenade blast" | olhava as camadas `destruction-particles-additive` e `destruction-particles` e a luz `destruction-explosion-light`; a explosão agora vem das malhas instanciadas do mundo de efeitos (`vfx-sparks`, `vfx-puffs`, `vfx-glows`, nomeadas nesta task) e das luzes dele. Mesma exigência: mais de 30 instâncias vivas de faísca e de puff, brilho, luz acesa |
| `game-destruction-three` `renderer.test.ts` "explodes" e "explode without an exploding part" | mesma troca de camadas; acrescentados efeito nomeado, fallback para `generic`, mundo compartilhado não é passado pelo renderizador, `visual: false`, fogo que segue a peça |
| mesmo arquivo, "fire and smoke while burning" | contava > 10 partículas do pool antigo; o fogo do mundo de efeitos dá 6 em 30 quadros para uma peça de 0,5 m: o limite virou > 3 |
| mesmo arquivo, "clear and dispose", e `vertex-range.test.ts` | liam `scene.children` e esperavam só o que o hospedeiro pôs; o mundo próprio acrescenta um grupo, então passam mundo compartilhado (`createVfx()`), que não acrescenta nada; o mundo próprio tem teste à parte |
| `game-weapons-three` `integration.test.ts` (explosivos do mundo) | acrescentou a conferência de `effect` nos três explosivos |
| Novos | `game-destruction/tests/blast-front.test.ts`, `game-test-room/tests/effects.test.ts` |

### Decisões

- `game-vfx-three`: texturas de marca em branco quando não há `document` (senão o renderizador próprio não existe em Node) e nomes nas três malhas instanciadas. Mudança mínima, coberta pelos testes do pacote.
- `blastFrontSpeed` fica desligado por padrão e a sala não o liga: o desenho pede a opção, não a mudança de comportamento da sala.
- O pedido `crater` do mundo de efeitos já cava o campo de altura (o núcleo faz isso); a sala só redesenha o remendo a cada quadro quando a versão do campo muda.
- `explosionLight` saiu de `RendererOptions` (a luz é do mundo de efeitos). Estava sem uso em todo o repositório.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| testes dos pacotes afetados | `game-vfx` 163, `game-vfx-three` 59, `game-destruction` 101, `game-destruction-three` 52, `game-test-room` 128, `game-weapons-three` 162, `game-fluids-three` 11, todos passam |
| exemplos (`test-room`, `interactables-test-area`, `weapons-test-area`: build e teste, Playwright por `NODE_PATH`) | passam (`test-room` OK; furniture 12/12; weapons ok). Imagens e logs gerados não foram commitados |
| `pnpm -r test` inteiro (segundo plano) | ver abaixo |
| `docker build -f site/Dockerfile .` | exit 0 |

Modelo da execução: `sonnet`; nenhum portão falhou duas vezes, sem escalada.

## T5.2a–c — receitas da Oficina de VFX em `game-vfx`

Fonte: `sources/efeitos__oficina-vfx.js` (W168–1295) e a gravação `vfx-workshop.json` (54 execuções, 36 `pageId`; chuva, neblina, faróis e o filme dos fluidos ficam de fora: o filme é a T5.3).

- **T5.2a.** `src/workshop/` é o motor dos pools da página (sprites aditivo e normal em arrays tipados, riscos, detritos, decalques, anéis, luzes de clarão e de fogo, estado de tela, bolhas de lente, pós-processo `P0`, qualidade 0/1/2) com a ordem de sorteio da página. `src/effects/` guarda as receitas como **dados** (DSL de expressões e passos: `burst`, `spawn`, `emit`, `debris`, `decal`, `ring`, `flash`, `lens`, `screen`, `fire_light`, `cue`, `call`, `after`, `when`, `repeat`, `set`, `append`, `camera`, `post`, `behavior`), as macros (`blood_hit`, `impact`, `fire_emit`, `explode`, `muzzle`, `casing`, `chips`, `spark_at`, `rust_at`) e os adereços que a página anima à mão e que mexem em posições ou sorteios (andadores, rachaduras, blocos, placa, cilindro, carro). `EffectInstance` roda um efeito (timers do último ao primeiro, como a página), `EffectRunner` é a visão de um efeito por vez da bancada e `EffectPlayer` toca vários ao mesmo tempo, cada um com relógio, variáveis e adereços próprios, posição, direção (`anchor`/`heading` da receita), semente (LAN) e `follow`. `VfxWorld` ganhou `play`, `workshop()` e `effectIds()`; `patchEffects` ajusta o catálogo como `patchExplosions`.
- **T5.2b.** As 20 receitas restantes (destruição, veículos, mundo, tela), `data/event-effects.json` com `effectForEvent` e `src/effects/events.ts`, e os textos das fichas (`quando`, `visual`, `orçamento`, `rede`, rótulo do parâmetro) em `locales/en.ts` e `locales/pt-BR.ts` (o pt-BR é o texto da página, extraído por script; o en é tradução).
- **T5.2c.** O golden da Oficina sai de `specs/.../goldens/` para `packages/game-vfx/tests/fixtures/team-golden/` e `tests/workshop-golden.test.ts` o reproduz: para cada execução, a lista de spawns (quadro, tipo, contagem de sorteios, opções) igual à gravada, a contagem de tudo vivo em cada quadro e os hashes dos instantes. 162 asserções, todas passam. Cada receita foi escrita contra esse teste; o que a página sorteia sem querer entrou como dado (`cue(..., draws)` para os 4 `Math.random` por objeto do uuid do three r128 e o `FRESH` da primeira montagem de garrafa e granada).

### Decisões

- Os efeitos de evento (`stage_crack`, `breach_dust`, `collapse_dust`, `rebar_expose`, `glass_burst`, `impact_<material>`) **não são páginas da Oficina**: o desenho os cita com linhas da página, então cada um é uma fatia literal de uma receita já portada (mesmos números, centrada no ponto do evento) ou do ajudante `chips`/`rust_at`. Não têm golden próprio; o teste só confere que tocam e deixam algo vivo.
- O movimento de adereços que a página anima por quadro (a porta que cai, os blocos da parede, a placa que amassa) fica com o dono do objeto, que recebe os `cue` (`door_fall`, `slab_gone`, `glass_pane_gone`...). O motor só reproduz o que afeta onde e quando as partículas nascem.
- `world.play` sem `setCamera` com orientação usa a câmera na identidade para as receitas de tela (`forward(local)` devolve o vetor local).

### Perguntas para o dono

- `rebar_expose` o desenho descreve só como "poeira + lascas"; usei o ajudante `chips` (lascas e poeira, W849) mais `rust_at` (ferrugem, W899). Se o time tinha outra intenção, a receita é um arquivo de dados.
- `stage 1 -> stage_crack` e `collapse -> collapse_dust`: o desenho dá os nomes, as fatias são minhas escolhas entre as seções que a página tem (porta e desabamento). Confirmar.
