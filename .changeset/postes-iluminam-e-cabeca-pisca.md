---
'@adatechnology/game-urban': minor
'@adatechnology/game-urban-three': minor
---

Postes de verdade à noite: com o `LightBudget` do host a luz do poste usa `physicalIntensityOf` (os números do time, afinados no r128 sem luz fisicamente correta, convertidos para iluminar o pé do poste como na página), e o poste falhando pisca a cabeça junto com a luz (`flickerPhase` na lente e na luz, `flickerLevel`, 4 grupos de fase com um material de lente por cor), mesmo sem luz real.
