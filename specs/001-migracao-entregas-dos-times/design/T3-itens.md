# Fase 3 — Itens (desenho do architect/opus, 2026-10-24)

Três pacotes novos: **`game-items`** (motor genérico, sem three e sem conteúdo), **`game-items-goods`** (catálogo único gerado de
itens do mundo real: junta os 257 do time e os 92 domésticos) e **`game-items-three`** (os 24 modelos da vitrine portados exatos e no
tamanho real, mais formas simples no tamanho real para os outros 233). O que é só do ZombiAdA vai para o repositório do jogo como fatia
gerada (documentos da história, regiões do Vale, especialidades da região, textos `uso`, pontos de dano, posições fixas, loot de facção,
eventos de suprimento). Os achados das casas chegam à planta por um `FindsProvider` que estende o stub da T2.1. Dois algoritmos do time
são portados atrás dele, cada um com golden contra a sua fonte. Todos os dados saem de `tools/items-catalog`, como na T1.1: extrator,
`decisions.json` mantido à mão, testes de fonte que provam o original e `--check`.

Dois fatos:
- **Os 146 itens do jogo não são outra fonte**: `ITENS` em `jogo.js` L62024 está contido no ITE, todos os 146 ids com `kg`, `rar` e `cat`
  iguais (0 diferenças, conferido por script). O jogo é fonte só de mecânica (`CONT_TAB`, `rollItems`, `take`, `useItem`, `EXTRA`, `LOOT`).
- **Hoje há três vocabulários de item**: ITE (257, ids em português), household (92, ids em inglês) e VC3 `CONTEUDO` (~100 ids em
  português, recipientes das casas, L10824–10878). A junção mapeia os três para um id só.

`S/` = `specs/001-migracao-entregas-dos-times/`. ITE = `S/sources/armas-itens__itens-vale-cinzento.js`; HTML do ITE =
`S/artefatos/NKmkGZ2Lvcd96mp6Nyksds.html`; jogo = `S/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js`; VC3 = `S/sources/jogo__visor-casas-3d.js`.

## 1. Mapa das fontes

