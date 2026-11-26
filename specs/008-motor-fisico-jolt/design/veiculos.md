# Desenho — veículos no Jolt: condução, batida que deforma, peças que soltam (T6.1 🧠, escopo ampliado)

Estado: escrito em 2026-11-14; revisado por `architect` (APPROVE WITH CHANGES, as 12 mudanças aplicadas no mesmo dia); **divisão 008/009
decidida pelo dono em 2026-11-14** (abaixo). As decisões ainda abertas estão na seção 20. Nada aqui foi implementado.
Base: `spec.md` (C7, C8, C9, condições 4–10), `design/arquitetura.md` (laço, camadas, `tag`, contatos, memória), `evidence.md` T3.0b,
`CLAUDE.md` §1, §2, §7, §8, §12, `specs/regras/07-veiculos.md`, `docs/veiculos-pecas-por-categoria.md`, READMEs e skill `kit-veiculos`.
Escopo pedido pelo dono em 2026-11-14: a referência **não** é o GTA ("sempre são batidas padrões, não soltam peças interiores, não amassam
conforme a batida e no final o carro sempre explode"); é o BeamNG.drive (nós com massa e vigas que dobram e quebram, malha "flexbody" que
segue os nós) e o Wreckfest (dano por local, ~24 carros). Depois, o mesmo dia: o desenho vale para **toda a frota**, avião e barco inclusive,
com orçamento de quantos carros batem ao mesmo tempo.

### Divisão entre as specs 008 e 009 (decidida pelo dono em 2026-11-14)

- **Spec 008 (esta) fica com E1 e E2**: condução no Jolt, cascos convexos, carro estacionado dinâmico, dano de nível 2 (o de hoje) alimentado
  pelos contatos do Jolt, peças que soltam como corpos e atropelar agentes.
- **Spec 009 leva E3–E5**: o reticulado (nível 3), fogo pelas entradas novas e ocupantes ejetados, avião, helicóptero, barco que afunda,
  reboque e ônibus. O desenho deles **continua neste documento**, marcado **"vai para a spec 009"**, e a spec 009 o referencia.

| Seções | Spec |
|---|---|
| 1–3, 5, 6.1, 6.4, 7 (inclui 7.8 atropelar), 10.1, 10.3, 10.4, 11 (sem o interior que depende do reticulado), 13, 14.0 (linhas de carro, moto, bicicleta, caminhão sem reboque, trator sem implementos, blindado), 14.1–14.3 (o que não depende do reticulado nem do reboque), 16, 17 (nível 2), 18 (linhas da 008), 20–23 | **008** |
| 4.2, 4.3, 6.2 (reticulado), 6.3, 8, 9, 10.2, 12, 14.3 (reboque, carga, ônibus, implementos), 14.4–14.8, 15 | **009** |

### Decisões do dono em 2026-11-14 (depois da revisão do `architect`)

- **D3 aprovada:** carro estacionado é corpo dinâmico dormindo, empurrável, com as travas da seção 10.4 (casco compartilhado até o primeiro
  dano, sem `VehicleConstraint` parado, agente nunca encontra carro, teste de heap com 200 carros, B6 com 20 carros na ilha).
- **D4 aprovada:** o tiro acerta o desenho exato (raio contra a malha); a física usa cascos convexos que nunca passam 1 cm para fora do
  desenhado e cobrem ≥ 95% dele, com teto de cascos por classe medido na frota (T6.4). A regra de 1 cm da T3.0b fica só para objetos estáticos.
- **D2, D9, D12, D13 confirmadas:** N de reticulados fixo pela opção de qualidade, prioridade pela distância ao jogador e nunca pela câmera;
  `game-deform` só com o reticulado genérico; nenhum `game-vehicle-damage`; sem Jolt multithread (API de `game-deform` pronta para worker).

## 1. Contexto e objetivos

Hoje (branch `feat/motor-fisico-jolt`):

- O carro estacionado colide no Jolt por **triângulos** (T3.0b): uma peça por parte × célula de 80 cm, a ≤ 1 cm do desenhado, 86 000–160 000
  triângulos por veículo, ~1,5 s para ficar sólido (`game-vehicles-three/src/colliders.ts`, `createVehicleColliders`).
- **Malha (`MeshShape`) no Jolt só serve a corpo estático**, e malha contra malha não colide. Um carro que anda precisa de formas convexas.
  Logo o colisor da T3.0b só existe para carro parado e fixo.
- O carro que anda é o arcade do jogo (`game-vehicles-driving/src/arcade.ts`, 2D cinemático) ou a semi-simulação (`semi/driver.ts`).
  O adaptador já tem um veículo de rodas do Jolt (`game-physics-jolt/src/vehicles.ts`), usado só em `tests/vehicle.test.ts` (caixas).
- A batida do kit é `crashVehicle` (`game-vehicles/src/destructible/crash.ts`): energia das massas → golpes `blunt` espalhados pela largura do
  contato → `crumple`, que chama `kit.impact` e empurra os vértices desenhados em volta do ponto (`impact.ts`, `dentField`, até 0,6 m).
  É o "amassado padrão" que o dono não quer: mesma forma de campo radial para qualquer estrutura, sem trilho, coluna ou teto.

Objetivos:

1. **Andar barato**: dezenas de veículos andando no orçamento do C7 (10 carros ≤ 0,5 ms mediana), como corpo rígido do Jolt com o veículo
   de rodas do Jolt.
2. **Bater de verdade, só quem bate**: o veículo que bate liga um reticulado de nós e vigas do kit que deforma por ângulo, velocidade e
   estrutura (longarinas, colunas, teto), e desliga quando assenta.
3. **O desenho segue a deformação** (nós → vértices, como o flexbody), e o tiro continua acertando o desenhado (§7).
4. **Peças soltam** como corpos do Jolt (porta, capô, para-choque, roda, banco, bloco, bateria, interior), e o interior cai quando a casca abre.
5. **Fogo e explosão só pelas regras do kit** (vazamento, faísca, tanque furado); nunca roteiro.
6. **Genérico na frota**: carro, moto, caminhão, ônibus, trator, blindado, barco, avião, helicóptero, com regra de tamanho.
7. **Custo limitado e medido**: cidade, multidão, zumbis e prédios caindo no mesmo quadro.

## 2. Fora do escopo

- Soft body em **todo** carro **o tempo todo** (BeamNG roda o carro inteiro como soft body a 2 000 Hz sempre): o chassi não flexiona
  enquanto anda; a dirigibilidade depois da batida muda pela geometria (seção 7.6), não por chassi flexível.
- Simulação de ondas, correnteza variável e aerodinâmica com escoamento (CFD). Água é plano por célula (`game-terrain` `waterAt`).
- Avião de linha e navio grande **não estão na frota** (o maior avião é `light_jet`/`regional_turboprop`, o maior barco `patrol_boat`):
  só a regra de tamanho os cobre (seção 14.8).
- Multithread, fork do Jolt ou build próprio do wasm (`spec.md` §10).
- Rede/multiplayer. **Multiplayer em lockstep fica excluído pelo desenho**: o número de vagas de batida N vem da qualidade escolhida
  (15.3), e dois jogadores com qualidades diferentes simulariam batidas diferentes; lockstep exigiria N igual em todos.
- Push, PR, merge.

## 3. O que foi verificado

### 3.1 `jolt-physics` 1.1.1 (`node_modules/.pnpm/jolt-physics@1.1.1/node_modules/jolt-physics/dist/types.d.ts`)

| Item | Existe? | Linhas / nota |
|---|---|---|
| `VehicleConstraint`, `VehicleConstraintSettings` (`mUp`, `mForward`, `mMaxPitchRollAngle`, `mWheels`, `mAntiRollBars`, `mController`) | sim | 3852–3896 |
| `WheeledVehicleController`: `SetDriverInput(forward, right, brake, handBrake)`, `GetEngine`, `GetTransmission`, diferencial com `mLimitedSlipRatio` | sim | 4228–4245 |
| `MotorcycleController` (inclinação com mola) e `TrackedVehicleController` (esteira) | sim | 4246–4272, 4112–4138 |
| `WheelSettingsWV`: `mLongitudinalFriction`/`mLateralFriction` como `LinearCurve`, `mMaxSteerAngle`, `mMaxBrakeTorque`, `mMaxHandBrakeTorque`, `mInertia` | sim | 4004–4027 |
| `VehicleEngineSettings.mNormalizedTorque` (`LinearCurve`), `VehicleTransmissionSettings` (marchas, troca, embreagem, `mShiftUpRPM`) | sim | 4139–4201 |
| `Wheel`: `SetAngularVelocity`, `HasContact`, `GetContactBodyID`, `GetSuspensionLambda`, `GetLongitudinalLambda`, `GetLateralLambda` | sim | 3982–4003 |
| `VehicleTransmission.Set(gear, clutchFriction)` (carro criado já engatado) | sim | 4195–4201 |
| `VehicleConstraintCallbacksJS.GetCombinedFriction` (atrito do pneu por roda e chão) | sim | 3903 |
| Remover uma roda do veículo existente | **não** | não há `RemoveWheel`: roda perdida = recriar o veículo sobre o mesmo corpo |
| `MutableCompoundShape`: `AddShape`, `RemoveShape`, `ModifyShape(i, pos, rot, shape)`, `AdjustCenterOfMass` | sim | 1145–1152 |
| `BodyInterface.NotifyShapeChanged(id, prevCOM, updateMass, activation)` | sim | 2086 |
| `ConvexHullShapeSettings` (`mPoints`, `mMaxConvexRadius`, `mHullTolerance`) | sim | 1101–1115 |
| `EMotionQuality_LinearCast`, `BodyInterface.SetMotionQuality` (CCD) | sim | 91–95, 2119 |
| `Constraint.GetTotalLambda*` (base da junta que quebra por impulso, já usada em `joints.ts`) | sim | 1435–1772 |
| `ContactListenerJS.OnContactPersisted`, `ContactManifold.GetWorldSpaceContactPointOn1`, `mPenetrationDepth` | sim | 2316–2337 |
| **Soft body**: `SoftBodySharedSettings` (vértices, faces, arestas com `mCompliance`, dobra diédrica, volume, skinning, LRA), `SoftBodyCreationSettings`, `BodyInterface.CreateSoftBody`, `SoftBodyMotionProperties.GetVertices`, `SoftBodyContactListenerJS` | sim | 2424–2453, 2999–3420, 2061 |
| Soft body com **plasticidade** (comprimento de repouso que muda sob carga) ou **aresta que quebra** | **não** | `SoftBodySharedSettingsEdge` só tem `mRestLength` e `mCompliance`, nas configurações *compartilhadas*; mudar à mão exigiria uma cópia por carro e escrever milhares de arestas por passo pela ponte do wasm |
| `Body.ApplyBuoyancyImpulse(surfacePos, surfaceNormal, buoyancy, linearDrag, angularDrag, fluidVelocity, gravity, dt)` e a mesma no `BodyInterface` | sim | 2034, 2142 |
| `Body.AddForce(force, point)`, `AddTorque`, `AddImpulse(impulse, point)` | sim | 2022–2031 |

### 3.2 Sonda pequena (2026-11-14, `scratchpad/probe/soft.mjs`, ~3 s, máquina **com carga** de outro agente medindo: tempos só indicativos)

- Dois cubos soft (4×4×4 nós, 468 arestas), um caindo sobre o outro: o de cima **atravessou** o de baixo e os dois terminaram no chão no mesmo
  lugar (faixas de y idênticas, 0,02–1,02 m). **Soft body contra soft body não colide no Jolt 1.1.1** (confirmado, não só pela documentação).
- Caixa rígida sobre um cubo soft: ficou por cima (y 1,55 m). Soft contra rígido colide.
- Custo: um soft body de 343 nós e 3 258 arestas somou ~0,1 ms por passo de 1/120 (com as 5 iterações padrão), no wasm.

### 3.3 No kit (`CLAUDE.md` §1: procurar antes de criar)

| Procurado | Achado |
|---|---|
| Reticulado / massa-mola / soft body / plasticidade | **nada** em `packages/*` (só `warp.ts`, que é escultura da carroceria na construção, e a "Fibonacci lattice" de direções do blast) |
| Materiais com módulo e escoamento | `game-destruction/src/data/materials.json` tem `density`, `ductility`, `compressive`, `fracture`; **não** tem módulo de elasticidade nem deformação de escoamento. `flexure.ts` tem `rebarYieldMPa` (só concreto armado) |
| Juntas das peças do veículo | `game-vehicles` (`createVehicleDestructible`): `hinge`, `bolt`, `weld`, `glue`, `clip`, com desgaste (`hp`) e `disassemble` |
| Peça que sai voando | `visual.ts` `detach` → `I.fling` (`explosion.ts:75`): animação balística do kit, sem colisão |
| Fogo e combustível | `IgnitionRules` (`game-contracts`), vazamento por furo abaixo do nível, faísca de bala dura, fogo perto, blast; tanque de gasolina explode por temperatura (README de `game-vehicles`, "Fuel tank") |
| Amassado | `kit.impact` (`impact.ts`, `dentField` radial com teto no plano central), `zone-dent.ts` (campo de amassado por caixa de zona, subdivide a malha), `crease-queue.ts` (normais em fila com orçamento), `tri-index.ts` (índice de triângulos para o `surfaceRay`) |
| Condução com motor, marchas, pneu | `semi/types.ts` (`SemiSimSpec`: massa, rodas, motor, marchas, suspensão, `tyre.friction`, `corneringStiffness`), `semiSpecFromStats` (ficha da frota → spec), superfícies (`surfaces.ts`), `controls.ts` (pedais, câmbio, ABS, controle de tração), `driving-aids.ts` |
| Banco de provas | `game-vehicles-proving` (0–100, velocidade máxima, frenagem seca e molhada, raio de giro), hoje só sobre a semi-simulação |
| Água | `game-terrain` `waterAt(x, z) → { liquid, level, depth }` (plano por célula); `game-fluids` é recipiente, poça e torneira, **não** corpo d'água |
| Afundar barco | `docs/veiculos-pecas-por-categoria.md` diz "afunda pela entrada de água no furo abaixo da linha d'água", mas **não há código** de flutuação ou alagamento em `game-vehicles` (grep `sink|flood|buoy`): pendência escondida, registrada aqui |
| Modelo de voo | **nada** (`ejection.ts` tem um `lift` de ejeção do ocupante, só) |

### 3.4 Achados no adaptador (corrigir na T6.2)

- `wheelContacts` conta sempre 4 rodas (`for (let i = 0; i < 4; i++)`): errado para moto (2), caminhão de 3 eixos (6) e trator.
- `createVehicle` dá a rotação inicial das rodas por `v[2] / raio` (velocidade no eixo z **do mundo**, não na frente do chassi) e escolhe a
  marcha pelo raio da roda 0: um carro criado andando de lado ou girado fica com as rodas erradas.
- `removeVehicle` remove o **corpo** junto: perder uma roda (recriar o veículo) não pode tirar o chassi.

### 3.5 Como os veículos são representados hoje (conferido no código)

