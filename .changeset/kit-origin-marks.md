---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-animals-three': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-crowd-three': patch
'@adatechnology/game-floorplan-three': patch
'@adatechnology/game-interactables-three': patch
'@adatechnology/game-items-three': patch
'@adatechnology/game-urban-three': patch
'@adatechnology/game-vegetation-three': patch
'@adatechnology/game-vehicles': patch
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-vfx-three': patch
'@adatechnology/game-weapons-three': patch
---

Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
