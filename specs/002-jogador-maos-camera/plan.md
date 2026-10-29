# Plano — Spec 002

## Pacotes e o que cada um ganha

```
game-contracts        + PlayerState no ModuleHost (pos, yaw, pitch, crouching, speed, cameraMode) e HostEvent 'player'
game-characters       NOVO, sem three: proporções (P1), esqueleto de 12 ossos, ARM_RIG do Elenco (medidas e dedos),
                      MOVES (idle/walk/run/crouch/aim/turn), pegadas (one-hand, two-hand), walkCad/walkGait, regras do agachar
game-characters-three NOVO: buildArms (Elenco, CPU, com mount) · animateArms (MOVES + grip) ·
                      buildPlayerBody (bakeBody + bodyAnim do jogo, LOD 16/10/5, dedos só no LOD0) · createPlayerModule (attach)
game-camera           + câmera de ombro do jogo (V7), smoothing lido, twist ao vivo, FOV por zoom, primeira pessoa automática,
                      órbita ao morrer, altura agachado; viewmodel vira a âncora única dos braços
game-weapons-three    fx usa a âncora dos braços: a arma vai no mount da mão direita; pegada de duas mãos na arma longa;
                      HAND_OFFSET some; BODY_ACTIONS mostram os braços vazios
game-test-room        C agacha (tecla configurável), O troca o modo de câmera via game-camera, publica PlayerState
examples/characters-test-area  NOVO: módulo do jogador + troca de câmera + poses + agachar
site/catalog.mjs      área "Personagens"; as áreas existentes carregam o módulo do jogador
```

## Fluxo por quadro

```
sala (teclado/mouse) → PlayerState (crouching, speed, yaw, pitch) → host.on('player') / host.onFrame
  → game-camera.update(camera, target, dt, collide, ceiling)       posição e FOV
  → isFirstPerson ? arms.visible, body.hidden : body.visible
  → animateArms(arms, move, grip, tool)                            pose do Elenco
  → weaponFx.update(dt)  (arma presa no mount da mão)              coice e recarga já existentes
```

## Porte, nunca reescrita

- Braço e mão: copiar `elenco.js:134-136` (`limb`, `mlimb`, `ball`) e `:241-259` com as mesmas medidas e nomes de peça traduzidos
  (`hg` → `hand`, `fg`/`f2` → `finger`/`fingerTip`, `th` → `thumb`, `el` → `elbow`, `mount`). O `R=rng(77)` global vira semente por
  chamada (decisão 15 do inventário: aceita).
- Corpo: `livre.js:69660-69866` e `bakeBody :70345`, com as juntas recalculadas para a proporção do guia (P1). O golden compara
  ossos e poses com o original na proporção original e confere a escala separadamente.
- Câmera: `livre.js:73367-73404` e `:68400-68431` dentro de `game-camera`; `CameraModosSDK :7560-7639` é a referência dos padrões
  de terceira e primeira pessoa.
- Agachar: `livre.js:72890-72930`, `:73360-73362`, `:73383`.

## Riscos

- O Elenco pendura o item em −y no `mount`, e o kit monta a arma em +z/x (`pointForward`). Uma rotação de pegada por categoria
  resolve sem mexer nos modelos (T2.3).
- `Ctrl` no navegador: `Ctrl+W` fecha a aba. Por isso a sala usa só C (R5).
- Mudar o `game-camera` quebra quem usa? Nada no repositório depende dele hoje. Mesmo assim, a API pública só ganha campos
  (MIGRATION.md).
