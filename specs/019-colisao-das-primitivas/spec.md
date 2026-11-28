# 019 — A colisão vem das primitivas que o construtor desenha

**Dono:** Anderson · **Aberta em:** 2026-11-27 · **Regras:** CLAUDE.md §1 (SDK primeiro), §3 (SDKs se compõem), §12 (nenhum colisor sem geometria)

## Problema

O construtor de uma peça sabe cada primitiva que desenha (`api.box`, `api.cylinder`...). O `game-shapes` assa todas numa malha por (parte, material) e
essa informação se perde. Depois o `game-destruction-three` **adivinha** a forma de volta lendo vértices, por quatro caminhos diferentes:

| O quê | Onde | Como adivinha |
|---|---|---|
| peça solta, parte por faixa de malha unida (casa) | `renderer.partBoxesOf` | `hollowBoxesOf` (grupos de 24 vértices) ou `fitOrientedBoxes` |
| peça solta, malha própria (móvel) | `renderer.partBoxesOf` | `hollowBoxesOf` (desde o #575) ou a caixa em volta da malha |
| parte fixa | `measureStaticPart` | caixa se os cantos e as faces batem, senão triângulos |
| destroço | `fragments` | caixa do fragmento |

Toda adivinhação tem um caso que escapa. Em 2026-11-27 a casinha de cachorro, desenhada como tábuas em volta do ar, colidia como uma caixa maciça: as lascas
nasciam dentro de um sólido e nunca paravam. O #575 remendou o caso das caixas; a guarda criada nele (`hollow-test.mjs`) ainda acusa 5 peças na sala e o
`hollow-catalogue.test.ts` lista 14 no catálogo de móveis, todas de formas redondas ou com mais de 16 caixas por malha.

## O que muda

1. **`game-shapes` entrega os sólidos de cada lote.** Com `GenerateOptions.solids`, cada `ShapeBatch` traz `solids`: uma entrada por primitiva assada, com a
   caixa orientada dela no espaço do lote (centro, meias-medidas, rotação), o tipo (`box`, `cylinder`...) e a faixa de vértices que ela ocupa.
2. **`game-interactables-three` grava isso na malha:** `mesh.userData.solids`.
3. **`game-destruction-three` usa os sólidos quando a malha os traz**, na peça solta e na parte fixa, sem ler vértices. Malha sem `userData.solids` (casa,
   veículo, o que ainda não migrou) segue pelo caminho atual, sem mudança.

## Critérios de aceite

- **A1** Um móvel feito pelo mesh api colide, solto e fixo, exatamente pelas caixas das primitivas que o construtor desenhou: banco com pernas redondas deixa um
  bloco passar por baixo do assento; a casinha deixa um raio entrar pela porta.
- **A2** `examples/test-room/hollow-test.mjs` passa com `KNOWN` **vazio** (as 5 peças saem da lista) ou com cada sobra explicada no `evidence.md`.
- **A3** Guarda de catálogo no CI (`game-interactables-three`): em toda peça do household e do props3d, todo vértice de cada malha está dentro de um sólido
  dela (folga de 1 cm) e nenhum sólido existe sem vértice.
- **A4** `destruction-pieces-never-rise`, `broken-catalogue` e `settle` continuam verdes; goldens bit a bit só regravam com a causa provada.
- **A5** Custo: `shapes-bench --cost-check` verde; o `generate` sem `solids` não muda um byte.

## Fora do escopo (dívida declarada)

Paga em 2026-11-28 (`evidence.md`): cilindro colide como cilindro, curva como casco, peça só é redonda se o desenho a preenche, e as 14 peças do catálogo de
móveis saíram da lista. Fica a guarda de ar para as casas.