O resumo que chegou ao dono ("peças desenhadas independentes com zonas de dano e crumple em `game-vehicles`; nenhum veículo dinâmico do
Jolt; carro estacionado com colisor de triângulos por peça; condução arcade") está **quase** certo. Conferido:

| Afirmação | Conferido | Onde |
|---|---|---|
| Peças desenhadas independentes (porta, capô, para-choque, roda, vidro) | **em parte**. Capô, tampa, para-choques, rodas, pneus, faróis, retrovisores, bateria e engate têm malha própria. **A porta fechada, os vidros, o interior e a casca vêm em malhas mescladas do corpo**; a porta só ganha malha própria na primeira vez que abre (`destructible/door-open.ts` corta a pele, o forro e a borda), e a T3.0b divide as mescladas **por triângulo** pela caixa da zona | `colliders.ts`, `door-open.ts`, evidência T3.0b |
| Zonas de dano e crumple em `game-vehicles` | **sim**: zonas com saúde 0–100 em 5 faixas, `kit.impact`/`dentField`, `zone-dent.ts`, `crashVehicle` → `crumple`, juntas do destrutível com desgaste (`impl.ts` `wear`: `j.hp -= amount·0,25`) | README, `impact.ts`, `crash.ts`, `impl.ts:412` |
| Nenhum veículo dinâmico do Jolt | **sim no jogo e na sala**: `createVehicle` existe no adaptador (`vehicles.ts`) e só roda em `tests/vehicle.test.ts`, com chassi de duas caixas | `game-physics-jolt` |
| Carro estacionado com colisor de triângulos por peça (T3.0b) | **sim, e só na sala do veículo** (`d.colliders = () => vehicleColliders(...)` no módulo da sala); estático | evidência T3.0b |
| Condução arcade em `game-vehicles-driving` | **sim, e também a semi-simulação** (motor, marchas, pneu, suspensão, superfícies), usada pelo banco de provas e pela cabine da sala (`test-area/proving/cockpit.ts`) | `arcade.ts`, `semi/driver.ts` |
| Visual de longe | `vehicle-lod.ts`: além de 14 m um veículo **intacto** é desenhado fundido (`VEHICLE_LOD_DISTANCE`); o atingido volta a ser fundido depois de parado | `game-vehicles-three` |

A evolução gradual a partir daqui está na seção 22.

## 4. Decisão central: corpo rígido no Jolt + reticulado do kit em referencial flutuante

### 4.1 As três saídas e por que o reticulado do kit

| Saída | A favor | Contra (medido ou lido) |
|---|---|---|
| **A. Soft body do Jolt** no carro que bate | pronto, wasm, ~0,1 ms/passo para 3 258 arestas | **carro contra carro atravessa** (3.2): a batida mais comum não funciona; sem plasticidade nem quebra (3.1); o carro deixaria de ser o corpo do veículo de rodas (trocar de rígido para soft no meio da batida = outro corpo, outro `BodyId`, contatos refeitos) |
| **B. Soft body completo do kit (BeamNG)**: os nós *são* o carro, com colisão própria nó-triângulo | o mais fiel | colisão nó-triângulo entre carros é um segundo motor de contato (o que a spec 008 proibiu: "dois motores no kit não é aceitável", `spec.md` §1); 2 000 Hz em JS para dezenas de carros não cabe |
| **C. Rígido no Jolt + reticulado do kit no referencial do corpo** (escolhida) | um motor de contato só (o Jolt troca o momento); o reticulado só **deforma**; cabe no orçamento por fatia; plasticidade e quebra nossas | a forma rígida atrasa um pouco em relação à deformada (cascos refeitos em cadência, seção 10); exige alimentar o reticulado com o impulso medido |

**Decisão: C.** É o que o Wreckfest faz na prática (dinâmica rígida, deformação local dirigida pelo impulso), não o BeamNG. Discordo da
leitura de que dá para ter o BeamNG no nosso quadro: o BeamNG não tem cidade, multidão e prédios caindo junto. O que se perde: o chassi não
flexiona andando, e o carro não "quica" pela elasticidade da estrutura (a restituição vem do Jolt). O que se ganha: a forma do amassado
depende de onde, de quanto e da estrutura, que é o pedido do dono.

### 4.2 Como o reticulado recebe a batida (referencial flutuante) — **vai para a spec 009**

O Jolt resolve o contato entre os cascos convexos e muda a velocidade do chassi. O reticulado não colide com nada: ele recebe, por passo fixo
`h`, o que aconteceu com o corpo, e o **contato entra como restrição de plano unilateral** (mudança 1 da revisão).

1. **Impulso de contato do passo**, no referencial do chassi: `J_contato = m·Δv − Σ impulsos que não são de contato`. Subtrair, todos:
   - gravidade (`m·g·h`);
   - rodas: suspensão (`GetSuspensionLambda`, na direção da suspensão) e pneu (`GetLongitudinalLambda`/`GetLateralLambda`, nas direções do
     contato), 3.1;
   - forças do próprio kit aplicadas no passo: arrasto do ar (7.1), aerodinâmica do voo (14.4/14.5), empuxo da água (14.6), mola do "pé no
     chão" da moto (14.2);
   - juntas do Jolt presas ao chassi: engate do reboque, porta ou capô pendurados (`GetTotalLambda*` de cada uma, 3.1);
   - amortecimento linear e angular do próprio Jolt no corpo (`mLinearDamping`, `mAngularDamping`: `Δv_amort = v·(1 − 1/(1 + c·h))`).
   O mesmo para o giro (`I·Δω`). Assim o impulso da batida sai do que o Jolt de fato aplicou, sem callback por contato (lição do B6).
2. **Plano de contato**: de cada `ContactManifold` observado do passo (pontos, normal, penetração; `OnContactPersisted` só para corpos observados,
   `contacts.ts:148`), monta-se no quadro do corpo um plano `n·(x − p) ≥ 0` com `p` no ponto de contato e `n` saindo do outro corpo. Os nós da
   **mancha de contato** (nós das partes com o `tag` tocado, a até um espaçamento dos pontos) recebem essa restrição unilateral, de
   *compliance* zero, a cada subpasso: nó que atravessa é **projetado no plano**. *Opcional*: quando o manifold vem pobre (um ponto só), o ponto
   de impacto sai de mínimos quadrados contra `J_contato` **e** `I·Δω` (`r × J ≈ ΔL`).
3. **Contra-impulso de inércia**: cada nó recebe `−mᵢ·Δv_contato` (com `Δv_contato = J_contato / m`) mais o termo de `Δω × r`. É isso que faz o
   bloco do motor (nó pesado) avançar sobre a parede corta-fogo; o plano segura os nós da frente, e a diferença vira esmagamento.
4. **Referencial flutuante, só deriva numérica**: a cada subpasso, retira-se do reticulado só o movimento rígido que **não** foi causado pelos
   planos (momento linear e angular do reticulado menos a soma dos impulsos de projeção e de inércia aplicados). Translação causada pelo plano
   nunca é retirada.
5. **Ao assentar**: o deslocamento médio do reticulado (média ponderada pela massa do deslocamento dos nós em relação ao repouso: a frente
   esmagada puxa o centro para trás) é gravado nas poses dos cascos e no **centro de massa do kit** do corpo (contrato: massa, inércia e centro
   de massa juntos, 6.4).
6. **Energia**: a energia do reticulado **nunca** passa da que entrou (trabalho dos planos e da inércia), com 1% de folga numérica; e o trabalho
   plástico bate com a energia cinética que o Jolt dissipou no contato (restituição ≈ 0,1) a ±25%.

**Aceite (T6.0b e calibração da 009)**: folga final entre a frente e a parede ≤ **3 cm**; nó mais rápido em relação ao corpo ≤ **1,5×** a
velocidade de aproximação; nenhuma energia do reticulado acima da que entrou.

### 4.3 O reticulado (XPBD com plasticidade e quebra) — **vai para a spec 009**

- **Nós**: posição, velocidade, massa (a massa do carro repartida: casca leve, motor, bateria, tanque e eixo pesados). Em `Float64Array`.
- **Vigas**: dois nós, comprimento de repouso `L0`, rigidez (como *compliance* do XPBD), deformação de escoamento `εy`, encruamento, deformação
  de ruptura `εb`, classe (seção 6.3).
- **Passo** (XPBD de passos pequenos, Macklin 2019): por subpasso, integrar velocidades → **uma** iteração sobre as vigas → velocidades a partir
  das posições. Estável em qualquer frequência; a frequência só muda a precisão (seção 15).
- **Plasticidade**: se `|ε| > εy`, `L0` acompanha a parte acima do escoamento (o metal não volta). **Ruptura**: deformação plástica acumulada
  `> εb` apaga a viga (bit num `Uint8Array`). Vidro: `εy = εb` (quebra sem dobrar). Fibra de vidro (barco): quebra cedo, dobra pouco.
- **Só raiz quadrada** nas contas (nada de `sin`/`cos`): determinístico entre runtimes (seção 17).
- **Desliga** quando a energia cinética relativa dos nós fica abaixo do limiar por 0,25 s e nenhum contato observado carrega mais que o
  peso próprio; uma laje que assenta sobre o teto mantém o reticulado ligado até o teto segurar (esmagamento contínuo, que o §9 da
  arquitetura tira do `ContactBuffer`, entra pelos pontos observados).

## 5. Estados do veículo e quando cada camada roda

| Estado | Corpo no Jolt | Rodas | Reticulado | Cascos | Desenho |
|---|---|---|---|---|---|
| **Estacionado / dormindo** | dinâmico, camada `vehicle`, dormindo (custo ~0); intacto **divide** o composto imutável do modelo (10.4) | **sem** `VehicleConstraint`: entra preguiçosa por `rebuildVehicle` quando alguém dirige ou o trânsito o ativa | desligado | os do modelo, compartilhados | parado |
| **Andando** | dinâmico, `LinearCast` acima de 15 m/s | `driveVehicle` por passo (fase `actors`) | desligado | fixos | rodas giram (`wheel-roll.ts`) |
| **Batendo** (impulso de contato no passo > limiar da classe, ou carga mantida) | idem, pontos de contato observados | continuam | **ligado** se o veículo tem vaga (seção 15.3); senão o amassado aproximado (seção 15.3) | refeitos em cadência (seção 10) | skinning dos vértices sujos |
| **Assentando** | idem | idem | ligado até a regra de desligar (4.3) | refeitos uma última vez | normais pela fila (`crease-queue`) |
| **Deformado em repouso** | dinâmico, dormindo | recriadas com o alinhamento novo (7.6) | **liberado**: fica só o deslocamento plástico por nó (`Float32Array`) | os deformados | geometria final gravada |
| **Peça solta** | corpo próprio (camada `debris`, `LinearCast` se rápida) | — | — | o casco da peça | a peça segue o corpo |

**Mudança na arquitetura (§6 de `arquitetura.md`)**: o carro estacionado deixa de ser "corpo fixo na camada `static`" e passa a ser dinâmico
dormindo na camada `vehicle`. Motivo: o carro que bate num carro estacionado tem de empurrá-lo, e um corpo estático com malha não se move.
Dormindo, o custo no Jolt é só o da broadphase. Decisão D3 (seção 20), **só com as guardas da 10.4** (composto compartilhado até o primeiro
dano, sem constraint estacionado, teste de heap com 200 carros, nenhum agente encontra carro, variante do B6 com carros estacionados).

## 6. Modelo de dados e onde mora

### 6.1 Pacotes (§2: núcleo genérico; three.js só em `*-three`; conteúdo no pacote de conteúdo)

| O quê | Onde | Por quê |
|---|---|---|
| Contrato: filho de composto mutável, motion quality, empuxo, observar contatos, recriar veículo sobre o corpo, leitura das rodas (seção 6.4) | `game-physics` | o contrato é dono dos tipos; nenhum tipo do Jolt atravessa |
| Implementação no Jolt | `game-physics-jolt` (`vehicles.ts`, `shapes.ts`, `contacts.ts`) | única dependência do `jolt-physics` |
| **Reticulado genérico** (nós, vigas, XPBD, plasticidade, quebra, referencial flutuante, energia), sem three, sem Jolt, sem veículo | **pacote novo** `@adatechnology/game-deform` (D9; spec 009) | puro, **sem dependência nenhuma**, e serve a props que não são veículo (poste, guarda-corpo, portão de metal, contêiner); nada parecido existe (3.3). API pronta para Worker: `TypedArray` entra, deslocamentos saem, sem callbacks (D13). Dono registrado em `tools/kit-audit/rules.json` |
| Propriedades mecânicas por material (módulo, escoamento, ruptura, encruamento) | `game-destruction/src/data/materials.json` (campos novos, opcionais) | o material tem um dono só; `game-deform` recebe números |
| **Material + classe de seção → números da viga** (`BeamClass`) | `game-vehicles/src/lattice/beam-props.ts` (spec 009) | quem monta o reticulado do veículo resolve; **dependências novas** de `game-vehicles`: `game-destruction` (só dados de material; ela depende só de `game-contracts`, sem ciclo) e `game-deform`. Hoje `game-vehicles` depende só de `game-contracts` e `game-shapes-three` |
| Geração do reticulado a partir das peças e do `meta` (nós na casca por peça, linhas estruturais, nós pesados, montagens das peças) e o mapa viga → peça → dano | `game-vehicles` `src/lattice/` (só caixas e números de `PartDef`/`c.meta`; nada de `Object3D`) | o motor de veículos conhece peças e zonas; continua genérico (nenhum modelo da frota) |
| Classes de viga por categoria (longarina, coluna, teto, soleira, travessa, painel, vidro, montagem) e alvos de calibração por modelo | `game-vehicles-fleet` (dados) | conteúdo da frota (§2) |
| Vínculo vértice → nós (skinning), composição com amassados, cascos convexos a partir dos triângulos de cada peça (portando `createVehicleColliders`) | `game-vehicles-three` (`src/flex.ts`, `src/hulls.ts`) | lê `BufferGeometry` |
| Costura do motor: corpo, veículo de rodas, cascos, observação de contato → reticulado → cascos → desenho; vagas de batida | `game-vehicles-three/src/engine-vehicles.ts` (recebe `PhysicsLoop`/`SeamWorld` por opção, `arquitetura.md` §3) | precisa do desenho e do mundo; nunca cria mundo |
| Mapa de controles e ajustes → `VehicleDesc`/`VehicleInput` | `game-vehicles-driving/src/jolt-map.ts` (sem three, sem Jolt, só tipos do contrato) | a condução já mora ali |
| Modelo de voo (forças por superfície) e de flutuação/alagamento | `game-vehicles-driving/src/flight/`, `.../src/water/` (sem three) — ou pacote próprio se a 009-o decidir | mesma razão; ver 14.4, 14.5 e 14.6 |
| Rodador do banco de provas sobre o Jolt | `game-vehicles-proving` (`run-jolt.ts`) | os testes medidos (0–100, frenagem) viram aceite da condução |

### 6.2 Dados por veículo (tipos propostos, em `game-deform` e `game-vehicles`) — reticulado: **vai para a spec 009**

```ts
interface LatticeDesc {                         // game-deform: só números
  readonly nodes: Float64Array                  // x, y, z por nó, no quadro do corpo
  readonly mass: Float64Array                   // kg por nó
  readonly beams: Uint16Array                   // a, b por viga
  readonly beamClass: Uint8Array                // índice em `classes`
  readonly classes: readonly BeamClass[]
}
interface BeamClass {
  readonly compliance: number                   // m/N (XPBD): a rigidez
  readonly damping: number                      // amortecimento da viga (XPBD), s
  readonly yieldStrain: number                  // limite de deformação elástica (o "deformLimit")
  readonly hardening: number                    // 0..1 do excesso que vira encruamento
  readonly breakStrain: number                  // plástica acumulada que rompe; Infinity = não quebra
  readonly fatigue: number                      // dano por ciclo abaixo do escoamento (golpes pequenos repetidos somam)
  readonly holdSeconds: number                  // carga acima de `breakLoad` por este tempo também rompe (duração, não só pico)
  readonly breakLoad: number                    // N
}
// por viga, estado: dano acumulado 0..1 (`Float32Array`), tempo acima de `breakLoad`, bit `broken`
interface VehicleLattice {                      // game-vehicles: o reticulado e o que cada nó/viga significa
  readonly desc: LatticeDesc
  readonly nodePart: Int16Array                 // parte dona do nó (-1: estrutura)
  readonly beamPart: Int16Array                 // parte cuja montagem a viga é (-1: estrutura)
  readonly mounts: ReadonlyMap<string, readonly number[]>  // id da junta do kit → vigas que a seguram
  readonly hullNodes: readonly Uint16Array[]    // por casco, os nós que movem os seus pontos
}
```

- **Cascos** (spec 008): um por parte × célula, com a célula **dividida pela concavidade** (10.1); teto de cascos por classe na 10.3 (H6),
  ≤ 64 pontos cada; filho do composto com `tag` = índice da parte (`arquitetura.md` §7), **identificado por `tag` ou alça estável, nunca
  pelo índice** (10.4). Na 009, os pontos do casco são vinculados aos nós como os vértices (seção 9).
- **Juntas**: as do kit (`hinge`, `bolt`, `weld`, `glue`, `clip`) continuam donas da regra; o reticulado as gasta (viga de montagem quebrada →
  `wear` da junta). Junta do **Jolt** só para peça já solta pendurada (seção 11).

### 6.3 Classes de viga (dados da frota; valores iniciais a calibrar na 009) — **vai para a spec 009**

| Classe | Onde | Comportamento |
|---|---|---|
| `rail` (longarina) | da frente ao corta-fogo, na altura do vão livre | rígida, escoa sob carga axial alta: é ela que define o recuo da frente |
| `sill` (soleira), `crossmember` | lateral inferior, eixos, assoalho | rígidas; protegem a cabine na batida lateral |
| `pillar` (A, B, C) | de `gh.pillars` | rígidas em flexão; o teto amassa quando elas cedem |
| `roof` | contorno do teto | média; capotagem |
| `panel` | casca (portas, capô, paralamas) | mole; amassa fácil, dá o desenho do amassado |
| `firewall` | plano entre motor e cabine | rígida; o motor empurra |
| `glass` | vidros | quebra sem dobrar (`εy = εb`) |
| `mount` | peça → estrutura (dobradiça, parafuso) | quebra por carga; liga ao `wear` da junta do kit |

### 6.4 Contrato novo em `game-physics` (T6.1b)

| Item | Para quê |
|---|---|
| `ShapeDesc` composto com `mutable: true`, forma compartilhável por alça (`createSharedShape`/`releaseSharedShape`) e `setChildShape(id, handle, shape \| null, pose?)` | composto imutável do modelo dividido pelos carros intactos; cópia mutável no primeiro dano (10.4); trocar só os cascos que mudaram (`ModifyShape`/`RemoveShape`, `NotifyShapeChanged` sem recalcular massa: a massa é do kit, como no bug 1). **`handle`, não índice**: `RemoveShape` desloca os índices seguintes (`types.d.ts:1147`); o adaptador guarda alça → índice atual |
| `setMassProperties(id, { mass, inertia, centreOfMass })` | peça que solta tira a sua massa, inércia e centro de massa do chassi (11); o reticulado assentado move o centro de massa (4.2, item 5) |
| `setMotionQuality(id, 'discrete' \| 'linearCast')` | CCD do carro rápido, da peça solta rápida e do avião |
| `watchContacts(id, on)` | liga os pontos de contato mantidos (com normal e penetração) só para o veículo que bate (custo só enquanto observado) |
| camadas: tirar o par `vehicle`–`agent` de `LAYER_PAIRS`; camada `corpse` separada de `prop` (a mesma que a Fase 5 criou; este desenho a chamava `ragdoll`); testador das rodas numa camada que não encontra `agent` nem `ragdoll` | atropelar (7.8) e carro estacionado (10.4); muda o §6 da `arquitetura.md` |
| `vehicleWheels(id, out)` | por roda: contato, corpo e `tag` do chão, ângulo, giro, compressão, deslizamento e os três *lambdas* (impulso das rodas, 4.2; sono, 7.7; som e marcas de pneu) |
| `rebuildVehicle(id, desc)` | recria a constraint sobre o **mesmo** corpo (roda perdida, alinhamento torto); `removeVehicle` continua tirando tudo |
| `applyBuoyancy(id, surface, normal, buoyancy, linearDrag, angularDrag, flow)` | barco e anfíbio (`ApplyBuoyancyImpulse`, 3.1) |
| `VehicleDesc.controller: 'wheeled' \| 'motorcycle' \| 'tracked'` | moto e blindado de esteira (3.1) |
| `VehicleDesc` com curvas: `tyre.longitudinal`, `tyre.lateral`, `engine.torqueCurve` (pares x, y), `transmission` (troca, embreagem), `differentials` com `limitedSlip` | o mapa da seção 7 |

Força por passo continua sendo `addImpulse(id, F·h, ponto)` na fase `beforeStep(h)` (sem `addForce` novo no contrato).

## 7. Condução: o mapa para o veículo de rodas (escopo original da T6.1)

### 7.1 Fonte da verdade dos ajustes

O arcade (`ArcadeSpec`) é um modelo 2D cinemático (`yaw += steer·v/wheelbase·dt`): não tem torque, massa nem pneu, e não dá para mapear um
para um. A semi-simulação tem tudo (`SemiSimSpec`) e já sai da ficha da frota (`semiSpecFromStats`). **Decisão**: ficha da frota →
`SemiSimSpec` → `VehicleDesc` (`vehicleDescFromSemi`, em `jolt-map.ts`). O arcade vira **assistência e metas**: o que ele sentia (aceleração
5,5 m/s², 17 m/s de máxima no carro do jogo, resposta da direção 5/s) é meta de calibração e regra de entrada, não física.

| `SemiSimSpec` | `VehicleDesc` (Jolt) |
|---|---|
| `mass`, `centreHeight`, `yawInertia` | massa e inércia do chassi (do kit; o Jolt não recalcula), centro de massa no `centreHeight` |
| `wheels[]` (x, z, steer, drive, handbrake), `wheelRadius` | `WheelSettingsWV` (posição no quadro do chassi, `mMaxSteerAngle`, `mMaxHandBrakeTorque` só nas de freio de mão) |
| `suspension.restLength`, `spring`, `damper` | `mSuspensionMaxLength`, `mSuspensionSpring.mFrequency = √(k/m_roda)/2π`, `mDamping` = razão de amortecimento |
| `engine.idleRpm`, `peakRpm`, `redlineRpm`, `peakTorque` | `mMinRPM`, `mMaxRPM`, `mMaxTorque`, `mNormalizedTorque` (curva: 0,6 na lenta, 1,0 no pico, 0,75 no corte) |
| `gears`, `reverseRatio`, `finalDrive`, `upshiftFraction`, `downshiftFraction` | `mGearRatios`, `mReverseGearRatios`, `mDifferentialRatio`, `mShiftUpRPM`, `mShiftDownRPM` |
| `fourWheelDrive` | dois diferenciais e `mEngineTorqueRatio` 0,5/0,5 (ou um só no eixo motriz) |
| `tyre.friction` (μ de pico), `corneringStiffness` | `mLateralFriction`: (0°, 0), (μ/Cα em graus, μ), (90°, 0,75μ); `mLongitudinalFriction`: (0, 0), (0,06, μ), (1, 0,8μ) |
| `brakeForce` | `mMaxBrakeTorque` por roda = força × raio × parcela da carga do eixo (60/40) |
| superfícies (`surfaces.ts`: seco 1,0, molhado 0,75, terra 0,65, grama 0,55, lama 0,4, sangue 0,5) | atrito do corpo do chão (atrito por corpo, `atrito-por-corpo.md`) e, só se a mistura padrão não bastar, `GetCombinedFriction` (callback por roda: 4 chamadas por carro por passo; medir antes de ligar, lição do B6) |
| `drag` (0,5·ρ·Cd·A) | impulso `−drag·|v|·v·h` no centro de massa, na fase `actors` |

### 7.2 Controles → `driveVehicle`

`controls.ts` já produz `SemiInput` (pedais, câmbio, freio de mão, ABS, controle de tração, piloto automático). A entrada do Jolt é
`{ forward, right, brake, handBrake }`:

- `forward = throttle·powerLimit` (`powerLimit` do controle de tração e do motor danificado, `systems.ts`); freio a partir do parado vira
  ré (`forward = −brake` abaixo de 0,5 m/s), como o arcade.
- `right = −steer` filtrado por `steerResponse` (arcade) e reduzido com a velocidade (assistência do arcade); o eixo do kit é "positivo à
  esquerda", o do Jolt "positivo à direita".
- `brake = brake·brakeFactor` (`status().brakeFactor` do destrutível: freio com vazamento freia menos); `handBrake = handbrake ? 1 : 0`.
- `status()` do destrutível manda: `canStart`/`canDrive` falso → `forward = 0`; `steerPull` → viés em `right`; pneu furado → raio do aro e
  atrito menor naquela roda (seção 7.6).
- Velocidade máxima do arcade (17 m/s no carro do jogo) é limitador de giro do motor, não arrasto artificial.

### 7.3 Carro criado já andando

Corrigir `createVehicle` (3.4): velocidade projetada na **frente do chassi** (`mForward` girado pela rotação inicial); cada roda com
`ω = v_frente / raio_daquela_roda`; marcha = a mais alta que mantém o giro acima de 1,5× a lenta, pelo raio das rodas motrizes; embreagem
fechada (`Set(marcha, 1)`). Teste: carro criado a 60 km/h girado 37° anda 2 s em linha reta sem perder mais que 1 km/h nem derrapar.

### 7.4 Zonas de dano como filhos marcados

Cada casco é filho do composto com `tag` = índice da parte no destrutível (`arquitetura.md` §7). Contato e raio devolvem `(user, tag)` →
parte atingida. Sem reticulado ativo (carro sem vaga, golpe leve), a linha de contato vira `hit` `blunt` na parte certa, como hoje o
`crashVehicle` faz pelas caixas de zona.

### 7.5 Alta velocidade

- Carro acima de 15 m/s: `LinearCast` (CCD do composto inteiro). A 200 km/h (55 m/s) o carro anda 46 cm por passo de 1/120; um casco de
  painel tem 5–15 cm.
- Peça solta e destroço do veículo: `LinearCast` acima de 10 m/s.
- O veículo de rodas testa o chão por cilindro (`VehicleCollisionTesterCastCylinder`, já no adaptador) a cada passo; a 120 Hz basta até
  250 km/h (medir na T6.2 com lombada e meio-fio).
- Reticulado: a frequência da seção 15 dá 4 subpassos por passo fixo no padrão (480 Hz): uma batida de 100 ms tem 48 subpassos.

### 7.6 Alinhamento depois da batida

As posições das rodas (`WheelSettings.mPosition`, eixo de direção) são vinculadas aos nós da suspensão. Quando o reticulado desliga, se uma
roda saiu mais de 1 cm ou 1° do lugar, `rebuildVehicle` recria a constraint com a geometria nova: o carro puxa para um lado porque a
roda está torta, não porque um número mandou. Roda arrancada: recriar sem ela; o canto cai sobre o casco do cubo e raspa (faísca pelas
linhas de contato). Pneu furado: recriar com o raio do aro (mudar `mRadius` em tempo de execução não foi verificado; recriar é o seguro).

### 7.7 Regra de sono (T6.3)

O carro dorme quando: chassi abaixo do sono do mundo (0,08 m/s), toda roda com `|ω| < 0,5 rad/s`, entrada zero, reticulado desligado. Roda
no ar girando mantém acordado (`wake` a cada passo) até o amortecimento da roda pará-la. Aceite da T6.3 (≤ 3 s parado; ≤ 7 s depois de
meio-fio a 60 km/h) continua.

### 7.8 Atropelar pedestres e zumbis (spec 008, E2)

- **Hoje o contato existe e está errado**: `LAYER_PAIRS` tem `['vehicle', 'agent']` (`game-physics/src/index.ts:40-47`), e o agente é cápsula
  **cinemática**: para o Jolt, massa infinita. Um zumbi pararia um caminhão como uma parede. **Decisão**: tirar o par `vehicle`–`agent`.
- **Consulta na fase `actors`**, por veículo andando acima de 1 m/s: varredura da caixa do veículo pelo deslocamento do passo contra a camada
  `agent` (broadphase do motor). Cada agente achado sai da simulação do `game-crowd` e é tratado pelas regras que já existem
  (`RunOverRules` de `arcade.ts`: empurrar abaixo de `knockSpeed`, derrubar, matar acima de `killSpeed`): derrubado ou morto vira **ragdoll**
  (fase 5) com o impulso da batida (velocidade do veículo no ponto, pela razão de massas); o **impulso de reação** vai para o carro
  (`addImpulse` no ponto), e o arrasto de horda (`holdDrag`) quando empurra.
- **O testador das rodas ignora agentes e ragdolls** (camada própria, 6.4): roda não sobe em zumbi como degrau nem em ragdoll como rampa; o
  corpo passa por baixo e o ragdoll colide com os cascos (camada `ragdoll` encontra `vehicle`).
- Carro estacionado é **obstáculo do `game-crowd`** (navegação), não contato: agente nenhum empurra carro.

## 8. O que o reticulado substitui e o que fica (§7: "camada nova não substitui a antiga sem provar o mesmo comportamento") — **vai para a spec 009**

| O que a camada antiga faz (`crashVehicle` + `crumple`) | Com o reticulado | Teste que prova |
|---|---|---|
| Δv pelas massas (o mais leve leva mais) | o Jolt troca o momento entre os cascos | carro de 1 300 kg contra caminhão de 12 t: Δv do carro ≥ 9× o do caminhão |
| 30% da energia vira dano nas peças | dano da parte = deformação plástica das vigas dela (`beamPart`) mapeada para `hp` | soma do dano bate com a energia dissipada (±25%) |
| contato largo amassa por igual, estreito vai fundo | sai da mancha de contato e das longarinas | parede: recuo uniforme ±10 cm; poste: recuo no centro ≥ 1,5× o da parede, faixa ≤ 0,5 m |
| para-choque leva primeiro, capô depois (linhas 0 e 0,3 m) | geometria: o para-choque está na frente | ordem de dano no tempo: para-choque antes do capô |
| recuo ≤ 0,6 m, 0,035 m por m/s | longarina escoa | 50 km/h na parede: 0,40–0,70 m na frente, intrusão na cabine < 10 cm |
| peças soltam por desgaste da junta | viga `mount` quebrada → `wear` da junta do kit → `detach` | para-choque e retrovisor arrancados em 50 km/h com parede, nas mesmas condições de hoje |
| marca é filha da peça (§7) | o skinning move o vértice dentro da própria malha da peça | teste de aceitação da frota (seção 18) |

`crashVehicle` e `crumple` **ficam** como caminho do carro sem vaga (seção 15.3), do solver próprio até a T8.1, e como amassado aproximado de
longe. Não são apagados.

## 9. A malha desenhada segue o reticulado (flexbody) — **vai para a spec 009**

- **Vínculo**: cada vértice das malhas deformáveis da peça (casca, painéis, vidro) liga aos 4 nós mais próximos **da mesma peça ou da
  estrutura vizinha**, com peso pelo inverso da distância, no repouso. Peças rígidas (banco, bloco, bateria, roda) ligam a **um** nó de
  montagem e andam como corpo rígido. Custo do vínculo ~20–50 ms por carro (estimado, grade de busca): feito em fila com orçamento quando o
  carro entra no raio das vagas (como o `collidersPending` da T3.0b), nunca no quadro da batida.
- **Deslocamento aditivo**: o vértice recebe `Δ = desl_novo − desl_último` somado à posição atual. Assim o amassado do `kit.impact` e do
  `zone-dent` (tiro, golpe de taco) continua por cima, e os dois comutam. Malha que o `zone-dent` subdividiu (geometria nova, `version`
  mudou) é revinculada só naquela malha, como `createVehicleColliders` já detecta.
- **Só os vértices sujos**: os ligados a nós que andaram mais de 1 mm desde o último quadro. Desenho no ritmo do quadro, não do reticulado.
- **Envio à GPU**: atributo de posição com `DynamicDrawUsage` (three r160, `BufferAttribute.setUsage`) e `addUpdateRange` só no trecho sujo,
  para não reenviar a malha inteira; o kit ainda não usa nenhum dos dois em veículos (grep em `game-vehicles*/src`).
- **Normais** pela fila existente (`crease-queue.ts`, `DEFERRED_QUEUE_ID.VEHICLE_CREASE`); índice de triângulos do `surfaceRay` tocado
  pelo `touchTriIndex` (`tri-index.ts`).
- **Placa e peças marcadas rígidas** (`context.ts:181`: "the plate is rigid") andam rígidas com o seu nó.
- **Custo escondido**: um sedã tem ~230 000 triângulos desenhados (evidência T3.0b). Skinning de todos os vértices por quadro custaria mais
  que o próprio reticulado; por isso só os sujos e só as malhas deformáveis.

## 10. Cascos convexos: construção, reconstrução e o novo aceite

### 10.1 Construção (método B, decisão do dono em 2026-11-26, proposta do `architect`)

Porta a montagem incremental da T3.0b (`createVehicleColliders`: triângulos de cada malha por parte × célula de 0,8 m, estável por chave,
refaz só o que mudou): no lugar dos triângulos, **cada pedaço da T3.0b (peça × célula) vira um casco convexo** dos seus vértices desenhados,
com no máximo 64 pontos por `reducePoints` (que sempre inclui o extremo de cada uma das 26 direções) e raio convexo 0
(`mMaxConvexRadius = 0`, para não inchar).

- **Peça sólida** (`SOLID_ROLES` menos as rodas: lâmpada, retrovisor, motor, radiador, tanque, cárter, bateria, alternador, câmbio, direção,
  engate) é **um casco inteiro**, de todos os pedaços dela.
- **Roda, pneu, freio e amortecedor ficam fora do composto do chassi**: a roda é do `VehicleConstraint` (T6.1b; o adaptador monta o chassi só
  com os cascos que recebe e as rodas só pelos descritores de roda).
- **Pedaço plano** (mais fino que 2 × `FLAT_PAD` ao longo da normal) ganha 2,5 mm (`FLAT_PAD`, `vehicle-hulls.ts`; a metade do `MIN_HALF` de 5 mm de `collider-fit.ts`) de cada lado: um casco sem
  volume não é forma. Os pontos copiados são os únicos que não são vértices desenhados.
- **Sem extrusão para dentro e sem corte por concavidade** (saem a célula de 1,6 m cortada por 3 cm/1 cm, a extrusão de 3 cm e o corte pelo
  vão da primeira versão da T6.4).
- **Saliências finas saem do pedaço** (decisão do dono em 2026-11-26; `hull-split.ts`). Uma saliência é fina (antena, limpador, haste de
  maçaneta, estribo) quando o casco dela tem no máximo 200 cm³ (`THIN_VOLUME`) e ela passa do corpo do pedaço em mais de 3 cm
  (`PROTRUSION_REACH`), de um destes dois jeitos: (a) é uma parte conectada do pedaço (cantos soldados a 0,1 mm) de seção fina (os dois
  lados menores da caixa ≤ 8 cm) que passa da caixa do que não é fino; (b) está soldada ao corpo e seus triângulos são a **cauda** do
  pedaço (centro a mais de 3 cm além do ponto que guarda 99% da área, em qualquer dos seis eixos). A saliência só sai se ela **esticar** o
  casco do resto em mais de 40 cm² de superfície flutuante (`FLOATING_AREA`). Ganha o casco dela (chave `peça#célula~n`, n = o primeiro
  triângulo) e **não estica o casco do corpo**. A peça que já é própria (retrovisor, farol, motor: peça sólida) segue com o casco dela.
  O K2 vale por casco, contra os vértices de que ele saiu: o extremo da peça continua o desenhado.
- **Divisão adaptativa** (`hull-plan.ts`): cada pedaço começa com um casco; enquanto algum casco ainda flutua mais de 40 cm² (K3 local:
  amostras das faces do casco sem nenhum triângulo desenhado do pedaço a menos de 5 cm, `hull-excess.ts`), o que mais flutua (empate:
  o primeiro da lista) primeiro devolve as saliências que o esticam e depois é cortado **ao meio do maior lado** (a caixa dos centros dos
  triângulos), até nenhum passar, nenhum poder ser cortado (< 5 cm) ou o modelo chegar ao teto da classe do K7 (`maxHulls`; as peças
  sólidas contam). **O carro intacto congela o plano** (os cortes e as saliências tiradas, por pedaço); no dano, o pedaço refaz os mesmos
  cortes sobre os vértices novos e as alças (chaves) ficam as mesmas.

Casco é a peça **fina** (painel, assoalho, teto, vidro), nunca o volume da cabine: o interior fica oco e um banco solto cai sobre o assoalho
e sai pela porta que não está mais lá (seção 11).

### 10.2 Reconstrução depois de deformar (reconstrução sustentada durante o esmagamento: **vai para a spec 009**; na 008, uma reconstrução
depois que o amassado de nível 2 assenta, com a regra da 10.5)

