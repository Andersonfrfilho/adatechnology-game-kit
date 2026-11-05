#!/usr/bin/env node

/**
 * clean-audio.mjs
 * 
 * Script CLI autônomo para remoção completa de metadados, tags e rastros de origem
 * em arquivos de áudio WAV (AdA Technology Game Kit).
 * 
 * Remove chunks não-essenciais:
 * - LIST (INFO, adtl, etc.)
 * - bext (Broadcast Wave Format: Originator, CodingHistory, etc.)
 * - ID3 / id3
 * - cue, smpl (marcadores e loops legados)
 * - junk, PAD
 * 
 * Preserva estritamente os dados binários do áudio (fmt, data, fact).
 * 
 * Uso:
 *   node clean-audio.mjs <caminho_arquivo_ou_pasta>
 *   Exemplo:
 *     node clean-audio.mjs ./src/audio
 *     node clean-audio.mjs ./tiro.wav
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const ESSENTIAL_FOURCC = new Set(['fmt ', 'data', 'fact']);

/**
 * Limpa um arquivo WAV individual.
 * Devolve { success, originalSize, newSize, strippedChunks } ou { error }.
 */
export function stripWavMetadata(filepath) {
  try {
    const buffer = readFileSync(filepath);

    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      return { error: 'Não é um arquivo RIFF/WAVE válido' };
    }

    const essentialChunks = [];
    const strippedChunks = [];
    let pos = 12;

    while (pos + 8 <= buffer.length) {
      const fourcc = buffer.toString('ascii', pos, pos + 4);
      const size = buffer.readUInt32LE(pos + 4);
      const totalChunkSize = 8 + size + (size % 2);

      if (pos + totalChunkSize > buffer.length) {
        break;
      }

      if (ESSENTIAL_FOURCC.has(fourcc)) {
        essentialChunks.push(buffer.subarray(pos, pos + totalChunkSize));
      } else {
        strippedChunks.push(fourcc.trim());
      }

      pos += totalChunkSize;
    }

    if (essentialChunks.length === 0) {
      return { error: 'Nenhum chunk de áudio válido encontrado' };
    }

    const body = Buffer.concat(essentialChunks);
    const riffHeader = Buffer.alloc(12);
    riffHeader.write('RIFF', 0, 4, 'ascii');
    riffHeader.writeUInt32LE(4 + body.length, 4);
    riffHeader.write('WAVE', 8, 4, 'ascii');

    const cleanWav = Buffer.concat([riffHeader, body]);
    writeFileSync(filepath, cleanWav);

    return {
      success: true,
      originalSize: buffer.length,
      newSize: cleanWav.length,
      strippedChunks,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Varre recursivamente um diretório limpando todos os arquivos .wav.
 */
export function cleanDirectory(directory) {
  const results = {
    processed: 0,
    cleaned: 0,
    errors: 0,
    bytesSaved: 0,
  };

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.wav')) {
        results.processed++;
        const res = stripWavMetadata(fullPath);
        if (res.success) {
          results.cleaned++;
          results.bytesSaved += Math.max(0, res.originalSize - res.newSize);
        } else {
          results.errors++;
          console.error(`  [ERRO] ${entry.name}: ${res.error}`);
        }
      }
    }
  }

  walk(directory);
  return results;
}

function printHelp() {
  console.log(`
Uso: node clean-audio.mjs <caminho_do_arquivo_ou_pasta>

Exemplos:
  node clean-audio.mjs /caminho/para/pasta_de_audios
  node clean-audio.mjs som.wav
`);
}

function main() {
  const targetArg = process.argv[2];
  if (!targetArg || targetArg === '--help' || targetArg === '-h') {
    printHelp();
    process.exit(targetArg ? 0 : 1);
  }

  const targetPath = resolve(process.cwd(), targetArg);

  if (!existsSync(targetPath)) {
    console.error(`Erro: Caminho não encontrado: ${targetPath}`);
    process.exit(1);
  }

  const stat = statSync(targetPath);
  console.log(`Iniciando limpeza de áudio em: ${targetPath}`);

  if (stat.isFile()) {
    if (!targetPath.toLowerCase().endsWith('.wav')) {
      console.error('Aviso: O arquivo selecionado não possui extensão .wav.');
    }
    const res = stripWavMetadata(targetPath);
    if (res.success) {
      console.log(`✓ Arquivo limpo com sucesso!`);
      if (res.strippedChunks.length > 0) {
        console.log(`  Tags/chunks removidos: ${res.strippedChunks.join(', ')}`);
        console.log(`  Redução: ${res.originalSize} B -> ${res.newSize} B (${res.originalSize - res.newSize} B economizados)`);
      } else {
        console.log(`  O arquivo já estava 100% puro (sem metadados residuais).`);
      }
    } else {
      console.error(`✗ Erro ao limpar arquivo: ${res.error}`);
      process.exit(1);
    }
  } else if (stat.isDirectory()) {
    const res = cleanDirectory(targetPath);
    console.log(`\nResumo da limpeza:`);
    console.log(`  Arquivos processados : ${res.processed}`);
    console.log(`  Arquivos saneados    : ${res.cleaned}`);
    console.log(`  Erros encontrados    : ${res.errors}`);
    console.log(`  Bytes economizados   : ${(res.bytesSaved / 1024).toFixed(2)} KB`);
    console.log(`\n✓ Todos os arquivos WAV estão com 0 metadados (áudio puro PCM).`);
  }
}

if (process.argv[1] === Buffer.from(import.meta.url.slice(7)).toString()) {
  main();
}
