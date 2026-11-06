---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

A weapon in each hand. `rules.dualWield` of the arsenal says which weapons go one in each hand (the pistols and revolvers by category, the Mini Uzi, Uzi, MAC-10, vz. 61, MP7 and the knives, machete and hatchet by id; a game changes the lists) and how much worse each one shoots then (`spread` 1.8x, `recoil` 1.35x); `canDualWield(arsenal, id)` answers it, and `setStance({ dualWield: true })` applies it and keeps the weapon from aiming. The contracts gain `ToolHand`, `HostTool.offHand` (the left hand's tool, with its own rounds and reload), `hand` on the tool events, a `MuzzleSource` and a `holdFrame` asked by hand. The weapon module draws the left hand's weapon out to the left, the left hand on the mirror of its grip, in both views (`VIEW_HOLD.dual`, `BODY_HOLD.dualGrip`, `oneHandHold`; a stock is folded while held in one hand), and lends each hand's muzzle, so each shot's flash and tracer leave its own gun. The test room: Shift+click in the weapon picker puts two of an eligible weapon in the hands (a second Shift+click changes the left one, a plain click goes back to one); the left mouse button fires the right hand, the right button the left hand (no aiming with two); R reloads the right one, then the left one; `room.setOffTool`, `room.offTool`, `room.useOff` and `room.reload`.
