---
'@adatechnology/game-urban': minor
---

Entrada nova `@adatechnology/game-urban/networks`: as redes do bairro (energia MT e BT, iluminação, telecom, esgoto, drenagem, água) como dado, sem three.js. Tipos de nó e aresta, regras com `resolveNetworkRules` (folgas por classe, demanda diversificada e trafos, declividade, recobrimento, cruzamentos), faixas do poste de distribuição (`DEFAULT_POLE_SLOTS`, `checkPoleSlots`; `PoleSlots` e `DistributionSpec` no registro de postes), o grafo (`buildNetworkGraph`, `connectedNodes`, `circuitOf`) e `validateNetworks` com códigos estáveis em `NETWORK_VIOLATION`. O lado do lote é o `UtilityConnection` do `game-contracts`. Nada muda na saída de `createUrban` (spec 011, T2.8a).
