# ICM Translator — session transcript → ICM lesson card

Converts a raw session transcript (Loom/Whisper, YouTube captions, any meeting recording's text)
into a fixed-schema **lesson card**, where every value in the output carries the byte range of the
input it was cut from, and anything the schema could not hold is named instead of dropped.

**The one property worth checking:** nothing in an output exists that was not in the input, and the
repo ships the tool that proves it.

```bash
node checker/convert.mjs        # 4 shipped inputs -> 4 cards
node checker/verify-traces.mjs  # re-read the inputs, byte-check every span      (exit 0 / 1)
node checker/shape-diff.mjs     # field-by-field diff across the 4 cards         (exit 0 / 1)
node checker/selftest.mjs       # 37 assertions, incl. 6 staged inventions       (exit 0 / 1)
```

No dependencies, no install, no network. Node 22+. Everything below was produced by those commands.

---

## The four questions this is judged on

The brief names four. Each is answered below, and each has a command that settles it in one run.

| the question | the answer | settle it yourself |
|---|---|---|
| **Does the output shape hold across different inputs?** | Yes. Four inputs — 1,441 to 7,573 bytes, two transcription pipelines, one hand-written argument, one file with no trailing newline — produce four cards with an identical field list in an identical order, matching the contract's own `fieldOrder`. | `node checker/shape-diff.mjs` → **exit 0** · [detail](#1--the-output-shape-holds-across-different-inputs) |
| **Does every fact in the output trace to the input?** | Yes, and it is checked rather than asserted. Every value is a verbatim quote plus the byte span it was cut from. An independent verifier re-reads the input and re-slices all of them. Six staged inventions are each proven caught. | `node checker/verify-traces.mjs` → **exit 0** · [detail](#3--every-fact-traces-to-the-input) |
| **Is the contract written down in `reference/` where a reader can check it?** | Yes. `reference/schema/lesson-card.v1.json` is a JSON Schema with every field, the absent-marker rule and the span definition. `field-definitions.md` says what each field means; `format-spec.md` fixes the format. Both the converter and the verifier read `fieldOrder` from the schema file rather than hardcoding it. | open [`reference/`](reference/) · [detail](#2--the-contract-is-written-down-in-reference) |
| **README quality — can a stranger figure this out?** | Four commands, no install, no network, no keys, no arguments. Every claim on this page is printed next to the command that produces it, so you can stop reading at any point and check what you have read so far. | run the four commands above |

One more thing the brief does not ask for, included because it is the more useful evidence: a fourth
input was added **specifically to break the tool**, and it found five real limitations. They are
written up honestly in [What the fourth input exposed](#what-the-fourth-input-exposed) rather than
quietly fixed.

## Drop it into a Claude project — the exact files

Add these five, and nothing else:

```
identity.md                             what it converts, from what, to what
rules.md                                the mapping, the gap rule, the never-add list
examples.md                             worked input/output pairs
reference/schema/lesson-card.v1.json    THE CONTRACT — the output schema
reference/field-definitions.md          what each field means
reference/format-spec.md                the format the output must match
```

Then paste a transcript and ask for a lesson card. Claude reads `rules.md` as the procedure and
`reference/` as the contract.

**Do not add `checker/`, `cards/`, `fixtures/` or `inputs/`.** They are the evidence that the
contract holds, not instructions for producing a card — and `cards/` in particular would give the
model finished answers to copy instead of a procedure to follow.

To check what comes back, save it and run `node checker/verify-traces.mjs path/to/card.json`. The
verifier cannot tell whether a card came from Claude or from `convert.mjs`, so the same gate applies
either way.

## What it converts, and who does it by hand

A recorded session comes in as one unpunctuated wall of text with no speaker labels. Somebody reads
it and produces a structured card: who spoke, what was claimed, what the numbers were, what the
steps were, what got defined. The week this was built we did that conversion **25 times by hand** in
one sitting.

The failure mode is never laziness. It is tidying. The person fixes the name the transcription
mangled, rounds the number, writes the next step that was obviously implied — and now a card says
something nobody said, and somebody downstream acts on it.

So this translator optimises for exactly one property: **fidelity**. Not judgement, not improvement.

## What a card looks like

Every leaf that came from the input is a `quote`: the verbatim text, plus the byte range it was cut
from. Nothing else is allowed to carry content.

```json
{
  "schema": "lesson-card.v1",
  "source": { "file": "inputs/04-pricing-objection.txt", "sha256": "32f1fb1b…", "bytes": 1441,
              "duration_seconds": "not in source" },
  "title": "not in source",
  "speakers": [
    { "name":     { "text": "Dana",    "span": { "start": 27, "end": 31 } },
      "evidence": { "text": "I'm Dana", "span": { "start": 23, "end": 31 } } }
  ],
  "numbers": [
    { "value": { "text": "$5,800", "span": { "start": 700, "end": 706 } }, "unit": "not in source" }
  ]
}
```

Two rules do most of the work. A field with nothing to hold carries the literal string
`not in source` — never `null`, never `[]`, never a missing key, because an empty array cannot tell
you whether the input had none or the converter never looked. And a stretch of input with no field
to go to is declared in `unmapped[]` with a reason, so the card accounts for the whole file instead
of quietly keeping the convenient parts.

Check any span by hand:

```bash
$ dd if=inputs/04-pricing-objection.txt bs=1 skip=700 count=6 2>/dev/null
$5,800
```

---

## 1 · The output shape holds across different inputs

Four inputs, chosen to be as unalike as the profile allows:

| # | file | bytes | duration | source | shape |
|---|---|---|---|---|---|
| 1 | `01-mobile-app-setup.txt` | 2,657 | 161 s | Loom → Whisper | one line, trailing newline |
| 2 | `02-desktop-setup.txt` | 6,713 | 391.6 s | Loom → Whisper | one line, trailing newline |
| 3 | `03-mcp-walkthrough.txt` | 7,573 | 425 s | YouTube captions | one line, **no trailing newline** |
| 4 | `04-pricing-objection.txt` | 1,441 | none | **synthetic, written by hand** | two speakers arguing |

5x length range, two transcription pipelines, procedural against discursive against adversarial, one
file that does not end the way the others do, and one input that is not a walkthrough at all.

```
$ node checker/shape-diff.mjs
  schema           same
  profile          same
  generated_utc    same
  source           same
  title            same (absent in all)
  speakers         same (absent where the input had none)
  claims           same
  definitions      same (absent where the input had none)
  numbers          same (absent where the input had none)
  entities         same
  steps            same
  unmapped         same
  coverage         same

SHAPE HOLDS — 4 cards, identical field list and order. Wrote audits/SHAPE-DIFF.md
```

**"Same shape" does not mean "same content,"** and a test that demanded identical content would fail
on a correct translator. So the comparison is a structural unification: the field list and its order
must be identical across every card *and* match the contract's `fieldOrder`; the absent marker
unifies with anything; everything else must match exactly — same keys, same nesting, same types.

That is why `unit: {text, span}` and `unit: "not in source"` unify, while `{value, unit}` against
`{value}` does not. A key vanishing is drift. A field being honestly empty is the contract working.

Note the zeros. Only input 2 contains a self-introduction, so only card 2 has a speaker. Input 2
contains no digits, so its `numbers` is `not in source`. Input 4 has no recording behind it, so its
`source.duration_seconds` is `not in source` while the other three carry a number — and those unify,
which exercises the absent rule one level down inside an object.

All four cards say `title: not in source`, because no speaker ever states a title out loud, and a
video's published title is not the input.

The long form is written to `audits/SHAPE-DIFF.md` — a **generated** report, not a committed one, so
what you read is what your own run produced rather than what was checked in.

## 2 · The contract is written down in `reference/`

Three files, all readable without running anything:

| file | what it fixes |
|---|---|
| [`reference/schema/lesson-card.v1.json`](reference/schema/lesson-card.v1.json) | The output contract. JSON Schema draft 2020-12: every field, every type, `additionalProperties: false`, the `fieldOrder` array, and the three `$defs` that carry the real rules — `absent`, `span`, `quote`. |
| [`reference/field-definitions.md`](reference/field-definitions.md) | What each field means in prose, and the distinction between content extracted *from* the input and metadata *about* it. |
| [`reference/format-spec.md`](reference/format-spec.md) | The format the output must match — encoding, ordering, and how the absent marker is written. |

Three definitions in the schema do the load-bearing work:

- **`absent`** is `const: "not in source"`. One marker, and only one. *"Never null, never an empty
  string, never an empty array, never an omitted key."*
- **`span`** is a half-open byte range `[start, end)` into the UTF-8 bytes of the file named by
  `source.file`. Bytes, not characters and not line numbers — these inputs are single-line
  transcripts, where a line number locates nothing.
- **`quote`** is `{text, span}` with the invariant the verifier enforces:
  `bytes(source.file)[span.start:span.end]` decoded as UTF-8 is byte-identical to `text`. No
  trimming, no case folding, no whitespace collapsing, no spelling normalisation.

The schema is not decoration. **Both `shape-diff.mjs` and `verify-traces.mjs` read `fieldOrder` and
the absent marker out of that file at runtime** rather than hardcoding them, so the contract in
`reference/` is the thing actually being enforced — edit the schema and the checks change with it.

```bash
$ grep -l "reference/schema/lesson-card.v1.json" checker/*.mjs
checker/shape-diff.mjs
checker/verify-traces.mjs

$ grep -n "const FIELD_ORDER" checker/*.mjs
checker/shape-diff.mjs:33:const FIELD_ORDER = SCHEMA.fieldOrder;
checker/verify-traces.mjs:40:const FIELD_ORDER = SCHEMA.fieldOrder;
```

Delete a field from `fieldOrder` in the schema and both checks start failing on every card. That is
what makes the contract load-bearing rather than documentation that drifted.

### The contract has nowhere to put a judgement

The brief rules out judging the input as well as inventing content. An instruction not to judge is a
request. **A schema with nowhere to put a judgement is a fact.**

There is no sentiment field, no quality score, no outcome, no priority, no summary. `additionalProperties`
is `false` and `fieldOrder` is closed, so a card carrying one is not a card with an opinion in it —
it fails validation.

```
❌  "sentiment": "the prospect sounded frustrated"      ← no such field; card rejected
❌  "priority": "high"                                   ← no such field; card rejected
✅  { "text": "I do not agree with that, and I want it on the record that I do not agree.",
      "span": { "start": 1323, "end": 1397 } }
```

That last one is card 4's twelfth claim, verbatim. The card records that the objection was made and
where it was made. It does not record that the objection was *reasonable*, or that the meeting went
badly, because the input does not say those things and there is no field that could hold them.

The one place a card carries a label rather than a quote is `entities[].kind`, and it is deliberately
fenced: it is only ever something other than `unknown` when the input itself stated the role, in
which case `role` carries the span that states it. No role span means `unknown`. It prefers a blank
to a guess.

## 3 · Every fact traces to the input

**Prevented.** `checker/convert.mjs` is extractive. Every string it emits comes from one function
that slices the input buffer between two offsets. There is no code path that can put a character
into a card that was not in the transcript — not a fallback, not a default, not a tidy-up. Invention
is not detected here; it is unrepresentable.

**Proven.** That is a claim about a file, and you should not have to take it on faith. A converter
cannot vouch for itself: any bug that lets invention into a card is equally free to write the code
that declares the card clean. So the check has to be a separate artifact that shares nothing with
the thing it is checking.

`checker/verify-traces.mjs` re-reads the input from disk, re-slices every span itself, and re-derives
coverage and the unmapped set from scratch. **It never imports the converter** — and that is one
command to confirm rather than something to believe:

```bash
$ grep -E "^\s*import" checker/verify-traces.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
```

Four Node builtins and nothing else. No shared parser, no shared span helper, no shared constants.
The two files agree only on the format described in `reference/`, so a bug in the producer has no
channel through which to talk the verifier into agreeing with it.

Which means the verifier does not care what produced the card:

| producer | how |
|---|---|
| **Claude, reading this folder** | drop the folder into a project; `rules.md` is the procedure, `reference/` is the contract |
| **the script** | `node checker/convert.mjs` |

Both are checked by the same code, and it cannot tell which one ran. The guarantee is on the
artifact, not on the goodwill of the thing that wrote it.

### What the verifier actually checks

1. the input's **sha256** matches what the card declares — if the bytes changed, every span is void
   and it stops there
2. every field present, **in the contract's order**, nothing extra
3. every quote **byte-identical** to `input[span.start:span.end]` — no trimming, no normalising
4. no span starts or ends **mid-word or mid-UTF-8-character**
5. `steps[]` spans **strictly increase** and `index` increments by one
6. nothing free-floating: every value is a quote, the absent marker, or declared metadata
7. `coverage` **recomputed** from the card's own spans and compared
8. **every uncovered run** at or above the card's declared threshold is declared in `unmapped[]` —
   recomputed from the source, not read out of the card

Check 8 is what makes *"a CRM note that silently omits the objection the prospect raised is worse
than useless"* a mechanical failure rather than a promise. Check 5 is what makes a citation a
location rather than a string match — see fixture 5 below.

## 4 · The six staged inventions, each proven caught

`fixtures/` holds a clean control card and six negatives. Each negative is **the control plus
exactly one mutation**, generated by `fixtures/make-negatives.mjs` rather than hand-written, so
"only one thing changed" is a property of the build and not a promise in a comment. Each fixture
carries an `EXPECT.json` naming the invention class it stages and the error code it must fire.

All six are built from one 386-byte transcript, `fixtures/fixture-transcript.txt`, which is short
enough to print in full:

```
Hello, my name is Sara and this is the onboarding walkthrough. Dexter is a platform that gives you
an AI agent. The first thing is to click the link below. Next, click continue. Then enter your email
address. Later on you will click continue again to finish. It costs $5,000 a month for the top tier.
One member raised an objection about the price during the call. Thanks for watching.
```

It is deliberately built to contain the ingredients each invention class needs: a name transcription
would plausibly mangle (`Sara`), a figure with a unit (`$5,000 a month`), the phrase `click continue`
at **two** different offsets, an objection that a tidying summariser would drop, and no date
anywhere at all.

The control card verifies clean. Every offset quoted below is checkable with one command — for
example, the bytes the control cites for the speaker's name:

```bash
$ dd if=fixtures/fixture-transcript.txt bs=1 skip=18 count=4 2>/dev/null
Sara
```

Reproduce any single fixture with `node checker/verify-traces.mjs fixtures/<name>/card.json`, or all
of them at once with `node checker/selftest.mjs`. The outputs below are that command's real stdout.

---

### 1 · A date nobody said — `neg-01-invented-date` → `SPAN_TEXT_MISMATCH`

There is no date in the transcript. Not a month, not a weekday, not a number that could be read as
one. So this is the cleanest possible test of pure fabrication: no span anywhere in the input could
support the claim, because the content does not exist.

The mutation adds one claim, and — this is the part that matters — **gives it a real, in-range
span**, so the card looks properly cited:

```json
{ "text": "The call was on March 14", "span": { "start": 27, "end": 51 } }
```

Byte range `[27,51)` is a genuine 24-byte window inside a 386-byte file. Nothing about the card's
shape is wrong. A reviewer skimming the JSON sees a quote with a citation and moves on. The verifier
opens the file and reads those 24 bytes:

```
[SPAN_TEXT_MISMATCH] claims[4] text is not what fixtures/fixture-transcript.txt[27,51) contains (diverges at char 0)
   card  : "The call was on March 14"
   input : "this is the onboarding w"
```

The offset is real, the length is right, and the bytes are something else entirely. Note that the
verifier reports **where** the two diverge — `char 0` here, meaning they share no common prefix at
all, which is the signature of wholly invented content rather than an edit.

### 2 · A next step nobody said — `neg-02-invented-step` → `QUOTE_MISSING_SPAN`

The transcript's procedure ends at step 4. The mutation appends a fifth step that reads like the
obvious thing to do next, with **no span at all**:

```json
{ "index": 5, "action": { "text": "Then schedule a follow-up call" } }
```

This is what invention looks like when whoever wrote the card was honest enough not to fabricate an
offset to go with it. It is also the most dangerous shape, because a schema validator is satisfied:
`steps[]` is an array, `index` is a number, `action.text` is a string, indices still run 1 to 5.

The contract rejects it on the grounds that no span means no way to check:

```
[QUOTE_MISSING_SPAN] steps[4].action carries text with no usable span — unverifiable by construction
   input : "Then schedule a follow-up call"
```

The phrase **"unverifiable by construction"** is the design decision. Unspanned content is not
given the benefit of the doubt and is not passed through as an unchecked string. Anything that
cannot be pointed at cannot ship, which is the only rule that closes this hole — a verifier that
skipped fields it could not check would let every invention through by simply omitting the citation.

### 3 · A name corrected to its usual spelling — `neg-03-normalized-name` → `SPAN_TEXT_MISMATCH`

The transcript says `Sara`. The real person is far more often a `Sarah`, and transcription drops
trailing consonants constantly. The mutation changes exactly one leaf:

```
control : "name": { "text": "Sara",  "span": { "start": 18, "end": 22 } }
fixture : "name": { "text": "Sarah", "span": { "start": 18, "end": 22 } }
```

The span is untouched. One character added. This is the invention class worth dwelling on, because
it is the only one on this list that **feels like diligence** — the person making it believes they
are fixing a transcription error, and half the time they are right about the world and still wrong
about the card. A downstream reader now has a name that was never spoken in the recording.

```
[SPAN_TEXT_MISMATCH] speakers[0].name text is not what fixtures/fixture-transcript.txt[18,22) contains (diverges at char 4)
   card  : "Sarah"
   input : "Sara"
```

`diverges at char 4` — the first four characters match and the fifth does not exist in the input.
Compare that to `neg-01`'s `char 0`. The same gate distinguishes a tidy-up from a fabrication by
where the divergence starts, which is the diagnostic a human actually wants when triaging a failure.

This gate is also why length is checked rather than prefix-matched. A verifier doing `startsWith`
would accept `Sarah` against `Sara` and every truncation-flavoured invention with it.

### 4 · A number that drifts one digit — `neg-04-number-drift` → `SPAN_TEXT_MISMATCH`

```
control : "value": { "text": "$5,000", "span": { "start": 268, "end": 274 } }
fixture : "value": { "text": "$5,800", "span": { "start": 268, "end": 274 } }
```

One character, in the field a reader is most likely to act on, with the span and the byte length left
identical. There is no structural tell: `$5,800` is a well-formed currency figure of the correct
width sitting at a correct offset. It cannot be caught by any amount of schema validation, or by
re-reading the card, or by a second model reviewing the card's plausibility — `$5,800 a month for
the top tier` is a perfectly plausible sentence.

It is caught by reading the input:

```
[SPAN_TEXT_MISMATCH] numbers[0].value text is not what fixtures/fixture-transcript.txt[268,274) contains (diverges at char 3)
   card  : "$5,800"
   input : "$5,000"
```

This fixture is the argument for the whole architecture in one line. The only thing that separates a
correct figure from a wrong one here is a comparison against the source bytes, so that comparison has
to be something the repo performs rather than something the converter asserts.

### 5 · The right text at the wrong occurrence — `neg-05-neighbour-span` → `STEP_ORDER_NOT_INCREASING`

**This is the fixture worth studying.** The phrase `click continue` appears twice in the transcript,
and both occurrences are byte-identical:

```bash
$ dd if=fixtures/fixture-transcript.txt bs=1 skip=162 count=14 2>/dev/null; echo
click continue
$ dd if=fixtures/fixture-transcript.txt bs=1 skip=227 count=14 2>/dev/null; echo
click continue
```

The mutation moves step 2's span from the first occurrence to the second:

```
control : { "index": 2, "action": { "text": "click continue", "span": { "start": 162, "end": 176 } } }
fixture : { "index": 2, "action": { "text": "click continue", "span": { "start": 227, "end": 241 } } }
```

**The byte comparison passes.** `input[227:241]` is exactly `click continue`, so checks 1 through 4
are all satisfied, and any verifier that is really just a string search accepts this card. The card
now says step 2 is the click that happens *after* step 4's "later on you will click continue again
to finish" — a procedure with two of its steps silently transposed, which is worse than a missing
step because it reads as complete.

It is rejected on ordering:

```
[STEP_ORDER_NOT_INCREASING] steps[2] span starts at 183, at or before steps[1] at 227 — a procedure is narrated in order, so this span points at a different occurrence of the same words
```

Step 3 begins at byte 183 (`enter your email address`) while step 2 now begins at 227. A narrated
procedure runs forwards through the recording, so a step that starts later than the step after it is
pointing at the wrong instance of repeated words. This is what makes a span a **location** rather
than a string match, and it is the one guarantee a text-only comparison cannot provide.

One detail in the fixture is itself evidence of care: vacating `[162,176)` genuinely uncovers those
14 bytes, so the generator restates coverage honestly (335 → 321 bytes, 86.79% → 83.16%). Had it
left the old coverage number, the card would have failed on `COVERAGE_MISMATCH` instead and proven
nothing whatsoever about ordering. A negative fixture that fails for the wrong reason is not a test.

### 6 · A dropped objection, with the tracks covered — `neg-06-dropped-objection` → `UNMAPPED_OMISSION`

The transcript contains `One member raised an objection about the price during the call.` This is the
sentence a summariser drops, because it is the one that makes the rest of the card look worse.

The mutation removes that claim from `claims[]`, declares **nothing** in `unmapped[]`, and then
restates coverage honestly to match (335 → 272 bytes, 70.47%). That last step is what makes this the
hard version of the test: a careless dropper leaves a stale coverage figure and gets caught by
arithmetic, which would prove only that the coverage gate works. This fixture stages a dropper that
covers its tracks, so the card is internally consistent — its own numbers all agree with its own
spans.

It fails anyway, because the verifier does not read the card's `unmapped[]` and believe it. It
recomputes the uncovered regions from the source:

```
[UNMAPPED_OMISSION] fixtures/fixture-transcript.txt[299,365) is 66 bytes of input that no span in the card touches, and it is not declared in unmapped[] (bar is 32)
   input : ". One member raised an objection about the price during the call. "
```

66 bytes of the input are now untouched by any span in the card, the card's own declared threshold
is 32, and the hole is not declared. The verifier names the hole and prints its contents, so the
reader sees the dropped sentence rather than a count.

This is the check that makes silent omission a mechanical failure. A card that quietly discards the
objection a member raised is worse than no card at all, because somebody downstream will read it as
complete — and "completeness" is the one property a summariser can never be held to, since there is
nothing to compare its output against. Here there is: the input.

---

### What makes these six evidence rather than decoration

`selftest.mjs` asserts each fixture fires **exactly its own code and nothing else** — and that
second half is the load-bearing one. A verifier that rejected every card would pass all six
"was it caught" tests while being useless. A fixture that tripped three gates at once would prove
nothing about the specific class it claims to stage. So the assertion is exact-set equality on the
codes, plus a problem count of exactly 1:

```
pass  neg-04-number-drift exits 1  — class=number-drift
pass  neg-04-number-drift fires exactly [SPAN_TEXT_MISMATCH]
pass  neg-04-number-drift reports 1 problem
```

The control is asserted to be **silent**, not merely passing, which is what stops the suite from
being satisfied by a verifier that complains about everything.

The selftest also exercises the two gates most likely to rot into dead code, because nobody has ever
watched them fire:

- it **tampers with a single input byte** and requires `SHA256_MISMATCH`, and requires the verifier
  to stop there rather than continue reporting span errors — if the bytes changed, every span in the
  card is void and reporting on them is noise
- it stages **three kinds of shape drift** (a field removed, a field moved out of contract order, an
  item key removed) and requires the shape test to reject each, having first confirmed that two
  identical cards pass it

A gate nobody has seen fail is not a gate. The full run is 37 assertions.

---

## What the fourth input exposed

Inputs 1, 2 and 3 are the same genre: one person calmly narrating a walkthrough. Three inputs of one
genre cannot test what happens when the *shape of the conversation* changes, so a fourth was added
that changes it — two speakers, no speaker labels, two directly contradicting claims about the same
quantity, an objection raised and never resolved, and a figure corrected mid-sentence.

**It is synthetic and it says so.** `04-pricing-objection.txt` was written by hand for this repo.
There is no recording behind it, the names are invented, and `inputs/PROVENANCE.md` states that
plainly. A fabricated input presented as found material would be the same failure this repo exists
to prevent.

It is also **deliberately outside the declared profile** in `identity.md`, which says this translator
takes single-narrator walkthrough transcripts. A two-party argument is not that. What the tool does
on an input it was not built for is worth more to a reader than a fourth clean pass.

```
$ node checker/convert.mjs inputs/04-pricing-objection.txt
inputs/04-pricing-objection.txt -> cards/04-pricing-objection.card.json  speakers=2 claims=12 defs=0 numbers=4 entities=2 steps=4 unmapped=12 coverage=98.06%
```

The card verifies — every span byte-exact, shape identical to the other three, nothing invented. It
also exposed five real limitations. **None were fixed quietly.** None are invention; every one is a
precision or completeness limit, which is a different and lesser failure than putting something in
the output that was not in the input.

### The five findings

**1 · Claims carry no speaker attribution, and the card does not admit it.**
`speakers[]` correctly holds both `Dana` and `Tomas`. All twelve claims are bare quotes with no
speaker field, so the card cannot answer *"who said this"* — on an input whose entire point is that
two people disagree, that is the question that matters most. Worse, the schema's `unmapped.reason`
enum declares a value `ambiguous-attribution` that **`convert.mjs` never emits**. The contract
anticipated this case and the converter stays silent about it. With one narrator there is nothing to
attribute ambiguously, which is exactly why three same-genre inputs could never surface it.

**2 · The two humans are missing from `entities[]`. `Thursday` and `August` are in it.**
Entity detection deliberately skips sentence-initial capitalised runs, because a capital at the start
of a sentence carries no information about whether a word is a name. That rule is right. It collides
with the fact that people introduce themselves at the start of sentences: `I'm Dana` and
`And I'm Tomas` are both sentence-initial, so neither name is ever recorded as an entity, while two
date words are.

**3 · `steps[]` fills with argument.** The input is a meeting with no procedure in it. The card
reports four numbered steps anyway, because the markers fire on conversational imperatives:

```
1  "Then the provisioning export is wrong, because I closed twenty-nine contracts and you cannot
    onboard a school that has not signed anything."
2  "Let's go ahead and park the pricing for a second."
3  "Check the invoice from August, it has the real one on it."
4  "Then we correct the deck."
```

Step 1 is a rebuttal. None of the four is a procedural step. Every span is verbatim and verifies, so
this is not invention — but the card presents an ordered procedure that was never a procedure, which
is a misclassification a reader could act on. `steps[]` does **not** come back honestly empty on a
non-procedural input, and it should.

**4 · The disputed figures never reach `numbers[]`.** The meeting is an argument about whether the
number is forty-two or twenty-nine. Both are spelled out, and the number extractor is digit-only, so
`numbers[]` contains the four dollar amounts and neither of the two figures under dispute. They do
survive verbatim in `claims[]` and `steps[]`, so nothing is silently dropped and coverage is honest —
but anything consuming `numbers[]` alone would never see the quantity the meeting was about.

**5 · A trailing comma rides along in a span.** The figure `$5,000,` is captured with its trailing
comma, because the value pattern `\d[\d,]*` allows a comma in the final position:

```
{ "value": { "text": "$5,000,", "span": { "start": 685, "end": 692 } }, "unit": "not in source" }
```

The quote is byte-identical to `input[685:692]`, so it verifies correctly and is not a fidelity
failure — the span is simply one byte wider than the figure. Inputs 1–3 never once had a number
followed by a comma, which is precisely why three inputs of one genre did not find it.

### What it got right

- **The mid-sentence correction is preserved without a verdict.** `We quoted the district $5,000,
  sorry, $5,800 per site` yields both values, in document order, with correct spans. The tool does
  not decide which one is current, because the input does not say. A reader gets both and the
  correction is visible. A downstream consumer gets both with no recency signal — worth knowing, but
  the alternative is a guess.
- **`per site` produced no unit.** It is not in the unit table, so `unit` is `not in source` rather
  than an invented one. Units are the easiest place to smuggle an invention in.
- **The objection survived.** `I do not agree with that, and I want it on the record that I do not
  agree.` is claim 12. Both sides of the forty-two/twenty-nine contradiction are in the card. Nothing
  was dropped to make the output tidier.
- **`duration_seconds` is `not in source`.** There is no recording, so there is no duration, so the
  card says so — in position, in the contract's order, unified with the numeric value the other three
  cards carry.

---

## The full run, verbatim

Four commands, in order, on a clean checkout. No arguments, no environment, no network. This is the
whole basis for every claim above.

```
$ node --version
v22.22.1

$ node checker/convert.mjs ; echo "exit=$?"
inputs/01-mobile-app-setup.txt -> cards/01-mobile-app-setup.card.json  speakers=0 claims=28 defs=0 numbers=2 entities=2 steps=17 unmapped=9 coverage=97.97%
inputs/02-desktop-setup.txt -> cards/02-desktop-setup.card.json  speakers=1 claims=67 defs=1 numbers=0 entities=10 steps=9 unmapped=12 coverage=98.69%
inputs/03-mcp-walkthrough.txt -> cards/03-mcp-walkthrough.card.json  speakers=0 claims=60 defs=0 numbers=2 entities=15 steps=4 unmapped=5 coverage=99.1%
inputs/04-pricing-objection.txt -> cards/04-pricing-objection.card.json  speakers=2 claims=12 defs=0 numbers=4 entities=2 steps=4 unmapped=12 coverage=98.06%
exit=0

$ node checker/verify-traces.mjs ; echo "exit=$?"
TRACES VERIFIED — cards/01-mobile-app-setup.card.json. 0 problems.
TRACES VERIFIED — cards/02-desktop-setup.card.json. 0 problems.
TRACES VERIFIED — cards/03-mcp-walkthrough.card.json. 0 problems.
TRACES VERIFIED — cards/04-pricing-objection.card.json. 0 problems.
TRACES VERIFIED — fixtures/control/card.json. 0 problems.

All 5 card(s) verified against their inputs.
exit=0

$ node checker/shape-diff.mjs ; echo "exit=$?"
...13 per-field lines, reproduced in full under section 1 above...
SHAPE HOLDS — 4 cards, identical field list and order. Wrote audits/SHAPE-DIFF.md
exit=0

$ node checker/selftest.mjs ; echo "exit=$?"
...37 individual "pass" lines in six groups, listed below...
37 passed, 0 failed.
exit=0
```

Those last two are the only outputs elided on this page, and both are elided to their summary line
only — run them yourself and you get the per-line detail.

`selftest.mjs`'s 37 assertions are grouped six ways, and the group headers are worth reading on their
own because they are the argument for why 37 is the right 37:

```
── the control must verify clean ──────────────────────────────────────────────
── each negative fires on its own gate, and only its own ──────────────────────
── each negative is the control plus exactly one mutation ─────────────────────
── the hash gate is not dead code ─────────────────────────────────────────────
── the shape test still fails on real drift ───────────────────────────────────
── the shipped cards verify against the shipped inputs ────────────────────────
```

The count moved from 36 to 37 when the fourth input was added. The last group iterates `cards/`, so
a new card adds an assertion rather than relaxing one. No check was weakened, edited or skipped to
accommodate the new input.

### Reproducibility: the committed cards regenerate exactly

Running `convert.mjs` in a fresh clone overwrites `cards/`, so `git diff` afterwards is the cleanest
available statement of how reproducible the conversion is. It is **four lines, all of them the
timestamp**:

```
$ git clone <this repo> && cd icm-translator-public
$ node checker/convert.mjs
$ git diff --stat
 cards/01-mobile-app-setup.card.json  | 2 +-
 cards/02-desktop-setup.card.json     | 2 +-
 cards/03-mcp-walkthrough.card.json   | 2 +-
 cards/04-pricing-objection.card.json | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)

$ git diff -U0 | grep -E '^[+-][^+-]' | grep -vc generated_utc
0
```

Every span, every quote, every coverage figure and every `unmapped[]` entry is byte-identical to what
was committed. `generated_utc` differs because §10 of `rules.md` requires it to be read from a real
clock rather than hardcoded, which is the one value in a card that is honestly allowed to change
between runs — it is metadata about the conversion, not content extracted from the transcript.

So the cards in `cards/` are not artifacts you have to trust were produced the way this README says.
You can regenerate them and diff.

The shipped bytes are hash-checkable too, which is what makes every span in every card meaningful:

```
$ shasum -a 256 -c inputs/sha256sums.txt ; echo "exit=$?"
inputs/01-mobile-app-setup.txt: OK
inputs/02-desktop-setup.txt: OK
inputs/03-mcp-walkthrough.txt: OK
inputs/04-pricing-objection.txt: OK
exit=0
```

---

## What it does not do

Stated plainly, because a tool whose selling point is that it does not invent should not oversell
itself either:

- **It does not summarise.** There is no condensing step. Every card is *larger* than its transcript
  — 2,657 bytes in gives 10,622 bytes out, 6,713 gives 19,839, 7,573 gives 18,612, 1,441 gives 7,088
  — because a card copies content verbatim and then adds a citation to each piece. If you want
  something shorter than the input, this is the wrong tool.
- **It does not understand the session.** No topic, no sentiment, no outcome, no quality judgement,
  no scoring. It has no opinion about the transcript.
- **It does not correct the input.** Not a mangled name, not a mis-transcribed product, not grammar,
  not punctuation. If the caption track heard the platform as `Aduba`, the card says `Aduba`.
- **It does not infer.** No dates, no next steps, no implied units, no resolved pronouns, no
  attribution of a claim to a speaker the input did not attribute it to.
- **It does not fill gaps.** A field with nothing to put in it says `not in source`, every time,
  rather than guessing a plausible value.
- **It does not use a model at runtime.** `convert.mjs` is deterministic table-driven extraction. The
  same input produces the same card, and the tables live in `rules.md` where you can read them.
- **It does not reach outside the input.** Not the filename, not sibling metadata, not a video's
  published title. Those are not the input, so they cannot appear in the card.
- **It is not a general transcript tool.** One profile ships, `lesson-card.v1`, for one kind of
  input. Anything else needs a new schema — and input 4 shows what that costs.

## Limits, stated plainly

These are real and none of them are hidden. The first five are confirmed by the fourth input above.

- **No speaker attribution on claims.** The card can list who spoke and what was claimed, but not who
  claimed what. `ambiguous-attribution` exists in the schema and is never emitted.
- **Numbers must be digits.** "five thousand" and "forty-two" are not extracted into `numbers[]`;
  they land in a claim instead. Faithful, but incomplete.
- **Classification is table-driven, so it is blunt.** A sentence that contains a sequence marker and
  an imperative is filed as a step, whether or not it is one. The tables are in `rules.md`, visible
  and editable, rather than buried in a model's judgement.
- **Entities skip sentence-initial names.** Suppressing sentence-initial capitals avoids false
  entities and costs real ones, including self-introducing speakers.
- **Number spans can include a trailing comma.** Verifies correctly; one byte wider than the figure.
- **`definitions[]` fires on two syntactic patterns.** A definition phrased any other way is not
  caught and its sentence becomes a claim.
- **`kind` is `unknown` for most entities**, by design — the fence in `rules.md` §8 means no stated
  role produces no classification. It prefers a blank to a guess.
- **Coverage is not comprehension.** 99% coverage means 99% of the bytes sit under some span. It
  does not mean the card understood the session.
- **`title` has never fired on a real input.** It is exercised only by the fixture. Four transcripts
  never state one.
- **It has only ever been run on macOS, on Node 22.22.1.** Never on Linux, never on Windows, never
  on another Node major. There is nothing platform-specific in the code — four Node builtins, no
  dependencies, no shell-outs — but "should work" is not "was run", and this line is the difference.
- **One input is synthetic.** Three of the four shipped inputs are real recordings; the fourth I
  wrote by hand. It is labelled as such in `inputs/PROVENANCE.md` and in the section above.

The honest summary: this translator's strength is that it cannot invent, and its weakness is that
extraction that cannot invent is also blunt. Given the brief — *one invented fact and the entry is
out* — that is the trade to make.

## Layout

```
identity.md    what it converts, from what, to what
rules.md       the mapping: which input parts feed which fields, what to do with a gap, what never to add
examples.md    six worked examples, every span copied from a real card
reference/     THE CONTRACT — schema/lesson-card.v1.json, field-definitions.md, format-spec.md
README.md      this file
checker/       convert.mjs · verify-traces.mjs · shape-diff.mjs · selftest.mjs
inputs/        3 real transcripts + 1 synthetic + sha256sums.txt + PROVENANCE.md
fixtures/      clean control + 6 staged inventions + the generator that builds them
cards/         the 4 outputs
audits/        generated by shape-diff.mjs, not committed — your run writes it
```

`reference/` holds the contract because a schema that is not written down somewhere a reader can
open gives nobody a way to check whether the translator kept its promise.

## Room to expand

The engine is profile-driven: the conversion lives in `reference/schema/<profile>.json`, and the
trace verifier knows only about spans and bytes. `discovery-notes → SOW` and
`carrier-doc → comparison-sheet` drop in as new schemas without touching the verifier.

**One profile is implemented.** Three real fields beat a fake city.
