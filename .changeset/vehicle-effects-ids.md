---
'@adatechnology/game-vfx': minor
'@adatechnology/game-vehicles-three': minor
---

game-vfx: `GAME_EFFECTS` ganha `vehicle_fire`, `vehicle_exhaust` e `vehicle_leak`, as receitas `engine_smoke` e `fuel_leak` da Garagem escritas em torno de um carro (âncora no carro da Oficina) para tocar no ponto do veículo. game-vehicles-three: o módulo pede a `host.effects` ids que existem (`car_fuel_tank`, `glass_burst`, `impact_metal` e as três acima), no formato do `EffectSink`.
