# ICM Translator

Turns a raw session transcript into a lesson card with a fixed shape, and ships the checker that
proves every value on the card was cut from the input.

The input is the text of a recording: a Loom run through Whisper, a YouTube caption track, any
meeting transcript. Usually one enormous line, no punctuation to speak of, no speaker labels. The
output is a JSON card with the same fields in the same order every time: who spoke, what was claimed,
the numbers, the steps, what got defined. Every value on the card carries the byte range of the input
it was cut from. A field with nothing behind it says `not in source`. Input that fits no field is
listed under `unmapped` with a reason, so the card accounts for the whole file.

No model runs at conversion time. `checker/convert.mjs` is a plain script: every quoted value on a
card is cut out of the input, and the only other strings it writes are the fixed labels the schema
names. The same folder also works as a Claude project (the brief this was built for asks
for that), and the same checker verifies a card either way, because it cannot tell who wrote it.

![A long ribbon of speech waveform on the left, a structured card of empty fields on the right, and thin amber threads tying each field back to an exact segment of the ribbon](docs/hero.jpg)

**The one property worth checking:** nothing in an output exists that was not in the input. The
checker enforces that for every span-backed value, and each check is a command you can run. The ways
a card could still misrepresent the source while passing those checks are under [Limits](#limits).

```bash
git clone https://github.com/InsightfulMinds/icm-translator && cd icm-translator
node checker/convert.mjs        # 4 shipped inputs -> 4 cards
node checker/verify-traces.mjs  # re-read the inputs, byte-check every span      (exit 0 / 1)
node checker/shape-diff.mjs     # field-by-field diff across the 4 cards         (exit 0 / 1)
node checker/selftest.mjs       # 141 assertions across 26 staged inventions     (exit 0 / 1)
```

No dependencies, no install, no network. Node 22+.

This page is the short version. The long one, with every command's full output, is
[docs/WALKTHROUGH.md](docs/WALKTHROUGH.md). It is the previous README, kept whole, and it is in the
git history too.

## Two words this page leans on

**span**: a half-open byte range `[start, end)` into the UTF-8 bytes of an input file. Every value on
a card carries one, so any claim on the card can be sliced back out of the source and compared byte
for byte. That comparison is what the verifier does, and it either passes or exits 1.

**ICM**: the name the community this was built for gives to a folder of structured notes that an AI
assistant can be pointed at. The letters are not expanded anywhere in the shipped transcripts, so
this page does not expand them either. Here is the term being used by a speaker in one of the four
transcripts in this repo, quoted with the span it came from:

> "these kind of second brains, these ICMs that I talk about, these folder structures into a single
> place" (`inputs/03-mcp-walkthrough.txt`, bytes `[324,426)`)

Check that quote the same way you would check anything else on a card:

```bash
node -e 'process.stdout.write(require("fs").readFileSync("inputs/03-mcp-walkthrough.txt").slice(324,426))'
```

## Your own transcript, in under a minute

Every command below was run for real to write this section, from inside the cloned repo.

```bash
$ node --version   # need 22+; nothing else to install
v22.22.1
```

Save your transcript as a plain UTF-8 `.txt` file inside `inputs/`. The name does not matter, only
that it lives there. The run below used a 256-byte file saved as `inputs/quickstart-demo.txt`. That
file is not shipped, so substitute your own filename. Its contents were:

```
Hi, I'm Priya and this is a quick walkthrough of the export tool. First, open the settings menu.
Next, click Export CSV. Then enter your workspace name. It costs $12 a month for the pro plan. One
customer raised a concern about the price during onboarding.
```

Convert it, then verify what came out. With a path argument, `convert.mjs` converts that one file
instead of everything in `inputs/`, and writes `cards/<same-stem>.card.json`:

```bash
$ node checker/convert.mjs inputs/quickstart-demo.txt
inputs/quickstart-demo.txt -> cards/quickstart-demo.card.json  speakers=1 claims=3 defs=0 numbers=1 entities=2 steps=3 unmapped=0 coverage=98.05%

$ node checker/verify-traces.mjs cards/quickstart-demo.card.json ; echo "exit=$?"
TRACES VERIFIED — cards/quickstart-demo.card.json. 0 problems.

All 1 card(s) verified against their inputs.
exit=0
```

Open the card and every `span` in it is a byte offset into your file. Check one by hand:
`node -e 'process.stdout.write(require("fs").readFileSync("inputs/quickstart-demo.txt").slice(8,13))'`
prints `Priya`, the speaker's name.

**What a rejection looks like.** The gate can fail, and here is a real one failing. This is a shipped
fixture where a claim was given a real-looking span for a date the transcript never states:

```bash
$ node checker/verify-traces.mjs fixtures/neg-01-invented-date/card.json ; echo "exit=$?"
TRACE FAILURES — fixtures/neg-01-invented-date/card.json. 1 problem(s):
  [SPAN_TEXT_MISMATCH] claims[4] text is not what fixtures/fixture-transcript.txt[27,51) contains (diverges at char 0)
     card  : "The call was on March 14"
     input : "this is the onboarding w"

1 of 1 card(s) failed, 1 problem(s) total.
A card whose claims do not trace to its input does not ship.
exit=1
```

![Five strips of tape carrying waveforms, each tied by an amber thread to a field on a card, except one thread that ends frayed in mid-air under a magnifying lens](docs/loose-thread.jpg)

*A claim with nothing at the other end of its thread. The verifier prints the bytes it found there
instead, so you see the mismatch, not just a count.*

That is the whole loop. Drop a transcript in `inputs/`, convert it, verify it, and when the verifier
disagrees it tells you exactly which byte range it disagrees with.

## The four questions this is judged on

This repo is an entry in round #13, "The Translator," of the Clief Notes weekly build competition.
The brief names four criteria. Each row below ends in a command you can run.

| the question | the answer | settle it yourself |
|---|---|---|
| **Does the output shape hold across different inputs?** | Yes. Four shipped inputs, 1,441 to 7,573 bytes, two transcription pipelines, one hand-written argument, one file with no trailing newline, produce four cards with an identical field list in an identical order, matching the contract's own `fieldOrder`. | `node checker/shape-diff.mjs` exits **0**. [Detail](docs/WALKTHROUGH.md#1--the-output-shape-holds-across-different-inputs) |
| **Does every fact in the output trace to the input?** | Yes for every span-backed value, checked rather than asserted. Every such value is a verbatim quote plus the byte span it was cut from. An independent verifier validates the full JSON Schema, then re-reads the input and re-slices every span. Twenty-six staged inventions are each proven caught. One field, `duration_seconds`, is sourced metadata rather than a checked fact, and the known verification gaps are listed in [Limits](#limits). | `node checker/verify-traces.mjs` exits **0**. [Detail](docs/WALKTHROUGH.md#3--every-fact-traces-to-the-input) |
| **Is the contract written down in `reference/` where a reader can check it?** | Yes. `reference/schema/lesson-card.v1.json` is a JSON Schema with every field, the absent-marker rule and the span definition. `field-definitions.md` says what each field means, and `format-spec.md` fixes the format. The verifier validates a card against that schema before any trace check runs, and both checkers read `fieldOrder` from the file at runtime rather than hardcoding it. | open [`reference/`](reference/). [Detail](docs/WALKTHROUGH.md#2--the-contract-is-written-down-in-reference) |
| **README quality. Can a stranger figure this out?** | That one is yours to answer, not mine. What the page does to help: four commands, no install, no network, no keys, no arguments for the shipped set, and every claim sits next to the command that produces it, so you can stop at any point and check what you have read so far. | run the four commands above |

The fourth shipped input, `inputs/04-pricing-objection.txt`, was written specifically to break the
tool, and it found five real limitations. They are written up with their evidence in
[What the fourth input exposed](docs/WALKTHROUGH.md#what-the-fourth-input-exposed).

## Who does this by hand today

Somebody reads the transcript and produces the card: who spoke, what was claimed, what the numbers
were, what the steps were, what got defined. The week this was built I did that conversion 25 times
in one sitting. That is a self-reported count, not a logged one, but the tedium is real and so is the
failure mode it produces.

<p align="center"><img src="docs/by-hand.jpg" width="560" alt="A person at a desk late at night, reading a printed transcript so long it unrolls onto the floor, highlighter in hand, a small stack of blank index cards beside the laptop"></p>

The mistakes do not come from laziness. They come from tidying. The person fixes the name the
transcription mangled, rounds the number, writes the next step that was obviously implied. Now a
card says something nobody said, and somebody downstream acts on it.

So this translator is built for one property, fidelity. It does not judge or improve the input.

## Drop it into a Claude project

Add these six files, and nothing else:

```
identity.md                             what it converts, from what, to what
rules.md                                the mapping, the gap rule, the never-add list
examples.md                             worked input/output pairs
reference/schema/lesson-card.v1.json    THE CONTRACT: the output schema
reference/field-definitions.md          what each field means
reference/format-spec.md                the format the output must match
```

Then paste a transcript and ask for a lesson card. Claude reads `rules.md` as the procedure and
`reference/` as the contract.

Do not add `checker/`, `cards/`, `fixtures/` or `inputs/`. They are the evidence that the contract
holds, not instructions for producing a card, and `cards/` in particular would hand the model
finished answers to copy instead of a procedure to follow.

To check what comes back, save it and run `node checker/verify-traces.mjs path/to/card.json`. The
verifier cannot tell whether a card came from Claude or from `convert.mjs`, so the same gate applies
either way.

## What a card looks like

Every leaf that came from the input is a `quote`: the verbatim text plus the byte range it was cut
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
    { "value": { "text": "$5,800", "span": { "start": 700, "end": 706 } },
      "unit":  { "text": "per site", "span": { "start": 707, "end": 715 } } }
  ]
}
```

![Diagram of the speakers[0] entry from cards/04-pricing-objection.card.json, showing the name span and the evidence span as two byte ranges over the same source line, with the name's range nested inside the wider evidence range](docs/span-anatomy.svg)

*A span is a byte offset pair into the source file, not a copy of the text, and spans nest: the
4-byte `name` span sits inside the 8-byte `evidence` span above, both pointing at the same line of
`inputs/04-pricing-objection.txt`.*

Two rules do most of the work. A field with nothing to hold carries the literal string
`not in source`, never `null`, never `[]`, never a missing key, because an empty array cannot tell
you whether the input had none or the converter never looked. And a stretch of input with no field to
go to is declared in `unmapped[]` with a reason, so the card accounts for the whole file instead of
quietly keeping the convenient parts.

Check any span by hand:

```bash
$ dd if=inputs/04-pricing-objection.txt bs=1 skip=700 count=6 2>/dev/null
$5,800
```

What you get for a real meeting is mostly `claims[]`. The first three from card 4, exactly as the
card holds them:

```json
{ "text": "I'm Dana, I run onboarding here.", "span": { "start": 23, "end": 55 } },
{ "text": "And I'm Tomas, I'm on the finance side.", "span": { "start": 56, "end": 95 } },
{ "text": "So the reason I pulled this meeting is the pilot recap deck says we onboarded forty-two schools last quarter and I don't think that number is right.", "span": { "start": 96, "end": 244 } }
```

Twelve claims, four numbers, four steps and twelve unmapped stretches come out of that 1,441-byte
input. Whether that is useful to you depends on what you do with cards. What the repo can promise is
that none of it was made up.

## How the verifier is kept honest

`checker/convert.mjs` is extractive. Every quoted value it emits comes from one function that cuts
the input between two offsets. The only other strings it writes are the fixed labels the schema
enumerates (`not in source`, the `reason` and `kind` values) and source metadata (the file name, its
hash and size, the duration from `inputs/meta.json`, a timestamp). There is no code path that can put
a sentence into a card that was not in the transcript.

That is a claim about a file, and a converter cannot vouch for itself. So `checker/verify-traces.mjs`
is a separate artifact: it validates the card against the full schema in `reference/`, re-reads the
input from disk, re-slices every span, and recomputes coverage from scratch. It never imports the
converter. You can confirm that with one command:

```bash
$ grep -E "^\s*import" checker/verify-traces.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSchema } from './schema-validate.mjs';
```

The verifier runs thirteen numbered checks, from schema validity through byte-identical quotes,
word boundaries, step ordering, the relationship between a name and the phrase that introduced it,
and a coverage recomputation that flags any run of real input no span touches, plus five gates that
sit alongside them: the source path must stay inside the repo, a card named after a shipped input
must cite that input, the duration must match `inputs/meta.json`, a speaker's `evidence` span is
bounded, and coverage has an aggregate floor. All of them are listed with what each does and does
not prove in [the walkthrough](docs/WALKTHROUGH.md#what-the-verifier-actually-checks).

`fixtures/` holds a clean control card and twenty-six negatives. Each negative is the control plus
exactly one mutation, generated by a script rather than hand-written, and `selftest.mjs` asserts that
each one fires exactly the codes its `EXPECT.json` names and nothing else. A verifier that rejected
everything would pass a weaker test.

![A grid of identical blank cards on a dark surface, each with exactly one small field glowing amber where it was tampered with, and a magnifying lens resting over one of them](docs/staged-inventions.jpg)

*Each fixture is the clean control card with one field tampered. The selftest checks that each one
trips exactly the alarms it is expected to and no other.*

The six fixtures that stage pure invention (a date nobody said, a next step nobody
said, a name corrected to its usual spelling, a number drifted one digit, a span moved to a
byte-identical neighbouring occurrence, a dropped objection with the coverage figure adjusted to hide
it) are each walked through in
[the walkthrough](docs/WALKTHROUGH.md#4--twenty-six-staged-inventions-six-walked-through-in-detail-below).

The one worth reading first is the neighbouring occurrence. `click continue` appears twice in the
fixture transcript, so moving a step's span to the wrong occurrence still byte-matches perfectly. It
is caught because a narrated procedure runs forwards, so the span has to point at the right
occurrence, not just the right words.

## What broke before this shipped

The day before the deadline I pointed an independent model at this repo with one instruction: break
the claim that nothing invented can pass. It did, six ways, and I could reproduce every one from a
fresh clone:

- append `{"value": 987654321, "unit": "not in source"}` to a card's `numbers` with no span at all:
  verified clean, exit 0
- add a `source.conclusion` field the schema does not allow: exit 0
- set `coverage.pct` to the string `"bananas"`: exit 0
- add a `sentiment` inside a span object: exit 0
- change `duration_seconds` to any number: exit 0
- take the fixture that stages a dropped objection and raise `coverage.unmapped_threshold_bytes` to
  `999999`, so the card sets its own bar: exit 0

The root cause was one omission. `reference/schema/lesson-card.v1.json` had been strict the whole
time, with `additionalProperties: false` and nested `required` on every object, and nothing had ever
validated a card against it. The verifier walked strings and skipped numbers, booleans and whole
top-level objects. The contract was written down. No code was reading it.

The fix is commit `cf2f83b`: a dependency-free schema validator runs before any trace check, the
omission threshold comes from the profile instead of from the card being judged, and every attack
that landed became a permanent fixture with its own expected error code. The selftest went from 37
assertions to 117 that night.

Then the hardening broke the product. One new check refused any file under `inputs/` that the repo
had not itself shipped, which meant a reader dropping in their own transcript was rejected by
filename before a byte of it was read. The unit tests never saw it: the two unseen-input round
trips read from `fixtures/`, and no test ever placed a transcript under `inputs/`. A walk through a
clean clone caught it. That check was removed in `410d01a` and its fixture (`neg-23`) retired. A
second review pass found two more holes, a duplicate key hidden behind a `title` escape and one claim
listed more than once at the same span, both closed in `7c84833` with fixtures `neg-26` and `neg-27`.
On Friday a third review pointed out that the selftest still could not have caught the `inputs/`
regression, so it now writes a temporary transcript under `inputs/`, converts it, verifies it, and
checks that the no-argument run stays green with that card present. The count stands at 141.

You can run the first attack yourself. It exits 1 now, and the unmodified card still exits 0, which
is what shows the rejection is real rather than a verifier that fails everything:

```bash
node -e 'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("cards/04-pricing-objection.card.json"));c.numbers.push({value:987654321,unit:"not in source"});process.stdout.write(JSON.stringify(c))' \
  | node checker/verify-traces.mjs /dev/stdin ; echo "exit=$?"     # exit=1
node checker/verify-traces.mjs cards/04-pricing-objection.card.json ; echo "exit=$?"   # exit=0
```

The holes those passes found that a byte checker cannot close are listed next, with reproductions.

## Limits

Extraction limits, all found by the fourth shipped input (evidence in
[the walkthrough](docs/WALKTHROUGH.md#what-the-fourth-input-exposed)):

1. No speaker attribution on claims.
2. Entities skip sentence-initial names, so self-introducing speakers never reach `entities[]`.
3. Classification is table-driven and blunt. A sequence marker plus an imperative files as a step
   whether or not one was meant.
4. Numbers must be digits. A spelled-out figure ("forty-two") lands in a claim, not `numbers[]`.
5. Number spans can include a trailing comma. It verifies correctly, one byte wider than the figure.

Gaps in the verifier itself, each with a command that reproduces it in
[the walkthrough](docs/WALKTHROUGH.md#limits-stated-plainly):

- A role quote that is merely near an entity's name passes, whether or not it is about that entity.
  Proximity is a heuristic, not a proof of relatedness.
- A claim truncated at a clean word boundary can assert the opposite of what the input says. On
  `inputs/04-pricing-objection.txt`, citing only *"we onboarded forty-two schools last quarter"* out
  of a sentence that goes on to dispute that number is a byte-perfect, in-range quote. Exit 0.
- A real claim can be moved into `unmapped[]` under a false `reason`, and coverage is identical to an
  honest declaration. Exit 0.
- `source.duration_seconds` comes from `inputs/meta.json`, sibling metadata about the recording, and
  no shipped command corroborates it against anything.

Other facts worth knowing before you rely on it:

- It does not summarise. Every card is larger than its transcript, because a card copies content
  verbatim and adds a citation to each piece.
- It does not use a model at runtime. `convert.mjs` is deterministic, table-driven extraction, and
  the tables live in `rules.md` where you can read them.
- One profile ships, `lesson-card.v1`. A second output shape would need new extraction code, not
  just a new schema file. See [Room to expand](docs/WALKTHROUGH.md#room-to-expand).
- It has only ever been run on macOS, on Node 22.22.1. There is nothing platform-specific in the
  code, but it has not been run anywhere else.
- Three of the four shipped inputs are real recordings, pseudonymised where they named a third party.
  The fourth I wrote by hand, and `inputs/PROVENANCE.md` says so.

In short: it cannot invent, and extraction that cannot invent is also blunt. For this job, that is
the right trade.

## Layout

```
identity.md    what it converts, from what, to what
rules.md       the mapping: which input parts feed which fields, what to do with a gap, what never to add
examples.md    six worked examples, every span copied from a real card
reference/     THE CONTRACT: schema/lesson-card.v1.json, field-definitions.md, format-spec.md
README.md      this file, the short version
docs/          WALKTHROUGH.md, the long version with every command's full output, plus the diagrams
checker/       convert.mjs · verify-traces.mjs · schema-validate.mjs · shape-diff.mjs · selftest.mjs
inputs/        3 real transcripts + 1 synthetic + sha256sums.txt + meta.json + PROVENANCE.md
fixtures/      clean control + 26 staged inventions + their 386-byte transcript + 2 unseen-input e2e transcripts + the generator + README.md
cards/         the 4 outputs
audits/        generated by shape-diff.mjs, not committed; your run writes it
```

`reference/` holds the contract because a schema that is not written down somewhere a reader can
open gives nobody a way to check whether the translator kept its promise.
