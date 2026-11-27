---
"@adatechnology/game-physics": minor
"@adatechnology/game-crowd-three": minor
"@adatechnology/game-vehicles-three": minor
---

Com o laço do motor, o módulo da multidão da sala cria os agentes como cápsulas cinemáticas e as portas como folhas numa dobradiça que cede, e solta tudo ao sair; o carro físico da sala atropela a multidão (`createRunOver`, o agente derrubado vai a `Crowd.knockDown`). Os dois módulos se encontram pelo canal novo `PhysicsServices.channel(name)` (`CROWD_AGENTS_CHANNEL`), em qualquer ordem. Com `hordeThread` ou sem serviços (`own`) nada muda.
