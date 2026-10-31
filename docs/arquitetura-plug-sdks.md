# Arquitetura de plug dos SDKs — análise e correções

Análise de 2026-10-31, feita com evidência de código. Os caminhos com linha são da `main` dessa data. Conferir de novo antes de corrigir.

## Veredito

O desenho do kit está certo e é o que estúdios grandes usam. Ele tem:

- um pacote só de contratos (`game-contracts`);
- núcleos sem three.js;
- pacotes de conteúdo separados;
- adaptadores `-three` que recebem o THREE do host.

O grafo de produção não tem ciclos. Nenhum `src` importa three.js como valor, só `import type`.

O problema é que as regras do `CLAUDE.md` não são cobradas por máquina, e por isso já se furaram:

- **Camadas sem cerca.** Pelo menos 15 dependências furam as camadas. Um núcleo puxa conteúdo, um adaptador puxa conteúdo, um `-three` puxa outro `-three`, e a sala de testes conhece armas.
- **Dois jeitos de registrar catálogo.** Uns pacotes usam registro por instância, outros um objeto global mutável. Somado aos bundles IIFE que copiam as dependências, isso dá estado duplicado.
- **Ninguém é dono do quadro nem dos orçamentos.** Não há um laço com fases, nem um orçamento único de luzes, partículas e memória da GPU. Os engasgos das explosões ([desempenho-explosoes.md](desempenho-explosoes.md)) são consequência direta disso.

**Nota: 6,5/10.** A base é boa: falta transformar as regras em verificação automática. Não é caso de refazer.

## Modelo recomendado: camadas que só olham para baixo

| Camada | Pacotes | Pode depender de | Nunca depende de |
|---|---|---|---|
| **L0 Contratos** | `game-contracts` | nada | qualquer pacote |
| **L1 Base do motor** | `game-shapes`, `game-runtime` (**novo**: agendador com fases, relógio, orçamentos, pools) | L0 | three, domínio |
| **L2 Núcleos** | destruction, vfx, fluids, weapons, items, characters, crowd, floorplan, vehicles (só regra), weather, player… | L0, L1, outro núcleo quando é composição de verdade | three, conteúdo, `-three` |
| **L3 Conteúdo** | `-fleet`, `-species`, `-goods`, `-residential`, `-people`, `-undead`… | o próprio núcleo, L0 | three, `-three` |
| **L4 Adaptadores** | `<lib>-three`, `game-shapes-three`, `game-render-three` (**novo**: orçamento de luzes, pré-aquecimento de shaders, pools da GPU) | o próprio núcleo, L0, `game-shapes-three`, `game-render-three` | conteúdo, outro `-three` de domínio |
| **L4b Pontes** | como o `game-floorplan-interactables` (zero deps, tudo injetado) | o que injetarem | — |
| **L5 Composição** | `game-test-room` (como um host), `examples/*`, o jogo | tudo | — |
| **Teste** | subpath `./testing` de cada pacote | o pacote + L5 | o `.` de produção |

É o mesmo desenho destas engines:

| Engine | Como faz |
|---|---|
| Unity | assembly definitions (asmdef) com Runtime e Editor separados e referências explícitas |
| Unreal | módulos `Runtime`, `Editor` e `Developer`; plugins que só falam por interface |
| Bevy | `Plugin::build(app)` registra sistemas em agendas fixas (`PreUpdate`, `FixedUpdate`, `Update`, `PostUpdate`) e recursos compartilhados |
| pmndrs (three.js) | three como peer, um laço só (`useFrame` com prioridade) e o drei separado do core |

O kit já tem os "recursos" do Bevy (`host.effects`, `host.audio`, `host.environment`). Faltam as **agendas** e os **orçamentos com dono**.

## O que está incorreto

