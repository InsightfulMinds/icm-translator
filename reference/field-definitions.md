# Field definitions: `lesson-card.v1`

The machine-readable contract is `schema/lesson-card.v1.json`. This file is the prose half: what
each field means, what goes in it, and, more useful, what a careless translator would put in it
that must not go in it.

Written 2026-09-19T13:38:23Z, before any converter code existed: an author-reported timestamp and
ordering, not something provable from the files in this repo alone. The order is deliberate either
way: a schema derived from whatever the converter happened to emit is not a contract, it is a
description.

---

## The three rules that govern every field

**1 · Every leaf that came from the input is a `quote`.**

```json
{ "text": "the words, verbatim", "span": { "start": 1024, "end": 1043 } }
```

The invariant: `utf8_bytes(source.file)[start:end]` decoded is **byte-identical** to `text`. Not
similar. Not equal after trimming. Identical. `checker/verify-traces.mjs` re-reads the file and
compares, and it never imports the converter, so a bug in the converter cannot talk the verifier
into agreeing with it.

Spans are **byte offsets**, half-open `[start, end)`. Not line numbers: the inputs this profile
accepts are single-line transcripts of two to seven kilobytes, where every line number would read
`1` and locate nothing.

**2 · A field with no source carries the literal string `not in source`.**

Exactly that string. Not `null`, not `""`, not `[]`, not a missing key, not `N/A`, not `unknown`.
One marker, spelled one way, so a reader scanning a card can find every gap with one search.

Array fields are **either non-empty or the marker**. An empty array is ambiguous between "the input
had none of these" and "the converter did not look", and this contract does not allow that
ambiguity to exist.

**3 · A field is never composed.**

If the answer is not sitting in the input as contiguous bytes, the field does not get it. The
translator has no license to improve, correct, tidy, expand, infer or complete. Its job is fidelity.

---

## `schema` · `profile` · `generated_utc`

Card metadata, not extracted content.

`schema` and `profile` are both the constant `lesson-card.v1`. They are kept as separate fields on
the theory that a later profile could change `profile` while the `quote` invariant stays the same.
See the walkthrough's [Room to expand](../docs/WALKTHROUGH.md#room-to-expand) for what that would actually require
and what is not built yet.

`generated_utc` is read from the system clock at write time, `YYYY-MM-DDTHH:MM:SSZ`.

## `source`

Identifies the exact bytes every span points into.

| key | meaning |
|---|---|
| `file` | repo-relative path to the input, which **ships in this repo** so spans are re-checkable |
| `sha256` | hash of those bytes; a mismatch voids every span in the card and the verifier stops there |
| `bytes` | length of the input in bytes |
| `duration_seconds` | recording length, from the transcription metadata in `inputs/PROVENANCE.md` |

These four are metadata **about** the file, not claims **from** it. A transcript does not state its
own hash. `duration_seconds` is `not in source` when no transcription metadata exists for that
input, which is the honest answer for a scraped caption track.

## `title`

A title the speaker actually stated, verbatim, with its span. Otherwise `not in source`.

**The trap:** a published video has a title, and the filename suggests one, and the surrounding
scrape metadata carries one. None of those are the input. Input 3 in this repo comes from a YouTube
video titled *"The only MCP you will ever need."* (MCP: Model Context Protocol), a title that
appears nowhere in the transcript.
Its card says `not in source`, and that is the field working correctly.

## `speakers[]`

Each entry is a `name` quote plus an `evidence` quote, the span of the phrase that established who
is speaking, such as a self-introduction. A capitalised word with no establishing phrase is not a
speaker; it is at most an entity.

**The verifier enforces this as byte containment, not just byte matching:** `name.span` must sit
entirely inside `evidence.span` (`evidence.start <= name.start` and `name.end <= evidence.end`).
Both quotes can independently byte-match real text in the input and still fail this: the fix for
exactly the bypass where one speaker's real name quote was substituted onto a different speaker's
real evidence quote, and both spans checked out on their own.

**The trap, and it is the one the brief names explicitly:** *"a name spelled the way it usually is
instead of the way it appeared."* Automatic transcription mangles names. Ours does: dictation in
speech-to-text routinely renders `Sarah` as `Sara`. The card ships **what the transcript said**. Correcting a
name to its real spelling is inventing a fact the input does not contain, and it is disqualifying.
`negative fixture 03` stages exactly this and the verifier kills it.

