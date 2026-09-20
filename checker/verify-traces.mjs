#!/usr/bin/env node
// verify-traces.mjs — prove every claim in a lesson card traces to the input it names.
//
//   node checker/verify-traces.mjs                     verify every card in cards/ and the control
//   node checker/verify-traces.mjs <card.json> [...]   verify the cards given
//
// Exit 0 = every card verified. Exit 1 = at least one did not.
//
// THE DESIGN RULE, and it is the only one that matters:
//
//   This file never imports the converter. It re-reads the input file named by the card, re-slices
//   every span out of those bytes itself, and re-derives coverage and the unmapped set from
//   scratch. A bug in the producer cannot talk this verifier into agreeing with it, and neither can
//   a model that produced the card by reading the folder as a prompt. The gate is on the artifact,
//   not on the goodwill of whatever made it.
//
// It is also deliberately producer-agnostic: a card written by `convert.mjs` and a card written by
// Claude reading `rules.md` are checked by exactly the same code, with no way for this file to tell
// which one it is looking at.
//
// This is NOT a general JSON Schema validator — it implements the specific structural checks the
// contract names, and it reads fieldOrder and the closed enums OUT of the schema file so that
// reference/schema/lesson-card.v1.json is genuinely load-bearing rather than decorative.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(ROOT, 'reference/schema/lesson-card.v1.json');

// ── the contract, read from reference/ ──────────────────────────────────────────────────────────
if (!existsSync(SCHEMA_PATH)) {
  console.error(`FATAL: contract not found at ${SCHEMA_PATH}`);
  process.exit(1);
}
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const ABSENT = SCHEMA.$defs.absent.const;
const FIELD_ORDER = SCHEMA.fieldOrder;
const KIND_ENUM = SCHEMA.properties.entities.items.properties.kind.enum;
const REASON_ENUM = SCHEMA.properties.unmapped.items.properties.reason.enum;

// Literal strings are allowed only at these paths. Everything else that is a bare string must be
// the `text` of a quote or the absent marker — otherwise it is unverifiable prose sitting in the
// card, which is exactly where an invention would hide.
const LITERAL_OK = [
  /^schema$/,
  /^profile$/,
  /^generated_utc$/,
  /^source\.file$/,
  /^source\.sha256$/,
  /^entities\[\d+\]\.kind$/,
  /^unmapped\[\d+\]\.reason$/,
];

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────

// Show the region around the FIRST divergence, not the first N characters. Two strings that differ
// at character 300 look identical in a head-120 preview, which would make this tool's own output
// unverifiable by the human it exists to serve. Ported from the auditor's verify-citations.mjs.
function window_(want, got) {
  let i = 0;
  while (i < want.length && i < got.length && want[i] === got[i]) i++;
  const from = Math.max(0, i - 40);
  const cut = (s) => (from > 0 ? '…' : '') + s.slice(from, i + 50) + (i + 50 < s.length ? '…' : '');
  return { at: i, want: cut(want), got: cut(got) };
}

