#!/usr/bin/env node
// shape-diff.mjs — prove the output shape holds across different inputs.
//
//   node checker/shape-diff.mjs                 diff every card in cards/, write audits/SHAPE-DIFF.md
//
// Exit 0 = the shape holds. Exit 1 = it drifted, which means this is a summarizer and the entry is dead.
//
// WHAT "SAME SHAPE" HAS TO MEAN, precisely, or the test proves nothing:
//
//   Same shape is NOT same content. Card 2 has a speaker and cards 1 and 3 do not, because only one
//   of those transcripts contains a self-introduction. A test that demanded identical content would
//   fail on a correct translator; a test that only compared top-level key names would pass on a
//   broken one emitting `{}` for every populated field. Both are useless.
//
//   So the comparison is a STRUCTURAL UNIFICATION:
//     1. the top-level field list AND its order must be identical across every card, and must match
//        the contract's own fieldOrder;
//     2. every field's value must unify across all cards, where the absent marker unifies with
//        anything — that is precisely what "marked empty where there was nothing to fill it" means;
//     3. everything else must match exactly: same keys, same nesting, same primitive types.
//
//   So `unit: {text, span}` and `unit: "not in source"` unify — the contract declares that field
//   optional and the input decides. But `{value, unit}` against `{value}` does NOT unify: a key
//   vanished, and that is drift.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'reference/schema/lesson-card.v1.json'), 'utf8'));
const ABSENT = SCHEMA.$defs.absent.const;
const FIELD_ORDER = SCHEMA.fieldOrder;

// ── structural shapes ───────────────────────────────────────────────────────────────────────────
const ABS = { t: 'absent' };

function shapeOf(v) {
  if (v === ABSENT) return ABS;
  if (v === null) return { t: 'null' };
  if (Array.isArray(v)) {
    // Items inside one array can vary the same legitimate way (one number has a unit, the next does
    // not), so fold them into a single item shape first.
    let item = ABS;
    for (const el of v) {
      const m = merge(item, shapeOf(el));
      if (!m) return { t: 'array', item: { t: 'INCOMPATIBLE' } };
      item = m;
    }
    return { t: 'array', item };
  }
  if (typeof v === 'object') {
    const keys = {};
    for (const [k, val] of Object.entries(v)) keys[k] = shapeOf(val);
    return { t: 'obj', keys };
  }
  return { t: typeof v };
}

// Unify two shapes. Returns the merged shape, or null if they are incompatible.
function merge(a, b) {
  if (a.t === 'absent') return b;
  if (b.t === 'absent') return a;
  if (a.t === 'INCOMPATIBLE' || b.t === 'INCOMPATIBLE') return null;
  if (a.t !== b.t) return null;
  if (a.t === 'array') {
    const item = merge(a.item, b.item);
    return item ? { t: 'array', item } : null;
  }
  if (a.t === 'obj') {
    const ka = Object.keys(a.keys).sort().join(',');
    const kb = Object.keys(b.keys).sort().join(',');
    if (ka !== kb) return null;
    const keys = {};
    for (const k of Object.keys(a.keys)) {
      const m = merge(a.keys[k], b.keys[k]);
      if (!m) return null;
      keys[k] = m;
    }
    return { t: 'obj', keys };
  }
  return a;
}

function render(s) {
  if (!s) return 'INCOMPATIBLE';
  if (s.t === 'absent') return ABSENT;
  if (s.t === 'array') return `array<${render(s.item)}>`;
  if (s.t === 'obj') {
    const k = Object.keys(s.keys);
    if (k.length === 2 && k.includes('text') && k.includes('span')) return 'quote';
    return `{${k.map((n) => `${n}: ${render(s.keys[n])}`).join(', ')}}`;
  }
  return s.t;
}

const describe = (v) =>
  v === ABSENT ? '`not in source`' : Array.isArray(v) ? `${v.length} x \`${render(shapeOf(v).item)}\`` : `\`${render(shapeOf(v))}\``;

// ── load ────────────────────────────────────────────────────────────────────────────────────────
// CARDS_DIR exists so the selftest can point this at deliberately drifted cards and prove the
// comparison still fails. A shape test that has never been seen to fail is not evidence of anything.
const cardsDir = process.env.CARDS_DIR ? resolve(process.env.CARDS_DIR) : join(ROOT, 'cards');
const REPORT = process.env.CARDS_DIR ? null : join(ROOT, 'audits/SHAPE-DIFF.md');
const files = existsSync(cardsDir) ? readdirSync(cardsDir).filter((f) => f.endsWith('.json')).sort() : [];
if (files.length < 2) {
  console.error(`FATAL: need at least 2 cards to diff, found ${files.length} in cards/`);
  process.exit(1);
}
const cards = files.map((f) => ({ name: f, doc: JSON.parse(readFileSync(join(cardsDir, f), 'utf8')) }));
const problems = [];

// 1 · field list and order.
const orders = cards.map((c) => Object.keys(c.doc).join(' > '));
const refOrder = orders[0];
cards.forEach((c, i) => {
  if (orders[i] !== refOrder) problems.push(`field order drifted in \`${c.name}\`:\n  - got \`${orders[i]}\`\n  - ref \`${refOrder}\``);
});
if (refOrder !== FIELD_ORDER.join(' > '))
  problems.push(`field order does not match the contract's fieldOrder:\n  - cards \`${refOrder}\`\n  - contract \`${FIELD_ORDER.join(' > ')}\``);