| Fonte (linhas) | O que é | Destino | Escopo |
|---|---|---|---|
| ITE L6 `DATA` (`itens` 257, `categorias` 14, `locais` 24, `raridades` 6, `receitas` 33, `conteineres` 16) | Catálogo | `tools/items-catalog` → `packages/game-items-goods/src/data/*.json` (gerado) | SDK; itens da história, `regioes`, `especialidades_regiao` e textos `uso` vão para a fatia do jogo |
| ITE L6 `regioes` (10), `reg[]` (111 itens), `especialidades_regiao` (10) | Geografia do Vale | `zombiada/content/items/regions.json` (via `--game-out`) | Jogo |
| ITE L24–41 `det()` | Que campos pertencem a que categoria | grupos de campos em `game-items/src/types.ts` (`nutrition`, `protection`, `carry`, ligação corpo a corpo) | SDK |
| ITE L91 `W` (3/2/1/.5) | Pesos só do mapa de calor | Não porta; pesos de sorteio vêm de `raridades.peso_tabela` (= `RAR_W` do jogo) | — |
| HTML L197–216 | Frescor 0,5/1/1,5, fórmula de idade preguiçosa, 7 multiplicadores de armazenamento, bateria −10%/mês, gasolina > 180 d falha 10% | `game-items/src/decay.ts` + `goods/data/storage.json` (tabela lida do HTML) | SDK; o cronograma de falta de luz ("dias 1 a 3: 70% das casas…") vai para o jogo |
| HTML L220–254 | Proteção em camadas `1−Π(1−b·c)`, teto 90%, desgaste −8/−3, rasgado = 25%, conserto até max−10, carga `(8+2.5·FOR)×1.2`, limiares 100%/150% | `game-items/src/protection.ts`, `carry.ts` | SDK, ataques genéricos `bite`/`scratch`; a regra de 3% de infecção pelo sangue vai para `game-characters` (Fase 4) |
| HTML L256 + `receitas` | 33 receitas (texto livre) | `goods/data/recipes.json` (lido) + `game-items/src/recipes.ts` | SDK; "Revista Faça Você Mesmo" vira dado genérico `unlockedBy` |
| HTML L261–330 | Sorteio preguiçoso, quantidade × esgotamento × região, pesos de raridade, lendário/único só em ponto fixo, condição por raridade, idade da comida ao surgir, níveis de bateria/galão, `saque_progressivo` | `game-items/src/finds/*` + `goods/data/{depletion,spawn}.json` | SDK; reaparecimento, eventos de suprimento, teto de 400 itens no chão por célula, regras de rede → jogo / futuro `game-player` |
| HTML L332–345 | Orçamento (≤30 chamadas de desenho, ≤400/1200 triângulos, LOD1, some a 30/60 m) | orçamentos do `game-items-three` + contadores da área de teste | SDK |
| ITE L123–142 (`M`, materiais por etiqueta), L144–168 `MODELS` (24), L171–182 `STAGE_TARGET`/`AMT`/`setStage` | Modelos da vitrine e envelhecimento | `game-items-three/src/models/<id>.ts` (literal), `materials.ts`, `wear.ts` | SDK |
| ITE L199 `sc = 1.55 / max(size)` | Normalização | **Sai** (melhoria 7); escala real pelo `models.json` | — |
| jogo L68781–68792 `CONT_TAB`, L68779 `RAR_W`, L68796–68812 `rollItems` | Recipiente → sorteio por categoria | `game-items/src/finds/category-roll.ts` (mesma ordem de sorteio) + `goods/data/containers.json` | SDK |
| jogo L68765–68776 `EXTRA` | Caixas de munição (9×19: 20 cartuchos / 0,24 kg…), 3 armas como item, molotov, M67, sinalizador | `itemsFromArsenal()` no `game-items` + `goods/data/ammo-boxes.json` gerado (lê os calibres do `game-weapons`) | SDK; `chave_casa_d` e `sinalizador` (Casa 8) vão para o jogo |
| jogo L68794 `FIXOS`, L69698 `LOOT` | Posições fixas, equipamento de facção | `zombiada/content/items/{fixed,faction-loot}.json` | Jogo |
| jogo L68815–68829 `CARGA`, `bag`, `take` | 10 vagas + peso | `game-items/src/carry.ts` (`slots` e `capacityKg` por opção) | SDK |
| jogo L68831–68855 `useItem` | Efeitos de uso (comer, atadura, analgésico +15, acalmar, limpar ferida, montar molotov, ligar luz, trocar bolsa) | `goods/data/use-effects.json` + `resolveUse()` puro; aplicar é do `game-player` (Fase 8) | SDK |
| VC3 L10824–10878 `CONTEUDO`, `sorteiaConteudo`, `aplicaConteudo` | Recipientes da casa, estados fortificado/abandonado | `game-items/src/finds/explicit-pool.ts` (porte) + `goods/data/house-pools.json` (ids mapeados) | SDK |
| SDK `game-interactables-household/src/data/items.json` (92) | Itens do SDK | **Juntados** no goods (~30 equivalentes exatos mantêm o id do household); o household passa a importar os itens do goods | SDK |

Dependências (sem ciclos):
```
game-contracts (Thumbnail, helpers de registro)
  ← game-interactables (ItemDef base + thumbnail, generateLoot, fitsSize)
      ← game-items (motor; em execução só importa fitsSize)
          ← game-items-goods (dados + textos)
              ← game-interactables-household (itens agora do goods; mantém móveis e tabelas de loot)
          ← game-items-three (three peer, game-props3d)
game-floorplan é dono da interface FindsProvider; game-items a implementa estruturalmente. Um não importa o outro.
```

## 2. Catálogo

