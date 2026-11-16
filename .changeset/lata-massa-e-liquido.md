---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

Latas e garrafas: o piso de massa da peça cai de 0,2 kg para `MIN_PIECE_MASS_KG` (20 g), então a lata vazia de 50 g pesa 50 g nos choques; a massa da peça cai com o líquido que sai (bebido, despejado ou vazado, na densidade do líquido) pelo novo `DestructionRenderer.setPieceMass`, e a inércia de giro acompanha; o líquido de dentro da lata gira só metade do que um sólido de mesma massa (`LIQUID_SPIN_COUPLING`), em vez de ser tratado como sólido.
