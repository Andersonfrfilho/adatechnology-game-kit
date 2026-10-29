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
| 2b. Botijão P13 real | `world_propane_p13` usa o modelo `lpg_cylinder_13kg` (peça `tank`, 28 kg, 24 l de gás sob pressão); vazamento, tocha, casco que voa e fogo residual como dados em `explosives.json` (`leak`, `shell`); área `explosives_area` com cenários | `game-weapons-three/src/world-explosives.ts`, `explosives-*.ts`, `game-destruction` (`vent`/`seal`) |
| 3. Bancada | Camadas `muzzle_flash`, `casings`, `magazines`; controles `condition` (regra e materiais), `ammo_quality`, `sound_distance` (0 a 200 m); métricas `casings_live`, `magazines_live`, `heat` (máx. 100). Disparar, rajada e destravar seguem teclas | `area.ts`, `fx/layers.ts` |
| 4. Modelos dos arquétipos | Decidido: cada arquétipo veste o modelo da primeira marca (menor id) que o aponta **e atira do mesmo jeito**; corpo a corpo, arco e besta sem ponteiro ficam com o prop | `ARCHETYPE_MODELS` em `models/index.ts` |
| 5. Goldens por arma | 125 armas, 989 passos; cada arma: saque, trava, cada modo de tiro, vazio, recarga automática, completa e um a um, pane forçada e destravar | `game-weapons/tests/weapon-goldens.test.ts`, `tests/support/weapon-scenario.ts`, `tests/fixtures/rule-goldens/weapon-scenarios.json` (162 KB, uma linha por passo) |
| 6. Área, vitrine e miniatura | Texto de controles, `catalog.mjs` (121 armas, explosivos, reação em cadeia), miniatura regravada | `examples/weapons-test-area`, `site/catalog.mjs`, `site/thumbs/weapons-test-area.jpg` |

### Decisões

1. **Arquétipo só empresta modelo de quem atira do mesmo jeito.** Os lançadores (`rpg_7`, `m72_law`, `at4`, `carl_gustaf_m4`) têm `archetype: shotgun_pump_12` nos dados; pela regra "menor id" o `at4` daria um tubo de foguete à escopeta. A condição é `action.kind` igual ao do arquétipo. Resultado: 15 arquétipos com modelo (`pistol_9mm` → `beretta_92fs`, `pistol_45` → `colt_m1911`, `revolver_357` → `sw_686`, `revolver_38` → `taurus_82`, `smg_9mm` → `cz_scorpion_evo_3`, `shotgun_pump_12` → `cbc_pump_military_3_0`, `shotgun_semi_12` → `aa_12`, `shotgun_double_12` → `boito_double_barrel`, `barrett_m82a1` → `ak_47`, `rifle_5_56` → `ak_12`, `rifle_bolt_308` → `fn_scar_h`, `sniper_338` → `accuracy_awm`, `anti_materiel_50` → `barrett_m82a1`, `carbine_22` → `cbc_122`, `flamethrower` → `improvised_flamethrower`); `pistol_22` (nenhuma marca o aponta), o corpo a corpo, o arco, a besta, as ferramentas e os arremessáveis seguem com o prop. O comprimento do modelo é o da marca, não o do arquétipo.
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

## Costura das ramas T2.2c–e e T2.5 (correção de CI)

As duas ramas foram feitas sem se ver e os testes de `game-floorplan-structure` quebraram em 11 modelos. Nada foi inventado; o que o time entregou decidiu cada caso.

| Falha | Causa | Correção |
|---|---|---|
| `triage_tent`: `Unknown construction "canvas"` | a tenda (T2.5e) declara `construction: 'canvas'`; a T2.2c só resolvia `canvas` por `registerConstruction` | `constructionFor` resolve `canvas` pelo nome com o sistema de lona do VC3 (`campConstruction`: lona sobre postes de alumínio, estacas, lona de chão, sem paredes), uma tenda por cômodo `tent` (`tentsOf`; rótulo `tent_<tipo>_<n>` dá o tipo, senão túnel; altura = pé-direito do cômodo). Jogo que quiser tendas próprias registra `canvas` com `registerConstruction`. O teste de estrutura aceita lona sem parede. A galeria só desenha lona no fundo e num lado e uma divisória de 1,6 m: não há postes na cena, então a divisória segue como parede de cômodo do plano, fora da estrutura |
| 9 interiores comerciais + tenda: `plumbing.points` 0 | o teste exigia ponto em todo modelo, mas a regra do VC3 é um ponto por **peça molhada** (cozinha, lavatório, chuveiro, vaso, tanque, máquina) e as cenas da galeria dessas nove casas e da tenda não têm nenhuma (o posto e o mercado têm banheiro e continuam com pontos) | a expectativa ficou honesta por modelo: pontos == número de peças molhadas do plano, zero só em `NO_WET_FIXTURES` (lista fixa, conferida), maior que zero nos demais. Nenhum ponto falso; goldens do VC3 intactos (código de instalações não mudou) |
## Fase 3

Desenho: `design/T3-itens.md`. Execução em `sonnet` (o desenho recomendava `haiku` para a T3.0 e `sonnet` para a T3.1a; a ordem da orquestração foi dada sem troca de modelo).

### T3.0 — `Thumbnail`, helpers de registro e `cut-literal` (grupo A)

**O que entrou**
- `game-contracts`: `Thumbnail` (`{ svg?, render?: true | { yaw?, pitch?, distance?, wear?: 0|1|2 } }`) em `src/module.ts` e `TestableItem.thumbnail?`. Novo `src/registry.ts` com `mergeById`, `applyPatches`, `removeIds`, `deepMerge` e o tipo `DeepPartial`, movidos de `game-weapons/src/registry.ts:7-24` e `merge.ts`; exportados pelo index.
- `game-weapons`: `arsenal.ts` e `locale.ts` importam os helpers do contracts; `merge.ts` apagado; `registry.ts` ficou só com `resolveThrowables`. API pública igual: `DeepPartial` continua exportado por `export type { DeepPartial }` em `types.ts` (os helpers nunca foram exportados pelo index do weapons, então nada a reexportar).
- `game-interactables`: `ItemDef.thumbnail?: Thumbnail` (é o `BaseItemDef` do desenho) e dependência `@adatechnology/game-contracts` (`workspace:*`, só tipo; `pnpm-lock.yaml` atualizado). O Dockerfile já copia os dois manifestos.
- `cut-literal`: `tools/weapons-catalog/src/cut-literal.ts` foi com `git mv` para `tools/golden/src/cut-literal.ts` e é exportado pelo index do `@adatechnology/golden-tool` (`cutLiteral`, `evaluateLiteral`, `extractLiteral`). `extract-game/lab/gallery.ts` importam de lá; `golden-tool` é devDependency do `weapons-catalog` (o `tsup` o embute no CLI). Mensagens de erro agora começam com `golden-tool:`. Não havia teste do `cut-literal`; criado `tools/golden/tests/cut-literal.test.ts` (3 testes).

**Desvios do desenho e por quê**
- O `cut-literal` importa `node:vm`, e o `dist/index.global.js` do golden-tool é injetado na página pelo gravador: com o arquivo no mesmo bundle a página quebraria ao carregar (`__require("vm")` no topo). Por isso `tools/golden/src/browser.ts` (tudo menos o `cut-literal`) é a entrada do IIFE, e `src/index.ts` = `browser.ts` + `cut-literal`. Conferido: o IIFE novo não contém `vm`.
- Teste novo no contracts (`tests/registry.test.ts`, 4 testes) para os helpers que agora moram lá; antes só eram cobertos por `createArsenal`.
- A tarefa paralela das armas (branch `work/spec001-thumbs`) também põe `thumbnail` no `TestableItem`. Esta task usa o tipo `Thumbnail` do desenho; **a tarefa das armas adotará/mesclará este tipo** (ao rebasear, ficar com um só `Thumbnail` em `module.ts` e um só campo `TestableItem.thumbnail`).

**Changeset:** `.changeset/items-thumbnail-registry-helpers.md` (contracts minor, interactables minor, weapons patch).

**Portões (Node 24.22.0)**
## Fase 6 — grupo A

Desenho: `design/T6-som-e-clima.md`. Modelo da execução: `opus` (a pedido do orquestrador). Branch `feat/spec-001-fase-6`, a partir de `main`; nada foi enviado ao remoto.

### T6.0a — Contratos de som e clima

| O que | Onde |
|---|---|
| `SoundRequest`, `SoundHandle`, `LoopHandle`, `AudioListener`, `AudioSink` (`play`, `stop`, `loop?`, `setListener?`, `register?`) e `ModuleHost.audio?` | `game-contracts/src/audio.ts`, `module.ts` |
| `EnvironmentState` (10 campos), `EnvironmentBus` (`get`, `set`, `on`), `DEFAULT_ENVIRONMENT` (dia seco e calmo: mundo normal primeiro) e `ModuleHost.environment?` | `game-contracts/src/environment.ts`, `module.ts` |
| `createEnvironmentBus(initial?)`: o repositório de estado mínimo que implementa o barramento (a sala o usa na T6.3; testes e `game-weather` também). Escolha minha: o desenho dizia "a sala implementa", mas um contrato sem implementação de referência obriga cada consumidor a reescrever o mesmo repositório | `environment.ts` |
| Testes (6): padrão, mesclagem, só avisa o que mudou, silêncio sem mudança, descadastro durante o aviso, sink e host opcionais | `tests/audio-environment.test.ts` |

`game-contracts` 34 testes (eram 28). Changeset `t6-0a-contracts-audio-environment.md` (minor).

### T6.0b — Gravador de áudio, cortes literais e fixtures

| O que | Onde |
|---|---|
| `createAudioRecorder`: `AudioContext` falso que registra cada nó criado, propriedade e parâmetro (`value`, `setValueAtTime`, rampas, `setTargetAtTime`), conexão (a nó ou a parâmetro), `start`/`stop` e `close`; buffers viram uma soma FNV-1a por canal; números arredondados a 10 casas; `currentTime` começa em 0 (`setTime`, `clearEntries`). `diffAudioTrace` e `assertAudioTraceMatches` (tolerância 1e-9) | `tools/golden/src/audio-recorder.ts` |
| `cut-source.ts` (e o teste): o mesmo arquivo da `feat/spec-001-fase-4`, copiado sem mudança para os merges serem limpos; entrada ESM própria (`./cut-source`) | `tools/golden/src/cut-source.ts` |
| `team-audio.ts`: cortes literais de `jogo.js` (`audioInit`, `noise`, `sfx`, `loopSet`, `grito`, `voz`, `bichoSom`, `boom`, `chiado`, `buzina` e as três declarações) e da Cena de Arte (L1303-1372 mais `clamp`), rodados em `vm` com `Math.random` semeado e `Math.pow` portátil | `tools/golden/src/team-audio.ts`, `bin/record-audio.mjs` |
| Fixtures do jogo: 111 casos (12 classes a 0/10/60/120/160 m, classe desconhecida, os 4 sons contínuos em 3 níveis com a segunda chamada de suavização, `grito` a 5 distâncias, `voz` gemido/corredor/grito, 4 bichos a 4 distâncias, `boom`, `chiado`, `buzina`) | `tools/golden/fixtures/audio/game-audio.json` (170 KB) |
| Fixtures da Cena: 85 casos (a cadeia compressor + reverb + 3 laços, os 31 `sfx.*` em 3 posições, `shot` das 5 armas, `groan` dos 3 tipos) | `tools/golden/fixtures/audio/art-scene-audio.json` (461 KB) |
| **Trace do `createWeaponAudio` ATUAL**, gravado antes de qualquer mudança no som das armas (`git status` de `game-weapons-three/src` limpo na gravação): 3 casos (padrão semente 1, padrão semente 7 com relógio em 2,5 s, opções próprias com classe, curva e mecânico trocados), cada um com a cena de `audio.test.ts` L154-200 mais tiros de todas as classes (supressor, ambiente fechado, silêncio por distância), todos os sons de `MECHANICAL_SOUNDS`, as 12 classes mais as duas extras (`thump`, desconhecida) a 0/10/60/120 m, ajudantes de recarga, ciclo, `clink`, `thud`, volume, `dispose` e som depois dele | `packages/game-weapons-three/tests/fixtures/audio-trace.json` (681 KB; cerca de 3.200 entradas e 245 inícios de fonte por caso), `tests/audio-trace.test.ts`, `tests/support/audio-trace-scenario.ts` |

Notas:

- **Fixtures regravam byte a byte** nas duas versões do Node (22.23.4 e 24.22.0): `Math.random` do mulberry32, `Math.pow` portátil (`exp`/`log`), e a soma dos buffers em bytes do `Float32Array`. `Math.hypot` do `panFor` da Cena também bateu.
- **O corte de `jogo.js` por nome não basta**: `boom`, `AC` e `noiseBuf` existem também em outro lugar do arquivo (`boom` é efeito do mapa). O corte é o da função que usa `AC`, e as três declarações vão pelo texto exato da linha.
- **`AudioBuffer.length` é inteiro**: a Cena chama `createBuffer(2, sampleRate * 2.2, ...)` (105600,00000000001); o gravador trunca, como o navegador.
- **O trace do peso das armas** só muda de propósito: a T6.1e (adaptador sobre `game-audio`) tem de devolvê-lo idêntico (`audio-trace.test.ts` compara e também exige o texto igual); só a T6.1e2 (cliques da Cena) regrava, com `UPDATE_GOLDEN=1`.
- Regravar: `pnpm build && node tools/golden/bin/record-audio.mjs`; o trace das armas, `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-weapons-three exec vitest run tests/audio-trace.test.ts`.

### T6.2a — `game-weather` (núcleo puro)

Pacote novo `packages/game-weather` (`@adatechnology/game-weather`, versão 0.0.0 e changeset minor, que vira 0.1.0; ESM e IIFE `GameWeather`; Dockerfile com o manifesto; skill `game-weather`; linha no README raiz e na skill `game-kit`). Sem dependências de execução; `golden-tool` só como devDependency.

| Peça | O que é | Arquivo |
|---|---|---|
| 10 estados com `sources` por estado | `clear`, `overcast`, `light_rain`, `heavy_rain`, `storm`, `fog`, `windy` (números do jogo, Cena de Arte, Oficina de VFX e Galeria), mais `cyclone`, `typhoon` (33 e 50 m/s, rajada ×1,3, chuva de temporal, empurrão em destroços) e `extreme_heat` (sem fonte de time, Q3) | `src/data/states.json` |
| 2 climas | `temperate` (padrão, sem extremos) e `tropical` (extremos raros e ligados); os dois começam `clear` | `src/data/climates.json` |
| Escalonador | Cadeia de Markov com semente em tempo de jogo; permanência uniforme de 2 a 6 h; ordem de sorteio fixa (próximo estado, depois permanência); fluxo próprio `schedule` | `src/scheduler.ts`, `src/rng.ts` |
| Mistura | todos os 20 números do estado se misturam por `blendMinutes` (10 min de jogo); `force(id, segundos)` parte do ponto em que a mistura estava; `front` = `{ direction: [1, 0], progress }` (a cortina anda em +x, chega de oeste) | `src/blend.ts`, `src/weather.ts` |
| Relâmpago | fluxo próprio `lightning` (o servidor manda a semente); primeiro clarão 2 a 4 s depois de entrar no estado, depois 3,5 a 6 s; envelope duplo da Oficina (1 até 0,08 s, 0,2 até 0,16, 0,8 até 0,26, fim em 0,4 s); trovão `distância / 343` s depois; eventos `strike` e `thunder` | `src/lightning.ts` |
| Solo molhado | sobe 1/120 por segundo até o teto do estado e seca em linha reta, chegando a 0 exatos 180 s depois que a chuva para (a 90 s com calor intenso, `dryingScale` 2) | `src/wetness.ts` |
| Efeitos | `visibility`, `sightScale` (visibilidade / 220 × `1 − 0,4 × noite`), `hearingScale` (0,8, 0,6 e 0,5 na chuva leve, forte e temporal), `footstepScale`, `heatIndexC`, `heatStress`, `lightningReveal` 0,2 s, `dryingScale`, `debrisPush` | `src/effects.ts` |
| Calor | índice de Rothfusz da NOAA com os ajustes de umidade baixa e alta (só `+ - * /` e `sqrt`) e `heatStress` 0..1 nas faixas 27, 32, 41 e 54 °C | `src/heat.ts` |
| Dia e noite | fórmula do jogo L69128-69130 (`s`, `nightF`), dia de 20 min (`timeScale` 72), começa às 8 h | `src/daylight.ts` |
| Registro | `createWeatherRegistry({ states, climates, patch, remove })` e os verbos `register`, `patch`, `remove` em tempo de execução; estado removido sai do sorteio | `src/registry.ts` |
| Linha do tempo | `createTimeline({ seed, climate, hours })` passo de 1 min de jogo; JSON com mudanças, relâmpagos (tempo, distância, rumo) e amostra a cada 10 min | `src/weather.ts` |

Goldens: `tests/fixtures/timeline-{temperate,tropical}-seed{1,7,42}.json` (6 arquivos, 72 h cada, 115 a 129 KB), no formato do `golden-tool` (`GoldenRecord`, eventos `transition`, `strike`, `sample`), comparados por `assertMatchesGolden` e por texto idêntico. **Passam em Node 22.23.4 e 24.22.0.** Sementes e climas mostram de 0 a 75 relâmpagos em 72 h (`temperate` semente 7 e `tropical` semente 1 ficam sem tempestade). Regravar: `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-weather exec vitest run tests/timeline-golden.test.ts`.

Testes: 56 em 5 arquivos (dados com os números das fontes; escalonador: 2 a 6 h, só a cadeia do clima, semente repete, independente do tamanho do passo, relâmpago não desloca o calendário; mistura e `force`; relâmpago: só em estados com ele, 2 a 4 s e 3,5 a 6 s, trovão, fluxo próprio entre climas, envelope; solo; efeitos; calor contra a tabela da NOAA (±1,5 °F); dia e noite; registro).

### Escolhas minhas (padrões reversíveis; as perguntas do §7 já tinham padrão, estas são as que o desenho não fixou)

1. **Tempo**: o calendário e a mistura são em tempo **de jogo**; o solo (180 s), o relâmpago e `force(id, segundos)` são em segundos **reais** (a 72× um solo de 180 s de jogo secaria em 2,5 s reais). `advance(dt)` recebe segundos reais. Reverter: `setTimeScale(1)`.
2. **Hora inicial 8 h** (o jogo começa às 17 h 17, `dayT 0.72`; o mundo normal começa de manhã). `startHour`.
3. **Calor intenso como +6 °C sobre o clima** (38 °C ao meio-dia tropical, 30 °C à meia-noite) em vez de 38 °C fixos: assim todos os números se misturam do mesmo jeito. `temperatureDeltaC` do estado.
4. **Temperatura** = média do clima + oscilação × (2 × sol − 1) + delta do estado: `temperate` 16 ± 6 °C, `tropical` 29 ± 3 °C, umidade `tropical` +10 pontos.
5. **Vento de `overcast`** (0,35, 0,12) vem da Cena sem mudança de unidade (m/s no SDK); chuva leve/forte/temporal usam a inclinação da Oficina (0,3; 1,2; 4,5) como `windX` em m/s. Rajadas sem fonte: 0,6, 2, 6 m/s.
6. **Visibilidade** sem fonte: `overcast` 200, `light_rain` 160 (desenho), `storm` 100, `cyclone` 60, `typhoon` 40, `extreme_heat` 200. `sightScale` = visibilidade / 220 (a distância seca do jogo).
7. **`footstepScale`** (0,85, 0,7, 0,6 na chuva; 0,5 e 0,4 no ciclone e tufão; 0,9 no vento) e **`hearingScale`** do vento (0,85), do ciclone (0,3) e do tufão (0,25) são meus; `hearingScale` da chuva é a Q4.
8. **Teto de molhado** por estado: 0,35 chuva leve (desenho), 0,8 forte, 1 temporal, ciclone e tufão, 0,15 neblina; subida 120 s até o máximo.
9. **Relâmpago** cai entre 200 e 4.000 m, rumo uniforme de 0 a 360°; também em ciclone e tufão. O clarão `reveal` de 0,2 s é o texto da Oficina ("clareia por 0,2 s").
10. **`skyScale`**: `overcast` 0,9 e chuva forte 0,8 vêm das fontes; chuva leve 0,9, temporal 0,7, neblina 0,85, ciclone 0,6 e tufão 0,5 são meus.
11. **Cinza da neblina** (14/s) vem da Oficina (a neblina da página tem cinza); num mundo sem fogo, `patch` de `ashPerSecond` para 0.
12. **Divergência do desenho, a avisar**: o §7 Q11 diz que 2 a 6 h de jogo são "10 a 30 min reais com o dia de 20 min"; a 72× são 1,7 a 5 min reais. Para 10 a 30 min reais com este calendário, `timeScale` ≈ 12 ou `dwellHours` ×6 num clima próprio.
13. **`patch` mescla objetos mas não apaga chaves** (um peso em 0 impede uma mudança; `{}` não). Dito na skill.
14. **Pesos das cadeias** são meus (as fontes só dizem "muda a cada 2 a 6 h e chega de oeste"); `temperate` fica mais em limpo e nublado, `tropical` chega a ciclone só pela tempestade e a tufão só pelo ciclone.

### Portões do grupo A

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro) | exit 0; contracts 31, weapons 277, interactables 153, household 1907, golden 42, weapons-catalog 17, weapons-three 94, test-room 118, fleet 875 |
| `pnpm --filter @adatechnology/weapons-catalog-tool catalog:check` | up to date |

Node 22.23.4 (npm em pasta de rascunho): `tools/golden` 42, `game-weapons` 277, `game-contracts` 31, `tools/weapons-catalog` 17, `game-weapons-three` 94 passaram (os hashes de golden usam `installPortableMath`, sem mudança).

### T3.1a — Esqueleto do `game-items` (grupo A)

**O que entrou** (`packages/game-items`, `@adatechnology/game-items` 0.1.0 pelo changeset; sem three, sem conteúdo, sem lógica)
- Tipos do desenho (seção 2): `ItemDef extends BaseItemDef` (o `ItemDef` do interactables) com `category`, `tags`, `rarity`, `volume`, `durability`, `shelfLife`, `portions`, `cookable`, `nutrition`, `protection`, `carry`, `weapon`, `fluid`, `uses`, `finds`, `charge`, `agingFault`, `model` (e `thumbnail`, herdado). Vocabulários fechados `RARITIES` (6), `BODY_SLOTS` (7), `DURABILITY_KINDS` (12). Registros extensíveis: categorias (as 14 em inglês em `ITEM_CATEGORIES`), lugares (`PlaceDef`) e recipientes (`ContainerDef`).
- `createItems({ packs, patch, remove, include, categories, places, containers, rules })`, mesma ordem do `createArsenal` (pacotes por id, `patch`, `remove`, `include`) sobre `mergeById`/`applyPatches`/`removeIds`/`deepMerge` do contracts. Devolve `ItemsCatalog`: mapas `items`, `categories`, `places`, `containers`, `rules` e `has`, `get` (lança em id desconhecido), `list`, `byCategory`, `byPlace`, `byTag`. `volume` é derivado do `size` (litros) quando o pacote não dá. Tudo inconsistente sai num erro só (`checkItems`): categoria, raridade, lugar, tamanho, peso, validade, porções, durabilidade, proteção, carga, recipientes, regras e ids repetidos.
- `DEFAULT_RULES` (`ItemRules`): pesos de raridade 60/28/9/2,5/0,5/0 com `fixedOnly: ['unique']`; frescor 0,5/1/1,5; armazenamento (`StorageRule`: `multiplier`, `needsPower`, `limitDays`, `afterLimit`); carga `(8 + 2,5·FOR)·1,2` com `encumbered` 1 e `overloaded` 1,5; proteção teto 0,9, desgaste 8/3, rasgado 0,25, margem de conserto 10; `spawn.retailNew` (true) e `spawn.retailPlaces`. Todas por opção, mescladas com `deepMerge`.
- Pacote completo: `package.json`, `tsconfig`, `tsup` (ESM + IIFE `GameItems`), `vitest.config`, README, `.claude/skills/game-items/SKILL.md` (esqueleto declarado como tal), changeset `game-items-skeleton.md`, COPY do manifesto em `site/Dockerfile`, `pnpm-lock.yaml`.
- Testes (18): registro (vazio, ordem dos pacotes, volume derivado, `patch` aninhado e id inexistente, `remove` e `include`, índices, categorias/lugares/recipientes de pacote e de opção, regras mescladas, `get` desconhecido), validação (duplicados, todos os problemas de um item num erro, proteção/carga/lugar/recipiente, lugar não conferido sem registro, regras inconsistentes) e regras padrão.

**Desvios do desenho e escolhas reversíveis**
- **Multiplicadores de armazenamento:** o brief pedia valores PLACEHOLDER; como a tabela do HTML (L205–211) é curta, os 7 valores já vêm lidos à mão dela (geladeira 0,33 e freezer 0,1 só com energia, caixa térmica 0,5 por 2 dias e depois 1, bag 0,8, porão 0,66, ambiente 1, sol 2). Quem prova é o teste de fonte do `tools/items-catalog` (T3.1b/f); se divergir, muda aqui. Ids em inglês: `fridge`, `freezer`, `cooler`, `delivery_bag`, `cellar`, `ambient`, `hot`.
- **Lugares sem padrão:** nenhum lugar vem embutido (os 24 são conteúdo do `goods`); `finds.places` só é conferido quando algum lugar foi registrado. Categoria desconhecida, ao contrário, é erro (as 14 sempre existem).
- **`ContainerDef` provisório** (`categories` por peso e `count`): a T3.1e fixa os campos do sorteio. `ItemRules.spawn.retailPlaces` acompanha `retailNew` (decisão 1 da seção 6) porque a regra precisa saber quais lugares são prateleira/estoque; vazio por padrão, o `goods` preenche.
- **Limiares de carga:** nomes `encumbered`/`overloaded` (>100% corrida e fôlego −25%; >150% não corre) são interpretação dos textos do HTML; os efeitos ficam para a T3.1e.
- `unique` com peso 0 e `fixedOnly: ['unique']` (o sexto valor "só-fixo" do brief); `legendary` 0,5 entra no sorteio. Se o HTML disser que lendário também é só de ponto fixo, vira uma linha em `fixedOnly`.
- `game-items` depende de `game-contracts` e `game-interactables` (`workspace:*`); em T3.1a o interactables só dá o tipo base (o `fitsSize` entra na T3.1e).

**Portões da T3.1a (Node 24.22.0)**

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro) | exit 0; `game-items` 18 (2 arquivos) |
| `pnpm --filter @adatechnology/weapons-catalog-tool catalog:check` | up to date |

Node 22.23.4: `game-items` 18, `tools/golden` 42, `game-interactables` 153 passaram. Goldens (`golden-tool`, `game-weapons` team-golden e por arma) sem mudança nos dois Nodes; sem golden novo nesta task (o do `game-items` é da T3.1e). Modelo da execução: `sonnet`.

### T3.1b — `tools/items-catalog` (grupo B)

**O que entrou** (`@adatechnology/items-catalog-tool`, privado, copia o `tools/weapons-catalog`)
- Extratores: `extract-ite.ts` (`DATA` do ITE pelo `cutLiteral` do golden-tool), `extract-ite-html.ts` (tabela de armazenamento e 32 regras em prosa do HTML, cada uma com número de linha e citação exata), `extract-game.ts` (`ITENS`, `EXTRA`, `RAR_W`, `CONT_TAB`, `FIXOS`, `LOOT` e o texto de `useItem` como guarda), `extract-vc3.ts` (`CONTEUDO` L10824–10878 e `COMIDA_SUP`, avaliados num `vm` vazio), `base/household-items.sdk.json` (cópia byte a byte do `items.json` do household).
- `parse-durability.ts` (`dur` → `Durability` + `formatDurability` pt-BR inverso) e `parse-recipe.ts` (receitas → `{ inputs, tools, skill?, seconds, output }` + `formatRecipe` inverso; frases → ids por `decisions.json.recipeTerms`).
- `build.ts` com `--check` e `--game-out <dir>`; `cli.ts`; `paths.ts`; README; scripts `build`/`catalog`/`catalog:check`.
- `decisions.json` inicial (`{ value, source, reason }`, citação opcional): categorias (14 + 3 do jogo: `ammo`, `firearms`, `throwables`), lugares (24), raridades, regiões, 39 junções com o household, 16 ids em inglês (histórias genéricas + `notebook`→`laptop`), 12 `scope: 'game'`, tabelas de padrão (densidade, pilha, forma por categoria), `slotMap`, armazenamento (7, com citação de linha), contêineres, saque progressivo, 33 receitas, 9 habilidades, 80 frases de receita, 89 aliases do VC3, calibres e armas do `EXTRA`. `dimensions` vazio.
- Saída em `packages/game-items-goods/src/data/` (o diretório e um `package.json` privado mínimo; o pacote completo é a T3.1f): `items` (298), `categories` (17), `places` (24), `rarities` (6), `storage` (7), `recipes` (33), `containers` (17), `depletion` (6), `spawn`, `house-pools`, `ammo-boxes` (4 caixas, 3 armas, M67, molotov), `use-effects` (9), `melee` (20: alcance e ruído), `provenance`. Fatia do jogo (`--game-out`): `documents` (14), `regions` (10 regiões, 111 itens com região, 10 especialidades), `uses` (textos `uso`), `damage-points` (20), `fixed` (9), `faction-loot` (`LOOT`), `supply-events` (lançamento do Exército, trem, escala de luz, teto de 400 no chão).

**Contagens reais**
- ITE: 257 itens (245 no SDK, 12 `scope: 'game'`), 14 categorias, 24 lugares, 6 raridades, 33 receitas, 16 contêineres, 10 regiões, 10 especialidades, 111 itens com `reg`. `ITENS` do jogo: 146, todos no ITE com `kg`, `rar`, `cat`, `onde`, `f`, `s` e `uso` iguais (0 diferenças).
- Catálogo gerado: 298 itens = 245 do time + 53 do household sem par (92 − 39 juntados); ids: 39 do household por junção, 16 decididos, 190 ainda provisórios (slug do id do time), 53 do household. Tamanhos: 92 do household, 206 provisórios (cubo derivado de `kg` e densidade por categoria); `provenance.json` diz qual.
- Durabilidade: 115 textos distintos, ida e volta exata nos 257; 77 itens sem durabilidade (`—`), 18 com texto livre (`vida 500`, `ver Arsenal`, `10 m`: `kind: 'condition'` com as palavras em `per`, sem inventar quantidade).
- Receitas: 33 lidas e escritas de volta idênticas nos 5 campos; 3 saídas em item, 30 em efeito (o texto fica em `output.text`, `params` vazio); 18 termos sem item no catálogo, listados em `recipe.unresolved` (`fire`, `water`, `table`, `door`, `cabinet`, `garment`, `branch`, `barrel`, `ingredient`, `glass_jar`, `vegetable`, `broomstick`, `raffia_sack`, `soil`, `feather`, `stick`, `bread_mold`, `clean_glass`).
- Pools VC3: 25 recipientes (20 próprios e 5 que repartem o pool de outro), 89 tipos, 106 entradas; 86 resolvem para item, 20 ficam com `item: null` (`aliases` com `null`: sem item equivalente ainda).
- Contêineres: 16 do ITE, 9 deles com a tabela `CONT_TAB` (faixa e pesos), mais `counter` (`balcao`, só do jogo); `prateleira` (sem categorias no jogo) guarda o recuo por lugar (`categoriesByPlace`).

**Desvios do desenho e escolhas reversíveis**
- **`DEFAULT_RULES` do `game-items` mudou:** a página diz "Lendário e único nunca são sorteados" (L276), então `fixedOnly` é `['legendary', 'unique']` (era só `unique`; o peso 0,5 do lendário fica da tabela). Ajustados `rules.ts`, o teste e o SKILL; changeset `items-catalog-rules.md` (game-items patch). Os outros números (armazenamento, frescor, carga, proteção, pesos 60/28/9/2,5) batem com o HTML: o teste de fonte compara um a um.
- **Fontes de `v` nulo:** 8 itens (sal, açúcar, água, cachaça…) têm `v: null` no ITE: não estragam; ficam sem `shelfLife` e sem a etiqueta `perishable`.
- **Receitas:** `output` guarda `label` e `note` (palavras do original) para a ida e volta; `inputs[].label` e `tools[].label` idem. `tools` é uma lista de exigências (E entre elas, OU dentro de `anyOf`); "mãos" é `anyOf: []`. O desenho previa `params` nas saídas em efeito: ficou vazio, quem os preenche é a T3.1e/f.
- **Lendário/único e raridade sem peso:** `rarities.json` traz `isFixedOnly` (peso da tabela mais a marca).
- **Escolhas de negócio padrão (reversíveis, uma linha em `decisions.json`):** `slotMap` ("por cima" = tronco, braços, pernas; "corpo e cabeça" = tudo); `warmthScale` 10 (`cal` 0 a 9 → fração); `carryWheelsAt` 100 (`red` 100 = rodas); categoria do household (`hygiene`→medical, `cleaning`/`trash`→materials, `office`/`mail`→collectibles, `kitchen`/`tool`/`garage`→tools, `bbq`→outdoors); household sem raridade = `common`; "lugares remotos" do saque progressivo = mina, represa, pousada, igreja; carga e combustível: só pilha AA, bateria 9 V e gasolina recebem `charge`/`agingFault`.
- **`ammo`/`firearms`/`throwables`** entram em `categories.json` (as 14 do time não cobrem o `EXTRA` nem `CONT_TAB.guarda`/`gaveta` com `mun`); o pacote goods registra essas três.
- Guarda de deriva do `useItem`: cada efeito de `use-effects.json` carrega um trecho do código do jogo; o build falha se o trecho sumir.
- Fora desta task (ficam para a T3.1c/d/f): ids em inglês dos 190 provisórios, medidas reais, `weapon` dos 20 corpo a corpo (T3.1i), textos pt-BR/en, tipos do pacote goods.

