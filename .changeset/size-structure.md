---
'@adatechnology/game-destruction': minor
---

New `sizeStructure(spec, { safety?, redundancy? })`: runs the world's own load solver on the intact spec and returns a copy where every structural part has `structure.capacity` set so its at-rest stress equals `safety` (default 0.65). With `redundancy` (for example 0.97) capacities are raised so that losing any single column keeps every other part at or below that stress (N-1 design). Parts without `structure` are left unchanged. Replaces hand-calibrated capacities.
