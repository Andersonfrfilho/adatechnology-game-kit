---
'@adatechnology/game-weapons-three': patch
---

Cápsulas e carregadores jogados pela arma na mão batem nas paredes, tetos e tudo o que a cena desenha, em vez de atravessar o concreto e só parar no chão: cada passo da peça em voo é sondado por `createSurfaceRaycast` (novo, sem o limite de 30 Hz do laser) e ela volta da superfície com a restituição dela. O raio ignora o que a própria arma joga (`userData.fxParticle`).
