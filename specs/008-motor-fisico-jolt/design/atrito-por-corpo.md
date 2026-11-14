# Desenho — atrito por corpo (T1.1, fecha D1.1 do `plan.md`)

Decisão do dono sobre B6 (2026-11-13): a regra de Coulomb estático/dinâmico sai do callback de JS por contato e vira troca de atrito por corpo.
O spike já implementa a maior parte (`62da7619`, refinado em `0fea652f` e `72bb3a5e`). Este documento registra o que existe, o que muda e por quê.
Código: `packages/game-physics-jolt/src/friction.ts`, `contacts.ts`, `state.ts`, `world.ts` (`step`, `settingsFor`, `setMaterial`).

## 1. O que o Jolt deixa fazer

- O binding de JS (`jolt-physics` 1.1.1) **não expõe** `PhysicsSystem::SetCombineFriction`/`SetCombineRestitution`. A mistura de atrito é a
  padrão do Jolt: **média geométrica** dos coeficientes dos dois corpos, recalculada a cada passo para todo contato (novo ou mantido). A de
  restituição é o **máximo** dos dois.
- O listener pode sobrescrever `mCombinedFriction`/`mCombinedRestitution` em `OnContactAdded` e `OnContactPersisted`. Fazer isso no
  `OnContactPersisted` é o custo que reprovou B6 (um terço do quadro de despertar).
- Logo, sem callback por contato, o único botão é o coeficiente de cada corpo (`BodyInterface::SetFriction`), e ele vale para **todos** os
  contatos daquele corpo no passo.

## 2. Estado do corpo: `sticking | sliding`

- Todo corpo dinâmico tem `sliding: boolean` (`BodyEntry.sliding`); nasce `false` (preso).
- Decidido **depois de cada passo fixo** (seção 6) só para corpos acordados (`GetActiveBodies`), com parceiro (`partners`) e material com
  `frictionStatic ≠ frictionDynamic` (com os dois iguais não há o que trocar).
- **Pé do corpo:** o ponto sob o centro de massa (eixo Y do mundo), na base da caixa envolvente no mundo. A velocidade dele já inclui o giro:
  lata rolando sem escorregar **em chão plano** fica `sticking`. Numa rampa de θ, o pé não é o ponto de contato e a lata rolando lê
  `2·sin(θ/2)·v` (0,43·v a 25°), passando de 2 cm/s a ≈ 5 cm/s; corpo que tomba ou quica conta a velocidade ao longo da normal. Efeito
  pequeno: o corpo só passa a segurar o dinâmico, e um cilindro rola sem escorregar com μ ≥ tan θ / 3 (teste do cilindro na rampa, T1.2).
  Melhorar exigiria a normal por parceiro (um objeto por par, alocação no callback); fica como está.
- **Escorregamento contra um parceiro:** contra corpo fixo (`static`), a velocidade do pé; contra corpo que se move, a diferença entre a
  velocidade do pé e a do parceiro no mesmo ponto (`GetPointVelocity`).
- **Regra:** o corpo está `sliding` se escorrega mais que `slipSpeed` (2 cm/s, `WorldDesc.slipSpeed`) contra **algum** parceiro; senão,
  `sticking`. Corpo sem parceiro mantém o estado.
- **Coeficiente que o corpo segura:** `sticking` → `frictionStatic` do material; `sliding` → seção 3. O adaptador guarda o coeficiente
  aplicado (`BodyEntry.friction`) e só chama `SetFriction` quando o **valor** muda.
- Corpo dormindo não é visitado e guarda o estado; ao acordar, vale o guardado por um passo e então é reavaliado.

### 2.1 Um corpo em dois apoios com estados diferentes

