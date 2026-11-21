# Spec 011 — Cena de referência: o kit monta um mundo de jogo só pela API pública

> Estado: **rascunho revisado em 2026-11-21, com decisões abertas (§9).** A primeira versão é de 2026-11-18 e ficou só num worktree local
> (`spec/011-cena-de-referencia`, nunca enviada ao remoto). Esta revisão mantém as decisões do dono daquele dia, confere tudo contra a
> `origin/main` de 2026-11-21 e acrescenta o que faltava: o conteúdo da cena com o pacote dono de cada peça (§3), o roteiro (§4), a régua
> (§6) e as lacunas (§8). Nada aqui foi implementado nesta revisão.

Pedido do dono (2026-11-18): antes de ir para o ZombiAdA, o kit precisa estar pronto, e "pronto" se prova numa cena de jogo que usa **todos os
pacotes do SDK**, não na sala de testes. Esta é a primeira de três cenas; as outras duas estão como carta em [`cartas.md`](cartas.md).

## 1. Decisões do dono (2026-11-18)

- **Gênero:** sobrevivência numa cidade pequena (saquear, barricar, horda enorme e variada), em 3D. Mecânicas do gênero sim; recriar um jogo
  existente (cidade, personagens, visual próprio) não. A identidade é a do ZombiAdA: cidade brasileira, laje, viela, rio.
- **Visual:** semirrealista nublado, pela imagem de referência do dono (`referencias/visual-alvo.png`): céu encoberto, luz difusa, corpos
  assentados no chão, cor fria e dessaturada, neblina na distância, horda em que ninguém se repete. Vira **preset** do kit (`look`), não regra.
- **Câmera:** terceira pessoa de ombro, como a imagem, e primeira pessoa.
- **Ordem:** intercalada com a spec 010 (ver `plan.md`; a ordem combinada não foi seguida e está como decisão aberta N7).
- **A sala valida, a cena compõe** (D6) e **a cena é o exemplo de como um jogo usa o kit** (D7), no `plan.md`.

## 2. O recorte

Uns 400 × 250 m na divisa entre um centro e um bairro popular, cortada por um rio com uma ponte. O kit não conhece nomes de lugar (§2): aqui
são os tipos de bairro do `game-urban` (`downtown` e `working_class`); "Santa Aurora", "Centro" e "Vila Esperança" ficam no repositório do jogo.

| Faixa | O que tem |
|---|---|
| Borda do centro | Um quarteirão de sobrados com loja no térreo, um prédio de 6 a 8 andares, farmácia, mercado, delegacia, igreja; barricada policial abandonada com viatura e ambulância; rua com postes, semáforo, faixa e meio-fio; carros parados, um dirigível |
| Rio e ponte | Ponte de concreto destrutível, rio com correnteza, mata de margem, peixe e garça, uma margem de solo solto (cratera) |
| Bairro popular | Casas geminadas de laje (1 a 3 lajes, uma inacabada com vergalhão), um barraco, viela com escadaria externa, caixa-d'água, varal, bar; quintal com horta, galinheiro, galinha e cachorro |
| Mundo | 500 a 2.000 zumbis (corredor perto do centro, lento na vila), sobreviventes e policiais fardados, infecção por mordida, bilhetes com histórias nas casas, chuva e neblina, dia e noite, armas e explosivos, áudio por material e distância |

## 3. A fatia do roteiro: o que a cena contém só com o que o SDK já tem

O recorte inteiro precisa de 14 peças novas (`plan.md`). O roteiro (§4) roda numa **fatia** dele que não precisa de nenhuma: uma rua do
bairro popular, de uns 120 m, com lotes dos dois lados. Se a fatia é a primeira entrega ou não é a decisão N1.

Dono de cada peça pelo `kit_owner` (MCP `game-kit`), conferido em 2026-11-21. Para zumbi, item e poste o `kit_owner` não devolve dono
(`tools/kit-audit/rules.json` não tem o domínio): o dono abaixo vem do mapa do SDK no `CLAUDE.md`, e completar o `rules.json` é a task T0.3.

