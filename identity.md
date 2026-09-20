# identity — what this folder converts

**Input:** one raw session transcript. A Loom recording run through Whisper, a YouTube caption
track, or any meeting recording's text. Messy, unpunctuated in places, no speaker labels guaranteed,
typically one enormous line with no structure at all.

**Output:** one **ICM lesson card** — a fixed-schema JSON artifact where every field is present
every time, every value traces to a byte range in the transcript, and anything the schema could not
hold is named rather than dropped.

**The contract:** `reference/schema/lesson-card.v1.json`, with the prose half in
`reference/field-definitions.md` and the on-disk format in `reference/format-spec.md`.

---

## Who does this by hand today

We do. The week this was built, this exact conversion was done by hand 25 times in one sitting — a
recorded-session catch-up where each lesson had to become a structured card so the rest of the
system could route to it. It is slow, it is dull, and the failure mode is always the same: the
person doing it tidies. They fix the name the transcription mangled. They round the number. They
write the next step that was obviously implied. Then somebody downstream acts on a card that says
something nobody ever said.

That is the whole reason this folder exists, and it is why fidelity is the only property it
optimises for.

## What it does not do

It does not summarise, improve, correct, score or judge. It has no opinion about the transcript.

- It does not fix a mangled name. If the caption track heard the platform as `Aduba`, the card says
  `Aduba`.
- It does not fill a gap with a plausible value. It writes `not in source`.
- It does not silently drop what it could not place. It writes it into `unmapped[]` with a reason.
- It does not infer a date, a next step, a sentiment or an outcome. If the input lacks it, so does
  the output.

## The rule that governs everything else

> A translator that puts something in the output that was not in the input has failed.

Every field carries a byte span into the transcript, and `checker/verify-traces.mjs` re-reads the
transcript and byte-compares. Invention does not get argued about here; it gets a non-zero exit
code.

## Two ways to run it, one gate over both

1. **As a Claude project.** Drop this folder in. `rules.md` is the conversion procedure and
   `reference/` is the contract. Claude reads the transcript and emits a card.
2. **As a script.** `node checker/convert.mjs` — a deterministic reference implementation that can
   only emit text it sliced out of the input.

`checker/verify-traces.mjs` checks the artifact either way and cannot tell which one produced it.
That is deliberate: the guarantee is on the card, not on the thing that wrote it.

## Room to expand

The engine is profile-driven. `lesson-card.v1` is the profile that ships. `discovery-notes → SOW`
and `carrier-doc → comparison-sheet` are the next two, and they drop in as a new schema in
`reference/schema/` without touching the trace verifier, which knows only about spans and bytes.

One profile is implemented. Three real fields beat a fake city.
