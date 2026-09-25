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
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
// 6 original + 12 schema/relationship fixtures (neg-07..neg-18) + 5 property fixtures (neg-19, neg-20, neg-21, neg-22,
// neg-24) + 1 hardening fixture (neg-25-evidence-span-too-large). neg-23-source-file-unregistered was
// REMOVED 2026-09-24: it staged SOURCE_FILE_UNREGISTERED, a gate that rejected any inputs/
// path this repo had not itself shipped and registered — which broke the documented workflow of
// dropping a reader's own transcript into inputs/ and verifying it. See checker/verify-traces.mjs's
// step "2c" comment and fixtures/make-negatives.mjs for the full removal rationale.
const EXPECTED_NEG_COUNT = 26;
if (negDirs.length !== EXPECTED_NEG_COUNT) fail(`${EXPECTED_NEG_COUNT} negative fixtures present`, `found ${negDirs.length}`);
else pass(`${EXPECTED_NEG_COUNT} negative fixtures present`);

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
  const controlText = readFileSync(join(ROOT, 'fixtures/control/card.json'), 'utf8');
  const control = JSON.parse(controlText);
  for (const d of negDirs) {
    const negText = readFileSync(join(ROOT, 'fixtures', d, 'card.json'), 'utf8');

    // neg-20's and neg-26's mutation is a duplicate JSON key, which by construction is INVISIBLE once JSON.parse
    // has collapsed it to the last value — there is no parsed-key diff to measure. What actually
    // proves "the control plus one mutation" here is the opposite pairing: the parsed object is
    // IDENTICAL to the control (last-value-wins gives back exactly the control's own title), while
    // the raw bytes on disk are NOT — that gap between "what the object says" and "what the file
    // contains" is the whole finding, so it is asserted directly instead of forced through the
    // generic key-diff check below.
    if (d === 'neg-20-duplicate-key' || d === 'neg-26-escaped-key-duplicate') {
      const neg = JSON.parse(negText);
      const parsedIdentical = JSON.stringify(neg) === JSON.stringify(control);
      const rawDiffers = negText !== controlText;
      if (!parsedIdentical) fail(`${d} parses to the same object as control`, 'a duplicate key should not change the PARSED value');
      else pass(`${d} parses to the same object as control`, 'JSON.parse silently kept the real value');
      if (!rawDiffers) fail(`${d} raw bytes differ from control`, 'no duplicate key was actually inserted');
      else pass(`${d} raw bytes differ from control`, 'the invented title is visible on disk, invisible to JSON.parse');
      continue;
    }

    const neg = JSON.parse(negText);
    // Compare the two as key paths so "one mutation" is measured on content, not on formatting.
    const flat = (o, p = '', acc = {}) => {
      if (o === null || typeof o !== 'object') { acc[p] = JSON.stringify(o); return acc; }
      if (Array.isArray(o)) o.forEach((v, i) => flat(v, `${p}[${i}]`, acc));
      else for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, acc);
      return acc;
    };
    const a = flat(control), b = flat(neg);
    const diffs = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => a[k] !== b[k]));
    // neg-05/06 restate coverage after removing content, deliberately: a mutation that left coverage
    // stale would be caught by the coverage gate instead, and would prove nothing about its own
    // class. neg-24 additionally MOVES its four real steps into unmapped[] (so removing them from
    // steps[] does not also uncover their bytes) — a bigger, still-one-conceptual-mutation edit for
    // the same reason: isolating the ordering property means everything else must stay covered.
    const budget = d.startsWith('neg-05') || d.startsWith('neg-06') || d.startsWith('neg-24') ? 99 : 8;
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