- Os pontos de cada casco são vinculados aos nós (como os vértices). Durante a batida, casco cujos pontos andaram mais de 1 cm desde a
  última construção entra na fila.
- **Cadência**: no máximo 8 cascos por carro por passo fixo; todo casco sujo refeito em até 4 passos (30 Hz); uma última vez ao desligar.
- **Custo** (não medido): `ConvexHullShapeSettings.Create` de 64 pontos estimado em 20–60 µs no wasm. **Sustentado durante o esmagamento**
  (revisão): 8 cascos × ~40 µs × 2 passos por quadro ≈ **0,64 ms por quadro por carro**, mais o *narrowphase* composto contra composto do Jolt
  (não medido). `ModifyShape` no composto mutável e `NotifyShapeChanged` sem recalcular massa.
- **Pontos dos cascos vêm do estado `Float64` do reticulado** (ou do que foi salvo), nunca dos deslocamentos `Float32` do desenho: o casco
  é física e entra no determinismo (17).
- O carro que nasce enche os cascos em fila (~40 cascos × 40 µs ≈ 1,6 ms, espalhados por alguns quadros): some o 1,5 s da T3.0b.

### 10.3 Novo aceite K1–K7 (decisão do dono em 2026-11-26; substitui H1–H6 e a regra de 1 cm da T3.0b para veículos)