Um corpo tem um coeficiente só. Se escorrega contra um apoio e está parado contra outro (prancha com uma ponta no chão e outra numa caixa que
desliza), ele fica `sliding` (regra do "algum"): o apoio parado também recebe o dinâmico. Escolha consciente: o erro é deixar o corpo
escorregar um pouco mais fácil num apoio enquanto já escorrega no outro, nunca prendê-lo enquanto escorrega. O comportamento 4 do C5 (rampa)
e o caso de dois apoios ficam cobertos por teste (T1.2).

## 3. Mistura com corpo estático e entre dinâmicos

Corpos estáticos não escorregam e **seguram o coeficiente estático** do seu material (`settingsFor`: `mFriction = frictionStatic`). A mistura
é a do Jolt (`√(μ₁·μ₂)`), igual à `mixFriction` do kit e à do solver próprio (`pieces.ts`, `mixFriction` por par).

Erro de cada caso contra o alvo do kit (`√(μs₁μs₂)` preso, `√(μd₁μd₂)` escorregando), com `r = μd/μs` de cada material (tabela de
`game-destruction-three/src/friction.ts`: concreto 0,857, madeira e plástico 0,75, aço 0,667, vidro 0,875, borracha 0,8):

| Par | Jolt dá | Erro |
|---|---|---|
| dinâmico preso × estático | `√(μs₁μs₂)` | **exato** (o limiar de "segura na rampa" é o certo) |
| dinâmico escorregando × estático | `√(μd₁μs₂)` | `×√(1/r₂)`: +8% no concreto, +15% na madeira, +22% no aço (atrito maior: escorrega menos) |
| dinâmico × dinâmico, mesmo estado | `√(μ₁μ₂)` do estado | **exato** |
| um preso, outro escorregando, um contra o outro | `√(μs₁μd₂)` | entre os dois alvos |

**Alternativas medidas no papel e descartadas:**

- *Corpo escorregando segura `μd²/μs` ("razão do par" do `plan.md`):* exato contra estático do mesmo material, mas erra por `√(r₁/r₂)` com
  materiais diferentes (aço no vidro −13%) e por `√(r₁r₂)` entre dois dinâmicos escorregando (aço com aço −33%). Troca um erro que segura a
  mais por um que solta a mais, e estraga o caso dinâmico × dinâmico, que hoje é exato.
- *Estático segura `√(μs·μd)`:* reparte o erro (±4% no concreto, ±10% no aço), mas desloca o limiar de "segura": `μs 0,5 / μd 0,4` a 25°
  daria 0,473 contra tan 25° = 0,466, a 1,5% de soltar. O §12 prefere o que fica parado continuar parado.

**Decisão (revisada pelo `architect`, sugestão O1):** estático segura `frictionStatic`. Dinâmico preso segura o seu `frictionStatic`.
Dinâmico escorregando:
- se **todos** os parceiros são fixos (`static`) e do **mesmo material** (o caso comum: peça no chão, na casa), segura `μd₁·μd₂/μs₂`. A média
  geométrica do Jolt com o `μs₂` do fixo dá `√(μd₁μd₂)`, o alvo do kit, **exato**;
- senão (parceiro que se move, ou fixos de materiais diferentes), segura o seu `frictionDynamic`: dinâmico × dinâmico continua exato, e contra
  fixos misturados vale o viés da tabela (escorrega menos, nunca solta o que deveria segurar).

Fica fixado por teste (T1.2: caixa `μs 0,5 / μd 0,4` lançada a 3 m/s rampa acima, numa rampa fixa do mesmo material, freia como `μ 0,4` e não
como `√(0,4·0,5) = 0,447`, comparada a rodadas de referência no mesmo mundo para cancelar o viés próprio do Jolt, ≈ +4,5% no atrito efetivo).

## 4. Restituição

- **Contato novo** (`OnContactAdded`): `mCombinedRestitution = √(e₁·e₂)`, a mistura do kit. Já existe e custa um acesso, pois o callback já
  roda para os eventos.
