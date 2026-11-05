// Pipeline de áudio do AdA Technology Game Kit
// Extrai, organiza e injeta metadados "ada-technology" em arquivos WAV.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_CONFIG_PATH = join(ROOT, 'audio.config.local.json');
const EXAMPLE_CONFIG_PATH = join(ROOT, 'audio.config.example.json');

export function loadConfig() {
  const path = existsSync(LOCAL_CONFIG_PATH) ? LOCAL_CONFIG_PATH : EXAMPLE_CONFIG_PATH;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Limpa todos os chunks anteriores (LIST, bext, cue, smpl, junk, PAD)
 * e reconstrói o arquivo mantendo estritamente o áudio puro (fmt, data)
 * com metadados exclusivos da organização ada-technology.
 */
export function tagWavFile(filepath, title, meta = {}) {
  const artist = meta.artist || 'ada-technology';
  const comment = meta.comment || 'Efeitos sonoros - AdA Technology Game Kit';
  const encoder = meta.encoder || 'ada-technology';

  const buffer = readFileSync(filepath);
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return false;
  }

  // Extrai estritamente os chunks essenciais do áudio
  const essentialChunks = [];
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    const total = 8 + size + (size % 2);
    if (pos + total > buffer.length) break;

    if (fourcc === 'fmt ' || fourcc === 'data' || fourcc === 'fact') {
      essentialChunks.push(buffer.subarray(pos, pos + total));
    }
    pos += total;
  }

  function makeSubchunk(fourcc, text) {
    const raw = Buffer.from(text + '\0', 'utf8');
    const padded = raw.length % 2 === 1 ? Buffer.concat([raw, Buffer.from([0])]) : raw;
    const header = Buffer.alloc(8);
    header.write(fourcc, 0, 4, 'ascii');
    header.writeUInt32LE(raw.length, 4);
    return Buffer.concat([header, padded]);
  }

  const chunks = [
    Buffer.from('INFO', 'ascii'),
    makeSubchunk('INAM', title),
    makeSubchunk('IART', artist),
    makeSubchunk('ICOP', `Copyright (c) ${artist}`),
    makeSubchunk('ICMT', comment),
    makeSubchunk('ISFT', encoder),
  ];

  const infoBody = Buffer.concat(chunks);
  const listHeader = Buffer.alloc(8);
  listHeader.write('LIST', 0, 4, 'ascii');
  listHeader.writeUInt32LE(infoBody.length, 4);
  const listChunk = Buffer.concat([listHeader, infoBody]);
  const listPadded = listChunk.length % 2 === 1 ? Buffer.concat([listChunk, Buffer.from([0])]) : listChunk;

  const body = Buffer.concat([...essentialChunks, listPadded]);
  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 4, 'ascii');
  riffHeader.writeUInt32LE(4 + body.length, 4);
  riffHeader.write('WAVE', 8, 4, 'ascii');

  writeFileSync(filepath, Buffer.concat([riffHeader, body]));
  return true;
}

/**
 * Remove 100% dos chunks de metadados (LIST, bext, cue, smpl, junk, PAD),
 * deixando o arquivo WAV com áudio puro (apenas fmt e data).
 */
export function stripAllMetadata(filepath) {
  const buffer = readFileSync(filepath);
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return false;
  }

  const essentialChunks = [];
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    const total = 8 + size + (size % 2);
    if (pos + total > buffer.length) break;

    if (fourcc === 'fmt ' || fourcc === 'data' || fourcc === 'fact') {
      essentialChunks.push(buffer.subarray(pos, pos + total));
    }
    pos += total;
  }

  const body = Buffer.concat(essentialChunks);
  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 4, 'ascii');
  riffHeader.writeUInt32LE(4 + body.length, 4);
  riffHeader.write('WAVE', 8, 4, 'ascii');

  writeFileSync(filepath, Buffer.concat([riffHeader, body]));
  return true;
}

export function stripAllWavsInDirectory(directory) {
  let count = 0;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.wav')) {
        if (stripAllMetadata(full)) count++;
      }
    }
  }
  walk(directory);
  return count;
}

function main() {
  const config = loadConfig();
  console.log(`Pipeline de Áudio AdA Technology iniciado (Organização: ${config.organization})`);

  const args = process.argv.slice(2);
  const runStrip = args.includes('--strip') || args.length === 0;

  if (runStrip && config.targets?.game && existsSync(config.targets.game)) {
    console.log(`Removendo todos os metadados dos arquivos de áudio em ${config.targets.game}...`);
    const stripped = stripAllWavsInDirectory(config.targets.game);
    console.log(`Total de ${stripped} arquivos de áudio limpos (0 metadados, apenas áudio puro).`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
