# Evidence — Spec 017

## T1.1 (parte 1) — onde vai o tempo do `world.explode`

Perfil de CPU só das chamadas do `explode` (inspetor do Node, teste descartável sem commit; explosão de 4 MJ no sobrado de `structure-solves.test.ts`,
3 de aquecimento e 7 medidas, sem orçamento de quadro: o furo da parede roda dentro da explosão).

| Onde (tempo próprio por explosão, Node) | antes | depois do cache |
|---|---|---|
| `game-floorplan-three/src/destruction/breach.ts` (furo da parede) | 194 ms | 88 ms |
| `game-destruction` (o mundo, com `solveStructure`) | 31 ms | 26 ms |
| `stamp-mask`, `pieces`, `span-index`, `game-load-path` | ~20 ms | ~20 ms |
| `world.explode` inteiro (mediana) | ~250 ms | ~139 ms |

**Achado que muda o plano:** o mundo da destruição é pequeno; o peso é o desenho do furo. `riders(host)` varria as ~1.300 peças da casa e, para
cada uma, `specOf` fazia outro `find` nelas e `hostsOf` varria a casa de novo nas colunas (`wallsAround`): quadrático, refeito a cada evento.

**Correção (`b1f727beb`):** `specOf` por índice (um `Map` por objeto de spec) e `hostOf`/`hostsOf`/`wallsAround`/`riders` guardados por id. As peças da
estrutura e suas malhas só mudam enquanto a casa é montada (`pieces.ts:162`), então as respostas não mudam; `riders` só guarda quando a casa já tem
spec; `hosts()` devolve cópia. Mesma saída: suíte inteira do `game-floorplan-three` 1.353 passam (golden exato da casa, z-fighting, furos).

**No navegador** (régua curta: `blast,crater`, 1x, 3 rodadas de estágios, carga 1,33; JSON `medicoes/f0-cache-breach-b1f727beb.json`), contra a T4.1 da 010:

| | 010 final (T4.1, 2ª tomada) | com o cache |
|---|---|---|
| f0 inteiro (update + `renderCpu`), blast / crater | 92,0 / 98,4 ms | **84,1 / 85,2 ms** |
| `explode`, blast / crater | 29,8 / 33,2 | **21,6 / 22,0** |
| `queues` (`breach-cut`), blast / crater | 14,5 / 15,7 | 14,4 / 13,3 |
| `destrEvents`, blast / crater | 12,6 / 13,1 | 12,2 / 12,8 |

**O que sobra no furo:** `paint()` redesenha a máscara inteira da parede a cada passada (zera e carimba todos os furos texel por texel, com ruído
`noise2` por texel): o custo cresce com o dano acumulado. Torná-lo incremental é o próximo corte (`queues` ~14 ms), e muda goldens só se a
ordem de carimbo mudar o resultado (D2).

## T1.1 (parte 2) — o f0 repartido no navegador e o desenho

Sondas temporárias (sem commit) em `world.emit`, no ouvinte da casa e no `cut`/`paint` do furo, mais quatro rótulos na régua. Régua curta:
`ROOM_EXPLOSION_KINDS=blast,crater ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_STAGE_THROTTLES=1 ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1
ROOM_EXPLOSION_FRAME_PARTS=1`, sob `flock perf-measure.lock`, commit `c2953d167`, 2026-11-19 19:11. JSON: `medicoes/perfil-f0-sondas-c2953d167.json`.

**Carga de 2,31 no início e 3,75 no fim (acima do 1,5 da spec; uma aba do Chrome a ~100% de um núcleo). Vale pelas proporções; não é número
de fechamento.** f0 inteiro nesta rodada: blast 101,6 / crater 100,0 ms (rodada quieta do cache: 84,1 / 85,2).

| Parte do f0 (ms) | blast | crater |
|---|---|---|
| `explode`, só o mundo | 22,9 | 21,8 |
| ouvintes do `emit`: resto / casa / `cut` / `paint` do `drop` | 0,9 / 2,6 / 1,4 / 0,0 | 1,0 / 2,8 / 1,5 / 0,0 |
| fila `destruction.events` (inteira) | 22,1 | 21,3 |
| dentro dela: `splitLoose` / `adoptSplit` / `rebuildHost` | 2,3 / 1,4 / 3,2 | 2,4 / 1,7 / 2,7 |
| fila `floorplan.breach-cut` | 11,3 | 10,6 |
| fila `floorplan.breach-paint` | 5,5 | 5,2 |
| fila `audio.voices` | 3,0 | 3,5 |
| `action` | 7,9 | 9,7 |
| `stagesOut` | 6,9 | 6,9 |
| `renderCpu` | 11,9 | 10,6 |

- No navegador o `explode` é o mundo (~22 ms); os ouvintes síncronos somam ~5 ms. O perfil do Node da parte 1 incluía a pintura porque o teste
  não tem fila de quadro.
- ~34 ms do f0 são só apresentação (as duas filas da casa, o áudio e a parte visual dos eventos).
- Desenho, a razão de a D3 não caber com a D2 e a decisão pedida (D5): `design-tiques.md`.

**Push:** a primeira tentativa de `git push` caiu ("Connection to github.com closed by remote host") depois de 15 min 47 s de pre-push
(suíte do `game-floorplan-three` em série, o que o PR #406 corrige).
