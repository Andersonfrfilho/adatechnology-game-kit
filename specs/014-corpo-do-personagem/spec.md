# Spec 014 — Corpo do personagem: juntas, mãos, rosto, custo e multidão

Origem: `docs/animacoes-e-modelos-melhorias.md` (seções 2.1 e 3), itens M3, M4 (peça), M5, M11, B1 a B6 e B11.

## Por quê

O corpo é uma árvore de peças rígidas: cilindro afinado com esfera na junta (`game-characters-three/src/rich/best-builder.ts:164-283`).
Sem skinning. O que aparece na tela:

- **Juntas.** Ombro em bola saliente (esfera 0,088 em x = 0,305, `best-builder.ts:270-272`); quadril do Bestiário sem esfera, com
  cilindro de topo plano (`:171-172`); cotovelo do corpo instanciado sem esfera (`instanced/body-geometry.ts:147-160`).
- **Sem tornozelo.** O sapato é uma esfera filha do joelho (`best-builder.ts:177`). Sem pulso no Bestiário.
- **Mãos.** Dedos só no sobrevivente em detalhe 0 e no jogador, com 2 falanges e um ângulo só (`accessories/hands.ts:10`,
  `person-builder.ts:200`); zumbi e multidão têm esfera achatada (`best-builder.ts:275`). Sem pose de mão por item.
- **Rosto em caixas** no Bestiário e no jogador (`best-builder.ts:229, 254-261`); sem piscar nem expressão. O sobrevivente tem rosto
  melhor (`person-builder.ts:93-100`) que o jogador não usa.
- **Custo.** 44 a 111 chamadas de desenho por pessoa; sobrevivente com 19.982 triângulos e "LOD" que só tira dedos
  (`person-builder.ts:87-99`). Assado "Lento" com 9.018 triângulos contra orçamento de 2.500 (`body.json:69`).
- **Multidão.** Membro arrancado colapsa no pivô, sem coto (`body-chunk.ts:55-60`); troca de LOD sem transição; impostor com uma
  silhueta por tipo (`game-crowd-three/src/renderer.ts:182`).
- **Aparência de boneco.** Cor chapada, sem dobra nem sombra de contato.
- **Cobertura.** O catálogo de z-fighting não inclui farda, cortes, humano nem o avatar com mãos (`tests/catalog-cases.ts:33-34`).
  25 itens de mão em caixas (`accessories/hand-items.ts:23-47`).

## Decisões do dono (2026-11-19)

- **D1 — Juntas feitas para melhorar depois.** A construção de cada junta fica atrás de **uma costura só** (um construtor de junta
  com contrato fixo). A primeira implementação é cápsula e esfera; trocar por skinning de 2 pesos, ou refinar uma junta, é trocar a
  implementação sem mexer em quem monta o corpo.
- **D2** Mudança sobre o porte do Bestiário v17 e do Retratos é **desvio registrado no kit**.

## Requisitos

- **R1 — Costura de junta.** Ombro, cotovelo, pulso, quadril, joelho, tornozelo e pescoço saem de `jointPiece(kind, params)`.
  Nenhum construtor de corpo desenha junta à mão. O contrato aceita uma segunda implementação (skinning) sem mudar a chamada.
- **R2 — Sem vão nem degrau.** Em toda pose do catálogo (parado, agachado, sentado, mirando alto e baixo, correndo, caído) nenhuma
  junta mostra borda de cilindro, vão ou esfera saliente além de 5 mm da superfície dos segmentos.
- **R3 — Tornozelo e pulso.** Pé com sola e peito do pé, articulado no tornozelo; mão articulada no pulso. Canais novos opcionais (spec 013).
- **R4 — Mãos em todo corpo rico.** Cinco dedos com 3 falanges (2 no polegar), também no zumbi. Poses de mão em dado: relaxada,
  punho, pega de cabo, pega de pistola, pega de cilindro, palma aberta, apontar. Multidão continua com mão simples.
- **R5 — Rosto.** Um construtor de rosto só, usado pelo sobrevivente, pelo jogador e pelo Bestiário (com deformação de zumbi), com
  piscar, olhar e mandíbula como canais.
- **R6 — Custo.** Corpo rico fundido por material: até 12 chamadas por pessoa. Segmentos pela qualidade em todo construtor. Três
  níveis reais (perto, médio, longe) com orçamento em dado; assado dentro de `body.json`.
- **R7 — Multidão.** Coto no membro arrancado; troca de LOD com transição por pontilhado; impostor por variante.
- **R8 — Leitura.** Sombra de contato e oclusão por vértice no assado; dobra de tecido por normal procedural; materiais por classe
  (pele, tecido, couro, metal) com parâmetros em dado.
- **R9 — Itens de mão do SDK.** Os 25 itens de `hand-items.ts`, o rádio e a garrafa vêm do `game-items-three` por injeção (o pacote
  de personagens não importa o de itens: `check:layers`).
- **R10 — Fardas.** Cada força do `-uniformed` e cada traje do `-undead` tem desenho próprio declarado em dado, sem `OUTFITS` fixo no construtor.
- **R11 — Sem z-fighting.** O catálogo de casos cobre farda, cortes, humano, avatar com mãos e toda pose da R2; ledger continua vazio.

## Fora do escopo

- Skinning de 2 pesos em si (fica possível pela R1; decide-se com os prints).
- Animação (spec 013). Altura (spec 012). Arma e item na mão (spec 015).

## Critérios de aceite

1. Teste de junta: para cada pose do catálogo, distância máxima entre a superfície da junta e a dos segmentos ≤ 5 mm; nenhum vão.
2. Teste de custo: chamadas e triângulos por tipo e nível dentro do orçamento do dado.
3. `tests/z-fighting.test.ts` com o catálogo ampliado e ledger `{}`; `revisor-z-fighting` sem achado.
4. `kit-audit` sem as pendências de `rich/accessories/`; `check:layers` verde.
5. Prints por câmera (§5) de cada tipo em cada pose do catálogo, antes e depois, em `evidence.md`.
6. Desvios do porte registrados; `leak.mjs` verde (§8).
