#!/usr/bin/env node
// selftest.mjs — prove the verifier fires on each staged invention, and ONLY on that one.
//
//   node checker/selftest.mjs
//
// Exit 0 = every assertion held. Exit 1 = at least one did not.
//
// A negative fixture that fails is worth very little on its own: a verifier that rejected every
// card would pass all six. What makes them evidence is the pair of assertions below —
//
//   * the control card, which differs from each negative by one mutation, verifies CLEAN; and
//   * each negative emits EXACTLY the code its EXPECT.json names, and no other code.
//
// The second is the one that catches a lazy gate. If neg-05 (the neighbour span) also tripped the
// coverage gate, it would no longer prove anything about span ORDERING — it would prove the card
// was malformed in some way, which is a much weaker claim.
//
// The verifier is run as a CHILD PROCESS, not imported, so its real exit code is asserted rather
// than a return value that happens to look right.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = join(ROOT, 'checker/verify-traces.mjs');

let passed = 0;
let failed = 0;
const fail = (name, why) => { failed++; console.error(`  FAIL  ${name}\n        ${why}`); };
const pass = (name, note = '') => { passed++; console.log(`  pass  ${name}${note ? '  — ' + note : ''}`); };

// Run the verifier on one card. Returns { code, codes[] } where `code` is the real process exit
// status and `codes` are the failure codes it printed.
function run(cardPath) {
  const r = spawnSync(process.execPath, [VERIFIER, cardPath], { encoding: 'utf8' });
  const text = (r.stdout || '') + (r.stderr || '');
  const codes = [...text.matchAll(/^\s*\[([A-Z0-9_]+)\]/gm)].map((m) => m[1]);
  return { code: r.status, codes, text };
}

console.log('\n── the control must verify clean ──────────────────────────────────────────────');
{
  const r = run(join(ROOT, 'fixtures/control/card.json'));
  if (r.code !== 0) fail('control exits 0', `exited ${r.code} with codes [${r.codes.join(', ')}]`);
  else pass('control exits 0');
  if (r.codes.length !== 0) fail('control is silent', `emitted [${r.codes.join(', ')}]`);
  else pass('control is silent', '0 problems');
}

console.log('\n── each negative fires on its own gate, and only its own ──────────────────────');
const negDirs = readdirSync(join(ROOT, 'fixtures')).filter((d) => d.startsWith('neg-')).sort();
if (negDirs.length !== 6) fail('six negative fixtures present', `found ${negDirs.length}`);
else pass('six negative fixtures present');

for (const d of negDirs) {
  const expectPath = join(ROOT, 'fixtures', d, 'EXPECT.json');
  if (!existsSync(expectPath)) { fail(`${d} has EXPECT.json`, 'missing'); continue; }
  const expect = JSON.parse(readFileSync(expectPath, 'utf8'));
  const r = run(join(ROOT, 'fixtures', d, 'card.json'));

  if (r.code !== 1) fail(`${d} exits 1`, `exited ${r.code}`);
  else pass(`${d} exits 1`, `class=${expect.invention_class}`);

  const want = [...expect.expect_codes].sort().join(',');
  const got = [...new Set(r.codes)].sort().join(',');
  if (want !== got) fail(`${d} fires exactly [${want}]`, `fired [${got || 'nothing'}]`);
  else pass(`${d} fires exactly [${want}]`);

  if (r.codes.length !== expect.expect_codes.length)
    fail(`${d} reports one problem`, `reported ${r.codes.length}: [${r.codes.join(', ')}]`);
  else pass(`${d} reports ${r.codes.length} problem`);
}

console.log('\n── each negative is the control plus exactly one mutation ─────────────────────');
{
  const control = JSON.parse(readFileSync(join(ROOT, 'fixtures/control/card.json'), 'utf8'));
  for (const d of negDirs) {
    const neg = JSON.parse(readFileSync(join(ROOT, 'fixtures', d, 'card.json'), 'utf8'));
    // Compare the two as key paths so "one mutation" is measured on content, not on formatting.
    const flat = (o, p = '', acc = {}) => {
      if (o === null || typeof o !== 'object') { acc[p] = JSON.stringify(o); return acc; }
      if (Array.isArray(o)) o.forEach((v, i) => flat(v, `${p}[${i}]`, acc));
      else for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, acc);
      return acc;
    };
    const a = flat(control), b = flat(neg);
    const diffs = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => a[k] !== b[k]));
    // neg-05 and neg-06 also restate coverage, deliberately: a mutation that left coverage stale
    // would be caught by the coverage gate instead, and would prove nothing about its own class.
    const budget = d.startsWith('neg-05') || d.startsWith('neg-06') ? 99 : 8;
    if (diffs.size === 0) fail(`${d} differs from control`, 'identical to the control');
    else if (diffs.size > budget) fail(`${d} is a small mutation`, `${diffs.size} leaf differences`);
    else pass(`${d} differs from control`, `${diffs.size} leaf difference(s)`);
  }
}

