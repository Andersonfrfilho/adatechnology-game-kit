---
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-commercial': patch
'@adatechnology/game-floorplan-residential': patch
'@adatechnology/game-urban': minor
---

Skyscrapers are limited to 60 storeys by default (owner, 2026-10-25), configurable. `game-floorplan-structure`: `SKYSCRAPER_MAX_STOREYS` (60), the
default `range` is `[20, 60]` and `SkyscraperOptions.range` raises it. The office and residential tower presets follow it, and the zone `zt` is now 60
storeys and 240 m. `game-urban`: `towers.maxStoreys` (default 60), per-preset `minStoreys`/`maxStoreys` and `towerPresetOf`.

`skyscraperLayout` sizes the bays by the wind (`sizeForWind`, default on, above 180 m): a 60-storey tower passes H/500 (1/521) with 14.5 m bays; `false` keeps the raw layout.
