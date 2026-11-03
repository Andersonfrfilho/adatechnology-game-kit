# Spec 006 — Banco de provas de veículos (homologação)

Pedido do dono (2026-11-02): um sistema de prova para cada veículo da frota dizer se ele entra no jogo. Cobre direção, câmeras
(terceira e primeira pessoa, capô, retrovisores, câmera de ré), animações do personagem e dos zumbis na cabine, itens dentro do carro,
portas, terrenos, túnel de vento, velocidade, crash test com boneco e airbag, atropelamento, danos, desempenho, e vale também para
veículos aquáticos e aéreos. Cada veículo sai com uma ficha **aprovado / reprovado / pendente**, e o jogo só deixa entrar o aprovado.

## Pacotes

| Pacote | Camada | O que tem |
|---|---|---|
| `game-vehicles-proving` | L2 núcleo | Contrato de prova (`ProvingTest`, `ProvingProcedure`), faixas por classe (`defaultRangeTable`), provas padrão, execução passo a passo sobre o `game-vehicles-driving` (`startRun`, `runTest`), ficha (`certify`) e porteira (`gateVehicles`). Sem three, sem frota. |
| `game-vehicles-fleet` | L3 conteúdo | `fleetProvingSubject(id)`: o veículo da frota como sujeito de prova (massa, entre-eixos, bitola e 4x4 medidos). |
| `game-camera` | L2 núcleo | `createVehicleCamera`: perseguição, cabine e capô, e `mirrorPoses` (retrovisor interno, laterais, ré). |
| `game-contracts` | L0 | `ModuleView`, `ModuleHost.addView` e `setViewCamera`: um módulo pede vistas extras e pode assumir a câmera principal. |
| `game-test-room` | L5 | `createModuleViews`: cada vista extra num render target, desenhada por cima da tela (espelhada, cantos arredondados). Tudo liberado ao sair. |
| `game-vehicles-three` | L4 adaptador | `createProvingModule`: a área `vehicles_proving` da sala (pista, painel da ficha, linhas-guia da ré, som do motor). A frota entra por opção. |
| `examples/vehicles-proving-area` | L5 | Liga a frota ao módulo; `?area=vehicles_proving`. |

Tudo configurável: faixas (`ranges`), provas a mais ou a menos (`packs`, `patch`, `remove`), assinaturas visuais (`signOffs`) e
relatórios de salas futuras (`reports`), sem mexer no núcleo.

## Fase 1 (esta PR)

- Provas medidas na pista: 0 a 100 km/h, velocidade máxima, frenagem 100 a 0, diâmetro de giro, frenagem molhada 80 a 0, tração na lama.
  Veículo lento roda o 0 a N com N = 80% da máxima e a ficha anota.
- Checagens visuais assinadas na sala: câmeras, retrovisores e ré, cabine.
- Câmeras: sala, perseguição, cabine, capô; retrovisores e câmera de ré com linhas-guia (camada 1, só a câmera de ré vê).
- Achado e corrigido: veículo pesado usava o freio do carro (`semiSpecFromStats` agora dá força de freio proporcional à massa).
- Achado e **não** maquiado: o trator é reprovado (0 a 22 km/h em 0,9 s, frenagem de 1,6 m). O modelo semi não representa bem
  veículo lento e pesado; fica para a fase de terrenos.

## Fases seguintes (as provas já existem na ficha como "sala", pendentes)

| Fase | Sala | Prova |
|---|---|---|
| 2 | Cabine | Personagem entra, abre porta, senta, dirige (animação), zumbi na janela, itens no porta-malas e no banco. |
| 3 | Terrenos | Rampa, lama, areia, cascalho, água rasa, degrau; usa `game-terrain`. |
| 4 | Túnel de vento | Arrasto, sustentação, vento lateral, fumaça nas linhas de corrente. |
| 5 | Crash test | Batida frontal, lateral, capotamento, boneco com airbag, deformação (`game-destruction`), atropelamento. |
| 6 | Desempenho | Quadros por segundo e memória por veículo na sala, com orçamento (CLAUDE.md §7). |
| 7 | Água e ar | Flutuação e estabilidade (barcos), decolagem, voo e pouso (aeronaves). |

## Provas que barram a volta

- `packages/game-vehicles-proving/tests/proving.test.ts`, `game-camera/tests/vehicle.test.ts`, `game-test-room/tests/module-views.test.ts`,
  `game-vehicles-three/tests/proving-area.test.ts`, `game-vehicles-driving/tests/semi.test.ts` (freio do pesado).
- `examples/test-room/leak.mjs`: a área entra na fase `more`.
- `tools/kit-audit/scene.mjs --check --area vehicles_proving`: 0 peças sem origem.
- Prints em `examples/vehicles-proving-area/shots/`.
