---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
---

`assets/weapon-references.json`: a photo of the real weapon for each weapon of the arsenal, to compare each model with (123 of 141). Each one is a free Wikimedia Commons file (the image stays on the Commons servers) with its author, licence and page. A file a person checked is pinned (`pinned`, the G36C is not the G36); a weapon with no free photo of its exact model is listed in `missing` instead of borrowing another's. The weapon-thumbnails tool writes it (`node dist/cli.js references`).

The weapons area gets a showcase: the `showcase_weapon` control puts any weapon with a model on a pedestal (the buffet of the furniture catalogue) behind the counters, turning slowly (`showcase_spin`), takes the camera close to it (`showcase_look`) and shows the photo of the real one with its author and licence, so the model can be compared with it.

`BenchSheet.image` (game-contracts): a picture of the real thing a sheet is about, with its credit and page; the test room shows it over the scene, top centre, linked to its page.