A regra de 1 cm da T3.0b media triângulos de colisão contra triângulos desenhados. Com cascos convexos, "a menos de 1 cm" não serve: o casco
de uma porta curva preenche o espaço entre a curva e a corda, que fica **dentro** do carro. E "cobrir X% do volume" também não serve para
chapa: um painel de 1 mm não tem volume. O rodador é o de `tests/vehicle-hulls-support.ts`: 26 direções, grade de 5 cm, mapa de profundidade
de 1 cm; a "esfera" é o primeiro toque de uma bola de r = 10 cm sobre esse mapa. Vale nos 69 modelos.

| # | Regra | Valor |
|---|---|---|
| K1 | O tiro acerta o desenhado (`surfaceRay`); o casco só acha candidatos | sempre |
| K2 | Encosto exato: para cada peça e cada uma das 26 direções, o extremo dos cascos dela é o extremo dos vértices desenhados dela | ≤ 1 mm (o casco de um pedaço plano pode passar os 2,5 mm do `FLAT_PAD`) |
| K3 | §12: nenhuma esfera toca casco sem tocar o desenhado com raio r + 3 cm | catraca por grupo, só diminui (10.3.1; a regra pede 0) |
| K4 | Excesso para fora: esferas com o casco mais de 3 cm à frente do desenhado, relatadas por grupo (de baixo, de cima, lateral) | ≤ o medido na frota no merge, e só pode diminuir (catraca gravada, como a do §13) |
| K5 | Não afunda: esferas com o casco mais de 5 cm atrás do desenhado, ou sem casco | ≤ 1% por modelo |
| K6 | Peça sólida: um casco, só de vértices desenhados; rodas fora do chassi | teste |
| K7 | Teto: ≤ 64 pontos por casco; moto 64, carro/SUV/picape/van 256, `heavy` 384, as demais classes medidas; construção do modelo ≤ 100 ms em Node (faixa de custo); 12 modelos distintos ≤ 64 MB | teste |

**H1–H6 ficam substituídos** (histórico, não apagado): H1 virou K1; H2 (≤ 1 cm para fora) e H3 (≥ 95% de cobertura entre 3 cm antes e 1 cm
depois) viraram K3, K4 e K5 por esfera, porque o raio de 5 cm do desenho media saliência fina e não o que um objeto do tamanho de um punho
encontra; H4 (nenhum casco sem desenho) virou K3; H5 (volume de peça sólida) virou K6; H6 (teto) virou K7. A primeira versão da T6.4 (corte por
concavidade, 1 172 a 1 401 cascos por carro) não passava H2 e H3 e pesava 83 MB nos 12 modelos da T6.21: ver `evidence.md` `## T6.4`.

**Tetos antigos (H6, estimativa da T3.0b, e a medida da primeira versão):** moto e bicicleta 32 (medido 200) · carro, SUV, picape, van 96
(medido 1 450) · caminhão 160 · ônibus 192 (medido 2 000) · trator 96 · blindado 96 · avião leve 128 · helicóptero 96 · barco 64–192. Os
tetos do método B (K7) são medidos na T6.4, `evidence.md` `## T6.4`, "Método B".

#### 10.3.1 Exceção ao §12 para o K3 (decisão do dono em 2026-11-26)

O §12 do kit ("nada colide sem desenho") pede 0. Para veículo, **dentro dos tetos de casco do K7**, o casco convexo de uma peça côncava pode
encostar em esferas que não tocam o desenhado, **por grupo de direção** (de baixo, de cima, lateral) e **só diminuindo**: a catraca é
`tests/fixtures/hull-floating-ledger.json` (esferas por modelo e por grupo, o mesmo formato da do K4, baixada com `UPDATE_HULL_EXCESS=1`,
nunca subida). Medido na T6.4 depois das saliências e da divisão (parte das esferas que tocam o desenhado, em todas as direções; o
pior modelo de cada classe; `evidence.md` `## T6.4`, "Saliências e divisão"):

| Classe | de cima | de baixo | lateral |
|---|---|---|---|
| carro | até 6,7% | até 9,4% | até 3,3% |
| SUV | 8,2% | 10,4% | 3,4% |
| picape | 10,4% | 21,0% | 9,5% |
| van | 6,3% | 7,8% | 3,0% |
| `heavy` | 11,5% | 15,0% | 7,0% |
| moto e bicicleta | 9,0% | 8,6% | 6,0% |
| trator | 7,0% | 14,6% | 9,8% |
| militar | 8,4% | 12,7% | 6,4% |
| aéreo | 7,4% | 8,6% | 4,6% |
| barco | 14,3% | 10,6% | 16,0% |

Sem o teto de casco o mesmo algoritmo leva o `family_hatch` a 1,1% (1 678 cascos): **o que sobra do K3 é o preço do teto do K7**, não do
método. Quem quiser menos esfera flutuando sobe o teto da classe (decisão do dono) ou reduz o desenho (menos vincos e nervuras).

A T6.0b mede o custo de contato e de `LinearCast` de um `MutableCompoundShape` com 96 e 192 filhos (a forma mutável **não tem árvore**: o
teste de contato é linear nos filhos); se pesar, o composto volta a ser `StaticCompoundShape` (com árvore) assim que o carro assenta, e o
mutável só existe durante a batida.

### 10.4 Carro estacionado: guardas (D3)

- **Cópia na escrita**: todos os carros intactos do mesmo modelo e estado dividem **o mesmo** composto imutável (forma do Jolt com contagem de
  referência; uma por modelo). Um carro ganha o seu `MutableCompoundShape` só no **primeiro dano**.
- **Memória** (medido na T6.21: 5,46 KB por casco de 64 pontos no pior caso; a cópia do dano de 20 carros custou 0,11 MB, o Jolt copia a lista de filhos e não os cascos): estimativa de ~250 KB por carro com cascos próprios; 200 carros sem compartilhar = ~50 MB, 39% do heap fixo de 128 MB (o C9 limita
  o pico a 50%). Teste de heap com **200 carros estacionados** (compartilhados, mais 20 danificados) exige pico ≤ 64 MB e volta ao mesmo byte.
- **Sem `VehicleConstraint` estacionado**: entra preguiçosa por `rebuildVehicle` quando alguém dirige ou o trânsito ativa o carro.
- **Nenhum agente encontra carro** (7.8): o par `vehicle`–`agent` sai; o carro é obstáculo de navegação do `game-crowd`.
- **Variante do B6**: cascata de 500 com 20 carros estacionados dentro da ilha do blast; mesmo aceite do B6.
- **Filhos por alça**: `tag` ou alça estável; `RemoveShape` desloca os índices seguintes (`types.d.ts:1147`).

### 10.5 Cascos contra contatos que estão acontecendo

Enquanto a parte de um casco toca algo (o `tag` aparece nos pontos de contato do passo), a reconstrução pode mover os pontos **para dentro**
livremente e **para fora** no máximo o *slop* de penetração (2 mm, `KIT_WORLD`); o resto do movimento para fora espera o contato acabar.
A regra vale por pedaço (um casco por pedaço, método B). Assim
um casco refeito não empurra o que está encostado (energia criada). Teste com a régua do C1: carro amassado encostado numa parede, cascos
refeitos, energia da ilha não sobe mais que `m·g·1 mm`.

## 11. Peças que soltam e o interior

- **Enquanto inteira, a peça é filha do composto do chassi**, sem junta do Jolt. Vinte corpos ligados por juntas por carro, vezes dezenas de
  carros, seriam caros e tremeriam (razão de massa porta/chassi ~1:50 numa corrente de juntas).
- **Promoção**: quando a junta do kit cede (`wear` por viga `mount` quebrada, golpe, ferramenta) ou a porta abre, o casco sai do composto
  (`setChildShape(handle, null)`) e a peça vira corpo próprio no mesmo lugar, com a velocidade do chassi naquele ponto mais (na 009) a dos
  seus nós, **limitada a 1,5× a velocidade de aproximação** (4.2). A `Object3D` da peça passa a seguir o corpo (com `alpha`).
- **Contabilidade de massa**: a massa, a inércia (eixos paralelos) e a contribuição ao centro de massa da peça saem do chassi no mesmo passo
  (`setMassProperties`, 6.4). Sem isso, o carro sem porta continuaria pesando a porta e o corpo da porta pesaria em dobro. Isso **substitui** o `fling` do kit no modo Jolt (o `fling` fica no modo próprio).
- **Pendurada**: dobradiça ainda inteira (porta aberta, capô que levantou, para-choque solto de um lado como o `hangBumper` faz hoje) = junta
  `hinge` do Jolt com limite e `breakImpulse` (já no contrato e em `joints.ts`). Quebrou → corpo livre.
- **Roda**: corpo cilíndrico; o veículo é recriado sem ela (7.6).
- **Interior** (bancos, bateria, bloco do motor, itens do porta-malas; **vai para a spec 009**): filhos do composto enquanto presos; parafuso do kit gasto → corpo
  solto **dentro** da casca oca (10.1), apoiado no casco do assoalho. Sai quando a casca abre: vidro estilhaçado tira o casco do vidro, porta
  arrancada tira o da porta. Itens do catálogo (`game-items`) dentro do carro entram pelo mesmo caminho.
- **O que o desenho mostra junto sai junto** (§7): a porta leva pele, forro, borda, vidro, borracha e maçaneta (já regra de `detach`).
- **Corpo pequeno e rápido**: `LinearCast`, para não atravessar casco fino.

## 12. Fogo e explosão: só pelas regras do kit — entradas novas **vão para a spec 009**

