# ICM Translator, the long version

> This is the full walkthrough: every command on the short README with its complete output, the four
> judging criteria answered in detail, the fourth input's findings, all thirteen verifier checks, six
> fixtures walked through, and the limits with their reproductions. It is the README as it stood
> before the short version replaced it on Friday 2026-09-25 (git `7c84833`), with the em dashes
> edited out of the prose and the image paths adjusted for this folder. Since then its counts and
> command outputs have been kept in step with the code. The short version is
> [../README.md](../README.md).

Converts a raw session transcript (Loom/Whisper, YouTube captions, any meeting recording's text)
into a fixed-schema **lesson card**, where every value in the output carries the byte range of the
input it was cut from, and anything the schema could not hold is named instead of dropped.

**The one property worth checking:** nothing in an output exists that was not in the input, and the
repo ships the tool that proves it.

That is mechanically enforced for every span-backed value the
schema can hold: schema validation, byte-identical text, word-boundary, containment, adjacency and
coverage checks all run before a card ships, and each is a command you can run. It is not yet
enforced against every way a card *file* could still misrepresent what those checks see: a short list
of known, unfixed gaps is named in one place rather than left for a reader to find,
[Limits, stated plainly](#limits-stated-plainly).

![A long ribbon of speech waveform on the left, a structured card of empty fields on the right, and thin amber threads tying each field back to an exact segment of the ribbon](hero.jpg)

### The two words this page leans on, defined before you need them

**span**, a half-open byte range `[start, end)` into the UTF-8 bytes of an input file. Every value
on a card carries one, so any claim on the card can be re-sliced out of the source and compared byte
for byte. That is what turns "traceable" from an adjective into an exit code. (This is the primer;
the formal definition, paired with the `quote` invariant it makes possible, is in [§2, the contract
is written down](#2--the-contract-is-written-down-in-reference).)

**ICM**, the folder-packet format these cards are cut for. Rather than gloss it, here is the
definition being given by a speaker in one of the four transcripts shipped in this repo, quoted with
the span it came from:

> "these kind of second brains, these ICMs that I talk about, these folder structures into a single
> place", `inputs/03-mcp-walkthrough.txt`, bytes `[324,426)`

Check that sentence the same way you would check any other claim on this page:

```bash
node -e 'process.stdout.write(require("fs").readFileSync("inputs/03-mcp-walkthrough.txt").slice(324,426))'
```

An **ICM lesson card** is one lesson from a recorded session rendered into the fixed shape that
packet expects. The first definition on this page is itself an instance of the guarantee the rest of
the page is about.

```bash
node checker/convert.mjs        # 4 shipped inputs -> 4 cards
node checker/verify-traces.mjs  # re-read the inputs, byte-check every span      (exit 0 / 1)
node checker/shape-diff.mjs     # field-by-field diff across the 4 cards         (exit 0 / 1)
node checker/selftest.mjs       # 155 assertions across 26 staged inventions     (exit 0 / 1)
```

No dependencies, no install, no network. Node 22+. Every command answers `--help`; exit `0` is
pass, `1` is fail, `2` is bad usage. Everything below was produced by those commands.

## Quick start: your own transcript, in under a minute

Everything past this section is evidence for the claims above. This is the part that gets you from
nothing to a verified card, using a file you provide: every command below was run for real to write
this section.

```bash
$ git clone https://github.com/InsightfulMinds/icm-translator && cd icm-translator
$ node --version   # need 22+; nothing else to install
v22.22.1
```

Save your own transcript as a plain UTF-8 `.txt` file inside `inputs/`: the name doesn't matter,
only that it is inside the repo, because the card cites it and the verifier re-reads it.
`convert.mjs` refuses a file outside the repo with a message saying so, and accepts the path typed
from anywhere, absolute or relative to where you are. The run below used a 256-byte file saved as `inputs/quickstart-demo.txt`.
**That file is not shipped in this repo**, so substitute your own filename in the commands. Its
contents were:

```
Hi, I'm Priya and this is a quick walkthrough of the export tool. First, open the settings menu.
Next, click Export CSV. Then enter your workspace name. It costs $12 a month for the pro plan. One
customer raised a concern about the price during onboarding.
```

Convert it, then verify what came out: `convert.mjs` takes an explicit path as an argument instead
of its usual "every file in `inputs/`" default, and writes `cards/<same-stem>.card.json`:

```bash
$ node checker/convert.mjs inputs/quickstart-demo.txt
inputs/quickstart-demo.txt -> cards/quickstart-demo.card.json  speakers=1 claims=3 defs=0 numbers=1 entities=2 steps=3 unmapped=0 coverage=98.05%

$ node checker/verify-traces.mjs cards/quickstart-demo.card.json ; echo "exit=$?"
TRACES VERIFIED — cards/quickstart-demo.card.json. 0 problems.

All 1 card(s) verified against their inputs.
exit=0
```

Open `cards/quickstart-demo.card.json` and every `span` in it is a byte offset into
`inputs/quickstart-demo.txt`. Check any one of them the same way the rest of this page does:
`node -e 'process.stdout.write(require("fs").readFileSync("inputs/quickstart-demo.txt").slice(8,13))'`
prints `Priya`, the speaker's name span above.

**What a rejection looks like.** The gate can fail, and here is a real one failing. This is a
shipped fixture where a claim was given a real-looking span for a date the transcript never states:

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

That's the whole loop: drop a transcript in `inputs/`, convert it, verify it, and the verifier tells
you exactly which byte range it disagrees with when it disagrees. Everything from here down is the
case for why that loop can be trusted.

---

## The four questions this is judged on

**What "the brief" means below**, referenced several times on this page: this repo is an entry in
round #13, "The Translator," of a weekly public build competition, judged on four named criteria,
the four rows below, in the order the brief names them. Nothing depends on taking the brief's wording
on trust: each row ends in a command you can run yourself.

| the question | the answer | settle it yourself |
|---|---|---|
| **Does the output shape hold across different inputs?** | Yes. Four inputs (1,441 to 7,573 bytes, two transcription pipelines, one hand-written argument, one file with no trailing newline) produce four cards with an identical field list in an identical order, matching the contract's own `fieldOrder`. | `node checker/shape-diff.mjs` → **exit 0** · [detail](#1--the-output-shape-holds-across-different-inputs) |
| **Does every fact in the output trace to the input?** | Yes for every span-backed value, checked, not asserted. Every such value is a verbatim quote plus the byte span it was cut from; an independent verifier validates the full JSON Schema, then re-reads the input and re-slices every span. Twenty-six staged inventions are each proven caught, six of them walked through in detail below. One field (`duration_seconds`) is sourced metadata rather than a checked fact, and a short list of known verification gaps is named in [Limits, stated plainly](#limits-stated-plainly). | `node checker/verify-traces.mjs` → **exit 0** · [detail](#3--every-fact-traces-to-the-input) |
| **Is the contract written down in `reference/` where a reader can check it?** | Yes. `reference/schema/lesson-card.v1.json` is a JSON Schema with every field, the absent-marker rule and the span definition. `field-definitions.md` says what each field means; `format-spec.md` fixes the format. `verify-traces.mjs` validates a card against the full schema before any trace check runs; it and `shape-diff.mjs` also read `fieldOrder` from that schema file at runtime rather than hardcoding it. `convert.mjs` does not read the schema (below). | open [`reference/`](../reference/) · [detail](#2--the-contract-is-written-down-in-reference) |
| **README quality: can a stranger figure this out?** | Four commands, no install, no network, no keys, no arguments. Every claim on this page is printed next to the command that produces it, so you can stop reading at any point and check what you have read so far. | run the four commands above |

One more thing the brief does not ask for: a fourth input was added **specifically to break the
tool**, and it found five real limitations. They are
written up honestly in [What the fourth input exposed](#what-the-fourth-input-exposed) rather than
quietly fixed.

## Drop it into a Claude project: the exact files

Add these six, and nothing else:

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

**Do not add `checker/`, `cards/`, `fixtures/` or `inputs/`.** They are the evidence that the
contract holds, not instructions for producing a card, and `cards/` in particular would give the
model finished answers to copy instead of a procedure to follow.

To check what comes back, save it and run `node checker/verify-traces.mjs path/to/card.json`. The
verifier cannot tell whether a card came from Claude or from `convert.mjs`, so the same gate applies
either way.

## What it converts, and who does it by hand

A recorded session comes in as one unpunctuated wall of text with no speaker labels. Somebody reads
it and produces a structured card: who spoke, what was claimed, what the numbers were, what the
steps were, what got defined. The week this was built we did that conversion **25 times by hand** in
one sitting (a self-reported count, not a logged one), but the tedium and the tidying failure mode it
produced are what this tool exists to fix.

The failure mode is never laziness. It is tidying. The person fixes the name the transcription
mangled, rounds the number, writes the next step that was obviously implied, and now a card says
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
    { "value": { "text": "$5,800", "span": { "start": 700, "end": 706 } },
      "unit":  { "text": "per site", "span": { "start": 707, "end": 715 } } }
  ]
}
```

![Diagram of the speakers[0] entry from cards/04-pricing-objection.card.json, showing the name span and the evidence span as two byte ranges over the same source line, with the name's range nested inside the wider evidence range](span-anatomy.svg)

*A span is a byte offset pair into the source file, not a copy of the text, and spans nest: the
4-byte `name` span sits entirely inside the 8-byte `evidence` span above, both pointing at the same
line of `inputs/04-pricing-objection.txt`.*

Two rules do most of the work. A field with nothing to hold carries the literal string
`not in source`, never `null`, never `[]`, never a missing key, because an empty array cannot tell
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

Four inputs, chosen to be as unalike as the profile allows: **profile** here means the schema
version a card was cut against (`lesson-card.v1` is the one that ships; see [Room to
expand](#room-to-expand) for what a second profile would look like):

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
unifies with anything; everything else must match exactly, same keys, same nesting, same types.

That is why `unit: {text, span}` and `unit: "not in source"` unify, while `{value, unit}` against
`{value}` does not. A key vanishing is drift. A field being honestly empty is the contract working.

Note the zeros. Only inputs 2 and 4 contain self-introductions, so only cards 2 and 4 have speakers
(card 2 has one, card 4 has two: Dana and Tomas each introduce themselves). Input 2
contains no digits, so its `numbers` is `not in source`. Input 4 has no recording behind it, so its
`source.duration_seconds` is `not in source` while the other three carry a number, and those unify,
which exercises the absent rule one level down inside an object.

All four cards say `title: not in source`, because no speaker ever states a title out loud, and a
video's published title is not the input.

The long form is written to `audits/SHAPE-DIFF.md`, a **generated** report, not a committed one, so
what you read is what your own run produced rather than what was checked in.

---

## What the fourth input exposed

Inputs 1, 2 and 3 are the same genre: one person calmly narrating a walkthrough. Three inputs of one
genre cannot test what happens when the *shape of the conversation* changes, so a fourth was added
that changes it: two speakers, no speaker labels, two directly contradicting claims about the same
quantity, an objection raised and never resolved, and a figure corrected mid-sentence.

**It is synthetic and it says so.** `04-pricing-objection.txt` was written by hand for this repo.
There is no recording behind it, the names are invented, and `inputs/PROVENANCE.md` states that
plainly. A fabricated input presented as found material would be the same failure this repo exists
to prevent.

It is **inside scope, and deliberately the hard case within it.** `identity.md` defines the input as
any meeting recording's text, which does not exclude a multi-party argument. It just does not name
one as the example. Three inputs of one narrator cannot exercise what a meeting with more than one
speaker does to the tool, and what it does is worth more to a reader than a fourth clean pass.

```
$ node checker/convert.mjs inputs/04-pricing-objection.txt
inputs/04-pricing-objection.txt -> cards/04-pricing-objection.card.json  speakers=2 claims=12 defs=0 numbers=4 entities=2 steps=4 unmapped=12 coverage=98.06%
```

The card verifies, every span byte-exact, shape identical to the other three, nothing invented. It
also exposed five real limitations. **None were fixed quietly.** None are invention; every one is a
precision or completeness limit, which is a different and lesser failure than putting something in
the output that was not in the input.

### The five findings

**1 · Claims carry no speaker attribution, and the card does not admit it.**
`speakers[]` correctly holds both `Dana` and `Tomas`. All twelve claims are bare quotes with no
speaker field, so the card cannot answer *"who said this"*. On an input whose entire point is that
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
this is not invention, but the card presents an ordered procedure that was never a procedure, which
is a misclassification a reader could act on. `steps[]` does **not** come back honestly empty on a
non-procedural input, and it should.

**4 · The disputed figures never reach `numbers[]`.** The meeting is an argument about whether the
number is forty-two or twenty-nine. Both are spelled out, and the number extractor is digit-only, so
`numbers[]` contains the four dollar amounts and neither of the two figures under dispute. They do
survive verbatim in `claims[]` and `steps[]`, so nothing is silently dropped and coverage is honest,
but anything consuming `numbers[]` alone would never see the quantity the meeting was about.

**5 · A trailing comma rides along in a span.** The figure `$5,000,` is captured with its trailing
comma, because the value pattern `\d[\d,]*` allows a comma in the final position:

```
{ "value": { "text": "$5,000,", "span": { "start": 685, "end": 692 } }, "unit": "not in source" }
```

The quote is byte-identical to `input[685:692]`, so it verifies correctly and is not a fidelity
failure: the span is simply one byte wider than the figure. Inputs 1–3 never once had a number
followed by a comma, which is precisely why three inputs of one genre did not find it.

### What it got right

- **The mid-sentence correction is preserved without a verdict.** `We quoted the district $5,000,
  sorry, $5,800 per site` yields both values, in document order, with correct spans. The tool does
  not decide which one is current, because the input does not say. A reader gets both and the
  correction is visible. A downstream consumer gets both with no recency signal, worth knowing, but
  the alternative is a guess.
- **`per site` produces a real unit, not an invented one.** It originally fell outside the unit
  vocabulary and came back `not in source`; `site` has since been added to the recognised list, so
  the shipped card now carries `unit: { "text": "per site", "span": [707,715) }`. The vocabulary is
  still a fixed list rather than general language understanding (see [Limits, stated
  plainly](#limits-stated-plainly)), but this specific gap is closed.
- **The objection survived.** `I do not agree with that, and I want it on the record that I do not
  agree.` is claim 12. Both sides of the forty-two/twenty-nine contradiction are in the card. Nothing
  was dropped to make the output tidier.
- **`duration_seconds` is `not in source`.** There is no recording, so there is no duration, so the
  card says so, in position, in the contract's order, unified with the numeric value the other three
  cards carry.

---

## 2 · The contract is written down in `reference/`

Three files, all readable without running anything:

| file | what it fixes |
|---|---|
| [`reference/schema/lesson-card.v1.json`](../reference/schema/lesson-card.v1.json) | The output contract. JSON Schema draft 2020-12: every field, every type, `additionalProperties: false`, the `fieldOrder` array, and the three `$defs` that carry the real rules, `absent`, `span`, `quote`. |
| [`reference/field-definitions.md`](../reference/field-definitions.md) | What each field means in prose, and the distinction between content extracted *from* the input and metadata *about* it. |
| [`reference/format-spec.md`](../reference/format-spec.md) | The format the output must match, encoding, ordering, and how the absent marker is written. |

Three definitions in the schema do the load-bearing work:

- **`absent`** is `const: "not in source"`. One marker, and only one. *"Never null, never an empty
  string, never an empty array, never an omitted key."*
- **`span`** is a half-open byte range `[start, end)` into the UTF-8 bytes of the file named by
  `source.file`. Bytes, not characters and not line numbers: these inputs are single-line
  transcripts, where a line number locates nothing.
- **`quote`** is `{text, span}` with the invariant the verifier enforces:
  `bytes(source.file)[span.start:span.end]` decoded as UTF-8 is byte-identical to `text`. No
  trimming, no case folding, no whitespace collapsing, no spelling normalisation.

The schema is not decoration. **`verify-traces.mjs` validates a card against the full schema
(every `required`, `additionalProperties: false`, type, `const`, `pattern` and `minimum`) as the
first gate it runs**, via `checker/schema-validate.mjs`, a small dependency-free JSON Schema engine
that knows the schema keywords and nothing about lesson cards. Both `shape-diff.mjs` and
`verify-traces.mjs` separately read `fieldOrder` and the absent marker out of that same file at
runtime rather than hardcoding them, so the contract in `reference/` is the thing actually being
enforced. Edit the schema and the checks change with it.

```bash
$ grep -l "reference/schema/lesson-card.v1.json" checker/*.mjs
checker/schema-validate.mjs
checker/verify-traces.mjs
checker/shape-diff.mjs

$ grep -n "const FIELD_ORDER" checker/*.mjs
checker/shape-diff.mjs:33:const FIELD_ORDER = SCHEMA.fieldOrder;
checker/verify-traces.mjs:47:const FIELD_ORDER = SCHEMA.fieldOrder;
```

The first grep's `schema-validate.mjs` hit is a comment (`// This file supports exactly the keywords
reference/schema/lesson-card.v1.json actually uses`), not a read. That file never opens the schema
itself; the caller hands it both the instance and the parsed schema.

Delete a field from `fieldOrder` in the schema and both checks start failing on every card. That is
what makes the contract load-bearing rather than documentation that drifted.

### The contract has nowhere to put a judgement

The brief rules out judging the input as well as inventing content. An instruction not to judge is a
request. **A schema with nowhere to put a judgement is a fact.**

There is no sentiment field, no quality score, no outcome, no priority, no summary. `additionalProperties`
is `false` and `fieldOrder` is closed, so a card carrying one is not a card with an opinion in it.
It fails validation.

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
into a card that was not in the transcript, not a fallback, not a default, not a tidy-up. Invention
is not detected here; it is unrepresentable.

**Proven.** That is a claim about a file, and you should not have to take it on faith. A converter
cannot vouch for itself: any bug that lets invention into a card is equally free to write the code
that declares the card clean. So the check has to be a separate artifact that shares nothing with
the thing it is checking.

`checker/verify-traces.mjs` re-reads the input from disk, re-slices every span itself, and re-derives
coverage and the unmapped set from scratch. **It never imports the converter**, and that is one
command to confirm rather than something to believe:

```bash
$ grep -E "^\s*import" checker/verify-traces.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSchema } from './schema-validate.mjs';
```

![Diagram showing convert.mjs and verify-traces.mjs as two separate boxes with no arrow between them: convert.mjs imports only Node built-ins, verify-traces.mjs imports Node built-ins plus its own schema-validate.mjs, neither imports the other, and card.json flows between them as data only; verify-traces.mjs and shape-diff.mjs read the schema file at runtime, while convert.mjs hardcodes its fields](verifier-independence.svg)

*The two scripts share no code, only the written schema in `reference/` and the `card.json` file
that passes between them as data. Neither script's source ever appears in the other's import list.*

Four Node builtins, plus one same-repo file that `convert.mjs` never imports: `schema-validate.mjs`,
a generic JSON Schema engine with no knowledge of lesson cards. No shared parser, no shared span
helper, no shared constants between the two scripts that matter. Producer and verifier still import
nothing in common. The two files agree only on the format described in `reference/`, so a bug in the
producer has no channel through which to talk the verifier into agreeing with it.

Which means the verifier does not care what produced the card:

| producer | how |
|---|---|
| **Claude, reading this folder** | drop the folder into a project; `rules.md` is the procedure, `reference/` is the contract |
| **the script** | `node checker/convert.mjs` |

Both are checked by the same code, and it cannot tell which one ran. The guarantee is on the
artifact, not on the goodwill of the thing that wrote it.

### What the verifier actually checks

0. the card **validates against the full JSON Schema** (every `required`, `additionalProperties:
   false`, type, `const`, `pattern` and `minimum`), before any check below runs; a structurally
   invalid card is rejected here and never reaches the trace logic at all
1. the input's **sha256** matches what the card declares: if the bytes changed, every span is void
   and it stops there
2. every field present, **in the contract's order**, nothing extra
3. every quote **byte-identical** to `input[span.start:span.end]`, no trimming, no normalising
4. no span starts or ends **mid-word or mid-character**, deciding "word" on the actual Unicode code
   point on each side of the cut: a digit next to a letter is mid-word, a digit next to a symbol
   like `°` is not, so `iPhone`, `Foo_Bar` and `20°C` round-trip correctly
5. `steps[]` spans **strictly increase** and `index` increments by one
6. `speakers[].name` is **contained inside** its own `speakers[].evidence`, not just independently
   real, but nested inside the phrase that established who is speaking
7. `numbers[].unit`, when present, is **immediately adjacent** to its own `numbers[].value`
8. `definitions[].definition` and `entities[].role`, when present, are **near** their own `term` /
   `name`, a small calibrated byte gap, forward from where the term or name ends
9. nothing free-floating: every value is a quote, the absent marker, or declared metadata
10. `coverage` **recomputed** from the card's own spans and compared
11. **every run of real content** at or above the *profile's* fixed threshold is **touched by some
    span somewhere in the card**: a `claims[]` entry, a step, a number, an `unmapped[]` entry,
    anything with a byte span counts the same way; the verifier does not read `card.unmapped` and
    trust it. It recomputes which bytes are covered from every span present and flags what is left
    over. Both the uncovered runs and the threshold itself are checked against the profile, never read
    out of the card being judged. See `reference/field-definitions.md`, the `unmapped[]` section, for
    what this does and does not verify about a declared entry's stated reason
12. the card **file** repeats no key within one object, comparing keys after decoding JSON escapes
    so `"\u0074itle"` and `"title"` collide: `JSON.parse` keeps only the last copy, so an earlier
    one would sit visibly in the file while being invisible to every check above; and no list cites
    **the same span twice**, so one sentence in the input cannot be listed as three claims

Five more gates run alongside the numbered checks and are not repeated in the list above because each
is a single fixed rule rather than a walk over the card: `source.file` must resolve inside the repo
and under `inputs/` or `fixtures/` (`SOURCE_FILE_ESCAPES_REPO`, `SOURCE_FILE_NOT_ALLOWED`, fixture
`neg-22`); a card named after a shipped input must cite exactly that input
(`SOURCE_FILE_IDENTITY_MISMATCH`); `source.duration_seconds` must match `inputs/meta.json`
(`SOURCE_DURATION_MISMATCH`, `neg-21`); a speaker's `evidence` span is bounded to a small share of
the input (`EVIDENCE_SPAN_TOO_LARGE`, `neg-25`); and total coverage has a floor
(`COVERAGE_BELOW_FLOOR`, staged directly by `neg-19`, and the reason `neg-05` and `neg-06` each
expect two codes).

Check 11 stops a card from leaving real content with **no span anywhere on it**, the failure mode
the brief's CRM (customer-relationship-management) example names, *"a CRM note that silently omits
the objection the prospect raised is worse than useless."* It is a narrower guarantee than that
sentence implies, and not the stronger "mechanical failure rather than a promise" claim an earlier
version of this page made: a claim moved into `unmapped[]` under a false `reason` is byte-identical
in coverage to the same claim declared honestly, and check 11 cannot tell the two apart. See
[Limits, stated plainly](#limits-stated-plainly). Check 5 is what makes a citation a location rather
than a string match. See fixture 5
below. Checks 6–8 close the bypass where a quote was real and individually verifiable but had nothing
to do with the field it was placed in, a swapped-in name, an unrelated unit, a definition copied from
elsewhere in the input.

**What checks 6–8 do not prove:** byte proximity is a heuristic for "these two things are about each
other," not a semantic proof of it. The calibrated gaps are the loosest bound every real occurrence in
the shipped data satisfies, not a proof-theoretic bound. Nothing in this repo, or in JSON Schema, can
mechanically verify semantic relatedness between two spans, only their distance and byte content. See
`reference/field-definitions.md`, "What the verifier cannot fully enforce," for the full statement of
this limit.

## 4 · Twenty-six staged inventions, six walked through in detail below

`fixtures/` holds a clean control card and twenty-six negatives. Each negative is **the control plus
exactly one mutation**, generated by `fixtures/make-negatives.mjs` rather than hand-written, so
"only one thing changed" is a property of the build and not a promise in a comment. Each fixture
carries an `EXPECT.json` naming the invention class it stages and the error code it must fire. The
first six stage pure invention (a fact with no support anywhere in the input) and are walked through
below one at a time; the remaining twenty stage malformed cards (schema violations), cards that
misuse a real, in-input quote (an unrelated speaker's name, an unassociated unit or definition, a
role with nothing near it, the relationship checks in [§3](#3--every-fact-traces-to-the-input) exist
because of that group), and cards that attack the checker's own machinery (a duplicate key, spelled
literally and again behind a `\u` escape, a claim listed twice at the same span, a source path that escapes the repo, a reversed step order, a fabricated
duration, an oversized `evidence` span, and an aggregate coverage omission).

All twenty-six are built from one 386-byte transcript, `fixtures/fixture-transcript.txt`, which is
short enough to print in full:

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

The control card verifies clean. Every offset quoted below is checkable with one command, for
example, the bytes the control cites for the speaker's name:

```bash
$ dd if=fixtures/fixture-transcript.txt bs=1 skip=18 count=4 2>/dev/null
Sara
```

Reproduce any single fixture with `node checker/verify-traces.mjs fixtures/<name>/card.json`, or all
of them at once with `node checker/selftest.mjs`. The outputs below are that command's real stdout.

| fixture | invention class | fires | detail |
|---|---|---|---|
| `fixtures/neg-01-invented-date` | invented date | `SPAN_TEXT_MISMATCH` | [§1](#1--a-date-nobody-said-neg-01-invented-date--span_text_mismatch) |
| `fixtures/neg-02-invented-step` | invented next step | `SCHEMA_INVALID` | [§2](#2--a-next-step-nobody-said-neg-02-invented-step--schema_invalid) |
| `fixtures/neg-03-normalized-name` | normalized name | `SPAN_TEXT_MISMATCH` | [§3](#3--a-name-corrected-to-its-usual-spelling-neg-03-normalized-name--span_text_mismatch) |
| `fixtures/neg-04-number-drift` | number drift | `SPAN_TEXT_MISMATCH` | [§4](#4--a-number-that-drifts-one-digit-neg-04-number-drift--span_text_mismatch) |
| `fixtures/neg-05-neighbour-span` | neighbour span | `STEP_ORDER_NOT_INCREASING` | [§5, the fixture worth studying](#5--the-right-text-at-the-wrong-occurrence-neg-05-neighbour-span--step_order_not_increasing) |
| `fixtures/neg-06-dropped-objection` | dropped content | `UNMAPPED_OMISSION` | [§6](#6--a-dropped-objection-with-the-tracks-covered-neg-06-dropped-objection--unmapped_omission) |

The five folded below repeat one pattern: mutate one field, show the byte diff, show the verifier
catch it, so they're collapsed after the first read-through. §5 stays open inline; the text calls it
out below as the one worth studying, since it is the only fixture where the byte comparison alone is
not enough.

---

<details>
<summary>§1, a fabricated date given a real, in-range span so the card looks cited</summary>

### 1 · A date nobody said: `neg-01-invented-date` → `SPAN_TEXT_MISMATCH`

There is no date in the transcript. Not a month, not a weekday, not a number that could be read as
one. So this is the cleanest possible test of pure fabrication: no span anywhere in the input could
support the claim, because the content does not exist.

The mutation adds one claim, and (this is the part that matters) **gives it a real, in-range
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
verifier reports **where** the two diverge, `char 0` here, meaning they share no common prefix at
all, which is the signature of wholly invented content rather than an edit.

</details>

<details>
<summary>§2, a next step with no span at all, caught by the schema gate before any trace check runs</summary>

### 2 · A next step nobody said: `neg-02-invented-step` → `SCHEMA_INVALID`

The transcript's procedure ends at step 4. The mutation appends a fifth step that reads like the
obvious thing to do next, with **no span at all**:

```json
{ "index": 5, "action": { "text": "Then schedule a follow-up call" } }
```

This is what invention looks like when whoever wrote the card was honest enough not to fabricate an
offset to go with it. It is also the shape most likely to slip past a shallow check: `steps[]` is an
array, `index` is a number, `action.text` is a string, indices still run 1 to 5, a check that only
skims for those types would wave it through.

`checker/schema-validate.mjs`, a real, dependency-free JSON Schema validator, runs first, before any
trace check, and it enforces `required: ["text", "span"]` on every `quote` via `$defs.quote` in the
schema. `action` has no `span` here, so this fixture never reaches the trace checks at all:

```
[SCHEMA_INVALID] steps[4].action.span: missing required property `span`
```

Unspanned content is not given the benefit of the doubt and is not passed through as an unchecked
string. Anything that cannot be pointed at cannot ship, which is the only rule that closes this hole:
a verifier that skipped fields it could not check would let every invention through by simply
omitting the citation. (This gate used to be an ad hoc check inside `verifyCard()` that fired
`QUOTE_MISSING_SPAN` for this exact shape; the schema gate added since then catches it first, on the
same grounds, with a message naming the missing key instead.)

</details>

<details>
<summary>§3, a name "corrected" to its usual spelling, the invention that feels like diligence</summary>

### 3 · A name corrected to its usual spelling: `neg-03-normalized-name` → `SPAN_TEXT_MISMATCH`

The transcript says `Sara`. The real person is far more often a `Sarah`, and transcription drops
trailing consonants constantly. The mutation changes exactly one leaf:

```
control : "name": { "text": "Sara",  "span": { "start": 18, "end": 22 } }
fixture : "name": { "text": "Sarah", "span": { "start": 18, "end": 22 } }
```

The span is untouched. One character added. This is the invention class worth dwelling on, because
it is the only one on this list that **feels like diligence**: the person making it believes they
are fixing a transcription error, and half the time they are right about the world and still wrong
about the card. A downstream reader now has a name that was never spoken in the recording.

```
[SPAN_TEXT_MISMATCH] speakers[0].name text is not what fixtures/fixture-transcript.txt[18,22) contains (diverges at char 4)
   card  : "Sarah"
   input : "Sara"
```

`diverges at char 4`: the first four characters match and the fifth does not exist in the input.
Compare that to `neg-01`'s `char 0`. The same gate distinguishes a tidy-up from a fabrication by
where the divergence starts, which is the diagnostic a human actually wants when triaging a failure.

This gate is also why length is checked rather than prefix-matched. A verifier doing `startsWith`
would accept `Sarah` against `Sara` and every truncation-flavoured invention with it.

</details>

<details>
<summary>§4, a number that drifts one digit, with the span and byte length left untouched</summary>

### 4 · A number that drifts one digit: `neg-04-number-drift` → `SPAN_TEXT_MISMATCH`

```
control : "value": { "text": "$5,000", "span": { "start": 268, "end": 274 } }
fixture : "value": { "text": "$5,800", "span": { "start": 268, "end": 274 } }
```

One character, in the field a reader is most likely to act on, with the span and the byte length left
identical. There is no structural tell: `$5,800` is a well-formed currency figure of the correct
width sitting at a correct offset. It cannot be caught by any amount of schema validation, or by
re-reading the card, or by a second model reviewing the card's plausibility: `$5,800 a month for
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

</details>

### 5 · The right text at the wrong occurrence: `neg-05-neighbour-span` → `STEP_ORDER_NOT_INCREASING`

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
to finish", a procedure with two of its steps silently transposed, which is worse than a missing
step because it reads as complete.

It is rejected on ordering:

```
[STEP_ORDER_NOT_INCREASING] steps[2] span starts at 183, at or before steps[1] at 227 — a procedure is narrated in order, so this span points at a different occurrence of the same words
```

Step 3 begins at byte 183 (`enter your email address`) while step 2 now begins at 227. A narrated
procedure runs forwards through the recording, so a step that starts later than the step after it is
pointing at the wrong instance of repeated words. This is what makes a span a **location** rather
than a string match in this specific case.

**What this fixture proves, precisely, and what it does not.** The check behind
`STEP_ORDER_NOT_INCREASING` is `start <= prev`: each step's span must begin strictly after the one
before it. That is exactly what this fixture violates, so it is real evidence against a card whose
steps run backwards. It is not evidence against every "right text, wrong occurrence" card: a step
sequence that assigns occurrences so that the spans still increase (for example, picking the *later*
of two repeated phrases for an earlier-numbered step while a different step's span sits between
them) satisfies `start <= prev` and is not caught by this check alone.

![Diagram of the neg-05-neighbour-span fixture, showing the two byte-identical "click continue" occurrences at offsets 162 and 227 in the transcript, the correct forward-running step order against the actual order where step 2 now starts after step 3, and the STEP_ORDER_NOT_INCREASING error that catches it](neighbour-span.svg)

*Both slices read "click continue". A text-only check cannot tell them apart. What fails is the
order: step 2 now starts at byte 227, after step 3's byte 183, so the procedure runs backwards.*

Vacating `[162,176)` genuinely uncovers those 14 bytes, so the generator restates coverage honestly
(335 → 321 bytes, 86.79% → 83.16%). Had it left the old coverage number, the card would have failed
on `COVERAGE_MISMATCH` instead and proven nothing whatsoever about ordering. A negative fixture that
fails for the wrong reason is not a test.

<details>
<summary>§6, a dropped objection that covers its own tracks in the coverage figure</summary>

### 6 · A dropped objection, with the tracks covered: `neg-06-dropped-objection` → `UNMAPPED_OMISSION`

The transcript contains `One member raised an objection about the price during the call.` This is the
sentence a summariser drops, because it is the one that makes the rest of the card look worse.

The mutation removes that claim from `claims[]`, declares **nothing** in `unmapped[]`, and then
restates coverage honestly to match (335 → 272 bytes, 70.47%). That last step is what makes this the
hard version of the test: a careless dropper leaves a stale coverage figure and gets caught by
arithmetic, which would prove only that the coverage gate works. This fixture stages a dropper that
covers its tracks, so the card is internally consistent: its own numbers all agree with its own
spans.

It fails anyway, because the verifier does not read the card's `unmapped[]` and believe it. It
recomputes the uncovered regions from the source:

```
[UNMAPPED_OMISSION] fixtures/fixture-transcript.txt[299,365) is 66 bytes of input that no span in the card touches, and it is not declared in unmapped[] (bar is 32)
   input : ". One member raised an objection about the price during the call. "
```

66 bytes of the input are now untouched by any span in the card, the card's own declared threshold
(what the error message above calls the "bar") is 32, and the hole is not declared. The verifier
names the hole and prints its contents, so the reader sees the dropped sentence rather than a count.

This is the check that makes silent omission a mechanical failure. A card that quietly discards the
objection a member raised is worse than no card at all, because somebody downstream will read it as
complete, and "completeness" is the one property a summariser can never be held to, since there is
nothing to compare its output against. Here there is: the input.

</details>

---

### What makes these six evidence rather than decoration

`selftest.mjs` asserts each fixture fires **exactly its own code and nothing else**, and that
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
  to stop there rather than continue reporting span errors: if the bytes changed, every span in the
  card is void and reporting on them is noise
- it stages **three kinds of shape drift** (a field removed, a field moved out of contract order, an
  item key removed) and requires the shape test to reject each, having first confirmed that two
  identical cards pass it

A gate nobody has seen fail is not a gate. The full run is 155 assertions.

---

<details>
<summary>The full run, verbatim, every command above, run in order on a clean checkout, plus proof the shipped cards regenerate exactly</summary>

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
...155 individual "pass" lines in ten groups, listed below...
155 passed, 0 failed.
exit=0
```

Those last two are the only outputs elided on this page, and both are elided to their summary line
only. Run them yourself and you get the per-line detail.

`selftest.mjs`'s 155 assertions are grouped ten ways. The group headers below name what each group
checks, reproduced verbatim from a real run:

```
── the control must verify clean ──────────────────────────────────────────────
── each negative fires on its own gate, and only its own ──────────────────────
── each negative is the control plus exactly one mutation ─────────────────────
── the hash gate is not dead code ─────────────────────────────────────────────
── a card named after a registered input is bound to cite it ──────────────────
── the shape test still fails on real drift ───────────────────────────────────
── the real converter + real verifier round-trip on genuinely unseen input ────
── the command line: --help, bad usage, and paths from anywhere ───────────────
── the shipped cards cite registered, hash-matching inputs ────────────────────
── the shipped cards verify against the shipped inputs ────────────────────────
```

The count moved from 36 to 37 when the fourth input was added, then to 117 (commit `cf2f83b`) as
schema validation, the relationship checks, eighteen more negative fixtures and a two-transcript
unseen-input round trip were added, to 129 (`410d01a`) with the evidence-span bound and the
own-transcript fix, to 138 (`7c84833`) with the two duplicate gates, to 141 with the round trip
for a transcript dropped under `inputs/`, to 145 with the suffixed-figure regression test
(`fixtures/e2e-03-suffixed-figures.txt`), and after the deadline to 155 with ten command-line
assertions: `--help` and bad usage on each command, a transcript outside the repo, and an absolute
path through a symlinked checkout, which `convert.mjs` used to report as not found. Most groups above iterate a
directory (`fixtures/neg-*`, `cards/`) rather than a hardcoded list, so a new fixture or a new card
adds assertions rather than relaxing existing ones. No check was weakened, edited or skipped to
accommodate any of it.

### Reproducibility: the committed cards regenerate exactly

Running `convert.mjs` in a fresh clone overwrites `cards/`, so `git diff` afterwards is the cleanest
available statement of how reproducible the conversion is. It is **four lines, all of them the
timestamp**:

```
$ git clone https://github.com/InsightfulMinds/icm-translator && cd icm-translator
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
between runs. It is metadata about the conversion, not content extracted from the transcript.

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

</details>

---

## What it does not do

Stated plainly, because a tool whose selling point is that it does not invent should not oversell
itself either:

- **It does not summarise.** There is no condensing step. Every card is *larger* than its transcript
(2,657 bytes in gives 10,622 bytes out, 6,713 gives 19,839, 7,573 gives 18,612, 1,441 gives 7,183)
because a card copies content verbatim and then adds a citation to each piece. If you want
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
- **It does not reach outside the input, with one named exception.** Not the filename, not a video's
  published title: those are not the input, so they cannot appear in the card. The exception is
  `source.duration_seconds`: `convert.mjs` reads it from `inputs/meta.json`, sibling metadata keyed by
  the input's filename, not from the transcript, and it does appear in the card: three of the four
  shipped cards carry a real number there (`161`, `391.6`, `425`). It is placed under `source`, which
  the schema documents as metadata about the file rather than content extracted from it, but no
  shipped command corroborates the number against anything; see [Limits, stated
  plainly](#limits-stated-plainly).
- **It is not a general document translator.** One profile ships, `lesson-card.v1`, cut for one
  output shape. A fundamentally different output (not a session transcript's lesson card) would need
  a new schema and new extraction code. See [Room to expand](#room-to-expand) for what is and is not
  built today. Within the transcript-to-lesson-card shape it already covers, input 4 shows where the
  extraction is blunt rather than where the profile refuses the input. See [Limits, stated
  plainly](#limits-stated-plainly).

## Limits, stated plainly

These are real and none of them are hidden. The first five restate, as a plain list, what [The five
findings](#the-five-findings) above proved against input 4. The quotes and byte evidence live there,
not repeated here:

1. No speaker attribution on claims.
2. Entities skip sentence-initial names, so self-introducing speakers never reach `entities[]`.
3. Classification is table-driven and blunt: a sequence marker plus an imperative files as a step
   whether or not one was meant.
4. Numbers must be digits: a spelled-out figure ("forty-two") lands in a claim, not `numbers[]`.
5. Number spans can include a trailing comma; verifies correctly, one byte wider than the figure.
6. A figure with a letter suffix (`1.2M`, `$50K`, `2.5kg`, `4.5x`) is not extracted as a number; it
   stays inside its claim. Until 2026-09-25 the converter cut such a figure at its decimal point and
   shipped `1` for `1.2M`, byte-exact and wrong; a third review caught it, and
   `fixtures/e2e-03-suffixed-figures.txt` now pins the extracted figures in the selftest.

Past those six:

- **`definitions[]` fires on two syntactic patterns.** A definition phrased any other way is not
  caught and its sentence becomes a claim.
- **`kind` is `unknown` for most entities**, by design: the fence in `rules.md` §8 means no stated
  role produces no classification. It prefers a blank to a guess.
- **Coverage is not comprehension.** 99% coverage means 99% of the bytes sit under some span. It
  does not mean the card understood the session.
- **`title` has never fired at all.** All four shipped inputs carry `title: not in source`, and so
  does every fixture, control included. Nothing in this repo demonstrates the field holding a real
  value: the path is written and reachable, but unexercised.
- **It has only ever been run on macOS, on Node 22.22.1.** Never on Linux, never on Windows, never
  on another Node major. There is nothing platform-specific in the code (Node builtins only, no
  dependencies, no shell-outs), but "should work" is not "was run", and this line is the difference.
- **One input is synthetic.** Three of the four shipped inputs are real recordings; the fourth I
  wrote by hand. It is labelled as such in `inputs/PROVENANCE.md` and in the section above.

**Gaps in the verifier itself**, as distinct from the extraction limits above. These are about the
check, not about how blunt the extraction is:

- **The `entities[].role`-near-`entities[].name` proximity check accepts an unrelated quote that is
  merely close, and this is not a hypothetical.** The shipped `entities[0]` in input 4 is `Thursday`,
  correctly `kind: unknown` because no role is stated near it. Relabel it `kind: "person"` and give it
  the nearby, unrelated quote `"it quotes the same figure"` as `role`, and the card still verifies: a
  weekday becomes a person whose role is a clause about a renewal email. See
  `reference/field-definitions.md`, "What the verifier cannot fully enforce," for the general limit
  this is one instance of.
  Reproduce it (`kind: "person"` is a legal enum value, and the role span is a real, in-range quote
  five bytes after the name):
  ```bash
  node -e '
  const fs=require("fs");
  const buf=fs.readFileSync("inputs/04-pricing-objection.txt");
  const c=JSON.parse(fs.readFileSync("cards/04-pricing-objection.card.json"));
  c.entities[0].kind="person";
  c.entities[0].role={text:buf.slice(905,930).toString(),span:{start:905,end:930}};
  process.stdout.write(JSON.stringify(c));
  ' | node checker/verify-traces.mjs /dev/stdin
  ```
  Real output: `TRACES VERIFIED — /dev/stdin. 0 problems.`, exit 0.
- **A claim truncated at a clean boundary can assert the opposite of what the input says, and every
  check passes.** Nothing in this repo checks that a `claims[]` span captured the whole clause a
  negation applies to, only that the bytes it does cite are real and in range. On the shipped
  `inputs/04-pricing-objection.txt`, the sentence at `[135,243)` reads *"the pilot recap deck says we
  onboarded forty-two schools last quarter and I don't think that number is right."* A card citing
  only `[161,204)`, *"we onboarded forty-two schools last quarter"*, is a byte-perfect, in-range
  quote asserting the exact figure the speaker disputes. Reproduce it (declaring the two freed side
  segments in `unmapped[]` so nothing goes uncovered, and recomputing `coverage` to match):
  ```bash
  node -e '
  const fs=require("fs");
  const buf=fs.readFileSync("inputs/04-pricing-objection.txt");
  const c=JSON.parse(fs.readFileSync("cards/04-pricing-objection.card.json"));
  c.claims[2]={text:buf.slice(161,204).toString(),span:{start:161,end:204}};
  c.unmapped.push(
    {text:buf.slice(96,161).toString(),span:{start:96,end:161},reason:"below-extraction-threshold"},
    {text:buf.slice(204,244).toString(),span:{start:204,end:244},reason:"below-extraction-threshold"}
  );
  // coverage is unchanged: the freed bytes are still covered, just by unmapped[] instead of claims[]
  process.stdout.write(JSON.stringify(c));
  ' | node checker/verify-traces.mjs /dev/stdin
  ```
  Real output: `TRACES VERIFIED — /dev/stdin. 0 problems.`, exit 0, `coverage` untouched at 98.06%
  because the freed bytes move from `claims[]` to `unmapped[]` rather than disappearing. This is not
  mechanically
  detectable by a byte checker; the closest partial mitigation would be a `SPAN_SENTENCE_BOUNDARY`
  check requiring every `claims[]` span to start and end on a sentence boundary (the same boundary
  `convert.mjs` already emits when it segments a transcript), which would close this specific family.
  It is not built.
- **A `claims[]` entry can be moved into `unmapped[]` under a false `reason`, and coverage cannot tell
  the difference from an honest declaration.** `reason` is checked only for closed-enum membership
  (see `reference/field-definitions.md`, `unmapped[]`), never against the content. Take shipped card
  `04-pricing-objection`, remove `claims[11]`, *"I do not agree with that, and I want it on the
  record that I do not agree,"* the objection [What the fourth input
  exposed](#what-the-fourth-input-exposed) calls out as surviving, and re-declare that exact span in
  `unmapped[]` with `reason: "no-field-for-this-content"`, which is false: `claims[]` is exactly the
  field for it. Reproduce:
  ```bash
  node -e '
  const fs=require("fs");
  const c=JSON.parse(fs.readFileSync("cards/04-pricing-objection.card.json"));
  const removed=c.claims.splice(11,1)[0];
  c.unmapped.push({text:removed.text,span:removed.span,reason:"no-field-for-this-content"});
  process.stdout.write(JSON.stringify(c));
  ' | node checker/verify-traces.mjs /dev/stdin
  ```
  Real output: `TRACES VERIFIED — /dev/stdin. 0 problems.`, exit 0, coverage byte-identical to the
  original card. This is coverage-identical laundering, not omission, and nothing in this repo
  distinguishes it from a truthful declaration.
- **A single `claims[]` entry can span the entire input, and the card verifies.** Every other
  field can then be `not in source`, coverage reads 100%, and nothing fires: the omission check asks
  whether every byte sits under some span, not whether the card broke the input into pieces a reader
  could use. The `speakers[].evidence` span is bounded (`EVIDENCE_SPAN_TOO_LARGE`, fixture
  `neg-25`); `claims[]`, `title` and the other quote fields are not. Reproduce:
  ```bash
  node -e '
  const fs=require("fs");
  const buf=fs.readFileSync("inputs/04-pricing-objection.txt");
  const c=JSON.parse(fs.readFileSync("cards/04-pricing-objection.card.json"));
  c.claims=[{text:buf.toString(),span:{start:0,end:buf.length}}];
  for (const k of ["speakers","numbers","entities","steps","unmapped"]) c[k]="not in source";
  c.coverage.covered_bytes=buf.length; c.coverage.pct=100;
  process.stdout.write(JSON.stringify(c));
  ' | node checker/verify-traces.mjs /dev/stdin
  ```
  Real output: `TRACES VERIFIED — /dev/stdin. 0 problems.`, exit 0. A bound on every quote field,
  calibrated against the shipped cards the way the evidence bound was, is the obvious fix. It is not
  built.

The honest summary: this translator's strength is that it cannot invent, and its weakness is that
extraction that cannot invent is also blunt. Given the brief, *one invented fact and the entry is
out*, that is the trade to make.

## Layout

```
identity.md    what it converts, from what, to what
rules.md       the mapping: which input parts feed which fields, what to do with a gap, what never to add
examples.md    six worked examples, every span copied from a real card
reference/     THE CONTRACT: schema/lesson-card.v1.json, field-definitions.md, format-spec.md
README.md      the short version
docs/          this file (WALKTHROUGH.md) and the diagrams
checker/       convert.mjs · verify-traces.mjs · schema-validate.mjs · shape-diff.mjs · selftest.mjs
inputs/        3 real transcripts + 1 synthetic + sha256sums.txt + meta.json + PROVENANCE.md
fixtures/      clean control + 26 staged inventions + their transcript + 3 unseen-input e2e transcripts + the generator
cards/         the 4 outputs
assets/        social-preview.png, the image GitHub shows when the repo link is shared
audits/        generated by shape-diff.mjs, not committed; your run writes it
```

`reference/` holds the contract because a schema that is not written down somewhere a reader can
open gives nobody a way to check whether the translator kept its promise.

## Room to expand

**What exists today is one hardcoded reference implementation of one profile, not a schema-driven
engine.** `convert.mjs` never reads `reference/schema/lesson-card.v1.json`: its field list, key
order, absent marker and extraction tables are hardcoded in the script. `verify-traces.mjs` and
`shape-diff.mjs` do read that schema file at runtime for `fieldOrder` and the absent marker, but the
*path* to it, `reference/schema/lesson-card.v1.json`, is itself hardcoded, not selected by a
profile argument. Nothing in this repo demonstrates a second schema producing a second profile.

A second profile (`discovery-notes → SOW` (a sales call's notes converted into a statement of
work), for example) is **not built**. Adding one would mean writing a new extraction script (or a
new set of tables for `convert.mjs`) and pointing the checkers at the new schema file; it would not
drop in unchanged. The trace verifier's span/byte logic is generic enough to be reused for that work,
which is the one honest piece of forward-looking design here, but reuse is not the same claim as
"drop in."

**One profile is implemented.**
