# Spec 011 — Cena de referência: o kit monta um mundo de jogo só pela API pública

> Estado: **decidida em 2026-11-24, em execução.** A primeira versão é de 2026-11-18 (branch `spec/011-cena-de-referencia`); a revisão de
> 2026-11-21 (`docs/spec-011-revisao`) conferiu tudo contra a `main` daquele dia e deixou dez decisões abertas. Em 2026-11-24 o dono decidiu
> as dez (§9) e acrescentou o cenário `caos` (§4, §5). Esta versão foi trazida para cima da `origin/main` de 2026-11-24 (`923fa511f`) e
> corrigida onde a `main` andou (§6, §8).

Pedido do dono (2026-11-18): antes de ir para o ZombiAdA, o kit precisa estar pronto, e "pronto" se prova numa cena de jogo que usa **todos os
pacotes do SDK**, não na sala de testes. Esta é a primeira de três cenas; as outras duas estão como carta em [`cartas.md`](cartas.md).

## 1. Decisões do dono (2026-11-18)

- **Gênero:** sobrevivência numa cidade pequena (saquear, barricar, horda enorme e variada), em 3D. Mecânicas do gênero sim; recriar um jogo
  existente (cidade, personagens, visual próprio) não. A identidade é a do ZombiAdA: cidade brasileira, laje, viela, rio.
- **Visual:** semirrealista nublado, pela imagem de referência do dono (`referencias/visual-alvo.png`): céu encoberto, luz difusa, corpos
  assentados no chão, cor fria e dessaturada, neblina na distância, horda em que ninguém se repete. Vira **preset** do kit (`look`), não regra.
- **Câmera:** terceira pessoa de ombro, como a imagem, e primeira pessoa.
- **A sala valida, a cena compõe** (D6) e **a cena é o exemplo de como um jogo usa o kit** (D7), no `plan.md`.

## 2. O recorte

Uns 400 × 250 m na divisa entre um centro e um bairro popular, cortada por um rio com uma ponte. O kit não conhece nomes de lugar (§2): aqui
são os tipos de bairro do `game-urban` (`downtown` e `working_class`); "Santa Aurora", "Centro" e "Vila Esperança" ficam no repositório do jogo.

| Faixa | O que tem |
|---|---|
| Borda do centro | Um quarteirão de sobrados com loja no térreo, um prédio de 6 a 8 andares, farmácia, mercado, delegacia, igreja; barricada policial abandonada com viatura e ambulância; rua com postes, semáforo, faixa e meio-fio; carros parados, um dirigível. **O cruzamento desta faixa é o palco do cenário `caos`** (§4.2) |
| Rio e ponte | Ponte de concreto destrutível, rio com correnteza, mata de margem, peixe e garça, uma margem de solo solto (cratera) |
| Bairro popular | Casas geminadas de laje (1 a 3 lajes, uma inacabada com vergalhão), um barraco, viela com escadaria externa, caixa-d'água, varal, bar; quintal com horta, galinheiro, galinha e cachorro |
| Mundo | 500 a 2.000 zumbis (corredor perto do centro, lento na vila), sobreviventes e policiais fardados, infecção por mordida, bilhetes com histórias nas casas, chuva e neblina, dia e noite, armas e explosivos, áudio por material e distância |

**A primeira entrega é o recorte inteiro (N1, dono, 2026-11-24)**, com um marcador `missing` desenhado como caixa de aviso no lugar de cada
uma das 14 peças que faltam (`plan.md`, "Falta"). A rua do bairro popular da §3 continua sendo o trecho onde o roteiro `tipico`/`pior` anda,
porque é a parte do recorte que não depende de peça nova. O cruzamento da borda do centro roda o `caos` com caixas de aviso nos prédios até
a T3.1 e a T3.2 ficarem prontas: o clima do `caos` só aparece de verdade depois da Fase 3.

## 3. O que a cena contém só com o que o SDK já tem

Dono de cada peça pelo `kit_owner` (MCP `game-kit`, `tools/kit-audit/rules.json`), conferido em 2026-11-24. O `rules.json` hoje conhece
`vehicles`, `structure` (com `game-urban` e `game-urban-three` entre os donos: rua, calçada), `furniture`, `people` (zumbi incluído), `plants`,
`items`, `weapons` e `physics`; poste, semáforo e fiação ainda não são palavras de nenhum domínio, e acrescentá-las é a T0.3.

