# Proposta D2: espalhar a explosão em vários quadros

Status: **aguardando decisão do dono** (D2 segue aberta). Nada disto está implementado na main.
Medido em 2026-11-22 na RTX 5070 Laptop (`machine.gpu` em todo JSON). Os dados brutos estão em
`~/.cache/adatechnology-game-kit/medicoes/2026-11-22-d2-espalhar/`, e o protótipo descartável na
branch `spike/d2-espalhar-explosao`. Foi caso M67 na casa `floorplan`, 1x, 3 rodadas por variante,
com carga entre 1,2 e 2,0 (a máquina nunca ficou abaixo de 1,5 durante a série inteira).

## Resposta curta

Pausar a simulação enquanto os estilhaços são lançados em fatias **derruba o quadro da explosão de
~89 ms para ~18 ms**, mas **não chega a 33,3 ms em todo quadro**. O custo reaparece no quadro em que
o mundo volta a andar, que fica entre 34 e 45 ms em todas as variantes. Esse quadro soma a onda de
choque (~15 ms, ainda numa fatia só) e a aplicação de todos os eventos estruturais de uma vez
(~24 ms), porque eles só são aplicados no tique fixo.

A recomendação é seguir com a pausa, mas com duas peças a mais, e medir antes de implementar.
O plano está no fim.

## Onde vai o tempo hoje (M1 e M2)

| Medida | r1 | r2 | r3 |
|---|---|---|---|
| f0 total (update + render CPU) | 85,7 | 101,6 | 88,0 |
| `throwCasing`, laço dos 256 raios | 19,3 | 26,9 | 19,8 |
| onda (`blastScene`) | 15,2 | 16,4 | 14,7 |
| aplicar eventos dos estilhaços | 21,9 | 25,4 | 20,9 |
| aplicar eventos da onda e outros | 1,9 | 1,7 | 1,5 |
| f1 / f2 | 19,0 / 13,3 | 19,2 / 15,5 | 19,8 / 16,6 |

- **Os estilhaços são ~40% da simulação, mas pelo menos 92% da aplicação dos eventos.** São 1140
  eventos de estilhaço contra 547 da onda. Os 192 furos (`hole`) custam 9,7 ms, e as 3 fraturas 5,0 ms.
- **Poucos raios custam muito.** A mediana fica perto de 0 ms, o p99 fica entre 0,8 e 1,6 ms e o
  máximo entre 1,9 e 2,3 ms, quando o raio bate rente à parede. Fatiar por número fixo de raios dá
  fatias desiguais (de 1,5 a 6,5 ms com K=32).

## As variantes medidas (M4)

O "pior depois de f0" é quase sempre o quadro em que o mundo volta a andar.

| Variante | f0 (3 rodadas) | Quadros congelados | Pior depois de f0 |
|---|---|---|---|
| hoje, sem fatiar | 95,7 / 86,1 / 85,8 | 0 | 18,7 / 19,9 / 19,2 |
| pausa (`simulate:false`), K=32 | 20,2 / 19,5 / 18,7 | 9 (150 ms) | 37,4 / 33,9 / 36,4 |
| pausa (`simulate:false`), K=64 | 18,1 / 17,1 / 18,0 | 5 (83 ms) | 39,7 / 36,7 / 36,2 |
| pausa (`simulate:false`), K=128 | 38,7 / 30,3 / 36,0 | 3 (50 ms) | 35,7 / 34,8 / 35,2 |
| só o tique fixo parado, K=32 | 18,9 / 18,3 / 19,2 | 9 | 45,4 / 37,8 / 44,1 |
| só o tique fixo parado, K=64 | 26,2 / 21,0 / 22,3 | 5 | 44,8 / 43,2 / 42,6 |
| sem pausa, K=32 | 26,5 / 32,3 / 25,7 | 0 | 35,9 / 34,8 / 36,3 |
| sem pausa, K=64 | 29,8 / 29,7 / 29,2 | 0 | 36,1 / 39,1 / 37,0 |

Com o mundo congelado, cada quadro custa de 13 a 20 ms, e não os ~4 ms de um quadro parado puro
(M3). Isso acontece porque cada quadro também paga a sua fatia e a fila de efeitos dos eventos que
ela acabou de gerar.

