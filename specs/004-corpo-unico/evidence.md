# Evidências — Spec 004

| Task | Data | Gates | Commit | Observação |
|---|---|---|---|---|
| T0.1 | 2026-10-31 | protótipo rodado na sala (Chromium headless), sem erros na página | aefed4a9 | ver "Medidas da T0.1" abaixo |
| T1.1 | 2026-10-31 | build ok · typecheck ok · 494 testes · lint ok | 9c4ec9f9 | `eye()` (soquete sob a cabeça, lido antes do `reach()`), `eyeOffset`, `eyeBob`, `setView` por hooks de render; `rig.neck` não enumerável para não mexer nos goldens; lente medida por vértice, não por caixa |
| T1.2 | 2026-10-31 | build ok · typecheck ok · 499 testes · lint ok | 28280ef6 | `reach(targets, view?)` por chamada: `reachBend` (1,35/0,95) limita peito, escápula e esticada pelo ângulo do cotovelo, e `keepOutside` (0,005 m, 0,12 m) recua a mão ao longo do `forward` da câmera antes do IK; sem `view` idêntico; `elbowView` não portado |

## Medidas da T0.1

Protótipo: `examples/player-test-area/first-person-body.mjs` (corpo da 3ª pessoa visto de dentro, câmera nos olhos do corpo).

**Olho por pose** — altura acima dos pés e distância da câmera de hoje no chão:

| Pose | Câmera de hoje | Olhos do corpo | Olhos à frente da câmera |
|---|---|---|---|
| em pé | 1,700 | 1,768 | 0,196 |
| agachado (só o corpo) | 1,700 | 1,377 | 0,381 |
| caído | 1,700 | 0,415 | 1,422 |
| sentado (poltrona) | 1,090 | 1,325 | 0,086 |
| deitado (cama de casal) | 0,800 | 0,760 | 0,845 |

A câmera de hoje não acompanha o corpo: não cai, não agacha junto com a pose e, sentado ou deitado, fica no quadril ou na pelve. Isso
confirma a D1 (o corpo dirige o olho).

**Lente:** com cabeça (13 malhas sob `headG`) e pescoço (1 cilindro em `U`, y ≈ 1,63–1,70) escondidos, a parte do corpo mais perto
da câmera fica a **0,215 m** (o peito), em qualquer pitch entre −1,4 e 1,2 rad. Com plano próximo de 0,05 m, nada corta.

**Esconder a cabeça:**
- Sem esconder: a própria cara tapa a vista inteira.
- **Por camada** (D2): a cabeça some para a câmera, mas no three r160 a passagem de sombra testa a camada contra a câmera principal
  (`WebGLShadowMap.js:335`), então a sombra da cabeça some também. Isso viola o R3.
- **Por material:** clones dos materiais da cabeça e do pescoço com `colorWrite: false` e `depthWrite: false` em 1ª pessoa. Mesma
  imagem, e a sombra continua (o mapa de sombra usa o material de profundidade). O custo é que um espelho também não vê a cabeça.

