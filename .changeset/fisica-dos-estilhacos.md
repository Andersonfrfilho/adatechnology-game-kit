---
'@adatechnology/game-destruction': patch
---

Estilhaços do invólucro (`BlastCharge.casing`): o invólucro nunca lança mais raios que `min(maxRays, fragments)` (cada estilhaço tem direção sorteada por igual na esfera e massa de Mott de um fluxo semeado pela carga; as esferas sobrepostas das peças não contam o mesmo estilhaço duas vezes; as massas sorteadas não passam da massa do invólucro), e cada estilhaço perde energia no ar (`exp(-2 k d)`, `fragmentDrag`) e só voa até cair abaixo de `FRAGMENT_MIN_SPEED`. Muda o dano dos explosivos de fragmentação (M67, bomba de cano) e a sequência sorteada depois do invólucro.

Corpo registrado (veículo, personagem) é mirado peça por peça. Acima do teto, os estilhaços que vão a um corpo registrado são todos lançados e os demais valem pelos que ficaram de fora (só nos pontos de vida e no desgaste das juntas). Contra material com `strength.compressiveMPa` (concreto, tijolo), o estilhaço só atravessa se o NDRC modificado também deixar (`concretePerforation`); o tiro de arma não muda.
