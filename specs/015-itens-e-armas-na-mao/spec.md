# Spec 015 — Itens e armas na mão: pega, golpes, pegar e largar, uso

Origem: `docs/animacoes-e-modelos-melhorias.md` (seções 2.2 e 3), itens A2, A5, A6, M6 (armas), M7, B5, B7 a B10 e B12.

## Por quê

As armas da Galeria (137 de 189) têm clipes de tiro e recarga e mão por IK. O resto quase não tem animação:

- **Item sem pega.** `ItemDef` não tem ponto de pega. O item segue a mão direita pelo centro da caixa, com deslocamento fixo
  `(-0.02, 0.015, -0.04)` (`game-test-room/src/room.ts:3428`); a mão só recebe alvo de IK ao desrosquear (`room.ts:2075`).
- **Corpo a corpo sem golpe.** Só soco, empurrão, chute e pá têm clipe (`game-test-room/src/avatar.ts:108`) e só a pá move a
  ferramenta (`game-weapons-three/src/fx/tool-motion.ts:60-62`). Machado, taco, facão, faca, katana e as demais tocam som sem movimento.
- **Pegar, largar e guardar são instantâneos.** Pegar arma apaga o objeto do mundo e constrói o modelo na mão; largar faz respawn a
  0,7 m; arremesso é impulso sem braço (`room.ts:3211-3229, 3341-3380`). Existe clipe de sacar (0,35 s), nenhum de guardar.
- **48 armas fora da Galeria** usam o caminho simples: recuo e recarga são um empurrão exponencial, sem clipe nem mão
  (`box-fx.ts:372-397`). Arco e besta sem corda.
- **31 armas que vêm de item** têm pega por heurística: mão a um terço do comprimento (`item-weapon-draw.ts:31`).
- **Duas câmeras, duas constantes.** `VIEW_HOLD` e `BODY_HOLD` separados; mira só na primeira; um único print de terceira pessoa.
- **Uso de item** só para recipiente de fluido (`room.ts:3521-3522`).
- **Materiais sem leitura:** armas quase pretas em primeira pessoa, itens sem rótulo. **Cápsulas e carregadores** com física própria, só contra o chão.
- **Documentação defasada:** skill e README de itens dizem "24 modelos, 233 faltando" (são 248 de 330).

## Decisões do dono (2026-11-19)

- **D1** Golpes de arma branca são **autorados no kit**, por família, no formato dos clipes atuais.
- **D2** Feito para **melhorar depois**: pega, pose de mão e golpe são dados por item e por família; refinar um item é editar o dado.

## Requisitos

- **R1 — Pega no dado.** Todo item que pode ir à mão declara: ponto e orientação da pega, mãos (uma ou duas, com a segunda pega),
  pose de mão (das poses da spec 014) e por onde se carrega quando não cabe na mão (ombro, duas mãos na frente). Item sem pega
  declarada recebe uma por regra da forma, e o teste lista quais são.
- **R2 — Âncora única.** O item vai na mão do corpo pela pega, nas duas câmeras, sem deslocamento de câmera nem centro de caixa.
  A palma fica a até 1 cm da pega e nenhum dedo atravessa o item nas poses do catálogo.
- **R3 — Golpes por família.** Corte lateral, golpe de cima, estocada, golpe de duas mãos, golpe curto (faca), contundente pesado
  (marreta), arremesso e defesa. Cada arma branca aponta para uma família; o clipe move corpo e ferramenta juntos e marca o quadro
  do impacto, que é quando o dano e o som acontecem.
- **R4 — Mão ↔ mundo com animação.** Alcançar e pegar (do chão, de mesa, de prateleira), guardar e sacar (cintura, costas,
  mochila), largar e arremessar com o braço. O objeto do mundo é o mesmo que vai à mão (sem apagar e reconstruir).
- **R5 — Uso.** Animação de uso para as categorias do catálogo fora de fluidos: curativo, comprimido, lanterna, isqueiro e fósforo,
  rádio, chave e ferramenta de aperto, comer com a mão. O contrato de animação de item do `game-contracts` cobre o uso novo.
- **R6 — Armas fora da Galeria.** As 48 ganham clipes de recuo, ciclo e recarga por família, com a mão no lugar; arco e besta com corda.
- **R7 — Pega das armas de item** declarada no dado, sem heurística de um terço.
- **R8 — Um posicionamento.** Arma na mão do corpo nas duas câmeras, com as mesmas constantes; mira nas duas. Teste e print de
  terceira pessoa por família (§5).
- **R9 — Leitura.** Materiais de arma e item com acabamento por classe (aço, polímero, madeira, tecido) e rótulo em textura de
  canvas nos itens que têm marca ou texto.
- **R10 — Soltos no mundo.** Cápsula e carregador ejetados viram corpos do `game-physics` com orçamento e tempo de vida.
- **R11 — Lote.** Itens compartilham materiais por classe para caber no alvo de 30 chamadas por quadro (`budgets.ts:165`).

## Fora do escopo, com decisão pendente

- **8 armas ainda em caixa** (`pistol_22`, `bow_compound`, `cutting_torch`, `pry_bar`, `utility_knife`, `m203`, `gp_25`, `ag36`) e
  os **82 itens em forma simples**: não há modelo de time. Pela regra §1, modelar no kit ou pedir ao time é decisão do dono; esta
  spec anima o que existe e deixa a lista pronta.
- Tambor e tanque de combustível de `world-explosives.ts` (mesma decisão).

## Critérios de aceite

1. Teste de catálogo: todo item de mão tem pega (declarada ou por regra) e pose de mão; relatório dos que usam a regra.
2. Teste de pega (R2) em todo item de mão, nas poses do catálogo.
3. Teste: toda arma branca do arsenal tem família de golpe; todo clipe tem quadro de impacto; dano e som saem nesse quadro.
4. Teste: toda arma de fogo tem clipes de recuo e recarga (Galeria ou família).
5. Prints (§5): primeira e terceira pessoa, uma arma por família, parado, andando, mira alta, reta e baixa; golpe de cada família.
6. Gates do kit verdes; `kit-audit` e docs atualizados.
