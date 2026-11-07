---
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-vehicles-proving': patch
---

Correções da medição dos sons de veículo na sala:

- `slideOfGrip(uso)`: o `state.slip` do motorista semi é quanto da aderência o pneu usa, não quanto ele escorrega. A pista passava esse número direto e
  a derrapagem tocava durante toda a aceleração (3 s de pneu cantando num hatch que não patina). Agora só canta perto do limite e escorrega de vez
  saturado (roda patinando ou travada).
- `ProvingRun.input`: o que o procedimento do teste pede dos controles no último passo. A pista de testes tocava a frenagem de 100 a 0 com acelerador 1
  e sem freio, então nem o chiado das pastilhas nem a derrapagem soavam; agora passa freio, acelerador, RPM e aderência do teste (e o freio do
  cockpit, `Cockpit.brake`, ao dirigir).
- `sound-probe.mjs` grava `set` e `stop` sobre o próprio laço do motor de áudio, em vez de trocar por um objeto só com os dois métodos.
