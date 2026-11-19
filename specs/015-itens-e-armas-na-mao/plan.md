# Plano — Spec 015

## Pacotes e o que cada um ganha

```text
game-contracts            contrato de animação de item ampliado (uso, pegar, guardar); tipo Grip
game-items
  types.ts                ItemDef.grip?: Grip (ponto, orientação, mãos, pose, modo de carregar)
  grip-rules.ts           pega por regra da forma, para item sem pega declarada (puro)
game-items-goods          pegas declaradas nos dados dos itens de mão mais usados e nas 31 armas de item
game-items-three          âncora da pega no modelo; materiais por classe compartilhados; rótulos em canvas
game-characters-people    clipes de golpe por família, pegar, guardar, sacar, arremessar e usar (dados)
game-weapons
  data/melee-families.json   arma branca -> família de golpe; quadro de impacto
game-weapons-three
  fx/tool-motion.ts       movimento da ferramenta por família (hoje só a pá)
  fx/hold.ts              um posicionamento para as duas câmeras (VIEW_HOLD e BODY_HOLD unificados)
  animation/family-clips  recuo, ciclo e recarga por família para as armas fora da Galeria; corda de arco e besta
  fx/particles.ts         cápsula e carregador como corpos do game-physics
game-test-room            sala passa a pedir estados (pegar, guardar, golpear, usar) em vez de mover o item por conta própria
```

## Decisões de desenho

- **Pega é dado, regra é reserva** (🧠 T1.1): declarar à mão 330 itens não cabe numa spec; a regra por forma cobre a maioria e o
  teste lista quem depende dela, para refinar depois editando o dado (D2).
- **Golpe = clipe do corpo + movimento da ferramenta + quadro de impacto.** O dano hoje sai no clique; passa a sair no quadro
  marcado. A camada de braços da spec 013 toca o golpe sobre a locomoção.
- **Mesmo objeto na mão e no mundo:** ao pegar, o objeto muda de pai e desliga a física; ao largar, religa com a velocidade da mão.
  Acaba o apagar e reconstruir, e some o estalo visual.
- **Armas fora da Galeria:** clipes por família (pistola, revólver, fuzil, espingarda de bomba, lançador), não por arma.

## Riscos

- `room.ts` concentra item na mão, arma e uso: é o arquivo das sessões 010 e 011. Rebasear antes de cada fase; extrair para
  módulos próprios em vez de editar no meio.
- Mudar o momento do dano altera testes de combate da sala.
- Rótulo em canvas precisa de `document` injetado (padrão do kit) e de liberação de textura (§8).

## Dependências

Camadas da spec 013 (fase 1 e 3) para golpear andando. Poses de mão da spec 014 (fase 3). Sem elas, as fases 1 e 4 desta spec andam.
