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

## Sistemas do carro na cabine (lista do dono)

Fases 1 a 4 (mescladas em 2026-11-04): controles, painel, bateria e temperatura, estepe, embreagem, auxílios, carroceria, ejeção sem cinto, sensor de ré.
Fase 5 (2026-11-05), no SDK e ligada na área `vehicles_proving`:

| O quê | Onde | Na sala |
|---|---|---|
| Ligação direta: sem a chave, a ignição recusa; segurar I descasca e junta os fios (8 s) e o motor de partida gira; alarme armado dispara no primeiro toque | `game-vehicles-driving` `createVehicleControls({ hasKey: false })` | bancada "Tirar a chave"; segurar I |
| Sirene (contínua e rápida) e giroflex, só em veículo de emergência, gastando bateria | `createVehicleControls({ emergency })`, `DEFAULT_LOADS.siren/beacon`; lâmpadas marcadas `userData.lamp = 'beacon'` na frota (as viaturas da polícia, a da rodoviária, a moto da rodoviária, a `ambulance` e o `armored_truck`), piscadas por `createVehicleLamps` | `;` sirene, `'` giroflex |
| Porta-luvas e porta-malas como compartimentos (vagas, peso, só alcançados abertos) | `createVehicleStorage`, `GLOVEBOX`, `trunkFor(litros)` | `/` porta-luvas, 6 porta-malas; bancada "Ver o porta-luvas", "Ver o porta-malas", "Tirar um item" (cai no chão como item do catálogo) |
| O que tem dentro: o recipiente `car_trunk` do time de itens (0 a 3: mapa, lanterna, chave no porta-luvas; macaco e kit de primeiros socorros no porta-malas) | `examples/vehicles-proving-area/src/entry.js` `createCarStock` | ao entrar no carro |
| Para-brisa embaçando por dentro (respiração, roupa molhada, frio e chuva no vidro; desembaçador com motor quente, ar-condicionado e vidro aberto limpam; limpador não) | `createWindshieldFog` (`game-vehicles-driving`), película `createWindshieldMist` (`game-vehicles-three`) | bancada "Tempo: frio e chuva"; métrica "Vidro embaçado"; `=` desembaçador |

## Provas que barram a volta

- `packages/game-vehicles-proving/tests/proving.test.ts`, `game-camera/tests/vehicle.test.ts`, `game-test-room/tests/module-views.test.ts`,
  `game-vehicles-three/tests/proving-area.test.ts`, `game-vehicles-driving/tests/semi.test.ts` (freio do pesado).
- `examples/test-room/leak.mjs`: a área entra na fase `more`.
- `tools/kit-audit/scene.mjs --check --area vehicles_proving`: 0 peças sem origem.
- Prints em `examples/vehicles-proving-area/shots/`.
