# Medição de performance que vale para qualquer placa

Decidido pelo dono em 2026-11-01, durante a Fase 4b. Complementa a D12 do [`plan.md`](plan.md).

## Por quê

O p99 em milissegundos de duas máquinas (a Intel integrada e a RTX deste notebook) não prova nada para uma placa mais fraca ou mais forte,
nem para AMD. Medir só onde temos placa e chamar de "fechado" deixa o jogador de outra placa descobrir a travada.

## Regras

1. **Faixa, não marca.** As metas são por faixa (integrada, dedicada). Nenhum código lê o fabricante da placa para decidir qualidade.
2. **Adaptação pelo custo medido ou pela capacidade.** Tempo de GPU por `EXT_disjoint_timer_query_webgl2`; sem a extensão (Firefox, alguns
   drivers AMD no Windows/ANGLE-D3D11), tempo de quadro. Os dois caminhos chegam ao mesmo comportamento, e um teste força a extensão ausente.
3. **AMD de verdade uma vez antes de fechar.** Esta máquina não tem AMD; alguém roda o `perf.mjs` em modo GPU numa Radeon (dedicada ou APU)
   e anexa o `perf.json` ao `evidence.md`.

## As três camadas da medição

### 1. Travadas que não dependem da placa — contadores, zero absoluto, no CI

Shader compilado durante o jogo, buffers ou texturas enviados fora do warm-up, alocação por quadro (contrato de custo D8), trabalho de CPU
acima do passo fixo. Isso trava em qualquer GPU. Já roda no modo contadores do `examples/test-room/perf.mjs`. **Meta: 0, sempre.**

### 2. Custo por subsistema, normalizado pela placa

- Ao abrir, uma **cena de calibração** curta e fixa (cerca de 2 s: corpos instanciados, as luzes padrão da sala, um lote de partículas)
  dá a nota da máquina em ms de GPU.
- O `perf.mjs` reporta o custo de cada subsistema (sala vazia, horda por nível de detalhe, efeitos, sombras) em **múltiplos da
  calibração**.
- O múltiplo varia pouco entre placas. Com ele dá para **prever o custo numa placa que não temos** e pegar regressão em qualquer máquina:
  o CI compara o múltiplo com o da última medição registrada.

### 3. A adaptação segura o quadro em toda faixa

O critério deixa de ser "p99 ≤ 20 ms nesta máquina" e passa a ser, com o orçamento adaptativo ligado:

- 0 quadros acima de 2× a mediana e 0 acima de 33,4 ms;
- a qualidade converge em até 2 s, sem oscilar (histerese);
- o `detail_scale` final fica registrado. Placa forte termina perto de 1; placa fraca termina menor, mas sem travada.

## Simular placas mais fortes e mais fracas nesta máquina

| Técnica | Como | O que mostra |
|---|---|---|
| Relógio da RTX travado mais baixo | `sudo nvidia-smi -lgc 300,900` (voltar com `-rgc`) e `-pl` com potência menor; exige root, pedir ao dono | Dedicada de entrada. Em 3 ou 4 degraus de relógio sai a curva "custo × força da placa". |
| Escala de resolução | `renderer.setPixelRatio` em 0,5 / 1 / 1,5 / 2 | Separa custo de pixel de custo de vértice em cada degrau; 2 imita tela 4K. |
| Intel integrada | rodar sem as variáveis de PRIME | Piso real da faixa integrada. |
| AMD | máquina de outra pessoa | Driver e ANGLE diferentes; necessária uma vez. |

## O que entra no `perf.mjs`

- `PERF_TIER=integrated|discrete` no lugar de `PERF_GPU=intel|nvidia` (o antigo fica como alias depreciado);
- `PERF_CALIBRATE=1`: roda a cena de calibração e grava a nota da máquina;
- `PERF_PIXEL_RATIO`: a escala de resolução da rodada;
- relatório por subsistema em múltiplos da calibração, e o `UNMASKED_RENDERER` gravado no `perf.json` só como informação.