```ts
export interface ItemDef extends BaseItemDef {            // BaseItemDef = ItemDef do interactables (+ thumbnail)
  category: ItemCategory        // 14 do time, ids em inglês: food, drink, medical, tools, melee, materials, clothing, bags,
                                // electronics, fuel, outdoors, books, collectibles, keys (registro, extensível)
  tags?: readonly string[]      // a categoria antiga do household (kitchen, hygiene, cleaning, office, trash, mail, bbq, garage), 'perishable', 'craft_only'
  size: Vec3                    // metros, real
  weight: number                // kg (`kg`)
  volume?: number               // litros; derivado do size salvo sobrescrita
  rarity: Rarity                // common|uncommon|rare|very_rare|legendary|unique (pesos 60/28/9/2.5/0.5/só fixo)
  durability?: Durability       // `dur` lido: { kind: 'uses'|'portions'|'doses'|'hits'|'cuts'|'shots'|'condition'|'charges'|'seconds'|'days'|'infinite'|'container', amount?, per? }
  shelfLife?: number            // dias em ambiente (`v`)
  portions?: number             // `p`
  cookable?: boolean            // `ck`
  nutrition?: { satiety?: number; hydration?: number }                       // `f`, `s`
  protection?: { slots: readonly BodySlot[]; bite?: number; scratch?: number; warmth?: number }   // `slot`,`bm`,`ar`,`cal` como frações
  carry?: { capacityKg: number; weightReduction: number; quickSlots: number; wheels?: boolean }   // `cap`,`red`,`rap`
  weapon?: string               // id no arsenal (os 20 corpo a corpo); pontos de dano ficam na fatia do jogo (A2)
  fluid?: { liquid: string; liters: number }                                 // id de LIQUIDS do game-fluids → ITEM_USES sip/drink/pour
  uses?: readonly string[]
  finds?: { places: readonly PlaceTag[] }                                    // `onde`, etiquetas de lugar em inglês
  charge?: { lossPerMonth: number }; agingFault?: { afterDays: number; chance: number }
  model?: string                // chave em models.json do game-items-three (24); senão `shape`
  thumbnail?: Thumbnail
}
```
Rastreabilidade num `provenance.json` gerado à parte (`id → { ite?, household?, vc3?, game? }`).

**Junção com o household (sem duplicar):** só junta equivalente exato (`martelo→hammer`, `lanterna→flashlight`, `atadura→bandage`,
`camiseta→tshirt`, `isqueiro→lighter`, `corda→rope`…; o extrator propõe, ~30 confirmados em `decisions.json.merge`). Genéricos como
`canned_food` ficam separados. Precedência por campo: id do household vence (API publicada); valores do time vencem em `weight`,
raridade, durabilidade, validade e nome (§1); household vence em `size`, `shape` e `color` (o time não deu medidas). A `category` do
household vai para `tags`, e `category` vira uma das 14 do time (tabela em `decisions.json`) — changeset minor no household. ~307 itens no
SDK; ~12 documentos da história no jogo.

**Separação da história:** o SDK mantém formas genéricas de nome neutro (`safe_key`, `generator_key`, `access_badge`, `cell_key`,
`master_key`, `padlock_key`, `dog_tag`, `photo`, `note`, `city_map`, `road_map`, `cash`, `cigarettes`); a fatia do jogo aplica os nomes da
história e os textos `uso` ("Chave do cofre da delegacia"…). Só do jogo: `diario`, `mapa_militar`, `ordem_evac`, `prontuario`,
`fichas_presos`, `registro_mina`, `fita_radio`, `postal`, `item_marcado`, `codigo_bunker`, `chave_teleferico`, `cracha_rep`.

**Medidas (melhoria 7):** `decisions.json.dimensions` com `{value:[w,h,d], source:'household'|'REF'|'model', reason}`. Nos 24 modelados,
size = caixa do time × escala, com a escala de uma medida real (`modelScaleRef`, ex.: lata de 113 mm), preservando as proporções do time.
Teste de densidade (`kg / volume` numa faixa por material, com lista `hollow`) pega erro de digitação nos 233 REF. Pilha: valor do
household nos juntados, senão padrão por categoria em `decisions.json`.

**Envelhecimento ("mundo normal primeiro")**, puro e preguiçoso:
- `advanceAge(state, now)` fecha a conta quando o item mexe ou é olhado: `ageDays += (now − since) × storageMultiplier(storage, powered)`.
- `freshness(item, state, now)` → `fresh|stale|spoiled|rotten` em 0,5, 1 e 1,5 da validade.
- Freezer cai para "2 dias restantes" sem luz; caixa térmica ×0,5 por 2 dias, depois ×1. O host sempre passa `powered`; o cronograma de
  luz do surto fica na fatia do jogo.
