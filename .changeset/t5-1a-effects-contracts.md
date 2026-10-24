---
'@adatechnology/game-contracts': minor
---

Effects the host lends, types first (T5.1a). New `EffectSink` (`play`, `stop`, and optional `configure`, `stats`, `catalog`), `EffectRequest` and `EffectHandle`, and `ModuleHost.effects`. The `explosion` `HostEvent` gains `explosive` (the id of the explosive), `PartSpec.explodes` gains `effect` and the `explode` destruction event carries it. The bench gains `ChoiceOption.group` (options listed under a heading; `checkBench` rejects a group that is split or empty) and `ModuleBench.sheet(BenchSheet | null)` with the `BenchSheet` card (kicker, title, body, facts, steps, swatches, note and a timeline whose playhead follows a module metric). All additive; a host that does not lend `effects` or `sheet` keeps working.
