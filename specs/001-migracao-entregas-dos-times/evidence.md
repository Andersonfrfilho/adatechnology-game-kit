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