- Idade ao surgir = `outbreakDays + U(0, 0.6)·shelfLife` (no dia 0 é o giro normal da prateleira). Esgotamento
  `max(floor, 1 − perDay·outbreakDays)` não faz nada no dia 0. `outbreakDays` vem do host (ex.: `game-infection.day()`, `infection.ts:293`,
  menos o início do surto); `game-items` não depende do `game-infection`.

**Achados** (estende o stub da T2.1 com campos opcionais):
```ts
interface FindsQuery { place: string; container: string; state: string; rng: Rng;
  day?: number /* dias de surto, 0 = normal */; region?: string; footprint?: number /* m², contagem VC3 */; key?: string }
interface FindStack { itemId: string; count: number; data?: { ageDays?: number; condition?: number; charge?: number; fill?: number } }
createFindsProvider(items: ItemsCatalog, o?: { pools?: 'team'|'none'; rules?: Partial<FindsRules> }): FindsProvider
```
Estratégia: recipiente com pool VC3 explícito → porte `explicit-pool` (contagem pelo `footprint`, ordem ponderada, fortificado ×2,5 / +1 em
suprimentos, abandonado 40% vazio + lixo); senão porte `category-roll` do `rollItems` (faixa de contagem, peso de categoria, sorteio
ponderado por raridade entre itens cujo `places` inclui o lugar, com o recuo de categoria inteira do jogo). Ambos sorteiam na mesma ordem
das fontes. `placeFinds(stacks, slots, items)` usa o `fitsSize` do interactables; `toLootTables(items, q)` serve mundos só de
interactables; a planta passa o resultado como `ContainerSpec.contents`. Apoio na planta: `TemplateDef.place?: PlaceTag`; chaves de
recipiente = ids de móvel do SDK depois do `MIGRATION.md` da T2.1, com o nome VC3 guardado em `teamId`.

**Receitas:** o extrator lê `entrada`, `ferramenta`, `habilidade` e `tempo` em `{ inputs: [{item|any:[…], qty|liters}], tools: anyOf,
skill?: {id, level}, seconds, output: {item, qty:[lo,hi]} | {effect, params} }`; frases → ids por `decisions.json.recipeTerms`. A maioria
das saídas é efeito (ex.: "Janela com vida 200"), que o host trata. `canCraft` ignora habilidade se o host não passar `skills`.

**Armas:** os 20 corpo a corpo ganham `weapon: <id>`; o que faltar no `game-weapons` (facão, taco com prego, pé de cabra…) ganha def
genérica com alcance `alc` m, ruído `ru` m e massa; pontos `dano`/`cr` na fatia do jogo (A2). `itemsFromArsenal(arsenal)` cria
`ammo_<caliber>` e `firearm_<id>` a partir de `WeaponDef.mass/dimensions`; quantidade por caixa do `EXTRA`, ou REF para os outros calibres.
Acessórios (T1.7) usam a mesma ponte.

**Configuração por jogo:** `createItems({ packs, patch, remove, include, categories, places, containers, rules })`, igual ao arsenal; os
helpers `mergeById`/`applyPatches`/`removeIds`/`deepMerge` (`game-weapons/src/registry.ts:7–24`) sobem para o `game-contracts` e os dois
pacotes passam a usá-los.

**Extrator `tools/items-catalog`:** `extract-ite.ts` (recorta `DATA` com o `cut-literal`, que sai do weapons-catalog para o
`@adatechnology/golden-tool`), `extract-ite-html.ts` (tabela de armazenamento e regras em prosa, guardando cada citação), `extract-game.ts`
(`CONT_TAB`, `RAR_W`, `EXTRA`, `ITENS` como guarda de deriva), `extract-vc3.ts` (`CONTEUDO`), `base/household-items.sdk.json` (entrada
congelada), `parse-durability.ts`, `parse-recipe.ts`, `decisions.json`, `build.ts --check`, `--game-out <dir>`.
Testes de fonte: os 257 presentes ou listados como `scope:'game'`; `kg`, raridade, lugares e campos iguais; `dur` e receitas reconstruídos
da forma lida por um formatador pt-BR; multiplicadores = tabela do HTML; toda citação em `decisions.json` existe no HTML; `ITENS` ⊂ ITE com
campos iguais; todo id dos pools VC3 resolve para um alias; mais `catalog-up-to-date.test.ts`.

