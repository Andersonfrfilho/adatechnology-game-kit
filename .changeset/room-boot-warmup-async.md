---
'@adatechnology/game-kit-defaults': patch
'@adatechnology/game-test-room': minor
---

`warmUpAsync` no mundo do kit e na sala (`room.warmUpAsync()`): o aquecimento em várias tarefas para uma tela de carregamento esperar. A página da sala usa essa versão no fim da carga ("Preparando a imagem…"); a síncrona travava ~10 s numa tarefa só.
