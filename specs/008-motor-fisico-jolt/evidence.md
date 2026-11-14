# Evidência — Spec 008, Jolt como motor físico do kit

Máquina de todas as medidas abaixo, salvo nota: Intel Core Ultra 9 275HX (24 núcleos), Arch Linux, Node 20, worktree
`adatechnology-game-kit-wt/engine-jolt` (branch `spike/engine-jolt`) nas fases 0 e 1.

## T1.1 — Desenho do atrito por corpo (2026-11-13)

- Documento: `design/atrito-por-corpo.md`.
- Revisão: `architect` (opus), veredito **APPROVE WITH CHANGES**. Mudanças obrigatórias aplicadas no documento e na T1.2:
  1. teste do coeficiente efetivo que distingue as regras (3 m/s, 3 cm de diferença);
  2. texto corrigido: a lata rolando só lê `sticking` em chão plano (o pé fica no eixo Y do mundo);
  3. correção do sensor robusta a corpo removido (`touch(−1)` só desconta par contado);
  4. ordem no laço: `Step` → `updateFriction` → `roll` → `breakJoints`;
  5. `brokenJoints` limpo uma vez por chamada de `step`;
  6. `accumulator` salvo no estado;
  7. teste de parceiro removido.
  Sugestão O1 adotada: dinâmico escorregando sobre fixos de um só material segura `μd₁·μd₂/μs₂` (mistura exata com o fixo).
- Achados levados ao dono:
  - o número 0,42 m (esperado 0,47) do `tasks.md`/C5 comportamento 4 não bate com a física de μ 0,4 a 25° (0,295 m); o teste do adaptador usa o
    valor analítico;
  - teto de giro do Jolt (47 rad/s) faz lata e cápsula escorregarem acima de 1,65 m/s e 0,24 m/s; liberar o teto leva a granada do B2 a
    7,65 s (limite 5). Desfeito; decisão para a T4.3 (desenho §8.1).

## T1.2 — Atrito por corpo no adaptador (2026-11-13)

Feito na sessão principal (opus) e não por `executor` sonnet: as correções saíram da revisão da T1.1 e mexem nos mesmos arquivos.

- Código: `game-physics-jolt/src/friction.ts` (`touch` só desconta par contado; `coefficientOf` com a regra O1; `BodyEntry.friction`),
  `contacts.ts` (sensor fora de `touches`/`partners`), `world.ts` (`updateFriction` por passo fixo, ordem do laço, `brokenJoints` por chamada,
  `accumulator` público), `joints.ts`, `state.ts` (coeficiente e `accumulator` no estado salvo).
- `pnpm --filter @adatechnology/game-physics-jolt typecheck`: sem erros.
- `pnpm --filter @adatechnology/game-physics-jolt test`: **29/29** (11 arquivos; antes 22/22). Novos em `friction.test.ts`: freio a 3 m/s igual a
  μ 0,4 (± 3 mm) e 3 cm longe de 0,447; volta a `sticking`; cilindro rola 0,349 m em 0,5 s (esperado 0,346); prancha em dois apoios `sliding`;
  sensor não é tocado (giro igual com e sem sensor); sensor e parceiro removidos; `step(1/60)` = 2 × `step(1/120)` bit a bit.
  Os três novos de sensor, passo fixo e coeficiente falharam antes da correção (vermelho conferido).
- `pnpm --filter @adatechnology/game-destruction-three test`: **11 falham / 386 passam / 1 pulado**, o mesmo conjunto de 11 do fim da rodada Q4
  (`q4/dt3-final.log`), nenhum novo.
- `vitest run tests/slope-friction.test.ts` (aceite da T1.2): **3/5 no Jolt** (falham "a 25° madeira escorrega e aço segura" e "lata deitada
  rola numa rampa suave": a caixa de madeira anda 1,8 cm, limite > 10 cm; a lata 3,2 cm, limite > 20 cm), **5/5 com `PIECE_SOLVER=own`**. As duas
  falham igual antes desta task. As duas usam uma tábua que é peça dormindo como rampa; a causa não foi isolada aqui: fica para a T3.5 (C5,
  testes com apoio desenhado).
- `pnpm exec eslint packages/game-physics-jolt/src packages/game-physics-jolt/tests/friction.test.ts`: sem problemas.
- `node tools/kit-audit/audit.mjs --check`: 0 novos fora do SDK dono, 11 pendentes conhecidos.
