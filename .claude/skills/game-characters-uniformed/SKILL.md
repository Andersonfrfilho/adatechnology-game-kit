---
name: game-characters-uniformed
description: Use quando precisar de forças uniformizadas num jogo, sem engine, como exército, polícia militar, polícia civil, PRF, polícia penal, forças especiais, BOPE, COT, GATE, patente, quem assume o comando, desobediência, amotinar, equipamento do policial ou soldado, saque de farda e colete, pool de achados por força. Pacote de conteúdo do game-characters com nomes reais do Brasil (br).
---

# @adatechnology/game-characters-uniformed

## Objetivo
Forças **genéricas** para o `game-characters` (T4.2d da Fase 4), com os **nomes reais do Brasil** como conteúdo `br`: `army` (Exército Brasileiro),
`military_police` (PM), `civil_police`, `highway_police` (PRF), `prison_police` (Polícia Penal), `special_forces` e `tactical_unit` (BOPE, COT, GATE).
Cada uma com **escada de patentes** e a **regra de patente** de Os Vivos do Vale (`RANKRULE`): a maior patente viva com coragem + lealdade ≥ 100 assume o
comando; patente maior vence opinião, a menos que a opinião esteja abaixo de −20 (aí desobedece, deserta ou se amotina). Os **equipamentos** (`GENT`) viram
ids de arma (`game-weapons`) e de item, e o `LOOT` vira **pools de achados** no formato de `FindsProvider`. O 7º BIS, as unidades e as pessoas nomeadas do
vale, os lugares e as fases ficam no jogo (`game-slice/characters/forces.json`).

## Quando usar e quando não usar
- Use para: povoar bloqueios, delegacias e quartéis, decidir quem manda quando o líder cai, equipar um policial ou soldado, sortear o que ele carrega.
- Não use para: IA de facção, reputação e eventos do vale (jogo), nem corpo e dano (`game-characters`).

## Como usar
```ts
import { createCharacters } from '@adatechnology/game-characters'
import { createUniformedPack, createForceFinds, pickCommander, obeysOrder, rankOrder } from '@adatechnology/game-characters-uniformed'

const kit = createCharacters({ packs: [createUniformedPack()] })
const choque = kit.create({ seed: 3, kind: 'riot_police' })           // colete e capacete de choque em spec.protection
pickCommander([{ id: 'a', force: 'army', rank: 'captain', courage: 60, loyalty: 60 }]) // quem assume
obeysOrder({ superior: { force: 'army', rank: 'captain' }, subordinate: { force: 'army', rank: 'private' }, opinion: -25 }) // false
const finds = createForceFinds()                                        // FindsProvider: key = id da força
finds.findsFor({ place: 'checkpoint', container: 'army', state: 'normal', rng })   // [{ itemId: 'imbel_ia2', count: 1 }, ...]
```

## API principal
| Export | Para que serve |
|---|---|
| `FORCES`, `getForce(id)` | as 7 forças: `region: 'br'`, nomes `en`/`pt-BR`, cor, escada |
| `RANKS` | escadas (`army`, `military_police`, `civil_police`, `highway_police`, `prison_police`) e a regra (limiares lidos do texto da página) |
| `ranksOf`, `rankOrder`, `pickCommander`, `obeysOrder` | a regra de patente |
| `LOADOUTS` | 7 equipamentos: ids de arma do `game-weapons`, `weaponChoice` (`one`/`all`), itens |
| `LOOT_POOLS`, `createForceFinds(options)` | 42 achados por força, com raridade e chance; provider estrutural (`findsFor`) |
| `createUniformedPack()` | `CharacterPack` com um preset por equipamento (a proteção vem dos itens de proteção) |
| `UNIFORMED_LOCALES` | `en` e `pt-BR`: categorias, raridades, texto da regra |

## Compõe com
- `@adatechnology/game-characters`: o kit; `game-weapons`: os ids de arma; `game-items`: os ids de item (pendentes da fusão da Fase 3).
- `game-floorplan` / `game-items`: o `createForceFinds` é estrutural, encaixa onde um `FindsProvider` é aceito.

## Ambiente de teste
O `characters-test-area` (T4.4a) mostra as forças em fila. Por enquanto, `tests/uniformed.test.ts` confere a regra de patente, os ids de arma contra o
`game-weapons` e o provider.

## Cuidados
- Dado gerado por `tools/characters-catalog` (`catalog`); não editar `src/data/*.json` à mão.
- A **chance** de cada achado é um padrão (comum 50 %, incomum 30 %, raro 12 %, muito raro 5 %, lendário 3 %): a página só tem a palavra da raridade.
- Itens únicos de missão (chaves, documentos, rádio de satélite, maleta) ficam na fatia do jogo, fora dos pools.
- `special_forces` usa a escada do exército e `tactical_unit` a da PM: a página não tem escada própria.
- Ids de item (ex.: `vest_tactical_iiia`) esperam o catálogo do `game-items`; os de proteção (`vest_police`, `helmet_combat`) são os do `game-characters`.

## O que vem pela migração
Os Vivos do Vale: `FACT` (nomes e cores), `RANKS`, `RANKRULE`, `LOOT` (sem os itens únicos) e `GENT` (só os papéis vivos). Fica no jogo: o 7º BIS, as pessoas, os lugares, as fases e a vida simulada.
