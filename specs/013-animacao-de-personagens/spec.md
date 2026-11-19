# Spec 013 — Animação de personagens: mistura, estados, contato e reações

Origem: `docs/animacoes-e-modelos-melhorias.md` (seções 2.1 e 3), itens A3, A4, M1, M2, M4 (IK), M6, M8, M9, M10, B1, B10.

## Por quê

A animação do corpo é feita de senos e de poses fixas escolhidas por `if/else` (`game-characters-three/src/player/avatar.ts:626-651`).
Não há grafo de estados, camadas, aditivo, IK de pés nem ragdoll ligado ao corpo. O que aparece na tela:

- **Corrida patina e dá tranco.** Amplitude fixa `0.65 × gait` e cadência × 1,3 (`avatar.ts:452-459, 616-620`); ao ligar ou desligar
  a corrida a fase das pernas salta. O andar está certo e tem teste (`stride.ts:8-10`, `footfall.test.ts`).
- **Não combina ações.** Um clipe por vez, com peso linear de 0,12 s (`avatar.ts:586-599`): não dá para recarregar andando com recuo.
- **Mistura pronta e parada.** `humanPose`/`blendMoves`, `crawlPose` e `deadPose` (porte do Elenco) só são chamados em teste
  (`game-characters/src/gait/moves.ts:14, 59`, `lying.ts:15, 41`).
- **Sem direção.** O corpo recebe velocidade escalar (`avatar.ts:93-94`): sem ré, lateral, pulo nem transposição.
- **Mira só no ombro** (`avatar.ts:347-358`).
- **Morte é uma rotação rígida do quadril** (`test-area/module.ts:273`). O ragdoll existe no contrato e no Jolt
  (`game-physics/src/contract.ts:142-164`) e ninguém usa; a Fase 5 da spec 008 está aberta.
- **Duas câmeras, dois caminhos.** A spec 004 T5.1 (remover `first-person/arms.ts` e os clipes de primeira pessoa) não tem evidência.
- **Multidão troca de pose por índice inteiro** (`instanced/body-chunk.ts:28-42`), sem mistura.

## Decisões do dono (2026-11-19)

- **D1** Clipes novos (reações, morte, levantar) são **autorados no kit**, no formato dos atuais.
- **D2** O que se fizer agora tem de ser **fácil de melhorar depois**: o grafo, as camadas e as curvas ficam atrás de contratos
  puros no núcleo, com os dados em JSON; trocar um clipe, uma curva ou um solver não mexe em quem consome.

## Requisitos

- **R0 — Referência antes de mexer.** Matriz de prints do estado atual pela regra §5: primeira e terceira pessoa × parado, andando,
  correndo × mira alta, reta, baixa × uma arma por família, mais agachar, cair e segurar item.
- **R1 — O pé não patina.** Em qualquer velocidade de 0 a 7 m/s, andando ou correndo, o pé de apoio desloca menos de 2 cm no chão por passo.
- **R2 — Fase contínua.** Trocar andar ↔ correr ↔ parar não muda a fase do ciclo: nenhuma junta salta mais de 3° num quadro.
- **R3 — Mistura contínua.** Parado, andar, correr, agachar, mirar e virar saem de `humanPose`/`blendMoves`; deitado, rastejando e
  morto saem de `crawlPose`/`deadPose`. As poses fixas do `avatar.ts` deixam de existir como caminho paralelo.
- **R4 — Grafo e camadas.** Núcleo puro com estados, transições com duração e curva, camadas (corpo inteiro, tronco, braços, cabeça)
  com máscara por canal e camada aditiva. Recuo + recarga + andar tocam juntos.
- **R5 — Direção.** O corpo recebe velocidade em dois eixos e velocidade de giro: frente, ré, lateral e diagonal sem patinar; pulo,
  queda e transposição (`vault`) têm estado próprio.
- **R6 — Mira com o corpo.** O pitch se distribui em coluna, peito, ombro e cabeça; alta, reta e baixa sem cotovelo travado.
- **R7 — Um caminho para as duas câmeras.** Fecha a spec 004: sem rig de braço separado, sem clipes só de primeira pessoa; trocar de
  vista no meio de qualquer ação não muda a pose.
- **R8 — Reações.** Reação a tiro por região (cabeça, tronco, braço, perna) em camada aditiva; cambalear, cair para frente e para
  trás, morrer e levantar, para humano e zumbi.
- **R9 — Ragdoll.** Morte, explosão e atropelamento passam o corpo rico ao ragdoll do `game-physics` (Jolt), partindo da pose e da
  velocidade do quadro; ao assentar, vira pose estática. Fecha a Fase 5 da spec 008.
- **R10 — Pé no chão.** IK de pés com tornozelo: em rampa e degrau o pé encosta e o quadril compensa. (A peça do tornozelo é da spec 014.)
- **R11 — Clipes melhores.** Curvas por chave (entrada, saída, antecipação, acompanhamento) no formato de clipe; os 11 de ataque revistos.
- **R12 — Multidão.** Mistura entre duas poses no shader, impostor com mais de um estado e textura de clipes ligada por padrão quando o orçamento permite.

## Fora do escopo

- Geometria de juntas, dedos e rosto (spec 014). Golpes de arma branca e item na mão (spec 015). Corpo dentro do veículo (spec 016).
- Captura de movimento ou assets externos: tudo continua procedural e em dados.

## Critérios de aceite

1. `footfall.test.ts` estendido: R1 em andar e correr, frente, ré e lateral, nas alturas de 1,55 a 2,05 m.
2. Teste de continuidade (R2) em todas as transições do grafo.
3. Teste R7 da spec 004 (mesma pose nas duas vistas) verde, e `first-person/arms.ts` removido.
4. Teste de equivalência: ragdoll com a mesma semente dá o mesmo estado final (determinismo do passo fixo).
5. Matriz §5 regravada depois de cada fase, lado a lado com a R0, em `evidence.md`.
6. Gates do kit verdes; `perf-gate` sem regressão no corpo do jogador e na horda.
