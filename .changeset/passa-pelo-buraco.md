---
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

O corpo passa pelo buraco que o tiro ou a explosão abriu na parede. O `follow` da parede das casas (`wallPiece`) ganhou `blocks(x, z, raio, y0, y1)`, que diz se a parede, como está desenhada agora, segura um corpo naquele ponto: onde os tijolos saíram, o corpo passa; os pilares e o resto da parede seguram. Vale também para a parte da parede que se soltou e ficou em pé como peça (`owns` diz quais objetos do mundo ela responde). A sala de teste usa isso para o jogador: a parede de alvo deixou de ser um muro que fecha a arena de ponta a ponta (só os lados dela continuam fechados) e não é mais medida pela caixa inteira quando o seu `follow` responde por ela.
