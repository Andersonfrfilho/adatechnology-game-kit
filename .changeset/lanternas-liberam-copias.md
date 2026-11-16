---
'@adatechnology/game-vehicles-three': patch
---

`createVehicleLamps.dispose` libera também a cópia do material de uma lâmpada que o tiro apagou (antes o retorno antecipado a deixava na GPU).