| # | Problema | Onde | Por que importa | Correção | Prioridade |
|---|---|---|---|---|---|
| 1 | Núcleo depende de conteúdo | `game-urban/src/neighbourhoods/providers.ts:1-2` importa `game-vehicles-fleet` e `game-vegetation-species` | O jogo não troca a frota nem as plantas da cidade sem mexer no núcleo | Os providers recebem frota e espécies por opção; o padrão fica em `game-urban/defaults` ou na composição | alta |
| 2 | Núcleo que é renderer | `game-vehicles` tem three como peer e ~35 arquivos usam `THREE.` (`src/armor.ts:7`, `src/body.ts:30`); `src/api.ts:10-12` tipa objetos 3D como `any`. `game-vegetation` exporta `./three` | Quebra "three só em `-three`", impede rodar a regra do carro em servidor ou worker e esconde erro de tipo | A geometria vai para `game-vehicles-three`, um subsistema por PR; o `./three` da vegetação vira `game-vegetation-three` | alta, em etapas |
| 3 | Adaptador depende de conteúdo | `game-vehicles-three/src/build.ts:3` (fleet); `game-floorplan-three/src/furniture/spec.ts:4` (`residentialItems`); `game-characters-three/src/player/room-avatar.ts:1` (clips de `-people`) | O desenho fica preso ao conteúdo padrão | Receber por opção (`palettes`, `furniture`, `clips`); o padrão é ligado na composição | alta |
| 4 | Um `-three` de domínio depende de outro `-three` de domínio | `game-weapons-three` → floorplan-three (`src/area.ts:7`), items-three (`src/props.ts:5`), interactables-three (`src/models/attachments/sling.ts:2`); `game-items-three/src/area.ts:4` → floorplan-three; `game-urban-three` → vehicles-three; `game-crowd-three` → characters-three | Instalar armas puxa o renderer de casas inteiro; quase sempre só para a mesa da área de teste | Código de área de teste vai para `./testing`; cabos (`createCord`) vão para `game-shapes-three`/`game-render-three`; item↔arma vira ponte injetada. `crowd-three` → `characters-three` pode ficar, declarado | alta |
| 5 | A sala de testes conhece domínio | `game-test-room/src/room.ts:8`, `:357-358` (`createArsenal`, `DEFAULT_LOADOUT`); `src/explosives.ts`; 12 deps concretas no `package.json` | Contradiz o `CLAUDE.md` §4; a sala vira "o jogo" e acumula lógica que é dos SDKs | Arsenal, explosivos, fluidos e terreno entram como módulos (`room.loadModule`) | alta |
| 6 | A sala é um objeto-deus | `game-test-room/src/room.ts`: 3.786 linhas, 47 imports; `stepSim` (~`:2664`) chama tudo à mão | Todo bug de desempenho passa por ele | Partir em `host-services`, `scheduler`, `player-rig`, `areas` e `scenarios` | média |
| 7 | Dois jeitos de registrar catálogo | Global mutável: `game-floorplan/src/registry.ts:21-35`, `src/index.ts:54` (singleton `engine`), `game-destruction/src/assemblies.ts:41-47`, `game-items-three/src/models/registry.ts:21-27`, `game-shapes/src/registry.ts:3`, `game-weapons-three/src/props.ts:112-123`. Por instância (certo): `createAnimals`, `createItems`, `createSoundRegistry`, `createWeatherRegistry` (`game-contracts/src/registry.ts:32-46`) | O global quebra dois mundos na mesma página e testes em paralelo | Sempre `createX({ packs, patch, remove })`; o global vira um `defaultX` criado por quem compõe (já proposto na spec 002 §4) | alta |
| 8 | O bundle IIFE copia as dependências para dentro | `tsup.config.ts` com `noExternal: [/^@adatechnology\//]` (ex.: `game-vfx-three`) | Duas IIFEs na mesma página = duas cópias de `game-vfx` e `game-contracts` com estado duplicado | IIFE só para demonstração; um bundle "kit inteiro" único, ou externos por `globalThis` | média |
| 9 | Não há laço com fases | Só a sala tem laço (`room.ts` ~`:3733-3766`); `dt` variável; os `onFrame` dos módulos rodam **depois** de `vfx.update` e do render dos adaptadores; `ModuleHost.onFrame` (`game-contracts/src/module.ts:288-289`) não tem fase nem ordem | Atraso de um quadro entre sistemas; determinismo por semente não fecha com passo variável; cada jogo reinventa a ordem | `game-runtime`: `input → fixedSimulate (1/60) → lateSimulate → present → render`; `onFrame(fn, { phase, order })` | alta |
| 10 | Luzes sem dono | Luz criada em tempo de jogo: `game-weapons-three/src/fx/heavy.ts:58` (uma por foguete), `game-interactables-three/src/mesh.ts:155` (uma por lâmpada), `game-characters-three/src/rich/accessories/hand-items.ts:26`, `game-weather-three/src/headlights.ts`. Três orçamentos separados: vfx (`game-vfx-three/src/lights.ts`), cômodos (`game-floorplan-three/src/lights/room-light.ts:39-41`) e urban | No three.js, mudar o **número** de luzes recompila todos os materiais com luz: é o maior engasgo das explosões | `LightBudget` único em `game-render-three`: N luzes criadas no boot e ligadas só pela intensidade; quem quer luz faz `acquire(prioridade)`; lint proíbe `new PointLight` fora dele | alta |
| 11 | Sistemas de partículas duplicados, com alocação por partícula | `game-vehicles/src/particles.ts:14-23`, `game-weapons-three/src/fx/particles.ts` e `fx/heavy.ts:87,102` (geometria e material novos a cada gota), `game-interactables-three/src/effects.ts` — além do `game-vfx` com pool | Quatro orçamentos que não se somam; alocação no meio do quadro | Tudo por `host.effects`; pool compartilhado de malhas e geometrias | alta |
| 12 | O fallback cria um renderer próprio em silêncio | `game-destruction-three/src/renderer.ts:230-231`, `game-fluids-three/src/renderer.ts:28-29`, `game-weapons-three/src/fx/viewmodel.ts:148`, `game-weapons-three/src/audio.ts:90` | Quem esquece de passar `vfx` ganha outro mundo de efeitos, com mais 6 luzes, sem erro | Serviço obrigatório ou `warn` no fallback | média |
| 13 | O contrato não diz o custo | `DestructibleImpl.part()` lido por parte e por quadro (`game-destruction-three/src/renderer.ts:1304,1321,1385`); o veículo remontava o estado inteiro a cada leitura | Uma implementação lenta derruba o quadro sem quebrar teste nenhum | Documentar `part()`/`state()` O(1) e sem alocação; o `checkDestructible` mede 10.000 chamadas com teto | média |
| 14 | O tipo do THREE tem cinco nomes, e `any` | `Three`, `ThreeLib`, `ThreeNamespace`, `ThreeNS`; `type Three = any` em `game-urban-three/src/draw.ts:10` e em `game-vehicles/src/api.ts:10` | Sem checagem onde mais quebra (na troca de versão do three) | Um `ThreeLib = typeof import('three')`; cada pacote faz `Pick<>` | baixa |
| 15 | A faixa de versão do three é frouxa | peer `>=0.160.0` em `game-urban-three`, `game-vegetation-three`, `game-vehicles`, `game-vehicles-three`; o resto usa `^0.160.0` | `>=` aceita r170+, que muda a API e a iluminação | Todos em `^0.160.0`, conferido no CI | média |
| 16 | Versões do conteúdo inflando | `game-floorplan-commercial` e `-residential` em 5.0.0, `-rural` e `game-vehicles-fleet` em 4.0.0, com núcleos em 0.x | O changesets sobe major de quem tem peer, mesmo dentro da faixa | `onlyUpdatePeerDependentsWhenOutOfRange: true` no `.changeset/config.json` | média |
| 17 | `workspace:*` publica versão exata | todas as dependências internas | O jogo recebe várias cópias de `game-contracts`/`game-vfx` | `workspace:^`; `pnpm dedupe --check` no jogo | média |
| 18 | Código de teste no pacote de produção | `test-area/` e `bench/` exportados pelo `.` em 13 pacotes | É o que arrasta as deps do item 4 | Subpath `./testing` | média |
| 19 | Deps declaradas e não usadas | `game-terrain` → destruction; `game-weather-three` → vfx-three; `game-urban-three` e `game-floorplan-three` → floorplan; `-commercial`/`-rural` → `-residential` | Instalação maior e grafo enganoso | Remover, ou explicar | baixa |
| 20 | Composição montada à mão nos exemplos | `examples/interactables-test-area/build.mjs` (alias para `dist/`); `src/entry.js:27-35` importa `../../<outra-area>/src/entry.js` | O "jogo inteiro" de teste passa por fora dos `exports` | Cada área exporta pelo `./testing`; a raiz importa por nome de pacote | baixa |