- **Contato mantido:** o Jolt recalcula a mistura a cada passo com a sua regra (**máximo**) e o adaptador não sobrescreve. A restituição só
  age quando a aproximação passa de `mMinVelocityForRestitution` (1 m/s, padrão do Jolt); num contato que já existia isso é o segundo golpe
  sobre algo encostado (peça parada no chão atingida por cima). Nesse caso quica com o maior dos dois coeficientes.
- **Decisão:** aceitar. Sobrescrever no `OnContactPersisted` é o custo que B6 cortou. Risco registrado (spec §9, "Restituição sem
  callback"); se um teste de colisão de latas ou a sala mostrar o efeito, a correção é por corpo, não por contato.

## 5. O que fica no listener

| Callback | Faz | Não faz |
|---|---|---|
| `OnContactValidate` | rejeita pares ignorados (`ignored`); sem pares ignorados, aceita direto | — |
| `OnContactAdded` | sensor: evento de entrada e **retorna**; corpo: `touching`/`partners` (+1), restituição do kit, pontos do corpo perguntado, linha em `contacts` (dano, som) se fechou acima de `reportSpeed` | atrito |
| `OnContactPersisted` | só os pontos de contato dos corpos perguntados (`contactPoints`); sem nenhum perguntado, retorna na primeira linha | atrito, restituição |
| `OnContactRemoved` | `touching`/`partners` (−1) e evento de saída do sensor | — |

**Correção (T1.2):** no spike o `touch(+1)` rodava antes de olhar se o contato é de sensor, e o `OnContactRemoved` fazia o `touch(−1)` para todos.
Resultado: um corpo dentro de um sensor (fumaça) conta como `touching`, ganha o sensor como parceiro e: (a) a resistência ao rolamento
(`roll`) age em voo, freando a granada que atravessa a fumaça; (b) contra um sensor cinemático que se move, o corpo vira `sliding` sem tocar
nada. Correção: no `OnContactAdded`, par com um corpo da camada `sensor` não chama `touch` (só JS, sem atravessar o wasm). No `touch(−1)`, só
desconta par que foi contado (`partners[key]` tem `other`): par de sensor nunca foi, e isso vale também quando um dos corpos já foi removido
(`forget` apaga a entrada na hora, e o Jolt avisa a remoção do contato um passo depois, quando a camada já não pode ser lida). Testes em T1.2:
corpo dentro de sensor removido continua `touching` no chão; parceiro removido sai de `partners` e `touches` continua a soma das contagens.

## 6. Quando a troca roda: por passo fixo

No spike, `updateFriction` rodava uma vez por chamada de `world.step(dt)`, depois de todos os passos fixos dela. Com `fixedStep` 1/120 e a sala
chamando `step(1/60)`, os dois passos da chamada usam o estado de antes; a 30 qps seriam quatro. O resultado depende de como quem chama
reparte o tempo, e uma transição preso → escorregando atrasa até um quadro de desenho.

**Decisão:** `updateFriction` roda **dentro do laço**, nesta ordem: `iface.Step` → `updateFriction` (lê as velocidades do solver) → `roll`
(impulso de rolamento) → `breakJoints`. O resultado passa a depender só do passo fixo.

Junto: `brokenJoints` passa a ser limpo uma vez por chamada, no começo de `step` (antes era limpo a cada passo fixo dentro de `breakJoints`, e
com dois passos por chamada a junta quebrada no primeiro sumia do relatório). Custo: medido aquecido em ≈ 0,2 ms por chamada na cascata de 500 (Q4); na sala, dois por quadro. Medido de novo em T1.3 (B6 e B5);
se o p99 de B6 passar de 4 ms por causa disso, a T1.3 para e leva ao dono.

## 7. Determinismo

- `GetActiveBodies` devolve a ordem do Jolt, que é determinística para o mesmo estado.
- O resultado de cada corpo lê só velocidades depois do passo e o material dos parceiros, nunca o atrito de outro corpo: **não depende da
  ordem** em que corpos e parceiros são visitados (o laço de velocidade para cedo quando já passou do limiar, e o booleano é o mesmo; a
  classificação "todos fixos do mesmo material" olha todos). Nenhum estado depende da ordem de iteração de `Map`.
- `saveState` grava, depois dos bytes do Jolt: os corpos cujo estado ou coeficiente difere do inicial (chave, `sliding`, coeficiente em
  float64), o mapa `partners` com as contagens e o `accumulator` (tempo ainda não rodado, float64). `restoreState` devolve os coeficientes
  por `SetFriction`, reconstrói `partners`/`touches` (estes como soma daqueles) e o `accumulator`. Salvar → rodar → carregar → rodar dá o mesmo estado bit a bit
  (`smoke.test.ts`, C8 em T3.7).
- A troca de material (`setMaterial`) aplica o coeficiente do estado atual (`world.ts`).

## 8. Testes que fecham este desenho (T1.2)

Em `packages/game-physics-jolt/tests/friction.test.ts`:

1. Caixa `μs 0,5 / μd 0,4` em 25° segura (existia).
2. Caixa `μ 0,4` em 25° escorrega `½·g·(sin 25° − 0,4·cos 25°) = 0,295 m` em 1 s, ± 0,05 (existia). *O `tasks.md` e o C5 (comportamento 4)
   citam 0,42 m (esperado 0,47): não bate com a física de `μ 0,4` a 25° e não achei a origem no código; o teste do adaptador fica com o valor
   analítico. Divergência levada ao dono (não muda C1–C10: o comportamento 4 continua "μ 0,4 escorrega, μ 0,5 segura").*
3. Caixa lançada a 1 m/s rampa acima: sobe, para, volta a segurar (existia, não distingue as regras da seção 3); **novo:** a 3 m/s freia como
   `μ 0,4` exato, 3 cm longe de 0,447.
4. **Novo:** corpo escorregando volta a `sticking` ao parar.
5. **Novo:** cilindro maciço rola 25° abaixo sem escorregar, `(⅔·g·sin 25°)·t²/2` a ± 5% em 0,5 s.
6. **Novo:** dois apoios: prancha sobre um bloco fixo e um bloco que se move por baixo fica `sliding`.
7. **Novo:** sensor: corpo girando que cai através de um sensor tem o mesmo giro de quando não há sensor; corpo parado dentro de um sensor
   cinemático em movimento não tem o sensor como parceiro e continua `sticking`.
8. **Novo:** sensor removido com um corpo dentro, no chão: continua `touching`; parceiro removido sai de `partners`, e `touches` é a soma.
9. **Novo:** o estado depende do passo fixo, não da chamada: `step(1/60)` e `step(1/120)` em dobro dão a mesma pose bit a bit.

Mais `pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/slope-friction.test.ts`.

## 8.1 Achado fora do atrito: teto de giro do Jolt

O Jolt limita o giro de todo corpo a `mMaxAngularVelocity` = 0,25·π·60 ≈ 47 rad/s. Uma lata de 3,5 cm de raio bate nesse teto a 1,65 m/s, e
uma cápsula de 5 mm a 0,24 m/s: dali em diante não gira tão rápido quanto anda e escorrega. Trocar o teto por um limite de velocidade de borda
(20 m/s ÷ maior meia-medida da forma, entre 47 e 1 000 rad/s) foi medido e **desfeito**: com o giro livre, a granada do B2 leva 7,65 s para
parar (limite 5 s), porque hoje parte do que a para é escorregar no teto. É decisão do dono, e cai na T4.3 (B2 em produção: granada e
cápsulas). Até lá o teto do Jolt fica, e o teste do cilindro roda abaixo dele.

## 9. O que não muda

- `WorldDesc.slipSpeed` continua opcional, padrão 2 cm/s.
- A API do contrato (`game-physics`) não muda: `Material` já tem `frictionStatic`, `frictionDynamic`, `restitution`.
- Resistência ao rolamento (condição 8) continua por passo fixo em `roll`, agora sem contar sensores.
