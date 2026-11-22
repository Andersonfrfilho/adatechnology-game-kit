# Plano — Spec 016

## Pacotes e o que cada um ganha

```text
game-contracts
  moving-part.ts          tipo MovingPart (id, tipo, eixo ou trilho, curso, duração, curva, depende de) e o contrato do tocador
game-vehicles
  parts/moving.ts         registro das partes móveis no construtor (kit.door, kit.lid, kit.wiper... gravam MovingPart)
  destructible/clips.ts   clipes gerados das MovingPart (saem os 1.15 e 1,2 s fixos)
  interior.ts             volante, pedais e alavanca como partes móveis; SeatSpace vem da spec 012
  destructible/visual.ts  dano com progresso no tempo; luz ligada à peça
  context.ts, materials   pintura com verniz, sujeira e desgaste; ponto real do escapamento
game-vehicles-fleet       partes móveis declaradas em todo modelo; trem de pouso, basculante, portas de ônibus, guincho
game-vehicles-driving     arcade com pitch e roll visuais; estado de motor exposto para rotor, hélice e esteira
game-vehicles-three
  body.ts                 tocador único de partes móveis (curvas do game-characters/anim ou cópia mínima — decidir na T1.1)
  suspension.ts           rodas no chão, curso por roda, carroceria sobre as rodas
  wheel-roll.ts           usado em toda área e modo; moto (garfo, guidão, inclinação, descanso)
  occupants.ts            recebe o construtor de corpo por injeção; pose sentada pelo SeatSpace; mãos por IK
  enter-exit.ts           sequência de entrar e sair por tipo de veículo
  vehicle-lod.ts          nível intermediário e transição
  trail.ts                marca de pneu, poeira, respingo e escapamento pelo game-vfx
game-characters-three     pose sentada paramétrica e clipes de entrar e sair (pedidos pela 016, moram lá)
examples/vehicles-test-area   injeta personagens; cenários de aberturas, curva, entrar e sair
```

## Decisões de desenho

- **Parte móvel é contrato** (🧠 T1.1): o mesmo tipo serve a veículo e, depois, a móvel e porta de casa. Fica no `game-contracts`.
- **Camadas:** `game-vehicles-three` não importa `game-characters-three` (adaptador com adaptador). O corpo entra por injeção, como
  a área de itens já recebe `person`. Confirmar com `check:layers` na T4.1.
- **Suspensão visual sem física nova:** usa altura, `pitch` e `roll` que a semi já calcula; no arcade, deriva de aceleração
  longitudinal e lateral com mola amortecida (visual, determinística).
- **Custo:** a fusão por material preserva as partes móveis e as zonas de dano como malhas próprias; o nível intermediário é gerado
  do `high` por redução de segmentos, não desenhado à parte.

## Riscos

- Mexe nos 69 modelos: fazer por categoria, com o teste de aceitação da frota a cada uma (§7).
- Fundir malhas pode quebrar "o tiro acerta o desenhado" e "marca é filha da peça": o teste de aceitação cobre; não fundir zona de dano.
- Custo de ocupantes: corpo no nível médio dentro do carro, e só nos veículos perto da câmera.

## Dependências

Spec 012 (SeatSpace, cabine, `fits`, medidas do corpo) para as fases 4 e 5. Spec 013 (grafo, ragdoll) para entrar, sair e ejeção.
Spec 014 (mãos) para as mãos no volante. As fases 1 a 3 e 6 a 8 não dependem de nenhuma.