**Julgamento, não defeito:**

- **Nomes do ZombiAdA em comentário de procedência** (ex.: `game-items-three/src/models/rice.ts:4`): não acoplam código. Podem ir para um `PROVENANCE.md`.
- **`ModuleHost` tem formato de sala de teste:** aceitável, desde que o jogo também o implemente. Aí ele vira o contrato de host do kit.
- **Núcleo que usa núcleo** (`game-weather` → `game-audio`, `game-items` → `game-interactables`): é composição, e é permitida. Só precisa estar declarada.

## O que está bem feito (manter)

- **Injeção do three:** three é peer em todos os adaptadores e nunca é importado como valor.
- **`game-contracts`:** zero dependências e só tipos e ajudantes puros. Os serviços do host (`EffectSink`, `AudioSink`, `EnvironmentBus`, `BusySink`) são opcionais e por interface.
- **Sem ciclos de dependência.**
- **`game-floorplan-interactables`:** é ponte pura e é o modelo para as outras pontes.
- **Registro por instância** com `mergeById`/`applyPatches`/`removeIds` (animals, items, audio, weather).
- **Pool fixo de luzes do vfx e orçamento de luzes do urban:** o padrão certo, que só precisa ser **um**.
- **Governança:** `markKitOrigin`, kit-audit no CI, goldens bit a bit, `--frozen-lockfile`, changesets e `sideEffects: false`.

## Plano de correção

Cada etapa fecha com `pnpm -r typecheck && pnpm test` e commit isolado. Modelo por etapa conforme `model-economy.md`.

