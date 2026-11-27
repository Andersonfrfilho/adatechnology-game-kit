---
"@adatechnology/game-destruction-three": minor
"@adatechnology/game-kit-defaults": minor
---

Batida do motor vira dano e som e a explosão acha os destroços pelo motor (TS.8). `contactHits` fica ligado por padrão no preset quando há laço físico (`debris.contactHits: false` desliga): um golpe do motor numa parte fixa desenhada vira `hitPart` blunt com o som do material, com limiar de impulso (30 N s), de velocidade de aproximação (`minApproach`, 1,5 m/s: pilha assentando não bate) e cota de 32 partes por quadro. `RendererOptions.blastQuery` (o preset passa `PhysicsServices.blast`): a explosão empurra os destroços que o motor encontra no raio, na mesma ordem e com o mesmo empurrão do percurso antigo; sem serviços (`own`) nada muda.
