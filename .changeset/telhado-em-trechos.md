---
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': patch
---

O telhado se divide em trechos entre as tesouras. Cada água do telhado de duas águas vira um trecho por vão entre tesouras (`roof_a_0`, `roof_a_1`…; as pontas levam o beiral), e cada trecho se apoia só nas tesouras das suas bordas. Uma explosão quebra só os trechos ao seu alcance e o resto do telhado fica no lugar. O desenho segue a física: com a destruição ligada, as telhas de cada trecho são desenhadas como peça própria, então o trecho quebrado some sozinho. Opção nova `roofBays` (padrão: quando o detalhe não é `coarse`); o detalhe `coarse` do Visor continua com uma peça por água. O dimensionamento mantém caibros e trechos de telhado abaixo da redundância quando um pilar ou parede portante cai, como o `sizeStructure` do `game-destruction`.