Nada de "explode no fim". O que muda é só de onde vêm as entradas das regras que já existem (`IgnitionRules`, vazamento por furo abaixo do
nível, faísca, fogo perto, blast, temperatura do tanque):

| Entrada nova | De onde |
|---|---|
| tanque rompido → `leak` (vaza, **não** acende sozinho) | vigas do tanque com deformação plástica acima do limite da classe |
| faísca de raspagem | linha de contato de casco de aço/alumínio contra chão ou parede com velocidade de deslizamento > 3 m/s |
| curto da bateria | bateria esmagada (vigas dela) → fonte de faísca no `fireNear` |
| fluidos (óleo, arrefecimento) | cárter e radiador esmagados → `leak` (já existe por furo) |

Teste (seção 18): 200 batidas sorteadas entre 30 e 120 km/h → **zero** explosões sem tanque rompido **e** fonte de ignição; nenhuma batida
de 50 km/h na parede explode. O tanque de gasolina só explode por temperatura ou blast, como hoje.

## 13. Tiro

O tiro não passa pelo motor: raio contra a malha desenhada exata (`surfaceRay`, `DestructibleImpl`). O Jolt só dá candidatos
(`rayAll` com `(user, tag)`, T7.2), com a caixa da parte alargada de 3 cm (a tolerância de H3: o casco pode estar até 3 cm para dentro).
Depois de deformar, a malha desenhada **é** a deformada: o furo cai onde se vê. Marca é filha da peça e anda com ela (o skinning move os
vértices da própria malha; a peça solta leva as marcas).

## 14. Classes da frota e a regra de tamanho

### 14.0 Tabela das classes (único lugar; o orçamento da seção 15 aponta para cá)

Custo e "quantos batem" pela estimativa B revista (seção 15.1: reticulado + 0,74 ms de cascos refeitos e *narrowphase*), camada cheia,
contados em 1,5 ms de física como referência (o aceite é a linha composta da 15.4). **Estimativas até a T6.0 e a T6.0b.** Reticulado, reboque,
ônibus, avião, helicóptero e barco: **spec 009**.

| Classe (frota) | Controlador | Reticulado (nós / vigas, espaçamento, frequência) | Peças que soltam | Ocupantes (14.7) | ms por veículo batendo (física) | Quantos batem em cheio ao mesmo tempo |
|---|---|---|---|---|---|---|
| **Carro**, SUV, picape, van | `wheeled` do Jolt (7) | sim: 300 / 1 500, ~0,25 m, 480 Hz | portas, capô, tampa, para-choques, paralamas, retrovisores, faróis, rodas, bateria, bancos, bloco, itens | ejetados pela abertura acima do limiar | ~1,1 | 1 |
| **Moto**, scooter, quadriciclo | `motorcycle` do Jolt (quadriciclo: `wheeled`) | **não**: peças rígidas + juntas do kit + deformação de peça (garfo dobra, aro empena) | carenagem, para-lamas, retrovisores, guidão, rodas, tanque, escape, banco | piloto **sempre** lançado na queda ou batida | ~0,03 | todas (o limite é o de ragdolls, 20) |
| **Bicicleta** | `motorcycle` com "motor" de pedal (14.2) | **não**: aro empena, quadro dobra por deformação de peça | rodas, guidão, banco, corrente | ciclista sempre lançado | ~0,02 | todas (limite de ragdolls) |
| **Caminhão** (baú, tanque, blindado de transporte) | `wheeled` multi-eixo; reboque = segundo veículo sem torque no engate (14.3) | sim, só na cabine e no chassi: 400 / 2 000, ~0,5 m, 240 Hz; baú e reboque em seções | portas, capô, para-choque, rodas, tanque, baú, carga, engate, reboque | ejetados pela abertura | ~1,0 | 1 |
| **Ônibus** | `wheeled` multi-eixo, corpo longo | seções (2–3) + reticulado grosso ≤ 400 / 2 000, ~0,6 m, 240 Hz | portas, vidros (todos peça de vidro), para-choques, rodas, bancos, bagageiro | passageiros: ragdoll quem cai ou é ejetado, o resto multidão (14.7) | ~1,0 | 1 |
| **Trator** | `wheeled`, rodas traseiras grandes, lento | sim, pequeno: 200 / 1 000, ~0,3 m, 480 Hz (capô, para-lamas, arco de proteção) | implementos (engate de 3 pontos), rodas, para-lamas, capô, cabine/arco | condutor de cabine aberta lançado na capotagem | ~0,9 | 1 |
| **Blindado** `III`+ (tanque, APC, carro blindado) | `tracked` (esteira) ou `wheeled` | **não** na blindagem; amassado aproximado | caixas externas, para-lamas, antenas, esteira (quebra) | não são ejetados (casco fechado) | ~0,05 | todas |
| **Avião** (leve, agrícola, treinador, turbo-hélice, jato leve) | voo por superfície (14.4) + trem de pouso `wheeled` | leve: 250 / 1 300, ~0,3 m, 480 Hz; turbo-hélice e jato: seções + ≤ 400, 240 Hz; modo desmonte em alta energia | asas, empenagem, hélice, trem, portas, canopi | ejetados pela fuselagem aberta | ~1,0 / ~1,0 | 1 |
| **Helicóptero** | rotor (14.5) + esquis ou trem `wheeled` | 200 / 1 000, ~0,3 m, 480 Hz | rotor principal, pás, rotor de cauda, cone de cauda, esquis, portas | ejetados pela abertura | ~0,9 | 1 |
| **Barco** pequeno (bote, lancha, jet ski, veleiro, pesqueiro) | água: empuxo + hélice/vela (14.6) | 150 / 700, ~0,25 m, 480 Hz (fibra quebra cedo) | motor de popa, para-brisa, mastro, toldo, assentos | caem na água (ragdoll que boia) | ~0,8 | 1 |
| **Barco grande** (`patrol_boat`) e navio (fora da frota) | água, compartimentos | seções (2–6) + ≤ 300 / 1 500, 240 Hz; navio só seções | seções do casco, superestrutura, mastro | caem na água | ~0,8 | 1 |

Andando ou parados, todos ficam no orçamento do C7 de veículos; parado dormindo custa ~0.

### 14.1 Genérico e por classe (§2)

| Genérico (`game-physics`, `game-deform`, `game-vehicles`, `game-vehicles-three`) | Por classe (dados em `game-vehicles-fleet`; controlador por tipo de veículo) |
|---|---|
| corpo, cascos, composto mutável, observar contatos, vagas de batida, skinning, promoção de peça, fogo pelas regras, reticulado XPBD, gerador de reticulado a partir de peças e `meta`, regra de tamanho | classes de viga e alvos de calibração; controlador (`wheeled`, `motorcycle`, `tracked`, voo, água); superfícies de sustentação; compartimentos; seções de casco grande; limites de carga |

### 14.2 Moto e bicicleta

- **Equilíbrio e inclinação**: o `MotorcycleController` está exposto no 1.1.1 (verificado, `types.d.ts` 4246–4272: `mMaxLeanAngle`,
  `mLeanSpringConstant`, `mLeanSpringDamping`, `mLeanSpringIntegrationCoefficient`, `mLeanSmoothingFactor`, `EnableLeanController`,
  `GetWheelBase`). Ele inclina a moto para a curva por mola sobre o ângulo que a velocidade e o raio pedem. Abaixo de ~1 m/s a mola não segura
  (moto parada cai): com piloto, regra do kit "pé no chão" (mola de endireitar no chassi, fase `actors`); sem piloto, descanso lateral = casco
  do descanso no composto, e a moto dorme apoiada nele.
- **Sem reticulado** (D11). Moto amassa pouco e quebra muito: carenagem de plástico racha e solta, garfo dobra, aro empena, guidão torce. Isso é
  **deformação de peça**: a peça gira em torno do seu ponto de montagem (garfo na caixa de direção, guidão na mesa) por um ângulo do impulso
  recebido acima do limite da classe, e o aro ganha empeno (deslocamento senoidal no plano da roda, só no desenho, mais vibração na roda pelo
  raio efetivo). Roda empenada além do limite → roda recriada com atrito menor; garfo dobrado → `rebuildVehicle` com a roda dianteira fora do
  eixo (a moto puxa). Peças soltam pelo caminho da seção 11.
- **Bicicleta**: igual à moto, leve (10–15 kg) e movida a pedal: o "motor" é o ciclista (`mMaxTorque` no pedivela da potência sustentada,
  150–400 W, curva de torque plana por cadência, marchas da bicicleta, sem lenta: `mMinRPM` 0). Aro empena e quadro dobra pela deformação de
  peça; sem reticulado. Cansaço do ciclista vem do `game-player` (fôlego), não da física.
- **Piloto e ciclista**: sentados fazem parte da pose do veículo (inclinam junto, primeira e terceira pessoa iguais, memória do dono); na queda
  ou batida viram ragdoll pela regra 14.7, **sem precisar de abertura**.

### 14.3 Caminhão, ônibus, trator e blindado

**Caminhão** (reboque e carga: **vão para a spec 009**)

- **Cavalo e reboque são dois veículos do Jolt**, dois corpos, ligados no engate por uma junta `swingTwist` (quinta roda: giro livre em torno
  do pino vertical até ±90°, pouco giro nos outros eixos) com `breakImpulse`. O reboque tem o próprio `VehicleConstraint` com rodas e freio e
  sem torque de motor (controlador com `mMaxTorque` 0 e sem diferencial). **Não verificado**: se o Jolt aceita controlador de rodas sem
  diferencial e dois veículos ligados por junta sem tremor; a 009-m testa antes de tudo. O **L** (jackknife) não é roteiro: sai da dinâmica
  quando o cavalo freia e o reboque empurra; a junta no limite é o L, e o engate quebra se o impulso passar o limite.
- **Vários eixos**: rodas listadas por eixo (esquerda, direita), diferencial por eixo motriz, eixos em tandem dividem a carga pela suspensão;
  só o dianteiro esterça. `wheelContacts`/`vehicleWheels` contam todas as rodas (3.4).
- **Carga**: cada volume (caixa, palete, tambor, item do catálogo) é filho do composto do baú ou da carroceria enquanto amarrado (cinta = junta do
  kit). Quando a cinta cede, a porta do baú abre ou o reboque tomba, o volume vira corpo (camada `prop`) e se espalha; acima de 40 volumes, os 40 de
  cima viram corpos e o resto fica como monte no reboque (orçamento de acordados, condição 10). Tanque: compartimentos com o líquido do
  `game-fluids` (combustível, água), vazamento pelas regras de sempre.
- **Reticulado pesado**: só cabine e chassi (longarinas da escada), ~0,5 m entre nós, 240 Hz; baú e reboque em seções com o amassado aproximado.

**Ônibus** (**vai para a spec 009**)

- **Corpo longo** (> 12 m): seções (frente, meio, traseira) e reticulado grosso ≤ 400 nós, ~0,6 m, 240 Hz (regra 14.8).
- **Todo vidro é peça de vidro** (§7): cada janela tem casco próprio (H1–H6) e quebra sem dobrar; quebrada, abre passagem (ejeção e saída).
- **Teto na capotagem**: entre cada janela há uma coluna (classe `pillar`), e o contorno do teto é classe `roof`. Referência de aceite: o
  ensaio de capotagem de ônibus da ONU (UN ECE R66: tombar de uma plataforma de 0,8 m e conferir o espaço de sobrevivência); o teste da 009-j
  tomba o ônibus de 0,8 m e mede quanto o teto entra.
- **Passageiros**: regra 14.7. Quem está em pé cai dentro do ônibus com Δv > 3 m/s; ragdolls limitados pelo orçamento de ragdolls (C7: 20),
  dando prioridade aos mais perto do jogador; os demais ficam como agentes do `game-crowd` ou corpos-corrente (regra da pilha, T5.3). Ao sair vivos,
  voltam a ser agentes da multidão.

**Trator**

- Rodas traseiras grandes e dianteiras pequenas (o mapa usa o raio de cada roda), velocidade baixa (≤ 40 km/h; marchas curtas, torque alto),
  centro de massa alto.
- **Implementos** (spec 009) (arado, grade, carreta) no engate de 3 pontos: junta `fixed` (implemento erguido) ou `hinge` (carreta) com `breakImpulse`;
  quebrou → implemento solto como corpo. Implemento erguido muda o centro de massa do conjunto.
- **Capotagem**: lateral em rampa e para trás quando a tração levanta a frente; o arco de proteção (classe `pillar` rígida) segura; condutor de
  cabine aberta é lançado (14.7).
- Peças de ferro fundido (carcaça do motor e câmbio) quebram em vez de dobrar (`cast_iron`, `fracture: snap`).

**Blindado** (`battle_tank`, `apc_6x6`, `armored_car_6x6`): `TrackedVehicleController` para esteira; **sem reticulado** na blindagem `III`+
(blindagem não dobra numa batida de rua: só o amassado aproximado e o dano balístico de hoje). Peças externas soltam pelo caminho normal.

### 14.4 Avião — **vai para a spec 009**

- **Modelo de voo** (novo; não existe no kit): por passo fixo, na fase `actors`, cada superfície (meia-asa, empenagem horizontal, vertical,
  aileron, profundor, leme) dá sustentação e arrasto pela sua área, ângulo de ataque local e curva `CL(α)`, `CD(α)` (tabelas, com estol),
  aplicados com `addImpulse(F·h, ponto da superfície)`. Empuxo da hélice/turbina no eixo do motor. Trem de pouso = veículo de rodas do
  Jolt sem torque de motor (freio e direção na bequilha). Anfíbio: flutuação da 14.6. **Merece desenho próprio** (009-o, D7).
- **Batida**: asas, cauda e hélice são filhos do composto enquanto inteiros; viram corpos pelo mesmo caminho da seção 11. Quebra da
  asa em voo pelo **momento na raiz** calculado das forças aerodinâmicas aplicadas (fator de carga limite da classe × 1,5), sem reticulado.
  Hélice: disco fino como o do rotor (14.5).
- **Alta velocidade**: `LinearCast` sempre que acordado (100–200 m/s = 0,8–1,7 m por passo). Acima de uma energia específica de impacto
  (J/kg, por classe), **modo desmonte**: em vez do reticulado fino, as seções soltam, o combustível das asas vaza pelas regras e a fuselagem
  usa o reticulado grosso da regra 14.8. Reticulado fino nesse caso só gastaria vaga para chegar ao mesmo destroço.
- **Tamanho**: avião leve ≤ 250 nós; `regional_turboprop` e `light_jet` com seções (fuselagem em 2–3, asas, cauda) e reticulado
  grosso ≤ 400 nós no total.

### 14.5 Helicóptero — **vai para a spec 009**

- **Rotor como forças por passo fixo** (fase `actors`, `addImpulse(F·h, ponto)`), com o giro do rotor `Ω` como estado do kit:
  - empuxo no cubo, ao longo do mastro inclinado pelo cíclico (±8°): `T = k_T · coletivo_efetivo · Ω²`, com o coletivo efetivo reduzido pelo
    fluxo induzido e pela velocidade vertical; efeito solo até um diâmetro do rotor;
  - cíclico inclina `T` e dá o momento de arfagem e rolagem no cubo;
  - torque de reação `Q = P_aero / Ω` no mastro, contrário ao giro: sem rotor de cauda o helicóptero gira;
  - rotor de cauda: empuxo lateral no braço da cauda pelo pedal, `T_cauda = k_c · pedal · Ω²`;
  - giro: `I_rotor · dΩ/dt = Q_motor − Q_aero`; o governador do motor segura `Ω` nominal.