## `claims[]`

Assertions the input makes, each a verbatim quote with a span. A claim is a thing the speaker
asserted, cut whole out of the transcript. Not a paraphrase, not a condensation, not a merge of two
sentences that were forty seconds apart.

## `definitions[]`

`term` + `definition`, both span-backed, where the input defines something. The definition is the
one **as given**, not a better one, not a corrected one, not one topped up from general knowledge
about the product being described.

**The verifier enforces proximity:** `definition.span` must start no earlier than `term.span` ends,
and within a small calibrated byte gap (see "What the verifier cannot fully enforce" below for what
this does and does not prove). A definition quoted verbatim from somewhere else entirely in the
input (true on its own, but about something else) no longer passes just because its bytes match.

## `numbers[]`

Every figure, its unit, its span.

`value` is verbatim **including** currency symbols, thousands separators and the spelling as it
appeared: `$5,000` is not `5000` and not `5,000 dollars`. `unit` is itself a span-backed quote, or
`not in source`. Units are the easiest place to smuggle an invention, because "per month" feels
like formatting rather than a claim.

**The verifier enforces adjacency, not just a byte match:** when `unit` is present, `unit.span` must
start at or after `value.span` ends, separated by nothing but whitespace, within a small calibrated
gap (5 bytes, see "What the verifier cannot fully enforce" below). A unit quoted verbatim from a
different sentence's number no longer passes just because the bytes match some real unit somewhere.

**`not in source` here means "the input did not state a unit adjacent to this figure," not "no unit
exists that a human would associate with this figure."** The extractor recognises a fixed, narrow
list of unit words directly after "a" or "per" (month/year/week/day/hour/site) plus a fixed list of
bare plural units (dollars, percent, months, ..., people, times). A figure whose unit is stated in
different wording that isn't on that list (a novel noun, a unit stated in a separate clause, an
implied unit from context) will show `not in source` even though a human reading the transcript
would say the unit is "in source." This was flagged directly: `$5,800 per site` originally showed
`not in source` for its unit purely because "site" wasn't on the list; it has been added, but the
underlying limitation (a fixed word list, not general language understanding) remains for any unit
phrasing not on it. Do not read `not in source` on `numbers[].unit` as a guarantee that the input
never expressed a unit for that figure, only that this extractor's fixed vocabulary didn't find one
immediately adjacent to it.

**A number with no span cannot ship.** This is the field where one drifted digit loses the comp
outright, so it carries no unverified bytes at all. `negative fixture 04` drifts a digit.

## `entities[]`

People, tools and organisations, spelled as they appeared, with spans.

`kind` is the single field in the whole card that holds a **label rather than a quote**, and it is
deliberately fenced: it is `unknown` unless the input itself states the role, in which case `role`
carries the span where it said so. No role span, no classification. This keeps the one non-quote
field from becoming an invention channel.

**The verifier enforces more than "a role span exists":** when `role` is present, it must also be
*near* `name`: either `name.span` sits inside `role.span` (a self-introduction like "my name is
Marco Salas" contains the name), or `role.span` starts shortly after `name.span` ends (a definition
like "Dexter is a platform ..."), using the same calibrated gap as `definitions[]` above. Supplying
some other true, real, span-backed claim from elsewhere in the card as the `role` (a claim that
passes every other check on its own) no longer clears the classification fence just because it byte
-matches something real; it has to actually be near the name it is supposed to classify.

## `steps[]`

The ordered procedure, if one was stated; otherwise `not in source`. Each entry is a 1-based `index`
and an `action` quote. `index` increases by exactly 1.

**Step spans must be strictly increasing in `start`.** A procedure is narrated in order, so a step
whose span jumps backwards is pointing at a *repeat of the same words somewhere else* in the
transcript. Setup transcripts say "click continue" five times; a span that byte-matches perfectly
while pointing at the wrong one of those five is the neighbour attack, and ordering is what catches
it. `negative fixture 05` stages it, and it is the fixture worth studying: **it passes the byte
comparison and the verifier rejects it anyway.**

