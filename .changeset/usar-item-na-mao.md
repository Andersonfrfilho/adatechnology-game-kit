---
'@adatechnology/game-contracts': minor
'@adatechnology/game-items': minor
'@adatechnology/game-items-goods': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-characters-people': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': minor
---

Usar o item na mão e golpes por família.

- `game-items`: usos na mão sem líquido (`HAND_USES`, `createHandUse`): comer com a mão em mordidas, tomar remédio, aplicar curativo, usar sabonete; `game-contracts` ganha `ModuleItemUse` (`TestableItem.use`).
- `game-items-goods`: `goodsItemUse` diz o uso e o efeito de cada item pelo tipo e pelos efeitos do catálogo (higiene ganha `use_hygiene` e o efeito `wash`; álcool na ferida aplica, não bebe).
- `game-weapons`: famílias de golpe (`MELEE_FAMILIES`): faca corta e estoca em sequência, facão/machadinha/martelo cortam de cima, taco/cano/pé de cabra/machado giram com as duas mãos; `game-weapons-three` dá o movimento de cada uma (`FAMILY_MOTIONS`) e `game-characters-people` os clipes do corpo `knife_slash` e `knife_stab`.
- `game-characters-three`: o corpo leva à boca o que se come ou bebe (comer de lata incluído) e junta as duas mãos no sabonete e no curativo (`AvatarItemUsePose.body`).
- `game-test-room`: F usa o item na mão com o rótulo do uso na legenda (pt-BR e en); a comida diminui a cada mordida e some no fim, o efeito vai para o aviso e o registro; o golpe das armas de família toca o clipe do corpo e o movimento da arma.
