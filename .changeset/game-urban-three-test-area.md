---
'@adatechnology/game-urban-three': minor
---

Módulo de teste da cidade (spec 001, T7.3e): `createUrbanTestModule` e `loadUrbanTestModule` põem na sala os cinco postes, a grade de ruas com quarteirão, um trecho de terreno e os dez bairros da amostra da Galeria como itens, com os catálogos do jogo (`urban: { packs, patch, remove }`). A bancada desenha qualquer bairro à frente do jogador com semente, fração de lampiões acesos, orçamento de luzes e, se pedido, os veículos da frota e as espécies da região; camadas do alcance das luzes e da caixa de cada amostra; métricas de chamadas, triângulos, luzes reais e instâncias; oito cenários `urban_*` (altura dos postes, orçamento de luzes, faixas, altura dos prédios, semente, lampiões queimados, terreno e provedores). `examples/urban-test-area` (global `UrbanArea`, `?area=urban`) e o módulo também na `interactables-test-area`.