| Peça | Pacote dono | Como se constrói hoje | Estado |
|---|---|---|---|
| Chão único (rua, calçada, grama, terra sob a casa) | `game-terrain`, `game-terrain-three` | `createTerrain({ bounds, layout: { surface, zones } })`, `createTerrainRenderer` | Pronto. As zonas do lote saem de `groundLayoutOfPlans` (`game-floorplan-three/src/lot/ground-layout.ts`), que **não é exportado** (L3) |
| Casas (planta, estrutura, desenho) | `game-floorplan`, `-structure`, `-three`, tipologias em `-residential`, `-commercial`, `-rural` | `engine.generate(id, { seed, state })` e `createHouseRenderer(THREE).build(plan, options)` | Pronto. Tipologias da fatia: N2 |
| Estado da casa (normal, fortificada, abandonada) | `game-floorplan-post-apocalyptic` | opção `state` da planta | Pronto |
| Móveis que funcionam, instalações | `game-interactables`, `-household`, `-three`, `game-floorplan-interactables` | opção `interactives` do `build` | Pronto |
| Achados nos móveis | `game-items`, `game-items-goods`, `game-items-three` | `createGoodsFindsProvider` registrado no motor da planta | Pronto, só dentro de recipiente. Item solto no chão não existe (L12) |
| Rua, calçada, postes, fiação | `game-urban`, `game-urban-three` | `createUrban`, padrão de bairro `working_class`, `createUrbanThree` | Pronto para desenhar. As peças não têm colisão nem destruição (L10) e o bairro só põe silhueta de casa, não a casa desenhada (L2) |
| Veículos estacionados | `game-vehicles`, `-fleet`, `-three` | `createVehicleKit`, `installFleet`, `createVehiclesThree(THREE, { kit }).build(key)`; lista `PARKED_VEHICLE_IDS` do `game-kit-defaults` | Pronto |
| Veículo dirigível | `game-vehicles-driving` | `createArcadeDriver` ou `createSemiSimDriver`, `createVehicleControls` | Regra pronta; quem liga ao jogador só existe no banco de provas (L7) |
| Vegetação do quintal e da calçada | `game-vegetation`, `-species`, `-three` | opção `vegetation` do `build`; `scatterRulesFor(region, context)` | Pronto |
| Clima nublado, neblina, chuva | `game-weather`, `game-weather-three` | `createWeather({ start: 'overcast' })`, `createWeatherRenderer` | Pronto. O preset de **visual** nublado é outra coisa e não existe (Fase 4) |
| Horda | `game-crowd`, `game-crowd-three`, `game-characters-undead`, `game-infection` | `createCrowd`, `undeadCrowdPack`, `createNavGrid`, `createCrowdRenderer`, `bindInfection` | Regra e desenho prontos; faltam três ligações (L4, L5, L8) |
| Jogador (estado, fôlego, feridas) | `game-player` | `createPlayer` | Pronto, sem corpo no mundo: o andar com colisão só existe na sala (L1) |
| Corpo do jogador | `game-characters`, `game-characters-three` | `createPlayerAvatar`, `createFirstPersonArms` | Pronto; a ligação com o estado é feita à mão num exemplo |
| Câmera | `game-camera` | `create` com modos `shoulder`, `third`, `first`; `createVehicleCamera` | Pronto, mas a sala não usa: tem câmera própria (spec 002, T3.1 aberta) |
| Armas e explosivos | `game-weapons`, `game-weapons-three` | `createArsenal`, `WeaponState.trigger`, `throwableUse`, `createExplosiveBody` | Regra pronta; o tiro que acerta o mundo e a granada só existem na sala (L1) |
| Destruição, efeitos | `game-destruction`, `-three`, `game-vfx`, `-three` | `createDestruction`, `createDestructionRenderer`, `createVfx` | Pronto |
| Som | `game-audio` | `createAudioEngine`, `createAudioSink`, `createOcclusionTracker` | Pronto; a oclusão pelo mundo está na sala (L1) |
| Quadro, física, workers | `game-runtime`, `game-physics`, `game-physics-jolt`, `game-workers` | `createScheduler`, `startLoop`, `createPhysicsLoop`, `createKitWorkers` | Peças prontas; não existe anfitrião fora da sala (L1) |

## 4. O roteiro (2 min 30 s)

Um percurso só, determinístico (semente, entrada roteirizada, passo fixo), que roda igual nos dois cenários da §5. Cada fase tem um id, que é
o nome da fase na régua.