console.log('\n── a card named after a registered input is bound to cite it ──────────────────');
{
  // The AA/AS premortem attack: take a card that is supposed to represent one of the four real,
  // registered transcripts, and repoint its source.file at a different, uncontrolled file while
  // changing nothing else. Staged here with a fully SELF-CONSISTENT swap — same bytes, same hash,
  // only the path differs — because that is the actual shape that bypassed the earlier verifier:
  // a mismatched hash would already have been caught by SHA256_MISMATCH, so it would prove nothing
  // about source.file's identity being unconstrained.
  const tmpDir = join(ROOT, 'fixtures/.tmp-selftest-identity');
  try {
    mkdirSync(tmpDir, { recursive: true });
    const real = JSON.parse(readFileSync(join(ROOT, 'cards/04-pricing-objection.card.json'), 'utf8'));
    real.source.file = 'fixtures/fixture-transcript.txt'; // same repo, real file, wrong identity
    // sha256/bytes are left as card 04's real values on purpose: this card is now internally
    // INCONSISTENT with fixtures/fixture-transcript.txt's actual bytes, which would itself be
    // caught downstream by SHA256_MISMATCH — so the identity check must fire FIRST, before that,
    // to prove it is source.file's IDENTITY being checked and not a side effect of the hash gate.
    const namedPath = join(tmpDir, '04-pricing-objection.card.json');
    writeFileSync(namedPath, JSON.stringify(real, null, 2) + '\n');

    const bound = run(namedPath);
    if (bound.code !== 1) fail('identity-bound card exits 1', `exited ${bound.code}`);
    else pass('identity-bound card exits 1');
    if (bound.codes.join(',') !== 'SOURCE_FILE_IDENTITY_MISMATCH')
      fail('identity-bound card fires exactly [SOURCE_FILE_IDENTITY_MISMATCH]', `fired [${bound.codes.join(', ') || 'nothing'}]`);
    else pass('identity-bound card fires exactly [SOURCE_FILE_IDENTITY_MISMATCH]', 'checked before SHA256_MISMATCH would have fired');

    // Disclosed, not hidden: the SAME repointed card, verified under an UNRELATED filename, is not
    // bound by this check and falls through to the general inputs/fixtures rule — which this exact
    // swap satisfies, so it still verifies. This is a residual, disclosed gap:
    // the identity binding protects a card's own persistent, registered-input-shaped filename; it
    // does not (and structurally cannot, without touching convert.mjs or cards/) bind an arbitrary
    // path to a specific card's claimed identity.
    const unnamedPath = join(tmpDir, 'not-a-registered-name.json');
    const unnamed = JSON.parse(JSON.stringify(real));
    unnamed.source.sha256 = createHash('sha256').update(readFileSync(join(ROOT, 'fixtures/fixture-transcript.txt'))).digest('hex');
    unnamed.source.bytes = readFileSync(join(ROOT, 'fixtures/fixture-transcript.txt')).length;
    // this second copy is NOT self-consistent against fixtures/fixture-transcript.txt's real
    // spans (card 04's claims describe a different transcript) — that is fine and expected: the
    // point of this half of the test is only that it gets PAST the identity check, not that it
    // verifies clean overall, so the assertion below checks for the ABSENCE of the identity code
    // specifically, not a clean pass.
    writeFileSync(unnamedPath, JSON.stringify(unnamed, null, 2) + '\n');
    const unbound = run(unnamedPath);
    if (unbound.codes.includes('SOURCE_FILE_IDENTITY_MISMATCH'))
      fail('unnamed copy is not identity-bound', 'SOURCE_FILE_IDENTITY_MISMATCH fired for a non-registered filename — the binding is supposed to be name-scoped');
    else pass('unnamed copy is not identity-bound', 'residual gap, disclosed in reference/field-definitions.md');
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

console.log('\n── the real converter + real verifier round-trip on genuinely unseen input ────');
{
  // Every other assertion in this file checks a PREPARED artifact: the hand-cut control card, or
  // cards already sitting in cards/. None of that proves the converter itself works on input it has
  // never seen. These two transcripts are synthetic (see fixtures/README.md), were never used to
  // write a rule in convert.mjs or a check in verify-traces.mjs, and exercise hazards convert.mjs's
  // own comments call out as tricky: a product name with internal capitalisation glued to a
  // lowercase prefix (iPhone, GitHub), an identifier joined by an underscore, a non-ASCII SYMBOL
  // character sitting immediately after a digit with no separating space (20°C, 15°), and a phrase
  // repeated verbatim at two different byte offsets in forward order.
  //
  // Both the converter and the verifier run as CHILD PROCESSES with their real exit codes asserted,
  // for the same reason the rest of this file does that. convert.mjs hardcodes its output path to
  // cards/<stem>.card.json — there is no override for the output directory — so the generated card
  // is read from there and then deleted again in `finally`, leaving cards/ exactly as it was; this
  // fixture area does not own cards/ and does not ship a permanent card for synthetic input.
  const CONVERTER = join(ROOT, 'checker/convert.mjs');
  const E2E_INPUTS = ['fixtures/e2e-01-sensor-calibration.txt', 'fixtures/e2e-02-github-sync.txt'];
  for (const inputRel of E2E_INPUTS) {
    const inputPath = join(ROOT, inputRel);
    const cardPath = join(ROOT, 'cards', `${basename(inputRel, '.txt')}.card.json`);
    try {
      if (!existsSync(inputPath)) { fail(`${inputRel}: exists`, 'missing — was it moved or renamed?'); continue; }
      const conv = spawnSync(process.execPath, [CONVERTER, inputPath], { encoding: 'utf8' });
      if (conv.status !== 0) {
        fail(`${inputRel}: convert.mjs exits 0`, `exited ${conv.status}\n${conv.stdout}${conv.stderr}`);
        continue;
      }
      pass(`${inputRel}: convert.mjs exits 0`);

      if (!existsSync(cardPath)) { fail(`${inputRel}: convert.mjs writes a card`, `expected ${cardPath}`); continue; }
      const r = run(cardPath);
      if (r.code !== 0) fail(`${inputRel}: verify-traces.mjs exits 0`, `exited ${r.code} with [${r.codes.join(', ')}]`);
      else pass(`${inputRel}: verify-traces.mjs exits 0`, 'real converter, real verifier, unseen input');
    } finally {
      rmSync(cardPath, { force: true });
    }
  }
}

console.log('\n── the shipped cards cite registered, hash-matching inputs ────────────────────');
{
  // Moved here from verify-traces.mjs on 2026-09-24. verify-traces.mjs no longer rejects a card
  // just for citing an inputs/ path this repo did not itself register — the whole point of the tool is
  // that a reader's own, unregistered transcript must be able to verify. But this repo's own claim is
  // narrower and still real: the FOUR cards it SHIPS cite inputs it actually registered and audited in
  // inputs/sha256sums.txt. That property is checked here, once, directly against the registry file and
  // the real bytes on disk.
  //
  // Deliberately scoped by REGISTERED BASENAME, not "every file currently sitting in cards/": the
  // documented quick-start workflow this whole fix exists to unbreak has a reader run
  // `checker/convert.mjs` on their own transcript, which — per convert.mjs's hardcoded output path —
  // writes straight into cards/<stem>.card.json. If this audit instead scanned the whole directory, a
  // reader who followed the documented workflow and then happened to run this file would get their own,
  // perfectly valid card flagged here, reintroducing the exact bug this fix removed one check up. So
  // this audits only the cards whose name identifies them as one of the four this repo registers and
  // ships — the same name-to-input binding verify-traces.mjs's SOURCE_FILE_IDENTITY_MISMATCH check
  // (2d) uses — and says nothing about any other file that happens to be in cards/.
  const sumsPath = join(ROOT, 'inputs/sha256sums.txt');
  const registered = new Map(); // basename (no .txt) -> { path, sha256 }
  if (existsSync(sumsPath)) {
    for (const line of readFileSync(sumsPath, 'utf8').split('\n')) {
      const m = /^([0-9a-f]{64})\s+(\S+)/.exec(line.trim());
      if (m) registered.set(basename(m[2]).replace(/\.txt$/, ''), { path: m[2], sha256: m[1] });
    }
  }
  if (registered.size === 0) fail('inputs/sha256sums.txt lists at least one registered input', 'found none');
  for (const [name, { path: srcRel, sha256: expectedHash }] of [...registered].sort(([a], [b]) => a.localeCompare(b))) {
    const cardPath = join(ROOT, 'cards', `${name}.card.json`);
    if (!existsSync(cardPath)) { fail(`cards/${name}.card.json exists`, `expected a shipped card for registered input ${srcRel}`); continue; }
    pass(`cards/${name}.card.json exists`);
    const card = JSON.parse(readFileSync(cardPath, 'utf8'));
    if (card?.source?.file !== srcRel) {
      fail(`cards/${name}.card.json cites its registered input`, `source.file is \`${card?.source?.file}\`, expected \`${srcRel}\``);
      continue;
    }
    pass(`cards/${name}.card.json cites its registered input`, srcRel);
    const realHash = createHash('sha256').update(readFileSync(join(ROOT, srcRel))).digest('hex');
    if (expectedHash !== realHash)
      fail(`inputs/sha256sums.txt's hash for ${srcRel} matches the real file`, `registry says ${expectedHash}, actual is ${realHash}`);
    else pass(`inputs/sha256sums.txt's hash for ${srcRel} matches the real file`);
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
