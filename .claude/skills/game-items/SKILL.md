---
name: game-items
description: Use quando precisar do catálogo de itens de um jogo, sem engine e sem conteúdo, como definição de item (categoria, tamanho real, peso, raridade, durabilidade, validade, proteção, carga), registro com patch/remove/include e as regras padrão de achados, frescor, armazenamento, carga e proteção da roupa.
---

# @adatechnology/game-items

## Objetivo
Motor genérico do catálogo de itens: o tipo `ItemDef` (estende o `ItemDef` do `game-interactables`), o registro `createItems`, as regras padrão e a lógica pura sobre elas:
envelhecimento preguiçoso, carga, proteção da roupa, efeitos de uso, receitas, achados (sorteio de conteúdo de recipientes) e a ponte do arsenal. Não traz itens (isso é o
`game-items-goods`) nem desenha nada (`game-items-three`). Unidades: metros, quilos, litros, dias. Tudo é puro: o estado é do host.
Estado: motor completo (T3.1a e T3.1e da spec 001). A ligação do `createFindsProvider` na planta (`registerFindsProvider`, T3.1h) fica para depois da Fase 2.

## Quando usar e quando não usar
- Use para: montar o catálogo de um jogo, calcular frescor/carga/proteção, resolver o efeito de usar um item, ver se uma receita sai, sortear o que há num recipiente, pôr isso em
  vagas (`placeFinds`), transformar o arsenal em itens.
- Não use para inventário do jogador, aplicar dano ou necessidades (o host aplica o resultado), nem 3D.

