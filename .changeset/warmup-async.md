---
'@adatechnology/game-render-three': minor
'@adatechnology/game-kit-defaults': patch
---

Aquecimento de shaders em várias tarefas (`ProgramWarmup.warmUpAsync`): cada estado de neblina é linkado em paralelo (`compileAsync`) antes de ser desenhado, e cada estado, efeito e lote de programas ganha a própria tarefa. O host do mundo (`createKitWorld`) usa a versão assíncrona e não desenha mais nada enquanto ela roda. O aquecimento desliga `checkShaderErrors` do three (três leituras de log síncronas por programa, 19 s na carga da sala) e confere o `LINK_STATUS` de cada programa. Na carga da sala de teste, a tarefa única de 21 a 25 s some (o navegador mostrava "Página sem resposta").
