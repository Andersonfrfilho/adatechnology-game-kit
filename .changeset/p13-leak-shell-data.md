---
"@adatechnology/game-weapons": minor
---

`ExplosiveDef` gets two optional blocks for a world explosive that is a pressure vessel: `leak` (`fluid`, `liters`, `pressurized`, `igniteDelay`, `hissSeconds`: what it holds and when a leak catches fire as a torch) and `shell` (`launchSpeed`, `trailSeconds`: what is left of it after the blast). `propane_p13` carries the Laboratório de Explosões values (24 l of gas, torch after 0.8 s, shell up at 13 m/s with a 1.8 s fire trail) and a mass of 28 kg (15 kg tare plus 13 kg of gas); `checkArsenal` validates them.
