---
'@adatechnology/game-weapons-three': minor
---

The weapons area draws each modeled weapon on a counter as one mesh per material (the model baked into its group and joined), instead of one mesh per part: about 12x fewer draw calls. The weapon in the hands keeps the model with its pivots. Archetypes that only borrow the model of a brand weapon (`ARCHETYPE_MODELS`) are no longer laid on the counters next to that brand; they stay in the catalogue and can still be held.
