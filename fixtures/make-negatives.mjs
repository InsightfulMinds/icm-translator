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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'A next step nobody said. The fixture adds a fifth step, "Then schedule a follow-up call", with no ' +
      'span at all — which is what invention actually looks like when the author is honest enough not to ' +
      'fake an offset. Content without a span is unverifiable by definition. This used to be caught ad hoc ' +
      'by QUOTE_MISSING_SPAN inside verifyCard(), but the schema gate added in step 0 of verifyCard() now ' +
      'catches it first: `$defs.quote.required` includes `span`, so a `quote` object with no `span` key ' +
      'fails schema validation before the ad hoc check ever runs. Confirmed by running the real verifier ' +
      '(2026-09-24): exactly one problem, `[SCHEMA_INVALID] steps[4].action.span: missing required ' +
      'property \\`span\\`. That is the new gate working correctly, not a regression — verified here so a ' +
      'future change that reopens the QUOTE_MISSING_SPAN path (e.g. loosening the schema) fails this ' +
      'fixture instead of nothing.',
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
    expect_codes: ['STEP_ORDER_NOT_INCREASING', 'COVERAGE_BELOW_FLOOR'],
    note:
      'A span that points at the right text in the wrong place. "click continue" occurs twice in the ' +
      'transcript, at [162,176) and [227,241). Step 2 is moved to the second occurrence. THE BYTES STILL ' +
      'MATCH EXACTLY — a verifier that only compares text passes this card. It is caught because a narrated ' +
      'procedure runs forwards: step 2 now starts at 227 while step 3 starts at 183, so the ordering breaks. ' +
      'This is the fixture worth studying; it is the one that proves the verifier is more than a string compare. ' +
      'Coverage is restated honestly (335 -> 321 bytes, 83.16%) because vacating [162,176) genuinely uncovers ' +
      'those bytes; leaving the old number would trip the coverage gate instead and the fixture would prove ' +
      'nothing about ordering. 83.16% is also below the lesson-card.v1 profile\'s aggregate coverage floor ' +
      '(85%), so COVERAGE_BELOW_FLOOR fires alongside STEP_ORDER_NOT_INCREASING — both are real, ' +
      'independently true findings about this same mutated card, not a duplicate report of one problem.',
    mutate: (c) => {
      c.steps[1].action.span = { start: 227, end: 241 };
      c.coverage.covered_bytes = 321;
      c.coverage.pct = 83.16;
    },
  },
  {
    dir: 'neg-06-dropped-objection',
    class: 'dropped-content',
    expect_codes: ['UNMAPPED_OMISSION', 'COVERAGE_BELOW_FLOOR'],
    note:
      'A dropped objection with nothing in unmapped[]. The fixture removes the claim carrying "One member ' +
      'raised an objection about the price during the call." and does NOT declare it as unmapped. It also ' +
      'restates coverage honestly (335 -> 272 bytes, 70.47%), because a careless dropper would be caught by ' +
      'the coverage gate and that would prove nothing. This stages the HARDER case: a dropper that covers ' +
      'its tracks. It still fails, because the verifier recomputes the uncovered regions from the source ' +
      'rather than reading the card\'s own unmapped list, and the resulting 66-byte hole is over the ' +
      'declared 32-byte bar. 70.47% is also well below the lesson-card.v1 profile\'s aggregate coverage ' +
      'floor (85%), so COVERAGE_BELOW_FLOOR fires alongside UNMAPPED_OMISSION — this single dropped ' +
      'passage is large enough to trip both independent gates at once.',
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

  // ── the twelve bypasses the adversarial reviewer landed against the hardened verifier ──────
  // Each of these stages an attack that was reported to actually get past an EARLIER version of the
  // gates below. Every expect_codes value here was recorded by running the real verifier against the
  // generated fixture and reading its actual output — never guessed. See the per-fixture EXPECT.json notes for the
  // literal command transcripts.

  {
    dir: 'neg-07-bare-number-no-span',
    class: 'bare-number-no-span',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'An invented number smuggled into numbers[] as a bare JS value — not even wrapped in a {value, unit} ' +
      'object, let alone a span. There is nothing to re-slice and nothing to trust; the schema\'s `items` ' +
      'keyword on numbers demands an object with `value`/`unit`, so a bare number fails type checking before ' +
      'anything else runs.',
    mutate: (c) => {
      c.numbers.push(42);
    },
  },
  {
    dir: 'neg-08-span-extra-property',
    class: 'span-extra-property',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'An extra property injected into a span object: claims[0].span gains a `sentiment` key. Nothing in ' +
      'the contract has ever asked a span to carry anything but start/end — `$defs.span` sets ' +
      '`additionalProperties: false` precisely so a span cannot become a place to stash an unverified label ' +
      'that rides along with a real citation.',
    mutate: (c) => {
      c.claims[0].span.sentiment = 'positive';
    },
  },
  {
    dir: 'neg-09-source-extra-property',
    class: 'source-extra-property',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'An extra property injected into `source`: a `conclusion` field carrying invented prose. `source` is ' +
      'metadata ABOUT the input file (file/sha256/bytes/duration_seconds) and `additionalProperties: false` ' +
      'closes it, so a card cannot smuggle an unverifiable claim in under the one object every reader trusts ' +
      'without checking spans.',
    mutate: (c) => {
      c.source.conclusion = 'The client signed up immediately after the call.';
    },
  },
  {
    dir: 'neg-10-tampered-identity',
    class: 'tampered-identity',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'A tampered identity field: `generated_utc` set to a string that is not a valid UTC timestamp. ' +
      '`generated_utc` is file metadata about the card, not a claim extracted from the input, but the schema ' +
      'still pins its shape with a pattern — a malformed timestamp is exactly the kind of thing that should ' +
      'never silently pass through as "close enough".',
    mutate: (c) => {
      c.generated_utc = 'not-a-real-timestamp';
    },
  },
  {
    dir: 'neg-11-deleted-required-field',
    class: 'deleted-required-field',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      'A deleted nested required field: numbers[0].value is removed entirely, leaving only `unit`. A number ' +
      'with no value is not a smaller number, it is not a number at all — the schema requires both `value` ' +
      'and `unit` on every numbers[] item, so deleting one is caught as a missing required property rather ' +
      'than silently tolerated as an incomplete-but-valid entry.',
    mutate: (c) => {
      delete c.numbers[0].value;
    },
  },
  {
    dir: 'neg-12-empty-object-title',
    class: 'empty-object-title',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      '`title` set to `{}` instead of a quote object or the absent marker. `title` is `quoteOrAbsent`, a ' +
      'oneOf between `$defs.quote` (needs text+span) and `$defs.absent` (the literal "not in source") — an ' +
      'empty object matches neither branch, so this is a oneOf failure with zero branches matched, not a ' +
      'value that happens to look empty-but-harmless.',
    mutate: (c) => {
      c.title = {};
    },
  },
  {
    dir: 'neg-13-coverage-pct-non-number',
    class: 'coverage-pct-non-number',
    expect_codes: ['SCHEMA_INVALID'],
    note:
      '`coverage.pct` set to the string "high" instead of a number. Coverage is supposed to be a hard, ' +
      'recomputable fact — a string standing in for it is not a lower-precision version of the fact, it is ' +
      'no fact at all, and the schema\'s `type: number` on `coverage.pct` refuses it outright.',
    mutate: (c) => {
      c.coverage.pct = 'high';
    },
  },
  {
    dir: 'neg-14-coverage-threshold-override',
    class: 'coverage-threshold-override',
    expect_codes: ['COVERAGE_THRESHOLD_NOT_PROFILE'],
    note:
      '`coverage.unmapped_threshold_bytes` overridden from 32 to 999999 — the reviewer\'s attempt to exempt ' +
      'the card from the omission scan entirely by inflating the bar it declares for itself. It does not ' +
      'work even on its own terms: verify-traces.mjs reads the REAL bar out of the schema\'s top-level ' +
      '`unmappedThresholdBytes` (32) and uses that for the scan regardless of what the card claims, then ' +
      'separately checks that the card\'s restatement agrees with the profile. A card that disagrees fails ' +
      'right there, before the scan it was trying to disable ever runs.',
    mutate: (c) => {
      c.coverage.unmapped_threshold_bytes = 999999;
    },
  },
  {
    dir: 'neg-15-speaker-name-swap',
    class: 'speaker-name-swap',
    expect_codes: ['SPEAKER_NAME_NOT_IN_EVIDENCE'],
    note:
      'The relationship attack: speakers[0].name is swapped for a DIFFERENT, individually-real quote — this ' +
      'single-speaker transcript has no second person\'s name to steal, so the nearest equivalent is the ' +
      'tool name "Dexter" — while the original establishing `evidence` span ("my name is Sara", [7,22)) is ' +
      'left untouched. The new name quote is byte-real (span [63,69) really is "Dexter"), so SPAN_TEXT_MISMATCH ' +
      'does not fire; it is caught only because check 5.1 requires the name span to sit INSIDE its own ' +
      'evidence span, and [63,69) is nowhere near [7,22). Two individually-correct quotes that have nothing ' +
      'to do with each other do not make a speaker.',
    mutate: (c) => {
      c.speakers[0].name = { text: 'Dexter', span: { start: 63, end: 69 } };
    },
  },
  {
    dir: 'neg-16-unit-not-adjacent',
    class: 'unit-not-adjacent',
    expect_codes: ['UNIT_NOT_ADJACENT'],
    note:
      'numbers[].unit quoted from far away from its value. The real "a month" unit is replaced with a ' +
      'byte-real quote pulled from an entirely different sentence — the claims[0] span ("this is the ' +
      'onboarding walkthrough") — chosen because it sits inside a region the control already covers, so this ' +
      'mutation does not also disturb coverage. field-definitions.md requires a unit to be immediately after ' +
      'its value; the verifier measures that gap directly rather than trusting that two individually real ' +
      'quotes belong together.',
    mutate: (c) => {
      c.numbers[0].unit = { text: 'this is the onboarding walkthrough', span: { start: 27, end: 61 } };
    },
  },
  {
    dir: 'neg-17-definition-not-associated',
    class: 'definition-not-associated',
    expect_codes: ['DEFINITION_NOT_ASSOCIATED'],
    note:
      'definitions[].definition detached from its term. Dexter\'s real definition ("a platform that gives ' +
      'you an AI agent", 4 bytes after the term) is replaced with claims[2] ("It costs $5,000 a month for ' +
      'the top tier"), a byte-real quote about pricing that has nothing to do with what Dexter is, 190 bytes ' +
      'downstream of the term. Reused from an already-covered span so the mutation stays isolated to the ' +
      'one relationship being tested.',
    mutate: (c) => {
      c.definitions[0].definition = {
        text: 'It costs $5,000 a month for the top tier',
        span: { start: 259, end: 299 },
      };
    },
  },
  {
    dir: 'neg-18-role-not-near-name',
    class: 'role-not-near-name',
    expect_codes: ['ROLE_NOT_NEAR_NAME'],
    note:
      'entities[].role taken from an unrelated part of the input. Dexter\'s real role ("a platform", ' +
      'immediately after its name) is replaced with claims[3] ("One member raised an objection about the ' +
      'price during the call."), a byte-real quote 232 bytes downstream that establishes nothing about what ' +
      'Dexter is. This is the bypass verify-traces.mjs\'s comment names directly: an unrelated existing claim, ' +
      'true on its own, supplied as an entity\'s role to clear KIND_WITHOUT_ROLE without actually classifying ' +
      'anything.',
    mutate: (c) => {
      c.entities[0].role = {
        text: 'One member raised an objection about the price during the call.',
        span: { start: 301, end: 364 },
      };
    },
  },

  // ── property-level bypasses a second, independent premortem found against the hardened ────
  // verifier above. Each of these was reproduced against the real verifier BEFORE the corresponding
  // fix (recorded here as an actual observed exit-0 bypass) and AFTER
  // (recorded as the actual observed problem code) — never guessed.

  {
    dir: 'neg-19-aggregate-omission',
    class: 'aggregate-omission',
    expect_codes: ['COVERAGE_BELOW_FLOOR'],
    note:
      'Distributed sub-threshold trimming defeats the PER-RUN omission gate by construction: no single ' +
      'trim reaches the 32-byte bar, so UNMAPPED_OMISSION never fires, even though real content is gone. ' +
      'This fixture trims claims[3] ("One member raised an objection about the price during the call.") ' +
      'from the end at a word boundary, leaving "One member raised an objection about the price" — a ' +
      '17-byte cut, well under the 32-byte bar, and it merges with the fixture\'s own pre-existing 1-byte ' +
      'gap before unmapped[1] into one 18-byte run (still under the bar, confirmed by measuring every run ' +
      'the mutated card leaves uncovered: max 18 bytes). Coverage is restated honestly (335 -> 318 bytes, ' +
      '82.38%). Before the property-hardening pass this verified clean (0 problems, exit 0) because nothing checked the ' +
      'AGGREGATE total. After the fix, the recomputed 82.38% is below the lesson-card.v1 profile\'s ' +
      'aggregate coverage floor (85%), so COVERAGE_BELOW_FLOOR fires — a check on the TOTAL, independent ' +
      'of any single run\'s size.',
    mutate: (c) => {
      c.claims[3].text = 'One member raised an objection about the price';
      c.claims[3].span = { start: 301, end: 347 };
      c.coverage.covered_bytes = 318;
      c.coverage.pct = 82.38;
    },
  },
  {
    dir: 'neg-21-fabricated-duration',
    class: 'fabricated-duration',
    expect_codes: ['SOURCE_DURATION_MISMATCH'],
    note:
      'source.duration_seconds set to a fabricated figure (987654321) the transcript never stated and ' +
      'inputs/meta.json never recorded. The schema\'s oneOf only ever checked the TYPE (number or "not in ' +
      'source"), never the VALUE, so before the property-hardening pass any non-negative number verified clean — a card ' +
      'could claim any duration for any input. After the fix, verify-traces.mjs re-reads inputs/meta.json ' +
      '(an input artifact, not the converter) and checks the exact value: this fixture\'s source is ' +
      'fixtures/fixture-transcript.txt, which has no entry in inputs/meta.json at all, so the only correct ' +
      'value is "not in source" — anything else, including a fabricated number, now fails with ' +
      'SOURCE_DURATION_MISMATCH.',
    mutate: (c) => {
      c.source.duration_seconds = 987654321;
    },
  },
  {
    dir: 'neg-22-source-file-escape',
    class: 'source-file-escape',
    expect_codes: ['SOURCE_FILE_ESCAPES_REPO'],
    note:
      'source.file set to a `..`-traversal string that resolves outside the repo entirely. Before the ' +
      'property-hardening pass, source.file was never constrained at all — verified live: a copy of a real shipped ' +
      'transcript placed at an ABSOLUTE path outside the repo (a real reproduction with matching sha256, ' +
      'not staged here) verified with 0 problems, exit 0, because the verifier only ever asked "does this ' +
      'file exist and match the given hash", never "is this file inside the repo the reader was handed". ' +
      'This fixture stages the same shape of attack with a plain, deterministic target so it does not ' +
      'depend on what happens to exist outside the repo on any given machine: the fix rejects the path on ' +
      'sight, before ever calling existsSync on it, so SOURCE_FILE_ESCAPES_REPO fires regardless of ' +
      'whether anything real sits at the traversal target. The live matching-bytes reproduction that ' +
      'bypassed the pre-fix verifier is described in reference/field-definitions.md.',
    mutate: (c) => {
      c.source.file = '../../../../../../../etc/escape-probe-does-not-exist.txt';
    },
  },
  // neg-23-source-file-unregistered REMOVED (FIX-1, 2026-09-24). It staged source.file pointing at
  // `inputs/not-a-real-input.txt` — a file that does not exist — to exercise SOURCE_FILE_UNREGISTERED,
  // a gate that rejected any inputs/ path not listed in inputs/sha256sums.txt. That gate is gone: it
  // broke this repo's headline workflow (a reader dropping their own, genuinely hash-matching
  // transcript into inputs/ was rejected by filename before a single byte was read), and the fixture's
  // own EXPECT.json note already admitted the attack it staged never bypassed anything reproducible —
  // a nonexistent file already failed with SOURCE_MISSING, and this repo cannot add a new real file
  // under inputs/ from a fixture to prove the smuggled-and-existing case (inputs/ is fixed, shipped
  // content). Removing the gate turns this fixture's own card back into SOURCE_MISSING, which is a
  // different fixture's job (none currently needed — SOURCE_MISSING is exercised implicitly any time a
  // card names a file that is not there). The real property this gate was reaching for — "the cards
  // this repo SHIPS cite inputs this repo actually registered" — still holds, moved to
  // checker/selftest.mjs, which audits cards/*.json against inputs/sha256sums.txt directly.
  {
    dir: 'neg-24-reversed-step-order',
    class: 'reversed-step-order',
    expect_codes: ['STEP_ORDER_NOT_INCREASING'],
    note:
      'Spans increase but the narrated order is reversed — the shape STEP_ORDER_NOT_INCREASING\'s old ' +
      '`start <= prev` test could not see. This fixture replaces the two real steps needed to demonstrate ' +
      'it with two short, byte-real quotes that actually cross in the source: "is" occurs at bytes 15, 32, ' +
      '70, 128; "and" occurs once, at byte 23. Step 1 cites "and"@23 (its only occurrence, so nothing about ' +
      'step 1 alone looks wrong) and step 2 cites "is"@70 — spans 23 < 70, so the monotonic check passes. ' +
      'But "is" ALSO occurs at byte 15, before step 1\'s own span even starts, which is what a forward ' +
      'narration cannot produce: step 2\'s wording already existed in the source before step 1\'s chosen ' +
      'occurrence. The other four real steps are preserved as unmapped[] entries (reason ' +
      '`no-field-for-this-content`) so removing them from steps[] does not also change coverage or trip ' +
      'the omission gates — this fixture isolates the ordering property alone (coverage recomputes to ' +
      '338/386 = 87.56%, comfortably above the aggregate floor; the largest uncovered run is 20 bytes, ' +
      'under the 32-byte bar). Before the property-hardening pass this verified clean, exit 0.',
    mutate: (c) => {
      const oldSteps = c.steps;
      for (const st of oldSteps) c.unmapped.push({ text: st.action.text, span: st.action.span, reason: 'no-field-for-this-content' });
      c.unmapped.sort((a, b) => a.span.start - b.span.start);
      c.steps = [
        { index: 1, action: { text: 'and', span: { start: 23, end: 26 } } },
        { index: 2, action: { text: 'is', span: { start: 70, end: 72 } } },
      ];
      c.coverage.covered_bytes = 338;
      c.coverage.pct = 87.56;
    },
  },
  {
    dir: 'neg-20-duplicate-key',
    class: 'duplicate-key',
    expect_codes: ['DUPLICATE_KEY'],
    note:
      'A fabricated `"title"` key inserted before the real one, at the SAME object level (root). ' +
      'JSON.parse silently keeps only the LAST value, so before the property-hardening pass the parsed card was byte-for-' +
      'byte identical to the control\'s — the invented sentence is invisible to any check that only looks ' +
      'at the parsed object, even though it sits in the file in plain text. This is the one negative whose ' +
      'mutation is INVISIBLE at the parsed-JSON level by construction (findDuplicateKeys() runs on the raw ' +
      'text before JSON.parse ever collapses it), so it is excluded from the generic "control plus one ' +
      'parsed-key mutation" self-test below and checked separately: identical parsed object, different raw ' +
      'bytes, and a real, observed DUPLICATE_KEY.',
    mutate: () => {}, // the mutation is not at the object level — see postText.
    postText: (text) => {
      const marker = '"title": "not in source",';
      if (!text.includes(marker)) throw new Error('neg-20: title line not found in control text');
      return text.replace(marker, `"title": "How To Defraud The Board In Four Easy Steps",\n  ${marker}`);
    },
  },
  {
    dir: 'neg-26-escaped-key-duplicate',
    class: 'escaped-key-duplicate',
    expect_codes: ['DUPLICATE_KEY'],
    note:
      'neg-20 stages the same key spelled LITERALLY twice; this fixture stages the ' +
      'bypass the original findDuplicateKeys() actually had — the SAME key spelled DIFFERENTLY. JSON lets a ' +
      'key be written as a `\\uXXXX` escape of any of its characters: `"\\u0074itle"` and `"title"` are, byte ' +
      'for byte, two different string literals, but JSON.parse decodes both to the identical key `title` and ' +
      'keeps the LAST one — exactly the same last-wins collapse neg-20 exploits, just spelled around the ' +
      'literal-string comparison the pre-fix detector used. Reproduced live before the fix: a fabricated ' +
      '`"\\u0074itle"` key (decodes to `title`) inserted before the real, literally-spelled `"title"` key ' +
      'verified with 0 problems, exit 0, while `INVENTED HEADLINE NOBODY SAID` sat in the file in plain text. ' +
      'After the fix, findDuplicateKeys() decodes every key through decodeJSONKey() before comparing, so the ' +
      'escaped spelling collides with the plain one and DUPLICATE_KEY fires — identical outcome to neg-20, ' +
      'from a spelling the old comparison could not see as the same key at all.',
    mutate: () => {}, // the mutation is not at the object level — see postText.
    postText: (text) => {
      const marker = '"title": "not in source",';
      if (!text.includes(marker)) throw new Error('neg-26: title line not found in control text');
      // `\u0074` decodes to the single character `t`, so `\u0074itle` and `title` are different JSON
      // string LITERALS (different bytes on disk) that decode to the identical key. Escaping just the
      // first character is enough to make the point; the detector must not depend on which
      // character(s) of the key happen to be escaped.
      return text.replace(marker, `"\\u0074itle": "INVENTED HEADLINE NOBODY SAID",\n  ${marker}`);
    },
  },

  // ── FIX-1: the whole-file speakers[].evidence attack a second adversarial reviewer landed ────────
  // against the hardened verifier. Recorded here after being reproduced live against the real
  // verifier (2026-09-24, pre-fix): a card asserting Dexter — the tool, per every other shipped card —
  // is the session's ONLY speaker, with claims/definitions/numbers/entities/steps/unmapped all "not in
  // source", verified with 0 problems, exit 0.

  {
    dir: 'neg-25-evidence-span-too-large',
    class: 'evidence-span-too-large',
    expect_codes: ['EVIDENCE_SPAN_TOO_LARGE'],
    note:
      'speakers[0].evidence repointed at the ENTIRE input, byte-for-byte — span [0,386), text equal to ' +
      'the full contents of fixtures/fixture-transcript.txt. This is real, byte-matching, in-range and ' +
      'trivially contains the name span, so before this fix nothing rejected it: SPEAKER_NAME_NOT_IN_EVIDENCE ' +
      'cannot fire (any span contains any name once it covers the whole file), and the one span alone marks ' +
      'every byte of the input covered, so neither UNMAPPED_OMISSION nor COVERAGE_BELOW_FLOOR can fire either ' +
      '— coverage is restated honestly (335 -> 386 bytes, 100%) because a careless restatement would trip the ' +
      'coverage-mismatch gate instead and prove nothing about evidence size. Caught only because ' +
      'EVIDENCE_MAX_PCT_OF_SOURCE bounds evidence to 20% of the input\'s bytes: 386 bytes is 100% of a ' +
      '386-byte input, an order of magnitude over the bound.',
    mutate: (c) => {
      const fullBuf = readFileSync(join(HERE, 'fixture-transcript.txt'));
      c.speakers[0].evidence = { text: fullBuf.toString('utf8'), span: { start: 0, end: fullBuf.length } };
      c.coverage.covered_bytes = fullBuf.length;
      c.coverage.pct = 100;
    },
  },
  {
    dir: 'neg-27-duplicate-claim',
    class: 'duplicate-claim',
    expect_codes: ['DUPLICATE_SPAN'],
    note:
      'claims[0] appended to claims[] once more, unchanged — the same text at the same span, twice. ' +
      'Every byte is real and re-slices perfectly, and a repeat adds no new covered bytes, so coverage ' +
      'and both omission gates are untouched. Before this check the card verified with 0 problems, exit 0, ' +
      'while asserting the speaker made the point twice when the input says it once. Caught because ' +
      'no list may cite the same span twice. A sentence the speaker genuinely repeated sits at a different ' +
      'span and is not affected.',
    mutate: (c) => {
      c.claims.push(JSON.parse(JSON.stringify(c.claims[0])));
    },
  },
];

let n = 0;
for (const neg of NEGATIVES) {
  const card = control();
  neg.mutate(card);
  mkdirSync(join(HERE, neg.dir), { recursive: true });
  // postText: for the negatives (neg-20, neg-26) whose mutation lives in the raw bytes rather than the
  // parsed object — a duplicate JSON key is, by construction, invisible once JSON.parse has kept
  // only the last value, so it cannot be expressed as an edit to the in-memory `card`.
  const text = neg.postText ? neg.postText(JSON.stringify(card, null, 2) + '\n') : JSON.stringify(card, null, 2) + '\n';
  writeFileSync(join(HERE, neg.dir, 'card.json'), text);
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
