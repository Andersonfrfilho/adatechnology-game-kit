---
'@adatechnology/game-vehicles-three': minor
---

The vehicles area of the test room has the burnt wrecks `sedan_burnt` (Burnt sedan / Sedã queimado) and `hatch_burnt` (Burnt hatch / Hatch queimado), built with the fleet's `burnt` scenario through `kit.build(key, state, { scenario })`. The list is the `wrecks` option of `VehiclesTestOptions` (`{ key, vehicle, scenario }`, default `DEFAULT_TEST_WRECKS`, `[]` lays none), and the new scenario `vehicles_burnt_wreck` checks the burnt flag and the glass at 0.
