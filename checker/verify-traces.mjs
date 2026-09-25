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
// This DOES now run a general JSON Schema validator (checker/schema-validate.mjs) against the full
// contract, as the very first gate in verifyCard() — see step 0 below. That validator has no
// knowledge of this file or of convert.mjs; it only knows JSON Schema keywords. What THIS file adds
// on top is everything a schema literally cannot express: byte-for-byte span re-slicing against the
// real input, word-boundary checks, recomputed coverage and recomputed omissions, step ordering
// (the neighbour-span attack), the entities kind/role fence, and the profile's fixed omission bar.
// reference/schema/lesson-card.v1.json is genuinely load-bearing on both counts now: schema-validate
// enforces its structure, and this file reads fieldOrder, unmappedThresholdBytes and the closed
// enums OUT of it.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSchema } from './schema-validate.mjs';

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
// The omission bar is a property of the PROFILE, not of any one card — see the schema's top-level
// `unmappedThresholdBytes` keyword and the description on coverage.unmapped_threshold_bytes.
const PROFILE_THRESHOLD_BYTES = SCHEMA.unmappedThresholdBytes;
if (!Number.isInteger(PROFILE_THRESHOLD_BYTES) || PROFILE_THRESHOLD_BYTES < 1) {
  console.error(`FATAL: schema's unmappedThresholdBytes is missing or invalid: ${JSON.stringify(PROFILE_THRESHOLD_BYTES)}`);
  process.exit(1);
}
// The aggregate omission floor — see the schema's `minimumCoveragePct` keyword and its note for
// why this exists alongside PROFILE_THRESHOLD_BYTES rather than instead of it: the per-run bar
// above only ever looks at ONE contiguous uncovered run at a time, so a card that sheds the same
// total number of bytes spread across many runs, each individually under that bar, sails through
// it. This is a SEPARATE, ALSO-recomputed check on the total.
const MIN_COVERAGE_PCT = SCHEMA.minimumCoveragePct;
if (typeof MIN_COVERAGE_PCT !== 'number' || MIN_COVERAGE_PCT < 0 || MIN_COVERAGE_PCT > 100) {
  console.error(`FATAL: schema's minimumCoveragePct is missing or invalid: ${JSON.stringify(MIN_COVERAGE_PCT)}`);
  process.exit(1);
}

// ── source.file provenance data, read from the shipped inputs themselves ──────────────────────────
// Neither of these is the converter: sha256sums.txt and meta.json are INPUT ARTIFACTS (provenance
// about the shipped transcripts), not code, so reading them here does not compromise this file's
// independence from checker/convert.mjs — convert.mjs happens to read the same two files, but this
// file does not import convert.mjs or anything it produces, and would read the same bytes even if
// convert.mjs did not exist.
const SHA256SUMS_PATH = join(ROOT, 'inputs/sha256sums.txt');
const REGISTERED_INPUTS = new Set();
if (existsSync(SHA256SUMS_PATH)) {
  for (const line of readFileSync(SHA256SUMS_PATH, 'utf8').split('\n')) {
    const m = /^[0-9a-f]{64}\s+(\S+)/.exec(line.trim());
    if (m) REGISTERED_INPUTS.add(m[1]);
  }
}
// basename-without-extension -> the one inputs/ path a card of that name is bound to. Built only
// from the registered set above, so it can never name a file that is not also REGISTERED_INPUTS.
const EXPECTED_SOURCE_BY_BASENAME = new Map();
for (const p of REGISTERED_INPUTS) EXPECTED_SOURCE_BY_BASENAME.set(basename(p).replace(/\.txt$/, ''), p);

const META_PATH = join(ROOT, 'inputs/meta.json');
const INPUT_META = existsSync(META_PATH) ? JSON.parse(readFileSync(META_PATH, 'utf8')) : {};

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

// A byte that can be part of a word, for the (still-byte-level) UTF-8 continuation check below.
const isContinuationByte = (b) => b !== undefined && b >= 0x80 && b <= 0xbf;