| Peça | Pacote dono | Como se constrói hoje | Estado |
|---|---|---|---|
| Chão único (rua, calçada, grama, terra sob a casa) | `game-terrain`, `game-terrain-three` | `createTerrain({ bounds, layout: { surface, zones } })`, `createTerrainRenderer` | Pronto. As zonas do lote saem de `groundLayoutOfPlans` (`game-floorplan-three/src/lot/ground-layout.ts`), que **não é exportado** (L3) |
| Casas (planta, estrutura, desenho) | `game-floorplan`, `-structure`, `-three`, tipologias em `-residential`, `-commercial`, `-rural` | `engine.generate(id, { seed, state })` e `createHouseRenderer(THREE).build(plan, options)` | Pronto. Tipologias da rua do roteiro: N2 |
| Estado da casa (normal, fortificada, abandonada) | `game-floorplan-post-apocalyptic` | opção `state` da planta | Pronto |
| Móveis que funcionam, instalações | `game-interactables`, `-household`, `-three`, `game-floorplan-interactables` | opção `interactives` do `build` | Pronto |
| Achados nos móveis | `game-items`, `game-items-goods`, `game-items-three` | `createGoodsFindsProvider` registrado no motor da planta | Pronto, só dentro de recipiente. Item solto no chão não existe (L12) |
| Rua, calçada, postes, fiação | `game-urban`, `game-urban-three` | `createUrban`, padrão de bairro `working_class`, `createUrbanThree` | Pronto para desenhar. As peças não têm colisão nem destruição (L10) e o bairro só põe silhueta de casa, não a casa desenhada (L2) |
| Veículos estacionados | `game-vehicles`, `-fleet`, `-three` | `createVehicleKit`, `installFleet`, `createVehiclesThree(THREE, { kit }).build(key)`; lista `PARKED_VEHICLE_IDS` do `game-kit-defaults` | Pronto |
| Veículo dirigível | `game-vehicles-driving` | `createArcadeDriver` ou `createSemiSimDriver`, `createVehicleControls` | Regra pronta; quem liga ao jogador só existe no banco de provas (L7) |
| Vegetação do quintal e da calçada | `game-vegetation`, `-species`, `-three` | opção `vegetation` do `build`; `scatterRulesFor(region, context)` | Pronto |
| Clima nublado, neblina, chuva | `game-weather`, `game-weather-three` | `createWeather({ start: 'overcast' })`, `createWeatherRenderer` | Pronto. O preset de **visual** nublado é outra coisa e não existe (Fase 4) |
| Horda | `game-crowd`, `game-crowd-three`, `game-characters-undead`, `game-infection` | `createCrowd`, `undeadCrowdPack`, `createNavGrid`, `createCrowdRenderer`, `bindInfection`; `crowd.blast` e `crowd.damage` existem | Regra e desenho prontos; faltam ligações (L4, L5, L8, L15) |
| Jogador (estado, fôlego, feridas) | `game-player` | `createPlayer` | Pronto, sem corpo no mundo: o andar com colisão só existe na sala (L1) |
| Corpo do jogador | `game-characters`, `game-characters-three` | `createPlayerAvatar`, `createFirstPersonArms` | Pronto; a ligação com o estado é feita à mão num exemplo |
| Câmera | `game-camera` | `create` com modos `shoulder`, `third`, `first`; `createVehicleCamera` | Pronto, mas a sala não usa: tem câmera própria (spec 002, T3.1 aberta) |
| Armas e explosivos | `game-weapons`, `game-weapons-three` | `createArsenal`, `WeaponState.trigger`, `throwableUse`, `createExplosiveBody` | Regra pronta; o tiro que acerta o mundo e a granada só existem na sala (L1) |
| Destruição, efeitos | `game-destruction`, `-three`, `game-vfx`, `-three` | `createDestruction`, `createDestructionRenderer`, `createVfx` (`fire`) | Pronto |
| Som | `game-audio` | `createAudioEngine`, `createAudioSink`, `createOcclusionTracker`; receita `siren` na biblioteca | Pronto; a oclusão pelo mundo está na sala (L1) |
| Quadro, física, workers | `game-runtime`, `game-physics`, `game-physics-jolt`, `game-workers` | `createScheduler`, `startLoop`, `createPhysicsLoop`, `createKitWorkers` | Peças prontas; não existe anfitrião fora da sala (L1) |