**Portões (Node 24.22.0)**

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm -r test` (inteiro) | exit 0; `items-catalog` 24 (3 arquivos), `game-items` 18, `golden` 42, `game-weapons` 277, `weapons-catalog` 17 |
| `pnpm --filter @adatechnology/items-catalog-tool catalog:check` | up to date (também com `--game-out`) |
| `pnpm --filter @adatechnology/weapons-catalog-tool catalog:check` | up to date |

Node 22.23.4: `tools/items-catalog` 24, `game-items` 18, `tools/golden` 42 passaram. Sem golden novo (os hashes da T3.1k/T3.2b); nada do `game-weapons` mudou. Modelo da execução: `sonnet`.

### T3.1c — `decisions.json`: ids, junções, escopo, pilhas, aliases e termos de receita (grupo B)

**O que entrou** (tudo em `tools/items-catalog/decisions.json`; dados regenerados em `packages/game-items-goods/src/data/`)
- **Ids em inglês definitivos:** os 245 itens do SDK têm id snake_case (38 do household por junção, 207 por decisão); nenhum slug provisório sobra (`finalIdOf` agora falha se faltar decisão, e o tipo `IdSource` perdeu `provisional`). Os 12 itens `scope: 'game'` e os 2 extras só do jogo (`chave_casa_d`, `sinalizador`) também ganham id em inglês (`survivor_diary`, `military_map`, `evacuation_order`, `patient_zero_record`, `prisoner_files`, `mine_logbook`, `radio_tape`, `valley_postcard`, `npc_marked_item`, `bunker_code`, `cable_car_key`, `dam_badge`, `house_d_key`, `signal_flare`); a fatia do jogo usa esses ids.
- **Junções com o household: 39 propostas → 38 confirmadas.** Cada uma tem `reason` com a conferência (mesmo objeto; o id do household fica, valores do time vencem em peso, raridade, durabilidade e validade). **Corrigida:** `jaqueta_jeans`→`jacket` (a jaqueta jeans é um tipo de jaqueta; juntar faria a `jacket` genérica das tabelas do household virar jeans) agora é `denim_jacket`. Novo `mergeRejected` guarda 11 pares parecidos que ficam separados, com razão (`frigideira`/`pan`, `garrafa_pet`/`empty_bottle`, `sacola`/`plastic_bag`, `notebook`/`notebook`, `carne_bovina`/`frozen_meat`...), para ninguém propor de novo; teste confere que nenhum deles está em `merge`. Genéricos como `canned_food` ficam separados.
- **Categorias do household:** `householdCategoryMap` com razão por categoria (mesmo mapa da T3.1b, confirmado) e `householdItemCategory` (3 exceções por item: `phone_charger`→electronics, `ice_pack`→tools, `towel`→clothing).
- **Escopo:** 12 itens de história `scope: 'game'` (lista do pedido, confirmada); o SDK mantém as formas neutras (`safe_key`, `generator_key`, `cell_key`, `master_key`, `padlock_key`, `dog_tag`, `photo`, `note`, `city_map`, `road_map`, `cash`, `cigarettes`) e ganha `access_badge`, criado (o time só tem o crachá da represa, só do jogo).
- **Itens criados (`extraItems`, 28):** o motor não inventa item; o que as fontes não têm vira decisão com razão. Termos de receita: `branch`, `stick`, `feather`, `bread_mold`, `glass_jar`, `broomstick`, `barrel`. Tipos de pool do VC3 sem item: `insulin`, `leftover_meal`, `disinfectant`, `seasoning`, `stapler`, `remote_control`, `dvd`, `cable_bundle`, `shoe_polish`, `laundry_powder`, `broom`, `rubber_gloves`, `fabric_softener`, `clothespins`, `electrical_tape`, `full_trash_bag`, `food_packaging`, `wine_glass`. Dois aliases estavam errados e viraram itens: `livro` apontava para o livro de habilidade (raro) e `oculos` para o óculos de proteção; agora `book` e `eyeglasses`. `provenance.json` marca `created: true`.
- **Pools VC3:** os 20 `item: null` (18 tipos) agora resolvem; os 89 aliases foram revistos (ids finais, razão por alias; os aproximados dizem por quê). Teste exige `item` diferente de `null`.
- **Termos de receita (18 sem item → 0):** 7 viraram itens criados (acima); `saco de ráfia` já existia (`raffia_sack`, o item `saco_areia`); `legume` = `potatoes`/`cassava_root`/`tomato` (família); `vidro limpo` = `glass_jar` ou `glass_bottle`; `mesa`/`porta`/`armário`/`terra` = **coisa do mundo** (`world`, nunca carregada); `fogo` = estação do mundo em `tools[].world`; `água` = **fluido** (`fluid: 'water'`, em litros, id do `game-fluids`); `roupa` = qualquer item da categoria `clothing`; `ingredientes` = qualquer item `cookable` (`match`). O tipo `TermTarget` ganhou `items`, `fluid`, `world`, `match`; `RecipeInput` ganhou `fluid`, `world`, `match`; `RecipeTool.world`. `unresolved` fica `[]` em todas as receitas (teste novo) e a ida e volta pt-BR continua exata nas 33.
- **Pilhas:** `stackByCategory` revista com razão por categoria (medical 6, materials 8→4, demais mantidas) e `stackOverrides` (28 itens): pesados e volumosos 1 a 2 (`bricks`, `cement_bag`, `portable_generator`...), embalados por caixa/pacote (sementes 8, `nails`/`screws` 6, `wire_roll` 4). Juntados continuam com a pilha do household.

**Contagens:** 327 itens = 245 do time + 54 do household sem par (92 − 38) + 28 criados; ids: 38 `merge`, 235 `decision`, 54 `household`; receitas 33 (0 `unresolved`); pools 25 recipientes, 106 entradas, 0 `item: null`.

**Desvios do desenho e escolhas reversíveis:** (1) o desenho previa "~30 junções" e `access_badge` sem dizer de onde vinha: 38 junções, `access_badge` criado. (2) O desenho dizia 307 itens no SDK (~12 documentos no jogo): são 327, porque os 28 itens criados vêm da exigência de resolver pools e receitas. (3) Termos de receita que não são item são dado (`world`/`fluid`/`match`), não buraco: quem consome (T3.1e) trata cada um. (4) Opção reversível: cada item criado, cada exceção de categoria e cada override de pilha é uma linha; apagar a linha de `extraItems` exige trocar o alias/termo que a usa (o teste avisa).

**Portões (Node 24.22.0)**

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0 (ESLint: No issues found) |
| `items-catalog` testes | 27 (3 arquivos; eram 24) |
| `game-items` 18, `golden-tool` 42 | verdes |
| `catalog:check` | up to date |

Node 22.23.4: `tools/items-catalog` 27, `game-items` 18, `tools/golden` 42, `catalog:check` up to date. Sem golden novo (os hashes da T3.1k/T3.2b). Modelo da execução: `sonnet` (o pedido recomendava `haiku`; houve decisões de modelagem: extras, termos de receita).

### T3.1d — Medidas reais (`decisions.json.dimensions`) e teste de densidade (grupo B)

**O que entrou**
- `decisions.json.dimensions`: uma entrada por item do catálogo (327) mais `survivor_diary` (o modelo `diario` é do jogo): `{ value: [largura, altura, profundidade] em metros, source, reason, material, modelScaleRef? }`. Fontes: `household` 84 (54 sem par + 30 juntados que ficam com a medida do household), `REF` 208 (medida real razoável do tipo de objeto, com a descrição e as medidas em mm na `reason`), `model` 23 (os modelados do SDK; mais o `diario`), `derived` 12 (cópia de outro item: garrafa de 500 ml, lata de 350 ml, litro de combustível, caixa de comprimidos...). Substitui os 206 tamanhos provisórios derivados de kg: `provisionalSize`, `densityByCategory` e `SizeSource 'provisional'` saíram; item sem medida **derruba o build**.
- **Os 24 modelados:** os construtores do ITE (L144-168) foram avaliados com `three@0.128.0` (como o golden) e a caixa de cada um medida (`Box3.setFromObject`, nas unidades da página). O tamanho é essa caixa × **uma escala**, tirada de uma medida real de um eixo (`modelScaleRef`: `teamId`, `teamBox`, `axis`, `meters`, `scale`), preservando as proporções do time. Ex.: garrafa de 500 ml = diâmetro 66 mm → 66 x 183 x 66 mm; pé de cabra = 750 mm (30 pol); botijão P13 = 490 mm; galão de 20 L = 470 mm (30,8 x 47 x 15,4 cm); pilha AA = 50,5 mm; martelo = 330 mm; facão = 550 mm; lata = diâmetro 80 mm (a lata do time é achatada, diâmetro maior que a altura: com 73 mm ficaria 62 mm de altura e mais densa que a água; com a altura de 113 mm do exemplo do pedido ficaria 4x o volume de um feijão de 450 g). `diario` (21 cm) fica na tabela para a T3.2b, mas é item do jogo.
- **Teste de densidade** (`tests/density.test.ts`): kg por litro da caixa dentro de uma faixa por material (14 materiais: `liquid`, `food`, `paper`, `cloth`, `wood`, `metal_solid`, `metal_tool`, `long`, `stone`, `glass`, `plastic`, `electronic`, `battery`, `hollow`); `hollow` é a lista explícita de 45 itens ocos ou cheios de ar (embalagens, bolsas, capacetes, balde, tábua em leque...), cada um com razão. Também testa que cada lado fica entre 1 mm e 2 m e que um dedo escorregado (×10 ou ÷10 num lado) sai da faixa em 80% dos itens (medido: 0,80; as faixas são largas de propósito, o teste pega ordem de grandeza e não arredondamento). `tests/dimensions.test.ts`: uma medida por item (nada além do `diario`), `items.json` = decisão, `sizeSource` = fonte, `household` = valor do household, e os 24 modelados = caixa × escala em 1%, com `teamId` iguais aos 24 `MODELS` lidos do ITE (a conferência de 2% contra o `models.json` é da T3.2b).
- **Pilha:** nenhuma mudança (valor do household nos juntados, senão padrão por categoria e `stackOverrides`, da T3.1c).

**Desvios do desenho e escolhas reversíveis**
- **Juntado e modelado ao mesmo tempo (7 itens):** o pedido diz que juntados herdam o tamanho do household, mas os 24 modelados são dimensionados pela caixa do time, e um item não pode ter duas caixas (o teste da T3.2b compara caixa × escala com o `size`). **Padrão adotado: o modelo vence** nos 7 (`water_bottle`, `rice`, `first_aid_kit`, `bandage`, `hammer`, `flashlight`, `batteries`); a `reason` guarda o valor antigo do household. Reverter um deles = apagar a entrada de `dimensions` e pôr `source: 'household'` (e tirar o item do `models.json` na T3.2b). Antes → depois (m): `water_bottle` 0,07x0,28x0,07 → 0,066x0,183x0,066; `rice` 0,1x0,2x0,06 → 0,171x0,25x0,071; `first_aid_kit` 0,25x0,09x0,17 → 0,25x0,214x0,096; `bandage` 0,1x0,03x0,05 → 0,101x0,078x0,044; `hammer` 0,3x0,03x0,1 (deitado) → 0,159x0,33x0,047 (em pé); `flashlight` 0,04x0,04x0,16 → 0,056x0,16x0,056; `batteries` 0,06x0,02x0,05 → 0,037x0,051x0,017. **A T3.1g precisa avisar o household**: as alturas e a orientação mudam nesses 7.
- **Erro achado pelo teste no household:** `juice_box` (0,07 x 0,2 x 0,07 = 1 L) contradiz o peso do time (0,2 kg, caixinha de 200 ml). Peso do time vence, então a medida passou a REF 52 x 100 x 37 mm (`source: 'REF'`, `reason` explica). Mudança de medida do household, também para a T3.1g.
- **Orientação:** `size` está no quadro do próprio item: modelados na pose do modelo (y para cima, ferramentas longas em pé), os demais na pose de repouso (y para cima, ferramentas longas deitadas ao longo de x, como o household). A T3.2 desenha pelo `size`, então as duas convivem.
- **Roupas** medidas dobradas (como `tshirt` e `jeans` do household); sacos e mochilas vazios. Padrões reversíveis: cada medida é uma linha.
- **Ajustes de dado achados pelo teste, nos itens criados:** `stick` pesa 20 g (eram 50 g para um galho de 12 mm); faixa `hollow` começa em 0,004 kg/L (o saco plástico do household pesa 20 g em 4 L).
- **Contagem:** o pedido falava em 298 itens; são 327 porque a T3.1c criou 28 itens e desfez uma junção (ver T3.1c).

**Portões (Node 24.22.0)**
## Fase 4 — grupo A

Tarefas T4.0 (só o que não toca o `game-items`), T4.1a, T4.1b e T4.1c do desenho `design/T4-personagens-e-animais.md`. Branch `feat/spec-001-fase-4`, a partir da `main`. Nada foi enviado ao remoto.

### T4.0 — contratos do corpo vivo

| Mudança | Onde | Teste |
|---|---|---|
| `BodySlot`, `SegmentKind`, `BodyRegion`, `MISSING_BITS` (os dez bits que o shader lê) | `packages/game-contracts/src/body.ts` | `contracts.test.ts`: os valores 1, 2, 4 ... 512 |
| `Hit.mass` (g), `Hit.cut` (0..1), `Hit.part` | `destruction.ts` | tipos |
| Evento `body` (`change`, `cause`, `below`, `exit`) e `ObjectState.body` | `destruction.ts`; `game-destruction/src/locale.ts` ganhou o rótulo em `en` e `pt-BR` (o `Record` do evento exige) | `pnpm -r typecheck` |
| `Shot.mass` e `shotToHit` copia | `weapons.ts`; `game-weapons/src/weapon-firearm.ts` preenche `bulletGrams` (do chumbo na espingarda) | `contracts.test.ts`, `game-weapons/tests/weapons.test.ts` |

**Pendente da Fase 3** (o `game-items` está em outra branch e não foi tocado): `protection.ballistic` (`{ resistance, blunt, pass?, consumable? }`) e o reexport de `BodySlot` em `game-items`. Os ids de proteção que os presets citam (`vest_police`, `vest_military`, `helmet_combat`, `turnout_gear`) são os que o `game-items` deve receber.

### T4.1a — `tools/characters-catalog`

Lê o jogo, o Bestiário, o Elenco, os Retratos, Os Vivos do Vale, o corpo da Galeria do Arsenal e a Bancada de Hordas; escreve (cada arquivo com a origem do número em `decisions.json`, `{ value, source, reason }`):

- `packages/game-characters-undead/src/data/{types,ages,outfits,infection,moments}.json`;
- `packages/game-characters/src/presets/{team-game,physical}.json` e `src/data/{body,segments,gait,appearance}.json`;
- `--game-out`: `specs/001-migracao-entregas-dos-times/game-slice/characters/` com README (vai para o repositório zombiada): 44 pessoas, 18 grupos, relações, 47 eventos, 7 facções com o 7º BIS, simulação de vida, tabela de pontos, `ZONES` e os NPCs do quarteirão (Cícero e Sandra).

As pastas dos pacotes são escritas antes de os pacotes existirem (o `package.json` vem nas tasks seguintes). `catalog:check` e o `catalog:check` da fatia passam; o teste `catalog-up-to-date` é o mesmo.

**Calibração P7** (`tests/calibration.test.ts`, contra os calibres do `game-weapons`, fórmula refeita no teste sem usar o código da ferramenta):

| Calibre | Força P | Corpos | Alvo | Energia que fica no 1º corpo | Bestiário |
|---|---|---|---|---|---|
| 9×19 | 7,67 | 2 | 2 | 0,51 | 0,50 |
| 5,56×45 | 16,56 | 3 | 3 | 0,69 | 0,65 |
| .308 (7,62×51) | 26,67 | 4 | 4 | 0,78 | 0,75 |
| 7,62×39 | 18,52 | 3 | 3 (PEN 3,0 do jogo) | 0,71 | — |
| 00 buck (chumbo) | 4,35 | 1 | 1 (PEN 0,5 do jogo) | 0,37 | — |

Contagens exatas, energia dentro de ±0,05. O preset `team-game` (PEN do jogo, custo 0,7 / 1 / 2 / 0,5, 75% por corpo) cruza 2, 1, 3 e 4 corpos, igual. Pontos padrão `3,5·E^0,37`: 35 (9×19), 59 (7,62×39) e **71,7** (.308): o desenho diz 71, arredondado para baixo; o teste aceita o valor real.

**Divergências entre as fontes que o catálogo registra** (o teste lista cada uma):

| Assunto | Fonte A | Fonte B | O que o catálogo adota |
|---|---|---|---|
| Cor do olho do Devorador | página v0.1 `#b0103a` | jogo v17 `0xB0122A` | v17 (P4); é a única diferença entre a página e o jogo |
| Multiplicadores do Devorador | página 1,0·1,0·1,0 | jogo 1·0,9·0,9 | jogo |
| Sangue por idade | Bestiário 100 / 70 / 35 / 10% | jogo 1 / 0,6 / 0,25 / 0 | jogo (velocidade, vida e dano de membro dos dois são iguais) |

### T4.1b — `tools/animals-catalog`

Lê `SPECIES`, `SPEC` (a página põe funções e texturas de canvas dentro do dado: viram `hasExtraBuilder` e marcadores `{ kind: 'spots' | 'stripes' }`), `GAIT`, `ORDER`, `ZONES` e `TER`. Escreve `packages/game-animals/src/data/gaits.json`, `packages/game-animals-species/src/data/species.json` (13 espécies; desfecho `turns` 6, `dies` 3, `immune` 4; surto como dado; alcance do som) e, com `--game-out`, `game-slice/animals/` com README (textos do Vale, zonas, terreno). Cada número da regra de infecção e do som tem na `decisions.json` o trecho da fonte que o prova, e o teste confere o trecho.

### T4.1c — goldens gravados

Gravados do código do próprio time (mecanismo da seção 3 do desenho): a lógica pura é cortada de `jogo.js` com `cut-source` (novo em `@adatechnology/golden-tool/cut-source`) e roda em `node:vm` com o RNG semeado por personagem; as cenas rodam no Chrome (`record.mjs`) na página do time com um trecho que expõe o fechamento (`writePatchedPage`), ou, para código do jogo, numa página em branco com o `three.module.js` r160 do próprio jogo (idêntico ao `three@0.160.1` do repositório). Os fixtures ficam onde os pacotes vão lê-los, `packages/<pacote>/tests/fixtures/team-golden/` (as pastas existem antes dos pacotes).

| Golden | Fixture | Como | Eventos / cenas |
|---|---|---|---|
| G-spawn | `game-characters-undead/game-spawn.json` | vm, `zSpawn` real | 650 spawns (13 tipos × sementes 1 a 50) + 200 sorteios de tipo |
| G-damage-regions | `game-characters/game-damage-regions.json` | vm, `zDamage` real, efeitos e `zKill` em stub | 18 sequências (capacete + 9 mm, colete + 7,62, perna até mancar e rastejar, 12 ga a 3 m na cabeça, corte do braço...) + 20 sorteios de mandíbula |
| G-penetration | `game-characters/game-penetration.json` | vm, `shootRay` + `zDamage` reais; mundo e lista de corpos em stub | 10 linhas de 5 corpos: os 4 calibres contra 5 lentos, brutamonte na frente e em segundo, tipos mistos, membros, cabeças e alvos longe |
| G-gait (puro) | `game-characters/game-walk-gait.json` | vm, `walkCad`, `walkGait` | 100 pontos (0 a 6 m/s, 4 alturas) |
| G-instanced (fonte) | `game-characters-three/game-body-chunk.json` | vm, `bodyChunk` | sha256 do trecho de shader |
| G-damage-segments | `game-characters/arsenal-damage-segments.json` | Chrome, Galeria do Arsenal | 214 eventos: 11 segmentos × 4 armas (com e sem ponto de impacto) e a granada a 0,5 a 2 m |
| G-cut-hierarchy | `game-characters/elenco-cut-hierarchy.json` | Chrome, Elenco | 225 eventos: 6 armas × 13 segmentos |
| G-body | `game-characters-three/game-best-body.json` | Chrome, r160 | 780 cenas (13 tipos × decay 0 a 3 × sementes 1 a 5 × LOD 1, 0,5, 0,28) e 60 `bakeBody` das variantes ZVAR |
| G-instanced | `game-characters-three/game-instanced-body.json` | Chrome, r160 | `buildBody(16/10/5)`: 6048 / 2856 / 1485 vértices |
| G-people | `game-characters-three/portraits-people.json` | Chrome, Retratos | 44 cenas (só o hash) |
| G-gait (rig) | `game-characters-three/bestiary-gait.json` | Chrome, Bestiário | 117 poses (13 tipos × t = 0 a 2 s) |
| G-animals | `game-animals-three/animals-page.json` | Chrome, Bichos do Vale | 65 cenas (13 espécies × vivo, mordido, andar, trote, galope) |
| G-animals (pele) | `game-props3d/game-animal-skin.json` | Chrome, r160 | 26 peles de GPU (13 espécies, sã e mordida) |

**Regravados duas vezes, byte a byte iguais**: `golden:vm:check` (cada vm golden duas vezes no mesmo processo e contra o fixture) e `golden:chrome:check` (cada captura do Chrome duas vezes em pasta de rascunho, comparadas entre si e com o fixture): todos iguais. Os vm goldens também passam no teste do pacote em **Node 22 e Node 24**, e `catalog:check` nos dois.

**Para quem compara depois** (T4.1d a T4.1i): o RNG de cada golden. G-spawn: fluxo `createSeededRandom(semente)` por personagem, semente = 1 a 50 (e 1 a 200 no sorteio de tipo); G-damage-regions: a semente de cada sequência está no evento `start`; G-penetration: semente 1 por linha; G-damage-segments: `Math.random = createSeededRandom(semente × 100000 + n)`, `n` crescendo na ordem das capturas; G-cut-hierarchy: o mesmo esquema, um sorteio por golpe. O hash de vetores é FNV-1a 32 sobre `round(valor × 1e4)` (declarado no primeiro evento de cada golden que o usa).

**Desvios e limites assumidos**

- **Orçamento de triângulos** (a 1000 corpos, T4.4a): o `buildBody` do jogo tem 2016 / 952 / 495 triângulos nos três LODs e o corpo do Bestiário assado 9014 no LOD 0, acima do orçamento 2500 / 800 / 250 que o desenho tira da Bancada. O teste de orçamento de T4.4a precisa de decisão do dono (medir o que o jogo tem, ou reduzir os LODs).
- **Mandíbula**: no jogo só se chega ao `miss |= 512` com golpe de cabeça não letal acima de 25; nenhum projétil faz isso (o crânio morre a partir de 20). A sequência `jaw_roll_*` é sintética (12 ga a 12 m com dano 30) para gravar a regra e o sorteio de 30%.
- **`zKill` em stub e `corpseAdd` fora**: o jogo remove o zumbi (e `corpseAdd` sorteia mais um `R()`); o golden deixa o corpo no lugar, então o fluxo de sorteios depois de uma morte não é o do jogo (as sequências terminam na morte).
- **`ZVAR_OF`** do G-spawn usa a própria expressão `nv` do bloco ZVAR cortada do jogo; o bloco inteiro precisa de WebGL para assar os corpos.
- **MOVES do Elenco** (mistura contínua) fica só como dado (`gait.json`): a mistura roda no `tick` da página, preso ao relógio dela. O golden de passada do rig é do Bestiário (`animate0`, sem sorteio).
- **G-body** e as páginas r128 (Bestiário, Elenco, Retratos, Arsenal, Bichos) gravam com three r128 (cor sem conversão sRGB); o que vem do jogo grava com r160, a mesma versão do SDK. Os desvios r128 contra r160 que o porte vir a ter entram em `KNOWN_DEVIATIONS`.
- **`record.mjs`** (ferramenta de golden): uma resposta do CDP que chegava depois de o Chrome parar deixava o processo vivo por 30 s e terminava com erro mesmo com o golden gravado; agora a resposta tardia é ignorada e o processo sai ao fim.
- **`tools/golden`** ganhou dois módulos de Node, fora do bundle da página: `cut-source` (corta e roda código do time em `vm`) e `record-page` (copia a página com o trecho que a expõe e chama o gravador). Os testes de `cut-source` estão em `tools/golden/tests/cut-source.test.ts`.
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

O contrato manda detritos, fogo de contato, gotas e vazamentos para `vfx.burst`/`vfx.spawn` (`SpriteKind`) e apagar `particles.ts`. Na T5.1b/d o `VfxWorld` ainda não tinha esse pool; ele entrou com a T5.2a (a bancada de receitas) e a T5.1f foi **fechada depois dela**, na ordem dos commits desta branch:

- **`game-vfx`**: `src/sprites/` (`SpriteKindPool`, `SpriteKindSystem`, `SPRITE_KINDS`, `patchSpriteKinds`) e `data/sprite-kinds.json` com os 14 tipos do `particles.ts` **com os números iguais** (a conta do `burst`, do chão e da vida é a mesma, com o mesmo gerador mulberry32). `VfxWorld` ganhou `burst`, `spawn`, `onLand(owner, ...)` (quem escuta onde a gota caiu, por dono, para um mundo compartilhado entre renderizadores), `sprites()`, a opção `sprites: { capacity, density, kinds }` e `push` agora empurra também os sprites.
- **`game-vfx-three`**: `shaders/sprite.ts` (o shader de pontos, movido sem mudar) e `createSpriteLayer`: duas camadas `vfx-sprites-additive` e `vfx-sprites`, antes do grupo de marcas. Opção `pointScale`.
- **`game-destruction-three`**: `particles.ts` apagado; detritos, faíscas, cinzas, vapor, gotas e vazamentos vão para `vfx.burst/spawn`; `ParticleKind` é alias de `SpriteKind`; as gotas que caem avisam o próprio renderizador (dono `destruction-<n>`). Eventos da Fase 2 por `RendererOptions.eventEffects` (padrão `EVENT_EFFECTS_MAP`): `spall` toca `impact_<material>` (pelas tags `metal`, `glass`, `wood`; o resto é `concrete`), `stage` toca o efeito do estágio (o 2 **troca** o puff de poeira que já havia, que continua como reserva quando não há efeito), `expose` toca `rebar_expose`, `collapse` toca `collapse_dust`. Os efeitos de oficina só aparecem na tela com os desenhistas da T5.2d.
- O que sobra do pool antigo de fluidos e de armas continua descrito abaixo (T5.1g).

**T5.1g.**

- **`game-fluids-three`**: `particles.ts` (`ParticlePool`) apagado; `sprites.ts` (`FluidSprites`) faz as gotas do respingo e o vapor com os tipos `drips` e `steam` do mundo de efeitos (`options.vfx`; sem ele o renderizador cria o seu e o passa em `update`). Duas opções de `SpriteSpawnOptions` nasceram para isso e valem para qualquer jogo: `floor` (a altura onde a gota para, em vez do chão) e `rise` (multiplicador da subida do vapor). As gotas e o vapor mudam de números (tamanho, vida e subida são o tipo escalado para os valores antigos), não de comportamento.
- **`game-weapons-three`**: o clarão do viewmodel e a fumaça da Galeria **ficam** (goldens da T1.3). Para tiro visto de fora, `HostEvent` `shot` ganhou `origin` e `direction` opcionais; com `origin`, o módulo toca pelo `host.effects` o clarão do cano e a cápsula (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, fatias literais de `muzzle`/`casing` da Oficina em `game-vfx`) escolhidos pelo tipo de cápsula do calibre (`data/world-effects.json`, configurável por `createWorldEffects({ ids })`). Sem `origin` (o tiro em primeira pessoa) nada é tocado, então nada dobra.
- **`game-vfx-three`**: `play` do `EffectSink` cai para as receitas da Oficina quando o id não é uma explosão (com `param` por índice ou id) e o catálogo lista os dois.
- **`game-test-room`**: o filme e as gotas de fluidos usam o mundo único da sala (`vfx: vfx.world`) e o `pointScale` da sala vai para a camada de sprites; `host.effects` já era emprestado na T5.1e.
- **Pendências para a T5.2d**: nenhum desenhista de pools da Oficina ainda existe em `game-vfx-three`, então `play` de receitas toca no motor (`world.workshop()`) mas só aparece na tela depois dela. A fumaça `muzzle_smoke` da Galeria não foi trocada (o hash do golden T1.3 inclui a fumaça).

### Perguntas para o dono

- Não há `HostEvent` de acerto (`hit`) com ponto, normal e material, então `impact_<material>`, `penetration` e a sangria por idade não têm de onde sair no módulo de armas. Criar o evento `hit` no contrato (quem emite é o hospedeiro que faz o raio) ou deixar o jogo tocar `impact_*` pelo `host.effects`?

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
| `pnpm -r test` (inteiro) | exit 0; `items-catalog` 35 (5 arquivos), `game-items` 18, `golden` 42, `game-weapons` 277, `game-interactables-household` 1907 |
| `catalog:check` (items e weapons, também com `--game-out`) | up to date |

Node 22.23.4: `tools/items-catalog` 35, `game-items` 18, `tools/golden` 42, `catalog:check` up to date. Sem golden novo (os hashes da T3.1k/T3.2b); o teste de densidade falhou **0 vezes** depois de os 7 desvios acima serem tratados na tabela (a primeira rodada de rascunho tinha 7 itens fora da faixa; nenhum gate falhou 2x). Modelo da execução: `sonnet` (o pedido recomendava `haiku` com escalada para `sonnet`; as medidas exigiram escolha por objeto).

### T3.1e — Motor do `game-items`: envelhecimento, carga, proteção, uso, receitas, achados e ponte do arsenal (grupo C)

**O que entrou** (`packages/game-items`, três commits isolados: `17a8b74` envelhecimento/carga/proteção/uso/receitas, `15aa34d` achados, este com `itemsFromArsenal` e a documentação)
- `decay.ts`: `advanceAge` (`ageDays += (now - since) x multiplicador`, preguiçoso e puro), `moveToStorage`, `storageMultiplier`, `freshness` (fresh/stale/spoiled/rotten em 0,5/1/1,5), freezer sem luz vira fresco com 2 dias de prazo, caixa térmica x0,5 por 2 dias (contado desde a entrada) depois x1, `chargeLevel` (-10%/mês), `failsToStart` (gasolina > 180 d falha 10%).
- `protection.ts` (`1-PROD(1-b·c)`, teto 90%, -8/-3, rasgado 25%, conserto até 100-10), `carry.ts` (`(8+2,5·FOR)·1,2`, 100%/150%, vagas e peso), `use-effect.ts` (`resolveUse` puro sobre `use-effects.json`; comida passada/estragada/podre e cozida como regras `rules.use`), `recipes.ts` (`canCraft`/`craft`; habilidade e `unlockedBy` só se o host passa `skills`/`unlocked`; saída em efeito é do host).
- `finds/`: `category-roll.ts` (porte do `rollItems`), `explicit-pool.ts` (porte do `sorteiaConteudo`), `depletion.ts` (`max(piso, 1-queda·dias)`, nada no dia 0), `spawn-state.ts` (idade = dias de surto + U(0;0,6)·validade, condição por raridade, loja nova no dia 0, carga, enchimento), `provider.ts` (`createFindsProvider`, `findsFor` igual à forma do `FindsProvider` da planta, lida de `feat/spec-001-fase-2`), `place-finds.ts` (`fitsSize`), `loot-tables.ts` (`toLootTables`).
- `arsenal-items.ts`: `itemsFromArsenal(arsenal, { records })`: `ammo_<calibre>` (28), `firearm_<id>`, `throwable_<id>` a partir de `mass` e `dimensions.length`; caixa do jogo vem de `ammo-boxes.json` (`records`), o resto é estimado (REF). Estrutural (`ArsenalLike`); `game-weapons` só como devDependency de teste.
- Registro: `ItemPack`/`createItems` ganharam `pools`, `poolAliases`, `useEffects`, `recipes`; `ContainerDef` fixou `count`, `categories`, `categoriesByPlace`, `places`. `DEFAULT_RULES` ganhou `aging`, `inventory`, `use`, `spawn.*`, `finds.*` (os números de `depletion.json` e `spawn.json`, provados por teste de integração que lê o JSON do goods).