## Como usar
```ts
import { createItems, createFindsProvider, advanceAge, moveToStorage, freshness, itemsFromArsenal } from '@adatechnology/game-items'
import { rng } from '@adatechnology/game-interactables'

const items = createItems({ packs: [goods, itemsFromArsenal(arsenal, { records })], patch: { canned_beans: { weight: 0.45 } }, rules: { carry: { baseKg: 10 } } })

// envelhecimento: nada anda sozinho; fecha a conta quando o item mexe ou é olhado
let age = { ageDays: 0, since: 0, storage: 'fridge', storedAt: 0 }
freshness(items.get('milk'), age, 12, { powered: true })      // 'fresh' | 'stale' | 'spoiled' | 'rotten'
age = moveToStorage(age, 12, 'ambient')                       // fecha a conta na geladeira e muda o multiplicador

// achados: estrutura igual ao FindsProvider da planta
const finds = createFindsProvider(items)
finds.findsFor({ place: 'house', container: 'fridge', state: 'normal', rng: rng('seed'), day: 0, footprint: 0.6, key: 'geladeira' })
```
Ordem do registro: pacotes, `patch`, `remove`, `include`. Pacotes também trazem `pools` (conteúdo explícito por tipo de móvel), `poolAliases`, `useEffects` e `recipes`.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createItems(options?)` | `ItemsCatalog`: `items`, `categories`, `places`, `containers`, `pools`, `useEffects`, `recipes`, `rules`, `has`, `get`, `list`, `byCategory`, `byPlace`, `byTag` |
| `advanceAge(state, now, o?)`, `moveToStorage`, `storageMultiplier`, `freshness`, `shelfRatio` | idade efetiva `ageDays += (now - since) x multiplicador`; sete armazenamentos; frescor em 0,5/1/1,5 da validade; freezer sem luz vira fresco com 2 dias; caixa térmica x0,5 por 2 dias depois x1 |
| `chargeLevel`, `failsToStart` | pilha perde 10% da carga por mês; gasolina com mais de 180 dias falha 10% (sorteia só quando pode falhar) |
| `blockChance`, `wearBlocked`, `repairPiece`, `pieceBlock` | proteção em camadas `1-PROD(1-b*c)` com teto 90%, desgaste -8/-3, rasgado 25%, conserto até máx-10 |
| `maxLoadKg`, `carriedKg`, `loadState`, `bagOption`, `canTake` | carga `(8 + 2,5*FOR)*1,2`, limiares 100% (corrida -25%) e 150% (não corre), vagas (10) e peso |
| `resolveUse(item, effects, context?)` | efeito de usar, como dado (`consume_nutrition`, `stop_bleeding`, `heal`, ...); comida passada/estragada/podre e cozida pelas regras `use` |
| `canCraft(recipe, ctx)`, `craft(recipe, ctx, rng)` | receitas; ignora habilidade se o host não passa `skills` e `unlockedBy` se não passa `unlocked`; saída em efeito é do host |
| `createFindsProvider(items, o?)` | `findsFor(query)`; recipiente com pool explícito usa o porte do `sorteiaConteudo`, senão o porte do `rollItems` |
| `rollByCategory`, `rollExplicitPool` | os dois portes soltos (ordem de sorteio documentada no código, base dos goldens G-b e G-c) |
| `placeFinds(stacks, slots, items)`, `toLootTables(items, q)` | pilhas em vagas pelo `fitsSize`; achados como loot tables do `game-interactables` |
| `spawnData`, `spawnAgeDays`, `depletionFactor`, `scaleCount` | estado ao surgir (idade, condição, carga, enchimento) e esgotamento `max(piso, 1 - queda x dias)` |
| `itemsFromArsenal(arsenal, { records })` | `ammo_<calibre>`, `firearm_<id>`, `throwable_<id>` a partir de `WeaponDef` (massa, `dimensions.length`); caixa do jogo via `records`, o resto estimado (REF) |
| `DEFAULT_RULES`, `ItemRules` | números do time: raridade, frescor, armazenamento, carga, proteção, `aging`, `inventory`, `use`, `spawn`, `finds` (esgotamento, estados, pools) |
| `ItemDef`, `ItemPack`, `ContainerDef`, `PoolEntry`, `RecipeDef`, `UseEffectDef`, `FindsQuery`, `FindStack`, `FindsProvider` | tipos |

## Compõe com
- `@adatechnology/game-interactables`: dono do `ItemDef` base, do `rng` e do `fitsSize` (`placeFinds`); `toLootTables` devolve `LootTables` dele.
- `@adatechnology/game-contracts`: `Thumbnail` e os helpers de registro (`mergeById`, `applyPatches`, `removeIds`, `deepMerge`).
- `@adatechnology/game-floorplan` (Fase 2): `FindsQuery`, `FindStack` e `FindsProvider` daqui são estruturalmente os dela (`findsFor`); nenhum pacote importa o outro.
- `@adatechnology/game-weapons`: só como forma (`ArsenalLike`); `itemsFromArsenal` aceita o `Arsenal` real.
- `game-items-goods` (dados) e `game-items-three` (modelos): outros pacotes.

## Ambiente de teste
Testes unitários em `packages/game-items/tests/` com itens mínimos; `goods-integration.test.ts` e os de uso/receitas/arsenal leem os JSON de `game-items-goods` por caminho relativo. A área
de teste visual (`items-test-area`) vem na T3.3.

## Cuidados
- O sorteio é ordenado: primeiro todas as escolhas, depois o estado (idade, condição, carga, enchimento) com o mesmo `rng`. Não reordene: os goldens G-b e G-c dependem disso.
- `rollByCategory` não rola `legendary`/`unique` nem `rules.finds.rollExcluded` (o jogo nunca rola a caixa 7,62x39); o jogo original daria peso 1 a esses.
- Item removido do catálogo some dos achados depois do sorteio (os outros não mudam).
- Estado fora de `normal|fortified|abandoned` é `normal`, a menos que `rules.finds.states` o mapeie. O dia de surto vem do host (`day`); o motor não conhece o `game-infection`.
- `carry.capacityKg` de uma bolsa é lido como número de vagas (o `cap` do jogo vira `bag.slots`); o limite de peso é o do personagem.
- Condição é 0..100 e o conserto vai até 100 menos 10 (o `dur` de condição do time não é lido como máximo).
- Comida estragada (saciedade -30%, intoxicação 10/50%, moral -20, cozida 25%) e o novo-na-loja do dia 0 são regras padrão substituíveis (`rules.use`, `rules.spawn`).

## O que vem pela migração
Entrou: T3.1a (tipos, registro, regras) e T3.1e (tudo acima). Falta: `game-items-goods` (T3.1f), household usando o goods (T3.1g), ligação na planta com `TemplateDef.place`
(T3.1h, depois da Fase 2), armas corpo a corpo (T3.1i), fatia do jogo (T3.1j), goldens G-b e G-c (T3.1k), `game-items-three` (T3.2) e a área de teste (T3.3).
