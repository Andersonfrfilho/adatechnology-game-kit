# Spec 002 — Jogador: corpo, mãos em primeira pessoa, câmeras e agachar

Adianta da spec 001 a parte do jogador nas fases 4 (T4.1, `game-characters`) e 7 (T7.4, câmera de ombro, V7). Pedido do dono em
2026-10-23: "ta com a mão selecionada mas não temos nada na tela" na `interactables-test-area`; "deveríamos poder agachar".

## Por quê

Na sala de testes, com a ferramenta **mão** selecionada, não aparece nada. Com a pistola também não, porque essa área não carrega o
`game-weapons-three`. Hoje o SDK não tem personagem. A câmera do `game-camera` está atrás da câmera do jogo: o `smoothing` nunca é
lido e o `twist` do viewmodel é fixado na criação. A sala de testes também não deixa agachar. Os times já entregaram tudo o que falta:

| O quê | Fonte (em `specs/001-migracao-entregas-dos-times/sources/`) | O que tem |
|---|---|---|
| Braço e mão articulada | Elenco `zumbis-personagens__elenco.js:241-259` | ombro ±0,305 a 1,475 m, braço 0,31, antebraço 0,29, mão a −0,30, palma, 4 dedos de 2 falanges, polegar, `mount` do item |
| Pegada das duas mãos (arma longa) | Retratos `sobreviventes__retratos-do-vale.js:221-241, 332-336` | `arm.grip`: ombro −0,75, cotovelo −1,1, dedos 1,25 |
| Poses e dedos | Elenco `:358-364` (`MOVES`), `:576-585` | idle, walk, run, crouch, aim, turn; curvatura dos dedos por `grip` |
| Corpo do jogador e animação na GPU | Jogo `jogo__zombiada-modo-livre.js:69660-69866`, `bakeBody` `:70345`, `PB` `:72794-72807`, desenho `:74826` | 12 ossos, poses (0 andar … 5 agachado … 7 comendo), `bodyAnim`, passada casada com o chão (`walkCad`, `walkGait` `:69833`) |
| Mão no braço armado | Jogo `playerHand()` `:73355-73365`, `:73402-73406` | ombro → cotovelo → mão na CPU, inclinação e agachar, coice `shotKick` |
| Câmera de ombro | Jogo `cameraUpdate` `:73367-73404` | distância 3,8/1,7, lado 0,9, altura 1,95/1,4 amortecidas `1−e^(−12dt)`, Q troca o ombro, 3 raios de parede, FOV 65/zoom por arma, órbita ao morrer |
| Modos de câmera | Jogo `CameraModosSDK` `:7560-7639`, adaptador `:74854-74888`, casa `:68400-68431` | ombro, terceira, primeira; corpo escondido em primeira pessoa; primeira pessoa automática em espaço apertado (<0,7 m) |
| Agachar | Jogo `:72890-72930`, `:73360-73362`, `:73383` | C ou Ctrl alterna; 1,0 m/s; não corre agachado; passo faz 1 m de ruído (3 andando); inclinação 0,25; quadril −0,35; câmera 1,4 (ombro) e 1,15 (primeira pessoa) |

## Requisitos

- R1. **Mão na tela.** Em primeira pessoa aparecem os braços do jogador portados do Elenco (braço, antebraço, mão com dedos e
  polegar). Com a mão vazia, a pose é a do Elenco (`idle`, dedos em `grip` de repouso); segurando, os dedos fecham (`grip` 1,25).
- R2. **Arma na mão.** A arma do `game-weapons-three` vai para o `mount` da mão direita. Arma longa usa a pegada das duas mãos dos
  Retratos. Existe uma âncora só para a mão e a arma: acabam os dois deslocamentos soltos (`HAND_OFFSET` do `fx.ts` e
  `viewmodel` do `game-camera`).
- R3. **Corpo do jogador** em ombro e terceira pessoa: execução do jogo (12 ossos, `bodyAnim`, passada casada com o chão) com a
  proporção do guia (P1: 1,80 m, ombros 0,60 m, cabeça 1/6). Em primeira pessoa o corpo some e ficam só os braços.
- R4. **Câmeras.** O `game-camera` passa a ter a câmera de ombro do jogo (V7): amortecimento, troca de ombro, 3 raios de parede,
  FOV por zoom da arma, órbita ao morrer, primeira pessoa automática em espaço apertado. O `smoothing` passa a ser lido e o `twist`
  do viewmodel muda em tempo real. Tecla para trocar o modo (O, como no jogo).
- R5. **Agachar** igual ao jogo: C alterna; 1,0 m/s; não corre agachado; ruído de passo 1 m; corpo com inclinação 0,25 e quadril
  −0,35; câmera em 1,4 m (ombro) e 1,15 m (primeira pessoa), com o mesmo amortecimento. Na sala de testes o `Ctrl` não é usado: no
  navegador `Ctrl+W` fecha a aba. A tecla é configurável, e o jogo pode pôr o Ctrl de volta.
- R6. **Igual ao original** (G3 da spec 001): golden com semente fixa para o braço e a mão (medidas e hierarquia), o corpo (ossos e
  poses) e a câmera (sequência de posições para uma entrada gravada).
- R7. **Sala de testes.** `examples/characters-test-area` com troca de câmera, agachar, todas as ferramentas e as poses. A
  `interactables-test-area` e as demais áreas também passam a mostrar os braços e a arma.
- R8. Motor genérico: nada de ZombiAdA no código. Profissões, roupas nomeadas e o jogador "você" ficam no conteúdo.

## Decisões (2026-10-23)

- D1. **Dedos** (pergunta 14 do inventário). Valem nos braços em primeira pessoa e no LOD0 do corpo; somem do LOD1 em diante.
  Decidido por mim, porque o dono delegou o que não é escolha de negócio. Os braços em primeira pessoa são uma instância só, então o
  custo é desprezível.
- D2. **Braços em primeira pessoa são hierarquia de objetos na CPU** (como no Elenco), não a GPU do corpo: é uma instância só, e os
  dedos e a pegada precisam de ossos que o corpo de 12 ossos não tem.
- D3. **Pacotes.** `game-characters` (dados: proporções, esqueleto, poses e movimentos, sem three.js) e `game-characters-three`
  (construtores e animação). Os dois são o começo da T4.1 da spec 001, que depois soma zumbis e desmembramento sem mudar a base.
- D4. **Agachar e o estado do jogador** ficam no contrato genérico do host (`ModuleHost` e `HostEvent`): posição, guinada,
  arfagem, agachado, velocidade e modo de câmera. A sala de testes só publica esse estado; quem desenha é o módulo. O fôlego e o
  ruído completos ficam para o `game-player` (V6). Aqui entra só o que o agachar precisa.

## Fora do escopo

- **Animação de chute, empurrão, soco, arremesso, recarga e golpe corpo a corpo.** Não existe em nenhuma entrega: no jogo são só
  regra, e a recarga é um tempo com som. Até um time entregar ou o dono pedir, a ferramenta segue funcionando e os braços ficam na
  pose de repouso. Está na lista de perguntas ao dono, não é para inventar.
- Zumbis, desmembramento, NPCs e animais (resto da fase 4 da spec 001).
- Arte definitiva.

## Pontos em aberto

Nenhum que bloqueie. As perguntas de animação (fora do escopo) vão para o dono ao fim da spec.