**Ordem de sorteio (contrato dos goldens G-b e G-c, T3.1k), documentada no código**
- `rollByCategory`: 1 para a contagem; por pilha 1 para a categoria e 1 para o item (nenhuma se a categoria não tem o que sortear). O estado (idade, condição...) é sorteado depois de todas as escolhas.
- `rollExplicitPool`: 1 (contagem `base`); abandonada +1; ordem ponderada completa (1 por entrada, antes do corte); 1 por entrada mantida (quantidade); só abandonada e vazia +1 (lixo).

**Desvios e escolhas reversíveis**
- Planta: não registrei nada no `game-floorplan` (T3.1h pulada); **a ligação na planta fica pendente** (`registerFindsProvider`, `TemplateDef.place`). O stub só existe em `feat/spec-001-fase-2`; repliquei `FindsQuery`/`FindStack`/`FindsProvider { findsFor }` estruturalmente.
- `createFindsProvider({ pools: 'team' })` usa os pools registrados no catálogo (`ItemPack.pools`), não dados embutidos (o motor não tem conteúdo).
- `rollByCategory` não rola `legendary`/`unique` (página do time, L276) nem `rules.finds.rollExcluded` (`ammo_7_62x39`, que o jogo exclui); o jogo daria peso 1 aos de raridade só-fixo. A ordem dos itens do goods pode diferir da do ITE: o G-b deve comparar por ids.
- Contagem escalada por dia/região depois de sorteada (dia 0 = jogo). Item removido do catálogo some dos achados depois do sorteio.
- `ItemRules.storage/carry/protection` não mudaram de forma (teste de fonte do items-catalog compara por `toEqual`); o que é novo foi para `aging`, `inventory`, `use`.
- Condição vai de 0 a 100 e conserto até 90 (`dur` de condição não é lido como máximo). `carry.capacityKg` de bolsa vira vagas (`cap` do jogo). Saciedade -30% vale também para estragada; podre não se come. `very_rare`/`legendary`/`unique` usam a faixa de condição 50–100. Lojas do dia 0: `retailPlaces` e `retailContainers` com os lugares/recipientes de loja do time.
- Sem golden G-b/G-c nesta task.

**Portões (Node 24.22.0)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` exit 0; `pnpm -r test` verde (`game-items` 139 em 13 arquivos, eram 18; `items-catalog` 35); `catalog:check` de items e weapons up to date. **Node 22.23.4**: `game-items` 139, `tools/items-catalog` 35, `tools/golden` 42 passaram. Nenhum gate falhou 2x. Modelo da execução: `sonnet`.

### T3.1f — Pacote `game-items-goods` (grupo B/C)

**O que entrou** (`packages/game-items-goods`, `@adatechnology/game-items-goods` 0.1.0 pelo changeset `game-items-goods-package.md`)
- `src/data.ts` (JSON gerados importados e tipados: `GOODS_ITEMS` 327, `GOODS_CATEGORIES` 17, `GOODS_PLACES` 24, `GOODS_CONTAINERS` 17, `GOODS_RECIPES` 33, `GOODS_USE_EFFECTS` 9, `GOODS_HOUSE_POOLS` cortado para `PoolEntry`, `GOODS_TABLES` com raridades/armazenamento/esgotamento/surgimento/corpo a corpo, `GOODS_ARSENAL_RECORDS` para `itemsFromArsenal`, `GOODS_PROVENANCE`), `src/pack.ts` (`goodsPack` e `createGoodsItems(options)`: goods primeiro, pacotes e opções do jogo depois e vencem), `src/locale.ts` (`GOODS_STRINGS`, `goodsText`, `pickGoodsLocale`).
- Textos: `src/data/locales/pt-BR.json` **gerado** pelo `tools/items-catalog` (424 chaves: `item.*` 327, `category.*` 17, `place.*` 24, `rarity.*` 6, `container.*` 17, `recipe.*` 33): nome do time (ITE `n`) nos 245 do time; nome que o household já tinha nos 54 sem par; `decisions.json.names` (nova tabela, com razão) nos 28 itens criados, nas 3 categorias do jogo e no recipiente `counter`. `src/data/locales/en.json` **à mão** (tradução mecânica; os 92 itens do household reaproveitam o inglês que o SDK já tinha, congelado em `tools/items-catalog/base/household-item-names.json`, de onde também sai o pt-BR deles depois que a T3.1g tirar as chaves `item.*` do household).
- Ferramenta: `build-locale.ts`, saída `locales/pt-BR` em `OUTPUT_FILE_NAMES` (entra no `--check` e no `catalog-up-to-date`), `Sources.householdNames`, `Decisions.names`; teste `tests/locale.test.ts` (nome do time em todo item, nenhum nome morto em `decisions.names`, nomes congelados do household nos dois idiomas, nenhum texto vazio).
- Pacote completo: `package.json` (dep `game-items`, sem ciclo), `tsconfig`, `tsup` (ESM + IIFE `GameItemsGoods`), `vitest.config`, README, `.claude/skills/game-items-goods/SKILL.md`, changeset, `site/Dockerfile` (a linha `COPY` já existia desde a T3.1b), `pnpm-lock.yaml`.
- Testes (13): o pacote valida em `createItems` (sozinho e por `createGoodsItems`; 327/17/24/17/33/9), ids únicos, em inglês e snake_case, jogo estende com `patch`/`remove`/pacote próprio, categoria/lugar/raridade referenciados existem, pools/receitas/efeitos/corpo a corpo/caixas só nomeiam itens existentes, medidas entre 1 mm e 2 m e peso positivo, provenance cobre todos e só os itens, todo item tem origem; texto nos dois idiomas para todas as chaves e nada além delas, tradução de todo nome exceto os iguais nos dois idiomas (`dvd`, `ketchup`, `power_bank`, `shampoo`).

**Desvios do desenho e escolhas reversíveis**
- O desenho dizia "textos en: tradução (haiku)"; fiz eu mesmo (mecânica, 235 nomes + 28 criados). Para os 38 itens juntados o inglês é o do household (nome do time só vale em pt-BR, onde o desenho manda o nome do time).
- Os pools do goods são cortados para `{ item, weight, qty, isSupply? }`; `type`, `name` e `viewerCategory` do visor ficam só em `data/house-pools.json`.
- Textos de receita (`recipe.<id>`) e de recipiente entram no locale (não estavam no desenho); os de armazenamento e os efeitos de uso não (são ids de máquina).
- Raridade em pt-BR fica em minúsculas como no ITE (`comum`); quem exibe capitaliza.
- `GOODS_TABLES` repete números que o `DEFAULT_RULES` do engine já tem; o teste de integração do `game-items` (T3.1e) prova a igualdade, aqui só se expõe.
- Nada de golden novo nesta task.

**Portões (Node 24.22.0)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` exit 0; `pnpm -r test` exit 0 (`game-items-goods` 13, `items-catalog` 39, `game-items` 139, `game-interactables-household` 1907, `game-weapons` 277, `golden` 42...); `catalog:check` de items e weapons up to date. **Node 22.23.4**: `game-items-goods` 13, `game-items` 139, `tools/items-catalog` 39, `tools/golden` 42 passaram e `catalog:check` up to date. Goldens (golden-tool, `game-weapons`) sem mudança. Nenhum gate falhou 2x. Modelo da execução: `sonnet`.

### T3.1g — Household pega os itens do goods (grupo E)

**O que entrou** (`packages/game-interactables-household`, `minor` pelo changeset `household-items-from-goods.md`)
- `src/data/items.json` apagado; `create.ts` monta `hh.items` com os itens do goods que nasceram household (`GOODS_PROVENANCE[id].household`): 92, mesmos ids (as 38 junções mantêm o id do household), clonados. Nova exportação `HOUSEHOLD_ITEM_IDS`. Categoria antiga virou `tags` (feito pelo extrator na T3.1c); `category` agora é uma das 14.
- Chaves `item.*` saíram de `locales/en.json` e `locales/pt-BR.json` (332 -> 240 chaves cada); `hh.strings` junta os `item.*` dos 92 vindos de `GOODS_STRINGS` (pt-BR: nome do time nos 38 juntados; en: o que o SDK já tinha). Mesmas chaves nos dois idiomas, como o teste antigo exige.
- `loot.json` não mudou: todos os ids que ele usa continuam existindo (teste novo `tests/goods-items.test.ts`, que também prova ids = os 92 congelados, definição igual à do goods, categoria entre as 14 e textos do goods). Nenhum teste existente precisou mudar (1907 + 4 passam).
- `package.json`: dependência `@adatechnology/game-items-goods`, devDependency `@adatechnology/game-items` (só no teste); `tsup.config.ts` virou ESM + IIFE com `noExternal` para os `@adatechnology/*` (agora há import em tempo de execução, e o IIFE `GameInteractablesHousehold` precisa levar o goods junto). README e SKILL atualizados (inclusive a nota de quebra de medidas).
- Nada mais no repositório importava `items.json` nem o locale do household por caminho (conferido com grep); `interactables-test-area`, `interactables-showroom`, `floorplan-*` e `test-room` usam `createHousehold()`/`hh.items` e seguem verdes.

**Mudanças de dado para quem consome (changeset e SKILL):** 18 itens mudaram de peso (vale o do time) e 8 de medida: `rice`, `water_bottle`, `juice_box`, `bandage`, `first_aid_kit`, `flashlight`, `batteries`, `hammer` (T3.1d); o martelo ficou em pé (pose do modelo do time), 15,9 x 33 x 4,7 cm. Categorias antigas: `hygiene`->`medical`, `cleaning`/`trash`->`materials`, `office`/`mail`->`collectibles`, `kitchen`/`tool`/`garage`->`tools`, `bbq`->`outdoors`, exceções por item na `decisions.json`.

**Desvios e escolhas reversíveis**
- `hh.items` continua com os **92** (não os 327): o teste do pacote exige tamanho < 1 m e o catálogo do household é o que os móveis e a loot table do pacote usam. Quem quiser tudo usa o `createGoodsItems()`. Reverter = trocar o filtro por todos os itens.
- A lista dos 92 vem da rastreabilidade do goods (`provenance.household`), não de uma lista escrita no pacote.
- O desenho dizia "re-exporte `ITEMS`/helpers que já eram públicos": o household nunca exportou `ITEMS`; o público era `hh.items`, preservado.

**Portões (Node 24.22.0)**: ver a seção T3.1f para o conjunto; nesta task `pnpm build`, `pnpm -r typecheck`, `pnpm lint` e `pnpm -r test` (household 1911, interactables 153, floorplan-* , test-room 118, goods 13, items 139, golden 42) verdes e `catalog:check` up to date; Node 22.23.4: household 1911 e goods 13 passaram (items 139 e golden 42 não mudaram desde a T3.1f). `examples/interactables-showroom` builda com o IIFE novo; `interactables-test-area` pede o build prévio do `test-room` (igual antes da task). Sem golden novo. Modelo da execução: `sonnet`.

### T3.1i — Ligações corpo a corpo e armas genéricas (grupo E)

**O que entrou**
- `decisions.json`: tabela `meleeWeapons` (id do item -> id no arsenal, 18 itens) e `meleeWithoutWeapon` (os 2 que ficam sem arma e por quê). `build-items.ts` grava `weapon` nos itens; `items.json` regenerado (18 linhas novas, nada mais mudou).
- Já existiam no arsenal e foram só ligados: `knife`, `machete`, `axe`, `baseball_bat`, `sledgehammer`, `crossbow`.
- `game-weapons`: `src/data/melee-weapons.json` (arquivo à mão, anexado **depois** das armas existentes em `WEAPONS`): `tactical_knife`, `meat_cleaver`, `hatchet`, `nail_bat`, `iron_pipe`, `pickaxe`, `sickle`, `police_baton`, `cast_iron_skillet`, `improvised_spear`, `chainsaw` (corpo a corpo, alcance `alc` m, ruído `ru` m e massa `kg` do item) e `recurve_bow` (arco: calibre `arrow`, alcance 40 m, como o `bow_compound`). Energia, raio e cadência são números genéricos plausíveis (REF), não do time.
- Testes: `game-items-goods` (todo `weapon` resolve no `createArsenal`, só `melee` carrega `weapon`, só `slingshot` e `arrows_and_bolts` ficam sem, alcance/ruído/massa das 11 defs novas = item, `checkArsenal` sem problemas e `itemsFromArsenal` + goods valem em `createItems`); `game-weapons/tests/catalog.test.ts` (as 12 defs). `game-items-goods` ganhou `game-weapons` como devDependency.
- Changeset `game-weapons` minor. Os pontos `dano`/`cr` ficam na fatia do jogo (`damage-points.json`, T3.1j), não no SDK.

**Fidelidade e goldens de armas**: o golden por arma (`weapon-scenarios.json`) cresceu **só por acréscimo** (+66 linhas, 0 removidas; as 12 armas novas no fim, mesma ordem das anteriores); `catalog:check` de armas e de itens up to date; nenhum hash de modelo 3D mudou.

**Desvios e escolhas reversíveis**
- Os "20 itens melee" ficam em **18 com `weapon`**: `slingshot` (o arsenal não tem calibre de pedra e acrescentar um mudaria o `calibers.json` gerado) e `arrows_and_bolts` (munição, não arma: já chega por `ammo_arrow`/`ammo_crossbow_bolt` do `itemsFromArsenal`). Reverter = acrescentar o calibre/arma e uma linha em `meleeWeapons`.
- Os existentes (`knife` 0,4 m etc.) mantêm o alcance/ruído do arsenal; o do time só vale nas defs novas. O `improvised_spear` é `slash` porque o tipo de dano do arsenal só tem `blunt|slash`.
- `recurve_bow` é arma de fogo de calibre `arrow` porque é assim que o arsenal modela arco; o `alc` 40 virou `range`.

**Portões (Node 24.22.0)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` exit 0; `pnpm -r test` verde (`game-weapons` 290 em 10 arquivos, `game-items-goods` 17, `items-catalog` 39); `catalog:check` de items e weapons up to date. **Node 22.23.4**: `game-weapons` 290, `game-items-goods` 17 passaram. Nenhum gate falhou 2x. Modelo da execução: `sonnet`.

### T3.1k — Goldens G-b e G-c dos achados (grupo E)

**O que entrou** (`packages/game-items`)
- `scripts/record-team-golden.mjs` (`pnpm --filter @adatechnology/game-items record:team-golden`): recorta do original com `cutLiteral` (`ITENS`, `EXTRA`, `RAR_W`, `CONT_TAB`, `FIXOS`) e por texto as funções (`rollItems` do `jogo.js` L68796-68812; `mulberry32`/`hashStr`/`criaRng`/`ordemPonderada`, `LT`/`CONTEUDO`/`COMIDA_SUP` e `sorteiaConteudo` do `visor-casas-3d.js`), avalia em `vm` e grava **uma vez** `tests/fixtures/team-golden/roll-items.json` (222 KB) e `house-contents.json` (672 KB). `installPortableMath` ligado; `package.json` do `game-items` ganhou `@adatechnology/golden-tool` (devDependency) e o script.
- G-b: o `R()` do jogo foi trocado pelo `createSeededRandom(semente)` do golden-tool; 10 recipientes (`CONT_TAB`) x 24 lugares x sementes 1-10 = **2400 casos**, `nome = ''` e sem `extra` (as posições fixas e extras não são sorteio). Cada caso guarda os ids sorteados e o número de sorteios.
- G-c: `sorteiaConteudo` com o `criaRng(sem, chave)` do próprio visor (não substituído: já é semeado); 25 chaves de recipiente (20 pools + 5 aliases) x 3 estados (normal/protegida/abandonada) x sementes 1-25 = **1875 casos**, 5 áreas de móvel diferentes. Cada caso guarda as escolhas `{tipo, qtd}` e os sorteios que o original consumiu.
- `tests/team-golden.test.ts` (4 testes): G-b compara ids, ordem e **contagem de sorteios** do `rollByCategory` sobre um catálogo reduzido ao pool do jogo; G-c alimenta o `rollExplicitPool` com os sorteios gravados e confere escolhas, quantidades e que consumiu exatamente os mesmos.

**Resultado**: 2400/2400 e 1875/1875 iguais, nas duas, sem mudar o porte (a ordem de sorteio do `category-roll` e do `explicit-pool` já era a das fontes). O fixture gravado com Node 22 e com Node 24 é **idêntico** (md5), e os testes passam nos dois.

**Escolhas e ressalvas**
- O pool do G-b é o do jogo: os 146 `ITENS` (ids com `provenance.game`) mais as caixas de munição do `EXTRA` (`ammo-boxes.json`); o que o catálogo acrescenta sozinho (os outros itens do time, os do household, os criados, os outros 19 calibres do `itemsFromArsenal`) fica de fora por `include`, senão o sorteio ponderado percorreria outra lista. Nos itens do jogo só há raridade `c/i/r`, então a regra "lendário/único só em ponto fixo" não muda o resultado; a ordem dos itens do goods dentro da categoria é a do ITE e bate com a do jogo.
- A ressalva do T3.1e ("comparar por ids") não foi preciso: a ordem bateu, então a comparação é por sequência exata.
- Sem `recurso` do Math.random nas fontes: o jogo usa `R()` (substituído) e o visor `criaRng` (semeado), nenhuma chamada a `Math.random` fica no recorte.

**Portões (Node 24.22.0)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` exit 0; `game-items` 143 testes em 14 arquivos (eram 139 em 13); **Node 22.23.4**: `game-items` 143 passaram. Modelo da execução: `sonnet`.

### T3.1j — Fatia do jogo dos itens (grupo E)

**O que entrou**
- `specs/001-migracao-entregas-dos-times/game-slice/items/`, gerada por `catalog --game-out`: `documents.json` (14), `regions.json` (10 regiões, 101 itens com região, 10 especialidades), `uses.json` (textos `uso`), `damage-points.json` (20 itens de arma com `dano`/`cr`, A2), `fixed.json` (9 posições fixas), `faction-loot.json` (51), `supply-events.json` (queda do exército, trem de carga, cronograma de luz, teto de itens no chão por célula).
- `README.md` na pasta: o conteúdo vai para `content/items/` do repositório `Andersonfrfilho/zombiada` (que **não** foi tocado), lista de arquivos com contagens e como regenerar.
- Cobertura do `catalog:check`: **coerente e ligada por padrão.** `tools/items-catalog/src/paths.ts` ganhou `GAME_SLICE_DIR`; o CLI usa essa pasta quando não há `--game-out` (então `catalog` regenera e `catalog:check` compara goods + fatia, 22 arquivos) e `tests/catalog-up-to-date.test.ts` compara os mesmos 22. Com `--game-out <pasta>`, tanto a escrita quanto o `--check` valem para aquela pasta. Provado: acrescentar um espaço a `fixed.json` faz `catalog:check` falhar listando o arquivo. README do tool atualizado.

**Desvios e escolhas reversíveis**
- O desenho dizia só "fatia por `--game-out`"; escolhi gravá-la também no repositório do SDK (em `specs/.../game-slice/`) para ficar versionada e conferida até o jogo recebê-la. Reverter = tirar o padrão do CLI e o 22 do teste de atualização.
- Nenhuma edição em arquivo gerado nem no repositório `zombiada`.