| Etapa | O que fazer | Aceite (comando) | Modelo |
|---|---|---|---|
| 0 | ADR das camadas, do agendador e dos orçamentos (`specs/005-camadas-e-quadro/`) | revisado pelo dono | opus |
| 1 | `dependency-cruiser` com as regras abaixo, em modo aviso, com a baseline atual | `npx depcruise packages --config .dependency-cruiser.cjs` sem erro | sonnet |
| 2 | peer do three em `^0.160.0`; deps internas em `workspace:^`; flag do changesets | `grep -rn '">=0.160' packages/*/package.json` vazio; build e testes | haiku |
| 3 | Tirar deps declaradas sem uso (item 19) | `npx knip --dependencies` sem achados; typecheck | haiku |
| 4 | Subpath `./testing`; mover `test-area/` e `bench/` (um pacote por commit) | `grep -E "test-area\|bench" packages/*/src/index.ts` vazio; exemplos compilam | haiku |
| 5 | Cortar `-three` → `-three` que só servia à área de teste; `createCord` para `game-shapes-three` | regra `no-domain-adapter-to-adapter` vira erro sem quebrar | sonnet |
| 6 | Adaptadores recebem conteúdo por opção (vehicles-three, floorplan-three, characters-three) | `adapter-not-content` como erro; goldens iguais | sonnet |
| 7 | `game-urban` recebe frota e espécies por opção | `core-not-content` como erro; testes do urban | sonnet |
| 8 | `game-runtime`: agendador com fases, passo fixo, `onFrame(fn, { phase })` compatível | teste da ordem das fases; `perf.mjs` igual ou melhor | opus (desenho) → sonnet |
| 9 | `game-render-three`: `LightBudget`, pool de geometrias e materiais, pré-aquecimento de shaders; migrar vfx-three, floorplan-three, heavy.ts, mesh.ts, hand-items.ts | `examples/test-room/perf.mjs` passa (shaders = 0, buffers por explosão no orçamento) | opus (desenho) → sonnet |
| 10 | Partículas de `game-vehicles` e `game-weapons-three` passam por `host.effects` | busca por `PARTICLE_LIMIT` fora do vfx vazia; `perf.mjs` | sonnet |
| 11 | Contrato de custo do `DestructibleImpl` + medição no `checkDestructible` | testes do `game-contracts`; veículos e personagens no teto | sonnet |
| 12 | Registro único (floorplan, destruction, items-three, shapes, weapons-three), com `default` compatível | teste com dois mundos e packs diferentes na mesma página | sonnet, um pacote por vez |
| 13 | Tirar armas, explosivos, fluidos e terreno da sala; partir o `room.ts` | `wc -l room.ts` < 1.200; deps da sala só contrato, runtime, render e áudio; `examples/test-room/test.mjs` passa | sonnet, com revisão opus antes |
| 14 | Geometria do `game-vehicles` para `-three`, um subsistema por PR | `grep -l "THREE\." packages/game-vehicles/src` cai até 0; goldens iguais | sonnet |
| 15 | Todas as regras do depcruise como erro no CI | PR de teste que viola a regra falha | haiku |

Toda etapa que mexe em animação, corpo ou arma na mão segue a regra de validar em todas as câmeras (`CLAUDE.md` §5).

## Regras automáticas para o CI

1. **`dependency-cruiser`**, com classes por nome de pacote. As regras `forbidden`:
   - `core-no-three`: núcleo não importa three nem `-three`;
   - `core-not-content`: núcleo não importa pacote de conteúdo;
   - `content-not-adapter`: conteúdo não importa `-three` nem `game-props3d`;
   - `adapter-not-content`: adaptador não importa pacote de conteúdo;
   - `no-domain-adapter-to-adapter`: `-three` só importa `game-shapes-three`/`game-render-three`, com allowlist explícita;
   - `nothing-imports-test-room`: só `examples/` importa a sala;
   - `no-deep-import`: nada de `/src` nem `/dist` de outro pacote;
   - `no-circular`.
2. **Deps declaradas = deps usadas** (`knip`, ou o script de varredura desta análise).
3. **Política de versão:** three como peer `^0.160.0`, nunca em `dependencies`; deps internas `workspace:^`.
4. **ESLint:**
   - `no-restricted-syntax` proíbe `new PointLight`/`new SpotLight` fora do dono das luzes;
   - `max-lines: 1500` como aviso.
5. **Orçamento por quadro:** `examples/test-room/perf.mjs` no CI, em modo contadores (ver [desempenho-explosoes.md](desempenho-explosoes.md)).
6. **Contrato de custo:** `checkDestructible` com teto de tempo para todo `DestructibleImpl` publicado.
7. **API pública:** `publint` e `@arethetypeswrong/cli` em todo pacote; `api-extractor` nos pacotes mais usados.
8. **kit-audit:** regra "luz e partícula têm dono" no `tools/kit-audit/rules.json`.