- **Autorrotação**: motor parado (`Q_motor = 0`, por dano ao motor, combustível ou turbina; regras do kit). Com coletivo baixo e descendo, o ar
  que sobe pelo disco devolve torque ao rotor (`Q_aero` muda de sinal com a razão de descida, termo de descida no modelo de momento); o `Ω`
  se mantém e o arredondamento (coletivo alto perto do chão) troca a energia do rotor por sustentação e pousa. Sem arredondamento, a batida é
  na velocidade de descida; com `Ω` baixo demais, sem sustentação.
- **Rotor principal, pás e rotor de cauda como peças**: o rotor é filho do composto (disco = casco cilíndrico fino com `tag` próprio, que **não**
  gira: o giro é do desenho). Linha de contato no disco acima do limiar = **pá batendo**: as pás quebram (evento por pá), viram destroço lançado
  com a velocidade tangencial `Ω × r` (ferem quem estiver perto pelos golpes de destroço) e o empuxo cai com as pás que restam. Mastro além
  do limite → o rotor inteiro sai como corpo. Cone de cauda quebrado ou rotor de cauda perdido → sem anti-torque → o helicóptero gira em
  torno do mastro (consequência das forças, não roteiro).
- **Batida**: esquis como cascos (sem veículo de rodas) ou trem `wheeled` nos modelos com rodas; reticulado 200 nós (fuselagem de alumínio, os
  esquis absorvem). Combustível pelas regras de sempre.

### 14.6 Barco e navio — **vai para a spec 009**

- **Flutuação**: `ApplyBuoyancyImpulse` do Jolt (verificado, 3.1) contra o plano da água do `game-terrain` (`waterAt(x, z).level`), na fase
  `actors`, para todo corpo da camada `vehicle`/`debris` que toca água. Arrasto linear e angular pelo mesmo chamado; correnteza = 0.
- **Compartimentos que alagam** (método do peso adicionado): o casco é dividido em compartimentos por anteparas (dados da classe); cada um
  guarda o volume de água dentro. Furo abaixo da linha d'água (tiro: o furo já existe na peça do casco; batida: viga do casco rompida) enche
  por Torricelli `Q = Cd·A·√(2·g·h)`, com `h` a profundidade do furo. A água de cada compartimento pesa no centroide dele (`addImpulse`): o barco
  aderna, embica e afunda quando o peso passa o empuxo. Antepara que segura isola o resto. Isso fecha a pendência do doc de categorias (3.3).
- **Casco grande quebra em seções**, não em reticulado fino: do `patrol_boat` para cima, o casco é 2–6 seções (corpos ao quebrar, filhos do
  composto enquanto inteiro); a viga-navio (momento fletor da distribuição de empuxo contra peso, com alagamento desigual ou blast) decide a
  quebra, em conta pura no kit. Pele amassa pelo amassado aproximado.
- Fibra de vidro: classe de viga que quebra cedo (barco pequeno racha, não amassa).

### 14.7 Ocupantes: quando viram ragdoll (todas as classes) — **vai para a spec 009**

- **Sentado, o ocupante faz parte da pose do veículo** (anda e inclina junto; primeira e terceira pessoa iguais). Não é corpo no Jolt.
- **Ejeção** pela regra que já existe (`game-vehicles-driving/src/ejection.ts`, `DEFAULT_EJECTION`: Δv frontal ≥ 8,3 m/s, lateral ≥ 6 m/s,
  cinto que segura pelo `controls.ts`), com Δv agora medido no corpo do Jolt. Ejetado vira **ragdoll** (fase 5, T5.1) na pose do assento, com a
  velocidade do veículo **naquele ponto** (`v + ω × r`) vezes `keep` (0,8) mais o `lift` da regra.
- **Precisa de abertura** em veículo fechado (carro, caminhão, ônibus, avião, helicóptero): porta arrancada ou aberta, vidro estilhaçado, teto
  aberto. Sem abertura, o ocupante fica e se fere (o dano já vem do Δv); ninguém atravessa aço.
- **Sem abertura necessária** em moto, bicicleta, quadriciclo e trator de cabine aberta: piloto lançado quando a batida passa o limiar **ou** a
  moto passa a inclinação máxima sem contato das rodas (queda).
- **Em pé** (ônibus): com Δv > 3 m/s cai dentro do veículo como ragdoll.
- **Água**: quem cai na água vira ragdoll com flutuação (14.6), ou nada pelo `game-player`.
- **Limite**: o orçamento de ragdolls do C7 (20 a ≤ 3 ms). Passou disso, ganham ragdoll os mais perto do jogador e com maior Δv; os outros viram
  corpos-corrente ou cápsulas (regra da pilha, T5.3) e, vivos, agentes do `game-crowd`.

### 14.8 Regra de tamanho (nós e frequência escalam com tamanho e distância) — **vai para a spec 009**

- **Espaçamento** `s = max(s_min_classe, √(A_casca / N_max_classe))`, com `A_casca` a área da casca desenhada. Um navio ou avião de linha
  nunca roda densidade de carro: o teto de nós por classe manda e o espaçamento cresce.
- **Teto por classe e camada de distância** (resolução escolhida **na ativação** e fixa até desligar; trocar no meio da batida não vale):

| Camada | Distância ao jogador (estado da simulação, nunca a câmera do desenho) | Nós | Frequência |
|---|---|---|---|
| cheia | ≤ 30 m ou veículo do jogador | teto da classe | padrão da classe (480 Hz) |
| meia | 30–80 m | metade do teto | 240 Hz |
| longe | > 80 m ou sem vaga | 0: amassado aproximado | — |

- Acima de 12 m de comprimento ou 15 t: seções + reticulado grosso ≤ 400 nós, nunca acima de 240 Hz.

## 15. Orçamento do reticulado — **vai para a spec 009**

### 15.1 Frequência × custo × quantos batem (**estimativas, não medidas**, até a T6.0 rodar)

Frequências múltiplas do passo fixo de 1/120 (o reticulado roda inteiro dentro do passo): **1 920 / 960 / 480 / 240 Hz** no lugar de
2 000 / 1 000 / 500 / 250 (que não dividem o passo e dariam subpassos de tamanho variável). Quadro de 60 Hz: 32 / 16 / 8 / 4 subpassos.
Carro de referência: 300 nós, 1 500 vigas. Orçamento de física de 3 ms por quadro (número do coordenador). A "fatia de 1,5 ms" da primeira
versão era de papel e saiu (revisão): o aceite passa a ser uma **linha composta medida no C7** (15.4).

Duas estimativas do custo por subpasso por carro:

- **A (coordenador)**: 0,1 ms.
- **B (este desenho)**: ~0,05 ms. Razão: a sonda (3.2) deu ~0,1 ms por passo para 3 258 arestas × 5 iterações no wasm (~16 000 soluções de
  aresta, ~6 ns cada). XPBD de passos pequenos faz **uma** iteração por subpasso: 1 500 soluções; JS com `Float64Array` estimado em 3–4× o
  wasm (~20 ns) → ~30 µs, mais integração de 300 nós e teste de plasticidade → ~0,05 ms. Se a T6.0 mostrar que uma iteração não segura a
  rigidez e precisar de 2–3, B vira A.

Mais o custo fixo por carro batendo: reconstrução **sustentada** de cascos durante o esmagamento ~0,64 ms por quadro (10.2) e o
*narrowphase* composto contra composto (~0,1 ms, chute) → **+0,74 ms**; skinning dos vértices sujos 0,3–1,5 ms por quadro (desenho, fora dos
3 ms de física, mas no mesmo quadro; ver D15).

| Frequência | Subpassos / quadro 60 Hz | A: ms por carro (física, +0,74) | A: carros em 1,5 ms / em 3 ms | B: ms por carro (física, +0,74) | B: carros em 1,5 ms / em 3 ms |
|---|---|---|---|---|---|
| 1 920 Hz | 32 | 3,9 | 0 / 0 | 2,3 | 0 / 1 |
| 960 Hz | 16 | 2,3 | 0 / 1 | 1,5 | 1 / 2 |
| **480 Hz (padrão proposto)** | 8 | 1,5 | 1 / 2 | **1,1** | **1 / 2** |
| 240 Hz | 4 | 1,1 | 1 / 2 | 0,9 | 1 / 3 |

Com a reconstrução sustentada, um carro fica em ~1,0–1,2 ms: **1 carro por 1,5 ms**, não 2 como na primeira versão.

Desafio às contas do pedido: (a) 1 000 Hz ≈ 1,7 ms por carro só vale com 0,1 ms/subpasso; com uma iteração por subpasso deve ficar perto de
0,8–1 ms. (b) Mesmo no melhor caso, **o gargalo do quadro é o skinning, não o reticulado**: 5 carros batendo com 1 ms de skinning cada
estouram o quadro antes da física. Por isso o skinning só toca vértices sujos e conta no orçamento das vagas (15.3). (c) A 60 Hz de tela; a
144 Hz o custo por quadro cai (menos subpassos por quadro), o custo por segundo é o mesmo.

### 15.2 Por classe

Na tabela única da seção 14.0 (controlador, reticulado, densidade, frequência, peças, ocupantes, custo e quantos batem por classe), para não
manter duas tabelas que divergem.

### 15.3 Regra de cena: vagas de batida

1. **Reticulado cheio só em N vagas**: entram os veículos que batem com maior prioridade = energia do impacto × peso de proximidade **ao
   jogador** (estado da simulação; 1 dentro de 30 m, cai até 0 em 80 m), **nunca a câmera do desenho**; empate pelo id do veículo; o veículo
   do jogador sempre tem vaga quando bate.
2. **Batida longe ou sem vaga fica rígida**, com amassado aproximado pela energia do impacto (`crashVehicle` + `crumple` de hoje, na parte
   certa pelo `tag`). Barato e no lugar certo, só não segue a estrutura.
3. **O reticulado assume a partir do estado amassado** quando o veículo se aproxima e ganha vaga: cada nó lê o deslocamento médio dos
   vértices ligados a ele (o vínculo é feito no repouso original), e os `L0` viram os comprimentos atuais (estado deformado sem tensão).
4. **A vaga passa adiante** quando a batida assenta (regra de desligar, 4.3); a fila é por prioridade.
5. **N vem da qualidade escolhida** (cada qualidade fixa N e a frequência), e fica fixo na sessão. A medida de 1 s no boot **só sugere a
   qualidade padrão** por faixa de custo medido (AMD e máquinas fracas inclusas; memória do dono: "performance por faixa, não por marca"). Não há
   média móvel nem ajuste durante o jogo: isso tiraria o determinismo da sessão. Na qualidade mais baixa, N = 1 (a vaga do jogador) a 240 Hz.
6. **Atraso em vez de espiral**: no máximo 2× os subpassos nominais por quadro (16 a 480 Hz); se o quadro atrasar mais, o reticulado fica para
   trás (anda em câmera lenta só ele) em vez de roubar tempo de todos os quadros seguintes.
7. **Replays gravam N e cada decisão de vaga** (veículo, passo, concedida, negada, camada).
8. **Determinismo**: ver 17.2 e D2.

### 15.4 Linha composta do C7 (substitui a fatia de papel e o antigo D6)

Cenário medido na rodada diária (`perf-gate.mjs`, linha nova): **2 batidas com vaga + 5 ragdolls + 30 peças soltas + 10 carros andando + a
multidão de 1 000 agentes**, no mesmo quadro. Os orçamentos (mediana e p99) são fixados pelo dono depois da primeira medida, como os do C7.

## 16. Memória (§8)

- Reticulado: `Float64Array`/`Uint16Array` de um **pool** do `game-deform` por tamanho; ao desligar, devolve ao pool e fica só o deslocamento
  plástico por nó (`Float32Array`, 3,6 KB por carro de 300 nós) e o bit de viga quebrada.
- Vínculo de skinning (~24 bytes por vértice: 4 índices `Uint16` + 4 pesos `Float32`; ~2,4 MB num sedã inteiro): existe só enquanto o
  veículo tem vaga ou está na fila; liberado ao assentar (a geometria final fica gravada na malha). Por isso nunca vinculamos as malhas de
  interior (um nó, rígido).
- Cascos: `Shape` do Jolt com `Release` quando trocado; a fila de cascos esquece o veículo removido.
- Peça solta: corpo removido (`removeBody`) e `Object3D` passada por `discardObject3D`/`releaseObject3D` (`game-shapes-three`) quando o
  destroço some pelas regras de tempo de vida. Listas (vagas, filas de casco, de vínculo) esquecem o veículo descartado.
- Contrato: `heap.test.ts` ganha ciclos de criar → bater → assentar → descartar (heap do wasm no mesmo byte) e o teste dos **200 carros
  estacionados** (10.4); `leak.mjs` ganha a sonda da sala do veículo (à mão, §9).

## 17. Determinismo e `saveState`

### 17.1 O que já vale

Reticulado em TS, uma thread, ordem fixa (veículos por id, vigas por índice), só `sqrt`: dois processos com as mesmas entradas dão os mesmos
bytes. Soma de impulsos em ordem de índice de contato (o Jolt devolve em ordem determinística, C8).

### 17.2 O que quebra

**As vagas adaptativas mudam o resultado**: um carro com vaga deforma pelo reticulado, outro sem vaga pelo amassado aproximado; os cascos
ficam diferentes e a física seguinte também. Em duas máquinas de faixas diferentes, a mesma partida diverge. Proposta (D2):

- **N vem da qualidade** (15.3), fixo na sessão; a prioridade usa a distância ao jogador, nunca a câmera. Mesma qualidade e mesmas
  entradas → mesmo resultado, em qualquer máquina. Qualidades diferentes divergem: isso exclui lockstep (seção 2).
- **Replays** gravam N e cada decisão de vaga.
- **Cascos** saem do estado `Float64` do reticulado ou do que foi salvo, nunca dos deslocamentos `Float32` do desenho.
- **Emenda do C8 no `spec.md`** ("deformação de batida entre qualidades diferentes") é **task própria** (T6.20), não um parágrafo daqui.

### 17.3 Salvar

`saveState` do Jolt exige os mesmos corpos na mesma ordem (`arquitetura.md` §10). O host salva por veículo: deslocamento plástico por nó,
`L0` das vigas que escoaram, bits de vigas quebradas, peças promovidas (com pose e velocidade), juntas penduradas, e o `serialize()` do
destrutível. Ao carregar: refaz o reticulado, aplica o deslocamento, refaz a malha pelo skinning, refaz os cascos, recria os corpos das
peças soltas **na mesma ordem**, e só então restaura os bytes do mundo. Reticulado **ativo** no momento de salvar: salvar espera ele
desligar (≤ 1 s) ou grava posições e velocidades dos nós também (escolha da 009-h). **Não verificado**: se os amassados do `kit.impact`
voltam idênticos só pelo `serialize()` (ele grava `hp`, juntas e status; o campo de amassado vem dos eventos) — conferir na T6.9 (nível 2, spec 008) e na 009-h.

## 18. Plano de testes

Sem GPU nos commits (§9). Pacotes: `deform` = `game-deform`, `veh` = `game-vehicles`, `veh3` = `game-vehicles-three`, `drive` =
`game-vehicles-driving`, `fleet` = `game-vehicles-fleet`, `prov` = `game-vehicles-proving`, `jolt` = `game-physics-jolt`.