| Fase | Tempo | Câmera | O que acontece | O que exercita |
|---|---|---|---|---|
| `load` | antes do 0 | — | A página abre até o primeiro quadro com tudo aquecido | tempo de carga, programas compilados, memória de partida |
| `walk` | 0–25 s | 3ª, ombro | Anda 60 m pela rua, zumbis esparsos ao longe | desenho da rua inteira, LOD das casas, clima |
| `enter` | 25–45 s | 3ª → 1ª | Abre o portão e a porta, entra, cruza dois cômodos, abre um armário com achados | porta, colisão com a casa, interior com móveis, itens |
| `shoot` | 45–65 s | 1ª | Da janela: 15 tiros de pistola e uma rajada de fuzil em zumbis, no vidro e no muro | tiro, destruição, marcas, som com oclusão |
| `grenade` | 65–80 s | 3ª | Sai e joga uma M67 junto ao muro e a um carro parado | o quadro da explosão (caso de referência da spec 018) |
| `horde` | 80–120 s | 3ª | A horda converge pela rua; o jogador recua atirando | multidão, navegação em volta das casas, dano no jogador |
| `drive` | 120–150 s | veículo | Entra no carro e dirige 150 m atropelando | direção, câmera de veículo, atropelamento, streaming do que entra na vista |

Quatro destas fases dependem de ligação que hoje não existe fora da sala ou não existe em lugar nenhum (§8). Como o roteiro é dirigido
enquanto elas não existem é a decisão N5; o que fazer com a fase `drive` é a N6.

## 5. Cenários (`?cena=`)

| Cenário | O que mede |
|---|---|
| `tipico` | 500 zumbis, de dia, nublado: o quadro que o jogo tem quase sempre |
| `pior` | 2.000 zumbis, chuva à noite: a meta de "nenhum travamento" |

Mudança proposta nesta revisão (N3): os dois cenários passam a rodar **o mesmo roteiro** da §4, mudando só horda, clima e hora. A definição
de 2026-11-18 do `pior` (uma C4 na ponte e uma granada na delegacia no mesmo segundo) depende da ponte e da delegacia no recorte inteiro e
fica para quando elas existirem.

## 6. A régua da cena

**Fato que muda o plano de 2026-11-18:** nenhuma ferramenta de medição do repositório mede uma página que não seja a sala. O `perf.mjs`, o
`room-explosion.mjs`, o `leak.mjs`, o `cost.mjs` e o `scene.mjs` abrem `examples/test-room/dist/test-room.html` e leem `window.__testRoom`;
o `perf-gate` só conhece dois alvos, escritos à mão. A D5 antiga ("apontar a medição para a página da cena com `PERF_PAGE`") não basta, e a
T2.5 deixou de ser mecânica.

| Métrica | De onde sai | Existe hoje? |
|---|---|---|
| Quadro mediano, p95, p99 e pior quadro, por fase | intervalo entre quadros na página, como o `read` do `perf.mjs` | só para a sala |
| Quadros acima de 33,4 ms e tarefa longa | idem (`hitches`, `worstLongTask`) | só para a sala |
| Quadro dividido por módulo | `FRAME_LABELS` e a sonda do agendador (`ROOM_EXPLOSION_FRAME_PARTS=1`) | só para a sala |
| Chamadas de desenho por quadro | `drawsPerFrame` do `perf.mjs` | só para a sala |
| Triângulos por quadro | `FRAME_EXTRAS` do `room-explosion.mjs` | só na régua da explosão |
| Programas compilados depois da carga | `programs`, `firstUses` | só para a sala |
| Memória que fica entre duas voltas do roteiro | contagem de buffers, texturas, programas e heap do `leak.mjs` | só para a sala |
| **Memória absoluta** (heap JS, heap do wasm, texturas e geometrias vivas) por fase | — | **não existe em nenhuma ferramenta** |
| Tempo de carga até o primeiro quadro | — | **não existe** |