**Portões (Node 24.22.0)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` e `pnpm -r test` verdes (`items-catalog` 39); `catalog:check` de items e weapons up to date. **Node 22.23.4**: `items-catalog` 39 passou. Modelo da execução: `sonnet`.

### T3.1h — Achados do catálogo ligados à planta (grupo E) — commit `6314632`

**O que entrou**
- `game-floorplan`: `FloorplanOptions` ganha `day` e `region`; `FindsProvider.findsFor` pode devolver `null` ("não é meu": o próximo provedor ou o padrão do pacote responde) e **`[]` passa a ser uma resposta** (recipiente vazio). Novo `engine.findsAnswer(query)` (devolve `null` se ninguém respondeu); `engine.findsFor` devolve `answer ?? []`.
- `game-floorplan-structure`: a extensão de conteúdo passa `day`, `region`, `place`, `footprint` e `key` na consulta e só cai no `contentOf` padrão quando `findsAnswer` é `null`.
- `game-items`: `createFindsProvider` aceita `placeAliases`, `poolPlaces` e `unknownContainers: 'pass'` (sobrecarga mantém o tipo sem `null` quando a opção não é `pass`); `coldContainers` também olha `query.key`.
- `game-items-goods` (`src/floorplan.ts`): `createGoodsFindsProvider`, `FLOORPLAN_POOL_KEYS` (fridge→geladeira, kitchen_cabinet→pia, overhead_cabinet→aereo, washbasin→pia_b, wardrobe→guarda...), `FLOORPLAN_PLACES` (shack→house, cabin→lodge, camp→military_base, triage e emergency_room→hospital, market→supermarket, metalworks→workshop) e `POOL_PLACES` (house, apartment, lodge); `fridge` e `display_fridge` entram nos recipientes frios.
- Testes: `finds-goods.test.ts` (7, novo), null x [] no motor, provedor que devolve `null` nas utilidades, 3 no provedor de `game-items`. **Os goldens do VC3 da Fase 2 passam iguais.** Changeset `floorplan-finds-provider.md`.

**Mudança de semântica (avisar quem implementa provedor):** antes `[]` e "não sei" eram a mesma coisa; agora `[]` é "o recipiente está vazio" e `null` é "não é meu".

### Correção de passagem — miniaturas das 12 armas corpo a corpo — commit `3829f91`

Dois testes de `game-weapons-three` estavam vermelhos por herança da T3.1i: faltavam as miniaturas das 12 armas novas e a área de armas passou a ter sete balcões. Rodei `node tools/weapon-thumbnails/dist/cli.js generate` (12 SVGs novos em `assets/weapon-svg/generated/`, `manifest.json`, `CREDITS.md`, `credits.html`; os arquivos existentes saíram idênticos byte a byte) e subi o teto de balcões de 6 para 8 em `weapons-area.test.ts`.

### T3.2a — Esqueleto do `game-items-three` — commit `feb701a`

Pacote novo (IIFE `GameItemsThree`, three peer `^0.160`, `@adatechnology/golden-tool` devDependency): `createItemKit` (materiais por tag com `baseRgb` do hex), `setWear` (0 novo, 1 usado, 2 estragado, mistura em sRGB), 25 formas simples (`shapeOf`, `drawShape`), `buildItem`, `mergeItem`, `buildItemLod` (3 níveis, corte a 30 m / 60 m), `ITEM_BUDGETS` (30 chamadas, 400/1200 triângulos) e registro de modelos. `mergeByMaterial` **mudou do `game-weapons-three` para o `game-props3d`** (`git mv`; o weapons-three passa a depender do props3d). 38 testes.

### T3.2b — Captura `items-showcase` e porte literal dos 24 modelos — commit `06377c6`

- `tools/golden/captures/items-showcase.js` recorta da página `const mats = []` até `MODELS` e `STAGE_TARGET`/`AMT`/`setStage`, avalia no three r128 e grava `tests/fixtures/team-golden/items-showcase.json`: 96 eventos (24 `model` + 72 `wear`), 24 cenas. Duas gravações idênticas byte a byte.
- Os 24 construtores estão em `src/models/*.ts` **literais** (cada um com o cabeçalho da linha da fonte); `models.json` (id, teamId, caixa, escala) é gerado por `tools/items-catalog` (`build-models.ts`); 23 itens do goods ganham `model: <id>`.
- `tests/team-golden.test.ts` (27): hash nó a nó, hash das 24 cenas e tabelas de desgaste com tolerância 0,0011 (r128 trunca o hex, r160 converte para linear). `KNOWN_DEVIATIONS` está vazio: **os 24 bateram**. `tests/models.test.ts`: caixa x escala = tamanho em 2%.
- **Desvios de orçamento (conhecidos, do time):** 7 modelos passam do teto de triângulos e ficam em `MODEL_BUDGET_DEVIATIONS`: `canned_beans` 744, `amoxicillin` 596, `flashlight` 1060, `portable_radio` 504, `house_key` 472, `motorcycle_helmet` 840, `lpg_cylinder_13kg` 712 (o teste aceita só até o valor medido).
- O `diario` (`survivor_diary`) é item só do jogo: o modelo vem no SDK, o item não está no goods.

### T3.2c — Miniaturas e checklist 3D — commit `9631f99`

`shapeThumbnailSvg` (25 formas, 64x64, sem script nem referência), `itemThumbnail` (modelado → `{ render: true }`, demais → `{ svg }`), `thumbnailPatch` para `createItems`, `composeThumbnailScene`/`renderItemThumbnail` (enquadra a caixa inteira; testado com renderer falso). `itens-modelos-3d.md` passa a ser **gerado** (`build-checklist.ts`, coluna "tamanho real") e o `catalog:check` o confere. 7 testes novos.

### T3.3a — `examples/items-test-area` — commit `66d18ee`

`createItemsTestModule({ catalog, locale, translate, seed, wear, provider })` em `game-items-three/src/area.ts`; o módulo não conhece conteúdo (recebe o catálogo). 14 prateleiras por categoria com os 327 itens em tamanho real (`AreaPlacement.surface`, `shelvesLayout` puro: sem sobreposição, dentro da arena de 28 m), pedestal com os 24 modelos girando, régua de 1,55 m, silhueta de 1,80 m e mesa de achados. Bancada: categoria (todas + 14), desgaste, idade 0–400 + armazenamento (7) + energia, lugar (24), recipiente, estado, dia do surto 0–60, semente, "sortear achados", receita e "fabricar". Camadas: rótulos, caixas, destaque das formas simples. Contadores: itens, chamadas de desenho, triângulos, modelados/total (351 itens à mostra, **23/327 modelados**). 7 cenários em pt-BR e en. 14 testes de área com a sala de testes de verdade. A forma `backpack` foi corrigida para ocupar a altura inteira (estava 11% abaixo).

### T3.3b — Site e móveis com conteúdo real — commit `d52d6df`

`interactables-test-area` carrega também o `ItemsArea`; geladeira, armários, despensa, guarda-roupa, cômoda, criado e armário do banheiro mostram itens reais sorteados pelo goods (fotos `shots/` refeitas). `site/catalog.mjs` (exemplo + família "Itens"), miniatura `site/thumbs/items-test-area.jpg` (`capture-thumbs --only=items-test-area`), `site/Dockerfile` (COPY de `game-items-three` e `examples/items-test-area`; os de `game-items`, `game-items-goods` e `tools/items-catalog` já existiam). `site/build-site.mjs` já constrói o `test-room` primeiro e os demais em ordem alfabética, então `items-test-area` vem depois dele sem mudança de código. Navegador (Chromium): `items-test-area/test.mjs` 5 verificações e `interactables-test-area/test.mjs` 14/14 passam.

### T3.3c — Documentação, changesets e portões

- `inventario/armas-itens.md` (8 linhas de itens marcadas `[migrado: onde]`), `tasks.md` (Fase 3 ✅), `.claude/skills/game-items-three/SKILL.md` (novo) e atualizados `game-items`, `game-items-goods`, `game-props3d`, `game-floorplan`, `game-floorplan-structure`.
- Changesets novos: `game-items-three-package.md` (minor → 0.1.0), `props3d-merge-by-material.md` (minor), `weapons-three-merge-by-material-moved.md` (patch); já existiam os de `game-items`, `game-items-goods`, household (minor), contracts/interactables (minor), weapons (minor) e floorplan/structure.

**Portões (Node 22.22.0; o Node 24 não existe neste ambiente)**: `pnpm build`, `pnpm -r typecheck`, `pnpm lint` exit 0. Testes: `game-items-three` 92, `game-items` 146, `game-items-goods` 18, `items-catalog` 42 (`catalog:check` up to date), `game-props3d` 300, `game-floorplan` 38, `game-interactables-household` 1911, `game-contracts` 35, `game-test-room` 128; `weapons-three` e a área de armas verdes com `--testTimeout=90000`. **`game-floorplan-structure`: 11 falhas que já existiam sem as minhas mudanças** (conferido revertendo meus arquivos): as plantas comerciais e pós-apocalípticas (supermercado, farmácia, loja de armas, delegacia...) não têm pontos de encanamento e `triage_tent` dá "Unknown construction canvas". Os goldens VC3 passam.

### Escolhas e desvios reversíveis (T3.1h–T3.3)

- `largeFrom` = 0,6 m (item grande: 1200 triângulos, corte a 60 m) é a minha leitura da página; mudar em `ITEM_BUDGETS`.
- Os 233 itens sem modelo usam a medida REF e uma cor padrão cinza; o time corrige ao entregar o modelo.
- A área calcula a idade da comida por `freshness` com o armazenamento escolhido e usa o pior entre o desgaste da bancada e o da idade.
- O conteúdo dos móveis do `interactables-test-area` usa um mapa tipo-de-móvel → pool escrito no `entry.js` do exemplo (glue de exemplo, não do SDK).
- Não usei `RoundedBoxGeometry` (G6): nenhum dos 24 modelos precisou.

### Perguntas para o dono

1. `[]` agora é resposta do `FindsProvider` e `null` é "não é meu". Algum provedor do jogo (zombiada) depende de `[]` como "não sei"?
2. As 11 falhas do `game-floorplan-structure` (encanamento dos comerciais/pós-apocalípticos e `triage_tent`) são da Fase 2 e estão vermelhas na `int/p3`. Quem corrige?
3. Os 7 modelos do time acima do orçamento de triângulos (`flashlight` 1060, `motorcycle_helmet` 840...): aceitar como desvio ou pedir ao time versões mais leves?
4. `largeFrom` 0,6 m: é a regra que o time quer para "item grande"?
5. O `survivor_diary` tem modelo no SDK mas o item é só do jogo: deixo o modelo no SDK (reaproveitável) ou movo para o repositório do jogo?
6. Falta o Node 24 neste ambiente: os goldens do items-showcase foram gravados e conferidos só no Node 22.22.0. Rodar também no 24 antes do PR.
| `pnpm -r test` (inteiro, em segundo plano) | exit 0; nenhum arquivo falhou |
| `game-contracts` / `game-weapons` / `game-destruction` | 29 / 278 / 97 passaram |
| `tools/golden` / `tools/characters-catalog` / `tools/animals-catalog` / `tools/weapons-catalog` | 44 / 60 / 8 / 17 passaram |
| Golden tools em **Node 22.23** (`vitest` dos catálogos, `golden:vm:check`, `catalog:check`) | 60 / 8 passaram; vm goldens iguais aos fixtures gravados no Node 24.22 |
| `golden:vm:check` e `golden:chrome:check` | 5 vm e 8 Chrome: cada um gravado duas vezes, byte a byte iguais e iguais ao fixture |
| `catalog:check` (characters, animals) e `catalog:check` das duas fatias do jogo | up to date |
| `docker build -f site/Dockerfile .` | exit 0 (manifestos das duas ferramentas novas no Dockerfile) |

Commits (todos terminam com o `Co-Authored-By` de Opus 5.5): `feat(contracts,weapons)` contrato do corpo; `feat(golden)` cut-source; `feat(characters-catalog)`; `feat(animals-catalog)`; `feat(characters-catalog,golden)` goldens da Fase 4; `docs(spec-001)` evidência e inventário do grupo A.

Modelo da execução: `sonnet`.

## T4.1d–e — `game-characters`: esqueleto e modelo de dano

Tarefas T4.1d e T4.1e 🧠 do desenho `design/T4-personagens-e-animais.md` (§2, §3, §5, §6). Branch `feat/spec-001-fase-4`; nada enviado ao remoto.

### O que entrou

- **T4.1d** — pacote novo `@adatechnology/game-characters` (ESM + IIFE `GameCharacters`, manifesto no `site/Dockerfile`, changeset 0.1.0, skill `.claude/skills/game-characters`): `GUIDE` (guia do Elenco: 1,80 m, ombros 0,61 m a 1,475 m) e `TEAM_GAME` (o `J` do jogo, como está), rig de 17 juntas com os ossos 0–11 do corpo instanciado (`GAME_BONES`), árvore de 17 segmentos (os 11 tipos do Arsenal, dois lados) com as 6 regiões do jogo e `MISSING_BITS`, registros (`packs`/`patch`/`remove`), `createCharacters`, `describe()`/`state()` no contrato de destruição e `setDetail` (segmentos → regiões sem perda, o inverso com perda).
- **T4.1e** — o personagem é `DestructibleImpl`. Pipeline (`src/damage/pipeline.ts`), nas 8 etapas do desenho: 1) resolve (`hit.part` segmento ou região, senão a parte mais próxima); 2) proteção (camadas por `BodySlot`; mordida/arranhão `1 − Π(1 − b·c)`, teto 90 %; presets que reproduzem `ROUPAS`); 3) penetração `physical` (P = √(E·m/A), R por caminho, `P/(P+R)` de energia) e `team-game` (PEN do jogo, ×0,75 por corpo); 4) pontos `3,5·E^0,37`, ou a tabela por calibre, ou `Hit.points`; 5) multiplicadores (`MULT` × tipo × idade × roupa); 6) gravidade por segmento (destruído/arrancado/quebrado, cascata de `segmentsBelow`, manca, rasteja, partido ao meio, regra da cabeça com capacete e mandíbula); 7) `deathRule` `vitality-or-head` (padrão) ou `head-only`; 8) sangramento por segmento (`BLEED`, × `bloodFactor`) em eventos `leak`. `penetrateLine` para uma bala atravessando vários corpos. Presets de regra: `kit` (padrão), `arsenal` e `elenco` (repetem as páginas).
- O motor fica em joules (A2). Um fluxo de sorteios por personagem: `createRng(seed ^ contador de golpes)`; `spec.random` o substitui para repetir um jogo gravado. Nada de regra só de zumbi no pacote: tipo, idade, roupa e atordoamento do brutamonte entram como números do spec (`multipliers`, `limbFactor`, `bloodFactor`, `bodyCount`, `stunSeconds`, `crawling`), que o `-undead` (T4.2b) vai preencher.

### Fidelidade por golden

| Golden | Lado do SDK | Comparado | Resultado |
|---|---|---|---|
| G-damage-regions (`game-damage-regions.json`) | `detail: 'regions'`, modelo `team-game`; zumbi com os números do catálogo (`types`/`ages`/`outfits` do `-undead`) e a vida do `start` | por golpe: vida, cabeça, braços, pernas, `missing`, manca, rasteja, capacete, atordoamento, morreu, headshot | **exato**, 38/38 sequências (125 eventos) |
| G-penetration (`game-penetration.json`) | `kit.penetrateLine` com `team-game` | por corpo: alcançado, dano, vida, morte; corpos atingidos e onde para | **exato**, 10/10 linhas |
| G-damage-segments (`arsenal-damage-segments.json`) | `detail: 'segments'`, preset `arsenal`, corpo com os pivôs do `buildZombie` da página (para a granada) | por golpe/granada: vida, vivo, estado, lado do manco, causa, presos, hp dos 17, sangramentos (taxa, duração, jorro) em ordem | **exato**, 97/97 cenários (214 eventos) |
| G-cut-hierarchy (`elenco-cut-hierarchy.json`) | preset `elenco`, o sorteio do golpe no mesmo lugar do fluxo da página | estados dos 13 segmentos, hp, morte, rasteja, manca por perna, pêndulos (junta e braço) | **exato**, 78/78 cenários (225 eventos); ângulo inicial e `v` do pêndulo ficam para o `-three` (T4.1i) |
| P7 (`calibration.test.ts`, contra `game-weapons` `CALIBERS`) | `penetrationForce`, `penetrateLine` `physical` | corpos atingidos, energia mantida, pontos | contagens **exatas** (2/3/4/3/1); energia 0,51/0,69/0,78 contra 0,50/0,65/0,75 (±0,05); pontos 35/59/71,7 |

**Como o RNG casa.** G-damage-regions: só a mandíbula sorteia; o teste refaz a posição do fluxo do jogo depois do `zSpawn` (escolha de idade e de roupa, 13 sorteios, mais 1 da cor civil quando a roupa sorteada é civil) — confere com os 20 sorteios de mandíbula (5 levam o bit 512). G-cut-hierarchy: o `build` da página gasta 1284 sorteios e cada golpe gasta 1 + `burst` (8 + 7 por partícula, 8 + round(dano/6) partículas); achado no fixture, constante por arma, e o SDK recebe só o sorteio do golpe.

### Desvios e decisões (padrões reversíveis)

1. **Lado esquerdo em +x**, de frente para +z (Elenco e Arsenal concordam). O `TEAM_GAME` guarda o `J` como está; as juntas que o `J` não tem saem dos ossos do jogo (coluna no quadril, cabeça no pescoço) ou um antebraço/canela abaixo (punho, tornozelo); a mandíbula é sintética.
2. **Regra `kit` (padrão dos segmentos)**: membro tira 0,3 do dano da vitalidade (Arsenal); nas regiões, 0,5 (jogo). Golpe não letal na cabeça tira da vitalidade (jogo); tiro letal sem tirar a cabeça deixa o segmento `broken`. Destruído quando o golpe chega a 2× o segmento (desenho); o preset `arsenal` mantém o `-hp > max` da página.
3. **Regra de crânio no `physical`**: letal quando P passa a resistência da cabeça (5,25) e os pontos chegam a 20. Sem tabela de calibre: classe `rifle` acima de 1000 J, `buckshot` com `pellets > 1`; massa padrão 8 g quando o `Hit` não traz `mass`.
4. **Elenco**: o tronco a 0 mata (o golden marca `dead`), então o preset `elenco` usa `vitality-or-head`. Com `head-only`, a vitalidade não mata e o partido ao meio passa a rastejar.
5. **`big` do tiro direto** = pontos acima de 120 (o `bigPoints` da granada): reproduz o `.50` da página sem precisar do id da arma.
6. **`BodyHit.woundAtPoint: false`**: golpe sem ponto de superfície (a aba do Arsenal sem ponto, raycast da multidão em cápsula) não abre ferida no ponto.
7. **Atordoamento**: nas regiões usa os pontos do golpe antes do colete (o jogo atordoa pelo `dano`); na regra `kit`, depois da proteção. Capacete com `pass: 1` (fuzil passa sem efeito, como no jogo).
8. **`limbEffect`** do golden (o `fxLimb` repete a cada golpe num membro já perdido) não é comparado: o SDK emite o evento `body` uma vez por bit novo, e os bits de `missing` são comparados. O estado de alerta (`st` 1) é de IA, fora do dano.
9. **`leak`** em litros por segundo (0,27 ml por gota); `bleeders()` guarda a taxa do Arsenal (gotas/s). Nas regiões não há sangramento (multidão: o sangue é efeito visual).
10. **Fogo/calor**: `burnPointsPerSecond` 3 × segundos × fator de fogo da roupa, só na vitalidade.
11. **Mundo de destruição**: o `DestructionWorld.shoot` dá 50 % de energia de saída a qualquer impl com `hole.through`; o corpo calcula `P/(P+R)` (`lastHit.exitEnergy`, `penetrateLine`), mas o mundo não lê. Não mexi no `game-destruction` (fora do escopo).
12. **Linha `team-game`**: depois de uma morte o raio recomeça 0,3 m além do corpo e as distâncias seguintes contam dali (recursão do `shootRay`); mantido.
13. Os presets de proteção estão em `src/damage/defaults.ts` espelhando `decisions.json` `protectionPresets` (um teste confere); `protection.ballistic` no `game-items` continua pendente da Fase 3.
14. Corpo morto continua apanhando (desmembrar cadáver); `killed` sai uma vez.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 (nos dois commits) |
| `pnpm -r typecheck` | exit 0 (nos dois commits) |
| `pnpm lint` | exit 0 |
| `game-characters` (vitest, Node 24.22 e **Node 22.23**) | T4.1d: 14 passaram; T4.1e: 274 passaram em 9 arquivos |
| `pnpm -r test` (inteiro, em segundo plano) | 1ª rodada: exit 1 — um teste do `game-weapons-three` (`weapons-area.test.ts`, área de armas) estourou o limite de 5 s com a máquina carregada; o pacote não depende do `game-characters` e passa sozinho (94/94). 2ª rodada: **exit 0**, 28 pacotes, 5126 testes |
| `docker build -f site/Dockerfile .` | exit 0 (manifesto do `game-characters` no Dockerfile) |

Commits (todos com o `Co-Authored-By` de Opus 5.5): `feat(characters)` esqueleto do game-characters (T4.1d); `feat(characters)` modelo de dano do corpo (T4.1e); `docs(spec-001)` esta evidência.

Modelo da execução: `opus`.

## T4.1h–T4.4d — Fase 4: construtores 3D, motor de zumbis, bichos e ambientes de teste

Commits em `int/p4`: T4.1h `4ecce49`, T4.3b `68dfb3c`, T4.1i `048cf2a`, T4.2b `64d45c0`, T4.3c `28d3ca6`, correção de altura `3864ea4`, T4.4a `35ab596`, T4.4b `9d6c18b`, T4.4c `954ab3e`, T4.4d (este).

### O que entrou

- **T4.1h**: construtor rico do Bestiário v17 e pessoas (62 acessórios), porte literal.
- **T4.3b**: Bichos do Vale em `game-animals-three` e `createNodeSkin` no `game-props3d`.
- **T4.1i**: animador, ferimentos, olhos e ponte de fluidos.
- **T4.2b**: motor de zumbis; **T4.3c**: regra de surto dos bichos.
- **Correção**: `kit.ts` do `game-characters-undead` usava o fator de variância como metros; agora altura = corpo base vezes o fator (teste "size of a drawn zombie").
- **T4.4a/b**: módulos de teste `createCharactersTestModule` (11 cenários) e `createAnimalsTestModule` (6 cenários), com `examples/characters-test-area` e `examples/animals-test-area`.
- **T4.4c**: os dois módulos entram no `examples/interactables-test-area`; cenário `zombie_behind_door` (tiro atravessa porta do guarda-roupa, MDF e coxa do zumbi); catálogo, Dockerfile e miniaturas do site.
- **T4.4d**: skills (`game-animals-three` novo; `game-animals`, `game-characters-three`, `game-characters-undead` atualizadas), changesets e este inventário.

### Decisões e desvios

1. O contrato de teste é só o genérico (`TestableModule`); os módulos vivem nos pacotes `-three`.
2. O material `flesh` é registrado por `registerBodyMaterial(room.world)`; a sala não o conhece.
3. Osso quebrado no cenário: 3 golpes de 20 pontos (um golpe de 60 pontos corta o membro).
4. A geladeira não serve de camada no cenário da porta (o `world.shoot` segue no máximo 4 partes); usado o guarda-roupa.
5. Orçamento de triângulos do nível longe (250) não é atingido (383 assado); o cenário `benchmark_1000` reporta, não falha.
6. Corpos sem pai são removidos do ambiente de teste no quadro seguinte (sondas dos checks da sala).

### Portões

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 em cada commit |
| `pnpm -r typecheck` | exit 0 em cada commit |
| Testes por pacote (`game-characters-three`, `game-characters-undead`, `game-animals-three`, `game-props3d`) | passaram |
| Exemplos `characters-test-area`, `animals-test-area` | passaram |
| `examples/interactables-test-area` (Chromium) | 14 de 14 |
| `pnpm lint` | exit 0 |

### Perguntas para o dono

1. O orçamento de 250 triângulos do nível longe do corpo é meta ou só referência? Hoje o baked tem 383.
2. `protection.ballistic` e o reexport de `BodySlot` no `game-items` seguem pendentes do merge da Fase 3.
3. Os 62 acessórios de pessoa e o catálogo de profissões ficam no pacote `-three` ou migram para um pacote de conteúdo (`-people`)? Hoje o módulo de teste lê o conteúdo do host.

Modelo da execução: `sonnet`.



## Fase 7 — veículos, vegetação, cidade e câmera (T7.0 a T7.5)

Commits em `int/p7`: T7.0 `222a95f`, T7.1a `1ea43bd`, T7.1b `5718964`, T7.1c `537b5b0`, T7.1d `5304161`, T7.1e `4ed1cc7`, T7.1f `35c2caa`, T7.2a `0b3c030`, T7.2b `54419e4`, T7.2c `2645d90`, T7.3a `528db5a`, T7.3b `b22ecfe`, T7.3c `34a560e`, T7.3d `d8b89c2`, T7.3e `8762b85`, T7.4 `841c4cd`, T7.5 (este). O desenho da fase é `design/T7-veiculos-e-cidade.md`.

### O que entrou

- **T7.0** `tools/vehicles-catalog`: extratores de `DIMS`, paletas e dos 69 cartões da Frota (`--check`), o plugin do jogo como fatia (`game-slice/vehicles/`) e o `compare`, que roda o artefato da Garagem, a página v4 e o SDK em Node: 69 veículos x 3 estados, 207 comparações, 0 diferenças. A premissa de V2 (frotas novas de aviões, barcos, helicópteros e militares) **não vale**: o `game-vehicles-fleet` já registra os mesmos 69 veículos em 10 arquivos.
- **T7.1a-b** `game-vehicles`: modo leve (`kit.lod`, ganchos `[LOD]` do núcleo e das cópias da frota, `skipLite`), `kit.damageables`; `game-vehicles-fleet`: `fleetDims`, `paintPalettes`, `colorFromSeed`, `fleetStats`. Desligado por padrão: os goldens da frota e do motor seguem idênticos.
- **T7.1c** `game-vehicles-three` (novo): fusão em seis malhas, poda de 3 cm, quadro de saída (+z), cor por semente, medidas e caixas danificáveis. Golden contra a página (three r160, semente 7) em 12 veículos; 193.908 triângulos do hatch em alta; `DIMS` dos 69 ao milímetro.
- **T7.1d-e** `game-vehicles-driving` (novo, sem three): motorista arcade do jogo (`CAR`, `carUpdate`, oito pontos de colisão, atropelamento a 3 e 8 m/s, barulho, buzina) com golden de seis roteiros quadro a quadro; semissimulação do documento da Frota (mola e amortecedor por roda, pneu com força longitudinal e lateral, câmbio automático com RPM, freio de mão, superfícies, dano que muda a direção, consumo), com os números do documento como testes (não há código do time).
- **T7.1f** módulo de teste de veículos (8 itens, 13 cenários: os 11 da página, literais, e `vehicles_drive_arcade` e `vehicles_drive_semi`), `examples/vehicles-test-area`, `car_in_the_yard` na `interactables-test-area`.
- **T7.2a-c** `game-vegetation`: geometria das peças de madeira do artefato do Viveiro (`radius`, `length`, `axis`, `base`), 40 de 40 peças iguais; `game-vegetation-species`: `scatterRulesFor` (48 casos iguais ao `rulesFor` da página); `game-vegetation-three` (novo): 18 plantas, 13 cenários `veg_*`, canteiro de 12 x 20 m e caminhante, `examples/vegetation-test-area`.
- **T7.3a-b** `game-urban` e `game-urban-three` (novos): cinco postes com orçamento de luzes, ruas, calçadas, grade, quarteirão, adereços e os dez padrões de bairro (G-poles: 34 casos; G-padrao: a folha de amostra inteira, 1029 objetos).
- **T7.3c** terreno por camadas (G-terrain: malha de 181 x 181 vértices, alturas e cores iguais às da página; `hW` e `forestF` a 1e-9); números do Vale em `game-slice/urban/`.
- **T7.3d** parte `placement` (`b.place`), `createVehicleProvider` (frota) e `createPlantProvider` (tabela regional) em `game-urban`; `createVehicleResolver` (modo leve) e `createPlantResolver` em `game-urban-three`.
- **T7.3e** módulo de teste da cidade (17 itens, 8 cenários `urban_*`), `examples/urban-test-area`, os três módulos na `interactables-test-area`.
- **T7.4** `game-camera`: o `smoothing` passa a ser lido; `aim`, `wallRecovery`, `deathOrbit`, `look`, `shake`, `rig.look`; G-camera com 640 quadros roteirizados iguais ao `cameraUpdate` do jogo a 1e-9.
- **T7.5** inventário (R5), esta seção, skills, changesets e READMEs.

### Goldens da fase

| Golden | Contra | Resultado |
|---|---|---|
| G-garage | Garagem (artefato), site v4 e SDK, 69 x 3 estados | 207 comparações, 0 diferenças |
| G-fleet-regression | `golden.json` da frota (868 testes) | idêntico depois da T7.1a |
| G-lite, G-dims, G-damageables, G-lod-high | `FrotaLeve` em Node (three r160) | triângulos, chamadas, vértices por classe, caixas e `DIMS` iguais |
| G-colour, G-stats | `corDaSemente`, `PALETA`, `fleet` da Frota | sementes 0-499 e 40 textos; 69 cartões iguais |
| G-arcade | `carUpdate` cortado do jogo | seis roteiros, estado e eventos iguais |
| G-veh-module | `MODULO_VEICULOS` da página contra a sala do kit | os 11 cenários com os mesmos checks e linhas de log |
| G-veg-pieces, G-veg-module, G-nursery, G-rules | bundle e módulo do artefato do Viveiro, `buildLotVeg` e `rulesFor` da página | 40 de 40 peças; 18 specs e 13 cenários; 8 sementes; 48 casos |
| G-poles, G-padrao, G-terrain | Galeria do Vale Cinzento no Chrome (`--expose`) | 34 casos; folha inteira de 1029 objetos; malha e `hW`/`forestF` |
| G-camera | `cameraUpdate` cortado do jogo | 640 quadros, posição, olhar, FOV, yaw e pitch a 1e-9 |

G-semi não tem golden (não há código do time): os números do documento são testes.

### Decisões e desvios

1. A Garagem do artefato é a página v4 do site, byte a byte no código (V2): nada foi portado por V2 além do que realmente faltava (modo leve, `DIMS`, paletas, `damageables`).
2. O contrato de teste é só o genérico; os três módulos vivem nos pacotes `-three` e os exemplos só os carregam.
3. Os módulos **não desenham partículas e não pedem efeitos por conta própria**. Veículos pedem a `host.effects` por id; vegetação e cidade não pedem nada (ver "Dependência do vfx").
4. Recorte de `Math.random`: `colorFromSeed`, o atropelamento e as escolhas dos provedores usam semente ou o lugar; o `rig.look` recebe o sorteio do host e nunca chama `Math.random`.
5. **O padrão do `smoothing` mudou de "não lido" para 12** (V7): quem dependia do salto instantâneo passa `smoothing: 0`. É o único comportamento que muda por padrão na fase; dois testes antigos do `game-camera` passaram a pedir `smoothing: 0`.
6. A escolha do veículo e da planta pelos provedores depende do lugar (hash de x, z), não do sorteio da cena: assim a ordem de sorteio da página, que o golden confere, não se mexe quando um jogo liga um provedor.
7. O carro de caixas da amostra da Galeria **não foi entregue** (substituto de caixas é proibido pelo CLAUDE.md §1): o provedor de veículos padrão não estaciona nada e o jogo liga `createVehicleProvider`.
8. O módulo de teste da cidade estende a câmera da sala para 600 m enquanto está carregado (a folha de amostra tem 240 m e a sala vê 140 m) e devolve a antiga ao descarregar.
9. A sala atual dá tempo de saque a toda ferramenta, que as páginas dos times não conheciam: os cenários de tiro esperam a ferramenta ficar pronta (`waitUntilReady`), e os goldens fazem o mesmo na sala da página.
10. Cada item da área urbana é cenário: um bloco de concreto ancorado do tamanho da amostra (a sala exige um corpo); a destruição de prédios e casas é do `game-floorplan` e do `game-destruction`.

### Dependência do vfx e receitas que faltam

`game-vfx` não está em `int/p7` (a Fase 5 anda em outro ramo) e a fase não o traz. O que cada módulo pede:

- **Veículos** pedem a `host.effects` (quando o host tem) os ids `vehicle.fire`, `vehicle.explosion`, `vehicle.glass`, `vehicle.sparks`, `vehicle.leak` e `vehicle.exhaust` (`defaultEffectIds`, trocáveis por `effects`). São as receitas que o `game-vfx` precisa registrar: o fogo do motor, a explosão com a coreografia do carro (pula, capô, portas e roda voam em brasa, carcaça queimando), o estilhaço do vidro, a faísca de raspagem, a poça do vazamento e a fumaça do escapamento por condição (100/60/30/10).
- **Vegetação** não pede efeitos: o mundo de destruição padrão não entrega seus eventos (folhas, seiva, fogo) ao módulo, então o módulo não os vê. Um host com `game-vfx-three` liga os efeitos aos eventos do mundo.
- **Cidade** não pede efeitos.

### Portões

| Comando | Resultado |
|---|---|
| `pnpm install --prefer-offline` | ok em cada commit |
| `pnpm build` | exit 0 em cada commit |
| `pnpm -r typecheck` | exit 0 em cada commit |
| Testes por pacote (um de cada vez) | game-vehicles 247, game-vehicles-fleet 879, game-vehicles-three 127, game-vehicles-driving 32, game-vegetation 241, game-vegetation-species 135, game-vegetation-three 46, game-urban 43, game-urban-three 64, game-camera 26: todos passaram |
| `examples/urban-test-area` e `vegetation-test-area` e `vehicles-test-area` (Chromium) | `urban`: 8 de 8 cenários; `vegetation`: 13 de 13; `vehicles`: 13 de 13 |
| `examples/interactables-test-area` (Chromium) | 22 de 22 (pt-BR e en), com os módulos de veículos, vegetação e cidade |
| `pnpm lint` | exit 0 em cada commit |

### Perguntas para o dono

1. **Efeitos dos módulos de vegetação e cidade.** O mundo de destruição padrão não entrega seus eventos a um módulo (`ModuleHost` não tem `effects` para a vegetação). Aceita que o `game-vfx-three` ligue os efeitos aos eventos do mundo, ou o módulo deve passar a ouvir o mundo?
2. **A bancada da vegetação não escolhe a espécie** (só o canteiro por semente, qualidade, detalhe, condição e estação). Vale um controle de espécie?
3. **Métrica de triângulos por LOD** na vegetação: hoje só as plantas do canteiro por LOD; não há triângulos por LOD das 18 plantas da fila.
4. **Folha de contatos da Garagem** (miniaturas com cache em `localStorage`): sem destino. Vira recurso da `vehicles-test-area` ou fica de fora?
5. **Peças que o `buildWorld` espalha** e que não entraram em `game-urban`: árvores e vilas pelo mapa, estradas, trilhas e trilhos, túneis, pontes, linhas de transmissão, muros, decoração do vale e marcadores do mapa. Entram como "características" genéricas com ganchos de decoração (e a decoração do Vale na fatia do jogo), ou ficam só no repositório do jogo?
6. **`smoothing` padrão 12** no `game-camera` (decisão 5 acima): manter ou voltar a 0 e deixar o 12 como predefinição do jogo?
7. **Carro de caixas da amostra**: o padrão é não estacionar nada; o jogo liga `createVehicleProvider`. Prefere que a `urban-test-area` já ligue o provedor?
8. **Marcadores do mapa e decoração do Vale** ficam no repositório do jogo (`game-slice/urban/`): confirma?

Modelo da execução: `sonnet`.
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

## T5.2d — desenhistas da Oficina e bancada de efeitos

- **`game-vfx-three/src/workshop-layers.ts`** desenha os pools do motor da Oficina (o que `world.play` enche): sprites aditivo e normal com o shader da página (tamanho em metros preso a 1..512 px, suavidade 1 e 0,55), riscos (`LineSegments` com cor por vértice), detritos (500 caixas instanciadas), decalques (duas malhas instanciadas, brilhante e fosca, círculo de borda irregular que cresce, espalha, seca e evapora pelos campos do decalque), anéis (instanciados, cor por `hold` ou `1-k`) e as 4 luzes de clarão e 2 de fogo. Criados sob demanda: só quando algo já criou o motor (`VfxWorld.peekWorkshop()`). A tela (`screen`) da Oficina e a do Lab entram no overlay pelo maior valor de cada campo.
- **`createVfxTestModule`** (`game-vfx-three/src/bench/`): módulo `vfx`, grupo `effects`. Efeito (16 explosões do Lab e as receitas por time, em grupos), variante (o `params` da receita, trocado com `bench.patch`), repetir, repetição automática, distância, faixa de LOD, qualidade, 6 camadas (`show_*`), 8 contadores (nuvens, faíscas, destroços com teto 40, luzes com teto 6, partículas do efeito com teto 400, escala de LOD, tempo desde a repetição, tempo desde a explosão) e a ficha com a linha do tempo. Toca por `host.effects`; sem ele, cria um renderizador próprio.
- **Anfitrião (`game-test-room`)**: `ModuleBench.sheet` (cartão da ficha no painel, com linha do tempo e cabeça de leitura que segue o contador `metric`), `ChoiceOption.group` (`optgroup` no seletor; opções agrupadas nunca viram botões), `MetricRow.value` numérico.
- `EffectSink.configure` do renderizador entende `quality` (`high`/`medium`/`low`, níveis 0/1/2 do pool) e `layer_<id>`.

### Decisões

- `generic` (perfil de reserva do Lab) não é listado na bancada; as 16 explosões são as da página.
- Receita com o mesmo id de uma explosão (`molotov`) não aparece na lista: o `EffectSink` tenta a explosão primeiro, então a receita nunca seria alcançada por esse id.

### Perguntas para o dono

- As bolhas de lente (`engine.lens`) e o `engine.post` da Oficina têm dados no motor, mas ainda não são desenhados (a página os pinta num canvas 2D sobre a cena). Quer a lente e o pós-processo no overlay agora ou junto da câmera do jogo?
- Os nomes das explosões na bancada vêm do id (`m67` -> `m67`), porque o Lab não tem textos por explosão. Há nomes traduzidos que o time de armas queira usar?

## T5.2e — área de efeitos na sala de testes

- `examples/vfx-test-area` (`build.mjs`, `src/{entry,area,scenarios}.js`, `test.mjs`): bundle IIFE `VfxArea` e a página `dist/sala-efeitos.html` (a sala de testes com a bancada de efeitos carregada e a área `vfx` aberta). Três cenários: todas as explosões do Lab desenham nuvens e faíscas, todas as receitas da Oficina tocam, e quatro granadas seguidas ficam dentro do teto de 6 luzes.
- `examples/interactables-test-area` passa a carregar também a bancada de efeitos (alias de `game-vfx` e `game-vfx-three` no `build.mjs`, `loadInto` devolve `vfx` no relatório) e o teste confere os 7 controles e as 6 camadas.
- Site: `site/Dockerfile` (COPY do `package.json` do exemplo, em ordem alfabética), `site/build-site.mjs` (comentário da ordem: a sala de testes primeiro) e `site/catalog.mjs` (o exemplo e a família "Efeitos"); `ci.yml` constrói e testa o exemplo.
- Teste de navegador (Chromium, sem rede): 6 verificações passam nos dois idiomas, incluindo as capturas da granada e do sangue.

## T5.3c — renderizador do filme em `game-fluids-three`

- `src/film/shader.ts`: o fragmento da página (F131-209) linha por linha. Diferenças, todas pelo mesmo motivo (a página pintava a cena inteira; o filme agora cobre a superfície do jogo): `baseCol` (parede, calçada, meio-fio, rua) vira a cor chapada `uBase`; a saída leva **alfa = cobertura** (`max(m, gw*.55)`: o molhado e, no combustível, o chão que escureceu); o tamanho da grade e o vão são uniformes (`uGrid`, `uSpan`; a página fixa 256 x 396 e 4,95); a tangente vem da geometria (`aT`; a da página era o eixo x); duas linhas que espelham a parede da própria página no reflexo ficam de fora (descrevem a cena dela); a saída passa as cores da página (espaço de exibição) para linear e usa `#include <colorspace_fragment>` do r160.
- `strips.ts`: uma faixa por região do layout (u = coluna, v = linha / altura, `aB` = para onde o filme escorre). `material` com `DoubleSide`, porque os eixos de um layout podem ter qualquer mão.
- `drops.ts`: gotas em voo (icosfera instanciada, esticada pela velocidade, F258-262) e o bulbo do pingo (F282).
- `grid.ts`: `FilmGrid` = filme + textura RGBA8 (r: espessura em raiz, g: seca, b: umidade, como o `upload` da página F360) + faixas + gotas. Devolve o retângulo sujo (união dos limites molhados do quadro anterior e do atual) e mede o quanto ficou parado (`idle`: nada chegando e a área molhada variando menos de 0,5%).
- `manager.ts`: `FilmManager` guarda **no máximo 6 grades de 2 x 2 m** (160 x 160 células de 1,25 cm), **só a até 30 m** do jogador, simula dentro de um **orçamento em ms por quadro** (as mais próximas primeiro; as que não cabem esperam o quadro seguinte) e **envia à GPU só o retângulo sujo**: uma textura de apoio do tamanho do retângulo e `renderer.copyTextureToTexture` (a primeira vez sobe inteira, quando o three avisa por `texture.onUpdate`; sem `gpu` sobe sempre inteira). A grade que fica longe (mais de 30 m x 1,25), parada (20 s sem mudar) ou espremida por uma nova **vira decalque**: `fluids.splash(líquido, centro de massa, litros, undefined, { tint })`, com os litros = soma das espessuras em mm x área da célula e o `tint` {fresco: `thin`, seco: `dry`} do perfil, e a grade é liberada. `onBake` também recebe o motivo (`range`, `settled`, `budget`, `clear`).
- API: `launch({ fluid, point, velocity?, radius?, surfaces? })` (cria a grade sob o ponto), `drip({ fluid, point, every, radius? })`, `setWeather({ rain })` (repassa a todas as grades; o gancho da Fase 6), `update(dt)`, `stats()`, `clear(bake?)`. `surfaceAt(ponto)` dá o chão, a parede e o meio-fio (`layoutFromSurfaces`); sem ele, um chão em `groundAt`.
- Conferido num Chromium com GL por software: o shader compila e os 4 líquidos aparecem (sangue, bile, óleo com irisação, combustível).

### Decisões

- Decalque sem `fluids` no gerenciador: só `onBake` (o anfitrião decide).
- A GPU entra por `FilmGpu` (`copyTextureToTexture`); o mesmo vale para o `WebGLRenderer` direto.

### Perguntas para o dono

- O filme é só CPU perto do jogador (decisão do desenho). Os fluidos longe viram decalque estático. Quer o filme em GPU (ping-pong) depois da Fase 5, atrás da mesma interface `FilmSimulator`?

## T5.3e — pontes do filme

- **`createFilmBridge({ fluids, manager, random })`** (`game-fluids-three/src/film/bridge.ts`): um `leak` de líquido que tem filme (`blood`, `old_blood`, `bile`, `motor_oil`, `fuel`; `liquids` mapeia outros, p. ex. `diesel -> fuel`) passa a jogar gotas do furo, com a velocidade e a vazão que o mundo dá (`dropLiters`, 0,15 mL por gota, no máximo 6 por quadro), até o `stream_end`. As gotas caem na grade sob o furo (o gerenciador cria) e, fora de alcance, o mundo de fluidos segue com o jato e a mancha dele. Líquido sem filme (água) fica só com o mundo.
- **`bridge.splat({ fluid, point, direction?, speed?, radius?, count?, tint? })`**: é o que o `body` vai usar. Com `tint` ({ fresco, seco }) a grade é desenhada nessas cores (`tinted(perfil, tint)`: fino e gotas no fresco, o miolo grosso 55% mais escuro, seco no seco); grades de tintas diferentes ficam separadas e o decalque da grade parada guarda a mesma `tint`.
- **Gancho da chuva**: `bridge.setWeather({ rain })` -> `manager.setWeather` -> `film.setWeather` de cada grade (para a secagem e espalha 1,5 vez mais). Sem efeito até o `game-weather` (Fase 6) mandar o valor.
- **Sala de testes**: o gerenciador e a ponte entram na sala (grade só quando algo pinga; `clear` libera; o `gpu` é o `WebGLRenderer` quando ele sabe `copyTextureToTexture`). Teste: uma lata de combustível furada pinga numa grade do chão.

### Pendente

- ~~`body` (T4.0) -> `splat` com `tint`~~: feito na T5.3e-body (seção abaixo, Fase 6 parte 2), depois que a Fase 4 entrou na `main`.

### Perguntas para o dono

- A vazão por gota (0,15 mL) e o teto de 6 gotas por quadro são meus: o time só mostra pingo, fonte e arrasto. Quer outra conta para um furo grande (um jato em vez de gotas)?

## T5.4 — comparação das explosões (coluna SDK novo)

- `comparacoes/explosoes/capturar-sdk-novo.mjs` e os 6 quadros `quadros/sdk-novo-*.jpg` (0,08 · 0,25 · 0,5 · 1 · 2 · 4 s depois da detonação, câmera do Laboratório); `index.html` ganha a linha "SDK novo (Fase 5)" e a antiga vira "SDK antes da Fase 5". Os quadros do Laboratório e do jogo não foram refeitos (as páginas do time não mudaram).
- A captura roda a sala de testes num Chromium do Playwright com GL por software e anda a simulação em passos de 1/60 s (a captura antiga usava o relógio da parede com a página servida em `localhost:4801`, que não existe neste ambiente).
- `consolidado.md` §8 e §9: partículas do SDK que não apareciam (item 1 de §9 e o de §8), lixo de memória por quadro (2), fluido na CPU (8) e o README de `game-fluids` (11) marcados como feitos, cada um com a task.
- O que ainda difere do Laboratório nos quadros é o cenário (chão liso da sala em vez da rua, dos corpos e da luz noturna da página).

## T5.5 — Documentação, changesets e portões finais da Fase 5

- READMEs e SKILL.md de `game-vfx`, `game-vfx-three`, `game-fluids-three` e `game-test-room` atualizados; changesets de T5.1f/g, T5.2a–e, T5.3c e T5.3e; inventário `efeitos-destruicao.md` ganhou a seção "Fase 5: o que entrou (R5)"; `tasks.md` marca T5.1, T5.2 e T5.3.
- Portões (`pnpm install`, `build`, `-r typecheck`, `lint`): exit 0. Testes por pacote (um de cada vez): game-contracts 36, game-vfx 348, game-vfx-three 67, game-fluids 70, game-fluids-three 27, game-destruction 159, game-destruction-three 60, game-test-room 139, game-floorplan 38: todos passam.
- `game-weapons-three`: 1 teste estoura os 5000 ms padrão quando a máquina está carregada (load average ~20, outros agentes rodando); os outros 174 passam. Não toca código da Fase 5.
- `game-floorplan-structure`: 11 falhas (`Unknown construction "canvas"` em `triage_tent` e `expected 0 to be greater than 0` em utilities de vários prédios). Reproduzidas no commit-base 1c10405, antes de qualquer commit da Fase 5; nenhum commit da Fase 5 altera `game-floorplan*` ou `game-destruction`. Pendência da Fase 2, não da 5.

### Perguntas para o dono
- Evento `hit` do HostEvent para impactos (T5.1g) ainda não existe no contrato; o evento `body` depende de T4.0.
- Fatias rebar_expose / stage / collapse das destruições sem receita na Oficina.
- Borrões de lente e pós-processamento não são desenhados.
- Nomes de explosão derivados dos ids (sem texto de locale do time).
- Filme na GPU real (hoje validado em swiftshader), volume de vazamento por gota e teto de gotas.
| `pnpm -r test` (inteiro, em segundo plano) | exit 0 (a primeira rodada estourou os 5 s do teste que regrava as 85 fixtures da Cena com o workspace inteiro em paralelo; o teste ganhou 120 s) |
| `game-weather` / `golden-tool` / `game-contracts` | 56 / 63 / 34 testes; os goldens e os traces também em Node 22.23.4 |
| `game-weapons-three` `audio-trace.test.ts` | 5 testes (trace gravado antes de qualquer mudança no som) |
| `docker build -f site/Dockerfile .` | exit 0 (com o manifesto de `game-weather`) |

## Fase 6 — grupo C (som das armas)

### T6.1e2 — Sons de recarga da Cena de Arte como padrão em `MECHANICAL_SOUNDS`

A T1.4 (desvio 1) deixou os cliques metálicos de recarga como síntese do SDK porque a Galeria não tem som. A Cena de Arte tem (`sfx.empty`, `magOut`, `magIn`, `bolt`, `shell`, `casing`, L1339-L1344, mais o `click` de L1338 que é a primitiva), então, pela regra 1 do CLAUDE.md, a entrega do time substitui o invento.

| Cena | Vira | Obs. |
|---|---|---|
| `empty` (`click(0, 3200, .35)`) | `dry_fire` | mantém a classe `vazio` do jogo e troca o `metal` do SDK |
| `magOut` (`click 1600` + ruído bandpass 900, Q2, atraso .03) | `magazine_out` | mantém a classe `recarga` do jogo |
| `magIn` (`click 1100` + tom 320 para 200) | `magazine_in` | idem; `seat` continua nos cilindros, canos e tubos |
| `bolt` (`click 2200` e `click 2700` a .12) | `charge` | |
| `shell` (`click 1400` + ruído bandpass 1200, Q3, atraso .02) | `round_in` | |
| `casing` (tom 4200-5700 para 3800, .06, atraso .25-.45) | `clink()` | um toque só, no lugar dos dois do SDK |

Os passos novos `scene_tone` e `scene_noise` de `SoundStep` são o `sTone` e o `sNoise` da Cena (receitas `layered` com palco de saída: ganho de distância, pan, envio de reverb). O que o time não entregou (`misfire`, trava, ferrolho aberto, cilindro, cobertura, tanque, tubo...) segue com o `metal` do SDK.

**Prova:** `tests/audio-scene.test.ts` roda cada som no motor com a mixagem `art_scene` e compara com o traço do próprio código da Cena (`tools/golden/fixtures/audio/art-scene-audio.json`, casos `empty`, `magOut`, `magIn`, `bolt`, `shell`): diferenças vazias, tolerância 1e-9. O `casing` da Cena é posicional (3,2 / 12,-9 / 40,25) e o `clink` toca no ouvinte, então ele é conferido por faixas (frequência, atraso, rampa a 3800).

**Fixture regravada de propósito:** `packages/game-weapons-three/tests/fixtures/audio-trace.json` (`UPDATE_GOLDEN=1`). Só mudam os casos com recarga, vazio e `clink`; o resto do traço (tiros, classes, `thud`, volume, `dispose`) é o mesmo da T6.1e. `tests/audio.test.ts` (T1.4) ficou com uma só mudança: o piso de osciladores passa de 5 para 4, porque o `clink` agora é um toque. Reverter: desfazer este commit (Q5).

## Fase 6 — grupo C (camada WebAudio, bancadas e sala)

Branch `int/p6`; nada foi enviado ao remoto. Fica de fora, por esperar as Fases 4 e 5: T6.1g (sons de personagens e bichos), T6.2b (visual, som e pontes do clima) e T6.2c.

| Task | Commit | O que entrou |
|---|---|---|
| T6.1c | `f0c4664` | `createAudioEngine` e a camada WebAudio: contexto preguiçoso com `unlock`, ruído e impulso de reverb vindos da semente, `realize` na ordem de nós de cada rotina do time, laços nas duas ordens (`game_loop`, `chain_loop`), canais, perfis de mixagem, barramentos e limite de vozes. Os 111 casos do jogo e o encadeamento da Cena dão o mesmo traço dos fixtures dos times (tolerância 1e-9) |
| T6.1e | `e035414` | `createWeaponAudio` vira adaptador sobre o `game-audio` (ordem `weapon`, `setMaster`, `createAudioSink`, `{ from }` sem rampa). O traço gravado antes da mudança volta idêntico (`audio-trace.test.ts`); a área de armas usa o motor de `host.audio` |
| T6.1e2 | `1ed74c6` | Sons de recarga da Cena de Arte como padrão de `MECHANICAL_SOUNDS` (seção acima) |
| T6.1f | `909eae2` | `createDestructionSound`: sons dos materiais da Cena (12) e `explosion_boom` do jogo, com traço igual ao do código do time; `burn_end`, `burn_loop` (laço de fogo); `to: 'from'` |
| T6.1h | `4d97a3d` | `createAudioTestModule` (`audio_area`) e `examples/audio-test-area` |
| T6.2d | `2d46daa` | `createWeatherTestModule` (`weather_area`) e `examples/weather-test-area` |
| T6.3 | `c66fc64` | A sala empresta `host.audio` e `host.environment`; as duas áreas entram em `examples/interactables-test-area` |
| T6.4 | `c72ecbe` | `site/Dockerfile` (manifestos dos dois exemplos), `site/catalog.mjs` (2 exemplos e 2 famílias, Som e Clima) e as miniaturas |

### T6.1h — a bancada de som

Controles: som, origem (ajustes da bancada ou a sonda posta na área), distância (0, 10, 40, 60, 120, 160 m), direção, volume, mixagem, semente, tocar, tempestade de vozes, laço com nível e altura. Camadas: reverb, compressor, pan, abafamento pela distância (desligar zera o `cutoffK` do som para uma chamada só). Métricas: vozes, pico, derrubadas, laços, contexto, duração, nível e pan do som escolhido e o nível de cada um dos 6 barramentos (analisadores criados quando o barramento nasce). 4 cenários: `panning`, `distance`, `determinism`, `limiter`. O módulo usa o motor de `host.audio` quando a sala empresta, e o seu quando não. `BENCH_BANK` (`bench_ping`, `bench_hiss`) são sons de prova do próprio módulo, feitos pelo kit (`sdk` nas fontes), não entrega de time.

### T6.2d — a bancada de clima

Controles: clima (os 10 estados, nomes em pt-BR e en), transição (de uma vez ou 10 s), hora do dia, sorteio automático (liga: o clima do lugar muda sozinho e o relógio corre a 600×; desliga: o clima fica até trocar, relógio a 72×) e semente. Hora e semente refazem o mundo mantendo o clima atual (o chão molhado volta a 0: é o preço de reiniciar o relógio). Camadas: escrever em `host.environment`, névoa na cena (opção `fog`, ligada por padrão e desligada no `interactables-test-area`, que não é sobre clima). Métricas: clima, hora, mistura, chuva (mm/h), visibilidade, escala de visão e de audição, vento, temperatura, índice de calor, chão molhado e raios. 4 cenários, cada um em mundo próprio, sem tocar o ao vivo: tempestade enxerga e é ouvida menos que o dia limpo e solta raios; mistura de 10 s passa pelo meio e assenta; a mesma semente dá o mesmo dia de 48 h; chuva molha e o chão seca depois. Sem visual (céu, chuva, relâmpago) e sem som: esperam T6.2b e T6.2c.

### T6.3 — a sala empresta som e ambiente

`createTestRoom` cria o motor (opção `audio`, `false` para sala muda), empresta `createAudioSink(motor)` em `host.audio` e põe o ouvinte na câmera a cada quadro (posição e giro); empresta `host.environment` (opção `environment`, `room.environment`). `examples/interactables-test-area` carrega as áreas de armas, itens, som e clima junto da dos móveis (a bancada que o painel mostra segue a dos móveis); o teste do navegador manda `storm` e confere `room.environment` (chuva 60, visibilidade 100) e o pico de vozes no motor da sala. `examples/test-room/build.mjs` passa a nomear `game-audio` na lista de aliases (antes só entrava pelos links do pnpm).

### Testes e gates

| Gate | Resultado |
|---|---|
| `pnpm build`, `pnpm -r typecheck`, `pnpm lint` | verdes depois de cada commit |
| `game-audio` | 169 testes (traços do jogo e da Cena, motor, bancada) |
| `game-weather` | 62 testes (eram 56; 6 da bancada) |
| `game-test-room` | 130 testes (1 novo: `host.audio` e `host.environment`) |
| `game-weapons-three` | 186 testes; novo `tests/audio-host.test.ts` (o módulo toca no motor emprestado e não fecha o contexto dele). Com a máquina carregada (carga ~18 de outras ramas) a rodada inteira do pacote estoura os 5 s em 4 arquivos; cada arquivo roda verde sozinho |
| `examples/audio-test-area`, `weather-test-area`, `interactables-test-area` | `node test.mjs` no Chromium (pt-BR e en): relatório de contrato limpo, cenários verdes, sem erro de console; o dos móveis 16/16 |
| `node site/build-site.mjs` | 7 exemplos, 30 pacotes; miniaturas novas capturadas com o Chromium do Playwright |
| `docker build -f site/Dockerfile .` | não rodei (sem docker aqui); os manifestos dos dois exemplos novos entraram nos COPY, em ordem alfabética |

### Escolhas minhas (padrões reversíveis)

1. A hora do dia da bancada de clima reinicia o relógio do mundo (`createWeather` só aceita `startHour` na criação).
2. `fog` do módulo de clima é opção para a sala que não é sobre clima não ganhar névoa.
3. A miniatura da área de clima mostra a tempestade só nos números: a névoa de 100 m quase não aparece a 12 m de distância. O céu e a chuva virão com T6.2b.
4. Inventário: os relatórios de `inventario/` não têm linhas para S1 nem E6 (som e clima nasceram do desenho `design/T6-som-e-clima.md`), então não havia o que marcar lá; as marcas estão em `tasks.md` (T6.1 e T6.2).

### Perguntas para o dono

1. O ouvinte da sala é a câmera. Em jogo de terceira pessoa o ouvinte deve ser o jogador ou a câmera? (Hoje a sala usa a câmera.)
2. As miniaturas de Som e Clima não têm o que mostrar de som (e o clima sem visual): aceita uma miniatura da bancada ou prefere esperar a T6.2b?
3. Falta o docker no ambiente: rodar `docker build -f site/Dockerfile .` antes do PR.
4. A rodada inteira de `game-weapons-three` precisa de máquina livre; vale subir o `testTimeout` do pacote (hoje 5 s) como foi feito no `golden-tool`?

## Explosões: abrigo, estilhaços como projéteis e confinamento (modelo novo do kit)

> Modelo novo, **sem entrega de time**: conferi o Laboratório de Explosões, a Oficina de VFX, o Arsenal e o jogo e nenhum tem abrigo,
> estilhaço que acerta quem está atrás nem pressão em ambiente fechado. O dono aprovou criar os três como opções em **2026-10-24**, com a
> frase: "tem paredes que vão destruir e o personagem vai receber esse impacto, não tão grande, mas recebe parte do empurrão e estilhaços".
> Por isso não há o que marcar no inventário; a regra do `CLAUDE.md` §1 foi cumprida pela pergunta ao dono antes de inventar.

- `game-destruction`: `DestructionOptions.blast` / `explode(..., options)` / `Hit.blast`: `shelter`, `fragmentHits`, `confinement`, tudo desligado por
  padrão (resultados e goldens idênticos; a suíte inteira passa sem mudar nenhum golden). Números em `SHELTER_DEFAULTS`, `FRAGMENT_HIT_DEFAULTS` e
  `CONFINEMENT_DEFAULTS`. Exemplos com os padrões: parede de tijolo de 20 cm deixa passar ~19%, porta de madeira de 4 cm ~53%, vidro de 6 mm ~83%,
  pilar de concreto de 30 cm ~3%; a parede que quebra na mesma explosão deixa passar mais 50% do que segurou; sala fechada de 6 m x3, a mesma sem
  uma parede ~x2, chão aberto x1.
- `game-destruction-three`: `renderer.explode(..., { report })` empurra cada peça com a energia que chegou ao seu objeto.
- `game-test-room`: opção `blast`, `blast()` / `setBlast()`, três botões no painel (pt-BR e en) e as métricas `blast_shelter`, `blast_confinement`,
  `blast_fragments`.
- Vigas e pilares (pedido do dono na mesma sessão): `tests/beams-and-columns.test.ts` cruza calibres reais de `game-weapons` com pilar e viga de
  concreto armado, viga I de aço, viga de madeira e pilar de tijolo. Correções, todas por opção ou valor e sem tocar nos goldens: `Hit.piercing`
  (chumbo mole não fura 8,5 mm de aço só pela energia), `breach.blastReach` (padrão **desligado**; o valor realista é 0,12 m por raiz cúbica de kJ; **removida em 2026-10-24**, ver "Decisões do dono de 2026-10-24" abaixo) e `damageScale.shelter: 3` no vidro
  (valor novo no JSON de materiais, sem efeito fora do abrigo).

### Decisões do dono de 2026-10-24 (física)

**1. Tanque de combustível realista.** Dono: "depende, na vida real se receber um tiro quais possibilidades de explodi-lo". Bala comum que fura tanque de veículo ou recipiente inflamável (`contains` com `gas` ou
`fuel`: galão, botijão) **vaza e não explode sozinha**. Para acender precisa de uma fonte: faísca de munição dura em metal, incendiária ou traçante, fogo perto ou explosão. Aceso, corre o fogo e a explosão de sempre.
- Antes: `game-vehicles/src/destructible/impl.ts` aquecia o tanque ao ponto de ignição com qualquer acerto de energia acima de 1500 J (linha `E > 1500`, removida); o mundo genérico só acendia por calor (350 °C).
- Contratos (`game-contracts/src/ignition.ts`): `IgnitionRules` (lado do recipiente) e `ignitionChance`. Padrões: curva de enchimento `[0,0.6] [0.1,1] [0.35,0.6] [0.65,0.3] [0.9,0.15] [1,0.12]`
  (cheio fica rico demais para queimar e só vaza; quase vazio acende mais; a chama sente metade da curva, `flameFillInfluence 0.5`), faísca por material (aço e ferro 1, alumínio 0,25, outro metal 0,5, não metal 0),
  diesel com 0,15 da faísca (ponto de fulgor de 52 °C ou mais), fogo perto a 1,5 m com 0,5 por segundo, chama padrão de quem manda só a marca (incendiária 0,7, traçante 0,2).
- Munição (`game-weapons`, `rules.ignition`, lido de `ammo.json`): faísca = 1 - (1 - núcleo)(1 - jaqueta). Núcleo: chumbo 0,005, chumbo com ponta de aço 0,04, aço 0,12, aço temperado 0,25, carbeto de tungstênio 0,25, cobre 0,01.
  Jaqueta: metal dourado 0,005, cobre 0,005, latão 0,01, aço 0,08. Chama: incendiária 0,7, traçante 0,2. Resultado: 7.62x51 M80 (chumbo, metal dourado) 1%; 7.62x39 M43 e 5.45x39 7N6 (aço e aço) 19%; M993 e M2 AP 25%.
  Fonte: não existe tabela pública de ignição por cartucho; são números do kit (modelo), na ordem de grandeza da literatura de vulnerabilidade de tanques (bala comum raramente acende, perfurante incendiária acende), para o jogo ajustar.
- Medido com 500 tiros semeados no tanque de 55 L do `proto` (`game-vehicles/tests/tank-ignition.test.ts`), % que acende, cheio / meio / 10%: M80 0 / 0,2 / 1; 7.62x39 M43 2,2 / 9 / 19; 5.45x39 7N6 2,2 / 9 / 19; M993 AP 3,2 / 11,4 / 24,8;
  7.62x51 traçante 11,4 / 14,8 / 20,8; .50 BMG M8 API 40 / 56 / 80. A incendiária cheia dá 40% e não 70% por causa da curva (0,7 x (1 - 0,5 x 0,88)); vazio a 10% dá 80%.
- Testes: 100 tiros M80 num tanque cheio de aço vazam e acendem no máximo 2 vezes; núcleo de aço e AP acendem mais que M80; tanque quase vazio acende mais de 2 vezes o cheio; incendiária acende na taxa configurada; vazamento ao lado de um pneu
  em chamas acende em menos de 4 s (o tanque inteiro, sem vazamento, só esquenta bem depois: 18 s); explosão perto acende. Mesmo roteiro no mundo genérico (`game-destruction/tests/ignition.test.ts`, galão de aço e de plástico: plástico nunca faísca).
- Efeitos (`game-vfx`): `vehicle_leak` agora é só a poça e o pingar (passos `decal` e `emit` da Garagem sem o fogo e a explosão) e a sequência inteira (faísca, fogo pela poça, explosão aos 7,2 s) é `vehicle_leak_ignited`, pedida
  pelo `game-vehicles-three` quando o tanque pega fogo (`defaultEffectIds.leakIgnited`). Nível do tanque: opção nova `fuel` (0 a 1) do `createVehicleDestructible`.
- Goldens: nenhum arquivo de golden mudou por este item.

**3. Correção da granada sempre ligada.** Dono: "Correção da granada já ligada não deveria nem ter dois caminhos já que é correção." A opção
`breach.blastReach` e o padrão `Infinity` saíram; os 0,12 m por raiz cúbica de kJ são a física (constante nomeada `BREACH_BLAST_REACH` em `world.ts`).
Golden regravado com `UPDATE_GOLDEN=1 vitest run tests/wall-golden.test.ts`: só mudou o cenário `gas_explodes` de `house-scenarios.json` (3 eventos a menos:
o `fracture`, o `debris` e o `stage 3` da janela). A janela fica a ~2,3 m do botijão (60 kJ alcançam 0,47 m), então ela deixa de
estourar pela brecha da explosão; o estilhaço e o dano da explosão continuam. Os outros cinco cenários não mudaram. Testes de pilar/viga perdem a opção
e o caso "sem a opção".

**2. Pilares: a sustentação é a soma dos pilares.** Resposta do dono à pergunta 1 da T2.6: "deve ser ajustada nas configs; às vezes ficaria melhor tipo 4 pilares e a sustentação é a soma dos 4".
- Diagnóstico (script no navegador, sala real, `house_two_pillars` com os dois pilares do time): o solver já soma. A laje reparte a carga entre os apoios que restam e cai
  quando a capacidade que sobra é menor que a carga (teste novo em `structure.test.ts`: 4 pilares dimensionados a 0,72/0,97, perde 1 e fica a 0,9; perde 2 e passa de 1,1 e cai).
  O que segurava a casa era o **dimensionamento** e a **carga que some**: com `safety 0,65` os 4 pilares ficam a 0,65 em repouso; perdidos 2, os outros 2 iriam a 1,3, mas a cascata
  de peças que caem arranca as divisórias do andar de cima na hora (junta `thrown`, 0,5 s) e a carga cai ~27%: os 2 pilares ficam parados a 0,95 e a laje a 0,33 (na sala; fora
  da sala, no mundo puro, a casa caía). Parcelas iguais: nenhuma peça menor (placas, vigas) leva carga, só os pilares.
- Configuração exposta: capacidade da peça (`structure.capacity` ou `MaterialDef.compressive` × seção), `sizeStructure({ safety, redundancy })`, opção nova do mundo
  `structure: { safetyFactor }` (padrão 1; tensão = carga × fator / capacidade) e `SpecimenDef.sizing` no `game-floorplan-three`.
- O pórtico da área (`house_casa_portico`) passa a ser dimensionado a `safety 0,72` e `redundancy 0,97` (um pilar perdido deixa os outros a 0,96, dois passam de 1 mesmo com a carga
  que some). Com os dois pilares do time a laje e o telhado caem na sala real (`floorplan-test-area/test.mjs`, pt-BR e en). O roteiro estendido do módulo saiu.
- Goldens: nenhum mudou por este item (o solver não mudou; a opção nova vale 1). O golden `vc3-house-area.json` do time compara só ids, checagens e eventos de sentido.

**4. Tabela de penetração por calibre em `game-weapons`.** O dono pediu que cada calibre e tipo de munição traga massa, energia e penetração em aço, concreto, tijolo e madeira, e que o motor
de destruição não conheça nomes de calibre.
- Onde: `packages/game-weapons/src/data/ammo.json` (50 cargas, id `<calibre>:<tipo>`), `arsenal.loadOf(calibre, tipo?)`, `weapon.setAmmoKind(tipo)`, opções `ammo`/`patch.ammo`/`remove.ammo`.
  O `Shot` leva `ammo`, `mass`, `penetration`, `incendiary`, `tracer`; `shotToHit`/`shotExtras` (contratos) escalam a penetração pela energia que sobra e põem em `Hit.penetration`.
- Motor: lê `Hit.penetration` por classe de material (`MaterialDef.penetrationClass`/`penetrationScale`, em `materials.json`: aço estrutural 1,3 contra o RHA das tabelas, madeira mole 1,5,
  alumínio 3...); sem tabela vale a regra da energia com `Hit.piercing`. `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` e `piercingOf` saíram do `game-destruction`.
- Fonte dos números: **um** valor publicado (7,62x51 M993 AP: 18 mm RHA a 100 m, 7 mm a 500 m; página do produto da Nammo); o resto é **estimativa** minha a partir de ordens de grandeza
  publicadas (bola 4 a 6 mm de RHA, núcleo de aço 6 a 8, AP 10 a 22, .50 BMG bola cerca de 14), da energia e da construção. Cada carga diz `basis: 'published' | 'estimated'` e as notas
  do arquivo explicam. Concreto, tijolo e madeira não têm fonte citada: pergunta ao dono abaixo.
- Tabela do arquivo (`ammo.json`):

| Load | kind | g | m/s | J | core / jacket | steel mm | concrete mm | brick mm | wood mm | basis |
|---|---|---|---|---|---|---|---|---|---|---|
| .22 LR lead round nose | rimfire | 2.6 | 350 | 159 | lead / none | 1.4 | 12 | 25 | 60 | estimated |
| .380 ACP FMJ | fmj | 6.2 | 295 | 270 | lead / gilding_metal | 2.2 | 20 | 40 | 80 | estimated |
| 9x18 Makarov FMJ | fmj | 6.1 | 315 | 303 | lead / steel | 2.6 | 22 | 45 | 85 | estimated |
| 9x19 FMJ 124 gr | fmj | 7.5 | 365 | 500 | lead / gilding_metal | 3 | 25 | 50 | 80 | estimated |
| 9x19 JHP | hp | 7.5 | 365 | 500 | lead / gilding_metal | 2 | 15 | 35 | 55 | estimated |
| .40 S&W FMJ | fmj | 11.7 | 310 | 562 | lead / gilding_metal | 3 | 28 | 55 | 85 | estimated |
| .45 ACP FMJ 230 gr | fmj | 14.9 | 254 | 481 | lead / gilding_metal | 2.8 | 28 | 55 | 85 | estimated |
| .45 ACP JHP | hp | 14.9 | 254 | 481 | lead / gilding_metal | 1.8 | 18 | 40 | 60 | estimated |
| 5.7x28 SS190 | fmj | 2 | 715 | 511 | lead_steel / gilding_metal | 4 | 25 | 50 | 100 | estimated |
| .38 Special lead round nose | fmj | 10.2 | 247 | 311 | lead / none | 2 | 20 | 40 | 70 | estimated |
| .357 Magnum JHP | hp | 10.2 | 396 | 800 | lead / gilding_metal | 3 | 25 | 45 | 90 | estimated |
| .44 Magnum FMJ | fmj | 15.6 | 440 | 1510 | lead / gilding_metal | 4 | 40 | 70 | 150 | estimated |
| .50 AE FMJ | fmj | 19.4 | 470 | 2143 | lead / gilding_metal | 4 | 38 | 65 | 130 | estimated |
| 12 ga 00 buck (one pellet) | buck | 3.5 | 414 | 300 | lead / none | 0.8 | 10 | 25 | 60 | estimated |
| 12 ga rifled slug | slug | 28 | 463 | 3001 | lead / none | 4 | 60 | 100 | 250 | estimated |
| 12 ga birdshot (one pellet) | birdshot | 0.2 | 400 | 16 | lead / none | 0.2 | 3 | 8 | 20 | estimated |
| 20 ga buck (one pellet) | buck | 1.3 | 400 | 104 | lead / none | 0.6 | 8 | 20 | 50 | estimated |
| 5.56x45 M855 (steel tip, lead core) | fmj | 4 | 935 | 1748 | lead_steel / gilding_metal | 4.5 | 90 | 180 | 280 | estimated |
| 5.45x39 7N6 (steel core) | fmj | 3.4 | 900 | 1377 | steel / steel | 5.5 | 90 | 180 | 280 | estimated |
| 7.62x39 M43 (steel core) | fmj | 8 | 725 | 2102 | steel / steel | 6.5 | 110 | 220 | 300 | estimated |
| .30-30 Winchester flat nose | fmj | 9.7 | 670 | 2177 | lead / gilding_metal | 3 | 80 | 160 | 250 | estimated |
| 7.62x51 M80 ball | fmj | 9.7 | 850 | 3504 | lead / gilding_metal | 5 | 120 | 250 | 330 | estimated |
| 7.62x54R LPS (steel core) | fmj | 9.6 | 865 | 3591 | steel / steel | 6.5 | 130 | 260 | 330 | estimated |
| .30-06 M1 ball | fmj | 9.7 | 880 | 3756 | lead / gilding_metal | 5.5 | 130 | 260 | 340 | estimated |
| .300 Win Mag FMJ | fmj | 11.7 | 900 | 4738 | lead / gilding_metal | 6.5 | 150 | 290 | 360 | estimated |
| .338 Lapua Magnum FMJ | fmj | 16.2 | 903 | 6605 | lead / gilding_metal | 8 | 190 | 360 | 450 | estimated |
| .408 CheyTac solid | fmj | 27.2 | 900 | 11016 | copper / none | 12 | 250 | 450 | 550 | estimated |
| Arrow (steel broadhead) | arrow | 25 | 90 | 101 | steel / none | 0.5 | 5 | 15 | 100 | estimated |
| Crossbow bolt | bolt | 20 | 122 | 149 | steel / none | 0.8 | 8 | 20 | 120 | estimated |
| 4.6x30 DM11 | fmj | 2 | 735 | 540 | steel / gilding_metal | 3.5 | 25 | 50 | 100 | estimated |
| .32 ACP FMJ | fmj | 4.6 | 276 | 175 | lead / gilding_metal | 1.8 | 15 | 30 | 60 | estimated |
| 9x19 tracer | tracer | 7.5 | 365 | 500 | lead / gilding_metal | 2.8 | 22 | 45 | 75 | estimated |
| 5.56x45 M995 AP (tungsten carbide) | ap | 3.6 | 1013 | 1847 | tungsten_carbide / gilding_metal | 10 | 110 | 210 | 300 | estimated |
| 5.56x45 M856 tracer | tracer | 3.95 | 914 | 1650 | lead / gilding_metal | 3.5 | 80 | 160 | 260 | estimated |
| 5.45x39 7T3M tracer | tracer | 3.4 | 900 | 1377 | lead / steel | 4 | 80 | 160 | 260 | estimated |
| 7.62x39 BZ API | incendiary | 7.7 | 720 | 1996 | hardened_steel / steel | 8 | 110 | 220 | 300 | estimated |
| 7.62x39 T-45 tracer | tracer | 8 | 725 | 2102 | lead / steel | 4.5 | 100 | 200 | 280 | estimated |
| 7.62x51 M993 AP (tungsten carbide) | ap | 8.2 | 930 | 3546 | tungsten_carbide / gilding_metal | 18 | 160 | 300 | 360 | published |
| 7.62x51 M62 tracer | tracer | 9.7 | 850 | 3504 | lead / gilding_metal | 4 | 110 | 230 | 320 | estimated |
| 7.62x54R 7N37 AP | ap | 9.6 | 865 | 3591 | hardened_steel / steel | 11 | 140 | 270 | 340 | estimated |
| 7.62x54R B-32 API | incendiary | 10 | 830 | 3445 | hardened_steel / steel | 10 | 130 | 260 | 330 | estimated |
| 7.62x54R T-46 tracer | tracer | 9.6 | 865 | 3591 | lead / steel | 4.5 | 110 | 220 | 300 | estimated |
| .30-06 M2 AP (hardened steel) | ap | 10.8 | 860 | 3994 | hardened_steel / gilding_metal | 10 | 140 | 270 | 340 | estimated |
| .30-06 M25 tracer | tracer | 9.7 | 880 | 3756 | lead / gilding_metal | 4 | 110 | 230 | 320 | estimated |
| .338 Lapua AP (tungsten) | ap | 16.2 | 903 | 6605 | tungsten_carbide / gilding_metal | 16 | 200 | 380 | 470 | estimated |
| .50 BMG M33 ball | fmj | 42 | 925 | 17968 | lead_steel / gilding_metal | 14 | 330 | 560 | 600 | estimated |
| .50 BMG M2 AP (hardened steel) | ap | 42 | 925 | 17968 | hardened_steel / gilding_metal | 22 | 350 | 580 | 600 | estimated |
| .50 BMG M8 API | incendiary | 42 | 925 | 17968 | hardened_steel / gilding_metal | 18 | 340 | 570 | 600 | estimated |
| .50 BMG M17 tracer | tracer | 42 | 925 | 17968 | lead / gilding_metal | 9 | 300 | 520 | 580 | estimated |
| 12 ga incendiary shell (one pellet, magnesium) | incendiary | 3.5 | 414 | 300 | none / none | 0.1 | 3 | 8 | 15 | estimated |

- Resultado contra vigas e pilares (`tests/beams-and-columns.test.ts`, "results table", lê a tabela acima; `PRINT_TABLE=1` imprime). Um tiro no meio de cada elemento, a 3 m:

| Munição | Energia (J) | aço (mm) | concreto (mm) | tijolo (mm) | madeira (mm) | pilar CA 30 cm | viga CA | viga I aço 8,5 mm | viga madeira 10 cm | pilar tijolo 40 cm |
|---|---|---|---|---|---|---|---|---|---|---|
| .22 LR lead round nose | 159 | 1.4 | 12 | 25 | 60 | não | não | não | não | não |
| 9x19 FMJ 124 gr | 500 | 3 | 25 | 50 | 80 | não | não | não | não | não |
| .45 ACP FMJ 230 gr | 481 | 2.8 | 28 | 55 | 85 | não | não | não | não | não |
| 5.56x45 M855 (steel tip, lead core) | 1748 | 4.5 | 90 | 180 | 280 | não | não | não | sim | não |
| 5.56x45 M995 AP (tungsten carbide) | 1847 | 10 | 110 | 210 | 300 | não | não | sim | sim | não |
| 7.62x39 M43 (steel core) | 2103 | 6.5 | 110 | 220 | 300 | não | não | não | sim | não |
| 7.62x51 M80 ball | 3504 | 5 | 120 | 250 | 330 | não | não | não | sim | não |
| 7.62x51 M993 AP (tungsten carbide) | 3546 | 18 | 160 | 300 | 360 | não | não | sim | sim | não |
| .50 BMG M33 ball | 17968 | 14 | 330 | 560 | 600 | sim | sim | sim | sim | sim |
| .50 BMG M2 AP (hardened steel) | 17968 | 22 | 350 | 580 | 600 | sim | sim | sim | sim | sim |
| 12 ga rifled slug | 3001 | 4 | 60 | 100 | 250 | não | não | não | sim | não |
| 12 ga 00 buck (one pellet) | 300 | 0.8 | 10 | 25 | 60 | não | não | não | não | não |

  Lê-se: a bola M80 (7,62x51) não fura a mesa de 8,5 mm da viga I e a M993 AP fura; a .50 BMG M33 (bola) fura o pilar de concreto armado de 30 cm; 5,56 e 7,62 de bola furam a
  viga de madeira de 10 cm e não furam o tijolo de 40 cm nem o concreto. Os goldens do mundo (`wall-golden`, `house-scenarios`) não mudam: nenhum usa `Hit.penetration`.

### Respostas do dono de 2026-10-25 às perguntas do PR #40 (física)

Decidido pelo dono em 2026-10-25 ("ok, pode seguir"): para cada pergunta vale o padrão proposto, que já estava em vigor no código.
1. **Números de ignição:** continuam um modelo do kit (não existe tabela pública por cartucho); ajusta-se contra uma fonte específica só se o dono trouxer uma.
2. **Chama e a curva de enchimento:** a incendiária com o tanque cheio acende 40% das vezes; a chama sente metade da curva (`flameFillInfluence 0,5`). Fica assim.
3. **Perfuração nos veículos:** continua decidida pela energia; a tabela por calibre (`ammo.json`) alimenta o `Hit.penetration` do motor genérico, e os veículos não passam a usá-la por ora.
4. **Faísca por metal:** alumínio 0,25 e outros metais 0,5, como está (aço e ferro 1, não metal 0).
5. **Filmes de fluido (`game-fluids`):** não contam como fonte de fogo perto, como está.
6. **Dois pilares e a carga que some:** a sustentação é a soma dos pilares (`structure.safetyFactor` na config); os dois pilares do time seguram porque parte da carga sai com as divisórias que caem, e o colapso não passa a sair só da soma com pilares mais fracos.
As quatro decisões de 2026-10-24 acima (tanque realista, pilares somados, granada sempre ligada, tabela de penetração por calibre) ficam como entregues no PR #40.

## T2.4

Porte literal do Casa3DSDK (`construir`, `planejaLOD`) e do AndaresSDK da página do time (`visor-casas-3d`, L39443-42734; `zombiada-modo-livre`, L7372-7557) para o pacote novo `@adatechnology/game-floorplan-three`. Cinco commits, na ordem do brief.

| Etapa | O que entrou |
|---|---|
| T2.4a | fecho `K` com 54 instaladores de módulo, acumuladores de geometria por grupo/material, materiais e texturas, locale (en, pt-BR), paredes + rodapé, portas, janelas, pisos, lajes, escadas, `build`/`dispose`; `userData.ranges` (faixa de vértices de cada peça) |
| T2.4b | lote (terreno, calçada, muro, portão), telhados e calhas, ladrilhos, espelhos (Reflector injetado), luzes, carros (frota injetada), fachadas, utilidades, edícula, tabela de tipos e construtores de mobília, torneiras, fixtures, plantas, quintal, colisão/itens/acessórios |
| T2.4c | ligação com a destruição: faixa de vértices por peça, fiadas de tijolo no LOD0 (`destruction/breach.ts`), marca de lascamento (spall), gaiola de vergalhão (via `game-destruction-three`) |
| T2.4d | alvo do olhar, navegação (AndaresSDK: grade de 10 cm, `blocked`/`FREE`, escadas), interação, mapa de móveis, varal, pontes de interativos e vegetação |
| T2.4e | golden de cena `vc3-house-scene` com 6 pares exatos (casaA 3, sobrado 3, apartamento 1, media_terrea_moderna 3, mercado 3, farmacia 2) e o plano de LOD |

**Efeitos:** o pacote não tem sistema de partículas próprio. Poeira, estilhaços, fagulhas, fogo e vazamento vêm do mundo de efeitos do `game-destruction-three` (fiadas, vergalhão, marcas) e do kit de interativos injetado; o vazamento da caixa d'água é só o estado (`water.leak(taxa)`, litros por segundo), sem desenho. Nada faltou em `game-vfx`, então nenhuma receita nova.

**Desvios:**
- Props: o `game-props3d` usa mulberry32 em vez do LCG do time; construtores como `bbq_simple`, atlas de quadros, cores do piso do lote e props de canteiro/plantas diferem da página. Os 6 pares do golden são exatos; outros não (casaA 1/2, sobrado 1/2, apartamento 2, popular_laje 1, popular_geminada 1, media_terrea_moderna 1/2, sobrado_medio_moderno 1-3, alto_padrao_contemporanea 1-3, mansao 1-3, apartamento_novo 1/2).
- Carros, interativos e Reflector ficam fora do golden (o `criar` da página não os recebe).
- `cfg.seedKey` mapeia ids novos para os ids legados nos sais do sorteio (ids `lp_`, `sw_`, `lamp_*_` mantidos) para o golden reproduzir.
- `AdaptadorInterativos` é código de jogo (diz o próprio cabeçalho): não portado; o adaptador é injetado.
- `breach.ts` (fiadas no LOD0) é desenho inferido: a spec só dizia "Falta para a T2.4c".
- A spec da estrutura é melhorada neste pacote (montagem nas paredes, vergalhão em laje/viga/pilar/escada de concreto): decisão minha.
- Sólidos da navegação: só colisores de parede/tabuleiro (vãos de porta ficam livres).
- `wallDetail` `panels`/`units` para a malha 3D e os botões do visor não foram portados.
- O Chrome do golden roda a three r160 da página; o `golden-tool` tem three 0.128 como devDependency.
- Node 24 indisponível: testado em 20 e 22.
- Partição das etapas difere do brief: construtores de mobília, colisão/itens/acessórios, edículas e utilidades caem em T2.4b porque luzes, espelhos e carros nascem dos construtores.
- Docs (README, MIGRATION, skill, catálogo, inventário) num commit à parte.

**Gate:**

| Etapa | build | typecheck | testes do pacote | lint |
|---|---|---|---|---|
| a | ok | ok | 39 | ok |
| b | ok | ok | 56 | ok |
| c | ok | ok | 70 | ok |
| d | ok | ok | 103 | ok |
| e | ok | ok | 118 | ok |

**Perguntas para o dono:**
1. Aceita a diferença do PRNG do `game-props3d` (mulberry32) nos pares fora do golden, ou o `game-props3d` passa a oferecer o LCG do time como opção?
2. O `flag userData.without` (original `userData.sem`) tem uso desconhecido: manter?
3. O AndaresSDK fica em `-three` como pediu o brief; o inventário 4.4/5.5 sugeria função pura em `game-floorplan` ou `game-navigation`. Qual?
4. Nome da área de teste: tasks.md diz `buildings-test-area`, a regra diz `examples/floorplan-test-area`.
5. O `AdaptadorInterativos` entra em algum pacote ou fica no jogo?

## T2.6

Módulo de teste das casas, exemplo e goldens contra o VC3 (T2.6a-c). Branch `work/t2-4`, commits `fix(floorplan-three)` aa2bc27, `feat(contracts,test-room)` 98ae206, T2.6a 4c38dd2, T2.6b a451571, T2.6c b13c881.

| Etapa | O que entrou |
|---|---|
| (fix) | `assembleStructure.spec` passa `contains`, `explodes`, `thickness`, `fill` e `tags` das peças para a spec: sem isso a caixa d'água e o botijão não chegavam ao mundo (a caixa nunca vazava). Teste novo em `destruction.test.ts` |
| (contratos) | `ModuleHost.addBlocker(fn)` e `ModuleHost.onClear(fn)` (opcionais), implementados em `game-test-room` (o jogador consulta os bloqueios com o raio dele; `clear()` avisa os módulos). Testes em `module-host.test.ts` |
| a | `createFloorplanTestModule` (`packages/game-floorplan-three/src/test-area/`): bancada com pacote (residencial, comercial, rural, pós-apocalíptico), tipologia, estado, semente, qualidade, LOD (manual ou por orçamento), 1 a 5 casas, orçamento, andar, golpe (rajada 9 mm, rajada 7,62, marreta, C4, RPG) e as ações construir, entrar, subir, descer, porta, golpe, restaurar, limpar; camadas telhado, lote e noite; 12 métricas. Cenários: os 6 do time (mesmos ids e checagens) e `floorplan_typologies`. `examples/floorplan-test-area` (build, test em pt-BR e en com Playwright, `?arena=` na sala) |
| b | `examples/interactables-test-area` carrega o módulo (relatório `floorplan`, checagem de 5 espécimes e 7 cenários no `test.mjs`) |
| c | `site/catalog.mjs` (entrada e família de plantas), `site/Dockerfile`, miniatura `site/thumbs/floorplan-test-area.jpg`, job `examples` do CI. Golden `house-area.json` movido para `packages/game-floorplan-three/tests/fixtures/team-golden/vc3-house-area.json` e comparado em `tests/team-golden-house-area.test.ts` (ids, número de checagens e booleanos, eventos fracture, collapse, hole, leak e explode) |

**Decisões e desvios:**
- As casas são do módulo, não itens da sala: ele as constrói com `house.destruction.activate()` no mundo da sala e a sala só as limpa (`onClear`). Os espécimes dos cenários são itens da sala, com malha de caixas nomeada pela peça como a página do time.
- Sem partículas próprias: poeira de rombo e de desabamento saem do desenhista de destruição da sala (`game-vfx`); o módulo não toca efeitos.
- `?arena=` (14 a 200) na página da sala: a arena padrão (14 m) é pequena para uma casa de 12 m e uma fileira.
- Os andares de cima são alcançados por teletransporte do olho (`up`/`down`); o jogador da sala não tem altura de piso e as escadas não são andadas.
- O grupo pós-apocalíptico lista só `triage_tent`; os estados `fortified` e `abandoned` valem para as outras tipologias.
- `house_two_pillars` usa o pórtico com a casa `townhouse` (a `single_storey_a` segura a laje nas divisórias). ~~Na sala, derruba os pilares seguintes até a laje cair~~ **[2026-10-24: resolvido, ver "Decisões do dono de 2026-10-24 (física)", item 2; o roteiro estendido saiu e o cenário roda com os dois pilares do time.]**
- Contagens de ticks de dano diferem do mundo do time; só os eventos de sentido e as checagens são comparados.
- Pós-fix, a tank d'água vaza 500 L para 496 L em 40 s com um tiro de 600 J (calibre 9).

**Gate:**

| Etapa | build | typecheck | testes do pacote | lint | browser |
|---|---|---|---|---|---|
| todas | ok | ok | 138 (floorplan-three) | ok | `floorplan-test-area/test.mjs` 22 PASS (pt-BR e en), `interactables-test-area/test.mjs` 22 PASS |

**Perguntas para o dono:**
1. Dois pilares do pórtico: o time derruba a laje; na sala (com o desenhista de destruição ligado) nenhum par de pilares a derruba e só o solver puro a derruba. Ajustamos a carga ou a capacidade dos pilares em `game-destruction`, ou o roteiro estendido (mais pilares) vale?
2. A `single_storey_a` segura a laje nas divisórias (o pórtico do time não tem divisórias portantes): a divisória portante é a regra certa do kit?
3. Os andares de cima devem ser andados (altura de piso no jogador da sala) ou o teletransporte basta?
4. Nome da área (pergunta 4 da T2.4): usado `floorplan-test-area`, como manda a regra.
## T5.3e (body) — o evento `body` dos personagens chega ao filme de fluidos

Ramo `int/p6b`, a partir da `main` com as Fases 0 a 6 (parte 1). O evento `body` (T4.0) já está no contrato; o que faltava era a ponte.

- **Onde mora a ponte**: no `createFluidsBridge` do `game-characters-three` (o pacote dos personagens não importa os pacotes de fluidos: recebe um `FilmSink` com o `splat` do `createFilmBridge`). `wounds.handle` já lia o `body`; agora, além do `sink.splash` de litros que existia, ele chama `bridge.wound(...)` no `wound` e `bridge.burst(change, ponto, look, direção)` no corte (`severed`), no estouro (`destroyed`) e na divisão (`split`).
- **Gotas**: `wound` joga 3 gotas de 3,2 mm a 2,5 m/s (`spray`); corte, estouro e divisão jogam 4, 7 e 10 (`burstDrops`), na direção de saída do evento (`exit`) ou do lado do membro; sem direção, caem retas. Os números são meus: o time só mostra gotas, a ponte do filme não tem conta por ferimento.
- **Cor da idade**: `WoundBody.blood` (`BloodLook`: `liquid?`, `tint { fresh, dry }`, `amount`). `bloodLookOfAge(idade)` lê o `ages.json` (`freshBloodColor`, `dryBloodColor`, `blood`): sangue fresco 0x8A0A0A / 0x3B1D14, recente 0x5A0C10 / 0x2E1810, antigo 0x3A1C12 / 0x2A160E, decrépito 0x1A1612. O fator `blood` escala as gotas (decrépito, 0, não joga nenhuma) e as idades com `blood < 0,3` sangram `old_blood` (limiar e líquido por opção). A área de personagens recebe `film` e `bloodOf(idade)` e põe o olhar no corpo do zumbi pela idade de `traitsOf(...).age`.
- **A sala**: `room.film` é a ponte do filme (`splat`, `setWeather`, `leaks`); `characters-test-area` e `interactables-test-area` passam `film: room.film`.
- **Testes**: `game-characters-three/tests/film-blood.test.ts` (6: cores de `ages.json`, ferida com cor e direção, ferida sem olhar, corte/estouro/divisão com 2/4/6 gotas a 60% de sangue, sangue antigo e corpo seco, sem filme só o mundo); `game-test-room` (`room.film.splat` cria uma grade); no navegador, `interactables-test-area` ferve um zumbi com um golpe de corte e confere o `splat` de sangue com `tint` e a grade `film_grid`.

### Perguntas para o dono
- Quantas gotas por ferimento (3, 4, 7, 10) e a regra do sangue antigo (`blood < 0,3`) são minhas. Quer outra conta (por energia do golpe, por exemplo)?

## T6.1g — vozes dos personagens e chamados dos bichos no `game-audio`

Ramo `int/p6b`, depois da Fase 4 (corpo e `body`) na `main`.

| O que | Onde |
|---|---|
| As primitivas da Cena (`sNoise`, `sTone`, `voice`) como camadas de receita, que antes moravam dentro do `destruction-three`: `sceneNoise`, `sceneTone`, `sceneVoice`, `sceneMany`, `sceneRecipe`. O `destruction-three` passou a importá-las (as receitas e os 12 traços dos materiais não mudaram) | `game-audio/src/recipes/scene.ts` |
| Banco dos corpos: 16 receitas. Do jogo (movidas dos suportes de teste do `game-audio`, onde esperavam o dono): `scream_hoarse` (`grito`, L62128), `groan` e `runner_groan` (`voz`, L62143). Da Cena: `groan_walker`, `groan_runner`, `groan_brute` (L1345), `scream` (L1347), `inhale` (L1348), `leap` (L1349), `grab`, `bite`, `hurt` (L1350-L1352, no ouvinte), `flesh`, `flesh_head` (L1353), `sever` (L1355), `gore` (L1356). Cada uma com a linha do time em `sources` | `game-characters-three/src/audio/recipes.ts` |
| Tabela de quem fala o quê nos 13 tipos | `game-characters-three/src/audio/voices.json` (`UNDEAD_VOICES`) |
| `createCharacterSound(host.audio)`: `voice`, `body`, `player`, `update`; estilo `art_scene` (padrão) ou `game`; vozes e regras de corpo trocáveis | `src/audio/sound.ts` |
| Os quatro chamados do `bichoSom` (L66625) e `createAnimalSound` com a recarga da página por bicho (6, 8, 30 e 3 s) | `game-animals-three/src/audio/{recipes.ts,calls.json,sound.ts}` |
| `createWounds({ sound })` toca ferimento, corte, estouro e divisão onde o segmento estava; a área de personagens ganhou as ações `voice` e `special_call` e a de bichos `call`, todas no motor que a sala empresta | `wounds.ts`, `test-area/module.ts` |

**Prova ("igual ao original")**: `game-characters-three/tests/audio.test.ts` (46 casos) roda cada receita no motor sobre o `AudioContext` falso, com a semente do fixture, e compara com o traço do código do time em `tools/golden/fixtures/audio`: `grito` a 5 distâncias, `voz('gemido')` a 4, `voz('corredor')` a 3, `groan` Lento/Corredor/Brutamonte, `scream`, `inhale`, `leap` em 3 posições, `grab`, `bite`, `hurt`, `flesh`, `flesh_head`, `sever` e `gore` (tolerância 1e-9). `game-animals-three/tests/audio.test.ts` faz o mesmo com os 4 chamados a 4 distâncias (16 casos). O limitador de vozes fica de fora dos traços (`groups` vazio no teste: o grupo `undead_voice` tem teste próprio, e o golden do limitador está no `game-audio`). Os casos `grito`, `voz` e `bichoSom` saíram do `team-trace.test.ts` do `game-audio` porque o dono agora é o pacote do assunto; o resto do arquivo ficou.

### Escolhas minhas (padrões reversíveis)

1. **A regra de classe da Cena vale para os 13 tipos**: Brutamonte tem o seu, velocidade de perseguição acima de 3,4 é gemido de corredor, o resto é de lento. Pelos números do `types.json`, farejador (3,5), saltador (4,5) e espreitador (4) gemem como corredor.
2. **Tipos sem som próprio no time** (Rastejante, Inchado, Espreitador, Cego, Carbonizado, Afogado, Farejador, Devorador): usam o gemido pela regra acima (`origin: 'rule'`). Dois ganharam um som extra da página mais perto da linha de voz do `types.json` (`origin: 'extra'`): Farejador inspira antes de rosnar (`inhale`, "Fungadas") e Devorador morde (`bite`, "Mastigar molhado"). O Espreitador fica calado parado ("Silencioso") e geme ao acordar. Nada foi sintetizado do zero.
3. **Grupo `undead_voice` só nos gemidos** (cinco ao mesmo tempo, um a cada 0,25 s, a menos de 40 m). Grito, inspirar e salto da Cena ficam fora do limite (o `grito` do jogo é chamado direto, `screamAt`, sem o orçamento). A Cena conta também o grito e o salto nos cinco do `AU.groans`; aqui só contam os gemidos.
4. **Alerta**: no estilo do jogo, todo corpo que percebe o jogador responde com `voz('corredor')` (L67275, L67328); no da Cena, com o gemido da sua classe.
5. **Gritador**: a sequência é inspirar, depois de 1,5 s (`windUpSeconds`) gritar; no estilo do jogo só o `grito`.
6. **Corpo ferido**: `wound` = `flesh` (`flesh_head` em cabeça e mandíbula), `severed` = `sever`, `destroyed` e `split` = `gore`; no estilo do jogo o `wound` é a classe `sfx_flesh`. A Cena chama `flesh`/`sever`/`gore` nas funções de dano (L1084, L1101, L1127, L1132, L1143), a ligação com os eventos `body` é do kit.
7. **Chamados dos bichos**: espécie -> chamado pelo gatilho do jogo (galinha, quero-quero, vaca, cachorro). O som do quero-quero dispara pela proximidade do jogador (`alarme`) no jogo; o kit só toca quando o anfitrião manda.

### Perguntas para o dono
- Os 8 tipos sem som no time (Rastejante, Inchado, Espreitador, Cego, Carbonizado, Afogado, Farejador, Devorador) e as 9 espécies sem chamado (cavalo, porco, javali, capivara, onça, gato, urubu, jararaca, rato) ficam com o gemido da regra, o som "extra" ou silêncio. Quer que o time de som entregue vozes novas, ou aceita as escolhas acima?
- O Espreitador fica calado enquanto finge morto: aceita?

## T6.2b — as pontes do clima e o som de chuva, vento e trovão

Ramo `int/p6b`, depois de T5.3e e T6.1g.

| O que | Onde |
|---|---|
| `createWeatherBridges(targets, options)`: cada alvo é opcional e uma interface pequena (o clima não importa nenhum dos pacotes que move). `film`, `interactables`, `vegetation`, `vfx`, `environment` (`EnvironmentBus`), `audio` (`AudioSink`); `bind(weather)` e `update(dt)` | `game-weather/src/bridges.ts` |
| Filme de fluidos: `Film.setWeather({ rain, drying })` (`drying` multiplica a secagem; o calor intenso passa `dryingScale` 2) e `Film.wash(maxDryness = 0,5)` (o `ZG.wipe(c, "chuva")` do visor L13489-L13494: só a mancha com menos da metade seca; sangue e sangue velho, óleo e combustível não), com `FilmManager.wash`, `FilmGrid.wash` (reenvia o retângulo lavado), `FilmBridge.wash` e a opção `washable` | `game-fluids/src/film/{film,types,simulate}.ts`, `game-fluids-three/src/film/{manager,grid,bridge}.ts` |
| Vento do vfx: `VfxWorld.setWind([x, y, z])` e `wind()` (`VfxOptions.wind` só dava o início) | `game-vfx/src/world.ts` |
| Receitas: `rain_loop` (Cena L1314, passa-alta 600 e passa-baixa 6000), `wind_loop` (Cena L1315, passa-baixa 320, LFO 0,07 Hz de 0,035), `rain_hiss_game` (jogo L62116) e `thunder` | `game-weather/src/audio/recipes.ts` |
| `createWeatherSound(audio)`: chuva 0,035 (chuva leve, 2,5 mm/h, a âncora do jogo) a 0,06 (forte, 15 mm/h, a âncora da Cena); vento 0,05 na brisa de 3,8 m/s e proporcional à velocidade, no máximo 0,12; o trovão toca no rumo do raio (graus no sentido horário a partir do norte, -z) quando o `thunder` do clima chega (o clima já espera `distância / 343` s) | `game-weather/src/audio/sound.ts` |
| A bancada do clima recebe `targets` e `sound` e liga as pontes ao `host.audio`; `room.vfx` expõe o mundo de efeitos da sala; as áreas `weather-test-area` e `interactables-test-area` passam `room.film` e `room.vfx` | `bench/module.ts`, `game-test-room`, `examples/*/src/entry.js` |

**Prova**: `game-weather/tests/sound.test.ts` roda os laços no motor sobre o `AudioContext` falso e compara com os traços do código dos times (Cena `chain` com chuva 0,06, vento 0,05 e fogo 0; jogo `loop.chuva` a 0,001, 0,035 e 0,3; tolerância 1e-9). `tests/bridges.test.ts` (8) cobre o que cada alvo recebe, só o que mudou, chuva leve sem lavar e forte lavando a cada segundo, calor, regras trocadas, troca de clima e trovão. `game-fluids` (secagem em dobro e lavagem pela metade), `game-fluids-three` (óleo não lava) e `game-vfx` (o fumo anda para o lado do vento) têm testes novos; no navegador, as duas áreas conferem que o vento da tempestade (4,5; 0) chega ao `room.vfx`, volta à brisa (3,5; 1,5) e que os laços abrem no motor da sala.

### Escolhas minhas (padrões reversíveis)

1. **Trovão**: o time não tem trovão. É o `boom` do jogo (seno de 70 a 28 Hz em 1,2 s) mais um ribombo de ruído passa-baixa que desce de 260 a 50 Hz em 3,2 s com envio de reverb. A curva é `1,4 / (1 + d² × 0,00001)`: com a do boom (0,002) um raio a 200 m, o mais perto que o clima sorteia, já chegaria a 0,017 e um a 4 km, a nada.
2. **Chuva do filme**: `rain = min(1, mm/h / 2,5)`, ou seja, a chuva leve já para a secagem por completo (a regra da folha: "não seca enquanto chove"); lavar só de 15 mm/h (chuva forte) em diante, a cada 1 s (decisão 9 da T6: a chuva leve não lava).
3. **Vegetação**: `strength = min(1, vento / 20)` (como na spec) e `gust = min(1, rajada / 20)` na mesma escala; a spec não diz a conta da rajada. Sem vento a direção não é enviada (o renderizador normaliza e um vetor zero a estragaria).
4. **Vento do vfx**: passa a ser o do clima (a brisa do `clear` é 3,5; 1,5 m/s, bem mais forte que o 0,55; 0,2 de partida do `game-vfx`); só muda onde o anfitrião liga a ponte (as duas áreas de teste).
5. **Vento da Cena**: o laço abre a 0,05 na Cena e o volume segue a velocidade a partir dali; a escala (0,05 a 3,8 m/s, teto 0,12) é do kit.

### Não migrado
- **A prateleira do showroom** (`interactables-showroom`) ainda liga chuva (60 mm/h) e vento (3,5; 1,5) à mão, com malha de chuva própria. As pontes aceitam o mundo de interativos e o `effects` do showroom, mas trocar os botões por estados do clima muda o comportamento da página (a chuva dela é uma malha); fica para quando a T6.2c entregar a chuva desenhada.

### Perguntas para o dono
- O trovão é do kit (ribombo e curva): quer outra conta, ou um som do time de áudio?
- Chuva leve lava o sangue? Hoje não (decisão 9); a folha diz "chuva lava", sem separar leve de forte.
- Vento do `vfx` com o vento do clima em todo anfitrião que ligar a ponte: aceita a brisa de 3,5; 1,5 m/s no lugar de 0,55; 0,2?

## T6.2c — o clima desenhado (`game-weather-three`) e a chuva, a neblina e os faróis da Oficina

Ramo `int/p6b`, depois de T6.2b.

| O que | Onde |
|---|---|
| Chuva da Oficina (W312-331): `RainField` em `engine.rain`, até 4 000 riscos num `Float32Array`, sorteios na ordem da página (`rnd(-15,15)`, `rnd(0,16)`, `rnd(-6,16)`; ao cair, 35 % de respingo a menos de `12/(1+qualidade)` m, 50 % de sprite e anel só em poça; volta em `rnd(14,17)`). A página não diz o que fazer com a caixa fora da origem: `drive(count, wind, centerX, centerZ)` é do kit e o golden nunca o chama | `game-vfx/src/workshop/rain.ts`, `effects/behaviors/rain.ts` |
| Os três efeitos da Oficina que a T5 deixou de fora: `chuva` (`rain_and_puddles`, 3 intensidades, 4 poças, relâmpago duplo no temporal), `neblina` (`fog_and_ash`, 3 zumbis, névoa 5/s e cinza 14/s) e `farol` (`headlights_in_rain`, 1 800 gotas, 6 zumbis na luz, 600 gotas acesas/s no feixe); a consulta `car.point` | `game-vfx/src/effects/{world/rain,world/fog-and-ash,vehicles/headlights}.ts`, `behaviors/car.ts` |
| Golden dos três na captura `vfx-workshop.js` (`mode=weather`): sequência de eventos, contagem de sorteios, contagem por quadro e hash do pool de chuva; 16 testes | `game-vfx/tests/weather-golden.test.ts`, `tests/fixtures/team-golden/vfx-workshop-weather.json` |
| `game-vfx-three` desenha o campo de chuva (`workshop-rain`, `LineSegments` 0x9fb3cf, opacidade 0,35) | `game-vfx-three/src/workshop-layers.ts` |
| Pacote novo `game-weather-three`: cortina de chuva do jogo (14 000 pontos, caixa de 70 m x 25 m, 13 m/s, shaders do `jogo.js` letra por letra), chuva perto (`createNearRain`, liga o `engine.rain` ao clima), névoa e cinza (`emitAirborne`), neblina linear e exp2 com zona (`fogOf`), céu (`createSky`), relâmpago (`createLightning`), faróis (`createHeadlights`), névoa de calor (`createHeatHaze`) e `createWeatherRenderer` | `packages/game-weather-three` |
| A bancada do clima aceita `visual` (`WeatherVisualFactory`); `createWeatherVisual` dá 7 camadas (pt-BR e en) e um suporte de lanternas diante da câmera; as duas áreas de teste ligam o visual (no `interactables-test-area`, com o céu da sala) | `game-weather/src/bench/module.ts`, `game-weather-three/src/bench`, `examples/*/src/entry.js` |
| Miniatura do clima: tempestade às 20 h, com chuva, céu escuro e os faróis do suporte | `site/thumbs/weather-test-area.jpg`, `site/catalog.mjs` |

**Prova**: `tools/golden/bin/record-weather-visual.mjs` corta o bloco da chuva do `jogo.js` (`const RAIN = 14000` até `skyUpdate`) e o roda num `vm` com três.js falso sob `Math.random` semeado; `fixtures/weather/game-rain-curtain.json` guarda o SHA-256 dos 42 000 floats, os shaders e as linhas de céu, neblina e zona. `tests/rain-curtain-golden.test.ts` (9) compara pontos bit a bit, shaders letra por letra e os números de céu, neblina, relâmpago, faróis, névoa e cinza com o texto das páginas; `tests/renderer.test.ts` (15) e `tests/bench-visual.test.ts` (2) cobrem neblina, céu, cortina por perfil, chuva perto (inclusive desenhada pelo `game-vfx-three`), relâmpago, faróis a 40 m, névoa de calor, camadas e a bancada. No navegador: `weather-test-area/test.mjs` confere a tempestade (cortina 14 000, 4 000 riscos, neblina linear de 110 m, suporte aceso), a neblina exp2 de 0,075 com névoa e cinza e o calor com a névoa; `interactables-test-area/test.mjs` confere a cortina e os 4 000 riscos sobre os móveis e o céu da sala intacto.

### Escolhas minhas (padrões reversíveis)

1. **Cortina por `drops`**: a cortina toda (14 000) aparece a 4 000 gotas (a tempestade); a chuva forte (2 200) desenha 55 % e a leve (900), 22 %; perfis `low` 0,35, `medium` 0,7, `high` 1. O jogo só tem chuva ou não; a escala é do kit (`fullAt`).
2. **Céu**: o `0,8` do jogo na chuva vira `skyScale` do estado (1 limpo, 0,9 chuva leve, 0,8 chuva forte, 0,7 temporal); o dia 0..1 é `sample.sun`.
3. **Neblina exp2**: onde o estado tem densidade (`fog` 0,075, `overcast` 0,03) usa `FogExp2`; a zona entra por uma densidade equivalente a `far` (`sqrt(ln 50) / far`). O jogo só tem neblina linear.
4. **Relâmpago**: o `hemi.intensity` e o fundo da Oficina são absolutos (0,6 + I x 3,2); aqui são acréscimos, para valer sobre o céu do dia (o fundo só muda com a camada `sky` ligada).
5. **Respingo**: a chuva da Oficina só respinga a partir da "chuva" (a garoa não); aqui, de 5 mm/h. Anéis só onde `puddleAt` ou `puddles` dizem que há poça (nenhuma por padrão; a Oficina tem 4 elipses fixas).
6. **Faróis**: acendem à noite (fator de noite > 0,3), com chuva, com neblina densa ou visibilidade menor que 150 m; luz de verdade só a menos de 40 m da câmera (texto `b` da página).
7. **Suporte de lanternas** da bancada: dois faróis e um bloco com as lentes `hlMat`. Não é carro: o time de veículos entrega os carros e o `game-vehicles-three` ainda não existe; quando existir, o `headlights.attach(carro, lente)` já serve.

### Não migrado
- **Névoa de calor com distorção**: nenhum time entregou; a camada é uma faixa quente que sobe na parte de baixo da tela. Distorcer a imagem pede um alvo de render, que só o anfitrião tem.
- **A prateleira do showroom** (`interactables-showroom`) segue com a chuva de malha própria (ver T6.2b); trocá-la pela cortina muda a página.

### Perguntas para o dono
- A cortina com 22 % a 55 % da chuva na chuva leve e na forte (e 100 % só no temporal) está certa, ou a chuva do jogo (14 000 sempre) vale para todo estado com chuva?
- Névoa de calor: quer o time de efeitos para a distorção de verdade, ou a faixa quente basta?
- Faróis: a regra "noite, chuva ou neblina" liga os faróis de qualquer carro do mundo. O jogo decide por veículo (o motorista), ou o clima pode ligar todos?

## T5 (restante) — clarão, fumaça, sopro do lançador e jato de chama da arma na mão sobre o `game-vfx`

Ramo `int/p6b`, depois de T6.2c. Feito em duas passadas: f49e466 trouxe as receitas com sprites; a segunda passada (pedido do coordenador: "proibido reescrever parecido") trocou os sprites pelos sólidos da galeria.

| O que | Onde |
|---|---|
| O `createEffects` da galeria (clarão: um cone aberto de 10 lados, quatro cones de 6 lados e uma esfera de 12 por 8, aditivos, `0,6 + min(1, idade/0,055) x 0,9` de escala; luz laranja de `4 k` a `2 k` m; seis esferas de fumaça de 10 por 8) vira a receita `viewmodel_muzzle_flash`; a `smoke(posição, velocidade, tamanho, vida, opacidade)` vira `weapon_smoke_puff`; o sopro de trás do lançador (26 esferas de fumaça e 14 icosaedros de fogo, `launchRocket`) vira `launcher_backblast`; os icosaedros e a fumaça do `flameJet` (`floor(dt x 420 x escala)` por quadro) viram `flame_jet`. As receitas estão nos eixos da arma (x no cano, y para cima, z à direita), como a galeria | `game-vfx/src/effects/weapons/viewmodel.ts` |
| Primitiva nova: partícula de sólido (`MeshSpawn`: cone, cone aberto, esfera, icosaedro, com segmentos, material aditivo ou iluminado, `at`/`rot`/`roll` de grupo, `ramp`, `grow`, `drag`, gravidade, giro, opacidade que some), com o mesmo passo por quadro do `Particles` da galeria (idade, opacidade, gravidade, arrasto, movimento, giro, crescimento) | `game-vfx/src/workshop/meshes.ts` (`MeshPool`), passo `mesh` em `effects/steps.ts`, desenho em `game-vfx-three/src/mesh-layer.ts` (uma `Mesh` por partícula, geometria e material dela) |
| A orientação inteira da arma (o quaternion, com a inclinação e o rolar) chega à receita: `EffectRequest.orientation` no contrato, `PlayOptions.orientation`, `Placement.orientation` (posições e velocidades giram com ele; sem ele, só pelo eixo vertical como antes) | `game-contracts/src/effects.ts`, `game-vfx/src/effects/player.ts`, `workshop/engine.ts` |
| A luz do clarão segura a força nos 55 ms e apaga (`flash(..., force, steady)`), como a luz da galeria; antes a luz do Workshop caía com o quadrado da idade | `game-vfx/src/workshop/waves.ts` |
| Números nomeados: `PlayOptions.values` (lidos com `variable(nome)`) e `EffectRequest.values`; a expressão `exp` | `game-vfx/src/effects/{player,instance,expression,dsl}.ts` |
| Sorteios na ordem da galeria, de um fluxo próprio da receita: cada `play` tira uma semente do fluxo do viewmodel (uma tirada) e a receita sorteia da semente na ordem em que a galeria sorteava (ângulo dos quatro cones, rolar do grupo, velocidade e vida de cada fumaça; no lançador e no jato, a ordem de `heavy.ts`) | receitas e `game-weapons-three/src/fx/effects.ts` |
| `game-weapons-three` toca as receitas pelo `host.effects` (`createWeaponFx({ effects })`); sem `host.effects` (visualizador sozinho) cria um mundo de efeitos próprio (`createVfxRenderer`, como a `destruction-three`), atualizado e apagado junto com o viewmodel. Ficam como malha: cápsulas, pentes, o foguete em voo (e o cone e a luz do escape), as gotas em chamas e as três chamas no chão | `game-weapons-three/src/fx/{effects,heavy,viewmodel}.ts`, `box-fx.ts`, `fx.ts`, `area.ts` |

**Prova**
- `tools/golden/bin/record-viewmodel-flash.mjs` roda `fx/effects.ts` e `fx/particles.ts` do commit d15e990 (antes de f49e466), sem mudar uma linha (só transpilados), no three.js de verdade e com um fluxo sorteado de semente fixa, e grava `tools/golden/fixtures/weapons/viewmodel-flash.json`: em três cenários (cano reto, inclinado e girado, 100 e 60 quadros por segundo) e 13 quadros cada, as peças do clarão (geometria e seus números, material, posição e giro no mundo, escala), a luz (intensidade, distância, decaimento, cor, posição) e as esferas de fumaça (raio, segmentos, posição, escala, opacidade).
- `game-vfx-three/tests/viewmodel-flash.test.ts` toca a receita pelo `createVfxRenderer` com a mesma semente e compara tudo com 9 casas. Passa nos 39 quadros.
- `game-vfx/tests/viewmodel-effects.test.ts` (10) confere a ordem dos sorteios do clarão, o passo por quadro da fumaça e, número a número, o sopro do lançador e o jato de chama contra o laço de `heavy.ts` (reescrito no teste com o mesmo fluxo de sementes), com o cano reto e com o cano inclinado.
- `game-weapons-three/tests/viewmodel-effects.test.ts` (7) confere o que a arma pede ao `host.effects` (ids, quaternion e números), o tiro, o lançador e o lança-chamas na sala de testes, e o visualizador sem `host.effects` (peças do clarão e luz nos dois primeiros quadros, só a fumaça depois). Os goldens do `game-weapons-three` seguem os mesmos; nenhum foi regravado.

### Diferenças que sobram em relação à galeria
1. **A luz não precisa de divisão por π**: o coordenador pediu `intensidade / π`, supondo que o `game-vfx-three` multiplica as luzes do Workshop por π. Quem multiplica é a camada de luzes do Laboratório (`lightScale`, padrão π). A camada do Workshop, onde a receita toca, usa escala 1 (`createWorkshopLayers(..., 1)`), então a receita pede `4 k` e a luz sai com `4 k`, igual à da galeria (o teste compara a intensidade quadro a quadro com a gravada). Dividir por π a deixaria π vezes mais fraca.
2. **O sorteio sai do fluxo do viewmodel**: o clarão não tira mais 29 números do fluxo do viewmodel, tira um (a semente). Os números que a receita sorteia são os mesmos que a galeria sortearia com o fluxo `lehmer(semente)` (o teste prova); o que muda é o que o viewmodel sorteia depois (cápsulas, giro), que deixa de depender do clarão. Nenhum golden depende disso.
3. **Sem `host.effects`, o mundo próprio usa o perfil `medium`** e a câmera que o viewmodel recebeu; as luzes do Workshop do mundo próprio são quatro, e a do clarão é forçada (aparece mesmo com a qualidade baixa do hospedeiro).

### Perguntas para o dono
- Sem `host.effects` o visualizador cria o próprio mundo de efeitos (um `VfxWorld` por viewmodel). Quer que vários viewmodels no mesmo cenário dividam um só (uma opção `vfx`), ou um por arma está bem?
- O sopro do lançador e o jato de chama agora giram com o cano inteiro; a faísca e o fogo do foguete em voo (cone e luz do escape) seguem como malha da `game-weapons-three`. Quer o escape do foguete também como receita (precisa de um passo que acompanhe a malha do foguete)?

### Fase 7: efeitos e som dos veículos, depois do merge das fases 2 a 6 (T7.6 a T7.8)

- Merge de `origin/main` em `int/p7` (5a697df), conflitos resolvidos mantendo os dois lados; o `interactables-test-area` carrega efeitos, som, clima, casas, veículos, vegetação e urbano (36/36 no navegador).
- Efeitos dos veículos (T7.6): o módulo pede ao `host.effects` no formato do `EffectSink` os ids `car_fuel_tank` (explosão da Garagem, do catálogo), `glass_burst`, `impact_metal` e `vehicle_fire`, `vehicle_exhaust`, `vehicle_leak`. Estes três são apelidos ancorados no carro da Oficina de `engine_smoke` e `fuel_leak`, com os valores do time; nada de partícula nos pacotes de veículos. No navegador os cenários pedem `vehicle_fire` 17x, `glass_burst` 13x, `impact_metal` 3x, `vehicle_leak` 3x e `car_fuel_tank` 1x.
- Vegetação e urbano (T7.7): folhas, fibras, lascas, fogo, cinza e faíscas já saem do renderizador de destruição no mundo de efeitos da sala (`burst:leaves` 18x, `fibers` 14x, `fire`, `sparks`), e o teste de vegetação trava isso. Seiva não tem receita nem valor de time; os postes do urbano são lajes ancoradas (sem destruição), então não há faísca de poste.
- Som dos veículos (T7.8): `host.audio` com o banco da biblioteca (`engine_saw` com volume 0,035 + v x 0,003 e frequência 38 + v x 7, `horn`, `sfx_impact`); vidro, impacto e explosão já tocam pelo som de destruição da sala. Vegetação e urbano: nenhum som de time além de `leaves_rustle`, que não existe no banco.

## T8.0 — Desenho da Fase 8 (multidão, histórias e jogador)

> 🤖 Modelo: `opus`

**O que foi feito**

- `design/T8-multidao-historias-jogador.md`: mapa de fontes linha a linha (jogo `2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`: horda 66717–67400, bichos
  66592–66715, jogador 68427–68640, civis 70042–70170; Bancada de Hordas 53053–53300 e mapa vivo 53483–53643; Personagens; Os Vivos do Vale
  6–757), o que o SDK já tem, pacotes (`game-player`, `game-crowd`, `game-crowd-three`, `game-stories`, conteúdo no `game-characters-people`),
  contratos, goldens, áreas de teste e subtarefas com modelo.
- `tasks.md`: tabela de subtarefas da Fase 8.

**Dúvidas para o dono** (cada uma com padrão reversível, §8 do desenho)

1. Comportamento dos civis por estágio do surto: não há código, só o texto "Multidão civil".
2. Histórias de demonstração do kit: só existem as do ZombiAdA.
3. Nomes dos pacotes (`game-crowd`, `game-crowd-three`, `game-player`, `game-stories`).
4. Vozes de 7 tipos de zumbi (T6.1g ainda aberta).
5. Andares e telhados do jogo (`ANDARES`, `ROOF`) não portados; a multidão recebe callbacks.
6. Mais de um alvo: o jogo persegue só o jogador; a multidão recebe uma lista e escolhe o mais perto.
7. Marcos de habilidade da ficha que citam horda e zumbi ficam literais no conjunto genérico.
8. Infecção do jogador desligada por padrão; a regra zumbi usa `INFEC`/`FERIDA` do jogo.

## T8.3 — `game-player` (jogador: fôlego, ferida, infecção individual, agarrão)

> 🤖 Modelo: `sonnet` (feito nesta sessão pelo opus)

**O que foi feito**

- `packages/game-player` (puro, sem three, IIFE `GamePlayer`): porte literal de G 68427-68640 (`player`, `playerUpdate`, `frontZombies`, `shove`,
  `knife`) com `FICHA`, `DERIV`, `INFEC`, `FERIDA`.
  - Mundo, multidão e entrada viram argumentos: `PlayerWorld` (`cellKind`, `solidAt`, `blocked`, `inWater`, `busy`, `canVault`, `afterMove`),
    `PlayerCrowd` (`hold`, `stun`, `chase`, `damage`) e `PlayerInput` (teclas seguradas e `pressed` só no quadro, como o `wasPressed` do jogo).
  - Todo número está em `src/data/defaults.json` com a linha de origem; derivados como fórmulas lineares em dado.
  - Infecção individual **desligada por padrão** (mundo normal primeiro); `infection: true` liga a regra do jogo, com o sorteio na mesma ordem.
  - Saídas por evento (`noise`, `sound` no formato de `SoundRequest`, `message` por id, `hurt`, `died`, `turned`...); frases do jogo em `pt-BR` e `en`.
- Golden `packages/game-player/tests/fixtures/team-golden/game-player.json`: `tools/characters-catalog/src/golden/vm-player.ts` corta do jogo `player`,
  `playerUpdate`, `frontZombies`, `shove`, `knife`, a grade (`GC`, `occ`, `cellOf`, `solidAt`, `fillRect`, `solidAtA`), `POOL`/`inWater` e a tabela `Z`, e roda
  **18 roteiros** em `node:vm` (andar, correr até esgotar, agachar e mirar, feridas, mordida até a morte pela infecção, agarrão com 6 empurrões, com faca,
  com mordida no fim, sem mandíbula, afogado, água e fogo, pular muro baixo, paredes, empurrão e faca, ser empurrado pela multidão e pânico, derrubada).
  O teste do pacote refaz os 18 com o SDK e compara evento por evento e estado a cada N quadros: **18 de 18 iguais**.
- Bancada `createPlayerTestModule` (`player_area`, só contratos genéricos): a câmera da sala é o jogador; golpe, mordida, agarrão, empurrão, faca,
  curativo, derrubada, agachar, infecção, agilidade, vigor, semente; 6 cenários (`player_*`); passos e carne em `host.audio`.
- `examples/player-test-area` (`sala-jogador.html`) e carregada também em `examples/interactables-test-area`.
- Site (`catalog.mjs`: exemplo e família `player`; miniatura `site/thumbs/player-test-area.jpg`), `site/Dockerfile`, CI (job `examples`), README,
  skill `.claude/skills/game-player/SKILL.md`, `game-kit` skill, changeset, inventário (`veiculos-moveis-vegetacao-jogo.md` §3.4).

**Comandos e resultados**

```text
pnpm build                                              -> ok
pnpm -r typecheck                                       -> ok
pnpm lint                                               -> ok
pnpm --filter @adatechnology/game-player test           -> 31 passed (golden 18/18, ficha, feridas, bancada)
characters-catalog-tool vitest --testTimeout=60000      -> 69 passed (game-player regravado 2x idêntico ao fixture)
node dist/record-golden-vm.js --check                   -> os 6 goldens vm idênticos
node examples/test-room/build.mjs                       -> ok
node examples/player-test-area/build.mjs && test.mjs    -> 7 PASS (pt-BR e en: relatório limpo, 6 cenários, golpe e mordida, 6 empurrões soltam)
node examples/interactables-test-area/build.mjs && test.mjs -> 24/24 (inclui "the player module is loaded too (6 scenarios pass)")
```

**Desvios e dúvidas**

- Fora do porte (ficam no jogo ou em outro pacote): carro (`carUpdate`), assento (`c3AssentoUpdate`), telhado (`ROOF`), andares (`ANDARES`),
  arremesso (`throwItem`: só sai o evento `throw`), o corpo visível (`PB`) e a mira (`view`). O jogo os liga por `busy`, `canVault`, `blocked`, `afterMove`.
- A reanimação do jogo usa `setTimeout` e sorteia o tipo do zumbi; aqui o tempo é de jogo (`turned` depois de `reanimateSeconds`) e o tipo é do jogo.
- As frases "O AFOGADO TE PUXA…", "Não há cura" e "Morto pela horda" são do jogo e ficam literais no `pt-BR`; um jogo troca o texto por id.

## T8.1a — `game-crowd` núcleo (a horda do jogo como multidão genérica)

> 🤖 Modelo: `sonnet` (feito nesta sessão pelo opus)

**O que foi feito**

- `packages/game-crowd` (puro, sem three, IIFE `GameCrowd`): porte literal de `jogo.js` G 66714-67430 (`Z`, `zSpawn`, `zRemove`, `flowStart`,
  `flowStep`, `losClear`, `hordeUpdate`, `groan`, `screamAt`, `zAttack`, `zDamage`, `zKill`, `inchadoBurst`, `corpseAdd`, `corpsesUpdate`, `spawnAway`,
  `populationUpdate`, `groundAt`, `zBlockedAt`, `tryStep`, `stepRelease`, `pileBlast`, `trailUpdate`, `zSpecialSpawn`, `zAbility`, `zChaseSpeed`,
  `zHurtOther`, `killQ`, `zFrame`) e das portas (G 63796-63816 `DOORS`/`addDoor`/`setDoor`, G 64044 `doorHit`).
  - `createNavGrid` (a grade de 0,5 m com códigos e alturas, `losClear`, `blocked`), `createDoors`, `createStore` (os campos do jogo em inglês, com os
    mesmos tipos de array para os floats arredondarem igual).
  - Os 13 tipos viram **traços** (`vaultsLow`, `pounce`, `heavySwing`, `doorDamage`, `hitStun`, `soundSeeker`, `caller`, `burns`, `waterWeak`,
    `submerged`, `ambush`, `burst`, `eatsCorpses`, `tracker`, `maxAge`, `voice`, `panicWeight`, `drownGrab`, `color`/`skin`): o núcleo não conhece
    nenhum tipo pelo nome; `plugins` acrescentam movimentos.
  - Todo número em `src/data/defaults.json` com a linha de origem; o tempo do flow lê `flow.clock` (padrão `performance.now`, `() => 0` termina cada
    campo num quadro, como no golden).
  - Alvo no formato `CrowdTarget` (o `Player` do `game-player` serve como está) e `asPlayerCrowd()` para o `PlayerCrowd` do jogador.
  - Sem alvo ninguém persegue (mundo normal primeiro). Sons (`groan`, `runner_groan`, `scream_hoarse`, `step`, `impact`, `flesh`, `wood`), efeitos
    (`spark`, `blood`, `limb`, `cloud`, `dust`) e mensagens por id saem como evento, para o jogo levar a `host.audio` e `host.effects`.
- `game-characters-undead`: `undeadCrowdPack()` (`src/data/crowd.json`, escrito à mão do jogo com as fontes) com os 13 tipos, idades, roupas, segmentos e
  paleta da horda, e cada habilidade como traço. `game-characters`: o livro de corpos ganhou `remove(index)` (o Devorador come um corpo).
- Golden `packages/game-crowd/tests/fixtures/team-golden/game-crowd.json`: `tools/characters-catalog/src/golden/vm-crowd.ts` corta tudo isso do jogo (mais
  a grade, `BANDS`, `CORPOS_MAX`, `walkCad`, as portas, `POOL`) e roda **8 cenas** em `node:vm` com o laço na ordem do jogo (orçamento do gemido, rastro,
  horda, população, corpos): perseguição, alerta em cadeia e vagas; noite, agachado e olfato; pirâmide num muro de 60 m; porta derrubada pelo
  Brutamonte; saltador, inchado, gritador, espreitador, afogado na piscina, cego com ruído, carbonizado; corpos, Devorador, rastro e Farejador
  levando Lentos; dano por região, calibre e roupa (capacete, colete, mandíbula, desmembramento); população com sobra removida e migração.
  O teste do pacote refaz as 8 com o SDK e compara evento por evento (alvo, som, mensagem, efeito) e o estado de cada agente a cada N quadros:
  **8 de 8 iguais**. Uma mutação (`separationPush` 2,2 → 2,3) derruba 6 das 8.
- `evaluateGameSlice` ganhou `capacity` (a tabela `Z` do golden da multidão tem 400 vagas; os outros goldens seguem com 8 e não mudaram).
- README, skill `.claude/skills/game-crowd/SKILL.md`, linhas no README raiz e na skill `game-kit`, skill e README do `game-characters-undead`, changeset,
  inventário (`veiculos-moveis-vegetacao-jogo.md` §3.4).

**Comandos e resultados**

```text
pnpm build                                              -> ok
pnpm -r typecheck                                       -> ok
pnpm lint                                               -> ok
pnpm --filter @adatechnology/game-crowd test            -> 19 passed (golden 8/8, grade, portas, API)
pnpm --filter @adatechnology/game-characters-undead test -> passou (inclui undeadCrowdPack)
pnpm --filter @adatechnology/game-characters test       -> passou (inclui remove do livro de corpos)
characters-catalog-tool vitest --testTimeout=60000      -> passou (game-crowd regravado idêntico ao fixture)
node dist/record-golden-vm.js --check                   -> os 7 goldens vm idênticos
node examples/test-room/build.mjs                       -> ok
node examples/interactables-test-area/build.mjs && test.mjs -> 24/24
```

**Desvios e dúvidas**

- Os efeitos do jogo (`fxSpark` sorteia 24 vezes, `fxBlood`, `fxCloud`, `fxLimb`) gastavam o mesmo `R()` da simulação; aqui saem como evento e não
  gastam o `random` da multidão. O golden grava a simulação com os efeitos como registro, sem sorteio: num jogo com os efeitos do time a sequência
  global de `R()` muda, a da multidão não.
- `undeadCrowdPack()` usa os números do jogo (`CATS`), que diferem da tabela do Bestiário em `types.json` em quatro velocidades de perseguição (cego 3,0
  contra 1,6; carbonizado 2,2 contra 1,6; afogado 2,5 contra 1,2; devorador 3,0 contra 2,4) e no peso do afogado (0 contra 1). Os sentidos por idade
  seguem o jogo (visão 0,6 no decrépito, audição 0,9 a partir de antigo); `ages.json` tira também 30% do olfato do decrépito, o jogo não.
  **Dúvida:** qual tabela vale para o jogo final?
- Um alvo só (`target`), como o jogo; a lista de alvos da pergunta 6 do desenho fica para os civis (T8.1b, `setHunt`).
- Andares (`ANDARES`) e telhado (`ROOF`) não portados (pergunta 5); `floor` fica em cada agente. A cena com o jogador no telhado, em que a parede da
  casa vira muro escalável, não existe aqui.
- `popTarget` vinha de `?pop=` na URL; aqui é opção de `updatePopulation`, e a migração (ponto de entrada, largura, destino, 120 a cada 90 s) também.
- Bancada, `game-crowd-three` e `examples/crowd-test-area` entram no T8.1c.

## T8.1b — civis, bichos, revoada e a ponte com o `game-infection`

> 🤖 Modelo: `sonnet` (feito nesta sessão pelo opus)

**O que foi feito**

- `createCivilians` (`packages/game-crowd/src/behaviours/civilians.ts`): porte literal de `jogo.js` G 69960-70175 (`pontos`, `rota`, `npcZombies`,
  `zChaseNpc`, `npcMorre`, `npcVira`, `npcMove`, `npcUpdate`). Rotina por hora, medo (3,4 m/s com agente a menos de 6 m, criança ×0,85, mordido ×0,8),
  grupo que segue o líder ou o alvo, fuga por um caminho (`gone` no fim), portas abertas no caminho, agentes que caçam quem está a menos de 10 m e mais
  perto que o alvo, golpe a cada 1,5 s, mordida (×1,5 da chance do tipo) e a virada depois de 120 s (o agente leva o índice do civil em `named` e
  patrulha a rua). O núcleo não tem nome, fala, rádio nem diário: saem os eventos `bitten`, `died`, `turned`, `gone`, e o jogo escreve as linhas.
- `createHerd` e `HERD_ROLES` (`behaviours/herd.ts`): `bichoLivre`, `zumbiPerto`, `bichosUpdate` (G 66601-66700) sem o rig. Vagar e descansar 4 a 11 s,
  fugir do alvo e dos agentes, companheiro 2,2 m atrás, cacarejo (30 m), alarme do quero-quero (12 m, 40 m, voa 4 s), mugido (80 m), latido (60 m sob
  12 m) e rosnado; os chamados são ruídos que a multidão ouve. Os papéis de cada espécie vêm de `bichosPovoar` (G 66607-66623). A velocidade usa
  `walkHz`/`runHz` do `game-animals-species` e o tamanho do `game-animals` (`quadrupedLayout`, `birdSize`).
- `createFlock` e `carrionCenter` (`behaviours/flock.ts`): os urubus do jogo (G 66700-66708: centro dos corpos com 3 ou mais, senão a carcaça) e o anel
  de 40 pássaros do mapa vivo da Bancada de Hordas (G 53609-53615), pelas fórmulas literais.
- `bindInfection` (`behaviours/infection.ts`): sem código dos times (decisão P12); `materialize` vira agentes no lugar que o jogo dá, a morte de um deles
  volta à região como `removed`, os de longe voltam com `giveBack`, a mordida de civil vira `infect`. Testado com o `game-infection` de verdade.
- `undeadCrowdTypes()` do desenho já entrou no T8.1a como `undeadCrowdPack()`.
- Goldens `game-crowd-civilians.json` (3 cenas: rotina com porta e caça, grupo que segue e depois foge, mordida que vira) e `game-crowd-herd.json`
  (quintal e fazenda com cão companheiro, gato, galinhas, quero-quero, vacas, cavalo, porco, capivara, vaca morta e 3 urubus, com a horda). O harness
  de `vm-crowd.ts` corta do jogo o código dos civis e dos bichos e roda na ordem do laço (rastro, civis, bichos, horda, corpos). **4 de 4 iguais**.

**Comandos e resultados**

```text
pnpm build                                              -> ok
pnpm -r typecheck                                       -> ok
pnpm lint                                               -> ok
pnpm --filter @adatechnology/game-crowd test            -> 32 passed (goldens 8 + 3 + 1, comportamentos, ponte)
characters-catalog-tool vitest --testTimeout=60000      -> passou
node dist/record-golden-vm.js --check                   -> os 9 goldens vm idênticos
node examples/test-room/build.mjs                       -> ok
node examples/interactables-test-area/build.mjs && test.mjs -> 24/24
```

**Desvios e dúvidas**

- O `bichoNovo` do jogo monta o rig antes (que sorteia a fase da animação) e depois sorteia rumo e descanso; o SDK sorteia só rumo e descanso, como
  o golden: a fase é do desenho (`game-animals-three`).
- O corpo de um civil morto entra no livro de corpos pelo `add` (que troca o mais velho quando cheio); o jogo escrevia na vaga 0 quando cheio.
- Os textos do jogo (mordida, reanimou, latido "zumbi a N m", quero-quero) viram ids e distância; o jogo escreve as frases.
- O líder do grupo e a distância da criança (`davi` segue a `helena` a 1,2 m) viram `leader` e `followDistance` da pessoa.
- **Dúvida:** comportamento dos civis por estágio do surto (pergunta 1 do desenho) segue sem código dos times; `bindInfection` não muda a rotina.

## T8.1c — `game-crowd-three` (o desenho da multidão e a área de teste)

> 🤖 Modelo: `sonnet` (feito nesta sessão pelo opus)

**O que foi feito**

- `createCrowdInstances` (`packages/game-crowd-three/src/instances.ts`): porte literal de `hordeRender` (`jogo.js` G 67098-67136) e `npcRender`
  (G 70177-70184), sem three.js. Corte pela vista (passado √30 m, atrás da vista mais que `0,35·d + 3` m; nada além de 200 m), LOD 18/55 m com
  histerese de 1,5 m guardada em `store.lod`, pose de ataque que entra a 1,6 m e sai a 2,2 m guardada em `store.attackPose` (a simulação a lê, como
  no jogo), pose por estado (`INSTANCE_POSES` do `game-characters`), inchaço do Inchado, olho apagado sem crânio ou dormente, corpos no chão na
  própria variante (perto até 18 m) que escurecem 70% e encolhem nos últimos 60 s, corpo de quem não era agente no lote simples, e os civis (criança
  0,66 × 0,75, mordida aparecendo). Números em `src/data/render.json` com a linha de origem; poses por opção.
- `createCrowdRenderer`: os tipos assados como em `ZVAR` (G 67079: `variantDecay`, `variantSeed`, detalhe 1, 0,5 e 0,28, lotes 160/700/2600) com
  `bakeBody`, `createVariantBatches`, `createBodyBatch` e `buildInstancedBody` do `game-characters-three`; um tipo é assado na primeira vez que
  aparece. Corpos de civis assados a 0,8 em lotes de 4 (G 68469 `PB`), o corpo dado pelo host. `lodCounts` contado depois dos corpos, como o jogo.
- `createHerdView`: os bichos do `createHerd` com os rigs do `game-animals-three` (posição, rumo, `animate` com o clip; G 66697-66699) e os urubus do
  `createFlock` planando com as asas de G 66707.
- `CROWD_SOUND_BANK`: o grito rouco e os gemidos (`grito`, `voz`, G 62128-62155) e os chamados dos bichos (`bichoSom`, G 66625-66639) como receitas
  do `game-audio`, as mesmas que o `game-audio` confere contra os traços dos times; `HERD_SOUND_IDS` liga `bark`/`cluck`/`lapwing`/`moo` a elas.
- `createCrowdTestModule` (`crowd_area`, só contratos genéricos): horda do pacote que o host passa, desenhada pelo renderizador, caçando a câmera da
  sala como corpo do `game-player`; civis, bichos, região do `game-infection`; sons por `host.audio` (o banco é registrado lá), efeitos por
  `host.effects` (`CROWD_EFFECTS`). Nove cenários. `examples/crowd-test-area` (300 agentes, conteúdo do kit) e a `interactables-test-area` (vazia).
- Golden `game-crowd-render.json`: o harness de `vm-crowd.ts` corta do jogo `hordeRender`, `npcRender`, `walkGait`, `ZB`, `CB`, `_c1`, `LOD_D`,
  `NPC_COL` e troca `BodyBatch` e `THREE.Color` por registradores; desenha todo quadro (a pose de ataque volta à simulação) e grava, a cada batida,
  o que o desenho leu (números exatos como texto) e cada instância. As 11 cenas da horda e dos civis: **11 de 11 iguais**, instância por instância.
  Mutações (`agePer`, `corpseDarken`, `civilianSkinStep`, `behindMargin`) quebram o teste; a histerese (1,5 → 1,4) não é exercida pelas cenas e fica
  coberta pelo cenário `crowd_lod` e pelo teste unitário.

**Comandos e resultados**

```text
pnpm build                                              -> ok
pnpm -r typecheck                                       -> ok
pnpm lint                                               -> ok
pnpm --filter @adatechnology/game-crowd-three test      -> 22 passed (golden 11 cenas, instâncias, renderizador, banco, área)
pnpm --filter @adatechnology/game-crowd test            -> 32 passed
pnpm --filter @adatechnology/game-audio test            -> 169 passed
characters-catalog-tool vitest --testTimeout=60000      -> 73 passed
node dist/record-golden-vm.js --check                   -> os 10 goldens vm idênticos duas vezes e iguais ao fixture
node examples/test-room/build.mjs                       -> ok
node examples/crowd-test-area/build.mjs && test.mjs     -> 9/9
node examples/interactables-test-area/build.mjs && test.mjs -> 26/26
```

**Desvios e dúvidas**

- O golden de cena por hash das matrizes (tabela 5 do desenho) virou o golden das instâncias do `hordeRender`: compara os 12 números do shader, a
  cor, o olho e a altura de cada corpo, que é o que vira matriz.
- `s` e `bulk` das variantes no golden são números fixos: o assar já é conferido pelo golden do `game-characters-three` (os 60 `bakeBody` de `ZVAR`).
- O `PB` do jogo tem cinco lotes e prende os civis além do quarto no último; o harness usa um lote por civil (os números da instância são os mesmos).
- Os andares do jogo (`ANDARES`) seguem fora: `frame.hidden(i)` deixa um agente de fora.
- O laço `crowd_rumble` continua na biblioteca do `game-audio` (a horda do jogo não o toca no `hordeRender`).
- O `game-audio` mantém a cópia das receitas de grito, gemido e chamados nos testes para não depender do `game-crowd-three`.
- A miniatura do site precisou de 60 s no swiftshader para a primeira imagem (a página assa os tipos que aparecem).
- **Dúvida 11 do desenho:** efeitos da multidão na sala (padrão `CROWD_EFFECTS`).
- **Dúvida 12 do desenho:** corpo de cada civil (padrão: o host dá; a área usa os três corpos sem retrato de G 68469).


## T8.2 — `game-stories` (histórias, escalação, crônica, ficha e vida sorteada)

> 🤖 Modelo: `opus`

**O que foi feito**

- `packages/game-stories` (novo, global `GameStories`): porte literal de Os Vivos do Vale (`life()` 623-739, `world()`, `apply`, `simulate()` 744-756
  e o motor de `EV`/`ACTS`/`fill`) e da ficha de Personagens. Histórias como dados (momentos com papéis, variantes em que a primeira que vale ganha,
  condições `all`/`any`/`not`/`action`/`flag`/`state`/`living`/`base`/`value`/`self`/`changed`/`remembers`, pedaços de texto e mudanças), a escalação
  (P9: pessoa fixa, alguém que serve, ou alguém feito dos pools de nomes, num fluxo próprio `seed ^ 0x9e3779b9`), a crônica, a ficha (P13: compra de
  pontos, derivados, habilidades e marcos, memória até 30 e opinião de −100 a 100) e a vida sorteada. Números em `src/data/life.json` e
  `src/data/sheet.json` com a linha de origem; textos da vida em `src/data/life-text.json` (pt-BR literal e en).
- Mundo normal primeiro: `infection: false` por padrão (a faixa de mordida fere, ninguém reanima); `infection: true` é a regra do time.
- `game-characters-people`: `SHEET_RULESET` (`ATTRS`, `SKILLS`, `PROFS`, `TRAITS`, `derived`) e `NAME_POOLS` gerados das fontes, conferidos literalmente
  por `tools/characters-catalog/tests/sheet-sources.test.ts`.
- Conteúdo do vale para o jogo em `game-slice/stories/` (`cast.json` 45 pessoas, `stories.json` com os 47 `EV` em 13 histórias, `roles.json` com
  Cícero e Sandra como papéis, `actions.json`, `life.json`), gerado por `catalog:game` (`slice-stories.ts`, `build-slice.ts`).
- Golden `game-stories-life.json` (`vm-stories.ts` corta do código do time `GROUPS`, a seção da vida e `byId`; e da ficha `ATTRS`, `SKILLS`, `PROFS`,
  `TRAITS`, `S`, `pool`, `derived`): 7 vidas inteiras linha a linha (estado final, comida, casais, gente gerada, afinidade), 40 vidas por hash, 96
  conjuntos de ações só com eventos e 48 fichas. **Todas iguais.** Mutações (chance da caravana 0,12 → 0,13; uma palavra de um texto) quebram 1 e 9
  testes. A adoção não acontece nas vidas do golden e fica num teste unitário.
- Bancada `createStoriesTestModule` (`stories_area`, só contratos genéricos): semente, dia (até 365), vida sorteada, mordidas, a pessoa da ficha e as
  ações; contadores do dia; seis cenários (determinismo, escalação, mundo normal, a ficha guarda o vivido, compra de pontos, histórias que se cruzam);
  a ficha e a crônica no painel da sala. Conteúdo de exemplo do kit (`STORIES_EXAMPLE`, marcado `example`) até o jogo carregar o dele
  (`module.load(content)`). `examples/stories-test-area` (`sala-historias.html`, com botão de arquivo JSON) e a `interactables-test-area`.

**Comandos e resultados**

```text
pnpm build                                              -> ok
pnpm -r typecheck                                       -> ok
pnpm lint                                               -> ok
pnpm --filter @adatechnology/game-stories test          -> 24 passed (golden 10, histórias, bancada)
pnpm --filter @adatechnology/game-characters-people test -> 11 passed
characters-catalog-tool vitest --testTimeout=60000      -> 80 passed
node dist/record-golden-vm.js --check                   -> os goldens vm idênticos duas vezes e iguais ao fixture (com game-stories-life)
node examples/test-room/build.mjs                       -> ok
node examples/stories-test-area/build.mjs && test.mjs   -> 7/7 (6 cenários, dia 25, a fatia do vale até o dia 90, pt-BR e en)
node examples/interactables-test-area/build.mjs && test.mjs -> 28/28
```

**Desvios e dúvidas**

- O motor não conhece o vale: `GROUPS`, `NPCS`, `RELS`, `EV` e as tabelas da vida são opções (`LifeOptions`) e conteúdo do jogo.
- A base do grupo do jogador é opção (`playerBase`; o vale usa `jogador`).
- Sem ninguém em idade de vínculo, não há chegada naquele dia (o código do time quebrava; nenhum sorteio é gasto, o golden não muda).
- Fardados (`FACT`, `RANKS`, `LOOT`, `GENT`) e `JOIN` não entraram no T8.2.
- **Dúvidas 13 a 19 do desenho:** faixa de mordida sem infecção, decaimento da opinião (1 por dia), que memória sai depois de 30, histórias de exemplo
  do kit, chegada sem vínculo possível, sorteio da ficha (`drawSheet`), ordem da escalação.
- **Merge de `origin/main` e integração pendentes:** o coordenador pediu o merge de `origin/main` antes do último commit e que `game-crowd` e
  `game-player` usem o que está lá (ruas e veículos do `game-urban`, vegetação para manada e revoada). O merge foi recusado pela verificação de
  permissão da sessão e não foi tentado de novo; a integração espera essa permissão.

## AdaptadorInterativos no kit (`game-floorplan-interactables`)

Resposta do dono à pergunta 5 da T2.4/T2.6 (2026-10-24): o `AdaptadorInterativos` entra no kit, genérico e configurável, e passa a ser o padrão da opção
`interactives` do `game-floorplan-three`. Branch `work/adapter`, a partir de `origin/main`.

**Fonte:** IIFE de `site/pages/sala-de-testes/area-casas.html` (L36290, 1040 linhas, v0.3.0). As cópias de `pages/jogo/visor-casas-3d.html` e
`pages/jogo/zombiada-modo-livre.html` são idênticas (conferido com `diff`). A cópia literal está em
`packages/game-floorplan-interactables/tests/fixtures/team-golden/adaptador-interativos.js` (sha256 `0cc377e6248bbbad3b49c82e7b8b864f3449442923a0c32a2d53f4129d72d7c4`).

**Pacote escolhido, pelo grafo de dependências:** pacote novo e puro, `packages/game-floorplan-interactables`.
- Depende só de contratos: recebe `GameInteractables` e `GameInteractablesHousehold` por opção (sem dependência de runtime), e lê a planta do motor (`game-floorplan`).
- Não pode ir em `game-floorplan` (o motor da planta não conhece o kit de interativos; seria dependência nova do núcleo), nem em `game-interactables-household` (o household não conhece planta), nem em `game-floorplan-three` (three.js só no adaptador `-three`; o adaptador não usa three.js).
- O `game-floorplan-three` passa a depender dele (é o padrão de `interactives`); o inverso não existe, então não há ciclo. Mesmo molde de `-fleet`, `-species`, `-household`.

**O que mudou na tradução (tabela completa em `packages/game-floorplan-interactables/MIGRATION.md`):**

| Original | Novo |
|---|---|
| `criar`, `planejar`, `criarMundo`, `adicionar`, `bloqueadoDe`, `pontoDe`, `especProprio` | `create`, `plan`, `createWorld`, `add`, `blockedOf`, `pointOf`, `ownSpec` |
| `MAPA_TIPOS` (88 tipos), tabela de conteúdo (114), cadeiras, pontos de água, preferência, substitutos | `TYPE_MAP`, `CONTENT_MAP`, `CONTENT_BY_GROUP`, `CHAIR_TABLES`, `FIXTURES_OF_POINT`, `PREFERENCE`, `OBJECT_SUBSTITUTES`: registros; chave `null` tira a entrada |
| `regiao` (`br`), `locale` (`pt-BR`) | `region`, `locale`, com os valores do time como padrão |
| frases dos avisos | `messages` (`en` e `pt-BR`; o `pt-BR` é a frase do time) |
| ids criados (`entrada_energia`, `quadro`, `medidor`, `gas_encanado`, `#aereo`, `#armario`, `#cadeiraN`) | `service_entrance`, `panel`, `meter`, `piped_gas`, `#overhead`, `#cabinet`, `#chairN` |

Nada do ZombiAdA está no código: os valores do time são o padrão das opções. Sem `Math.random` (todo sorteio sai da semente).

**Verificação contra o código do time:** `tests/team-golden.test.ts` roda o IIFE original num `vm` sobre uma planta com a forma do `PlantasSDK`, reconstruída da planta do kit (tradutor
inverso nos testes), e compara a resposta, depois de renomeada, com `toEqual`:
- `plan`: 17 tipologias x 3 sementes, mais os estados fortified e abandoned, `night`, `floor`, origem e `inw` (espelhado);
- `world.serialize()` e o resultado de `add` (dobradiças viradas, objetos afastados) em 7 casas;
- `blockedOf` numa grade de pontos;
- chaminé (lareira, fogão a lenha, por id) e os conteúdos vindos do catálogo de bens.
Os testes de registro (`tests/adapter.test.ts`) cobrem `typeMap` com `null` e com troca, `contentMap`, fallback por grupo, `preference`, cadeiras, `seedKey`, textos e erro de kit faltando.

**Ligação no `game-floorplan-three`:** `interactives.adapter` ficou opcional (padrão `FloorplanInteractables`); aceita objeto com `plan/add/createWorld/blockedOf` ou fábrica com `create`.
Novas opções: `interactives.adapterOptions` (vai para `create`), `locale` do renderizador e `seedKey` do renderizador repassados. O aviso de `interactives` incompleto continua (sem `GameInteractables`, `GameInteractablesHousehold` ou `GameInteractablesThree`).
Foram corrigidos erros de tradução da ponte (`bridge.ts`): `ent.floorKind` virou `ent.floorY`, `plane.picture` virou `plane.panel`, `mats.floorKind` virou `mats.floor`.
Esses três nomes estavam errados na ponte (o plano usa `floorY`, `panel` e o material `floor`), e só apareceriam com um adaptador de verdade.
Área de teste: `examples/floorplan-test-area` agora entrega as três bibliotecas e a casa nasce com objetos do kit, sem adaptador injetado pela página; a `interactables-test-area` herda (carrega o módulo das casas).

**Desvios:**
- O adaptador do time lê o resultado do `PlantasSDK`; o porte lê a planta do kit (nomes em inglês, `contents` como pilhas do catálogo, `utilities`). É porte literal com troca de chaves, provado pelo teste diferencial.
- Conteúdo: `nome_pt` some (o item tem nome próprio) e `data` da pilha não leva idade nem estado; a correspondência de 31 ids da tabela padrão da estrutura para o household foi derivada pelo nome.
- `FROZEN_ITEMS` substitui a checagem do time pelo nome "congel".
- A chaminé não tem vínculo com item no tipo `Chimney` do kit: a regra (id `chimney.fireplace` / `chimney.stove`, senão a primeira lareira ou fogão a lenha pelo `kind`) foi inferida; nenhum modelo rural emite chaminé hoje.
- Gás de acampamento: liga o primeiro `camp_stove` ao primeiro `gas_canister`.
- As sementes dos objetos que o adaptador cria diferem das do time (ids renomeados); `seedKey` reproduz as antigas, e os testes usam `teamSeedKey`.
- O modo de luz vem de `electrical.mode`.

**Comandos e resultados**

```text
pnpm build                                                    -> ok
pnpm typecheck                                                -> ok
pnpm lint                                                     -> ok
pnpm --filter @adatechnology/game-floorplan-interactables test -> 93 passed (golden contra o IIFE do time 70 + 4, registros 19)
pnpm --filter @adatechnology/game-floorplan-three test         -> 142 passed (4 novos: adaptador padrão, adapterOptions, adaptador injetado)
game-interactables 153, game-interactables-household 1911, game-interactables-three 82 -> passed
game-test-room                                                 -> 145 passed; 1 (dinamite com pavio) estourou o tempo com a máquina carregada e passou sozinho
node examples/test-room/build.mjs && floorplan-test-area/build.mjs && interactables-test-area/build.mjs -> ok
node examples/floorplan-test-area/test.mjs                     -> 24/24 (pt-BR e en; a casa nasce com 83 objetos do kit, 9 lâmpadas, sem aviso)
node examples/interactables-test-area/test.mjs                 -> sem falhas (EXIT 0)
```

**Perguntas para o dono:**
1. A renomeação dos ids criados pelo adaptador (`service_entrance`, `panel`...) muda as sementes de uma cena salva com os ids do time. Aceita, ou o jogo passa `seedKey`?
2. A regra da chaminé e a do gás de acampamento foram inferidas; o time não dá o vínculo na planta. O `Chimney` do `game-floorplan` deve ganhar o id do item que ele serve?
3. Os 31 ids de conteúdo da tabela padrão da estrutura foram casados com o household pelo nome; a lista está em `MIGRATION.md`. Alguém do time de itens confere?

**Respostas do dono de 2026-10-25 (PR #37):** decidido pelo dono em 2026-10-25 ("ok, pode seguir"); valem os padrões propostos.
1. Os ids renomeados ficam; o jogo que quiser as sementes antigas das cenas salvas passa `seedKey`.
2. O `Chimney` do `game-floorplan` não ganha o id do item que serve por ora; a regra da chaminé e a do gás de acampamento seguem inferidas.
3. Os 31 ids casados por nome com o household ficam como estão (lista em `MIGRATION.md`); a conferência pelo time de itens não bloqueia.

## 2026-10-24 · A sala de testes abre só com o conteúdo do SDK

O dono perguntou se os itens de `/test-room/` eram os do jogo: não eram (19 itens procedurais de caixa e cilindro, `demoItems`, mais um carro de aluguel de caixas, `DEMO_MODULE`). Decisão do dono: "remover todos esses itens e deixar apenas dos sdk". Feito:

- `game-test-room` perdeu `demoItems`/`DEMO_ITEMS`/`DEMO_MATERIALS`, os cenários embutidos (`SCENARIOS`, `scenariosFor`, `makeScenarios`, que usavam esses ids e a ferramenta `pistol_9mm`) e os textos deles. Fica só `brickWallSpec` (parede-alvo da arena). Os cenários de destruição, fluido e fogo que eles cobriam já existem nos testes de `game-destruction`/`game-fluids` e nos cenários de módulo dos pacotes de conteúdo; nenhum foi portado porque nenhum tinha item real equivalente sem cenário próprio (pendência: cenário de módulo para o extintor apagando fogo e para o fogo em estofado, se quisermos manter essa cobertura).
- `examples/test-room` carrega o mesmo conjunto de `examples/interactables-test-area` (o `entry.js` dele é embutido na página; a sala "nua" sem itens fica em `examples/test-room/base/` e é sobre ela que as outras áreas se constroem). `demo-module.js` foi removido.
- Os testes do pacote usam `tests/fixtures/demo-items.ts` (não exportado).

### 2026-10-24 · Cobertura dos cenários removidos da sala, reescrita com itens reais

Cada cenário embutido que a sala trazia foi para o módulo do pacote dono do item real, ou já tinha equivalente:

| Cenário removido | Onde está agora |
|---|---|
| `steel_through_hole`, `concrete_stops_bullet`, `shotgun_splinters_crate`, `hammer_dents_drum`, `torch_melts_steel` | `game-weapons-three` (`src/scenarios.ts`, alvos `target_steel_plate`/`target_plywood`/`target_concrete`, `pistol_9mm`, `barrett_m82a1`, `shotgun_pump_12`, `hammer`, `cutting_torch`). O 9 mm só amassa a chapa de 10 mm (realista); o furo que atravessa é do .50 BMG do Barrett (com a ammo.json, o 7,62x39 comum não fura 10 mm). A escopeta fura o compensado com vários chumbos, não estilhaça. |
| `extinguisher_puts_out_fire`, `throw_chair_at_wall`, `wrong_tool_refused` | área de móveis (`examples/interactables-test-area/src/scenarios.js`): `sofa_fire_extinguished`, `chair_thrown_at_wall`, `wrong_tool_refused` (chave inglesa na dobradiça da geladeira) |
| `glass_shatters` | já existiam `tv_screen_shatters` e `shower_glass_shatters` |
| `kick_chair_leg`, `kick_detaches_leg_via_tool` | já existiam `chair_kicked_apart` e `camp_chair_kicked` |
| `lighter_burns_crate` | já existe `sofa_burns` |
| `one_column_roof_stands`, `two_columns_roof_collapses` | já cobertos pelos cenários de desabamento de `game-floorplan-three` |
| `gas_bottle_explodes` | já existe com o mesmo nome |
| `screwdriver_shelf_board`, `bucket_melts_drips`, `bottle_drop_shatters`, `coffee_three_sips`, `tilt_cup_spills`, `jerrycan_leaks_fuel`, `fuel_stain_burns` | **sem item real equivalente**: dependem de recipiente com líquido (xícara, garrafa, balde, galão) ou de prateleira de tábuas, que não existem como item destrutível com `fluid` no SDK. Pendência: quando os itens de recipiente entrarem, escrever os cenários no pacote que os entregar. |

Também: `zombie_behind_door` falhava só depois de ~45 cenários na mesma sala porque marcava o ponto do log pelo tamanho da lista, e o log guarda só os últimos 5000 registros; passou a marcar pelo `seq`.

## 2026-10-25 · Estrutura real, passos 1 e 2 (tração com vergalhão, alvenaria portante)

Desenho em `design/T10-estrutura-real.md`. O concreto racha na tração e o vergalhão segura; a viga sem aço parte; a parede portante do térreo esmaga quando há andares demais (conferido com o Monadnock: 16 andares pedem 1,49 m na base, o prédio tem 1,8 m).

- **Goldens:** nenhuma mudou, nem de time (`vc3-*`) nem auto-goldens. A flexão vale por padrão só para peças com `structure.rebar` (`scope: 'rebar'`); as casas do `game-floorplan` e as cenas de `game-destruction` usam só a gaiola `reinforcement` e ficam como estavam. Com `scope: 'reinforced'` mudariam `gate-rpg-collapse` e `house-scenarios` (auto) e `house_one_pillar`/`house_partition` do `game-floorplan-three` cairiam: a laje de 8 x 12 m e 12 cm do sobrado não é uma estrutura real em flexão (T10 §5).
- **Testes antigos ajustados:** as capacidades documentadas do pilar e da parede (agora pela resistência real); as lajes de teste de `structure`, `size-structure`, `size-roles`, `collapse-timing` ganharam `structure.rebar` (laje armada, como no real); o pórtico de `beams-and-columns` que perde o pilar central agora é dimensionado com `redundancy` (o vão dobra, a viga precisa de aço para isso); o pórtico "forte" da cascata ganhou aço declarado.
- **Testes novos:** `game-destruction/tests/flexure.test.ts` (fórmulas; viga de CA na explosão racha e segura; sem aço parte; rótula depois de explosões repetidas; torre de tijolo esmaga no térreo no 18º andar com paredes de 19 cm; Monadnock; pórtico de 10 andares com divisórias fica de pé e a divisória cai sem levar a laje) e `game-floorplan-structure/tests/flexure.test.ts`.
- **Portões:** `pnpm build`, `pnpm typecheck`, `pnpm lint` ok; testes de `game-destruction` (230), `game-destruction-three` (112), `game-floorplan-structure` (263), `game-floorplan-three` (142), `game-test-room` (145), `game-interactables-three` (304) ok; `examples/test-room/build.mjs`, `floorplan-test-area` e `interactables-test-area` build + `test.mjs` ok (capturas reescritas revertidas).

## 2026-10-25 · Estrutura real, passo 2 da ordem: solo e estacas (lacuna 3)

Desenho em `design/T10-estrutura-real.md` §8. Com `soil` na spec a fundação se apoia no solo: sapata e radier como molas elastoplásticas (tensões básicas da NBR 6122, FS 3), estaca por Décourt-Quaresma, o objeto como corpo rígido com desaprumo de 1/200 e P-delta.

- **Cenários:** prédio de 20 andares em sapatas sobre argila mole afunda, inclina pelo lado estreito e tomba a ~9° (`settle` → `collapse`); o mesmo em estacas até a areia compacta fica com 2 cm e não se mexe; casa de 2 andares em radier sobre argila rija não tem evento nenhum e as tensões da casa ficam iguais às do terreno fixo (em `game-destruction` com `buildFrame` e em `game-floorplan-structure` com `toDestructibleSpec({ soil, foundation: 'raft' })`).
- **Goldens:** nenhuma mudou. O solo só vale para quem declara `soil`; nenhuma cena, golden de time (`vc3-*`) ou auto-golden declara. `game-floorplan-three` não foi tocado.
- **Testes novos:** `game-destruction/tests/soil.test.ts` (14), `game-destruction-three/tests/soil-settle.test.ts` (1), `game-floorplan-structure/tests/soil.test.ts` (4). Nenhum teste antigo mudou.
- **Portões:** `pnpm build`, `pnpm typecheck`, `pnpm lint` ok; testes de `game-destruction` (244), `game-destruction-three` (113), `game-floorplan-structure` (267), `game-floorplan-three` (142), `game-test-room` (145), `game-interactables-three` (304) ok; `examples/test-room/build.mjs`, `floorplan-test-area` e `interactables-test-area` build + `test.mjs` ok (capturas reescritas revertidas). Na rodada com tudo junto o vitest do `game-floorplan-structure` acusou um `Timeout calling "onTaskUpdate"` do worker (carga da máquina, 267 testes passando); sozinho passou limpo.

## 2026-10-25 · Estrutura real, passo 3 da ordem: núcleo, pele de vidro, cobertura plana e andar técnico (lacunas 4, 6, 7, 8)

Desenho em `design/T10-estrutura-real.md` §9. Presets em `game-floorplan-structure/src/tower.ts` (`buildTower`, `addCore`, `addCurtainWall`, `addFlatRoof`, `addMechanicalFloor`); no motor, `buildFrame({ continuousColumns, columnCage, roofThickness })` e, no contrato, `contains.outflow`.

- **Cenários:** torre de 12 andares em repouso a 0,65 e sem evento; pórtico de 20 andares fica de pé com pilares contínuos (sem eles a viga do 1º andar fica a 1,69); 5 kg de TNT a 1 m derrubam um pilar e só abrem brecha no núcleo (mais de metade dos pontos de vida, nada do núcleo nem das lajes cai); 1 kg a 3 m da fachada quebra mais de 6 painéis em `shatter` com pedaços de até 0,6 m sem quebrar estrutura; tiro na manta dá `leak` de água para baixo e o nível cai; o andar técnico põe ~44 t na laje de baixo e o reservatório vaza com tiro.
- **Goldens:** nenhuma mudou (opções novas desligadas por padrão; `game-floorplan-three` não foi tocado).
- **Testes novos:** `game-destruction/tests/frame-systems.test.ts` (3), `game-floorplan-structure/tests/tower.test.ts` (8). Nenhum teste antigo mudou.
- **Portões:** `pnpm build`, `pnpm typecheck`, `pnpm lint` ok; testes de `game-destruction` (247), `game-destruction-three` (113), `game-floorplan-structure` (275), `game-floorplan-three` (142), `game-test-room` (145), `game-interactables-three` (304) ok; `examples/test-room/build.mjs`, `floorplan-test-area` e `interactables-test-area` build + `test.mjs` ok (capturas revertidas).

## 2026-10-25 · Estrutura real, passo 4 · vento e balanço (lacuna 5)

- **Cenários:** torre de 40 andares com núcleo fica de pé com deriva 1/589 (dentro de H/500) e flecha de 0,221 m; sem núcleo (dimensionada ao vento) a deriva é 1/169 e passa do limite; o amortecedor de 0,85% reduz o desvio-padrão do balanço a cerca de 0,73; casa de 2 andares quase não sente (0,02 mm).
- **Goldens:** nenhuma mudou (vento desligado por padrão).
- **Testes novos:** `game-destruction/tests/wind.test.ts` (35), `game-floorplan-structure/tests/wind.test.ts` (11). Nenhum teste antigo mudou.
- **Pendências para o dono:** H/500 contra H/1700 da NBR 6118; tabela 1 da NBR 6123 transcrita da memória; padrão V0 = 40 m/s e categoria III.

## 2026-10-25 · Clipes de ataque do jogador (soco, empurrão, chute, recuo do tiro)

Nenhum time entregou pose de golpe (Elenco, Bestiário e o jogo só têm a regra: `shove` e `knife` do jogo, sem animação). Os clipes foram escritos no kit como dado no formato `PoseClip`, em `game-characters-people/src/data/attack-clips.json` (`ATTACK_CLIPS`, textos das fases em `ATTACK_CLIP_LOCALES`, pt-BR e en). O núcleo `game-characters` continua só com os dois clipes do Bestiário.

| Clipe | Canais | Duração | `impact` |
|---|---|---|---|
| `punch_right` | upper | 0,35 s | 0,16 s |
| `shove_two_hands` | upper | 0,50 s | 0,26 s |
| `front_kick` | full | 0,60 s | 0,32 s |
| `recoil_rifle` | upper | 0,22 s | 0 s |
| `recoil_pistol` | upper | 0,18 s | 0 s |

- **Regra do `game-player`:** o empurrão e o golpe corpo a corpo valem no quadro da tecla, sem preparação própria; o `impact` do clipe é o momento em que o jogo que tocar o clipe deve aplicar o efeito (ou o jogo atrasa o efeito até ele). O atordoamento do empurrão (`shoveStun` 0,9 s) cobre a recuperação do clipe (0,50 − 0,26 s), e um teste confere.
- **Área do avatar** (`game-characters-three`): os quatro botões desabilitados saíram; cada clipe registrado tem seu botão e o `impact` vira uma linha JSON `{"type":"avatar","action":"impact",...}` no log. Opções novas do módulo: `clipLocales`. O exemplo `player-test-area` registra `ATTACK_CLIPS`.
- **Testes:** 22 novos em `game-characters-people` (amostragem sem NaN, pose neutra no início e no fim, um único `impact` dentro da janela, fases em ordem, textos) e 3 em `game-characters-three` (juntas existem no corpo, `upper` deixa as pernas ao andar, botões e `impact` no log); `examples/player-test-area/test.mjs` toca os cinco clipes em pt-BR e en e grava uma captura por golpe em `shots/strike-*.png`.


## 2026-10-25 · Braços e mãos em primeira pessoa, golpes no impacto

Nenhum time entregou braços, mãos nem pose de golpe em primeira pessoa (o jogo só tem a regra de `shove` e `knife`); tudo foi escrito no kit, sem reaproveitar entrega.

| O que | Onde |
|---|---|
| Contrato de alvos das mãos (`HandTargets`, `HandTargetSource`, `ModuleHost.setHandTargets`) | `game-contracts/src/hands.ts`, `module.ts` |
| Formato do clipe em primeira pessoa e amostragem | `game-characters/src/pose-clips/first-person-clip.ts` |
| Clipes `punch_right`, `shove_two_hands`, `front_kick` (mesmas durações e instantes de impacto de `ATTACK_CLIPS`: 0,16 / 0,26 / 0,32 s) | `game-characters-people/src/data/first-person-clips.json` (`FIRST_PERSON_CLIPS`) |
| Braços, mãos, IA de dois ossos, posturas `relaxed`/`fists`/`hold`, perna do chute | `game-characters-three/src/first-person/`, `presets/first-person-arms.json`; `toRoomAvatar` os entrega por padrão |
| Mãos na arma: punho, guarda-mão, bomba da pump, carregador na recarga, cabo dos objetos genéricos | `game-weapons-three/src/fx/hand-hold.ts` (`parts.grip` nos modelos de pistola, revólver, bullpup etc.) |
| Golpe no impacto, não no clique (`strikeClips`, `handStances`, linha `strike` no log) | `game-test-room/src/room.ts`, `avatar.ts` |

- **Regra:** o soco, o empurrão e o chute (Shift+V) tocam o clipe nos braços e no corpo e chamam o `meleeUse` existente no segundo do `impact`, relendo a mira; ferramenta sem clipe segue instantânea e um golpe pendente bloqueia a mesma ferramenta.
- **Testes:** `game-characters-three/tests/first-person-arms.test.ts` (IA, posturas, impacto uma vez no instante certo, perna, `toRoomAvatar`), `game-weapons-three/tests/hand-targets.test.ts`, `game-test-room/tests/strike.test.ts`, `game-characters/tests/first-person-clip.test.ts`, `game-characters-people/tests/first-person-clips.test.ts`.
- **Capturas:** `examples/test-room/test.mjs` grava `shots/fp-*-pt-BR.png` e `fp-*-en.png` (mãos vazias, punhos, pistola, fuzil, recarga, soco, empurrão, chute e soco em terceira pessoa).


## 2026-10-25 · Recarga com as mãos, contato, dedo no gatilho, chute alternado e som de recarga (todas as armas)

Continuação da entrada anterior. Os times não entregaram mãos, dedo no gatilho, contato nem sons de recarga (a Galeria 3D do Arsenal move as peças, não desenha mãos nem soa); o que entrou foi escrito no kit sobre os clipes que o time entregou, sem substituir nada.

| O que | Onde |
|---|---|
| Mão em cada passo da recarga (pistola: mão de apoio puxa o ferrolho ou polegar na trava, por dado; AR: alavanca atrás e em cima; AK: alavanca à direita; pump e semi: cartuchos na janela de carga; ferrolho: mão de tiro na alavanca; revólver: mão de apoio no tambor; cinta: tampa) | `game-weapons-three/src/fx/hand-work.ts`, `src/data/hand-work.json` |
| Dedo indicador no gatilho (repouso estendido, no gatilho pronto, puxa a cada tiro, rajada com tremor, lança-chamas e minigun com o gatilho preso) e dedo por mão em `HandTargets.fingers` | `game-weapons-three/src/fx/viewmodel.ts`, `game-characters-three/src/first-person/hand.ts` |
| Chute alternado (`kickLeg`), clipe espelhado (`mirrorPoseClip`) | `game-test-room`, `game-characters`, `game-characters-three` |
| Golpe para no contato (`contact` no estado dos braços; mãos e pé a poucos mm da superfície, o cotovelo dobra) e arma que recua de parede e sobe se a mão sairia da vista | `game-characters-three/src/first-person/arms.ts`, `game-weapons-three/src/fx/viewmodel.ts` (`WALL_PULL`, `HAND_IN_VIEW`) |
| Variante da recarga no log (`kind`, clipe e segundos) | `game-weapons-three/src/area.ts` |
| Sons de recarga no segundo de cada passo do clipe (`sound` cues), receitas em dados com perfil de peso e material | `game-weapons-three/src/audio/reload-sounds.ts`, `src/data/reload-sounds.json`, `src/animation/reload-clips.ts` |

- **Todas as armas:** `recargas-por-arma.md` (passos, tempos, fonte) e `checklist-animacoes.md` (✓/✗ por arma, medido por teste) são gerados dos mesmos dados (`WRITE_DOCS=1`) e um teste falha se ficarem diferentes. Nenhuma arma com modelo fica ✗. Sem modelo (caixas): M79, M203, GP-25, AG36, pistola .22, arcos e bestas, armas brancas e ferramentas.
- **Tempos:** o clipe de cada arma dura o tempo da regra (0,05 s) e marca os passos da regra nos mesmos segundos (`reload-audit.test.ts`). A recarga vazia usa o tempo da tática quando a arma não traz `timings.reloadEmpty` (87 armas; os golden da equipe fixam isso); as 14 armas genéricas sem `family` na regra tocam o clipe do modelo sem marcas de passo.
- **Capturas:** `examples/test-room/shots/fp-*-reload-empty-*.png`, `fp-shotgun-pump-*`, `fp-kick-left-*`, `fp-kick-right-*`, `fp-shove-wall-*` e as folhas `fp-all-weapons-*.png`.


## 2026-10-25 · Estrutura real, passo 5 · arranha-céu e a cidade (lacuna 9)

Desenho em `design/T10-estrutura-real.md` §11. Receita em `game-floorplan-structure` (`skyscraper.ts`, `skyscraper-plan.ts`), torre de escritórios em `game-floorplan-commercial` (`office_tower`), torre residencial em `game-floorplan-residential` (`residential_tower`), cidade em `game-urban` (opção `towers`, desligada por padrão). No motor, a barra de tração de parede e pilar passou a contar as barras que o espaçamento dá (`verticalBarCount`).

- **Cenários:** torres de 20, 40 e 80 andares em pé em repouso e com o vento padrão, com núcleo e estacas (sem estacas tomba); explosão num andar quebra o vidro e as lajes vizinhas e o núcleo fica; perder um pilar do perímetro derruba só aquela linha; plantas de 20 andares passam o validador e as propriedades dos estados do post-apocalyptic; a cidade com `towers` desenha as torres e, desligada, sai idêntica.
- **Goldens:** nenhuma mudou.
- **Testes novos:** structure `skyscraper` (18) e `tower-plan`, commercial `office-tower` (9), residential `residential-tower`, post-apocalyptic (torres nas propriedades), floorplan-three `skyscraper` (4), game-urban `towers` (9), game-urban-three `towers` (2).
- **Portões:** ver o fim desta entrada. `examples/test-room`, `floorplan-test-area` e `urban-test-area` build + `test.mjs` ok (capturas revertidas). O vitest do `game-floorplan-structure` acusou de novo, em parte das rodadas, o `Timeout calling "onTaskUpdate"` do worker (carga da máquina, testes passando).
- **Pendências para o dono:** (1) acima de 60 andares a deriva passa de H/500 (o motor não tem outrigger nem tubo de perímetro): limitar a faixa a 60 ou aceitar; (2) `towers` desligado por padrão na cidade serve, ou o centro deve nascer com torres e regerar os goldens da Galeria? (3) não há arranha-céu nas entregas dos times nem em `packages/*` antes disto; nada foi reescrito no lugar de uma entrega.

## 2026-10-25 · Estrutura real, lajes em painéis com vigas reais nas casas (T10 §5 resolvido, §12)

Desenho em `design/T10-estrutura-real.md` §12. As lajes de concreto das casas e dos prédios do `game-floorplan` viram painéis de no máximo `maxSpan` (5 m,
um por cômodo), com vigas `vão/10` (mín. 25 cm) nos limites, lajes `L/40` (mín. 10 cm piso, 8 cm cobertura), pilares de 20 cm onde uma viga ou cinta passa
do vão e vergas/cintas com a altura do vão. O vergalhão (`rebar`) passou a ser o padrão de `toDestructibleSpec` (desliga com `rebar: false` ou
`slabPanels: false`); `slabPanels` aceita um objeto com os valores de `SLAB_PANEL_DEFAULTS`. Novo em `game-floorplan-structure/src/slab-panels`, API `slabPanelView`.

- **Cenários:** as 28 tipologias (residencial, comercial, rural, pós-apocalíptica) x sementes 1 a 5 x normal/fortificada/abandonada (420 casas) ficam de pé em repouso
  com o aço dimensionado (flexão máxima 0,95, na laje da mansão); casas de madeira, rurais e barracas não mudam. Perder um pilar de um sobrado em pórtico não derruba laje
  nem telhado; os dois pilares das pontas de um lado derrubam o lado; todos os pilares do térreo, a laje e o telhado. Uma explosão sob um painel de laje fissura a
  face de cima (a tracionada) e o aço segura.
- **Goldens:** nenhuma golden de time mudou (`vc3-structure` compara com `slabPanels: false, rebar: false`; `vc3-house-scene` e `vc3-house-area` iguais). Mudaram cinco
  entradas de `game-floorplan-three/tests/fixtures/exact-floorplan.json` (`destruction/breach|spall|fracture`, `specimen/house_casa_portico|house_casa_inteira`), pelos
  painéis (§6.1 do T10).
- **Testes antigos ajustados:** `load-path` (dois pórticos), `flexure` (padrão do concreto armado), `extension` e `wall-detail` (opt-out dos painéis), `destruction` do
  `game-floorplan-three` (painel `slab_1_p0`). O cenário `house_two_pillars` da área de casas perde os pilares das pontas de um lado.
- **Testes novos:** `game-floorplan-structure/tests/slab-panels.test.ts` (opções, vão, uma casa de cada gabarito em repouso, perda de pilar, explosão sob a laje),
  `game-floorplan-three/tests/destruction.test.ts` (painéis ligados ao mundo, o painel que falha esconde só os pedaços dele), `game-destruction/tests/terrain-blow.test.ts`.
- **Achado no motor:** o golpe contundente no terreno (`anchored` com a etiqueta `terrain`) deixa de desgastar as juntas de todas as paredes sobre ele.
- **Portões:** ver o relatório do passo (build, typecheck, lint, testes dos pacotes `game-floorplan*`, `game-destruction(-three)`, `game-urban-three`, `game-test-room`, exemplos
  `floorplan-test-area`, `urban-test-area`, `test-room`).

## Limite de 60 andares nas torres (dono, 2026-10-25)

- Padrão de 60 andares (`SKYSCRAPER_MAX_STOREYS`), configurável por `range` (estrutura, torres de escritório e residencial), `towers.maxStoreys` e `minStoreys`/`maxStoreys` por preset (cidade); zona `zt` passa a 60 andares e 240 m.
- Medido: 60 andares com o pórtico de 12 m davam deriva 1/377 (acima de H/500). `sizeForWind` (padrão ligado) alarga os vãos até passar: 60 andares com vão de 14,5 m, núcleo 10,9 × 11,7 m, deriva 1/521, `ok`; 20 e 40 andares idênticos ao layout cru (1/2635 e 1/610).
- Testes: cenários de 80 andares trocados por 60; novos para o máximo padrão e para subir por opção (estrutura, escritório, residencial, cidade); opções de geração `floors`/`tower` por tipologia.