| Teste | Comando | O que prova |
|---|---|---|
| **Medida do reticulado (T6.0, à mão, máquina quieta)** | `node packages/game-deform/bench/lattice-bench.mjs --hz 1920,960,480,240 --nodes 60,150,300,400` | com distribuição de massa realista (nó do motor : nó de painel ≈ 300:1) e a entrada por plano (4.2): ms por subpasso e por quadro, 1 e 2 iterações, mediana e p99 de 9 rodadas, **erro de deformação e deriva**; preenche 15.1 e 14.0 |
| **Primeiro protótipo (T6.0b)** | `pnpm --filter @adatechnology/game-vehicles-three exec vitest run tests/crash-prototype.test.ts` | espião descartável (um arquivo, Jolt cru permitido): um carro, uma parede, cinco componentes; ms por etapa por quadro; dano que fica depois de parar; **critérios de seguir ou parar a 009 (E3)**: folga na parede ≤ 3 cm, nó ≤ 1,5× a aproximação, energia ≤ a que entrou, carro ≤ 1,2 ms de física a 480 Hz na faixa de referência, composto com 96 e 192 filhos medido |
| Reticulado elástico conserva energia | `pnpm --filter @adatechnology/game-deform test` | sem escoamento, energia ±1% em 2 s |
| Escoamento, encruamento, ruptura | idem | viga passa de `εy` e não volta; passa de `εb` e some; vidro quebra sem dobrar |
| Referencial flutuante | idem | impulsos auto-equilibrados → centro de massa e giro do reticulado parados (< 1e-9) |
| Determinismo do reticulado | idem | dois processos, mesmos bytes |
| Atropelar (7.8) | `pnpm --filter @adatechnology/game-vehicles-driving test` e `... game-physics-jolt exec vitest run tests/vehicle.test.ts` | carro a 40 km/h atravessa 20 agentes: derruba ou mata pelas `RunOverRules`, ragdoll com o impulso, carro perde a velocidade da reação; agente nunca para o carro como parede; roda não sobe em agente nem ragdoll |
| Estacionados (10.4) | `... game-physics-jolt exec vitest run tests/heap.test.ts` e `tests/cascade.test.ts` | 200 carros dividindo o composto: pico ≤ 64 MB, mesmo byte depois; primeiro dano copia; variante do B6 com 20 carros na ilha dentro do aceite |
| Cascos contra contato (10.5) | `.../tests/vehicle-hulls.test.ts` | carro amassado encostado na parede, cascos refeitos: régua do C1 sem energia criada |
| Peça que solta (11) | `.../tests/crash-parts.test.ts` | massa, inércia e centro de massa do chassi descontam a peça no mesmo passo |
| Contrato novo | `pnpm --filter @adatechnology/game-physics-jolt test` | composto compartilhado e cópia no primeiro dano; filho por alça sobrevive a `RemoveShape` de outro; composto mutável mantém massa do kit; `rebuildVehicle` mantém o corpo; `vehicleWheels` com 2, 4 e 6 rodas; `applyBuoyancy` boia caixa na densidade certa |
| Carro criado andando | `... game-physics-jolt exec vitest run tests/vehicle.test.ts` | 60 km/h girado 37°: perde ≤ 1 km/h em 2 s, sem derrapar |
| Sono (T6.3) | idem | ≤ 3 s parado; ≤ 7 s depois do meio-fio a 60 km/h; roda no ar mantém acordado |
| Mapa da condução | `pnpm --filter @adatechnology/game-vehicles-driving test` | semi → `VehicleDesc` campo a campo; controles → entrada (ré do parado, direção invertida, `status()` respeitado) |
| **Banco de provas no Jolt, frota terrestre inteira** | `pnpm --filter @adatechnology/game-vehicles-proving test` | 0–100, máxima, frenagem seca e molhada, raio de giro dentro da tabela de faixas, nos dois rodadores |
| **Cascos H1–H6, 69 modelos** | `pnpm --filter @adatechnology/game-vehicles-three exec vitest run tests/vehicle-hulls.test.ts` | intactos e depois das batidas de referência |
| Batidas de referência (Jolt, sem GPU) | `pnpm --filter @adatechnology/game-vehicles-three exec vitest run tests/crash-calibration.test.ts` | parede 50 km/h: 0,40–0,70 m, cabine < 10 cm; poste 50 km/h: centro ≥ 1,5× parede; carro contra carro 50% de sobreposição; lateral 30 km/h no poste: porta entra, soleira segura; capotagem: teto amassa e coluna dobra; 15 km/h: < 2 cm; batida de raspão a 30°: raspa a lateral, não esmaga a frente; energia ±25% |
| Comportamentos antigos (seção 8) | idem | Δv pelas massas, ordem para-choque → capô, peças arrancadas como hoje |
| Peças e interior | `.../tests/crash-parts.test.ts` | porta arrancada é corpo e leva vidro e maçaneta; banco solto cai pela porta aberta e nunca atravessa o assoalho; roda arrancada → veículo recriado com 3 rodas |
| Fogo | `.../tests/crash-fire.test.ts` | 200 batidas sorteadas: 0 explosões sem tanque rompido e ignição; tanque rompido vaza; faísca de raspagem acende poça próxima pelas regras |
| **Aceitação da frota (§7)** | `pnpm --filter @adatechnology/game-vehicles-fleet test` (`vehicle-acceptance.test.ts`) | os 69 modelos: reticulado sem nó solto, todo vértice deformável vinculado, parede a 30 km/h termina finita; depois da batida, tiro acerta o desenhado nos pontos deformados (posição no mundo), marca anda com a peça e a porta aberta; goldens de geometria intacta iguais |
| Vagas (009) | `.../tests/crash-slots.test.ts` | prioridade pela distância ao jogador (mover a câmera não muda nada), jogador sempre, assumir do estado amassado sem salto (< 1 cm no primeiro quadro), vaga passa adiante, N da qualidade, teto de subpassos por quadro, replay reproduz as decisões |
| Memória | `... game-physics-jolt exec vitest run tests/heap.test.ts` | 100 ciclos bater → assentar → descartar: heap do wasm no mesmo byte; pool do reticulado devolvido |
| Determinismo e salvar | `.../tests/crash-determinism.test.ts` | mesma batida duas vezes: mesmos nós e poses; salvar → carregar → salvar com os mesmos bytes |
| Barco | `pnpm --filter @adatechnology/game-vehicles-driving test` (água) | boia no calado de projeto ±5 cm; furo abaixo da linha alaga por Torricelli e aderna; antepara segura o resto; seção quebra pela viga-navio |
| Avião e helicóptero | idem (voo) | planeio estável; estol no ângulo da curva; asa quebra no fator de carga; pairar com o anti-torque; sem rotor de cauda gira; autorrotação pousa com arredondamento; pá que bate quebra e o empuxo cai |
| Moto e bicicleta | `... game-physics-jolt exec vitest run tests/vehicle.test.ts` | inclina na curva e não cai acima de 1 m/s; parada com piloto fica em pé; garfo dobrado faz puxar; piloto lançado na queda |
| Caminhão, ônibus, trator | idem e `crash-parts.test.ts` | reboque segue o cavalo; frenagem forte na curva faz o L e o engate quebra acima do limite; carga se espalha no tombamento; ônibus tombado de 0,8 m (referência UN ECE R66) mede o teto; implemento solta no engate |
| Ocupantes | `crash-parts.test.ts` | Δv acima do limiar com porta arrancada ejeta com a velocidade do ponto do assento; carro fechado não ejeta; ragdolls nunca passam de 20 |
| Sala (à mão, §9) | `pnpm check:vehicles` | prints por câmera de batida na parede, no poste e entre carros, porta aberta depois do tiro (`docs/veiculos-verificacao.md`); ocupante sentado e ejetado em primeira e terceira pessoa (§5) |
| Z-fighting nas batidas deformadas (§13) | agente `revisor-z-fighting` sobre as batidas de referência deformadas | nenhuma face coincidente nova depois de amassar |
| Linha composta do C7 (15.4) | `node tools/gpu/perf-gate.mjs` (à mão / rodada diária) | mediana e p99 dentro do orçamento fixado |

## 19. Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| Uma iteração por subpasso não segura a rigidez da longarina | recuo grande demais, ou custo de A (15.1) | T6.0 mede 1 e 2 iterações antes de qualquer outra task do reticulado |
| Cascos refeitos com atraso (até 4 passos) | o outro carro entra 1–3 cm na forma deformada por um instante | H2 vale em repouso; durante a batida, tolerância de 3 cm registrada; cadência sobe para cada 2 passos se a sala mostrar |
| Impulso do passo estimado por Δv engana com o veículo também apoiado nas rodas e em outro corpo | deformação no lugar errado | subtrair os impulsos das rodas (4.2); teste de raspão a 30° e de carro sobre carro |
| Casco fino + objeto pequeno rápido | atravessa | `LinearCast` em peça solta rápida; espessura mínima de casco 2 cm |
| Skinning estoura o quadro com vários carros | queda de quadro | só vértices sujos; custo do skinning entra no `c_medido` das vagas |
| `GetCombinedFriction` por roda custar como o callback do B6 | carro andando caro | só ligar se a mistura de atrito por corpo não bastar; medir na T6.2 |
| Qualidades diferentes divergem (C8) | replays e lockstep | N pela qualidade, replays gravam as decisões de vaga, lockstep excluído (D2) |
| `MutableCompoundShape` sem árvore com 96–192 filhos | contato e CCD caros | T6.0b mede; composto estático depois de assentar |
| Carros estacionados enchem o heap | passa do C9 | composto compartilhado até o primeiro dano (10.4), teste de 200 carros |
| Recriar a constraint do veículo ao perder roda dá solavanco | carro pula | recriar só no quadro em que a roda solta; teste de roda arrancada |
| Modelo de voo é um sistema inteiro | atrasa a fase 6 | tarefa e desenho próprios (009-o, spec 009), fora do caminho crítico do carro |
| Pacote novo `game-deform` | mais um pacote | justificado em 3.3 e 6.1; decisão D9 |
| Reboque como segundo veículo do Jolt sem diferencial (não verificado) | reboque não roda ou treme no engate | a 009-m testa antes de tudo; saída: reboque como corpo com rodas por raio do kit |
| Ônibus cheio | dezenas de ragdolls numa batida | limite de 20 e o resto como corrente ou agente (14.7) |

## 20. Decisões do dono

Decididas em 2026-11-14:

- **Divisão 008/009**: a 008 fica com E1 e E2; a 009 leva E3–E5 (topo deste documento).
- **D10 — Barco que afunda** vai para a spec 009 (com o método do peso adicionado, 14.6).

Recomendação do `architect` já incorporada (o dono confirma):

- **D2 — Vagas e determinismo.** N fixo na sessão pela qualidade escolhida; a medida do boot só sugere a qualidade padrão; prioridade pela
  distância ao jogador, nunca a câmera; replays gravam as decisões; emenda do C8 como task própria (T6.20); lockstep excluído.
- **D3 — Carro estacionado dinâmico dormindo**, só com as guardas da 10.4.
- **D9 — `game-deform`**: porque é puro, sem dependências, e serve a props que não são veículo (não pelo tamanho do `world.ts`); dono
  registrado em `tools/kit-audit/rules.json`.
- **D13 — Multithread**: a T6.0c sai (a `spec.md` §10 exclui multithread); no lugar, a API do `game-deform` nasce pronta para Worker
  (`TypedArray` entra, deslocamentos saem, sem callbacks).

Ainda abertas (cada uma com a recomendação):

- **D1 — Como o carro deforma (009).** **Recomendo** rígido no Jolt + reticulado do kit em referencial flutuante com contato por plano
  unilateral (4.1, 4.2): soft body do Jolt não faz carro contra carro (verificado); soft body completo é um segundo motor de contato.
- **D4 — Aceite dos cascos.** **Recomendo** H1–H6 (10.3): 1 cm para fora, 95% de cobertura por raio, 90% do volume nas peças sólidas, teto
  de cascos por classe medido na T6.4, no lugar da regra de 1 cm da T3.0b para veículos.
- **D5 — Frequência padrão do reticulado (009).** **Recomendo 480 Hz** (meia distância a 240 Hz), revisto depois da T6.0.
- **D6 — Orçamento das batidas.** A fatia de papel saiu. **Recomendo** a linha composta do C7 (15.4) com os orçamentos fixados depois da
  primeira medida. Com a estimativa revista, 1 carro com vaga por 1,5 ms; pilha de 24 carros só no nível 2.
- **D7 — Modelo de voo (009).** **Recomendo** semi-simulação por superfície, em desenho próprio (`opus`).
- **D8 — Navio e avião grande (009).** **Recomendo** seções + reticulado grosso ≤ 400 nós (14.8).
- **D11 — Moto e bicicleta sem reticulado.** **Recomendo** peças rígidas + juntas do kit + deformação de peça (14.2).
- **D12 — Pacote `game-vehicle-damage`.** **Recomendo não criar** (22.7).
- **D14 — `three-mesh-bvh`.** **Recomendo não adicionar agora**; só se a T6.0b medir o tiro na malha deformada acima do orçamento (23).
- **D15 — Deformação dos vértices na GPU (009).** Durante a fase ativa, os deslocamentos dos nós vão numa textura e o *vertex shader* aplica
  o skinning (4 índices e pesos como atributos); quando o reticulado desliga, o resultado é escrito **uma vez** na geometria da CPU (que o
  `surfaceRay` e os cascos usam). Tiro durante a fase ativa: skinning na CPU só dos triângulos da parte candidata, sob demanda. **Recomendo**
  medir primeiro a versão na CPU na T6.0b e só adotar a GPU se o skinning passar do orçamento.

## 21. Impacto no `tasks.md` (proposta; o `tasks.md` não foi editado)

Mudanças:

- **T3.0b**: o aceite de 1 cm por triângulo vale só para o que fica estático; para veículos é substituído por H1–H6 (T6.4). O código
  incremental da T3.0b continua como entrada dos cascos.
- **T6.1** (esta): fecha com este documento revisado por `architect` e as decisões D1–D15 da seção 20.
- **T6.2–T6.5** antigas viram T6.2, T6.3, T6.12 e T6.16 abaixo.
- Modelo por task conforme `model-economy.md` §1: mecânica + aceite por comando → `haiku`; decisão local → `sonnet`; decisão herdada →
  `opus` 🧠.

### 21.1 Plano T6.x da spec 008 (E1 e E2)

