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
