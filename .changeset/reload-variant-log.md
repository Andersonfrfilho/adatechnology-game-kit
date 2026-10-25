---
'@adatechnology/game-weapons-three': minor
---

The reload log says which variant played: `WeaponFx.clips` gives the clips playing with their seconds, and the weapons area logs `kind`, the clip (`reload` or `reload_empty`) and its seconds at every reload start (pt-BR and en). Tests: an empty weapon plays `reload_empty`, one with a round chambered the tactical `reload`.
