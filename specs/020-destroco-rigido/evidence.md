# 020 — Evidência

Medido em 2026-11-28, worktree `spec-020-destroco-rigido`.

| O quê | Antes de qualquer correção | Com o remendo (#613) | Com a raiz |
|---|---|---|---|
| `long-debris-settles` (A1) | reprova tábua e ripa | passa | passa |
| Tábua sobre o caixote (A2) | atravessa o caixote (0,02 m) | atravessa o caixote (0,02 m) | apoiada no caixote |
| Sala, PKM, 110 tiros, pedaços compridos 4 s depois | 0,88 m no ar, acordado aos 10 s | todos dormindo, o mais alto a 0,12 m | todos dormindo, deitados (0° a 5°, os inclinados apoiados em outro) |
| `broken-catalogue-settles`, dívida | 14 | 14 | 9 |

- Suítes: `game-physics` 33, `game-physics-jolt` 263, `game-destruction-three` 911 passam.
- `game-floorplan-three`: `exact-golden`, `broken-catalogue*`, `destruction-pieces-never-rise`, `furniture-laid-still`, `house-switch-release` passam. A suíte
  inteira não terminou em 10 min com a máquina em carga 23; o CI é o juiz.
- Goldens regravados: só `destruction/breach`, `destruction/spall`, `destruction/fracture`.
- Caminho descartado, com o número: destroço na camada `debris` levantou uma porta 1,2 m numa explosão de 2 MJ e deu 5 m/s às piscinas quebradas.
- Não medido: `perf-gate`; salas além da de teste; destroço de casa na sala (`?area=house_complete`).

## Depois do primeiro CI (2026-11-28)

O CI do #620 reprovou dois testes da sala, e os dois eram o destroço vazando para onde só peça entra:

- **Dano de impacto.** O leitor de contatos (`engine-impacts`) transforma todo golpe num sólido fixo em golpe `blunt` no mundo. O destroço batendo na laje
  rachava a laje (4 eventos `crack` a mais no quadro da explosão; `structure > logs stress and collapse` lia outra coluna). Agora o golpe de destroço não é
  contado (`ImpactReaderOptions.ignores`): o que sobra de uma quebra não quebra de novo ao pousar.
- **Fluxo aleatório e empurrão da explosão das peças.** O destroço estava na lista que a explosão empurra e que sorteia o ponto do empurrão. Saiu dela: é
  lançado pela explosão dos próprios fragmentos (`RigidDebris.shove`), com o giro pela velocidade da ponta. Também saiu do orçamento de peças acordadas.
- **Linha de base de passo regravada** (`game-test-room/tests/fixtures/step-equivalence.json`, 150 dos 180 quadros, do quadro da explosão em diante). Com
  eventos e registros idênticos aos de antes, as peças diferem na 8ª casa decimal (4,00000001 m contra 4,00000004 m): o motor resolve em outra ordem por ter
  mais corpos. Estável entre execuções (3 rodadas iguais). É regravação do mesmo tipo dos goldens, e não estava na lista de três que o dono aprovou.

Suítes inteiras depois disso: `game-physics` 33, `game-destruction-three` 911, `game-test-room` 632.