// 2 + 3 · unify each field across every card.
const rows = [];
for (const f of FIELD_ORDER) {
  const missing = cards.filter((c) => !(f in c.doc));
  if (missing.length) problems.push(`field \`${f}\` is missing from ${missing.map((m) => '`' + m.name + '`').join(', ')}`);

  let merged = ABS;
  let broke = null;
  for (const c of cards) {
    if (!(f in c.doc)) continue;
    const next = merge(merged, shapeOf(c.doc[f]));
    if (!next) { broke = c.name; break; }
    merged = next;
  }

  let verdict;
  if (broke) {
    problems.push(`field \`${f}\` does not unify — \`${broke}\` has an incompatible structure`);
    verdict = '**DRIFT**';
  } else {
    const populated = cards.filter((c) => c.doc[f] !== undefined && c.doc[f] !== ABSENT).length;
    verdict =
      populated === 0 ? 'same (absent in all)' : populated < cards.length ? 'same (absent where the input had none)' : 'same';
  }
  rows.push({
    field: f,
    cells: cards.map((c) => (f in c.doc ? describe(c.doc[f]) : '**MISSING**')),
    verdict,
    sig: broke ? 'INCOMPATIBLE' : render(merged.t === 'array' ? merged.item : merged),
  });
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const ok = problems.length === 0;

let md = `# SHAPE-DIFF — field by field across ${cards.length} cards\n\n`;
md += `The bar from the brief: *"Feed your translator three different inputs of the same kind. All three `;
md += `outputs should have the same shape."*\n\n`;
md += `| field | ${cards.map((c) => '`' + c.name + '`').join(' | ')} | verdict |\n`;
md += `|---|${cards.map(() => '---|').join('')}---|\n`;
for (const r of rows) md += `| \`${r.field}\` | ${r.cells.join(' | ')} | ${r.verdict} |\n`;

md += `\n## Field order — identical in all ${cards.length} cards\n\n\`\`\`\n${refOrder.split(' > ').join('\n')}\n\`\`\`\n`;
md += `\nThis order is not alphabetical and not insertion order. It is the \`fieldOrder\` array in\n`;
md += `\`reference/schema/lesson-card.v1.json\`, and it is checked against it above.\n`;

md += `\n## Unified item signature per field\n\n`;
md += `The structure each field's items take once all ${cards.length} cards are unified. \`quote\` is \`{text, span}\`.\n\n`;
md += `| field | unified signature |\n|---|---|\n`;
for (const r of rows) if (r.sig !== ABSENT) md += `| \`${r.field}\` | \`${r.sig}\` |\n`;

md += `\n## How to read this\n\n`;
md += `**A field that is \`not in source\` in one card and populated in another is not drift.** That is the\n`;
md += `contract working: only one of the three transcripts contains a self-introduction, so only card 2\n`;
md += `carries a \`speakers\` entry — and all three still carry the field, in the same position. The same\n`;
md += `applies inside items: \`unit\` is a quote when the speaker stated a unit and \`not in source\` when\n`;
md += `they did not, and both unify.\n\n`;
md += `**Drift** would be a field that vanished from a card, changed position, or whose items changed\n`;
md += `their key set depending on the input. The comparison unifies absent with anything and demands an\n`;
md += `exact match on everything else, so those three cases are what it actually tests for.\n\n`;

if (ok) {
  md += `## Verdict\n\n**SHAPE HOLDS.**\n\n`;
  md += `${cards.length} inputs — ${cards.map((c) => c.doc.source.bytes.toLocaleString() + ' bytes').join(', ')}, `;
  md += `across two transcription pipelines, one of which does not even end its file with a newline — produced\n`;
  md += `${cards.length} cards with an identical field list, an identical field order matching the contract, and\n`;
  md += `one unified signature per field.\n`;
} else {
  md += `## Verdict\n\n**SHAPE DRIFTED — ${problems.length} problem(s).**\n\n`;
  for (const p of problems) md += `- ${p}\n`;
}
md += `\n---\n\nGenerated by \`checker/shape-diff.mjs\` at ${now}. Regenerate with \`node checker/shape-diff.mjs\`.\n`;

if (REPORT) {
  mkdirSync(join(ROOT, 'audits'), { recursive: true });
  writeFileSync(REPORT, md);
}

for (const r of rows) console.log(`  ${r.field.padEnd(16)} ${r.verdict.replace(/\*/g, '')}`);
if (ok) {
  console.log(`\nSHAPE HOLDS — ${cards.length} cards, identical field list and order. Wrote audits/SHAPE-DIFF.md`);
  process.exit(0);
}
console.error(`\nSHAPE DRIFTED — ${problems.length} problem(s):`);
for (const p of problems) console.error(`  - ${p.replace(/\n/g, '\n    ')}`);
console.error('\nIf the output shape drifts between runs, it is a summarizer. Wrote audits/SHAPE-DIFF.md');
process.exit(1);
