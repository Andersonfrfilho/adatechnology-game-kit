# Spec 007 — Integridade estrutural (pilares, lajes, sacadas)

Origem (2026-11-13): o item 5 da rodada 10 (revisão de alvenaria) foi **fechado como parcial** em `6b622409`
(`feat/structural-masonry-review`). O resto vira esta spec. O engenheiro (agente `engenheiro-estrutural`) reprovou 7 vezes; a 7ª
revisão aprovou o γn nos pilares abaixo de 19 cm e os apoios das lajes pela pegada, mas segue reprovando o que está abaixo.

## O que a 7ª revisão ainda reprova

- `residential_tower`: pilares sobrepostos (7 pares), saindo até 48 cm para fora da parede, pilares de canto fora do contorno e um
  pilar de parede de 590×20 cm (b/h > 5; NBR 6118 14.4.2.4, 15.9 e 18.5).
- `wood_frame_house` semente 1: `slab_ceiling` apoiada em `porch_footing` 2,4 m abaixo (altura do apoio).
- Sacadas e varandas sem caminho de carga coerente: `high_end_contemporary` `slab_1_balcony_upper` sobreposta a `slab_1`, balanço de
  ~3,5 a 4,6 m; `apartment_modern` `slab_0_veranda` sobre um único pilar 20×20 (λ 95) com balanço de 2,4 m no modelo de painéis.
- A isenção "laje sobre laje" de `SLAB_UNDERSIZED` escondia isso.

## Validador (trabalho em andamento)

Código vermelho guardado em `wip/structural-integrity-checks` (commit `3f64861c`, base `6b622409`), em
`packages/game-floorplan-structure/src/` (`pillar-design.ts`, `structure/{openings,roof,tank-parts}.ts`,
`validate/{codes,index,load-path,members}.ts`, novo `validate/integrity.ts`). Códigos novos:

| Código | Regra |
|---|---|
| `PILLARS_OVERLAPPING` | dois pilares com volume em comum |
| `PILLAR_OUTSIDE_FOOTPRINT` | pilar fora do contorno da construção |
| `PILLAR_PROTRUDING` | pilar sai mais de 10 cm da parede |
| `WALL_PILLAR` | pilar de parede com b/h > 5 |
| `SLAB_ON_SINGLE_PILLAR` | laje apoiada num pilar só |
| `SLABS_OVERLAPPING` | duas lajes com volume em comum |
| `SLAB_CANTILEVER` | balanço > 1,5 m ou laje mais fina que balanço/10 |
| `SUPPORT_WITHOUT_CONTACT` | agora com folga vertical de 5 cm (contatos em ponte contam) |

`SLAB_UNDERSIZED` perde a isenção larga de "laje sobre laje"; `wallAxisOf` escolhe a parede ao longo do lado maior do pilar.

## Varredura (todos os modelos × variantes × 8 sementes + 2 torres)

`tools/sweep.mjs` (copiado de fora do repositório; precisa de `pnpm build` antes): 17.248 → 3.475 → 3.406 violações.

| Código | Restam |
|---|---|
| `PILLAR_OUTSIDE_FOOTPRINT` | 2144 (torres) |
| `PILLAR_PROTRUDING` | 193 |
| `SLAB_CANTILEVER` | 115 |
| `PILLARS_OVERLAPPING` | 126 |
| `WALL_PILLAR` | 48 |
| `SLABS_OVERLAPPING` | 44 (inclui `foundation_raft` × `porch_floor` rural, lajes de telhado) |
| `OVERLAPPING_PARTS` | 24 (viga de beiral do `high_end`) |
| `SLAB_ON_SINGLE_PILLAR` | 3 |
| `MASONRY_OVERSTRESSED` | 3 (`single_storey_structural`) |

## Regressões das correções de altura de apoio

- `high_end_contemporary {floors:1}`: 321 caibros flutuando e 174 beirais.
- `a_frame_chalet`: 8 vergas flutuando (muretas mais baixas que a verga).
- `single_storey_structural`: 126 caibros declarados sobre a laje de forro 0,20 m abaixo.

## Critérios de aceite

1. A varredura completa dá **zero** em todos os códigos acima (torres incluídas), sem desligar regra nem afrouxar limite.
2. Cada código novo tem teste de validador (caso que falha e caso que passa).
3. `pillar-design.ts` só cresce o pilar dentro de volume livre no contorno, sem sobrepor, com h ≤ 5b e no máximo 10 cm para fora;
   senão sobe a classe do concreto (C30 a C40, **a classe fica na peça** e `pillarDesign` a lê) ou entra um pilar extra.
4. Sacada: vigas com 2 ou mais apoios, ou balanço curto e de espessura correta; sem sobreposição; **mesmo resultado no modelo de planta
   e no de painéis** (`slab-panels/apply.ts` reaproveita a coluna existente).
5. Agente `engenheiro-estrutural` aprova (8ª revisão).
6. Print na sala 4281 (`?area=floorplan_area&arena=40&template=single_storey_structural&seed=1`, níveis 0 a 8).

## Fora de escopo

Falhas já existentes na base: testes de explosão (blast) de `tower` e `skyscraper` do `game-floorplan-structure`. Ficam registradas, não
são desta spec.

## Base

`feat/structural-masonry-review` @ `6b622409` (e a branch/commit WIP acima). Rebasear na `main` depois que a
`release/casa-a-pa-2026-11-13` for mergeada.