## O que a medição mostrou além dos números

1. **O `simulate:false` que já existe também congela a bola de fogo.** Ele pula o `lateSimulate`,
   e o `vfx.update` está ali. Uma pausa de verdade precisa parar só o tique fixo; no protótipo isso
   se chama `freezeFixed`. Essa forma custa o mesmo nos quadros congelados, e o quadro de volta
   piora (38 a 45 ms). Esse é o mesmo problema da aplicação acumulada.
2. **Os mesmos bytes valem no pacote, não estão provados na sala.** Um teste unitário
   (`d2-slice.spike.test.ts`) mostra que eventos, `serialize()` e resultados ficam idênticos byte a
   byte para K = 1, 7, 32, 64 e 128. Na sala, duas rodadas **iguais e sem fatiar** já dão hashes
   diferentes em 5 de 6 pares, e o número de eventos varia entre 1685 e 1692. A sala não é
   determinística hoje, então não dá para comparar a pausa com o original nela. As suspeitas são as
   filas por prazo de relógio e o retorno do Jolt; nenhuma das duas foi testada.
3. **Sem pausa, o estado final muda.** Isso era esperado, mas não foi demonstrado na sala pelo mesmo
   motivo do item 2.

## O que muda no contrato entre pacotes (variante com pausa)

- **`game-runtime`, agendador:** um modo que pare só os tiques fixos e o acumulador, e mantenha a
  entrada, o `lateSimulate` e os efeitos rodando. O `simulate:false` não serve para isso.
- **`game-destruction`, API do mundo:** hoje o `explode` devolve o resultado na hora. Com a pausa,
  ele precisa devolver um handle retomável (`advance(raios)`, `done`, resultado no fim). O mundo fica
  "dentro de uma operação" entre as fatias (`runDepth`, `pendingStructure`), e é preciso definir o que
  acontece com uma segunda explosão antes da primeira acabar. A proposta é enfileirar, nunca rodar
  por dentro.
- **`game-destruction`, renderer:** o `applyStructuralEvents` precisa ser fatiado também, nos quadros
  congelados, em vez de despejar ~24 ms no primeiro tique de volta.
- **Sala de teste e explosivos:** o `detonate` usa o resultado na hora para o relato, para
  `renderer.explode({report})` e para as contagens. Com a pausa, o resultado chega quadros depois.

## Recomendação

**Pausar só o tique fixo (os efeitos continuam), com K=64 e também a aplicação dos eventos
estruturais fatiada nos quadros congelados.** O orçamento por quadro vem do mesmo K, nunca de ms,
para continuar determinístico.

Por que K=64: f0 fica em ~18 ms, o mundo para por 5 quadros (83 ms, perceptível só como um soluço
do mundo no estouro, com o fogo andando), e as fatias ficam entre 3 e 8,5 ms.

Estimativa, **não medida**: ~24 ms de aplicação repartidos em 5 quadros somam de 4 a 5 ms a cada
quadro congelado (ficariam entre ~20 e 25 ms). O quadro de volta cai para a onda (~15 ms) mais o
render (~7 ms), perto de 25 ms. Ainda falta medir isso. Se a onda sozinha ainda estourar, ela também
precisa ser fatiada pelas partes da cena, o que não foi tentado.

## Plano proposto, em ordem

1. **Tornar a sala determinística** (pré-requisito). Sem isso, nenhuma variante tem como provar
   "mesmos bytes" na sala. Começar pelas filas por prazo de relógio. Isso é investigação, não muda
   comportamento.
2. **Segundo protótipo, curto:** fatiar a aplicação dos eventos estruturais nos quadros congelados
   e medir o quadro de volta com K=64. Se passar de 33,3 ms, fatiar também a onda.
3. **Só então implementar de verdade**, com a mudança de contrato acima, o gate da régua
   `room-explosion` e os testes de mesmos bytes no pacote e na sala.

Se o dono preferir parar antes, a alternativa honesta é implementar a pausa como está. O pior
quadro cai de ~89 ms para 34 a 45 ms, com 1 a 3 quadros acima da meta por explosão, e a D2 fica
parcialmente atendida.