| Task | O que | Mecânica? / Aceite por comando? | Modelo |
|---|---|---|---|
| **T6.0** | **Micro-benchmark do reticulado** (alimenta a decisão de seguir com a 009): XPBD com plasticidade em Node, 60–400 nós, 1 920/960/480/240 Hz, 1 e 2 iterações, massa realista (motor : painel ≈ 300:1), entrada por plano; relata ms, **erro de deformação e deriva**; 9 rodadas em máquina quieta | sim / sim (à mão, nunca em commit) | `sonnet` |
| **T6.0b** | **Espião descartável** (um arquivo de teste, Jolt cru permitido): um carro, uma parede, cinco componentes (para-choque dianteiro, capô, farol esquerdo, roda dianteira esquerda, suspensão dianteira esquerda); ms por etapa por quadro; composto mutável com 96 e 192 filhos (contato e `LinearCast`); skinning na CPU; critérios escritos de seguir ou parar a E3 (4.2: folga ≤ 3 cm, nó ≤ 1,5×, energia ≤ entrada; 15.1: carro ≤ 1,2 ms a 480 Hz) | não / sim (o teste imprime e confere os critérios) | `sonnet` |
| T6.1 🧠 | Este desenho, revisado por `architect`; dono decide as abertas da seção 20 | não / não | `opus` |
| T6.1b | Contrato e adaptador (6.4): forma compartilhada e cópia no primeiro dano, filho por alça, `setMassProperties`, `setMotionQuality`, `watchContacts`, `vehicleWheels`, `rebuildVehicle`, camadas (sem `vehicle`–`agent`, `ragdoll`, testador das rodas), controladores moto e esteira, curvas; correções de 3.4 | não / sim (`game-physics-jolt test`, `heap.test.ts`) | `sonnet` |
| T6.2 | Mapa da condução (seção 7), inclusive a bicicleta a pedal: `vehicleDescFromSemi`, controles → entrada, carro criado andando, arrasto, `status()` | não / sim (`game-vehicles-driving test`, `vehicle.test.ts`) | `sonnet` |
| T6.2b | Rodador do banco de provas no Jolt; frota terrestre inteira dentro das faixas | sim / sim (`game-vehicles-proving test`) | `sonnet` |
| T6.3 | Regra de sono (7.7) | não / sim (`vehicle.test.ts`) | `sonnet` |
| T6.4 | Cascos convexos (10.1, 10.3, 10.5): concavidade, extrusão para dentro, teto por classe **medido e escrito aqui**, H1–H6 nos 69 modelos; estacionado dinâmico com as guardas da 10.4 | não / sim (`vehicle-hulls.test.ts`) | `sonnet` |
| T6.9 | Peças soltam como corpos (11, sem o interior), contabilidade de massa, no lugar do `fling` no modo Jolt; nível 2 de dano alimentado pelas linhas de contato do Jolt (`crashVehicle` pelo `tag`) e cascos refeitos ao assentar | não / sim (`crash-parts.test.ts`) | `sonnet` |
| T6.12 | Aceitação da frota (§7) com motor e cascos; goldens da geometria intacta iguais | sim / sim (`game-vehicles-fleet test`) | `sonnet` |
| T6.16 | README, skills (`kit-veiculos`), `docs/veiculos-verificacao.md` e `docs/veiculos-pecas-por-categoria.md` | sim / sim (`kit-audit --check`) | `haiku` |
| T6.19 | Atualizar o §6 da `arquitetura.md`: carro estacionado dinâmico (D3), sem par `vehicle`–`agent`, camada `ragdoll`, camada do testador das rodas | sim / sim (`grep` das camadas novas na `arquitetura.md`) | `haiku` |
| T6.20 | Emenda do C8 no `spec.md` (D2) com o texto aprovado pelo dono | sim / sim (`grep` da emenda) | `haiku` |
| T6.21 | Teste de heap dos 200 carros estacionados e variante do B6 com 20 carros na ilha (10.4) | sim / sim (`heap.test.ts`, `cascade.test.ts`) | `sonnet` |
| T6.25 | Sonda da sala do veículo no `leak.mjs` (§8) | sim / sim (à mão) | `sonnet` |
| T6.26 | Atropelar pedestres e zumbis (7.8) | não / sim (`game-vehicles-driving test`, `vehicle.test.ts`) | `sonnet` |

Ordem: T6.0 + T6.0b → T6.1 (dono) → T6.19 → T6.1b → T6.2/T6.2b/T6.3 → T6.4/T6.21 → T6.9 → T6.26 → T6.20 → T6.12 → T6.25 → T6.16.

### 21.2 Lista proposta para a spec 009 (E3–E5; numeração da 009 a definir)

| Task | O que | Mecânica? / Aceite por comando? | Modelo |
|---|---|---|---|
| 009-a | `game-deform`: XPBD, plasticidade, ruptura por dano acumulado e duração, plano unilateral, referencial flutuante só de deriva, pool, energia, API pronta para Worker; README, skill, dono no `kit-audit` | não / sim (`game-deform test`) | `sonnet` |
| 009-b | Propriedades mecânicas nos materiais de `game-destruction` (literatura com fonte) | não / sim (`game-destruction test`) | `sonnet` |
| 009-c 🧠 | Gerador do reticulado a partir de peças e `meta`, regra de tamanho 14.8, `beam-props.ts` (material → viga) | não / sim (`game-vehicles test`) | `opus` |
| 009-d | Classes de viga e alvos por categoria na frota (6.3) | não / sim (`game-vehicles-fleet test`) | `sonnet` |
| 009-e | Skinning (9) na CPU; GPU só se D15 | não / sim (`game-vehicles-three test`) | `sonnet` |
| 009-f 🧠 | Acoplamento contato → reticulado → cascos (4.2, 10.2, 10.5) | não / sim (aceite da 4.2) | `opus` |
| 009-g | Vagas (15.3): prioridade pelo jogador, N da qualidade, teto de subpassos, replay | não / sim (`crash-slots.test.ts`) | `sonnet` |
| 009-h | Salvar e determinismo (17) | não / sim (`crash-determinism.test.ts`) | `sonnet` |
| 009-i | Interior que cai (11) e entradas de fogo (12) | não / sim (`crash-parts`, `crash-fire`) | `sonnet` |
| 009-j | Calibração das batidas de referência e da seção 8, com o aceite da 4.2 | não / sim (`crash-calibration.test.ts`) | `sonnet` |
| 009-k | Linha composta do C7 (15.4) e a linha no `perf-gate.mjs` | sim / sim (à mão) | `sonnet` |
| 009-l | Ocupantes viram ragdoll (14.7); prints sentado e ejetado em primeira e terceira pessoa (§5). Depende da T5.1 | não / sim + prints à mão | `sonnet` |
| 009-m | Reboque e carga, ônibus, trator com implementos (14.3) | não / sim (`vehicle.test.ts`, `crash-parts.test.ts`) | `sonnet` |
| 009-n | Barco: flutuação, compartimentos, seções (14.6) | não / sim (testes de água) | `sonnet` |
| 009-o 🧠 | Desenho do voo e do rotor (`design/voo.md`) | não / não | `opus` |
| 009-p | Avião e helicóptero conforme 009-o | não / sim (testes de voo) | `sonnet` |
| 009-q | Revisão de z-fighting nas batidas de referência deformadas (§13, `revisor-z-fighting`) | não / não | `sonnet` |
| 009-r | Aceitação da frota com reticulado (§7) | sim / sim (`game-vehicles-fleet test`) | `sonnet` |

### 21.3 Melhoria de fratura depois da migração (fora da 008 e da 009)

Cortes por plano com semente, tampas internas e bordas irregulares para pedaços mais bonitos, em `game-destruction` (estendendo o
`planFragments`). Referência de técnica: github.com/NamelessC0der/Fracture-world (MIT segundo o dono, não conferido aqui; só demonstração,
sem física). Só a ideia; nenhum código copiado sem o aviso da licença, e sem `Math.random` (determinismo). Task proposta para depois da T8.x,
`sonnet`.

Candidata a dependência na mesma task: `@dgreenheck/three-pinata` (MIT, ~458 estrelas, TypeScript, só `three` como dependência; Voronoi 3D,
2,5D e por planos, com `seed` para reprodutibilidade; devolve geometria, o colisor convexo fica com o motor). Comparar com o `planFragments` em
aparência, custo e determinismo antes de adotar (§13 das regras: manutenção, tipos, licença conferida no código). Conferido na página do
repositório em 2026-11-14; atividade recente não conferida.

## 22. Análise externa trazida pelo dono: onde concordo e onde não

### 22.1 Três níveis em vez de dois — **concordo**, e o nível 2 já existe quase todo

| Nível | O que é | No kit hoje | O que falta |
|---|---|---|---|
| 1 visual (muitos veículos) | dano por região | **existe**: saúde por zona em 5 faixas e o desenho fundido além de 14 m (`vehicle-lod.ts`) | nada; o corpo continua no Jolt (o trânsito de longe também colide) |
| 2 simplificado (perto) | deformação por zona, resistência aproximada, ruptura de peça, rodas e suspensão físicas | **existe quase todo**: `crashVehicle` → golpes `blunt` nas partes + `crumple` (`kit.impact`), juntas com desgaste, peças que soltam. É o que este documento chamou de "amassado aproximado" | rodas e suspensão físicas (o veículo do Jolt, T6.2) e os cascos refeitos uma vez ao assentar |
| 3 reticulado (poucos) | nós e vigas | não existe | seções 4–10 |

Onde não concordo: o nível 1 não pode ser "só visual" no sentido de sem física; o carro de longe é corpo do Jolt dormindo ou andando, só não
gasta com vértices. E o nível não é a maior alavanca de custo: skinning e ragdolls pesam mais (15.1).

### 22.2 Transições sem salto — **concordo**

Como o corpo do Jolt e o destrutível são **os mesmos** nos três níveis, posição, velocidade e estado das peças passam sem cópia. A deformação
acumulada: 1 → 2 mantém o desenho das faixas e soma os amassados novos por cima; 2 → 3 parte do estado amassado (15.3, item 3); 3 → 2 ao
assentar mantém a geometria e libera o reticulado. Nunca se rebaixa um veículo no meio de uma batida, e nunca se desfaz um amassado. Teste: no
quadro da troca, nenhum vértice anda mais de 1 cm (`crash-slots.test.ts`).

### 22.3 Propriedades da conexão — **concordo**, com o dano acumulado e a duração

Mapeadas em `BeamClass` (6.2) e nas juntas do kit: rigidez (`compliance`), amortecimento (`damping`), limite de deformação (`yieldStrain`),
limite de ruptura (`breakStrain`, `breakLoad`), dano acumulado (por viga, e o `hp` das juntas do kit, que **já acumula**: `impl.ts:412`),
`broken`. A ruptura usa dano acumulado **e** duração (`fatigue`, `holdSeconds`), não só o pico. Teste do exemplo dado: porta aguenta dez
golpes pequenos, sai no trigésimo ou num golpe forte (`crash-parts.test.ts`).

### 22.4 Skinning com `DynamicDrawUsage` — **concordo** (seção 9), com `addUpdateRange` só no trecho sujo.

### 22.5 Build multithread — **não agora** (D13 decidido)

Conferido em `node_modules/.pnpm/jolt-physics@1.1.1/node_modules/jolt-physics/package.json` (`exports`): `./wasm`, `./wasm-compat`,
`./wasm-multithread`, `./wasm-compat-multithread`, `./debug-wasm-compat`, `./debug-wasm-compat-multithread`, `./asm`. Os multithread
precisam de `SharedArrayBuffer`, que no navegador exige isolamento entre origens (cabeçalhos COOP/COEP): a sala em arquivo único e qualquer
hospedagem sem esses cabeçalhos não os tem. A `spec.md` §10 deixou multithread fora, e o risco listado ali ("inutilizável com callback de JS")
continua: nossos listeners de contato e o passo do veículo são JS. E o principal: **o reticulado é nosso, em JS**; as threads do Jolt não o
aceleram. A paralelização que ajudaria é um Worker do kit para os reticulados (só `TypedArray`, sem Jolt), que também precisa de COOP/COEP para
memória compartilhada, ou um quadro de atraso trocando mensagens. Decidido (D13): **sem** medida do Jolt multithread (a `spec.md` §10 o exclui; a T6.0c saiu); a API do `game-deform` nasce pronta para Worker
(`TypedArray` entra, deslocamentos saem, sem callbacks), e o Worker em si fica para quando a T6.0 mostrar o reticulado como gargalo.

### 22.6 Primeiro protótipo — **concordo**, e vira a T6.0b junto com a T6.0

Um carro, uma parede, cinco componentes (para-choque dianteiro, capô, farol esquerdo, roda dianteira esquerda, suspensão dianteira esquerda).
Precisa mostrar: contato do Jolt; intensidade e direção do impacto; propagação do dano; deformação visual; ruptura de conexão; separação da
peça; dano que fica depois do carro parar. Mede **tempo por etapa por quadro** (contato, impulso, reticulado, cascos, skinning, normais,
promoção de peça), mediana e p99, nunca FPS. A suspensão como componente exige o veículo de rodas mínimo (parte da T6.1b) no protótipo.

### 22.7 Pacote novo `@adatechnology/game-vehicle-damage` — **não concordo**

- §1 (SDK primeiro; crie no pacote dono): zonas de dano, juntas, `crumple`, `crashVehicle` e o destrutível moram em `game-vehicles`. Um
  pacote de "dano de veículo" separado dividiria o dono e duplicaria (`crashVehicle` em dois lugares).
- §2 (motor genérico): o único pedaço novo e genérico é o reticulado, e ele **não é de veículo** (poste, guarda-corpo, contêiner): vai para
  `game-deform` (D9).
- §3 (SDKs se compõem): `game-vehicles` usa `game-deform` e os materiais de `game-destruction`; `game-vehicles-three` faz o skinning e os
  cascos; a costura `engine-vehicles.ts` junta com o mundo. Onde mora cada pedaço: seção 6.1.

### 22.8 Evolução gradual a partir de hoje (resposta à pergunta da análise; o estado de hoje está em 3.5)

Cada passo deixa o jogo funcionando; o caminho antigo continua no modo próprio até a T8.1.

| Passo | O que muda | Tasks |
|---|---|---|
| E0 hoje | arcade 2D, carro estacionado com triângulos na sala, níveis 1 e 2 do dano | — |
| E1 medir (008) | micro-benchmark e espião de um carro decidem se a 009 segue | T6.0, T6.0b |
| E2 carro rígido no Jolt (008) | veículo de rodas, cascos convexos, estacionado dinâmico com guardas; nível 2 de hoje alimentado pelos contatos do Jolt; peças soltam como corpos; atropelar | T6.1b–T6.4, T6.9, T6.21, T6.26 |
| E3 reticulado nos carros (009) | nível 3 com vagas, skinning, cascos refeitos; nível 2 como reserva | 009-a … 009-h, 009-j |
| E4 interior, fogo, ocupantes (009) | interior que cai, entradas de fogo, ragdolls | 009-i, 009-l |
| E5 outras classes (009) | reboque e carga, ônibus, trator com implementos, barco, avião, helicóptero | 009-m … 009-p |

## 23. Bibliotecas avaliadas (nenhuma dependência nova proposta agora)

Regra do repositório (`code-standart.md` §13): dependência nova só se for a mais moderna e mantida, tipada, compatível com a arquitetura, com
justificativa.

| Biblioteca | Licença e manutenção | O que faria | Veredito |
|---|---|---|---|
| **three-mesh-bvh** (gkjohnson) | **não verificado aqui**: não está em `node_modules` (nenhum pacote do kit depende dela). Tida como MIT e mantida; conferir com `npm view three-mesh-bvh license version time.modified` e se traz tipos antes de adicionar | raio contra a malha desenhada exata por BVH, com `refit` depois de amassar | **não agora** (D14). O colisor de triângulos de 1 cm já sai da física pelos cascos (10.3), então ela não substitui nada na física; no tiro, o kit já tem `tri-index.ts` (blocos de 32 triângulos, `raycastIndexed`, `touchTriIndex` depois de amassar) sob o `surfaceRay`. Entra só se a T6.0b medir o tiro ou a atualização do índice num sedã deformado (~230 000 triângulos) acima do orçamento, e lembrando que corte e subdivisão do kit trocam a geometria (BVH refeita, não `refit`) |
| **`ConvexObjectBreaker`** do three | MIT (`three@0.160.1/package.json`); arquivo `examples/jsm/misc/ConvexObjectBreaker.js` existe (verificado) | corta uma malha convexa por planos em pedaços convexos (`ConvexGeometry`) | **não usar**. Lido no código: exige malha **convexa** (não confere), normais planas, usa `Math.random()` (linhas 107, 126, 134: quebra o determinismo do C8) e devolve `THREE.Mesh` (só serviria em `*-three`). O kit já tem `planFragments` (`game-destruction/src/fracture.ts:242`): puro, com `rnd` semeado, estilos de fratura por material, veio e folhas. Para veículo o que se precisa não é estilhaçar (metal dobra) e sim o casco convexo de cada peça (10.1); o corte por plano de seções (navio, asa), se preciso, entra semeado em `game-destruction`, estendendo o `planFragments` (a ideia do corte pode ser portada com o aviso da MIT, sem o `Math.random`) |
| **Rigs of Rods** | GPL-3.0 (informado pelo dono; não conferido aqui) | referência de nós e vigas (tipos de viga, limites de deformação e ruptura, amortecedores como vigas) | **só conceito. Nada copiado**: nem código, nem arquivos de veículo, nem tabelas de constantes; código GPL dentro do kit obrigaria o kit inteiro a ser GPL. O mesmo vale para o BeamNG (proprietário). Nossos números vêm da literatura e da calibração da 009-j |
