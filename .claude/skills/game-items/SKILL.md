---
name: game-items
description: Use quando precisar do catálogo de itens de um jogo, sem engine e sem conteúdo, como definição de item (categoria, tamanho real, peso, raridade, durabilidade, validade, proteção, carga), registro com patch/remove/include e as regras padrão de achados, frescor, armazenamento, carga e proteção da roupa.
---

# @adatechnology/game-items

## Objetivo
Motor genérico do catálogo de itens: o tipo `ItemDef` (estende o `ItemDef` do `game-interactables`), o registro `createItems` e as regras padrão. Não traz itens (isso é o
`game-items-goods`) nem desenha nada (`game-items-three`). Unidades: metros, quilos, litros, dias.
Estado: **esqueleto** (T3.1a da spec 001). Tipos, registro e regras existem; a lógica vem na T3.1e.

## Quando usar e quando não usar
- Use para: declarar itens e categorias, montar o catálogo de um jogo a partir de pacotes, consultar por id, categoria, lugar ou etiqueta, ler as regras.
- Não use para inventário do jogador, dano ou 3D. Envelhecimento, carga, proteção, receitas e sorteio de achados ainda não existem aqui.

## Como usar
```ts
import { createItems } from '@adatechnology/game-items'

const items = createItems({ packs: [pack], patch: { canned_beans: { weight: 0.45 } }, remove: ['dog_tag'], rules: { carry: { baseKg: 10 } } })
items.get('canned_beans').volume   // litros, derivado do size
items.byPlace('house')             // itens com finds.places contendo 'house'
```
Ordem: pacotes, `patch`, `remove`, `include`. `patch` mescla campo a campo (arrays substituem); id inexistente é ignorado. Tudo que estiver inconsistente vem num erro só.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createItems(options?)` | `ItemsCatalog` (`items`, `categories`, `places`, `containers`, `rules`, `has`, `get`, `list`, `byCategory`, `byPlace`, `byTag`) |
| `ItemDef`, `ItemPack`, `Durability`, `Rarity`, `BodySlot`, `CategoryDef`, `PlaceDef`, `ContainerDef` | tipos do desenho (seção 2 de `design/T3-itens.md`) |
| `ITEM_CATEGORIES` | as 14 categorias em inglês; `categories` acrescenta as do jogo |
| `DEFAULT_RULES`, `ItemRules` | pesos de raridade 60/28/9/2,5/0,5 (único só em ponto fixo), frescor 0,5/1/1,5, armazenamento, carga (8 + 2,5·FOR)·1,2 com 100%/150%, proteção (teto 90%, -8/-3, rasgado 25%), `spawn.retailNew` |
| `checkItems` | a verificação de consistência |

## Compõe com
- `@adatechnology/game-interactables`: dono do `ItemDef` base (e de `fitsSize`, usado pela T3.1e).
- `@adatechnology/game-contracts`: `Thumbnail` e os helpers de registro (`mergeById`, `applyPatches`, `removeIds`, `deepMerge`), iguais aos do `game-weapons`.
- `game-items-goods` (conteúdo) e `game-items-three` (modelos): ainda não existem.

## Ambiente de teste
Só testes unitários em `packages/game-items/tests/` (registro, validação, regras). A área de teste visual (`items-test-area`) vem na T3.3.

## Cuidados
- Categoria é registro: id desconhecido num item lança erro, mas `categories` acrescenta. Lugar só é conferido quando algum lugar foi registrado.
- Os multiplicadores de armazenamento foram lidos à mão do HTML do time; o teste de fonte do `tools/items-catalog` (T3.1b) é que os prova.
- `ContainerDef` é provisório: a T3.1e fixa os campos que o sorteio precisa.
- `legendary` e `unique` estão em `fixedOnly` (a página do time: "Lendário e único nunca são sorteados"): nunca saem de um sorteio, só de posição fixa. `legendary` mantém o peso 0,5 da tabela.

## O que vem pela migração
Já entrou (T3.1a): tipos, `createItems`, regras padrão. Falta: `tools/items-catalog` e dados (T3.1b a d), envelhecimento, carga, proteção, receitas, achados e `itemsFromArsenal` (T3.1e),
o catálogo `game-items-goods` (T3.1f), os modelos `game-items-three` (T3.2) e a área de teste (T3.3).
