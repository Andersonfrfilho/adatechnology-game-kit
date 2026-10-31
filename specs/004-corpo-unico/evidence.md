# Evidências — Spec 004

| Task | Data | Gates | Commit | Observação |
|---|---|---|---|---|
| T0.1 | 2026-10-31 | protótipo rodado na sala (Chromium headless), sem erros na página | (este commit) | ver "Medidas da T0.1" abaixo |
| T1.1 | 2026-10-31 | build ok · typecheck ok · 494 testes · lint ok | 5bd4ecea | `eye()` (soquete sob a cabeça, lido antes do `reach()`), `eyeOffset`, `eyeBob`, `setView` por hooks de render; `rig.neck` não enumerável para não mexer nos goldens; lente medida por vértice, não por caixa |
| T1.2 | 2026-10-31 | build ok · typecheck ok · 499 testes · lint ok | (este commit) | `reach(targets, view?)` por chamada: `reachBend` (1,35/0,95) limita peito, escápula e esticada pelo ângulo do cotovelo, e `keepOutside` (0,005 m, 0,12 m) recua a mão ao longo do `forward` da câmera antes do IK; sem `view` idêntico; `elbowView` não portado |

## Medidas da T0.1

Protótipo: `examples/player-test-area/first-person-body.mjs` (corpo da 3ª pessoa visto de dentro, câmera nos olhos do corpo).

**Olho por pose** — altura acima dos pés e distância da câmera de hoje no chão:

| Pose | Câmera de hoje | Olhos do corpo | Olhos à frente da câmera |
|---|---|---|---|
| em pé | 1,700 | 1,768 | 0,196 |
| agachado (só o corpo) | 1,700 | 1,377 | 0,381 |
| caído | 1,700 | 0,415 | 1,422 |
| sentado (poltrona) | 1,090 | 1,325 | 0,086 |
| deitado (cama de casal) | 0,800 | 0,760 | 0,845 |

A câmera de hoje não acompanha o corpo: não cai, não agacha junto com a pose e, sentado ou deitado, fica no quadril ou na pelve. Isso
confirma a D1 (o corpo dirige o olho).

**Lente:** com cabeça (13 malhas sob `headG`) e pescoço (1 cilindro em `U`, y ≈ 1,63–1,70) escondidos, a parte do corpo mais perto
da câmera fica a **0,215 m** (o peito), em qualquer pitch entre −1,4 e 1,2 rad. Com plano próximo de 0,05 m, nada corta.

**Esconder a cabeça:**
- Sem esconder: a própria cara tapa a vista inteira.
- **Por camada** (D2): a cabeça some para a câmera, mas no three r160 a passagem de sombra testa a camada contra a câmera principal
  (`WebGLShadowMap.js:335`), então a sombra da cabeça some também. Isso viola o R3.
- **Por material:** clones dos materiais da cabeça e do pescoço com `colorWrite: false` e `depthWrite: false` em 1ª pessoa. Mesma
  imagem, e a sombra continua (o mapa de sombra usa o material de profundidade). O custo é que um espelho também não vê a cabeça.

**Propostas para decidir com o dono (mudam a D2):**
1. `eyeOffset` padrão `(0, −0,068, 0)` no referencial da cabeça: em pé dá 1,700 m, como hoje, e vale igual em todas as poses.
2. Esconder a cabeça **por material**, não por camada, para manter a sombra (R3). Espelhos ficam sem a cabeça em 1ª pessoa.
3. Plano próximo de 0,05 m em 1ª pessoa.
