# @adatechnology/game-crowd-three

three.js drawing for @adatechnology/game-crowd: every agent, body on the ground and civilian as instances (a literal port of the team game's hordeRender and npcRender: view culling, LOD with hysteresis, attack pose, the pose by state), the renderer on the baked variants of game-characters-three, the herd on the animals' own rigs, the crowd's sound bank and the crowd test area.

API completa: `packages/game-crowd-three/README.md`.

## Quando usar e quando não usar
- Use para desenhar agentes, corpos no chão e civis de um `Crowd`, e a manada (`createHerdView`) com os rigs do `game-animals-three`.
- Não use para a simulação (`game-crowd`), para o corpo rico de um personagem só (`game-characters-three`) nem para o jogador (`game-player`).
- three.js vem do host; o pacote não importa three.

## Como usar
```ts
const renderer = createCrowdRenderer(THREE, { crowd, builders, typeName, civilians: { list: () => civilians.list, body: (n) => spec } })
scene.add(renderer.group)
host.audio?.register?.(CROWD_SOUND_BANK)
renderer.update(dt, { camera: { x, z }, viewYaw, target: { x: player.state.x, z: player.state.z, alive: player.state.alive } })
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createCrowdInstances({ eyes, numbers, poses })` | As instâncias sem three.js: `agents(store, variants, frame, sink)` (corte, LOD com histerese, pose de ataque, pose por estado, inchaço, olhos), `corpses(...)`, `civilians(...)` |
| `CROWD_RENDER_DEFAULTS` | Os números do desenho (LOD 18/55 m, histerese 1,5, ataque 1,6/2,2 m, corte 200 m, corpo 18 m, escurece 70%, encolhe 60 s) e as poses por estado |
| `createCrowdRenderer(THREE, { crowd, builders, typeName, civilians, plainBody, drawCorpses, numbers, poses })` | Assa cada tipo na primeira vez que aparece (decay 1, 2, 1, 2, semente `7000 + c·101 + v·13`, detalhe 1, 0,5, 0,28), desenha tudo, `lodCounts`, `drawCalls`, `bakeMs`, `dispose` |
| `createHerdView(THREE, { herd, flock, drawer, species })` | Os bichos da manada com os próprios rigs e os urubus planando sobre os corpos |
| `CROWD_SOUND_BANK`, `HERD_SOUND_IDS` | Grito rouco, gemido, gemido do corredor e os chamados dos bichos como receitas do `game-audio` |
| `createCrowdTestModule({ pack, builders, typeName, civilianBodies, animals, infection, startCount })`, `CROWD_EFFECTS` | A área `crowd_area` da sala de testes, só com os contratos genéricos |

## Compõe com
`game-crowd` (a simulação), `game-characters-three` (`bakeBody`, `createVariantBatches`, `createBodyBatch`, `buildInstancedBody`, o construtor do
Bestiário), `game-characters` (`walkGait`, `variantSeed`, `variantDecay`, `INSTANCE_POSES`), `game-player` (o alvo da área), `game-audio` (o banco),
`game-animals-three` (o desenho da manada), `game-infection` (a região da área), `game-vfx` (os efeitos por `host.effects`).

## Ambiente de teste
`pnpm --filter @adatechnology/game-crowd-three test`: o golden `game-crowd-render.json` (o `hordeRender` e o `npcRender` do jogo em `node:vm` nas 11
cenas da horda e dos civis, gravado por `pnpm --filter @adatechnology/characters-catalog-tool golden:vm`) é refeito instância por instância; mais
testes das instâncias, do renderizador (assando com o construtor do Bestiário), do banco e da área. `examples/crowd-test-area` (`?area=crowd`)
abre a área com 300 agentes; a `interactables-test-area` carrega a área vazia.

## Cuidados
- A pose de ataque é escrita no `store.attackPose` e a simulação a lê (quem golpeia não vira para a velocidade): desenhe todo quadro, como o jogo.
- Os andares do jogo (`ANDARES`) não foram portados: `frame.hidden(i)` deixa um agente de fora.
- O retrato dos sobreviventes nomeados é conteúdo do jogo: o renderizador recebe o corpo de cada civil por `civilians.body`.