console.log('\n── the hash gate is not dead code ─────────────────────────────────────────────');
{
  // Stage a tampered input: the same transcript with one byte changed. Every span in the card still
  // points in range, and most still byte-match — but the card is no longer describing these bytes,
  // so the verifier must refuse before reporting anything else.
  const tmpRel = 'fixtures/.tmp-selftest';
  const tmpDir = join(ROOT, tmpRel);
  try {
    mkdirSync(tmpDir, { recursive: true });
    const orig = readFileSync(join(ROOT, 'fixtures/fixture-transcript.txt'));
    const tampered = Buffer.from(orig);
    tampered[270] = tampered[270] === 0x39 ? 0x38 : 0x39; // one digit inside "$5,000"
    writeFileSync(join(tmpDir, 'transcript.txt'), tampered);

    const card = JSON.parse(readFileSync(join(ROOT, 'fixtures/control/card.json'), 'utf8'));
    card.source.file = `${tmpRel}/transcript.txt`;
    writeFileSync(join(tmpDir, 'card.json'), JSON.stringify(card, null, 2) + '\n');

    const r = run(join(tmpDir, 'card.json'));
    if (r.code !== 1) fail('tampered input exits 1', `exited ${r.code}`);
    else pass('tampered input exits 1');
    if (r.codes.join(',') !== 'SHA256_MISMATCH')
      fail('tampered input fires exactly [SHA256_MISMATCH]', `fired [${r.codes.join(', ') || 'nothing'}]`);
    else pass('tampered input fires exactly [SHA256_MISMATCH]', 'and stops there');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\n── the shape test still fails on real drift ───────────────────────────────────');
{
  // The shape comparison unifies the absent marker with anything, because "marked empty where there
  // was nothing" is required behaviour. That relaxation is exactly where a shape test goes quietly
  // vacuous, so each drift class below is staged and the comparison must still reject it.
  const SHAPE = join(ROOT, 'checker/shape-diff.mjs');
  const tmpDir = join(ROOT, 'fixtures/.tmp-selftest');
  const base = JSON.parse(readFileSync(join(ROOT, 'cards/01-mobile-app-setup.card.json'), 'utf8'));

  const drifts = [
    ['a field removed from one card', (c) => { delete c.steps; }],
    ['a field moved out of contract order', (c) => { const s = c.steps; delete c.steps; c.steps = s; }],
    ['an item key removed', (c) => { if (c.numbers !== 'not in source') for (const n of c.numbers) delete n.unit; }],
  ];

  const runShape = (dir) => {
    const r = spawnSync(process.execPath, [SHAPE], { encoding: 'utf8', env: { ...process.env, CARDS_DIR: dir } });
    return r.status;
  };

  try {
    mkdirSync(tmpDir, { recursive: true });
    // Sanity: two identical cards must PASS, or the negative results below mean nothing.
    writeFileSync(join(tmpDir, 'a.card.json'), JSON.stringify(base, null, 2) + '\n');
    writeFileSync(join(tmpDir, 'b.card.json'), JSON.stringify(base, null, 2) + '\n');
    if (runShape(tmpDir) !== 0) fail('two identical cards pass the shape test', 'exited nonzero');
    else pass('two identical cards pass the shape test', 'the control for the three below');

    for (const [label, mutate] of drifts) {
      const drifted = JSON.parse(JSON.stringify(base));
      mutate(drifted);
      writeFileSync(join(tmpDir, 'b.card.json'), JSON.stringify(drifted, null, 2) + '\n');
      const code = runShape(tmpDir);
      if (code !== 1) fail(`shape test rejects: ${label}`, `exited ${code}, expected 1`);
      else pass(`shape test rejects: ${label}`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\n── the shipped cards verify against the shipped inputs ────────────────────────');
{
  const cardsDir = join(ROOT, 'cards');
  const cards = existsSync(cardsDir) ? readdirSync(cardsDir).filter((f) => f.endsWith('.json')).sort() : [];
  if (cards.length === 0) {
    console.log('  SKIP  no cards in cards/ yet — run `node checker/convert.mjs` first');
  } else {
    for (const c of cards) {
      const r = run(join(cardsDir, c));
      if (r.code !== 0) fail(`cards/${c} verifies`, `exited ${r.code} with [${r.codes.join(', ')}]`);
      else pass(`cards/${c} verifies`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