### 3.1 Peças do cenário `caos` (§4.2)

| Peça | Pacote dono | Existe hoje? |
|---|---|---|
| Barricada policial (cavalete, sacos) | `game-props3d` (`barricade`, `sandbags`) | Sim. Cone, cavalete e fita zebrada: T3.9 |
| Viatura, ambulância | `game-vehicles-fleet` (`police_sedan`, `ambulance`) | Sim |
| Blindado da frota que cruza | `game-vehicles-fleet` (`armored_truck`), dirigido por `game-vehicles-driving` | Modelo sim; dirigido por roteiro fora do banco de provas não (L7) |
| Policiais e sobreviventes fardados | `game-characters-uniformed` (`military_police`, `civil_police`, `riot_police`), `game-characters-three` | Corpo sim; **NPC que mira e atira não existe** (L16) |
| Horda que rompe pela rua | `game-crowd`, `game-crowd-three`, `game-characters-undead` | Sim; romper a barricada (a barricada como obstáculo e alvo da horda) não (L17) |
| Fogo em linha sobre a horda | `game-vfx` (`fire`), `game-destruction`/`game-terrain` (fogo no chão), `game-weapons` (`molotov`) | Fogo sim; **fogo que fere agente da horda não** (L15) |
| Explosões | `game-weapons` (`m67`, `c4`), `game-vfx`, `game-destruction`; `crowd.blast` | Sim; a explosão do mundo chegar ao `crowd.blast` é ligação da sala hoje (L1) |
| Fumaça, luz do fogo | `game-vfx`, `game-render-three` (`LightBudget`) | Sim |
| Sirene | `game-audio` (receita `siren`) | Sim |
| Semáforo, faixa, meio-fio | `game-urban` | Não (T3.9) |
| Prédios de 4 a 8 andares, sobrado misto | `game-floorplan-residential`, `-commercial` | Não (T3.1, T3.2): caixa de aviso até lá |

## 4. Os roteiros

Determinísticos (semente, horários, passo fixo). Cada fase tem um id, que é o nome da fase na régua.

### 4.1 Roteiro da rua (2 min 30 s), cenários `tipico` e `pior`

| Fase | Tempo | Câmera | O que acontece | O que exercita |
|---|---|---|---|---|
| `load` | antes do 0 | — | A página abre até o primeiro quadro com tudo aquecido | tempo de carga, programas compilados, memória de partida |
| `walk` | 0–25 s | 3ª, ombro | Anda 60 m pela rua, zumbis esparsos ao longe | desenho da rua inteira, LOD das casas, clima |
| `enter` | 25–45 s | 3ª → 1ª | Abre o portão e a porta, entra, cruza dois cômodos, abre um armário com achados | porta, colisão com a casa, interior com móveis, itens |
| `shoot` | 45–65 s | 1ª | Da janela: 15 tiros de pistola e uma rajada de fuzil em zumbis, no vidro e no muro | tiro, destruição, marcas, som com oclusão |
| `grenade` | 65–80 s | 3ª | Sai e joga uma M67 junto ao muro e a um carro parado | o quadro da explosão (caso de referência da spec 018) |
| `horde` | 80–120 s | 3ª | A horda converge pela rua; o jogador recua atirando | multidão, navegação em volta das casas, dano no jogador |
| `drive` | 120–150 s | veículo | Entra no carro e dirige 150 m atropelando | direção, câmera de veículo, atropelamento, streaming do que entra na vista |

Enquanto a ação do jogador não sai da sala, o cenário chama o SDK direto em `src/test/` (N5); a fase `drive` troca de controle sem animação
até a spec 016 ter o embarque com corpo (N6).

### 4.2 Roteiro do cruzamento (30 a 40 s), cenário `caos` (dono, 2026-11-24)

