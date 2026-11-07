---
'@adatechnology/game-audio': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-destruction-three': minor
---

Recorded sounds for the vehicles: 52 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. Hood opening (`car_hood_open`) and closing (`car_hood_shut`, which answers `car_hood_close`), car crashes by speed (`crash_dent`, `crash_fold` and `crash_wreck` answer `crash_light`, `crash_medium` and `crash_heavy`), horns of a car, a truck and a motorcycle (`horn_car`, `horn_truck`, `horn_bike`), the air brake of a truck (`air_brake`), tyres squealing on asphalt (`tire_skid_asphalt`) and rolling on gravel (`tire_roll_gravel`), and the idle of a truck and of a motorcycle (`engine_truck_low`, `engine_bike_low`). `createVehicleSound` rolls on gravel with its own loop when the surface is `dirt` and lets the air out of a truck's brakes as it stops (`VehicleSoundOptions.airBrake`); the proving area takes the engine profile and the horn from the vehicle's group (`engineProfileOfGroup`, `hornOfGroup`). The vehicle's hood opens with `car_hood_open` in the destruction sound. Recipes of the same ids stay as the fallback while a file decodes (new ones: `car_hood_open`, `horn_bike`, `air_brake`, `tire_roll_gravel`).
