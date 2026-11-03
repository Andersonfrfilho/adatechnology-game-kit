---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-crowd-three': minor
---

The impostor tier of the economy ladder (with `variety`, `impostor: false` turns it off): `bakeImpostorAtlas` draws each silhouette (one per crowd type, from the far mesh of its first variant) on the CPU at 8 views and 8 steps of the walk into an RGBA8 atlas of bone, material class, shade and coverage (plus a colour layer), both `NearestFilter`; `createImpostorBatch` draws every far body in one call, picking its cell by the view angle and the walk phase, tinted per instance (shirt, trousers palette, missing limbs hide their bones). `createBlobShadowBatch` is the blob shadow under bodies beyond the nearest level. The renderer sends the bodies that walk past 90 m to the impostor batch and keeps the others on the far mesh. The identity extension recolours the legs above the shoes with the trousers palette, as the atlas does.
