---
'@adatechnology/game-vfx-three': patch
---

Black smoke (burning plastic, foam, rubber, asphalt) reads as a cloud, not as a flat black blob: the puff shader keeps a floor of albedo for the dark puffs, as soot still scatters some light, and lights their rim with the sky so the volume shows. Grey and white smoke, dust and fire keep the Lab's look.
