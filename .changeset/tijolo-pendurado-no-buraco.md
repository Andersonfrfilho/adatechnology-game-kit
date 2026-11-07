---
'@adatechnology/game-floorplan-three': patch
---

A parede não desenha mais tijolo pendurado onde a explosão levou a alvenaria. As unidades do mundo e os tijolos desenhados não têm as mesmas juntas (o mundo junta tijolos e desloca as fiadas pela amarração), e o desenho só apagava um tijolo coberto em 90% pelo buraco. Num foguete que derruba o vão entre dois pilares, isso deixava uma coluna de tijolos quebrados em fiadas alternadas junto a um dos pilares, sem nada embaixo. Agora o tijolo sai quando o mundo levou a maior parte dele e a unidade sob o seu meio.
