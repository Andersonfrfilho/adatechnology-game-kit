# Tasks — Spec 002

Leia `spec.md` e `plan.md`. As fontes estão em `specs/001-migracao-entregas-dos-times/sources/`. Porte igual ao original (`CLAUDE.md`
§1): mesmas medidas, peças e movimentos, com nomes em inglês.

## Fase 0 — Contrato
> 🤖 Modelo: `sonnet`

- ✅ T0.1 `game-contracts`: `PlayerState` (`position`, `yaw`, `pitch`, `crouching`, `speed`, `running`, `cameraMode`) no
  `ModuleHost` (`host.player()`) e `HostEvent` `{ type: 'player' }` ao mudar agachar ou modo. Só genérico. Testes de tipo e de
  evento.

## Fase 1 — Dados do personagem
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 → `opus`)

- T1.1 🧠 `game-characters` (novo pacote, sem three): proporções do guia (P1) e as do jogo, esqueleto de 12 ossos (`livre:69660`),
  `ARM_RIG` do Elenco (`elenco:241-259`: ombro, braço, cotovelo, antebraço, mão, 4 dedos × 2 falanges, polegar, mount) com o perfil
  por manga (`short`, `long`, `tank`), `MOVES` (`elenco:358-364`), pegadas `oneHand`/`twoHand` (`retratos:332-336`), `walkCad` e
  `walkGait` (`livre:69833`), regra do agachar (velocidade 1,0, sem corrida, ruído 1 m, inclinação 0,25, quadril −0,35). Tudo por
  opção, com os valores do time como padrão. Golden dos números contra as fontes.

## Fase 2 — Braços e corpo no three.js
> 🤖 Modelo: `sonnet`

- T2.1 `game-characters-three`: `buildArms` portado do Elenco (`limb`, `mlimb`, `ball`, braço, mão, dedos, polegar, mount), material
  de pele, manga e luva por opção; `animateArms` com os `MOVES` e a curvatura dos dedos (`elenco:576-585`). Semente por chamada.
  Golden: hierarquia, medidas e rotações por pose.
- T2.2 `game-characters-three`: `buildPlayerBody` portado de `buildBody`/`bakeBody`/`bodyAnim`/`BodyBatch` (`livre:69693-69866`,
  `:70345`), com proporção do guia, LOD `[16, 10, 5]` e dedos só no LOD0 (D1). Poses 0, 2, 5 e a passada casada com o chão. Golden
  com a sequência de poses e o hash da geometria.
- T2.3 `game-weapons-three`: a arma vai para o `mount` da mão direita dos braços; arma longa com pegada de duas mãos; rotação de pegada
  por categoria; remover `HAND_OFFSET`; `BODY_ACTIONS` (mão, chute, empurrão, punhos) mostram os braços vazios. Os testes de fx
  continuam passando (coice, recarga, cápsulas, pentes).

## Fase 3 — Câmera
> 🤖 Modelo: `sonnet`

- T3.1 `game-camera`: porte do `cameraUpdate` (`livre:73367-73404`): amortecimento `1−e^(−12dt)` lido de `smoothing`, Q troca o
  ombro, 3 raios de parede com folga 0,3 e mínimo 0,2, retorno `e^(−4dt)`, FOV 65 e 65/zoom com zoom por arma vindo do
  `HostTool`, órbita ao morrer (raio 6, altura 3,5), altura agachado (1,4 no ombro, 1,15 na primeira pessoa), primeira pessoa
  automática com menos de 0,7 m livres (`:68400-68431`). `twist` do viewmodel lido a cada quadro. README, MIGRATION.md e golden da
  sequência de posições para uma entrada gravada.

## Fase 4 — Sala de testes e módulo
> 🤖 Modelo: `sonnet`

- T4.1 `game-test-room`: C alterna o agachar (tecla por opção, padrão C); 1,0 m/s agachado, sem corrida; olho desce com o
  amortecimento do `game-camera`; O troca o modo de câmera; publica `PlayerState` (T0.1). Texto da barra de controles no `locale`.
  E2E: agacha, a câmera desce, não corre, levanta.
- T4.2 `game-characters-three`: `createPlayerModule` (`TestableModule` com `attach`): braços em primeira pessoa, corpo em ombro e
  terceira pessoa, arma pelo `game-weapons-three`. Teste: com a ferramenta mão, os braços estão na cena e visíveis em primeira pessoa,
  e o corpo some.
- T4.3 `examples/characters-test-area` (build, test, entry, area) e área "Personagens" em `site/catalog.mjs`, com seletor de câmera,
  poses e agachar. As áreas existentes (`interactables-test-area` e demais) passam a carregar o módulo do jogador. E2E: abrir a
  `interactables-test-area` com a mão selecionada e encontrar os braços na cena (a queixa original).

## Fase 5 — Fechamento
> 🤖 Modelo: `sonnet`

- T5.1 Skills `.claude/skills/game-characters*/SKILL.md` e `game-camera` atualizadas; inventário da spec 001
  (`inventario/personagens-animais.md`) marcando o que entrou; tasks T4.1 (parcial) e T7.4 da spec 001 apontando para cá.
- T5.2 Revisão (`code-reviewer`) e verificação no navegador: a `interactables-test-area` mostra os braços com a mão; agachar
  funciona nos três modos de câmera; um print só, ao fim.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes do pacote (goldens incluídos), `pnpm lint`, skill do pacote atualizada, commit isolado por
task, evidência em `evidence.md`. PR ao fim da spec, mostrado no Chrome do dono; merge só com o ok dele.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/002-jogador-maos-camera/ do repositório adatechnology-game-kit, no worktree
~/Documents/personal/adatechnology-game-kit-wt/spec-002 (branch spec/002-jogador-maos-camera). Leia CLAUDE.md, spec.md, plan.md e
tasks.md antes de começar; as fontes estão em specs/001-migracao-entregas-dos-times/sources/ (elenco, retratos, jogo modo livre) com
as linhas citadas. Uma task por vez, na ordem do tasks.md.
Regra principal: portar o que os times fizeram, igual ao original (semente fixa, medidas, hierarquia, poses), nunca reescrever parecido.
Animação de chute, empurrão, soco, arremesso e recarga está fora do escopo: não inventar.
Modelos: Fases 0, 2, 3, 4 e 5 → executor model=sonnet · T1.1 🧠 → opus, validada por architect antes de implementar ·
revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm build + typecheck + testes (goldens) + lint + skill atualizada + commit isolado, evidência em evidence.md.
Ao fim: abrir o PR, mostrar no Chrome do dono e parar até o ok.
Pare e pergunte antes de: merge, deploy, publicar pacote no npm, qualquer escolha de negócio que a spec não cubra.
```
