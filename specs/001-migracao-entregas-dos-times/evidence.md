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