## `unmapped[]`

What the schema had nowhere to put, the brief's third property, *"it says what it could not map"*.

Each entry is a span, its text, and a `reason` from a closed enum:

| reason | when |
|---|---|
| `no-field-for-this-content` | the passage is real content, and no field in v1 holds that kind of thing |
| `below-extraction-threshold` | matched a field's shape too weakly to claim |
| `ambiguous-attribution` | content whose speaker or referent the input does not settle |

A closed enum, so this stays a lookup rather than prose the reader has to trust.

**The verifier does not take the card's word for this, and it does not specifically read `unmapped[]`
to check it either.** It recomputes which bytes are touched by *any* span anywhere in the card (a
claim, a step, a number, an `unmapped[]` entry, anything shaped `{text, span}`) and fails the card if
a run of real content at or above `coverage.unmapped_threshold_bytes` is left untouched by all of
them. Declaring a gap in `unmapped[]` is one way to cover it, because its own span counts exactly like
any other field's span; the check is symmetric across every field, not a lookup against the
`unmapped[]` list specifically. What it does **not** verify is whether a declared entry's `reason` is
the true one: enum membership is checked (see the table above), truthfulness against the content is
not.

That closes the specific failure the brief's CRM (customer-relationship-management) example names
literally, *"a CRM note that silently omits the objection the prospect raised is worse than
useless"*, only in the narrow case where the objection ends up with **no covering span anywhere on
the card**. `negative fixture 06` stages exactly that: it drops a passage and declares nothing
anywhere, leaving it with no covering span at all, which is what gets caught. It is not the stronger,
general guarantee that sentence implies. Move the same objection into `unmapped[]` under a false
`reason` instead of dropping it outright (`reason: "no-field-for-this-content"` on content that
plainly belongs in `claims[]`) and coverage is byte-identical to declaring it honestly, so the check
cannot tell the two apart. This is a disclosed, unfixed gap; see the README's Limits section for a
worked, verified reproduction.

## `coverage`

`total_bytes`, `covered_bytes` and `pct` are recomputed by the verifier from the card's own spans, so
a card cannot assert a coverage number its spans do not support. `unmapped_threshold_bytes`, the bar
a card holds itself to for declaring an uncovered run in `unmapped[]`, is not recomputed the same
way: it is fixed by the profile, and the verifier checks the card's declared value for equality
against that fixed number rather than deriving it from the spans.

Overlapping spans are counted once: coverage is the size of the union of the spans, not their sum.

---

## What "verified" means here

A card is verified when `checker/verify-traces.mjs` exits `0`, which requires all of:

1. the card validates against the full JSON Schema (`reference/schema/lesson-card.v1.json`), every
   type, required field, closed enum, `additionalProperties` and union
2. the input's sha256 matches `source.sha256`
3. every field in `fieldOrder` is present, in order, with no extra fields
4. every `quote` in the card byte-matches its span in the input
5. no span starts or ends mid-word or mid-character relative to the input, deciding "word" on the
   actual Unicode code point on each side of the cut (a digit next to a letter is mid-word; a digit
   next to a symbol like `°` is not)
