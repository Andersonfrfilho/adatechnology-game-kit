---
name: game-infection
description: Use quando precisar simular contágio, surto, epidemia, infecção, incubação ou peste que se espalha por regiões com atraso (zumbis, doença, boato), determinístico por semente, com fases, eventos, salvar/carregar e ponte para agentes reais (materialize/giveBack).
---

# @adatechnology/game-infection

## Objetivo
Modelo epidêmico abstrato e determinístico por regiões, para qualquer coisa que se espalha por contato com atraso. Não sabe nada de jogo: regiões,
ligações, fases e eventos chegam como dados. Sem dependências; roda no navegador e no Node. Passo de uma hora, PRNG com semente, `save()`/`load()` exatos.

## Quando usar e quando não usar
- Use para o número de infectados por região ao longo do tempo (nível abstrato), com fases, pânico, fuga e saída do mapa.
- Use para ligar mordidas e mortes reais do jogo ao modelo (`infect`, `remove`, `warn`) e tirar agentes dele (`materialize`, `giveBack`).
- Não use para comportamento individual de zumbi, multidão ou animação: isso é de `game-crowd` e `game-characters-*`.
- Não ponha nome de cidade, facção ou região do jogo no motor; a "Valley" do ZombiAdA é só fixture de teste.

## Como usar
```ts
import { create, type InfectionConfig } from '@adatechnology/game-infection'

const data: InfectionConfig = {
  seed: 20261022, incubationHours: 48, startHour: -144, focus: 'hospital', params: { transmission: 0.7 },
  regions: [
    { id: 'downtown', pop: 7200, density: 1.4, police: 6, urban: 1 },
    { id: 'hospital', pop: 700, density: 2.2, police: 1, transmissionMult: 1.3 },
  ],
  links: [{ a: 'downtown', b: 'hospital', flow: 0.012 }],
  phases: [{ id: 'routine', dayMin: -99, dayMax: -99, threshold: 0, awareness: 0, cullFixed: 0.004, cullFraction: 0.002, shelter: 0, flee: 0, exit: 0, focusTransfer: 0.008 }],
  events: [{ id: 'lab_bites', hour: -122, action: 'seed', region: 'downtown', n: 4 }],
}

const model = create(data)
model.on('phase', (p) => console.log('phase', p.id, p.hour))
model.on('stage', (s) => console.log(s.region, s.from, '->', s.to))
model.advance(24)                 // um dia
model.region('downtown')          // { free, sheltered, incubating, active, contained, departed, removed, awareness, stage, ... }
model.total('active')

const batch = model.materialize('downtown', 5) // Agent[] = { state, seed }, para agentes concretos
model.giveBack('downtown', batch)              // devolve quando saem da relevância
const saved = model.save(); model.load(saved)
```
Conferido executando o `dist`: este exemplo roda; `materialize` pode devolver `[]` se ainda não há infectados.

## API principal
| Função/tipo | Para que serve |
|---|---|
| `create(config)` | Cria o `Infection` |
| `advance(hours = 1)`, `hour()`, `day()`, `phase()` | Relógio e fase atual |
| `region(id)`, `regions()`, `total(field)` | Compartimentos: `free`, `sheltered`, `incubating`, `active`, `contained`, `departed`, `removed` |
| `infect(region, n, hoursElapsed)`, `remove(region, n)`, `warn(region, level, guard)` | Entrada do jogo no modelo |
| `materialize(region, n)`, `giveBack(region, batch)` | Agentes reais entram e saem |
| `on('phase' \| 'stage' \| 'event', fn)` | Notificações |
| `save()`, `load(json)` | Serializar/restaurar |
| `DEFAULT_PARAMS`, `STAGES`, `version` | Padrões; estágios `calm`, `cases`, `panic`, `fallen`, `overrun` |
| `InfectionConfig`, `RegionDef`, `LinkDef`, `PhaseDef`, `InfectionEvent` (`action`: `seed`, `move_population`, `release_active`, `warn`) | Dados de entrada |

## Compõe com
- `game-crowd` (P12, futuro): a multidão consome `materialize`/`giveBack` para virar horda (ou civis, manada) perto do jogador.
- `game-characters-undead` (P11) e a regra de infecção de animal (P10, `game-animals`) usam o estado e a semente dos `Agent`.
- `game-player` (V6) liga a infecção do jogador ao modelo. O jogo só junta; o motor não importa nenhum deles.

## Ambiente de teste
Sem `examples/`. Os testes (`packages/game-infection/tests/`) usam `tests/fixtures/valley-outbreak.json` (cenário do Vale traduzido para o esquema em
inglês): `pnpm --filter @adatechnology/game-infection test`.

## Cuidados
- Tempo em horas; `startHour` negativo é o prólogo.
- `focus` precisa ser um id de região existente; `urban` manda incubados para ele.
- `active` só atravessa uma ligação com `link.active` e `fromPhase`.
- Determinismo: mesmo `config` e mesmas chamadas, mesmo resultado; chamar `materialize` altera o PRNG.
- Os nomes eram em português (`Contagio`, `criar`, `regioes`); a tabela de renomeação está em `MIGRATION.md`.

## O que vem pela migração (spec 001)
- P10: a regra de infecção de animal (quem pega e como age) entra no SDK, que o jogo liga ou desliga; usa este modelo.
- P12: `game-crowd` genérico se liga por `materialize`/`giveBack`.
- P6/V6: `game-player` (fôlego, ferida, infecção, agarrão) se conecta à infecção.
- P6: crianças podem virar infectadas; o SDK não restringe.
