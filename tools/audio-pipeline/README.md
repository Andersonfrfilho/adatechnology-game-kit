# @adatechnology/audio-pipeline

Ferramenta do **AdA Technology Game Kit** para extração, organização e injeção de metadados institucionais (`ada-technology`) em bancos de efeitos sonoros.

## Princípios de Arquitetura

1. **Origem Institucional**: Todo arquivo `.wav` processado recebe chunks RIFF `INFO` (`IART`, `ICOP`, `ICMT`, `INAM`, `ISFT`) identificando a autoria e os direitos como `ada-technology`.
2. **Caminhos Locais Protegidos**: Arquivos com rotas locais (`audio.config.local.json`) são ignorados pelo Git (`.gitignore`). Use `audio.config.example.json` como modelo.
3. **Alto Desempenho no Jogo**: O carregamento em tempo de execução é assíncrono e preguiçoso (*lazy*), aproveitando `requestIdleCallback` para pré-carregamento e mantendo fallback imediato procedural em 0 ms para nunca prejudicar o frame rate (60 FPS).

## Uso

```bash
# Executar marcação de metadados em todos os arquivos de áudio
node src/pipeline.mjs --tag

# Executar extração completa a partir dos arquivos configurados
node src/pipeline.mjs --all
```
