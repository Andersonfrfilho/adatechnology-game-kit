# Tasks — Spec 004

Leia `spec.md` e `plan.md`. Porte o que já existe em `first-person/` para o corpo com os mesmos números (`CLAUDE.md` §1). Toda
mudança de estado do jogador aparece nas duas vistas, no mesmo commit.

## Fase 0 — Desenho
> 🤖 Modelo: `opus` (T0.1 é 🧠)

- T0.1 🧠 Protótipo na `player-test-area`: corpo visível em 1ª pessoa com a câmera em `eye()`, cabeça e pescoço na `HEAD_LAYER`.
  Decide `eyeOffset` (padrão que dá 1,7 m em pé), plano próximo e a lista de malhas escondidas. Registra as medidas em
  `evidence.md`. Validar com `architect` antes da fase 1.

## Fase 1 — O corpo sabe ser visto de dentro (aditiva, pode rodar antes do #110)
> 🤖 Modelo: `sonnet`

- T1.1 `game-characters-three`: `eye()`, `setView(mode, camera)` e `HEAD_LAYER` no avatar. Testes: `eye()` acompanha agachar,
  sentar, deitar e cair; em 1ª pessoa a câmera não vê cabeça nem pescoço e a sombra continua.
- T1.2 `game-characters-three`: opção `view` no `createArmReach` com `elbowView`, `reachBend` e `keepOutside`, portados de
  `arms.ts` com os mesmos números. Testes portados de `first-person-arms.test.ts` (cotovelo na vista, dobra mínima, mão fora da
  parede).

## Fase 2 — A sala usa só o corpo (depois do merge do #110)
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 → `opus`)

- T2.1 🧠 `game-test-room`: corpo sempre na cena; câmera da 1ª pessoa no `eye()`; `reachAvatar` nas duas vistas com a opção
  `view` em 1ª pessoa; `stepFirstPerson` e `RoomAvatar.firstPerson` saem. Teste R7: trocar de vista no meio de andar, agachar,
  sentar, empurrar, segurar e abrir porta não muda mãos, pés nem cabeça.
- T2.2 `game-test-room`: `CROUCH_DROP`, `setBend` e o olho por assento deixam de mexer na câmera; `furniture-push` e `seating`
  passam a depender só da pose. Testes existentes de agachar, empurrar e sentar ajustados para medir pelo `eye()`.
- T2.3 `game-test-room`: `followHeld` sem o ramo de espaço de câmera; o item vai na mão do corpo nas duas vistas.

## Fase 3 — Arma no corpo
> 🤖 Modelo: `sonnet`

- T3.1 `game-weapons-three`: `place()` sempre com `placeOnBody`; `HAND_OFFSET`, `HANDGUN_OFFSET` e a escala de 1ª pessoa saem;
  `HAND_IN_VIEW` e `WALL_PULL` passam a valer pela restrição de vista do IK. Goldens e e2e da área de armas nas duas vistas.

## Fase 4 — Golpes e porta
> 🤖 Modelo: `sonnet`

- T4.1 `room-avatar.ts`: `strike()` só no corpo (`ATTACK_CLIPS`), nas duas vistas; o guarda (`fight_guard`) também.
- T4.2 Porta (#110): `doors.handTargets()` vai para o `reachAvatar`; a pose `door` vale nas duas vistas.

## Fase 5 — Limpeza e fechamento
> 🤖 Modelo: `haiku` (T5.3 → `sonnet`)

- T5.1 Remover `first-person/arms.ts`, `types.ts`, o preset `first-person-arms.json`, `FIRST_PERSON_CLIPS` e
  `first-person-clips.json`; mover `ik.ts` para `player/`. `pnpm build` e todos os testes verdes.
- T5.2 Skills `.claude/skills/game-characters-three`, `game-test-room`, `game-weapons-three` e READMEs atualizados; spec 002 com
  nota de que R1, R3 e D2 foram substituídos por esta.
- T5.3 Revisão (`code-reviewer`) e verificação na sala: as duas vistas em andar, agachar, sentar, deitar, empurrar, segurar, arma,
  soco e porta; `room.metrics()` antes e depois; um print de cada vista, ao fim.

## Gates de cada task

`pnpm build`, `pnpm -r typecheck`, testes do pacote (goldens incluídos), `pnpm lint`, skill do pacote atualizada, commit isolado por
task, evidência em `evidence.md`. PR por fase, mostrado no Chrome do dono; merge só com o ok dele.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/004-corpo-unico/ do repositório adatechnology-game-kit, num worktree novo
~/Documents/personal/adatechnology-game-kit-wt/spec-004 (branch spec/004-corpo-unico, a partir do origin/main). Leia CLAUDE.md,
spec.md, plan.md e tasks.md antes de começar. Uma task por vez, na ordem do tasks.md.
Regra principal: um corpo só; tudo o que o jogador faz aparece nas duas vistas; as restrições de vista vêm de first-person/arms.ts
com os mesmos números (porte, nunca reescrever parecido).
Ordem: Fases 0 e 1 podem rodar já. Antes da Fase 2, confira que o PR #110 (portas) está no main; se não estiver, pare e avise.
Modelos: T0.1 🧠 → opus, validada por architect antes da Fase 1 · Fase 1 → executor model=sonnet · T2.1 🧠 → opus ·
T2.2, T2.3, Fases 3 e 4 → executor model=sonnet · Fase 5 → executor model=haiku (T5.3 → sonnet) ·
revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm build + typecheck + testes (goldens) + lint + skill atualizada + commit isolado, evidência em evidence.md.
Ao fim de cada fase: abrir o PR, mostrar no Chrome do dono e parar até o ok.
Pare e pergunte antes de: merge, deploy, publicar pacote no npm, mudar uma decisão D1–D5 da spec.
```