// A byte that can be part of a word. Non-ASCII bytes count as word bytes: that is the conservative
// direction, because it makes the boundary check stricter rather than looser.
const isWordByte = (b) =>
  b === undefined ? false : (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x5f || b >= 0x80;
const isContinuationByte = (b) => b !== undefined && b >= 0x80 && b <= 0xbf;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ── the per-card check ──────────────────────────────────────────────────────────────────────────
function verifyCard(cardPath) {
  const problems = [];
  const P = (code, why, extra = {}) => problems.push({ code, why, ...extra });

  let card;
  try {
    card = JSON.parse(readFileSync(cardPath, 'utf8'));
  } catch (e) {
    return [{ code: 'CARD_UNPARSEABLE', why: `cannot parse ${cardPath}: ${e.message}` }];
  }

  // 1 · shape: every field present, in the declared order, nothing extra.
  const keys = Object.keys(card);
  for (const f of FIELD_ORDER) if (!keys.includes(f)) P('SCHEMA_FIELD_MISSING', `required field \`${f}\` is absent`);
  for (const k of keys) if (!FIELD_ORDER.includes(k)) P('SCHEMA_UNKNOWN_FIELD', `field \`${k}\` is not in the contract`);
  const ordered = keys.filter((k) => FIELD_ORDER.includes(k));
  const expected = FIELD_ORDER.filter((f) => keys.includes(f));
  if (ordered.join(',') !== expected.join(','))
    P('SCHEMA_FIELD_ORDER', `field order is [${ordered.join(', ')}], contract requires [${expected.join(', ')}]`);

  // 2 · the input: it must exist and be the exact bytes the card was cut from.
  const srcRel = card?.source?.file;
  if (typeof srcRel !== 'string') return problems.concat([{ code: 'SOURCE_MISSING', why: 'card declares no source.file' }]);
  const srcPath = join(ROOT, srcRel);
  if (!existsSync(srcPath)) return problems.concat([{ code: 'SOURCE_MISSING', why: `source file does not exist: ${srcRel}` }]);

  const buf = readFileSync(srcPath);
  const actualHash = sha256(buf);
  if (card.source.sha256 !== actualHash)
    // Stop here on purpose: if the bytes are not the bytes, every span in the card is void and
    // checking them would produce a page of misleading downstream failures.
    return problems.concat([
      { code: 'SHA256_MISMATCH', why: `source.sha256 does not match ${srcRel}`, want: card.source.sha256, got: actualHash },
    ]);
  if (card.source.bytes !== buf.length)
    P('SOURCE_BYTES_MISMATCH', `source.bytes says ${card.source.bytes}, ${srcRel} is ${buf.length} bytes`);

  const N = buf.length;
  const covered = new Uint8Array(N);
  const spansSeen = [];

  // 3 · every quote byte-matches its span, and no span cuts a word or a character in half.
  function verifyQuote(q, path) {
    const s = q.span;
    if (!s || typeof s.start !== 'number' || typeof s.end !== 'number') {
      P('QUOTE_MISSING_SPAN', `${path} carries text with no usable span — unverifiable by construction`, {
        got: JSON.stringify(q.text).slice(0, 90),
      });
      return;
    }
    if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end <= s.start || s.end > N) {
      P('SPAN_OUT_OF_RANGE', `${path} span [${s.start},${s.end}) is not a valid range in ${srcRel} (0..${N})`);
      return;
    }
    const got = buf.subarray(s.start, s.end).toString('utf8');
    if (got !== q.text) {
      const w = window_(q.text, got);
      P('SPAN_TEXT_MISMATCH', `${path} text is not what ${srcRel}[${s.start},${s.end}) contains (diverges at char ${w.at})`, {
        want: JSON.stringify(w.want),
        got: JSON.stringify(w.got),
      });
      return;
    }
    // The bytes match. That is not yet enough — a span shifted a few bytes can still land on real
    // text. A span that begins or ends inside a word, or inside a UTF-8 character, is not a citation.
    if (s.start > 0 && (isContinuationByte(buf[s.start]) || (isWordByte(buf[s.start - 1]) && isWordByte(buf[s.start]))))
      P('SPAN_WORD_BOUNDARY', `${path} span starts mid-word or mid-character at byte ${s.start}`);
    if (s.end < N && (isContinuationByte(buf[s.end]) || (isWordByte(buf[s.end - 1]) && isWordByte(buf[s.end]))))
      P('SPAN_WORD_BOUNDARY', `${path} span ends mid-word or mid-character at byte ${s.end}`);

    for (let i = s.start; i < s.end; i++) covered[i] = 1;
    spansSeen.push({ path, start: s.start, end: s.end });
  }

  // 4 · walk the whole card. Anything that is a bare string and is neither the absent marker nor an
  //     allow-listed literal is unverifiable prose, and the contract does not permit it.
  function walk(node, path) {
    if (node === null) return P('NULL_VALUE', `${path} is null; the contract uses "${ABSENT}", never null`);
    if (typeof node === 'string') {
      if (node === ABSENT) return;
      if (LITERAL_OK.some((re) => re.test(path))) return;
      return P('FREE_TEXT', `${path} is a bare string that is neither a quote nor "${ABSENT}"`, {
        got: JSON.stringify(node).slice(0, 90),
      });
    }
    if (typeof node === 'number' || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      if (node.length === 0)
        return P('EMPTY_ARRAY_NOT_ALLOWED', `${path} is []; the contract requires "${ABSENT}" when there is nothing`);
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    // object
    if (Object.prototype.hasOwnProperty.call(node, 'text')) {
      verifyQuote(node, path);
      for (const [k, v] of Object.entries(node)) if (k !== 'text' && k !== 'span') walk(v, `${path}.${k}`);
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  }

  for (const f of FIELD_ORDER) {
    if (f === 'source' || f === 'coverage' || f === 'schema' || f === 'profile' || f === 'generated_utc') continue;
    if (card[f] !== undefined) walk(card[f], f);
  }
  if (card.source?.duration_seconds !== undefined) {
    const d = card.source.duration_seconds;
    if (d !== ABSENT && typeof d !== 'number')
      P('SOURCE_DURATION_INVALID', `source.duration_seconds must be a number or "${ABSENT}"`);
  }

  // 5 · closed enums stay closed.
  if (Array.isArray(card.entities))
    card.entities.forEach((e, i) => {
      if (!KIND_ENUM.includes(e.kind)) P('ENUM_VIOLATION', `entities[${i}].kind \`${e.kind}\` is not in ${KIND_ENUM.join('|')}`);
      // The one non-quote field in the card is fenced: no stated role means no classification.
      if (e.role === ABSENT && e.kind !== 'unknown')
        P('KIND_WITHOUT_ROLE', `entities[${i}] is classified \`${e.kind}\` but role is "${ABSENT}" — a kind with no source is a guess`);
    });
  if (Array.isArray(card.unmapped))
    card.unmapped.forEach((u, i) => {
      if (!REASON_ENUM.includes(u.reason)) P('ENUM_VIOLATION', `unmapped[${i}].reason \`${u.reason}\` is not in the closed set`);
    });

  // 6 · steps: index increments by one, and spans strictly increase.
  //     A narrated procedure runs forwards. A step whose span jumps backwards is pointing at a
  //     repeat of the same words elsewhere in the input — the neighbour attack, which passes the
  //     byte comparison and must still be rejected.
  if (Array.isArray(card.steps)) {
    card.steps.forEach((st, i) => {
      if (st.index !== i + 1) P('STEP_INDEX_NOT_SEQUENTIAL', `steps[${i}].index is ${st.index}, expected ${i + 1}`);
    });
    let prev = -1;
    let prevPath = null;
    card.steps.forEach((st, i) => {
      const s = st?.action?.span;
      if (!s || typeof s.start !== 'number') return; // already reported by verifyQuote
      if (s.start <= prev)
        P(
          'STEP_ORDER_NOT_INCREASING',
          `steps[${i}] span starts at ${s.start}, at or before ${prevPath} at ${prev} — a procedure is narrated in order, so this span points at a different occurrence of the same words`
        );
      prev = s.start;
      prevPath = `steps[${i}]`;
    });
  }

  // 7 · coverage, recomputed from the spans rather than trusted.
  let coveredBytes = 0;
  for (let i = 0; i < N; i++) if (covered[i]) coveredBytes++;
  const pct = Math.round((coveredBytes / N) * 10000) / 100;
  const c = card.coverage || {};
  if (c.total_bytes !== N) P('COVERAGE_MISMATCH', `coverage.total_bytes is ${c.total_bytes}, ${srcRel} is ${N} bytes`);
  if (c.covered_bytes !== coveredBytes)
    P('COVERAGE_MISMATCH', `coverage.covered_bytes is ${c.covered_bytes}, the card's own spans cover ${coveredBytes}`);
  if (Math.abs((c.pct ?? -1) - pct) > 0.011) P('COVERAGE_MISMATCH', `coverage.pct is ${c.pct}, recomputed ${pct}`);

  // 8 · nothing that matters got dropped.
  //     Recomputed from the source and the card's spans — NOT read out of the card's unmapped list,
  //     which is the whole point. A run of input that no span touches, at or above the bar the card
  //     set for itself, had to be declared. Runs with no word characters are skipped: whitespace and
  //     punctuation between two quotes is not content that went missing.
  const threshold = Number.isInteger(c.unmapped_threshold_bytes) ? c.unmapped_threshold_bytes : null;
  if (threshold === null) {
    P('COVERAGE_MISMATCH', 'coverage.unmapped_threshold_bytes is missing; the card declares no bar to be held to');
  } else {
    let run = null;
    const flush = () => {
      if (!run) return;
      const [s, e] = run;
      run = null;
      if (e - s < threshold) return;
      const text = buf.subarray(s, e).toString('utf8');
      // A run of pure whitespace and punctuation between two quotes is not content that went
      // missing. Anything alphanumeric, or any non-ASCII character, counts as real content.
      if (!/[A-Za-z0-9]/.test(text) && !/[^\x00-\x7F]/.test(text)) return;
      P(
        'UNMAPPED_OMISSION',
        `${srcRel}[${s},${e}) is ${e - s} bytes of input that no span in the card touches, and it is not declared in unmapped[] (bar is ${threshold})`,
        { got: JSON.stringify(text.length > 110 ? text.slice(0, 110) + '…' : text) }
      );
    };
    for (let i = 0; i < N; i++) {
      if (!covered[i]) run = run ? [run[0], i + 1] : [i, i + 1];
      else flush();
    }
    flush();
  }

  return problems;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────────
let targets = process.argv.slice(2);
if (targets.length === 0) {
  const cardsDir = join(ROOT, 'cards');
  targets = existsSync(cardsDir)
    ? readdirSync(cardsDir).filter((f) => f.endsWith('.json')).sort().map((f) => join(cardsDir, f))
    : [];
  const control = join(ROOT, 'fixtures/control/card.json');
  if (existsSync(control)) targets.push(control);
  if (targets.length === 0) {
    console.error('FATAL: no cards given and none found in cards/');
    process.exit(1);
  }
}

let total = 0;
let failedCards = 0;
for (const t of targets) {
  const rel = t.startsWith(ROOT) ? t.slice(ROOT.length + 1) : t;
  if (!existsSync(t)) {
    console.error(`TRACE FAILURES — ${rel}\n  [CARD_MISSING] file not found\n`);
    failedCards++;
    total++;
    continue;
  }
  const problems = verifyCard(t);
  if (problems.length === 0) {
    console.log(`TRACES VERIFIED — ${rel}. 0 problems.`);
  } else {
    failedCards++;
    total += problems.length;
    console.error(`TRACE FAILURES — ${rel}. ${problems.length} problem(s):`);
    for (const p of problems) {
      console.error(`  [${p.code}] ${p.why}`);
      // `want` is always what the CARD asserts; `got` is always what the INPUT actually contains.
      if (p.want) console.error(`     card  : ${p.want}`);
      if (p.got) console.error(`     input : ${p.got}`);
    }
    console.error('');
  }
}

if (failedCards === 0) {
  console.log(`\nAll ${targets.length} card(s) verified against their inputs.`);
  process.exit(0);
}
console.error(`${failedCards} of ${targets.length} card(s) failed, ${total} problem(s) total.`);
console.error('A card whose claims do not trace to its input does not ship.');
process.exit(1);
