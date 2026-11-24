---
'@adatechnology/game-kit-defaults': minor
---

`createKitWorld(THREE, options)` na entrada `/world` (spec 011, T1.3): o host do mundo monta renderer, sol, terreno, mundo e renderizador da destruição, líquidos, som com oclusão, efeitos, orçamento de luzes, física (Jolt por padrão), workers, agendador com as fases da sala e o laço. Liga por padrão o marca-passo da explosão, a política D4 dos destroços e o chão no worker (só com workers de verdade); cada um desliga por `false`. `game-physics-jolt` e os adaptadores usados passam a dependências; `three` é peer.
