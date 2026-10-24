---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-weapons-three': minor
---

Item thumbnails. `game-contracts`: `TestableItem.thumbnail?` (an image URL or inline `<svg…>` markup), optional and additive. `game-test-room`: `TestRoomItem.thumbnail` and `InspectInfo.thumbnail`; the room draws the picture above the name in the catalogue buttons, in the search results and in the inspector of the aimed item, as a CSS mask over the text colour (a one-colour SVG follows the theme, tones go in opacity; an item without a thumbnail shows its name only).

`game-weapons-three`: a thumbnail for every weapon of the arsenal and for the explosives that stand in the world. `assets/weapon-svg/generated/` holds a side-profile silhouette of the 3D model of each one (4:1, `currentColor`, deterministic, about 2 KB each), `commons/` the outline of a freely licensed Wikimedia Commons drawing where one was found (its own licence, see `LICENSE-NOTE.md`, `CREDITS.md` and `manifest.json`); `WEAPON_THUMBNAILS`, `weaponThumbnailUrl(id, base?)` and `DEFAULT_THUMBNAIL_BASE` resolve them (Commons first), and `createWeaponsTestModule({ thumbnailBase })` fills `TestableItem.thumbnail` (default `weapon-svg/`, `false` for none). The package now publishes `assets/`. The site build copies the folder to `site/dist/weapon-svg`.
