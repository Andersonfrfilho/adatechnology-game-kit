---
'@adatechnology/game-audio': patch
---

`scripts/sfx-merge.mjs`: when `.sfx-local.json` links a game's sound folder, the test room also serves the `sfx:user` sounds the game's manifest does not answer (under `sfx-local/_sfx-user/`), so the game's folder no longer hides them; the game's manifest inside its own folder is no longer linked over its copy.
