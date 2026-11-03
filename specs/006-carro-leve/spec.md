# Spec 006 — Carro com peças independentes e leve de desenhar

Pedido do dono em 2026-11-02, na conversa de performance da spec 005: o carro mantém portas, vidros, bancos, motor, pneus e rodas,
para-choques e saias laterais como peças independentes, cada uma com dano próprio, e roda leve. Limite da regra de custo
(`tools/kit-audit/budgets.json`): 60 chamadas de desenho por veículo, contando a sombra. Hoje o sedan tem ~370 malhas, 580 chamadas
e 205 mil triângulos.

## Princípio

A malha que a lógica usa (dano, raio, zona, corte, golden) **não muda**. O que muda é o que vai para a tela: as malhas intactas e paradas
de um veículo são desenhadas juntas, um lote por material; a malha que sofre dano, se move (porta abrindo) ou some volta a ser desenhada
sozinha no mesmo quadro. Os testes que comparam com o original (`golden`, `torn-panels-digest`) continuam valendo sem mudança.

## Fases

| Fase | O que | Aceite |
|---|---|---|
| 1 | `createStaticBatcher` no `game-render-three`: junta as malhas de um objeto por material, num lote por material; a original sai da tela por camada (`layers`), não por `visible`, então raios e código que lê `visible` não mudam; mudança de posição, matriz, visibilidade ou material devolve a malha ao desenho próprio. Raios do kit leem todas as camadas. | Testes do pacote; `game-vehicles` e frota sem mudança nos goldens |
| 2 | Ligar no veículo perto (`game-vehicles-three`): completo de perto em lotes; fundido de longe (já existe). | Sedan ≤ 60 chamadas parado e de perto; 171 PASS; print nas duas câmeras |
| 3 | Sombra do veículo por um modelo simplificado (uma malha), não pelas peças. | Chamadas de sombra do sedan ≤ 5 |
| 4 | Dano preparado: lataria dividida nas emendas reais (sem corte em tempo de jogo); trinca do vidro de um atlas pronto. | `chain_horde` 0 quadros > 33,4 ms nas duas placas |
| 5 | Detalhe pequeno em textura (parafusos, frisos, emblema): sedan 40–60 mil triângulos de perto. | Regra de custo: sedan fora de `pending` |
| 6 | Aplicar na frota (69 veículos), um grupo por vez. | Regra de custo: veículos fora de `pending` |

Fases 4 a 6 mudam o modelo e os goldens: cada uma pede aprovação do dono antes, e é combinada com a conversa dos carros
(`fix/car-behaviour`), que mexe no mesmo pacote.

## Critérios do objeto

Cada fase passa pelos 21 critérios de `docs/criterios-fisica-objetos.md` no que tocar (dano no ponto, pegar, abrir, colisão, desempenho),
testados na sala real com print.
