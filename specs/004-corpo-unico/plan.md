# Plano — Spec 004

## Pacotes e o que cada um ganha

```text
game-characters-three
  player/avatar.ts       eye(): Vec3 (ponto dos olhos no mundo, depois da pose), setView('first' | 'third', camera),
                         camada HEAD_LAYER na cabeça (headG) e no pescoço (malha de U em y ≈ 1,63, achada por posição)
  player/arm-reach.ts    opção view: { camera, elbowView, reachBend, keepOutside(contact) } portada de first-person/arms.ts
                         (placeElbowInView :363-377, reachBend :390-393, keepOutside :287-298)
  player/room-avatar.ts  toRoomAvatar sem braços de 1ª pessoa; strike() só no corpo; reach() nas duas vistas
  first-person/          sai ao fim (fase 5): arms.ts, ik.ts (o ik passa para player/), types.ts, preset first-person-arms.json
game-characters-people   FIRST_PERSON_CLIPS e first-person-clips.json saem (fase 5)
game-test-room
  room.ts                cameraMode só troca a câmera; corpo sempre na cena; stepFirstPerson → reachAvatar nas duas vistas;
                         câmera da 1ª pessoa = eye() do corpo; followHeld sem ramo de espaço de câmera
  player.ts              CROUCH_DROP, setBend e a altura do olho por assento deixam de mover a câmera (o corpo move)
  furniture-push.ts      handTargets() vai para o corpo; setBend sai (a pose de empurrar curva o corpo)
  seating.ts             sem eye por assento: o olho vem do corpo sentado/deitado
game-weapons-three
  fx/viewmodel.ts        place() sempre no corpo (placeOnBody); HAND_OFFSET, HANDGUN_OFFSET e a escala de 1ª pessoa saem
game-contracts           nada novo: HandTargets e holdFrame já servem
```

## Fluxo por quadro (depois)

1. `player.update` (x, z, yaw, pitch, colisão).
2. `stepAvatar`: estado do corpo (andar, agachar, assento, empurrão, porta, arma) → pose.
3. Módulos posicionam a ferramenta no `holdFrame` do corpo.
4. `reachAvatar`: mãos do corpo nos `HandTargets` (com as restrições de vista em 1ª pessoa).
5. Câmera: em 1ª pessoa, `eye()` do corpo com yaw/pitch do jogador; em 3ª, `thirdPersonPose` como hoje.

## Porte, nunca reescrita

As restrições de vista, a mão e o IK já existem em `first-person/`: vêm para o corpo com os mesmos números (`elbowView
[0.96,-0.26,-0.06]`, `reachBend [1.35, 0.95]`, margem de 5 mm e 0,12 m do olho). As poses de 3ª pessoa já portadas (agachar, cair,
empurrar, porta, sentar, deitar) ficam como estão: elas passam a valer nas duas vistas.

## Riscos

- **O olho do corpo (1,768 m, 0,196 m à frente, medido na T0.1) não é o EYE da sala (1,7 m).** Mudar a altura da vista muda as medidas que os testes
  e2e conferem (régua, mira). Mitigação: `eyeOffset` por opção, com padrão que reproduz 1,7 m em pé; os testes de mira continuam
  partindo da câmera.
- **Braços entrando na lente.** Plano próximo de 0,05 m em 1ª pessoa e as restrições de vista do R4; teste de que nenhuma malha do
  corpo, fora as mãos e antebraços, fica a menos de 0,1 m da câmera.
- **Custo:** o corpo inteiro passa a ser desenhado em 1ª pessoa. Medir quadros por segundo na sala antes e depois (`room.metrics()`).
- **Conflito com o #110:** ele adiciona `doorPose` ao corpo e alvos de mão de porta na 1ª pessoa. Por isso as fases 2 a 4 esperam o
  merge dele (D4).
