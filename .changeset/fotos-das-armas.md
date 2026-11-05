---
'@adatechnology/game-weapons-three': patch
---

`assets/weapon-references.json`: a photo of the real weapon for each weapon of the arsenal, to compare each model with (123 of 141). Each one is a free Wikimedia Commons file (the image stays on the Commons servers) with its author, licence and page. A file a person checked is pinned (`pinned`, the G36C is not the G36); a weapon with no free photo of its exact model is listed in `missing` instead of borrowing another's. The weapon-thumbnails tool writes it (`node dist/cli.js references`).