6. `speakers[].name` is contained within its own `speakers[].evidence`
7. `numbers[].unit`, when present, is immediately adjacent to its own `numbers[].value`
8. `definitions[].definition` is near its own `definitions[].term`
9. `entities[].role`, when present, is near its own `entities[].name`
10. `steps[]` spans strictly increase and `index` increments by 1
11. every non-marker value is either a quote or declared metadata, nothing free-floating
12. recomputed coverage matches the declared coverage
13. every run of real content at or above the profile's fixed threshold is touched by some span
    somewhere in the card: declaring it in `unmapped[]` is the normal way to supply that span, but
    the check is symmetric across every field (see "unmapped[]" above for what this does and does not
    verify about a declared entry's reason)
14. the card file repeats no key within one object, with keys compared after decoding JSON escapes
    (`"\u0074itle"` and `"title"` are the same key), and no list cites the same span twice

Exit `1` on any failure, with the expected and actual text printed at the first point they diverge.

---

## What the verifier cannot fully enforce

Checks 6–9 above are proximity checks, calibrated against every shipped card and the control fixture
rather than tuned to catch one known attack. Here is the measurement itself, so the claim does not
rest on a file outside this folder. Every occurrence of the four relations across `cards/01`–`04`
and `fixtures/control/card.json`, gaps measured directly from the committed span bytes:

| card | speaker name ⊂ evidence? | number → unit gap | definition → term gap | entity role ↔ name |
|---|---|---|---|---|
| `01-mobile-app-setup` | (no speakers) | `$5,000`→`a month`: gap 1; `$50,000`: unit absent | (no definitions) | Google, AI: role absent |
| `02-desktop-setup` | Marco Salas: contained (`[27,38)` ⊂ `[16,38)`) | (no numbers) | Dexter: gap 11 (`, which is `) | Marco Salas: role **contains** name (self-intro); Dexter: gap 11; 8 other entities: role absent |
| `03-mcp-walkthrough` | (no speakers) | `15`→`people`: gap 1; `10`: unit absent | (no definitions) | 15 entities, all role absent |
| `04-pricing-objection` | Dana: contained (`[27,31)` ⊂ `[23,31)`); Tomas: contained (`[64,69)` ⊂ `[60,69)`) | 4 numbers: `$5,800`→`per site`: gap 1; other 3: unit absent | (no definitions) | Thursday, August: role absent |
| `fixtures/control` | Sara: contained (`[18,22)` ⊂ `[7,22)`) | `$5,000`→`a month`: gap 1 | Dexter: gap 4 (` is `) | Dexter: gap 4; Sara: role absent |

Reproduce any cell yourself, for example, card 02's definition gap:
`node -e 'const c=require("./cards/02-desktop-setup.card.json");console.log(c.definitions[0].definition.span.start-c.definitions[0].term.span.end)'`
prints `11`.

From that table: speaker containment holds without exception on every real speaker (4 of 4,
Marco Salas, Dana, Tomas, Sara), so the chosen rule is hard containment, no slack. The number/unit gap
measures 1 byte in every occurrence where a unit is stated; the chosen bound is 5 bytes, headroom for
stray whitespace without approaching the length of an unrelated quote. The definition/term gap
measures 4 and 11 bytes (the connective text itself, `" is "` and `", which is "`); the chosen bound
is 60 bytes, roughly 5x the observed maximum. Entity role/name reuses that same 60-byte bound, or
containment where the role phrase is a self-introduction. Be precise about what these checks do and do
not prove:

- **What they prove:** the two quotes involved are not just independently real. They are close
  enough in the source, in the specific geometric relationship the field's definition describes
  (containment for a speaker's name-in-evidence; forward adjacency for a number's unit, a
  definition's body, or a self-stated role), that an unrelated substitution from elsewhere in the
  input is rejected. This is what closes the bypass where a swapped-in quote was real and
  individually verifiable but had nothing to do with the field it was placed in.
- **What they do NOT prove:** byte proximity is a heuristic for "these two things are about each
  other," not a semantic proof of it. This is not a hypothetical needing a pathological input to
  reach. The shipped input already permits it. Input 4's `entities[0]` is `Thursday`, correctly
  `kind: unknown` because no role is stated near it. Relabel it `kind: "person"` and set `role` to the
  quote `"it quotes the same figure"`, which starts 5 bytes after `Thursday`'s span ends (well inside
  the calibrated gap for `entities[].role`) but is an unrelated clause about a renewal email, not a
  statement of anyone's role. The card still verifies. The gaps (5 bytes for
  `numbers[].unit`, 60 bytes for `definitions[].definition` and `entities[].role`) were picked as the
  loosest bound every real occurrence in the shipped data satisfies, with headroom for legitimate
  variation in phrasing, not as a proof-theoretic bound. Nothing in this repo, or in JSON Schema,
  can mechanically verify semantic relatedness between two spans; only their distance and byte
  content.
- **The residual "not in source" imprecision on `numbers[].unit`** (documented above, under
  `numbers[]`) is a related but separate limitation: it is not about association between two present
  quotes, but about the extractor's fixed unit-word vocabulary missing units stated in wording it
  doesn't recognise. Adding "site" to that vocabulary fixed the one instance in the shipped inputs;
  it does not make the vocabulary general.
