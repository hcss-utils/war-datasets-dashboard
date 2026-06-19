#!/usr/bin/env node
// Data-presence gate for the War Datasets Dashboard.
// FAILS (non-zero exit) if any deployed dataset is empty or carries only null/zero
// placeholder rows — the exact failure that shipped an empty "Aerial Assaults" tab and a
// blank weapons chart with NOTHING catching it. Runs in CI after `vite build`, before deploy.
//
// Usage: node scripts/verify_data.mjs [dataDir]   (default: ./dist/data, falls back to ./public/data)
//
// "Real data" = a JSON array with >=1 row that carries signal, or an object with >=1
// non-zero/non-empty value (or a non-empty array-valued field). Signal = a number !== 0,
// a non-empty non-whitespace string, or true. All-zero/all-null rows are NOT signal
// (that is precisely the daily_aerial_threats placeholder bug).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argDir = process.argv[2];
const DIR = argDir && existsSync(argDir) ? argDir
  : existsSync('./dist/data') ? './dist/data'
  : './public/data';

// KNOWN-EMPTY, tracked (not silenced): listed loudly here with a reason + date so the gate
// stays live for any NEW empty while not wedging deploys on an external-credential blocker.
// 2026-06-19: both depend on aerial_assaults.missile_attacks, which is EMPTY because
// pipeline/updaters/missiles.py TRUNCATEs then re-downloads from the Kaggle dataset
// piterfm/massive-missile-attacks-on-ukraine — and no Kaggle credentials are configured
// (~/.kaggle/kaggle.json / KAGGLE_KEY absent from SYSTEM_CREDENTIALS). FIX = add Kaggle creds
// + re-run missiles.py against the war_datasets DB, then DELETE these two lines.
const ALLOW_EMPTY = new Set([
  'daily_aerial_threats.json',   // → Aerial Assaults tab (blocked on Kaggle creds, 2026-06-19)
  'weapon_types_summary.json',   // → weapons chart      (blocked on Kaggle creds, 2026-06-19)
]);
// Minimum number of dataset files expected, so a catastrophic data-drop also fails.
const MIN_FILES = 30;

const isSignal = v => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'boolean') return v === true;
  return false;
};
const rowHasSignal = row => {
  if (row === null || typeof row !== 'object') return isSignal(row);
  return Object.values(row).some(v =>
    Array.isArray(v) ? v.some(rowHasSignal) :
    (v && typeof v === 'object') ? rowHasSignal(v) : isSignal(v));
};
const hasRealData = json => {
  if (Array.isArray(json)) return json.length > 0 && json.some(rowHasSignal);
  if (json && typeof json === 'object') {
    const vals = Object.values(json);
    if (vals.some(v => Array.isArray(v) && v.length > 0 && v.some(rowHasSignal))) return true;
    return vals.some(v => (v && typeof v === 'object') ? rowHasSignal(v) : isSignal(v));
  }
  return isSignal(json);
};

if (!existsSync(DIR)) { console.error(`FAIL: data dir not found: ${DIR}`); process.exit(2); }
const files = readdirSync(DIR).filter(f => f.endsWith('.json'));
console.log(`Verifying ${files.length} dataset(s) in ${DIR}\n`);

let bad = 0, knownEmpty = 0;
for (const f of files.sort()) {
  if (ALLOW_EMPTY.has(f)) { console.log(`⚠️  KNOWN-EMPTY (tracked, pending fix): ${f}`); knownEmpty++; continue; }
  const p = join(DIR, f);
  let json;
  try { json = JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { console.log(`FAIL  ${f} — invalid JSON: ${e.message}`); bad++; continue; }
  if (hasRealData(json)) continue;            // quiet on pass
  const sz = statSync(p).size;
  console.log(`FAIL  ${f} — EMPTY / all-zero-null rows (${sz} bytes)`);
  bad++;
}

if (files.length < MIN_FILES) {
  console.log(`FAIL  only ${files.length} dataset files (< ${MIN_FILES} expected) — data drop?`);
  bad++;
}

console.log('');
if (bad) { console.error(`❌ ${bad} dataset check(s) FAILED — empty data must not ship.`); process.exit(1); }
if (knownEmpty) console.log(`⚠️  ${knownEmpty} dataset(s) KNOWN-EMPTY (tracked above) — fix the source + remove from ALLOW_EMPTY.`);
console.log(`✅ ${files.length - knownEmpty}/${files.length} datasets carry real data (${knownEmpty} tracked-empty).`);
