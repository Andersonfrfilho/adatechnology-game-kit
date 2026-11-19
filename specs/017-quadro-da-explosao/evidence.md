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
