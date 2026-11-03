---
'@adatechnology/game-audio': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

Vehicle sounds that follow what the vehicle does. `game-audio`: a loop can carry a `falloff` and `pan`, and `set` takes a `position` (level and side from the listener, duller far away) and a `cutoff` (the first filter); the sink passes `params.cutoff` and the position through. `game-vehicles-three`: `VEHICLE_SOUND_BANK` and `createVehicleSound` — the engine as loops crossfaded by RPM at the firing frequency (car, truck, bike profiles), louder and brighter under load, an RPM guessed through gears for drivers without an engine model, the starter (catching with a flare, or failing), ignition off, tyres squealing on asphalt or hissing on dirt by slip, road noise by speed, crashes light / medium / heavy by speed, and car doors, trunk and hood. The vehicles area turns the key before the lane car pulls away. `game-test-room`: a leaf of an object tagged `vehicle` plays `vehicle_<door|trunk|hood>_<open|shut>`; `game-destruction-three` maps those to the car sounds, falling back to the old latch and metal shut when the vehicle bank is not loaded (`SoundKeyRule.fallback`).
