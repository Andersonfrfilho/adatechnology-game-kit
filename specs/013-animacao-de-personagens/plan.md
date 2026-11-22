# Plano — Spec 013

## Pacotes e o que cada um ganha

```text
game-characters (núcleo puro)
  anim/graph.ts          estados, transições (duração, curva, condição), fase compartilhada entre estados de locomoção
  anim/layers.ts         camadas com máscara por canal, peso e modo (substitui | aditivo)
  anim/curves.ts         curvas por chave (ease in/out, antecipação, overshoot); pose-clip.ts passa a usá-las
  anim/locomotion.ts     velocidade 2D + giro -> pesos de frente/ré/lateral; cadência e passada de andar e correr (stride.ts)
  anim/aim.ts            distribuição do pitch e do yaw em coluna, peito, ombro e cabeça
  anim/foot-ik.ts        solver de 2 ossos + tornozelo, compensação do quadril (puro, recebe alturas do chão)
  data/anim-graph.json   o grafo do humano e o do zumbi (dados; trocar não mexe em código)
game-characters-people   clipes de reação, morte e levantar (dados); os 11 de ataque com curvas
game-characters-three
  player/avatar.ts       consome o grafo; saem a cadeia de if/else, setPose paralelo e as poses constantes
  rich/animator.ts       aplica a pose final (canais) e os canais novos (tornozelo, coluna em 2 segmentos, se a 014 já os der)
  rich/ragdoll.ts        monta o ragdoll do game-physics a partir do rig e devolve a pose por quadro
  first-person/          sai (spec 004 T5.1); ik.ts vai para player/
  instanced/body-chunk   mistura de duas poses (índice A, índice B, peso); impostor com estados
game-physics-jolt        o que faltar da Fase 5 da spec 008 para o ragdoll do corpo
game-test-room, game-weapons-three   passam a pedir estados e camadas, não poses
```

## Decisões de desenho

- **Contrato antes do conteúdo** (🧠 T1.1): o grafo, as camadas e as curvas são tipos e funções puras do núcleo, testados sem
  three.js. É o que atende a D2: melhorar depois é trocar dado ou implementação atrás do mesmo contrato.
- **Fase compartilhada:** andar e correr leem a mesma fase normalizada (0 a 1 por ciclo); a cadência muda a velocidade da fase, nunca
  o valor. Resolve o tranco da A4 na raiz.
- **Correr:** a passada vem da mesma conta do andar (`walkGait`) com fase aérea; nada de amplitude fixa.
- **Canais:** os 17 atuais continuam; canais novos (tornozelo, giro da perna e do antebraço, segunda vértebra) entram como
  opcionais, e o `animator` ignora os que o corpo não tem. A multidão continua com 12 ossos.
- **Ragdoll:** só o corpo rico perto da câmera; a multidão continua no equilíbrio próprio (`balance.ts`). Limite de ragdolls
  simultâneos no dado, com degradação para o clipe de morte.
- **Trabalho pesado** (cozimento de textura de clipes) passa pelo `game-workers` (§14).

## Riscos

- `avatar.ts` é o ponto mais usado da sala: migrar atrás de opção (`graph: true`), comparar por prints e só então remover o caminho antigo.
- Ragdoll no Jolt depende da Fase 5 da spec 008: se estiver bloqueada, R9 fica isolada na fase 6 e não trava o resto.
- Sessões 010 e 011 mexem em `game-test-room`: rebasear antes de cada fase.

## Dependências

A R10 pede o tornozelo da spec 014. A spec 015 (golpes) depende das camadas (fase 2). A 012 dá a altura que os testes varrem.
