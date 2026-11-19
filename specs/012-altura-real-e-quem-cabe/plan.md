# Plano — Spec 012

## Pacotes e o que cada um ganha

```text
game-contracts
  body-measures.ts        tipos BodyMeasures, SeatSpace, DoorOpening, FitResult (só tipos; nenhum pacote depende do outro por causa da regra)
game-characters
  data/body.json          heightMetres por tipo (Lento, Brutamonte, Inchado, humano...), faixa suportada
  body/height.ts          heightFactor(heightMetres, type), assertHeight (erro tipado fora da faixa)
  body/measures.ts        bodyMeasures({ heightMetres, build }) -> BodyMeasures (puro)
game-characters-people    faixas por idade em metros (types.ts:32-37, dados)
game-characters-three
  rich/best-builder.ts    base normalizada: fator 1 mede heightMetres (escala no construtor, não mexe nos números do porte)
  rich/person-builder.ts  idem; fig.scale recebe o fator vindo de heightFactor
  rich/deviations.ts      registro dos desvios do porte (novo, no molde de game-items-three/src/models/deviations.ts)
  player/avatar.ts        HIP_HEIGHT, DOOR_SHOULDER, DOOR_ARM e o olho saem do rig da pessoa, não de constante
  instanced/              accessory.ts sem HEAD_REFERENCE/TORSO_REFERENCE fixos; altura por instância continua em iB.x
game-player               colisor e cápsula pela altura
game-camera / game-weapons-three   olho e pega lidos do corpo (conferir o que ainda é constante)
game-vehicles
  interior.ts, context.ts seat grava SeatSpace; porta grava DoorOpening; assento em moto e quadriciclo
  data/cabin.json         altura livre mínima por categoria (R6)
  fit.ts                  fits({ body, seat, door }) -> FitResult
game-vehicles-fleet       cabines corrigidas (almofada e forro), golden de espaço por modelo
game-vehicles-three       build.ts: olho do motorista por BodyMeasures; test-area: cenário "quem cabe"
```

## Decisões de desenho

- **Onde mora `fits`** (🧠 T0.2): proposta — tipos no `game-contracts`, medidas no `game-characters`, espaço e `fits` no
  `game-vehicles`, que não importa `game-characters` (recebe `BodyMeasures`). Confere com `check:layers` e a regra §3.
- **Normalizar sem reescrever o porte:** os números literais do Bestiário ficam; o construtor aplica uma escala de normalização
  (`heightMetres / alturaMedidaDoPorte`) no grupo raiz. O desvio fica em uma linha, e os goldens mudam por um fator conhecido.
- **Altura livre:** medida do ponto do quadril até a primeira superfície acima, em 5 raios (centro, frente, trás, esquerda,
  direita), valendo o menor. Um raio só pode pegar peça que não é o forro (limite do levantamento).
- **Medidas do corpo:** razões antropométricas fixas no dado (altura sentado ≈ 0,52 × altura; ombro, coxa e canela idem), com fonte
  citada no JSON. Proporção individual entra depois pelo mesmo tipo.

## Riscos

- Goldens literais do Bestiário e dos impostores mudam: regerar em commit próprio, com o fator registrado.
- Corrigir cabine mexe em geometria de 40+ carros: rodar `revisor-z-fighting` e o teste de aceitação da frota (§7).
- Colisor mais baixo ou mais alto muda testes de porta e de agachar da sala.

## Dependências

Nenhuma spec anterior. A 016 (motorista dentro do carro) depende desta.
