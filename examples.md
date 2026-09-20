# examples — the contract holding on real inputs

Every excerpt below is copied out of a card in `cards/`, produced from a transcript in `inputs/`.
Nothing here is illustrative-but-fictional. You can check any of it:

```bash
node checker/verify-traces.mjs cards/01-mobile-app-setup.card.json
```

Or check a single span by hand — this is the whole trick, and it takes one command:

```bash
# byte range 947-953 of input 1 should be exactly "$5,000"
dd if=inputs/01-mobile-app-setup.txt bs=1 skip=947 count=6 2>/dev/null; echo
```

---

## Example 1 — a number with a unit, and a number without one

**Input 1** (`01-mobile-app-setup.txt`, 2,657 bytes) says, around byte 940:

> …what works for a person that is making **$5,000 a month** right now, it's not the same strategy
> that a person that is making **$50,000** need.

**Output:**

```json
"numbers": [
  {
    "value": { "text": "$5,000",  "span": { "start": 947,  "end": 953 } },
    "unit":  { "text": "a month", "span": { "start": 954,  "end": 961 } }
  },
  {
    "value": { "text": "$50,000", "span": { "start": 1029, "end": 1036 } },
    "unit":  "not in source"
  }
]
```

Two things are happening here, and both are the point.

The first figure keeps its **comma and its dollar sign**. `$5,000` is what the input said; `5000`
would be a normalised value, which is a small invention and still an invention.

The second figure has **no unit**, because the speaker did not give it one. A summariser writes
`"unit": "a month"` here — the sentence is a comparison, so the unit is obviously carried over, and
"obviously" is how a fact that nobody stated ends up in a card somebody acts on. The translator
writes `not in source`.

## Example 2 — a procedure, in the order it was narrated

```json
"steps": [
  { "index": 1, "action": { "text": "The first thing is to click the link that is underneath this video.",
                            "span": { "start": 53,  "end": 120 } } },
  { "index": 2, "action": { "text": "And the next thing is to continue with Google or put your email and you will receive a code.",
                            "span": { "start": 181, "end": 273 } } },
  { "index": 3, "action": { "text": "Continue with Google.",
                            "span": { "start": 320, "end": 341 } } }
]
```

Spans strictly increase: 53 → 181 → 320. That is not decoration.

This transcript says some variant of "continue with Google" **three times**. Every one of them
byte-matches the string `Continue with Google` perfectly, so a verifier that only compared text
would accept a card that cited any of them for any step. Ordering is the only property that
distinguishes the right occurrence from the wrong one, and `fixtures/neg-05-neighbour-span` is
built to prove the verifier actually enforces it.

## Example 3 — a speaker, and a definition as given

**Input 2** opens: *"Hello everyone, my name is Marco Salas and I'm the co-founder of Dexter, which
is a platform that aims to help you find success inside of this community…"*

```json
"speakers": [
  {
    "name":     { "text": "Marco Salas",            "span": { "start": 27, "end": 38 } },
    "evidence": { "text": "my name is Marco Salas",  "span": { "start": 16, "end": 38 } }
  }
],
"definitions": [
  {
    "term":       { "text": "Dexter", "span": { "start": 65, "end": 71 } },
    "definition": { "text": "a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom",
                    "span": { "start": 82, "end": 239 } }
  }
]
```

The `evidence` span is what makes `speakers[]` checkable rather than asserted: a reader can open
byte 16 and see the phrase that established the name, not just the name.

The definition runs to its natural clause boundary and is **the definition as given** — long,
marketing-flavoured, and not tightened up. Tightening it would produce a better sentence and a worse
card.

Note also what this card does **not** contain: `Marco Salas` is a pseudonym applied to the input
before any card was generated, and that is disclosed in `inputs/PROVENANCE.md`. The card describes
the bytes that ship.

## Example 4 — the field that is correctly empty

All three cards carry:

```json
"title": "not in source"
```

Input 3 comes from a YouTube video with a perfectly good published title. The scrape metadata next
to it has that title. The filename hints at it. **None of those are the input**, and the speaker
never says a title out loud, so the field is absent.

This is the field working. A translator that reached one directory sideways for a nicer-looking
`title` would have failed the brief's central rule while producing a card that looked better.

## Example 5 — a mangled name, shipped mangled

```json
{ "name": { "text": "Aduba", "span": { "start": 4492, "end": 4497 } }, "kind": "unknown", "role": "not in source" }
```

`Aduba` is the caption track mishearing the name of the platform being demonstrated. It appears
twice in input 3, and card 3 carries it three times, spelled that way every time: once as the
entity above, and twice more inside the claims that quote the sentences it sits in.

Correcting it is the single most tempting edit in this repository. It is an obvious transcription
error, the real spelling is known, and fixing it makes the card look more professional. It is also
exactly the failure the brief disqualifies — *"a name spelled the way it usually is instead of the
way it appeared"* — so it ships as `Aduba`.

`kind` is `unknown` because the input never states what Aduba is. The card does not guess, and the
verifier will not let it: a `kind` other than `unknown` requires a `role` span, and there is none.

## Example 6 — what it could not map

```json
"unmapped": [
  { "text": "We select the same account.", "span": { "start": 342, "end": 369 }, "reason": "below-extraction-threshold" },
  { "text": "We can click continue.",      "span": { "start": 1232, "end": 1254 }, "reason": "below-extraction-threshold" },
  { "text": "Just click add.",             "span": { "start": 1545, "end": 1560 }, "reason": "below-extraction-threshold" }
]
```

Nine passages in card 1 went nowhere, and the card says so, with spans, so a reader can go look at
each one and decide whether the schema needs a new field.

`coverage` for this card is **97.97%** — 2,603 of 2,657 bytes accounted for. The missing 2% is the
whitespace and punctuation between quoted sentences. The verifier recomputes that number from the
card's own spans and rejects the card if it does not match, so it is not a figure anybody typed in.
