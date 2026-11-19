# Plano — Spec 014

## Pacotes e o que cada um ganha

```text
game-characters
  data/body.json           orçamento por nível (perto, médio, longe), classes de material
  data/hand-poses.json     poses de mão (ângulos por falange)
  body/joints.ts           tipo JointKind, JointParams (raios, eixos, limites) — puro
game-characters-three
  rich/joint-piece.ts      jointPiece(kind, params, impl?) — a costura; impl 'capsule' agora, 'skinned' depois
  rich/limb.ts             segmento em cápsula, usado por best-builder e person-builder
  rich/foot.ts, hand.ts    pé articulado; mão de 5 dedos com pose
  rich/face.ts             rosto único (olhos, pálpebra, boca, mandíbula), com deformação por tipo
  rich/merge.ts            fusão por material depois de montar (ossos preservados em atributo)
  rich/deviations.ts       desvios do porte (criado na spec 012)
  rich/outfits/            fardas e trajes por dado
  instanced/               coto, pontilhado de LOD, impostor por variante
  tests/catalog-cases.ts   catálogo ampliado
game-characters-uniformed, -undead   desenho da farda e do traje em dado
examples/* (páginas)       injetam os itens do game-items-three nas mãos (opção já usada em `person` e `probe`)
```

## Decisões de desenho

- **A costura** (🧠 T1.1): `jointPiece` recebe o tipo da junta, os dois segmentos e os eixos, e devolve a geometria e o osso a que
  cada vértice pertence. A implementação `capsule` devolve vértices de um osso; a `skinned` devolveria dois ossos e pesos. O corpo
  instanciado já leva `bone` e `pivot` por vértice: o contrato reserva o segundo osso e o peso desde já, valendo 0.
- **Fusão sem perder animação:** o corpo rico continua animado por grupos durante a montagem; a fusão por material acontece por osso
  (uma malha por material por osso móvel) ou vai direto para o caminho instanciado. Decidir na T1.1 com medição.
- **Porte literal:** os números do Bestiário ficam onde não há mudança; cada troca (junta, pé, mão, rosto) entra em `deviations.ts`
  com o golden novo.
- **Mão simples na multidão:** dedos custam triângulos; ficam do nível perto para cima.

## Riscos

- É a spec que mais muda goldens literais: um commit de golden por task, nunca misturado com código.
- `best-builder.ts` é denso e sem tipos finos; migrar junta por junta, com print a cada uma.
- Memória: peças novas passam por `discardObject3D`/`releaseObject3D` (§8).

## Dependências

A spec 012 (normalização da altura) deve entrar antes, para não regerar golden duas vezes. A 013 fase 5 (IK de pés) espera a R3.
A 015 usa as poses de mão da R4.