// Whether a full Unicode code point counts as "word" for boundary purposes: letters, numbers,
// combining marks, and underscore (kept for parity with the old ASCII `\w`). This used to be a
// per-BYTE test that treated every byte >= 0x80 as a word byte — which could not tell a letter from
// a symbol, so "20" immediately followed by "°" (U+00B0 DEGREE SIGN, category So — a symbol, not a
// letter) was reported as a mid-word cut. Deciding on the actual Unicode code point fixes that
// without loosening the ASCII case at all: a genuine mid-word cut (a letter glued to a letter, a
// digit glued to a digit or an underscore) is still caught exactly as before.
const isWordCodePoint = (cp) => cp === 0x5f || /^[\p{L}\p{N}\p{M}]$/u.test(String.fromCodePoint(cp));

// Map every byte offset in `buf` to the Unicode code point whose UTF-8 encoding covers that byte,
// computed once per input. Span arithmetic elsewhere in this file stays entirely in bytes — this
// table only answers "what character is at/around this byte" for the boundary check.
function byteToCodepoint(buf) {
  const text = buf.toString('utf8');
  const table = new Int32Array(buf.length);
  let b = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const len = Buffer.byteLength(ch, 'utf8');
    for (let k = 0; k < len; k++) table[b + k] = cp;
    b += len;
  }
  return table;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Decode a JSON string literal's contents (the raw text BETWEEN the quotes, escapes untouched — the
// shape parseString() below returns) into the actual string value JSON.parse would produce. A JSON
// object key is a string literal like any other, and JSON lets the same key be spelled multiple ways
// by escaping characters that don't need it: `"\u0074itle"` and `"title"` parse to the identical key
// `title`. The duplicate-key gate below used to compare these RAW literals, so an
// attacker could spell the duplicate key differently each time and sail through — the exact bypass
// this decode closes. Handles every escape JSON actually permits: `\" \\ \/ \b \f \n \r \t` and
// `\uXXXX`. Surrogate pairs need no special handling: two consecutive `\uXXXX` escapes decoding to a
// high surrogate followed by a low surrogate concatenate into the same UTF-16 code unit pair a
// literal astral character would, because JS strings are already sequences of UTF-16 code units —
// there is nothing extra to combine. Throws on an escape sequence JSON does not define; the one
// caller treats any exception here as "let JSON.parse produce the real error" (see its comment),
// which is correct because a string that reaches here already came from parseString() successfully
// finding a closing quote — the only way decoding can still fail is an invalid escape, which
// JSON.parse would reject too.
function decodeJSONKey(raw) {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c !== '\\') { out += c; i++; continue; }
    const next = raw[i + 1];
    switch (next) {
      case '"': out += '"'; i += 2; break;
      case '\\': out += '\\'; i += 2; break;
      case '/': out += '/'; i += 2; break;
      case 'b': out += '\b'; i += 2; break;
      case 'f': out += '\f'; i += 2; break;
      case 'n': out += '\n'; i += 2; break;
      case 'r': out += '\r'; i += 2; break;
      case 't': out += '\t'; i += 2; break;
      case 'u': {
        const hex = raw.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error(`invalid \\u escape in key literal: ${JSON.stringify(raw)}`);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        break;
      }
      default:
        throw new Error(`invalid escape '\\${next}' in key literal: ${JSON.stringify(raw)}`);
    }
  }
  return out;
}