No cruzamento da borda do centro, tudo ao mesmo tempo, em pouco tempo. Câmera de terceira pessoa no ombro e primeira pessoa; **nunca vista de
cima**. Determinístico: semente, horário de cada evento em segundos de simulação, passo fixo.

| Fase | Tempo | Câmera | O que acontece | O que exercita |
|---|---|---|---|---|
| `caos_calm` | 0–6 s | 3ª, ombro | Silêncio antes da ruptura: barricada policial com viatura e ambulância de luzes ligadas, policiais e sobreviventes fardados atrás dela, fumaça parada, sirene ao longe | desenho do cruzamento, luzes, som de fundo |
| `caos_breach` | 6–14 s | 3ª | A horda enche a rua entre os prédios e rompe a barricada; a barricada cede | multidão densa, horda contra obstáculo, destruição da barricada |
| `caos_fire` | 14–22 s | 1ª | Linha de fogo no chão sobre a frente da horda; policiais atiram; o jogador atira junto | fogo no chão, fogo que fere a horda, tiro na horda, luz vinda do fogo |
| `caos_blast` | 22–30 s | 3ª | Duas explosões na horda (M67 e C4) junto à viatura | o quadro da explosão com horda e veículos, `crowd.blast` |
| `caos_armor` | 30–40 s | 3ª | Um blindado da frota cruza o cruzamento atropelando; sirene passando | veículo dirigido por roteiro, atropelamento, som em movimento |

**Referência de clima, não de conteúdo.** O dono citou os filmes de terror de zumbi, o filme novo de Resident Evil e um vídeo (horda enchendo
a rua, linha de fogo, blindados no cruzamento). Valem o ritmo, a escala e o clima: silêncio antes da ruptura, horda como massa em que ninguém se
repete, luz vinda do fogo, fumaça e sirene. **Não se recria** cena, personagem, criatura, lugar, logotipo, música nem visual de nenhum filme
ou jogo. A identidade é brasileira e o kit não conhece nome de lugar (§2).

## 5. Cenários (`?cena=`)

| Cenário | Roteiro | O que mede |
|---|---|---|
| `tipico` | rua (§4.1) | 500 zumbis, de dia, nublado: o quadro que o jogo tem quase sempre |
| `pior` | rua (§4.1) | 2.000 zumbis, chuva à noite: a meta de "nenhum travamento" |
| `caos` | cruzamento (§4.2) | tudo junto em 30 a 40 s: horda densa contra barricada, fogo, tiro, duas explosões e um veículo |

`tipico` e `pior` rodam o mesmo roteiro, mudando só horda, clima e hora (N3). A C4 na ponte e a granada na delegacia no mesmo segundo
(o `pior` de 2026-11-18) ficam para quando ponte e delegacia existirem.

## 6. A régua da cena

Nenhuma ferramenta de medição do repositório mede uma página que não seja a sala. O `perf.mjs`, o `room-explosion.mjs`, o `leak.mjs`, o
`cost.mjs` e o `scene.mjs` abrem `examples/test-room/dist/test-room.html` e leem `window.__testRoom`; o `perf-gate` só conhece os alvos
escritos à mão. A T2.5 não é mecânica.

