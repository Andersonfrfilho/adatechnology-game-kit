# 020 — O destroço grande é corpo rígido

**Dono:** Anderson · **Aberta em:** 2026-11-28 · **Regras:** CLAUDE.md §12 (objetos quebrados), §3 (SDKs se compõem), §15 (o que entra na física roda no passo fixo)

## Problema

O que sobra de uma parte quebrada nasce como fragmento do `FragmentSystem` (`game-destruction-three/src/fragments.ts`). Esse sistema é uma física leve, escrita
para lasca de centímetros: o chão é o ponto mais baixo da caixa, a pilha é caixa alinhada, o peso não gira nada e as regras têm constantes em rad/s. Só que o
fragmento "grande" (`isBig`: 20 cm ou mais de comprido e 3 cm ou mais de largo, e toda barra de armadura) também passava por ela, e uma tábua de mesa quebrada
tem até 4,2 m.

Em 2026-11-28 o dono mostrou as tábuas de uma mesa quebrada em pé na ponta, subindo e tremendo. Medido: pedaço de 4,2 m com o meio a 1,71 m do chão 8 s
depois de quebrar. O #613 remendou as duas regras que erravam por tamanho; o modelo continuou sem alavanca, sem apoio real e sem encostar em nada.

## O que muda

1. **O fragmento grande é movido por um corpo rígido do motor.** O `FragmentSystem` continua dono da malha, do limite (`maxFragments`), da vida e da limpeza
   (`removeHome`, `clear`); quem escreve a posição e o giro da malha é o corpo (`FragmentSystemOptions.rigid`, porta `RigidDebris`). O renderer liga a porta
   ao sistema de peças (`pieceSys.create`), que já cuida de chão, sólidos fixos, explosão e orçamento de acordados.
2. **Camada própria no contrato de física: `rubble`.** Encontra o mundo fixo e outro `rubble`, e mais nada. Não empurra nem é empurrado por peça solta,
   pessoa ou carro: isso continua como era (o jogador pisa e chuta pelo `solidsNear`/`LooseBody`, que não mudam de contrato).
3. **Nasce onde a coisa quebrou.** O pedaço feito dentro de um sólido fixo que continua em pé (a barra dentro da parede) ou encostado no pedaço cortado ao
   lado atravessa aquilo até sair, em vez de ser espirrado para fora (`EnginePieces.throughStatics`).
4. O fragmento pequeno segue na física leve, sem mudança.

## Critérios de aceite

- **A1** `long-debris-settles.test.ts`: pedaços de 10 cm a 4,2 m, três seções, inclinados até 80°: nenhum sobe mais de 30 cm acima de onde quebrou, nenhum
  termina a mais de 45° nem com o meio a mais de 50 cm, nenhum se mexe 12 s depois. Reprova no código anterior a qualquer correção.
- **A2** Só a raiz passa: a tábua que cai com uma ponta sobre um caixote termina **apoiada no caixote**, com a outra ponta no chão. Na física leve ela
  atravessa o caixote e deita no chão.
- **A3** As réguas do dono não mudam: `destruction-pieces-never-rise` (0,5 m), `broken-catalogue`, `broken-catalogue-spin` (4,5 m/s) e `furniture-laid-still`
  verdes sem tocar em limite.
- **A4** `broken-catalogue-settles`: a lista de dívida diminui (14 → 9).
- **A5** Na sala, mesa de 4,4 m quebrada a tiro: 4 s depois do último tiro todo pedaço comprido está deitado e dormindo.
- **A6** Goldens exatos só regravam os três de destruição das casas (o entulho muda de pose), com ok do dono.

## Fora do escopo (dívida declarada)

- **Destroço × peça solta, pessoa e carro.** O pedaço grande não encosta em móvel solto: a tábua atravessa uma cadeira solta, como antes. Ligar isso muda a
  régua "peça de casa destruída não sobe" (numa explosão de 2 MJ o entulho lançado levantou uma porta 1,2 m) e é decisão do dono.
- **Lasca pequena em pilha.** As 7 entradas `debris` de `broken-catalogue-settles` são lascas de centímetros que escorregam umas das outras sem parar, na
  física leve. Quais móveis mostram muda com a ordem em que as lascas saem; o que se segura é a contagem.
- **Tiro não acerta destroço** (nunca acertou: o mundo de destruição não conhece fragmento).
- **Fragmento não é salvo** (nunca foi).
- **Desempenho:** não medido com `perf-gate`. Cada pedaço grande é uma caixa no motor, no máximo `maxFragments` (160).
- **`shower`, `shower_large`:** peça pequena que não para de girar (já era corpo do motor; outro defeito).