// A card whose keys repeat within the same object parses fine — JSON.parse keeps the LAST value —
// but the file a human opens still visibly contains whatever the FIRST (shadowed) value was. This
// scans the raw text with a small hand-rolled JSON tokenizer (not JSON.parse, which cannot see a
// duplicate once it has collapsed it) and reports every key that appears more than once WITHIN THE
// SAME object literal. It must not flag legitimate repeats ACROSS different objects — every card
// repeats `text`, `span`, `start` dozens of times, once per quote, and none of that is a problem.
// Keys are compared by their DECODED value (via decodeJSONKey, above), not their raw spelling, so
// `"\u0074itle"` and `"title"` — which JSON.parse treats as the exact same key — collide here too.
// Throws on malformed JSON; the caller treats that as "let JSON.parse produce the real error".
function findDuplicateKeys(text) {
  const dups = [];
  const n = text.length;
  let i = 0;

  function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
  function skipWs() { while (i < n && isWs(text[i])) i++; }

  function parseString() {
    const start = i;
    i++; // opening quote
    while (i < n) {
      const c = text[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '"') { i++; return text.slice(start + 1, i - 1); }
      i++;
    }
    throw new Error('unterminated string');
  }

  function parseValue(pathStr) {
    skipWs();
    const c = text[i];
    if (c === '{') return parseObject(pathStr);
    if (c === '[') return parseArray(pathStr);
    if (c === '"') return void parseString();
    if (c === '-' || (c >= '0' && c <= '9')) { i++; while (i < n && /[0-9eE+.\-]/.test(text[i])) i++; return; }
    for (const lit of ['true', 'false', 'null']) {
      if (text.startsWith(lit, i)) { i += lit.length; return; }
    }
    throw new Error(`unexpected character '${c}' at ${i}`);
  }

  function parseObject(pathStr) {
    i++; // {
    const seen = new Map();
    skipWs();
    if (text[i] === '}') { i++; return; }
    while (true) {
      skipWs();
      if (text[i] !== '"') throw new Error(`expected key string at ${i}`);
      const rawKey = parseString();
      const key = decodeJSONKey(rawKey);
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count > 1) dups.push({ path: pathStr || '(root)', key, count });
      skipWs();
      if (text[i] !== ':') throw new Error(`expected ':' at ${i}`);
      i++;
      parseValue(pathStr ? `${pathStr}.${key}` : key);
      skipWs();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; break; }
      throw new Error(`expected ',' or '}' at ${i}`);
    }
  }

  function parseArray(pathStr) {
    i++; // [
    skipWs();
    if (text[i] === ']') { i++; return; }
    let idx = 0;
    while (true) {
      parseValue(`${pathStr}[${idx++}]`);
      skipWs();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; break; }
      throw new Error(`expected ',' or ']' at ${i}`);
    }
  }

  skipWs();
  parseValue('');
  return dups;
}

// ── calibrated proximity thresholds ────────────────────────────────────────────────────────────
// Matching bytes alone do not establish that two quotes are actually about each other — a card can
// carry two individually-real quotes that have nothing to do with one another. These thresholds
// were measured against every shipped card (cards/*.json) plus fixtures/control/card.json on
// 2026-09-24 (the full calibration table is in reference/field-definitions.md) and picked as the loosest bound that every
// legitimate occurrence in that data satisfies, with headroom — not tuned to reject one attack.
//
//   numbers[].unit immediately after numbers[].value: both real occurrences measured a 1-byte gap
//   (a single separating space). 5 bytes allows a little slack for extra whitespace while staying
//   far below the length of an unrelated quote pulled from elsewhere.
const UNIT_MAX_GAP_BYTES = 5;
//   definitions[].definition after definitions[].term: the two real occurrences measured gaps of 4
//   and 11 bytes (" is " and ", which is "). 60 bytes is roughly 5x the observed maximum — enough
//   room for a longer natural-language connective phrase a hand-authored card might use, while
//   staying well under the length of a typical sentence in these transcripts.
const ASSOCIATION_MAX_GAP_BYTES = 60;
//   speakers[].evidence, measured as a PERCENTAGE OF THE WHOLE INPUT rather than a fixed byte count
//   (see the check itself, below, for why relative-to-source is the right unit here). Measured
//   across every shipped card plus fixtures/control/card.json on 2026-09-24: six real occurrences,
//   8/9/15/17/18/22 bytes, against inputs of 1441/1441/386/430/465/6713 bytes — 0.33% to 4.19% of
//   their respective inputs, maximum 4.19%. 20% is roughly 5x that measured maximum ratio, in
//   keeping with the headroom convention above, while staying far below the 100% a whole-file span
//   occupies regardless of how large or small the input is.
const EVIDENCE_MAX_PCT_OF_SOURCE = 20;

