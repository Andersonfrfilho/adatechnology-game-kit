---
'@adatechnology/game-destruction': patch
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

Houses and buildings of concrete are real structures in flexure (T10 §10). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
`maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
`beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
`slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
`game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
the joints of every wall standing on it.