| Métrica | De onde sai | Existe hoje? |
|---|---|---|
| Quadro mediano, p95, p99 e pior quadro, por fase | intervalo entre quadros na página, como o `read` do `perf.mjs` | só para a sala |
| Quadros acima de 33,4 ms e tarefa longa | idem (`hitches`, `worstLongTask`) | só para a sala |
| Quadro dividido por módulo | `FRAME_LABELS` e a sonda do agendador (`ROOM_EXPLOSION_FRAME_PARTS=1`) | só para a sala |
| Quadros segurados e o quadro da volta | `held` no `frameSeries` e a janela do `afterMs` (spec 018, #444) | só para a sala |
| Chamadas de desenho por quadro | `drawsPerFrame` do `perf.mjs` | só para a sala |
| Triângulos por quadro | `FRAME_EXTRAS` do `room-explosion.mjs` | só na régua da explosão |
| Programas compilados depois da carga | `programs`, `firstUses` | só para a sala |
| Memória que fica entre duas voltas do roteiro | contagem de buffers, texturas, programas e heap do `leak.mjs` | só para a sala |
| Custo de desenho de cada peça | `tools/shapes-bench/dist/cli.js --cost-check`, no CI (PR #451) | sim, por peça, sem página |
| **Memória absoluta** (heap JS, heap do wasm, texturas e geometrias vivas) por fase | — | **não existe em nenhuma ferramenta** |
| Tempo de carga até o primeiro quadro | — | **não existe** |

**Ferramenta:** uma sonda própria da cena, `examples/reference-district/perf.mjs`, que dirige os roteiros e grava um JSON no formato do
`perf.mjs` (`phases[]` com as mesmas chaves), para o `tools/gpu/compare.mjs` comparar sem mudança; e um alvo `district` no
`tools/gpu/perf-gate.mjs`. As partes puras são reaproveitadas (`compare.mjs`, `room-explosion-frame.mjs`, `page-stamp.mjs`); o que lê
`__testRoom` não. A cena expõe o gancho de medição em `src/test/` (D7), nunca em `src/game/`. Regras da §9 e da §15: fora do CI e do
pre-push, com `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, carga abaixo de 4, GPU de verdade, páginas conferidas por
`pageSha256`.

**A régua da explosão hoje.** O `perf-gate room-explosion` da rodada diária (`tools/gpu/nightly-gpu.mjs`) só roda a C4
(`ROOM_EXPLOSION_EXPLOSIVE: 'c4'`); a **M67 não tem portão**: os números dela abaixo vêm de medições à mão da spec 018. A fase `grenade` e o
`caos_blast` são o primeiro portão da M67 fora da sala.

**Orçamento por fase.** Duas colunas, porque a meta do dono e o que o kit entrega hoje ainda estão longe em algumas fases:

- **Meta** é a D12 da spec 005 (`specs/005-camadas-e-quadro/plan.md`): na dedicada, p99 ≤ 20 ms e nenhum quadro acima de 33,4 ms com 2.000
  zumbis; na integrada, 60 quadros por segundo na jogada normal e nenhum quadro acima de 33,4 ms com 1.000. "60 é a meta; 30 é o piso."
- **Piso de não regressão** é o que a primeira régua da cena medir (T2.6), e é o que o portão bloqueia.

| Fase | Meta (dedicada) | O que se sabe hoje, medido na sala (helios, RTX 5070 Laptop, 1x) |
|---|---|---|
| `load` | teto = primeira medição + 10% (N4) | nunca medido |
| `walk` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | sala parada: p99 17,6–17,8, pior 17,7–18,1, 127–143 desenhos. A cena tem dez casas, não uma |
| `enter` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | nunca medido |
| `shoot` | p99 ≤ 20 ms, 0 quadros > 33,4 | nunca medido isolado |
| `grenade` | 0 quadros > 33,4 | **alcançável desde a spec 018** (PRs #443 a #448): com a explosão espalhada em quadros (marca-passo), o quadro da M67 caiu de ~101–120 ms para **~20 ms** (f0, mediana 21,1) e o quadro da volta do mundo para **~18 ms** (mediana 18,1, máx. 28,9). Vale só com marca-passo, Jolt, D4 e chão no worker ligados (L18) |
| `horde` | p99 ≤ 20 ms, 0 quadros > 33,4 | `dense_horde`, 2.000 pedidos: p99 17,7, pior 34,1; com explosões (`chain_horde`): p99 28,0, pior 119 (medido antes da 018) |
| `drive` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | nunca medido; não há número de quadro com frota |
| `caos_*` | p99 ≤ 20 ms, 0 quadros > 33,4 | nunca medido; o mais perto é o `chain_horde` acima |

Chamadas de desenho, triângulos, memória e tempo de carga não têm meta escrita pelo dono: o teto é a primeira medição mais 10%, com o dono
aprovando a tabela medida (N4). O que existe: limite de desenhos por peça em `tools/kit-audit/budgets.json` (veículo 60, personagem 60, casa
20 por peça marcada), o custo gravado de cada peça no `tools/shapes-bench` (`--cost-check`) e o resíduo por ciclo do `leak.mjs` (buffers 150,
texturas 2, programas 2, heap 2 MB).

## 7. Critérios de aceite

R1 a R9 são de 2026-11-18. R10 a R14 entraram em 2026-11-21; R15 em 2026-11-24.

| # | Critério | Como se prova |
|---|---|---|
| R1 | Um jogo monta um mundo inteiro por uma API pública do SDK, sem copiar a sala | `createKitWorld` no `game-kit-defaults`; a cena não importa `game-test-room`, `test-area` nem `bench` (regra de camada nova no `check:layers`) |
| R2 | A cena usa todo pacote do SDK, exceto `game-test-room` e `game-vehicles-proving`, na densidade que o lugar teria | teste sem GPU no CI: a lista de pacotes instanciados na montagem é igual à lista de `packages/` menos as duas exceções |
| R3 | Toda peça vem do pacote dono do SDK; nada desenhado à mão na cena (§1) | `kit_audit` na página da cena sem peça de origem `scene` ou desconhecida; os `missing` aparecem como pendência com o dono |
| R4 | Os três cenários abrem e rodam pelo `pnpm check:district`, com prints em 3ª e 1ª pessoa | `examples/reference-district/shots/` |
| R5 | A cena é a segunda régua do kit: tabela por módulo nos três cenários, gravada | `evidence.md` com o JSON em `medicoes/` |
| R6 | Visual perto da referência no mesmo enquadramento (rua, horda vindo de frente, câmera no ombro) | print `shots/visual-alvo.png` ao lado de `referencias/visual-alvo.png`; veredito visual registrado por fase |
| R7 | Sem travamento: no `pior` e no `caos`, 0 quadros acima de 33,4 ms na RTX e na Intel integrada (com o tuner ligado); uma rodada em AMD antes de fechar | `evidence.md` com o JSON. Na fase `grenade`, alcançável desde a spec 018 (§6) |
| R8 | Peças novas passam pelas regras do pacote dono: 21 critérios de física (§6), z-fighting (§13), estrutura (§11) para ponte e prédio, objetos quebrados (§12), memória (§8), custo de desenho (`--cost-check`) | testes do pacote dono e os agentes `engenheiro-estrutural` e `revisor-z-fighting` |
| R9 | A cena é o exemplo de como um jogo usa o kit: `src/game/` só com escolhas de jogo e um README que leva do zero a um mundo rodando | regra de camada: `src/game/` não importa `src/test/`; `wc -l` ≤ 200 por arquivo e ≤ 1.500 no total; README seguido do zero por um agente sem contexto |
| R10 | Os roteiros da §4 rodam inteiros, sem intervenção, nos três cenários, e dão o mesmo hash de estado em duas rodadas; a independência da taxa de quadros (60, 120 e 144 Hz) é do agendador, não da cena | `node examples/reference-district/determinism.mjs` (duas rodadas por cenário, hash por fase igual); o corredor do roteiro anda em tiques fixos e não desenha, por isso a taxa de 60/120/144 Hz fica provada pelos testes de mesmo passo do `game-runtime` (C5 da spec 010), não pela cena |
| R11 | Cada fase dos roteiros tem a tabela gravada: p50, p99, pior quadro, quadros > 33,4 ms, desenhos e triângulos por quadro, divisão por módulo do pior quadro | `medicoes/regua-<commit>.json` e a tabela no `evidence.md`, a 1x e a 4x |
| R12 | O portão bloqueia regressão por fase contra a `main` medida na mesma máquina | `node tools/gpu/perf-gate.mjs district`; tolerâncias do `compare.mjs` |
| R13 | Memória: duas voltas seguidas do roteiro não deixam resíduo acima do orçamento do `leak.mjs`; a memória absoluta por fase está gravada e abaixo do teto da N4 | sonda da cena com as contagens do `leak.mjs` e a medição absoluta nova |
| R14 | Nenhuma peça da cena passa do limite de desenhos do dono | `cost.mjs` apontado para a página da cena, com `tools/kit-audit/budgets.json` |
| R15 | O `caos` é legível em 3ª e 1ª pessoa e nunca usa vista de cima; nada nele recria cena, personagem, criatura, lugar, logotipo, música ou visual de filme ou jogo | prints por fase e câmera; revisão independente do roteiro e dos prints contra a §4.2 |

## 8. O que falta no SDK para a cena existir

Levantado por leitura da `origin/main` em 2026-11-21 e conferido em 2026-11-24. O dono provável é confirmado com `kit_owner` na task de cada uma.

| # | Lacuna | Onde está hoje | Fases que travam |
|---|---|---|---|
| L1 | **Não existe anfitrião de mundo fora da sala.** Agendador, filas, física, destruição, som com oclusão, andar com colisão, tiro que acerta o mundo e granada estão no `room.ts` (5.615 linhas em 2026-11-24) e em arquivos irmãos que a sala não exporta (`player.ts`, `explosives.ts`, `door-open.ts`, `world-occlusion.ts`, `blast-pacing.ts`) | `packages/game-test-room/src/` | todas |
| L2 | Nenhum `HouseProvider` desenha a casa de verdade: o bairro do `game-urban` só põe as 8 silhuetas de longe | `game-urban/src/neighbourhoods/houses.ts` | `walk`, `enter` |
| L3 | `groundLayoutOfPlans` (zonas do lote no terreno) não é exportado; só a área de teste usa | `game-floorplan-three/src/lot/ground-layout.ts` | `walk` |
| L4 | **Tiro não acerta zumbi.** Não há teste de raio contra agente da horda; o evento de tiro não leva origem nem direção | `game-crowd`, `game-contracts/src/module.ts` | `shoot`, `horde`, `caos_fire` |
| L5 | Não há ponte da casa para a grade de navegação da horda (`NavGrid.fillRect` só é chamado pelas cenas do banco) | `game-crowd-three/src/bench/scenes.ts` | `horde`, `caos_breach` |
| L6 | Jogador e casa: entrar, bloquear nas paredes e abrir porta com a mão só estão ligados na área de teste | `game-floorplan-three/src/test-area/module.ts` | `enter` |
| L7 | Dirigir com o jogador e veículo dirigido por roteiro só existem no banco de provas. Entrar e sair do carro com corpo é a spec 016, **que já está na `main`** (`specs/016-veiculos-animacao-e-ocupantes/`, com as 012 a 015) e ainda não implementada | `game-vehicles-three/src/test-area/proving/` | `drive`, `caos_armor` |
| L8 | Ninguém consome o evento `run_over` da direção: atropelar não fere a horda | `game-vehicles-driving/src/types.ts` | `drive`, `caos_armor` |
| L9 | Não existe pacote de entrada (teclado e mouse estão espalhados pela sala; controle não existe) | — | todas, quando a entrada for de jogador (N5) |
| L10 | Rua, poste e prédio do `game-urban` não têm colisão nem destruição | `game-urban-three` | `drive`, `grenade` |
| L11 | A régua não mede outra página; memória absoluta e tempo de carga não são medidos por nada (§6); a M67 não tem portão | `tools/gpu/`, `examples/test-room/` | medição |
| L12 | Item solto no chão ou gerado por cômodo não existe; só achado dentro de recipiente | `game-items/src/finds/` | — (o roteiro usa o armário) |
| L13 | `kit_owner` não conhece poste, semáforo nem fiação (o `game-urban` já é dono no domínio `structure`, pela rua e calçada); zumbi e item já entram (`people`, `items`) | `tools/kit-audit/rules.json` | — |
| L14 | As 14 peças do recorte inteiro (ponte, rio, prédio de 4 a 8 andares, sobrado misto, viela, bar, semáforo e outras) | `plan.md`, "Falta" | nenhuma: caixa de aviso até a Fase 3 |
| L15 | Fogo que fere a horda: o fogo do `game-vfx` e o do chão (`game-terrain`) não chegam ao `crowd.damage` | `game-crowd`, `game-vfx`, `game-terrain` | `caos_fire` |
| L16 | NPC que mira e atira (policial, sobrevivente) não existe; o fardado só tem corpo | `game-characters`, `game-weapons` | `caos_fire` |
| L17 | A horda contra a barricada: a barricada do `game-props3d` não é obstáculo na grade da horda nem alvo que a horda derruba | `game-crowd`, `game-props3d` | `caos_breach` |
| L18 | O ganho da spec 018 foi medido na variante `jolt-d4-worker` da sala: marca-passo (`blastPacing`) e chão no worker (`groundWorker`) ligados por padrão na página (`examples/test-room/src/main.js`, desligam com `=0`), Jolt (`?solver=jolt`, montado em `build.mjs`) e política D4 dos destroços (`?blastDebris=1`) só por parâmetro. Tudo isso é a página da sala, não o SDK, que não tem padrão. O `createKitWorld` precisa ligar os quatro por padrão | `examples/test-room/`, `game-test-room/src/blast-pacing.ts` | `grenade`, `caos_blast` |

A L1 é a maior e já tem desenho aprovado (`design-host.md`, `createKitWorld`, Fases 1 e 1b). L15 a L17 vêm do `caos` e são ligações entre
pacotes que já existem, não peças novas: cada uma ganha task na Fase 2 quando o `caos` for roteirizado (T2.4).

## 9. Decisões

Decididas pelo dono em **2026-11-24**. N2 a N6 e N8 a N10 seguem a recomendação escrita na revisão de 2026-11-21.

| # | Pergunta | Decisão (2026-11-24) |
|---|---|---|
| N1 | Qual é a primeira entrega jogável | **O recorte inteiro** (400 × 250 m: centro, rio, ponte, bairro popular), com marcador `missing` desenhado como caixa de aviso em cada uma das 14 peças que faltam. Não é a fatia de uma rua |
| N2 | Tipologias e quantidade de casas da rua do roteiro | 10 lotes: 6 `budget_slab_house`, 2 `budget_semi_detached`, 1 `townhouse`, 1 `pharmacy`, estados sorteados 35/45/20. A casa em que se entra é uma `budget_slab_house` normal |
| N3 | `tipico` e `pior` no mesmo roteiro | Sim. A C4 na ponte fica para quando ponte e delegacia existirem |
| N4 | Orçamentos que ninguém escreveu (carga, desenhos, triângulos, memória absoluta) | Fixar depois da primeira régua (T2.6): teto = medido + 10%, com o dono aprovando a tabela medida |
| N5 | Como o roteiro é dirigido enquanto a ação do jogador está na sala | O cenário chama o SDK direto (`world.shoot`, `throwableUse`) em `src/test/` e troca para entrada sintética quando a 1b fechar; o `evidence.md` diz que a cola do jogador não está medida |
| N6 | A fase `drive` sem a spec 016 | Trocar de controle sem animação, como o banco de provas faz, e marcar pendência |
| N7 | Ordem com as outras frentes | **Começar tudo agora, Fase 1 incluída.** Não esperar outra frente. Risco aceito: a rodada diária está vermelha desde 2026-11-20 e a Fase 1 tira 3.000 a 4.000 linhas da sala; por isso o estado da sala é gravado antes (passo 0, `evidence.md`) e toda falha nova é comparada com a `origin/main` do dia |
| N8 | Os três commits de 2026-11-18 que não chegaram à `main` | Rebasear e abrir um PR por commit, nesta ordem: `check:layers`, oclusão, registro de objetos |
| N9 | Medição em AMD | O dono indica uma máquina com Radeon ou se pede a um jogador uma rodada do `pnpm check:district` |
| N10 | Casas enteráveis ao mesmo tempo | Só as próximas, pelo LOD de casa (`planLod`) |
| N11 | Cenário de caos | **Novo cenário `caos`** (§4.2, §5) no cruzamento da borda do centro do recorte 1, 30 a 40 s, determinístico, com fases nomeadas para a régua, câmera de ombro e primeira pessoa, nunca de cima. Referência de clima, não de conteúdo |

## 10. Fora do escopo

- **Personagens com roupa texturizada** (atlas de roupa, sujeira e sangue). É arte, o item mais caro do visual; spec própria depois desta.
- O jogo ZombiAdA e os nomes de lugar.
- As cenas 2 (centro inteiro) e 3 (bairro popular inteiro): só a carta. O `caos` fica no cruzamento do recorte 1 para não abrir a cena 2
  antes de a primeira fechar.
- Baixar o custo do quadro da explosão: é a spec 018. Esta spec mede e registra.
