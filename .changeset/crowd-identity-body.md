---
'@adatechnology/game-characters-three': minor
---

Identity for the instanced body (option `identity`, default off): the `iD` attribute and `BODY_CHUNK_EXT` (after the game's chunk, which stays byte for byte) give each body a gait style (limp, drag, lurch, shamble), a stagger pose (index 8), the lean of a shove, a 16-colour trousers palette and wound splashes by region with freshness. `createBodyMaterial` takes `identity`, `accessory` and `distance` (a `customDistanceMaterial` for point-light shadows) and sets `customProgramCacheKey` only with them. Accessories (`KIT_ACCESSORIES`: cap, helmet, backpack, hood) are baked once from the kit's survivor builder in a unit frame and placed per variant by `iAcc` (`accessoryPlacement`). `packIdentity` and `unpackIdentity` hold the layout.

Fix: `accessoryPlacement` reads the head (bone 1, eyes left out) and the torso (bone 0) of a baked body, which marks skin, hair and trousers as one own-colour material; it used to look for skin and found nothing, so every accessory sat unscaled at the feet. A body without a head or a torso gets a zero scale: the accessory is not drawn.
