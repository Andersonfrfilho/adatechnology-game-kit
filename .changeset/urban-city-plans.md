---
'@adatechnology/game-urban': minor
---

City plans (zoning): `urban.cities` with the registries of district kinds (22) and city plans (6: metropolis, regional city, port city, rail town, country town, mountain village), `layout(plan, { maxFloors, locale })` with `districtAt` (the last district wins) and the grid of `blocks` of a district, `stats` by kind and `fillBlock`, which fills a block through `block.fill` with the heights of its storeys. Opt-in data: nothing is drawn unless called. Options `cities.maxFloors` (60) and `districtKinds` / `cityPlans` under `packs`, `patch` and `remove`.
