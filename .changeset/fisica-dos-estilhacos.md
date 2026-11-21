---
'@adatechnology/game-destruction': minor
'@adatechnology/game-contracts': minor
---

Estilhaços do invólucro (`BlastCharge.casing`), mudança de comportamento: muda o dano da M67, da bomba de cano e de todo explosivo de fragmentação, e a sequência sorteada depois do invólucro.

- O invólucro nunca lança mais raios que `min(maxRays, fragments)`. Cada estilhaço tem direção sorteada por igual na esfera e massa de Mott, de um fluxo semeado pela semente do mundo e pela carga; as massas são normalizadas à massa do invólucro. Um estilhaço que cruza várias esferas de peças conta uma vez.
- São alvo as peças dos objetos do mundo (`world.add`) e as peças dos corpos registrados com `world.register` (hoje, os veículos), peça por peça; a peça de um corpo que é caixa é testada pela caixa. Personagens, multidão e animais não são alvo dos estilhaços.
- O estilhaço perde energia no ar (`exp(-2 k d)`, `fragmentDrag`) e só voa até cair abaixo de `FRAGMENT_MIN_SPEED`.
- Acima do teto: os estilhaços que vão a um corpo registrado são lançados um a um (até o que sobra da metade do teto reservada ao resto); os demais são escolhidos por igual e cada raio vale por `resto / escolhidos` estilhaços, no máximo 8, só nos pontos de vida da peça, na energia dos pedaços de uma peça que quebra e no desgaste das juntas (nunca em furo, saída, penetração ou marca). O que é lançado é determinístico para um estado do mundo e uma carga, mas não é local: acrescentar uma peça em qualquer lugar ao alcance muda quais estilhaços a escolha guarda perto da carga.
- Contra material marcado com `strength.ndrc` (o concreto), o estilhaço só atravessa se o NDRC modificado também deixar (`concretePerforation`, fator de ponta `BlastCasing.noseFactor`, padrão 0,84). O tijolo continua na regra linear. O tiro de arma não muda.
