---
'@adatechnology/game-physics-jolt': patch
'@adatechnology/game-destruction-three': patch
---

Correções da auditoria do motor de física. `game-physics-jolt`: a regra "não colidir" entre dois corpos sai com o corpo removido (o Jolt reaproveita o número, e o próximo corpo herdava a regra: um caco caído sobre o poste parava dentro dele); a moto (duas rodas em linha) é lida com as suas 2 rodas e a roda motriz tem diferencial próprio; erro em `createBodies` não deixa mais corpos nem o vetor de ids no heap. `game-destruction-three`: uma peça que dormia no último passo do motor e é acordada e removida no mesmo quadro acorda o que estava em cima dela (§12); o teste da subida do chão mede a penetração real da ponta (8 mm, limite 1 cm); `pnpm test:jolt` roda os blocos só do modo Jolt, agora no CI.
