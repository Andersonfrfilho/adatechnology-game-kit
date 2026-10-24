---
name: game-crowd
description: Use quando precisar de uma multidão num jogo, como horda de zumbis, gente na rua ou manada, com faixas de relevância, percepção por visão, audição e olfato, campo de fluxo, separação, vagas de ataque, alerta em cadeia, portas que cedem, pilha de corpos no muro, habilidades por tipo (salto, bote, grito, estouro, devorar corpos, seguir rastro), corpos no chão, população e migração. Puro e determinístico por semente, sem three.js nem som. Termos, multidão, horda, crowd, flow field, agentes, createCrowd.
---

# @adatechnology/game-crowd

## Objetivo
A multidão como estrutura de arrays, porte literal da horda do jogo do time (`jogo.js` G 66714-67430, `hordeUpdate` e tudo o que ela chama; portas de
G 63796-64050). Todo número está em `src/data/defaults.json` com a linha de origem. Emite eventos (`sound`, `effect`, `message`, `kill`, `spawn`...) e
quem toca, desenha e mostra é o jogo.

## Quando usar e quando não usar
- Use para qualquer grupo de agentes que anda, percebe e persegue: horda, população de uma cidade, civis com rotina, bichos, revoada.
- Não use para desenhar (`game-crowd-three`, T8.1c), para o jogador (`game-player`) nem para o contágio entre regiões (`game-infection`).
- Mundo normal primeiro: sem `target` ninguém persegue; os tipos só ganham habilidade pelos `traits`.

## Como usar
```ts
import { createCrowd, createNavGrid } from '@adatechnology/game-crowd'
import { undeadCrowdPack } from '@adatechnology/game-characters-undead'

const crowd = createCrowd({ pack: undeadCrowdPack(), seed: 7, grid: createNavGrid(), water })
crowd.target = player
crowd.on('sound', (s) => host.audio?.play(s))
crowd.on('effect', (e) => host.effects?.play(e))
crowd.updateTrail(dt); crowd.update(dt, { nightFactor, viewYaw }); crowd.updatePopulation(dt, view, { target: 1200, migration }); crowd.updateCorpses(dt)
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createCrowd({ pack, random, seed, capacity, grid, doors, water, numbers, bands, flow, plugins, target })` | A multidão: `spawn`, `remove`, `update`, `emitNoise`, `damage`, `kill`, `updateTrail`, `updateCorpses`, `updatePopulation`, `spawnAway`, `pileBlast`, `setHunt`, `asPlayerCrowd`, `on`, `store`, `corpses`, `doors`, `stats` |
| `CROWD_DEFAULTS` | Os números da horda com `sources` (faixas R0-R3, histerese 10, fluxo 192, vagas 6, pilha 0,48/3,7/160, corpos 400/900 s, população 1200) |
| `createNavGrid({ size, cell, border })` | A grade do jogo (0,5 m, códigos 0 livre, 1 sólido, 2 muro escalável, 3 porta aberta, 4 vidro, 5 porta fechada) |
| `createDoors(grid, { random, numbers })` | Portas: `add`, `set`, `hit` (30% de som, tábuas, 300 de vida), `plank`, `on` |
| `CrowdPack`, `CrowdType`, `CrowdTraits` | O que se sorteia: tipos, idades, roupas, segmentos, paleta; as habilidades como traços |
| `CrowdTarget` | Quem a multidão caça (`state` e `grab`, `hurt`, `knock`, `release`); o `Player` do `game-player` serve como está |
| `STATE`, `MISSING` | Os estados (0 vagando ... 12 indo ao som) e os bits das partes perdidas |
| `createCivilians(crowd, { people, buildings, hour, turnInto, waypoints, numbers })` | Civis: rotina por hora, medo (3,4 m/s com agente a 6 m), grupo que segue o líder ou o alvo, fuga por caminho, abrem portas; agentes a 10 m caçam, mordem (mordida ×1,5) e o mordido vira depois de 120 s. Eventos `bitten`, `died`, `turned`, `gone` |
| `createHerd(crowd, { view, blocked, numbers })`, `HERD_ROLES` | Bichos: vagar e descansar 4-11 s, fugir do alvo e dos agentes, companheiro 2,2 m atrás, cacarejo, alarme do quero-quero, mugido, latido e rosnado (ruídos que a multidão ouve) |
| `createFlock({ count, mode })`, `carrionCenter` | Urubus em volta dos corpos (`carrion`) e o anel de pássaros do mapa vivo (`orbit`), pelas fórmulas das entregas |
| `bindInfection(crowd, infection, { place, typeFor, civilians, regionOf })` | Ponte com o `game-infection`: `materialize` vira agentes, a morte volta como removido, os de longe voltam com `giveBack`, a mordida de civil é `infect` |

## Compõe com
`game-characters-undead` (`undeadCrowdPack()`, os 13 tipos com os números da horda), `game-characters` (o livro de corpos `createCorpseLedger`),
`game-player` (`asPlayerCrowd()` e o `noise` dos passos), `game-audio` e `game-vfx` (via `host.audio` e `host.effects`), `game-weapons` (o calibre do tiro).

## Ambiente de teste
`pnpm --filter @adatechnology/game-crowd test`: o golden `game-crowd.json` (8 cenas do código do jogo em `node:vm`: perseguição e vagas, noite e
olfato, pirâmide no muro, porta, habilidades, corpos e rastro, dano por região, calibre e roupa, população e migração, gravadas por
`pnpm --filter @adatechnology/characters-catalog-tool golden:vm`) é refeito quadro a quadro, mais testes da grade, das portas e da API.
Os goldens `game-crowd-civilians.json` (3 cenas) e `game-crowd-herd.json` refazem os civis e os bichos com a horda. A bancada e
`examples/crowd-test-area` chegam no T8.1c.

## Cuidados
- Os efeitos do jogo (`fxSpark`, `fxBlood`...) sorteavam do mesmo `R()`; aqui eles saem como evento e não gastam o `random` da simulação.
- `flow.clock` padrão é `performance.now`: o campo de fluxo se divide entre quadros. Para reprodutibilidade exata use `() => 0`.
- `remove(i)` move o último agente para `i` (evento `remove` com `moved`): quem guarda índices deve seguir o evento.
- Andares (`ANDARES`) e telhado (`ROOF`) do jogo ficaram de fora (pergunta 5 do desenho).