## 3. Modelos

- **24 da vitrine:** construtores portados literal em `game-items-three/src/models/*.ts` nas unidades do time, com os materiais por etiqueta
  (`metal/wood/cloth/plastic/paper/food/glass`); escala da raiz do `models.json` gerado (`{id, teamId, teamBox, scale}`). Golden G-a:
  `tools/golden/captures/items-showcase.js` recorta de `const mats = []` até o fim de `MODELS`, mais `STAGE_TARGET/AMT/setStage`, como o
  `arsenal-models.js`; grava hash por nó **antes** da normalização 1,55 e as tabelas de material dos estágios 0/1/2. O teste compara o
  grupo interno (sem a escala da raiz) e os materiais; outro teste confere caixa × escala = `size` em 2%. Risco r128→0.160 em
  `Lathe`/`Tube`/`Extrude`: posições com tolerância e `KNOWN_DEVIATIONS`.
- **233 formas simples:** `shapes.ts` desenha primitivas no `size` real por dica de forma; as 14 de hoje (can, bag, box, bottle, jar, fruit,
  dish, cup, tool, tube, roll, cloth, shoe, paper) ganham blade, long_tool, garment, backpack, jerrycan, tank, book, key, battery, plank,
  device, com os mesmos materiais (o `setWear` vale para elas). Hoje nada no SDK desenha `ItemDef.shape`.
- **Orçamento:** mescla por material (técnica S1 das armas; o helper sobe para o `game-props3d`); LOD1 = forma simples; some a 30 m
  (pequeno) / 60 m (grande); o teste mede triângulos contra 400/1200; modelo do time acima do orçamento vira desvio conhecido.
- **Miniaturas** (alinhado com a task das armas): em `game-contracts/src/module.ts`
  `export interface Thumbnail { svg?: string; render?: true | { yaw?: number; pitch?: number; distance?: number; wear?: 0|1|2 } }`,
  `TestableItem.thumbnail?: Thumbnail` e `BaseItemDef.thumbnail?: Thumbnail` (o interactables passa a depender do game-contracts).
  Modelados: `render: true`; os outros: SVG gerado por forma. **Se a task de miniaturas das armas já tiver posto um campo, adotar o dela.**
- `itens-modelos-3d.md` regenerado pela ferramenta, com coluna "tamanho real (m)" para o time.

## 4. Áreas de teste

`examples/items-test-area` (`ItemsArea`, `?area=items`): 14 prateleiras por categoria com todo item em tamanho real
(`AreaPlacement.surface`), suporte da vitrine com os 24 modelos girando, régua de 1,55 m e silhueta humana de 1,80 m. Controles: categoria
(todas + 14); desgaste (novo/gasto/estragado); dia de idade 0–400 + armazenamento (7) + energia; lugar (24) + recipiente + estado
(normal/fortificado/abandonado) + dia de surto 0–60 + semente + ação "sortear achados" (as pilhas aparecem numa mesa "achados" e vão para o
registro); receita + ação "fabricar". Camadas: rótulos (nome, kg, m), caixas, destaque das formas simples (a lista dos 233 de relance).
Contadores: itens, chamadas de desenho, triângulos, modelados/total.
`examples/interactables-test-area`: o `entry.js` também carrega o `ItemsArea`; os recipientes dos móveis mostram o conteúdo como itens
reais pelo `game-items-three` (a geladeira mostra pela primeira vez a lata e a garrafa portadas no tamanho real). Site: `catalog.mjs`,
miniatura com `capture-thumbs.mjs --only=items-test-area`.

## 5. Tasks