**Ferramenta:** uma sonda própria da cena, `examples/reference-district/perf.mjs`, que dirige o roteiro e grava um JSON no formato do
`perf.mjs` (`phases[]` com as mesmas chaves), para o `tools/gpu/compare.mjs` comparar sem mudança; e um alvo `district` no
`tools/gpu/perf-gate.mjs`. As partes puras são reaproveitadas (`compare.mjs`, `room-explosion-frame.mjs`, `page-stamp.mjs`); o que lê
`__testRoom` não. A cena expõe o gancho de medição em `src/test/` (D7), nunca em `src/game/`. Regras da §9 e da §15: fora do CI e do
pre-push, com `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, carga abaixo de 4, GPU de verdade, páginas conferidas por
`pageSha256`.

**Orçamento por fase.** Duas colunas, porque a meta do dono e o que o kit entrega hoje estão longe em três fases:

- **Meta** é a D12 da spec 005 (`specs/005-camadas-e-quadro/plan.md`): na dedicada, p99 ≤ 20 ms e nenhum quadro acima de 33,4 ms com 2.000
  zumbis; na integrada, 60 quadros por segundo na jogada normal e nenhum quadro acima de 33,4 ms com 1.000. "60 é a meta; 30 é o piso."
- **Piso de não regressão** é o que a primeira régua da cena medir (T2.8), e é o que o portão bloqueia.

| Fase | Meta (dedicada, `tipico`) | O que se sabe hoje, medido na sala (helios, RTX 5070 Laptop, 1x) |
|---|---|---|
| `load` | [NEEDS CLARIFICATION] N4 | nunca medido |
| `walk` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | sala parada: p99 17,6–17,8, pior 17,7–18,1, 127–143 desenhos. A cena tem dez casas, não uma |
| `enter` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | nunca medido |
| `shoot` | p99 ≤ 20 ms, 0 quadros > 33,4 | nunca medido isolado |
| `grenade` | 0 quadros > 33,4 | **não é alcançável hoje:** o quadro da M67 custa ~120 ms (`specs/018-explosao-fora-do-quadro/spec.md` §4.1) |
| `horde` | p99 ≤ 20 ms, 0 quadros > 33,4 | `dense_horde`, 2.000 pedidos: p99 17,7, pior 34,1; com explosões (`chain_horde`): p99 28,0, pior 119 |
| `drive` | p99 ≤ 16,7 ms, 0 quadros > 33,4 | nunca medido; não há número de quadro com frota |

Chamadas de desenho, triângulos e memória não têm meta escrita pelo dono em lugar nenhum. O que existe: limite de desenhos por peça em
`tools/kit-audit/budgets.json` (veículo 60, personagem 60, casa 20 por peça marcada) e o resíduo por ciclo do `leak.mjs` (buffers 150, texturas
2, programas 2, heap 2 MB). Tetos absolutos da cena: N4.

## 7. Critérios de aceite

R1 a R9 são de 2026-11-18. R10 a R14 entram nesta revisão.

| # | Critério | Como se prova |
|---|---|---|
| R1 | Um jogo monta um mundo inteiro por uma API pública do SDK, sem copiar a sala | `createKitWorld` no `game-kit-defaults`; a cena não importa `game-test-room`, `test-area` nem `bench` (regra de camada nova no `check:layers`) |
| R2 | A cena usa todo pacote do SDK, exceto `game-test-room` e `game-vehicles-proving`, na densidade que o lugar teria | teste sem GPU no CI: a lista de pacotes instanciados na montagem é igual à lista de `packages/` menos as duas exceções |
| R3 | Toda peça vem do pacote dono do SDK; nada desenhado à mão na cena (§1) | `kit_audit` na página da cena sem peça de origem `scene` ou desconhecida |
| R4 | Os dois cenários abrem e rodam pelo `pnpm check:district`, com prints em 3ª e 1ª pessoa | `examples/reference-district/shots/` |
| R5 | A cena é a segunda régua do kit: tabela por módulo nos dois cenários, gravada | `evidence.md` com o JSON em `medicoes/` |
| R6 | Visual perto da referência no mesmo enquadramento (rua, horda vindo de frente, câmera no ombro) | print `shots/visual-alvo.png` ao lado de `referencias/visual-alvo.png`; veredito visual registrado por fase |
| R7 | Sem travamento: no `pior`, 0 quadros acima de 33,4 ms na RTX e na Intel integrada (com o tuner ligado); uma rodada em AMD antes de fechar | `evidence.md` com o JSON. **Não alcançável hoje na fase `grenade`** (§6); depende da spec 018 |
| R8 | Peças novas passam pelas regras do pacote dono: 21 critérios de física (§6), z-fighting (§13), estrutura (§11) para ponte e prédio, objetos quebrados (§12), memória (§8) | testes do pacote dono e os agentes `engenheiro-estrutural` e `revisor-z-fighting` |
| R9 | A cena é o exemplo de como um jogo usa o kit: `src/game/` só com escolhas de jogo e um README que leva do zero a um mundo rodando | regra de camada: `src/game/` não importa `src/test/`; `wc -l` ≤ 200 por arquivo e ≤ 1.500 no total; README seguido do zero por um agente sem contexto |
| R10 | O roteiro da §4 roda inteiro, sem intervenção, nos dois cenários, e dá o mesmo hash de estado em duas rodadas e a 60, 120 e 144 Hz | `node examples/reference-district/perf.mjs` duas vezes, hash igual; teste de mesmos bytes das fases sem entrada do jogador (pendência da §15) |
| R11 | Cada fase do roteiro tem a tabela gravada: p50, p99, pior quadro, quadros > 33,4 ms, desenhos e triângulos por quadro, divisão por módulo do pior quadro | `medicoes/regua-<commit>.json` e a tabela no `evidence.md`, a 1x e a 4x |
| R12 | O portão bloqueia regressão por fase contra a `main` medida na mesma máquina | `node tools/gpu/perf-gate.mjs district`; tolerâncias do `compare.mjs` |
| R13 | Memória: duas voltas seguidas do roteiro não deixam resíduo acima do orçamento do `leak.mjs`; a memória absoluta por fase está gravada e abaixo do teto da N4 | sonda da cena com as contagens do `leak.mjs` e a medição absoluta nova |
| R14 | Nenhuma peça da cena passa do limite de desenhos do dono | `cost.mjs` apontado para a página da cena, com `tools/kit-audit/budgets.json` |

## 8. O que falta no SDK para a cena existir

Levantado por leitura da `origin/main` em 2026-11-21. Nada foi implementado. O dono provável é confirmado com `kit_owner` na task de cada uma.

| # | Lacuna | Onde está hoje | Fases do roteiro que travam |
|---|---|---|---|
| L1 | **Não existe anfitrião de mundo fora da sala.** Agendador, filas, física, destruição, som com oclusão, andar com colisão, tiro que acerta o mundo e granada estão no `room.ts` (5.621 linhas) e em arquivos irmãos que a sala não exporta (`player.ts` 724, `explosives.ts` 633, `door-open.ts`, `world-occlusion.ts`) | `packages/game-test-room/src/` | todas |
| L2 | Nenhum `HouseProvider` desenha a casa de verdade: o bairro do `game-urban` só põe as 8 silhuetas de longe | `game-urban/src/neighbourhoods/houses.ts` | `walk`, `enter` |
| L3 | `groundLayoutOfPlans` (zonas do lote no terreno) não é exportado; só a área de teste usa | `game-floorplan-three/src/lot/ground-layout.ts` | `walk` |
| L4 | **Tiro não acerta zumbi.** Não há teste de raio contra agente da horda; o evento de tiro não leva origem nem direção | `game-crowd`, `game-contracts/src/module.ts` | `shoot`, `horde` |
| L5 | Não há ponte da casa para a grade de navegação da horda (`NavGrid.fillRect` só é chamado pelas cenas do banco) | `game-crowd-three/src/bench/scenes.ts` | `horde` |
| L6 | Jogador e casa: entrar, bloquear nas paredes e abrir porta com a mão só estão ligados na área de teste | `game-floorplan-three/src/test-area/module.ts` | `enter` |
| L7 | Dirigir com o jogador só existe no banco de provas; entrar e sair do carro com corpo não existe (spec 016, que está só numa branch local, `docs/specs-animacao-013-016`) | `game-vehicles-three/src/test-area/proving/` | `drive` |
| L8 | Ninguém consome o evento `run_over` da direção: atropelar não fere a horda | `game-vehicles-driving/src/types.ts` | `drive` |
| L9 | Não existe pacote de entrada (teclado e mouse estão espalhados pela sala; controle não existe) | — | todas, se a entrada for de jogador (N5) |
| L10 | Rua, poste e prédio do `game-urban` não têm colisão nem destruição | `game-urban-three` | `drive`, `grenade` |
| L11 | A régua não mede outra página; memória absoluta e tempo de carga não são medidos por nada (§6) | `tools/gpu/`, `examples/test-room/` | medição |
| L12 | Item solto no chão ou gerado por cômodo não existe; só achado dentro de recipiente | `game-items/src/finds/` | — (o roteiro usa o armário) |
| L13 | `kit_owner` não conhece zumbi, item nem poste | `tools/kit-audit/rules.json` | — |
| L14 | As 14 peças do recorte inteiro (ponte, rio, prédio de 4 a 8 andares, sobrado misto, viela, bar, semáforo e outras) | `plan.md`, "Falta" | nenhuma: ficam fora da fatia |

A L1 é a maior e já tem desenho aprovado (`design-host.md`, `createKitWorld`, Fases 1 e 1b). L4, L5 e L8 não estavam no plano de 2026-11-18.

## 9. Decisões abertas

Tudo abaixo é escolha do dono. A recomendação é de quem escreveu a revisão e não vale como decisão.

| # | [NEEDS CLARIFICATION] | Opções | Recomendação |
|---|---|---|---|
| N1 | Qual é a primeira entrega jogável | (a) a fatia da §3: uma rua, só peça que existe; (b) o recorte inteiro com marcador `missing` nas 14 peças que faltam, como a T2.1 de 2026-11-18 previa; (c) outra cena menor | (a). O recorte inteiro continua sendo o alvo; a fatia é a parte dele que se mede sem esperar peça nova |
| N2 | Tipologias e quantidade de casas da fatia | (a) 10 lotes: 6 `budget_slab_house`, 2 `budget_semi_detached`, 1 `townhouse`, 1 `pharmacy`, estados sorteados 35/45/20; (b) só residenciais; (c) lista do dono | (a). A casa em que se entra é uma `budget_slab_house` normal |
| N3 | Os cenários `tipico` e `pior` rodam o mesmo roteiro, e a C4 na ponte fica para depois | (a) sim; (b) manter o `pior` de 2026-11-18 e esperar ponte e delegacia | (a) |
| N4 | Orçamentos que ninguém escreveu ainda: tempo de carga, desenhos e triângulos por quadro, memória absoluta | (a) fixar depois da primeira régua (T2.8): teto = medido + 10%; (b) o dono dá os números antes de medir | (a), com o dono aprovando a tabela medida. Número escolhido sem medir repete o erro que a spec 010 corrigiu |
| N5 | Como o roteiro é dirigido enquanto a ação do jogador está presa na sala | (a) entrada sintética pelos mesmos pontos que o jogador usa: exige a Fase 1b inteira antes de qualquer medição; (b) o cenário chama o SDK direto (`world.shoot`, `throwableUse`) em `src/test/`, e troca para (a) quando a 1b fechar | (b). A régua mede o mesmo custo de mundo; o que ela não prova é a cola do jogador, e isso fica escrito no `evidence.md` |
| N6 | A fase `drive` sem a spec 016 | (a) esperar a 016; (b) trocar de controle sem animação, como o banco de provas faz, e marcar pendência; (c) tirar a fase do roteiro por ora | (b) |
| N7 | Ordem com as outras frentes. O plano de 2026-11-18 punha as Fases 1 e 2 daqui antes das Fases 1 a 3 da spec 010; não aconteceu: a 010 fechou, a 017 fechou e a 018 está aberta, todas medidas só na sala. A Fase 1 e a 1b mexem em 3.000 a 4.000 linhas do `room.ts`, que estilhaços, explosão, áudio e régua estão alterando agora, e há uma troca de versão do three.js em avaliação | (a) começar a Fase 1 já; (b) agora só o que não toca o `room.ts` (T0.x, T2.1, T2.6), e a Fase 1 depois da troca do three.js e da T1.2 da 018; (c) cena primeiro sobre a sala, extraindo depois | (b). A (c) quebra a D7 (o jogo copiaria a sala) |
| N8 | O trabalho de 2026-11-18 que não chegou à `main`: três commits de código na branch local (`createRaycastOcclusion` no `game-audio`, subpastas de `exports` no `check:layers`, registro de objetos e porto de relato no `game-kit-defaults`), 279 commits atrás. O `world-occlusion.ts` que um deles move ganhou testes no PR #414 | (a) rebasear e abrir um PR por commit; (b) refazer sobre a `main` de hoje; (c) abandonar | (a), nesta ordem: `check:layers`, oclusão, registro de objetos. Custo: resolver conflito no `room.ts` e nos testes do #414 |
| N9 | Medição em AMD, exigida desde a spec 005 e nunca feita | (a) o dono indica uma máquina com Radeon; (b) pedir a um jogador uma rodada do `pnpm check:district`; (c) fechar sem AMD, registrando | (a) ou (b). O estrangulamento de CPU do Chrome não vale como AMD (`room-explosion.mjs`) |
| N10 | Quantas casas são enteráveis ao mesmo tempo na fatia | (a) todas; (b) só as próximas, pelo LOD de casa (`planLod`), como a D4 | (b) |

## 10. Fora do escopo

- **Personagens com roupa texturizada** (atlas de roupa, sujeira e sangue). É arte, o item mais caro do visual; spec própria depois desta.
- O jogo ZombiAdA e os nomes de lugar.
- As cenas 2 (centro inteiro) e 3 (bairro popular inteiro): só a carta.
- Baixar o custo do quadro da explosão: é a spec 018. Esta spec mede e registra.
- Implementar qualquer lacuna da §8 nesta revisão.
