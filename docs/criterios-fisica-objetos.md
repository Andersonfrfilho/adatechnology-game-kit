# Critérios de física por objeto

Todo objeto do kit (móvel, item, veículo, parede, estrutura, planta) só é dado como pronto depois de passar **nos vinte e um critérios abaixo**, testado na sala de
testes com print. Qualidade acima de velocidade: pode demorar num objeto, mas ele sai atendendo a todos. O comportamento vem do material, como no mundo real
(regra de física realista do projeto); só se pergunta ao dono o que for ambíguo.

A referência de qualidade é a **latinha** (`item_canned_*` de `game-items-goods`): o tiro fura no ponto atingido, o conteúdo vaza pelo furo e se espalha, o corpo amassa.

| # | Critério | O que tem que acontecer |
|---|---|---|
| 1 | **Material e massa** | Cada peça tem o material do SDK que ela tem no mundo real (pé de madeira, tampo de vidro, estrutura de aço, espuma, tecido) e o objeto tem a massa real (kg). Nada de "corpo inteiro de um material só" quando o objeto real é feito de vários. |
| 2 | **Tiro** (por calibre) | Dano exatamente no ponto atingido (furo passante ou alojado conforme energia x espessura), resposta do material (lascas, farpas, torrões e pó, faíscas, estilhaços) e impulso a partir do ponto (tiro no alto tomba para trás, embaixo arrasta ou derruba de outro jeito). Calibres maiores atravessam mais. |
| 3 | **Golpes**: soco, chute, faca | Soco e chute empurram ou derrubam conforme a massa e o ponto, amassam o que é dúctil, racham o que é frágil e soltam junta (chute arranca pé de cadeira). A faca corta o que é macio (tecido, espuma, plástico fino, planta) e só risca o que é duro. |
| 4 | **Explosão e fogo** | Explosão: dano pela distância, juntas se soltam, pedaços voam, inflamáveis acendem. Fogo: madeira, tecido e espuma queimam e carbonizam até cinza; plástico derrete e pinga com fumaça preta; metal esquenta e não queima; vidro trinca por choque térmico. |
| 5 | **Destruição no padrão da latinha** | Furo localizado no ponto, conteúdo de dentro vazando ou se espalhando (líquido, grãos, roupas, lixo, livros) e deformação do corpo (amassa, entorta, racha, lasca). |
| 6 | **Pegar** | O que pesa até o limite de carga (`maxCarryKg`, 60 kg) pode ser pego com a animação de pegar; o que pesa mais não, e a sala diz por quê. |
| 7 | **Usar** | A ação de uso do objeto (abrir porta, gaveta, tampa; beber; ligar; sentar) roda com a animação e o som certos. |
| 8 | **Entre outros objetos** | Colocado no meio de outros, ele colide com eles: não atravessa, apoia, empurra e é empurrado; destroços e itens soltos colidem entre si. |
| 9 | **Personagem esbarrando** | O jogador e os personagens não atravessam o objeto; ao passar esbarram nele, e o que é leve se mexe. |
| 10 | **Ser empurrado** | O jogador (andando contra, ombro) e outros objetos (algo atirado, um destroço, a onda da explosão) empurram o objeto conforme a massa e o atrito. |
| 11 | **Persistência depois de destruído** | Destroços grandes (escombros de prédio, móvel quebrado, carcaça) ficam no mapa como parte dele, com colisão. Efeitos passageiros (poeira, fumaça, faíscas) somem com o tempo. Partículas pequenas e conteúdo derramado têm um tempo de vida definido. Os tempos ficam no SDK por material e por objeto. |
| 12 | **Animações do personagem com o item inteiro e quebrado** | Com o item inteiro: segurar, pegar e usar com a pegada e a animação certas. Com o item danificado ou quebrado: a animação reflete o dano (lata furada vaza ao beber, cadeira sem pé não aguenta sentar) ou o uso fica impossível quando não faz sentido, e a sala diz por quê. |
| 13 | **Som por material e golpe** | Cada material responde com o som dele a cada golpe (tiro em aço tine, em madeira estala, em vidro estilhaça; soco em MDF é oco, em concreto é seco), e a queda e o arrasto têm som. |
| 14 | **Peso e massa no comportamento** | A massa real decide o quanto o objeto anda com cada impulso, a velocidade de quem o carrega e se cabe na mão; nada leve que não se mexe nem pesado que voa. |
| 15 | **Queda e gravidade** | Solto no ar ou sem apoio (prateleira quebrada, pé arrancado), cai, tomba pelo centro de massa, quica conforme o material e se acomoda; o que é frágil quebra na queda conforme altura e material. |
| 16 | **Água e líquidos** | O que é recipiente guarda, derrama e vaza pelo furo; molhar muda o que tem que mudar (apaga fogo, MDF incha, papel amolece) e o objeto boia ou afunda pela densidade. |
| 17 | **Reação em cadeia** | O que é inflamável ou pressurizado responde ao vizinho: fogo se espalha, botijão e tanque armam e explodem, um objeto que cai derruba o que está embaixo. |
| 18 | **Desgaste visual persistente** | Furos, amassados, lascas, queimado e manchas ficam no objeto enquanto ele existir (inclusive depois de pegar, soltar e ser empurrado) e não somem com o tempo. |
| 19 | **Desempenho** | Número de peças, fragmentos e partículas dentro dos limites; LOD e reaproveitamento de peças, sem queda de quadro visível com vários objetos sendo destruídos ao mesmo tempo. **Cada ação** (tiro, golpe, explosão, fogo, empurrão, queda) é medida: tempo de quadro antes e durante, pico, número de peças, destroços e partículas, e os números vão para o relatório do objeto. Técnicas de jogo a aplicar no SDK onde a medição mostrar gargalo (sem otimização prematura): instancing e batching de destroços e partículas, pool de objetos, LOD e culling por distância, corpo físico parado dorme, destroços parados fundidos numa malha só, teto de partículas por quadro, atlas de decalques e nada de alocação por quadro; toda otimização é medida antes e depois. |
| 20 | **NPCs e zumbis** | Personagens e zumbis colidem, esbarram, empurram, sobem ou contornam o objeto, e podem golpeá-lo e quebrá-lo como o jogador. |
| 21 | **Inventário** | O que pode ser guardado entra no inventário com o peso e o volume reais e sai do mesmo jeito que entrou, inclusive com o dano que tinha. |

## Como verificar

1. Abra a sala de testes (`examples/test-room`, servida na 4280) com o objeto (`?items=<id>`) ou pela mesa de testes, que já roda tiro, soco, faca, fogo e explosão
   num objeto escolhido.
2. Rode os vinte e um critérios e tire um print de cada comportamento.
3. Registre o resultado na tabela de acompanhamento abaixo. Dúvidas de comportamento vão para o dono em perguntas curtas, por objeto.

## Acompanhamento

| Objeto | Pacote | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
