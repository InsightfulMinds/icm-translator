#!/usr/bin/env node
// make-negatives.mjs — build each negative fixture as THE CONTROL PLUS EXACTLY ONE MUTATION.
//
// Why this is a script and not six hand-written files: the claim "each negative is the clean control
// with one thing changed" is the whole reason a negative proves anything. Hand-written fixtures drift
// from the control and then a fixture can fail for a reason nobody intended, which is how a checker
// ends up validated against its author's imagination rather than against the contract.
//
// Run:  node fixtures/make-negatives.mjs
// Re-running is idempotent — it rewrites the six card.json files from the control every time.
//
// This file is NOT the verifier and NOT the converter. It only edits JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const control = () => JSON.parse(readFileSync(join(HERE, 'control/card.json'), 'utf8'));

const NEGATIVES = [
  {
    dir: 'neg-01-invented-date',
    class: 'invented-date',
    expect_codes: ['SPAN_TEXT_MISMATCH'],
    note:
      'A date the input never mentioned. The fixture adds a claim asserting "The call was on March 14" ' +
      'and points it at a real, in-range span so the card LOOKS cited. The verifier re-reads those bytes, ' +
      'finds "this is the onboarding w", and dies. There is no date anywhere in the fixture transcript, ' +
      'so no span could ever have supported this claim.',
    mutate: (c) => {
      c.claims.push({
        text: 'The call was on March 14',
        span: { start: 27, end: 51 },
      });
    },
  },
  {
    dir: 'neg-02-invented-step',
    class: 'invented-next-step',
    expect_codes: ['QUOTE_MISSING_SPAN'],
    note:
      'A next step nobody said. The fixture adds a fifth step, "Then schedule a follow-up call", with no ' +
      'span at all — which is what invention actually looks like when the author is honest enough not to ' +
      'fake an offset. Content without a span is unverifiable by definition, so the contract rejects it ' +
      'outright rather than letting it through as an unchecked string.',
    mutate: (c) => {
      c.steps.push({ index: 5, action: { text: 'Then schedule a follow-up call' } });
    },
  },
  {
    dir: 'neg-03-normalized-name',
    class: 'normalized-name',
    expect_codes: ['SPAN_TEXT_MISMATCH'],
    note:
      'A name spelled the way it usually is instead of the way it appeared — the failure the brief names ' +
      'in so many words. The transcript says "Sara"; the fixture ships "Sarah", the real spelling. This is ' +
      'not a hypothetical but the routine case: correcting it is the most tempting invention in the ' +
      'whole card, because it feels like a fix rather than a fabrication. The span is untouched, so the ' +
      'byte comparison catches it on the four bytes that matter.',
    mutate: (c) => {
      c.speakers[0].name.text = 'Sarah';
    },
  },
  {
    dir: 'neg-04-number-drift',
    class: 'number-drift',
    expect_codes: ['SPAN_TEXT_MISMATCH'],
    note:
      'A number that drifts a digit. "$5,000" becomes "$5,800" with the span left alone. One character, and ' +
      'it is the character a reader is most likely to act on. Nothing about the card looks wrong until the ' +
      'bytes are re-read.',
    mutate: (c) => {
      c.numbers[0].value.text = '$5,800';
    },
  },
  {
    dir: 'neg-05-neighbour-span',
    class: 'neighbour-span',
    expect_codes: ['STEP_ORDER_NOT_INCREASING'],
    note:
      'A span that points at the right text in the wrong place. "click continue" occurs twice in the ' +
      'transcript, at [162,176) and [227,241). Step 2 is moved to the second occurrence. THE BYTES STILL ' +
      'MATCH EXACTLY — a verifier that only compares text passes this card. It is caught because a narrated ' +
      'procedure runs forwards: step 2 now starts at 227 while step 3 starts at 183, so the ordering breaks. ' +
      'This is the fixture worth studying; it is the one that proves the verifier is more than a string compare. ' +
      'Coverage is restated honestly (335 -> 321 bytes, 83.16%) because vacating [162,176) genuinely uncovers ' +
      'those bytes; leaving the old number would trip the coverage gate instead and the fixture would prove ' +
      'nothing about ordering.',
    mutate: (c) => {
      c.steps[1].action.span = { start: 227, end: 241 };
      c.coverage.covered_bytes = 321;
      c.coverage.pct = 83.16;
    },
  },
  {
    dir: 'neg-06-dropped-objection',
    class: 'dropped-content',
    expect_codes: ['UNMAPPED_OMISSION'],
    note:
      'A dropped objection with nothing in unmapped[]. The fixture removes the claim carrying "One member ' +
      'raised an objection about the price during the call." and does NOT declare it as unmapped. It also ' +
      'restates coverage honestly (335 -> 272 bytes, 70.47%), because a careless dropper would be caught by ' +
      'the coverage gate and that would prove nothing. This stages the HARDER case: a dropper that covers ' +
      'its tracks. It still fails, because the verifier recomputes the uncovered regions from the source ' +
      'rather than reading the card\'s own unmapped list, and the resulting 66-byte hole is over the ' +
      'declared 32-byte bar.',
    mutate: (c) => {
      const before = c.claims.length;
      c.claims = c.claims.filter(
        (q) => q.text !== 'One member raised an objection about the price during the call.'
      );
      if (c.claims.length !== before - 1) throw new Error('neg-06: target claim not found in control');
      c.coverage.covered_bytes = 272;
      c.coverage.pct = 70.47;
    },
  },
];

let n = 0;
for (const neg of NEGATIVES) {
  const card = control();
  neg.mutate(card);
  writeFileSync(join(HERE, neg.dir, 'card.json'), JSON.stringify(card, null, 2) + '\n');
  writeFileSync(
    join(HERE, neg.dir, 'EXPECT.json'),
    JSON.stringify(
      { fixture: neg.dir, invention_class: neg.class, expect_codes: neg.expect_codes, note: neg.note },
      null,
      2
    ) + '\n'
  );
  n++;
  console.log(`wrote ${neg.dir.padEnd(28)} class=${neg.class.padEnd(20)} expect=${neg.expect_codes.join(',')}`);
}
console.log(`\n${n} negative fixtures written from control/card.json.`);