| # | Task | Modelo | Grupo |
|---|---|---|---|
| T3.0 | `Thumbnail` + helpers de registro nos contratos; `BaseItemDef.thumbnail`; `cut-literal` para o golden-tool | haiku | A |
| T3.1a | Esqueleto `game-items`: tipos, registro `createItems`, regras padrão (raridade, frescor, armazenamento, carga, proteção) | sonnet | A |
| T3.1b | `tools/items-catalog`: extratores, leitores de durabilidade/receita, build, `--check`, `--game-out` | sonnet | B (depois dos tipos) |
| T3.1c | `decisions.json`: ids em inglês dos 257, ~30 junções, mapa de categorias, lista de escopo, padrões de pilha | haiku | B ‖ d |
| T3.1d | Medidas REF + teste de densidade | haiku → sonnet se o gate falhar 2× | B ‖ c |
| T3.1e | Motor: envelhecimento, carga, proteção, efeitos de uso, receitas, achados (category-roll, explicit-pool, esgotamento, estado ao surgir), `placeFinds`, `toLootTables`, `itemsFromArsenal`; testes | sonnet | C (depois de a) |
| T3.1f | `game-items-goods`: dados gerados, textos pt-BR (nomes do time) + en (tradução: haiku) | sonnet | depois de b, c, d |
| T3.1g | Household pega os itens do goods (apaga `items.json`, move as chaves `item.*`, categoria → tags); testes verdes | sonnet | E |
| T3.1h | `FindsProvider` com a consulta estendida, `TemplateDef.place`, registrado na composição da planta; goldens VC3 da Fase 2 iguais | sonnet | E (depois da Fase 2 na main) |
| T3.1i | Ligações corpo a corpo + defs genéricas que faltam no `game-weapons`; pontos na fatia do jogo | sonnet | E |
| T3.1j | Fatia do jogo em `zombiada/content/items/` + README lá | haiku | E |
| T3.1k | Goldens G-b (`rollItems` com sorteio semeado) e G-c (VC3 `sorteiaConteudo` × 3 estados × sementes 1–25) + testes | sonnet | E |
| T3.2a | Esqueleto `game-items-three`: materiais, `setWear`, formas, `buildItem`, mescla, LOD, orçamentos | sonnet | D (depois de a) |
| T3.2b | Captura `items-showcase.js` (sonnet) + porte literal dos 24 construtores e `models.json` (haiku, aceito pelo golden) | sonnet / haiku | D |
| T3.2c | Miniaturas (render + SVG); regenerar a checklist 3D | haiku | D |
| T3.3a | Módulo `items-test-area`, bancada, cenários | sonnet | F (depois de D + E) |
| T3.3b | Carregar no interactables-test-area; catálogo do site, miniatura; ligação abaixo | haiku | F |
| T3.3c | Inventário/spec, três SKILL.md, changesets, `evidence.md`, PR | haiku | último |

Paralelo: A primeiro; depois B, C e D juntos; E depois de f e e (T3.1h depois da Fase 2 na main); F por último.
Ligação: `site/Dockerfile` com o `package.json` de `game-items`, `game-items-goods`, `game-items-three`, `examples/items-test-area` e
`tools/items-catalog`; ordem no `site/build-site.mjs` depois do test-room; globais IIFE `GameItems`, `GameItemsGoods`, `GameItemsThree`,
`ItemsArea`; three como peer + `RoundedBoxGeometry` (G6); `@adatechnology/golden-tool` em devDependencies; changesets (3 pacotes novos em
0.1.0; household, interactables e contracts minor; weapons patch/minor); goldens no Node 22 e 24.

## 6. Perguntas — decididas pelo padrão reversível (2026-10-24, autopilot; listadas no PR)

1. Condição ao surgir no mundo normal: no `day=0`, prateleira e estoque de loja surgem com condição 100; casas e qualquer lugar depois do
   dia 0 usam as faixas do time. Uma opção: `rules.spawn.retailNew`.
2. Efeitos de comida passada/estragada (saciedade −30%, intoxicação 10/50%, moral −20, cozida 25%): regras padrão do SDK, substituíveis.
3. Itens de história na fronteira: as versões genéricas no SDK e a lista só do jogo acima; mover um item é uma linha no `decisions.json`.