**Propostas para decidir com o dono (mudam a D2):**
1. `eyeOffset` padrão `(0, −0,068, 0)` no referencial da cabeça: em pé dá 1,700 m, como hoje, e vale igual em todas as poses.
2. Esconder a cabeça **por material**, não por camada, para manter a sombra (R3). Espelhos ficam sem a cabeça em 1ª pessoa.
3. Plano próximo de 0,05 m em 1ª pessoa.
| T2.1 | 2026-10-31 | build ok · typecheck ok · test-room 252 testes · characters-three 501 testes · lint ok · e2e test-room 125 cenários + 169 verificações | aa755007 | corpo nas duas vistas, câmera no olho com recuo da parede, `reach` com a mesma vista nas duas, braços separados fora da sala; `room.look` de script mantém a vista até o jogador andar; testes da 1ª pessoa reescritos para o corpo; mão de apoio da M4/AK aceita até 65° (dono), reavaliar na T3.1 |
| T2.2 | 2026-10-31 | build ok · typecheck ok exceto game-weapons-three (testes ainda com `firstPerson`, T3.x) · test-room 254 testes · characters-three 503 testes · lint ok · e2e test-room 125 cenários + 171 PASS | 7dc60fa7 | tiro nas duas vistas sai do olho do corpo (teste); com corpo, `seating` e `furniture-push` não mexem mais no olho do jogador (`hasBody`); agachado do corpo mede ≈1,31 m (não 1,38) |
| T2.1 (correção) | 2026-10-31 | testes de mão do game-weapons-three | 24d46781 | os testes das armas passam a ler o estado de mão da sala, depois da T2.1 |
| T2.3 | 2026-10-31 | build ok · typecheck ok · test-room 254 testes · characters-three 505 testes · weapons-three 1437 (só o golden m2_flamethrower, como na main) · lint ok · e2e test-room 125 cenários | (este commit) | o item carregado vai na mão direita do corpo nas duas vistas, também nos usos (beber, servir, abrir): sem corpo continua à frente do olho |
| T3.1 | 2026-10-31 | build ok · typecheck exit=0 · weapons-three 1443 testes (inclui o golden m2_flamethrower, que passou aqui) · test-room 255 · characters-three 505 · contracts 89 · lint ok · e2e test-room 125 cenários + 171 PASS, 0 FAIL (inclui os close-ups da M4 e da AK em 1ª pessoa) · e2e weapons-test-area ok | 36422026 | arma no corpo, tamanho real, nas duas vistas (sem `HAND_OFFSET`, `HANDGUN_OFFSET` nem escala de 1ª pessoa; `box-fx` também). Mão de apoio: limite do e2e **65° → 55°**, em 1ª pessoa; medido 38–52° (M4 45–47°, AK 50–52°, 870 44–46°, pistola 38°, RPG-7 38–40°) com o cotovelo de apoio sob a arma (`elbowPoleSupport`); mais giro do peito (0,8 rad) não ajudou. Câmeras validadas: **1ª e 3ª pessoa**, em pé (nível, −1°), mirando para cima (+16°) e para baixo (−23°) e andando, Glock 17, Remington 870, M4A1, AK-47, RPG-7, machete, granada: cotovelo da mão de arma 84–93° (andando 84°), do apoio 61° (limite de visão) ou 74–86° na pistola; palma a ≤0,085 m do alvo (RPG: apoio a 0,09–0,14 m, a mão para antes do guarda-mão); mão à frente do peito 0,22–0,26 m (longas), 0,34–0,37 m (pistola), 0,26–0,35 m (machete e granada); 1ª e 3ª dão os mesmos números (±3° no apoio). Prints em `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/12e1c82a-9d50-40cb-90a9-3404b424885f/scratchpad/t31/shots/{first,third}-<arma>.png`. Mudanças que não estavam na task: o corpo do jogador sai do raio de contato e do laser (`userData.viewmodel`, senão o raio do olho parava no peito); `WALL_PULL.max` 0,7 → 1,2 m (arma de tamanho real é mais longa); `HAND_IN_VIEW.max` 0,18 → 0,3 m e mede as empunhaduras fixas no modelo (não as mãos, que vão ao ferrolho); arma sem coronha desliza até a empunhadura ficar a 0,25 m do bolso; arma curta de duas mãos vai ao meio do peito. Testes do checklist: a mão de empunhadura de arma longa fica ao lado do olho (a <0,3 m), fora da vista como na vida: só se exige na vista a mão a 0,3 m ou mais; a vista é refeita a cada arma (o coice não volta no corpo). Aberto: o RPG-7 deixa a mão de apoio a 9–14 cm do guarda-mão (antes 4 cm), pelo limite de cotovelo da vista. |
| T4.1 | 2026-10-31 | build ok · typecheck exit=0 · characters-three 504 testes · test-room 257 · lint ok (0 erros) · e2e test-room 171 PASS, 0 FAIL · e2e player-test-area 19 PASS, 0 FAIL (os cinco clipes de ataque, um impacto cada) | 211534a1 | `toRoomAvatar` perde `firstPerson`, `firstPersonClips` e `arms`: `strike()` toca só no corpo (`ATTACK_CLIPS`), o impacto devolvido sai do clipe do corpo, o guarda (`fight_guard`) também; `first-person/arms.ts` fica para a fase 5. Câmeras validadas: **1ª e 3ª pessoa**, soco, chute, empurrão e guarda: impacto 0,14 s (soco), 0,26 s (empurrão), 0,32 s (chute) nas duas; mão à frente do peito no soco 0,66 m no pico e no guarda 0,22–0,23 m (direita) e 0,36 m (esquerda), chute com a perna a 0,57 m; 1ª e 3ª dão os mesmos números (3ª com o clipe espelhado trocando de mão, por causa do soco alternado). Prints em `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/12e1c82a-9d50-40cb-90a9-3404b424885f/scratchpad/f4/t41-{punch,guard}-{first,third}.png`. |
| T4.2 | 2026-10-31 | build ok · typecheck exit=0 · test-room 259 testes (novo: a mão da porta passa pelo `reach` do corpo nas duas vistas) · characters-three 504 · game-player 47 · lint ok (0 erros) · e2e test-room 171 PASS, 0 FAIL + `doors-test` 9+9 OK · e2e player-test-area 19 PASS · interactables-test-area 44 PASS · floorplan-test-area 24 PASS, 0 FAIL | 3b4721d0 | `reachAvatar` entrega os alvos de `doors.handTargets()` a `avatar.reach(targets, { camera, keepOutside })`, o mesmo caminho da ferramenta e do item carregado (antes a porta só aparecia em `handState()` e o corpo ia só pela pose FK); a pose `door` (`RoomAvatarState.door`) segue valendo nas duas vistas. Sem caminho de mão separado para porta na 1ª pessoa. Câmeras validadas: **1ª e 3ª pessoa**, geladeira e guarda-roupa, abrir (puxar) e fechar (empurrar), em pé: palma a 0,06 m do puxador ao pegar (1ª 0,061–0,066, 3ª 0,060–0,069), mão à frente do peito 0,20–0,22 m ao pegar e 0,31–0,62 m na oscilação. Na oscilação a folha foge do alcance do braço (ombro a puxador até 1,2–1,5 m, braço ≈0,62 m): a mão estica até o limite e fica 0,1–0,9 m do puxador, igual nas duas vistas (o jogador não acompanha a folha). Prints em `/tmp/claude-1000/-home-miyazaki-Documents-personal-adatechnology-game-kit/12e1c82a-9d50-40cb-90a9-3404b424885f/scratchpad/f4/t42-door-{first,third}.png`. Aberto: a mão não acompanha o puxador na oscilação da folha (limite do alcance, não da T4.2). |