// ── the per-card check ──────────────────────────────────────────────────────────────────────────
function verifyCard(cardPath) {
  const problems = [];
  const P = (code, why, extra = {}) => problems.push({ code, why, ...extra });

  let rawText;
  try {
    rawText = readFileSync(cardPath, 'utf8');
  } catch (e) {
    return [{ code: 'CARD_UNPARSEABLE', why: `cannot read ${cardPath}: ${e.message}` }];
  }

  // 0a · duplicate keys, checked on the RAW TEXT before JSON.parse collapses them. If the scanner
  //      itself cannot make sense of the text, that is a parse problem, not a duplicate-key
  //      problem — fall through and let JSON.parse below produce the real error message.
  try {
    const dups = findDuplicateKeys(rawText);
    if (dups.length > 0) {
      return dups.map((d) => ({
        code: 'DUPLICATE_KEY',
        why: `${d.path} has key \`${d.key}\` repeated ${d.count} times — the file a reader opens is not the object the verifier reads, because JSON.parse silently keeps only the last one`,
      }));
    }
  } catch {
    // malformed JSON — JSON.parse below reports it properly.
  }

  let card;
  try {
    card = JSON.parse(rawText);
  } catch (e) {
    return [{ code: 'CARD_UNPARSEABLE', why: `cannot parse ${cardPath}: ${e.message}` }];
  }

  // 0 · schema: the parsed card must conform to reference/schema/lesson-card.v1.json in full —
  //     every type, every required field, every closed enum, additionalProperties, the oneOf
  //     unions, the lot. This runs FIRST and returns immediately on failure, for the same reason
  //     SHA256_MISMATCH stops early below: every check after this point assumes the card has the
  //     shape the schema demands (e.g. that `numbers[i].value` is a quote object carrying a `span`
  //     to re-slice, not a bare number an attacker spliced in). Running span/coverage/ordering
  //     checks against a structurally invalid card would produce a page of misleading crashes and
  //     mismatches instead of one clear reason the card is void.
  const schemaErrors = validateSchema(card, SCHEMA);
  if (schemaErrors.length > 0) {
    return schemaErrors.map((e) => ({ code: 'SCHEMA_INVALID', why: `${e.path || '(root)'}: ${e.message}` }));
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

  // 2a · source.file must stay strictly inside the repo. Checked on the RESOLVED path, not by
  //      grepping for '..' in the string, because that is what actually determines where the bytes
  //      come from: `path.join` normalises '..' segments against ROOT, and it is the normalised
  //      result escaping ROOT that is the real vulnerability — a card can otherwise verify against
  //      an arbitrary file anywhere on disk while claiming to be an audited, in-repo citation.
  if (/^(?:[A-Za-z]:)?[\\/]/.test(srcRel))
    return problems.concat([{ code: 'SOURCE_FILE_ESCAPES_REPO', why: `source.file \`${srcRel}\` is an absolute path` }]);
  const srcPath = join(ROOT, srcRel);
  if (srcPath !== ROOT && !srcPath.startsWith(ROOT + '/'))
    return problems.concat([{ code: 'SOURCE_FILE_ESCAPES_REPO', why: `source.file \`${srcRel}\` resolves outside the repo` }]);

  // 2b · only two directories are treated as holding citable transcript bytes at all: the shipped
  //      inputs, and the test harness's own fixtures. Anything else (README.md, a checker script,
  //      the schema itself) is not a transcript no matter how real the bytes are.
  if (!/^(?:inputs|fixtures)\//.test(srcRel))
    return problems.concat([{ code: 'SOURCE_FILE_NOT_ALLOWED', why: `source.file \`${srcRel}\` is not under inputs/ or fixtures/` }]);

  // 2c · REMOVED 2026-09-24. This used to reject any inputs/*.txt path that was not one of
  //      the four files this repo ships (SOURCE_FILE_UNREGISTERED), on the theory that it closed a
  //      "smuggled input" hole. It didn't just close that hole, it broke the tool's headline use
  //      case: this repo's whole pitch is "drop your own transcript into inputs/, run the documented
  //      workflow, and it verifies" — and because this function with no arguments verifies every
  //      card in cards/, one new, unregistered-but-genuine card failed the entire run.
  //
  //      Think about what registration actually proves. The property this file exists to guarantee
  //      is "nothing in the output exists that was not in the input" — and that is fully established
  //      for an unregistered file by the checks that remain: 2a/2b (the path is real and inside
  //      inputs/ or fixtures/), the sha256 match below (the bytes are exactly what source.sha256
  //      claims), and every span re-slicing cleanly out of those bytes. Citing a file this repo does
  //      not vouch for the PROVENANCE of is not the same claim as inventing content, and conflating
  //      the two punished a stranger's honest, hash-matching citation for a property (repo
  //      registration) it never claimed to have.
  //
  //      The narrower, real property — "the FOUR cards this repo ships cite inputs this repo
  //      actually registered and audited" — still holds, and is still checked, just relocated to
  //      where it belongs: checker/selftest.mjs asserts it directly against cards/*.json and
  //      inputs/sha256sums.txt. That keeps the repo's own shipped evidence honest without rejecting
  //      anyone else's.

  // 2d · a card whose own filename matches one of the registered inputs' basenames is bound to cite
  //      exactly that input. This is what actually stops the AA/AS shape of attack — take a real,
  //      shipped card and repoint its source.file at a different file while changing nothing else —
  //      for the cards that ship and persist in cards/. It is a real, narrower property than "cite
  //      any real file", not a complete one: a card verified under an unrelated filename is not
  //      bound by this check and falls through to 2a-2c only. See the schema's note on source.file.
  const cardBasename = basename(cardPath).replace(/\.card\.json$|\.json$/, '');
  const expectedSrc = EXPECTED_SOURCE_BY_BASENAME.get(cardBasename);
  if (expectedSrc && srcRel !== expectedSrc)
    return problems.concat([
      {
        code: 'SOURCE_FILE_IDENTITY_MISMATCH',
        why: `card \`${basename(cardPath)}\` must cite \`${expectedSrc}\`, not \`${srcRel}\` — its own filename identifies it as a card for that specific registered input`,
      },
    ]);

  const srcExists = existsSync(srcPath);
  if (!srcExists) return problems.concat([{ code: 'SOURCE_MISSING', why: `source file does not exist: ${srcRel}` }]);

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

  // 2e · duration_seconds is sibling metadata from inputs/meta.json, keyed by the input's basename —
  //      re-read here (an input artifact, not the converter) and checked exactly, rather than
  //      merely typed-checked, so a fabricated or stale figure cannot ride along unexamined.
  {
    const metaEntry = INPUT_META[basename(srcRel)];
    const expectedDuration = typeof metaEntry?.duration_seconds === 'number' ? metaEntry.duration_seconds : ABSENT;
    const actualDuration = card.source.duration_seconds;
    if (actualDuration !== expectedDuration)
      P(
        'SOURCE_DURATION_MISMATCH',
        `source.duration_seconds is ${JSON.stringify(actualDuration)}, inputs/meta.json says ${JSON.stringify(expectedDuration)} for ${basename(srcRel)}`
      );
  }

  const N = buf.length;
  const covered = new Uint8Array(N);
  const spansSeen = [];
  const CPS = byteToCodepoint(buf);

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
    // "Inside a word" is decided on the actual Unicode code point on each side of the cut (letters,
    // numbers, marks, underscore), not on the raw byte — so a digit glued to a letter is still
    // caught, but a digit next to a symbol like "°" is not mistaken for one.
    if (s.start > 0 && (isContinuationByte(buf[s.start]) || (isWordCodePoint(CPS[s.start - 1]) && isWordCodePoint(CPS[s.start]))))
      P('SPAN_WORD_BOUNDARY', `${path} span starts mid-word or mid-character at byte ${s.start}`);
    if (s.end < N && (isContinuationByte(buf[s.end]) || (isWordCodePoint(CPS[s.end - 1]) && isWordCodePoint(CPS[s.end]))))
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
  // (duration_seconds's TYPE is already enforced by the schema's oneOf in step 0; its VALUE is
  // checked against inputs/meta.json above in step 2e.)

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

  // 5.1 · a speaker's name must sit INSIDE its own evidence. field-definitions.md says evidence is
  //       "the span of the phrase that established who is speaking" — so the name is not evidence
  //       for itself unless it is part of that phrase. Two individually byte-correct quotes (a real
  //       name, a real evidence phrase for someone else entirely) do not make a speaker; this is
  //       what stops Dana's name being swapped for Tomas's while Dana's own evidence stays put.
  if (Array.isArray(card.speakers))
    card.speakers.forEach((sp, i) => {
      const n = sp?.name?.span, e = sp?.evidence?.span;
      if (!n || !e) return; // already reported by verifyQuote/QUOTE_MISSING_SPAN
      if (!(n.start >= e.start && n.end <= e.end))
        P(
          'SPEAKER_NAME_NOT_IN_EVIDENCE',
          `speakers[${i}].name [${n.start},${n.end}) is not contained in speakers[${i}].evidence [${e.start},${e.end}) — a name quoted from outside its own establishing phrase is not evidence for that phrase`
        );
    });

  // 5.1a · speakers[].evidence cannot be an implausibly large fraction of the whole input. Without
  //        this, a card can set evidence.span to [0, N) — the entire file, byte-identical to itself,
  //        so it trivially satisfies the containment check above no matter what name it wraps — and
  //        that single span marks the ENTIRE input covered, defeating both omission gates
  //        (UNMAPPED_OMISSION and COVERAGE_BELOW_FLOOR) at once. That is not a hypothetical: a card
  //        asserting a software platform is the session's only speaker, with every other field "not
  //        in source", verified clean before this check existed. The bound is a PERCENTAGE of the
  //        source, not a fixed byte count, precisely so it scales with the input: a whole-file span
  //        is 100% of ANY input regardless of size, while a real self-introduction stays a small
  //        single-digit percentage (see EVIDENCE_MAX_PCT_OF_SOURCE's calibration comment above). This
  //        is a stated, disclosed limit, not a hidden one: for a genuinely tiny input (well under
  //        EVIDENCE_MAX_PCT_OF_SOURCE's implied byte floor for that file), a real short establishing
  //        phrase and a whole-file span can no longer be told apart by length alone.
  if (Array.isArray(card.speakers))
    card.speakers.forEach((sp, i) => {
      const e = sp?.evidence?.span;
      if (!e) return; // already reported by verifyQuote/QUOTE_MISSING_SPAN
      const len = e.end - e.start;
      const pctOfSource = (len / N) * 100;
      if (pctOfSource > EVIDENCE_MAX_PCT_OF_SOURCE)
        P(
          'EVIDENCE_SPAN_TOO_LARGE',
          `speakers[${i}].evidence span is ${len} bytes, ${pctOfSource.toFixed(2)}% of the ${N}-byte input (bound ${EVIDENCE_MAX_PCT_OF_SOURCE}%) — an establishing phrase this large relative to its source is not a self-introduction, it is most or all of the transcript`
        );
    });

  // 5.2 · numbers[].unit, when stated, must sit immediately after numbers[].value with nothing but
  //       whitespace between them. A unit that byte-matches something real elsewhere in the input is
  //       not THIS number's unit — proximity is what "adjacent" in field-definitions.md means.
  if (Array.isArray(card.numbers))
    card.numbers.forEach((num, i) => {
      if (!num || num.unit === ABSENT) return;
      const v = num?.value?.span, u = num?.unit?.span;
      if (!v || !u) return; // already reported by verifyQuote/QUOTE_MISSING_SPAN
      const gap = u.start - v.end;
      const between = gap >= 0 && gap <= N ? buf.subarray(v.end, u.start).toString('utf8') : '';
      if (gap < 0 || gap > UNIT_MAX_GAP_BYTES || !/^\s*$/.test(between))
        P(
          'UNIT_NOT_ADJACENT',
          `numbers[${i}].unit [${u.start},${u.end}) is not immediately after numbers[${i}].value [${v.start},${v.end}) (gap=${gap}) — a unit quoted from a different sentence is not this number's unit`
        );
    });

  // 5.3 · definitions[].definition must be associated with definitions[].term — the input's own
  //       connective phrase ("is", "which is") sits between the two, and that phrase is short.
  if (Array.isArray(card.definitions))
    card.definitions.forEach((d, i) => {
      const t = d?.term?.span, def = d?.definition?.span;
      if (!t || !def) return; // already reported by verifyQuote/QUOTE_MISSING_SPAN
      const gap = def.start - t.end;
      if (gap < 0 || gap > ASSOCIATION_MAX_GAP_BYTES)
        P(
          'DEFINITION_NOT_ASSOCIATED',
          `definitions[${i}].definition [${def.start},${def.end}) is ${gap} byte(s) from definitions[${i}].term [${t.start},${t.end}) — a definition this far from its term is not "the definition as given" for it`
        );
    });

  // 5.4 · entities[].role, when stated, must be near entities[].name. The two ways role legitimately
  //       gets set (see convert.mjs) are: a self-introduction that CONTAINS the name ("my name is
  //       Marco Salas"), or a definition phrase that starts shortly AFTER the name ("Dexter is a
  //       platform..."). This closes the bypass where an unrelated existing claim elsewhere in the
  //       card — true on its own, with nothing to do with this entity — was supplied as its role to
  //       clear KIND_WITHOUT_ROLE.
  if (Array.isArray(card.entities))
    card.entities.forEach((e, i) => {
      if (!e || e.role === ABSENT) return;
      const n = e?.name?.span, r = e?.role?.span;
      if (!n || !r) return; // already reported by verifyQuote/QUOTE_MISSING_SPAN
      const contained = n.start >= r.start && n.end <= r.end;
      const roleAfterName = r.start >= n.end ? r.start - n.end : Infinity;
      if (!contained && roleAfterName > ASSOCIATION_MAX_GAP_BYTES)
        P(
          'ROLE_NOT_NEAR_NAME',
          `entities[${i}].role [${r.start},${r.end}) is not near entities[${i}].name [${n.start},${n.end}) — a role with no proximity to the name does not establish that entity's classification`
        );
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
      const text = st?.action?.text;
      if (!s || typeof s.start !== 'number') return; // already reported by verifyQuote

      let why = null;
      if (s.start <= prev) {
        why = `span starts at ${s.start}, at or before ${prevPath} at ${prev} — a procedure is narrated in order, so this span points at a different occurrence of the same words`;
      } else if (i > 0 && typeof text === 'string' && text.length > 0) {
        // A span that increases is not enough on its own: two DIFFERENT actions can each occur
        // twice in the source such that citing the SECOND occurrence of the earlier-narrated one
        // and the FIRST occurrence of a later-narrated one still leaves spans increasing overall,
        // while the actual narration order is reversed. The tell is this step's own wording having
        // an occurrence in the source EARLIER than the previous step's chosen span — a procedure
        // narrated forward cannot have a later step's exact words appear before an earlier step's
        // own cited occurrence, no matter which occurrence either step's span happens to point at.
        const earliest = buf.indexOf(Buffer.from(text, 'utf8'));
        if (earliest !== -1 && earliest < prev)
          why = `text \`${text.length > 40 ? text.slice(0, 40) + '…' : text}\` occurs earlier in the source (byte ${earliest}) than ${prevPath}'s own span (start ${prev}) — a procedure narrated forward cannot have a later step's wording appear before an earlier step's chosen occurrence`;
      }
      if (why) P('STEP_ORDER_NOT_INCREASING', `steps[${i}] ${why}`);
      prev = s.start;
      prevPath = `steps[${i}]`;
    });
  }

  // 6b · no list cites the same span twice.
  //     Every byte of a repeated entry is real, so it passes the byte comparison — but a card that
  //     lists one claim three times is asserting the input said it three times, which it did not.
  //     A sentence the speaker genuinely repeated sits at a DIFFERENT span and is not caught here.
  //     steps[] is left to check 6: a repeated step span already fails its ordering rule.
  const IDENTIFYING_QUOTE = { claims: null, numbers: 'value', entities: 'name', definitions: 'term', speakers: 'name', unmapped: null };
  for (const [field, sub] of Object.entries(IDENTIFYING_QUOTE)) {
    if (!Array.isArray(card[field])) continue;
    const seen = new Map();
    card[field].forEach((item, i) => {
      const s = (sub ? item?.[sub] : item)?.span;
      if (!s || typeof s.start !== 'number') return; // already reported by verifyQuote or the schema gate
      const key = `${s.start},${s.end}`;
      if (seen.has(key))
        P('DUPLICATE_SPAN', `${field}[${i}] cites [${s.start},${s.end}), the same span as ${field}[${seen.get(key)}] — the input says it once, so the card may list it once`);
      else seen.set(key, i);
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

  // 7a · the AGGREGATE floor — a separate gate from the per-run scan in step 8. The per-run scan
  //      below only ever looks at ONE contiguous uncovered run at a time, so a card that sheds the
  //      same total number of bytes spread across many runs, each individually under the bar,
  //      passes it completely. This recomputes total coverage (the `pct` just computed above, from
  //      the card's own spans, never from anything the card asserts) and compares it against
  //      SCHEMA.minimumCoveragePct — a profile-level floor, not a per-card one, for the same reason
  //      the omission bar is read from the schema rather than trusted from the card.
  if (pct < MIN_COVERAGE_PCT)
    P(
      'COVERAGE_BELOW_FLOOR',
      `recomputed coverage is ${pct}%, below the lesson-card.v1 profile's aggregate floor of ${MIN_COVERAGE_PCT}% — even though no single uncovered run reaches the ${PROFILE_THRESHOLD_BYTES}-byte per-run bar, the total loss across all of them does`
    );

  // 8 · nothing that matters got dropped.
  //     Recomputed from the source and the card's spans — NOT read out of the card's unmapped list,
  //     which is the whole point. A run of input that no span touches, at or above the bar, had to
  //     be declared. Runs with no word characters are skipped: whitespace and punctuation between
  //     two quotes is not content that went missing.
  //
  //     The bar itself comes from the PROFILE (schema.unmappedThresholdBytes), never from the card
  //     being judged — a card is free to restate the bar in coverage.unmapped_threshold_bytes for a
  //     human reader, but it cannot choose the bar the scan actually uses. If a card's restatement
  //     disagrees with the profile, that is its own problem below; schema validation in step 0
  //     already guaranteed the field is present and a valid integer >= 1, so it is safe to just
  //     compare here rather than re-check its shape.
  const threshold = PROFILE_THRESHOLD_BYTES;
  if (c.unmapped_threshold_bytes !== threshold) {
    P(
      'COVERAGE_THRESHOLD_NOT_PROFILE',
      `coverage.unmapped_threshold_bytes is ${c.unmapped_threshold_bytes}, but the lesson-card.v1 profile fixes the omission bar at ${threshold} — a card cannot set its own bar`
    );
  }
  {
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
