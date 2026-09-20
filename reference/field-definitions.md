# Field definitions — `lesson-card.v1`

The machine-readable contract is `schema/lesson-card.v1.json`. This file is the prose half: what
each field means, what goes in it, and — more useful — what a careless translator would put in it
that must not go in it.

Written 2026-09-19T13:38:23Z, before any converter code existed. That order is deliberate: a schema
derived from whatever the converter happened to emit is not a contract, it is a description.

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

Spans are **byte offsets**, half-open `[start, end)`. Not line numbers — the inputs this profile
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

`schema` and `profile` are both the constant `lesson-card.v1`. They are separate fields because the
engine is profile-driven: a later profile (`discovery-notes → SOW`) changes `profile` while the
verifier and the `quote` invariant stay exactly as they are.

`generated_utc` is read from the system clock at write time, `YYYY-MM-DDTHH:MM:SSZ`.

## `source`

Identifies the exact bytes every span points into.

| key | meaning |
|---|---|
| `file` | repo-relative path to the input, which **ships in this repo** so spans are re-checkable |
| `sha256` | hash of those bytes; a mismatch voids every span in the card and the verifier stops there |
| `bytes` | length of the input in bytes |
| `duration_seconds` | recording length, from the transcription metadata in `inputs/PROVENANCE.md` |

These four are metadata **about** the file, not claims **from** it — a transcript does not state its
own hash. `duration_seconds` is `not in source` when no transcription metadata exists for that
input, which is the honest answer for a scraped caption track.

## `title`

A title the speaker actually stated, verbatim, with its span. Otherwise `not in source`.

**The trap:** a published video has a title, and the filename suggests one, and the surrounding
scrape metadata carries one. None of those are the input. Input 3 in this repo comes from a YouTube
video titled *"The only MCP you will ever need."* — a title that appears nowhere in the transcript.
Its card says `not in source`, and that is the field working correctly.

## `speakers[]`

Each entry is a `name` quote plus an `evidence` quote — the span of the phrase that established who
is speaking, such as a self-introduction. A capitalised word with no establishing phrase is not a
speaker; it is at most an entity.

**The trap, and it is the one the brief names explicitly:** *"a name spelled the way it usually is
instead of the way it appeared."* Automatic transcription mangles names. Ours does — dictation in
speech-to-text routinely renders `Sarah` as `Sara`. The card ships **what the transcript said**. Correcting a
name to its real spelling is inventing a fact the input does not contain, and it is disqualifying.
`negative fixture 03` stages exactly this and the verifier kills it.

## `claims[]`

Assertions the input makes, each a verbatim quote with a span. A claim is a thing the speaker
asserted, cut whole out of the transcript. Not a paraphrase, not a condensation, not a merge of two
sentences that were forty seconds apart.

## `definitions[]`

`term` + `definition`, both span-backed, where the input defines something. The definition is the
one **as given** — not a better one, not a corrected one, not one topped up from general knowledge
about the product being described.

## `numbers[]`

Every figure, its unit, its span.

`value` is verbatim **including** currency symbols, thousands separators and the spelling as it
appeared: `$5,000` is not `5000` and not `5,000 dollars`. `unit` is itself a span-backed quote, or
`not in source` — units are the easiest place to smuggle an invention, because "per month" feels
like formatting rather than a claim.

**A number with no span cannot ship.** This is the field where one drifted digit loses the comp
outright, so it carries no unverified bytes at all. `negative fixture 04` drifts a digit.

## `entities[]`

People, tools and organisations, spelled as they appeared, with spans.

`kind` is the single field in the whole card that holds a **label rather than a quote**, and it is
deliberately fenced: it is `unknown` unless the input itself states the role, in which case `role`
carries the span where it said so. No role span, no classification. This keeps the one non-quote
field from becoming an invention channel.

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

What the schema had nowhere to put — the brief's third property, *"it says what it could not map"*.

Each entry is a span, its text, and a `reason` from a closed enum:

| reason | when |
|---|---|
| `no-field-for-this-content` | the passage is real content, and no field in v1 holds that kind of thing |
| `below-extraction-threshold` | matched a field's shape too weakly to claim |
| `ambiguous-attribution` | content whose speaker or referent the input does not settle |

A closed enum, so this stays a lookup rather than prose the reader has to trust.

**The verifier does not take the card's word for this.** It recomputes the uncovered regions from
the source and the card's own spans, and fails the card if an uncovered run at or above
`coverage.unmapped_threshold_bytes` is not declared here. That is what makes the brief's *"a CRM
note that silently omits the objection the prospect raised is worse than useless"* mechanically
enforceable rather than a promise. `negative fixture 06` drops a passage and says nothing.

## `coverage`

`total_bytes`, `covered_bytes`, `pct`, and the `unmapped_threshold_bytes` bar the card held itself
to. All four are recomputable from the spans, and the verifier recomputes them. A card cannot assert
a coverage number its own spans do not support.

Overlapping spans are counted once — coverage is the size of the union of the spans, not their sum.

---

## What "verified" means here

A card is verified when `checker/verify-traces.mjs` exits `0`, which requires all of:

1. the input's sha256 matches `source.sha256`
2. every field in `fieldOrder` is present, in order, with no extra fields
3. every `quote` in the card byte-matches its span in the input
4. no span starts or ends mid-word relative to the input
5. `steps[]` spans strictly increase and `index` increments by 1
6. every non-marker value is either a quote or declared metadata — nothing free-floating
7. recomputed coverage matches the declared coverage
8. every uncovered run at or above the threshold is declared in `unmapped[]`

Exit `1` on any failure, with the expected and actual text printed at the first point they diverge.
