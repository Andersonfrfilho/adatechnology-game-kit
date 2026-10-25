---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-floorplan-structure': minor
---

Real structure (T10, steps 1 and 2). `game-contracts`: `PartSpec.structure.rebar` (`TensionRebar`: `ratio`, `yieldMPa`, `cover`), `PartState.flexure`
and `PartState.cracked`. `game-destruction`: concrete (C25) and ceramic brick get `MaterialDef.strength` and capacities from the real strengths
(NBR 6118, NBR 16868-1 slenderness, reinforced columns `0.85 fck Ac + As fy`), so an overloaded bearing wall crushes at the ground floor first;
beams and slabs with `structure.rebar` bend (`structure.flexure`, scope `'rebar'` by default): the tension face cracks under a blast and the steel
holds, a plain beam snaps, yielded steel past 10° hinges and the part falls in one piece; `sizeRebar`, `bearingWallThickness`, `buildFrame({ rebar })`;
`rebar` joints of reinforced parts no longer wear under blows. Documented capacities change (a 30 x 30 cm concrete column now 203 t, a 20 cm brick
wall 41 t per metre). `game-floorplan-structure`: `toDestructibleSpec({ rebar })` (off by default) declares and sizes the steel of concrete beams
and slabs (`REBAR_RATIOS`).
