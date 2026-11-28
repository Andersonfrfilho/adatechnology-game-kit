---
'@adatechnology/game-items': minor
'@adatechnology/game-items-goods': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-characters-people': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': minor
---

Golpes legíveis e o uso das ferramentas na mão.

- `game-weapons-three`: um movimento pode girar em torno da mão que segura (`ToolMotion.pivot: 'grip'`), não do olho; a faca corta com a lâmina deitada atravessando a vista e estoca com a ponta para dentro, as duas visíveis em 1ª pessoa; no corpo a mão não larga a ferramenta no fim do golpe (alcance do braço). Taco, taco com pregos, cano, pé de cabra e marreta ganham pegada de duas mãos.
- `game-weapons` e `game-characters-people`: família `bat_swing` (taco, taco com pregos, cano, pé de cabra, marreta) com a tacada própria: preparo atrás do ombro, giro na altura do peito e acompanhamento por cima do outro ombro (clipe `bat_swing`); machado, picareta e katana ficam com o giro baixo da pá.
- `game-items` e `game-items-goods`: usos `toggle_flashlight`, `light_lighter`, `use_radio` e `turn_key` (lanterna, isqueiro, rádio e walkie-talkie, chaves), corpo `hand` e `reach`, e `aimHandUse` leva a chave até a fechadura mirada.
- `game-characters-three`: o braço se estende à frente no uso `reach`.
- `game-test-room`: F liga e desliga a lanterna (luz do orçamento de luzes saindo da lente), acende e apaga o isqueiro (chama que tremula), fala no rádio e gira a chave na fechadura da porta na mira (tranca e destranca) ou no ar; rótulos em pt-BR e en.
