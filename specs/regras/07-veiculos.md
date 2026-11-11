# 7. Veículos: o que deu errado e as regras para não repetir — **OBRIGATÓRIO**

Texto completo da seção 7 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

Decidido pelo dono em 2026-11-01, depois de carros que passavam nos testes e estavam errados na tela: tiro na janela lateral furava o "teto", tiro no para-brisa furava o
"capô", tiro no ar acima do capô acertava o carro, furo ficava parado no ar quando a porta abria, trinca nascia num canto do vidro e a borracha da janela ficava para trás.

- **O tiro acerta o que está desenhado.** A caixa da peça só diz onde procurar; quem responde é a superfície (`DestructibleImpl.surfaceRay`). Ponto, peça e normal vêm dela.
- **Toda marca pertence à peça que a recebeu** (furo, trinca, amassado, queimado): é filha da peça, e vai com ela quando a porta, o capô ou a tampa se movem. Proibido marca solta no `c.vehicle` de peça móvel.
- **Todo vidro desenhado é uma peça de vidro**, mesmo sem zona de dano própria: nada de vidro que responde como o aço da cabine.
- **O que o desenho já mostra junto sai junto**: ao abrir, a porta leva pele, forro, borda, vidro, borracha e maçaneta.
- **Camada nova não substitui a antiga sem provar o mesmo comportamento**: o PR lista o que a antiga fazia e o teste mostra que continua (foi assim que o furo da camada `destructible/` perdeu o que `zone-decals` já fazia).
- **Todo modelo passa pelo teste de aceitação** `packages/game-vehicles-fleet/tests/vehicle-acceptance.test.ts`, na frota inteira, não numa amostra: contar filhos ou eventos não prova comportamento, o teste mede posição no mundo.
- **Cada categoria tem a sua lista de peças** em [`docs/veiculos-pecas-por-categoria.md`](../../docs/veiculos-pecas-por-categoria.md) (carro, moto, caminhão, trator, barco, avião, militar): material, movimento, resposta ao dano e o que conferir de cada peça. Modelo novo confere a lista da sua categoria.
- **Modelo novo ou mudança em porta, vidro, furo ou colisão** atualiza [`docs/veiculos-verificacao.md`](../../docs/veiculos-verificacao.md) e traz print no jogo real com a porta aberta depois do tiro. Pendência fica escrita lá, nunca escondida.
