# 5. Animação e bug: validar em todas as câmeras — **OBRIGATÓRIO**

Texto completo da seção 5 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-10-30, depois de uma correção dos braços com arma feita só na terceira pessoa: a primeira pessoa continuou com o
braço esticado, e na terceira a mira para cima enfiava os braços no corpo.

- Toda mudança em animação, pose, IK, arma na mão ou correção de bug visual é validada em **todas as câmeras** da sala
  (primeira e terceira pessoa, e qualquer outra que exista), **antes** de dizer que está pronta.
- Em cada câmera: parado e andando, mirando para cima, reto e para baixo, e pelo menos uma arma de cada família (pistola, espingarda,
  fuzil, lançador, corpo a corpo, arremesso). Medir na sala real (`examples/test-room`) os números que provam o comportamento
  (ângulo de cotovelo, distância da palma à pega, mão à frente do peito) e tirar um print por câmera como prova final.
- Proporção: o que o corpo segura aparece no **tamanho real** nas duas câmeras, na mesma escala das mãos e dos braços (dono, 2026-10-31:
  a arma da primeira pessoa reduzida ficava de brinquedo nas mãos reais). O teste `hand-targets.test.ts` do `game-weapons-three` falha se a mão
  e a arma se separarem de novo.
- O relatório da tarefa diz em quais câmeras foi validado. Câmera não validada é tarefa não terminada.
