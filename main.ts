// Teluk Arun — Kisah Jalanan: entry gta6-01 untuk @hulukahandap.
// Program Node 22 (standard library saja) yang menyerahkan game ke grader:
// menyalin game/ dan screenshots/ dari samping file ini ke /output, lalu
// menulis /output/dossier.json dengan library make.fun yang divendor.
// Di luar container grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Batas yang ditegakkan di sini mengikuti reference/gate.json: dossier
// dibatasi 160 KiB teks, maksimal 4 screenshot @ 256 KiB, game/ maksimal
// 993 file / 48 MiB, dan tiap path di bawah game/ maksimal 1000 byte.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function copyTree(source, target) {
  if (!existsSync(source)) fail(`tidak ada: ${source}`);
  cpSync(source, target, { recursive: true });
}

function checkScreenshots(dir) {
  // buildDossier juga memeriksa, tapi gagal lebih awal memberi pesan jelas.
  if (!existsSync(dir)) return;
  for (const name of ['1-overview.jpg', '2-drive.jpg', '3-chase.jpg', '4-action.jpg']) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    if (statSync(file).size > 262144) fail(`screenshot ${name} di atas 256 KiB`);
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyTree(join(REPO_ROOT, 'game'), join(OUTPUT_DIR, 'game'));
mkdirSync(join(OUTPUT_DIR, 'screenshots'), { recursive: true });
checkScreenshots(join(REPO_ROOT, 'screenshots'));
if (existsSync(join(REPO_ROOT, 'screenshots'))) {
  cpSync(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(OUTPUT_DIR, 'dossier.json'),
  buildDossier(OUTPUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`dossier ditulis ke ${join(OUTPUT_DIR, 'dossier.json')}`);
