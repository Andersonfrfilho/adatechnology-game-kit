# @adatechnology/game-weapons-three

three.js presentation for `@adatechnology/game-weapons`: the real models of the arsenal, the weapon in the hands, ejected casings, sounds and the weapons test area.

## Licenses

The code is MIT. The `assets/weapon-svg/` thumbnails are not code and have their own licenses, which is why the `license` field is an expression:

- `assets/weapon-svg/generated/`: MIT, projected from the 3D models of this kit.
- `assets/weapon-svg/commons/`: outlines traced from drawings of Wikimedia Commons, each under the license of the original (CC BY-SA 4.0 and 3.0, CC BY 3.0, CC0, public domain). CC BY-SA stays CC BY-SA and CC BY needs the author's credit.

Read `assets/weapon-svg/LICENSE-NOTE.md` before redistributing the folder and keep `assets/weapon-svg/CREDITS.md` (author, license, link and modifications of every file) and `manifest.json` with it. The kit's demo site shows the same credits at `weapon-svg/credits.html`.

Unused generated fallbacks: every weapon keeps its `generated/` file even when it has a `commons/` one; the manifest does not reference those, they are what the weapon returns to if the Commons file is removed.
