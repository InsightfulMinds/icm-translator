# rules: how a transcript maps to a lesson card

This is the conversion procedure. It is written to be followed by a model reading this folder as a
Claude project, and it is the same procedure `checker/convert.mjs` implements mechanically.

The rules are deliberately dumb. A sentence is a step because it matches a marker in a table below,
not because someone judged it to be one. Fidelity, not judgement: a judgement call is where an
invention gets in wearing a reasonable expression.

---

## 0 · The three laws, in priority order

1. **Never emit a character that is not in the input.** Every value you write must be copied out of
   the transcript together with the byte range you copied it from. If you cannot point at it, you
   cannot write it.
2. **Never omit a field.** Every field in `fieldOrder` appears in every card, in that order. When
   there is nothing to put in one, put the literal string `not in source`.
3. **Never drop content silently.** Anything the schema has no home for goes in `unmapped[]` with a
   reason. A card that quietly discards the objection the member raised is worse than no card.

When two rules seem to conflict, the lower number wins.

## 1 · Spans

Every quote is `{"text": …, "span": {"start": …, "end": …}}` where the span is a **byte** range,
half-open, into the UTF-8 encoding of the input file.

The test your output must survive: `bytes(input)[start:end]` decoded is **byte-identical** to
`text`. Not trimmed, not normalised, not case-folded. Identical.

Do not compute spans by counting characters in your head. Find the substring, take its offsets, and
if the input has any non-ASCII in it, remember that a byte offset and a character offset are not the
same number.

## 2 · Segmentation

Split the transcript into sentences at `.`, `?` or `!` followed by whitespace or end-of-input. Keep
the terminator with its sentence. Drop leading and trailing whitespace from each sentence span.

Consecutive sentence spans should be separated only by the single space between them. That is what
keeps every uncovered run short enough to stay under the `unmapped` threshold. See §9.

## 3 · Per-sentence classification

Each sentence goes to exactly one of `steps[]`, `claims[]` or `unmapped[]`. Test in this order:

**Is it social?** Greeting or sign-off. The sentence starts with or contains one of:

> hello · hi · hey · ciao · see you · thanks for watching · thank you for watching · good luck ·
> best of luck · welcome · bye · see you soon · i wish you

→ `unmapped[]`, reason `no-field-for-this-content`. It is real speech; there is simply no field for
it. Do not delete it.

**Is it a step?** It is, if the first word is one of:

> click · go · open · select · enter · copy · paste · add · upload · scroll · download · pin ·
> submit · check · watch · create · put · continue · install · type · choose · press · sign · log ·
> drag · drop · save · share · delete · remove · set · pick

or the sentence *starts with* one of these sequence markers:

> the first thing is to · the next thing is to · the next step is · and then · after that ·
> we can go ahead and · let's go ahead and · and just like that · now, let · first, · next, ·
> then · finally, · and the next thing

or it *contains* a sequence marker **and** contains an imperative from the list above.

→ `steps[]`, appended in document order with `index` counting from 1.

**Otherwise:** six words or more → `claims[]`. Fewer than six → `unmapped[]`, reason
`below-extraction-threshold`.

The `ambiguous-attribution` reason exists for content whose speaker or referent the input does not
settle. Use it rather than guessing who said something.

## 4 · `steps[]` must run forwards

Step spans must strictly increase. A procedure is narrated in order, so if your step 2 span starts
after your step 3 span, you have pointed at a *different occurrence of the same words* later in the
transcript.

This matters more than it sounds. A setup walkthrough says "click continue" four or five times. All
of those byte-match the string `click continue` perfectly. Ordering is the only thing that
distinguishes the right one, and the verifier enforces it.

## 5 · `speakers[]`

Only from an explicit self-introduction: `my name is X`, `I am X`, `I'm X`, where X is one or two
capitalised words. `name` is the span of X alone; `evidence` is the span of the whole introducing
phrase.

A capitalised word with no introducing phrase is not a speaker. At most it is an entity.

**The verifier enforces this as containment, not just two independently real quotes.** `name`'s span
must sit entirely inside `evidence`'s span (`SPEAKER_NAME_NOT_IN_EVIDENCE`). A real name and a real
introducing phrase that belongs to a *different* speaker do not make a card verify. The name has to
actually be part of the phrase that names it, not merely correct on its own.

**The name goes out exactly as it appeared.** This is the rule the brief singles out and it is the
one you will be most tempted to break, because transcription mangles names and correcting one feels
like diligence. It is not. It is invention, and it is disqualifying. If the transcript says `Sara`,
the card says `Sara`.

No self-introduction anywhere → `speakers` is `not in source`.

## 6 · `title`

Only if the speaker states one: `this video is called "X"`, `titled "X"`. Verbatim, with its span.

A filename is not a title. A video's published title is not a title. The scrape metadata sitting
next to the transcript is not a title. None of those are the input. In practice this field is
`not in source` far more often than not, and all four shipped cards have it absent, which is the
field working, not the field failing.

## 7 · `definitions[]`, `numbers[]`, `entities[]`

**definitions**, the pattern `<Capitalised thing> is a|an|the <role phrase>`, and the same with
`, which is` in the middle, because that is how people actually talk. `term` is the capitalised
thing; `definition` is the role phrase **as given**, running to the next `.`, `,`, `;` or `:`.

**The verifier enforces proximity, not just a byte match:** `definition` must start no more than 60
bytes after `term` ends (`DEFINITION_NOT_ASSOCIATED`). A definition that is real, span-backed, and
byte-correct but copied from somewhere else in the input does not pass just because its bytes match
something true.

**numbers**, every figure: `$1,200`, `45%`, `529`. The `value` is verbatim **including** currency
symbol and separators; `$5,000` is not `5000`. Then look at what immediately follows for a unit
(`a month`, `per year`, `dollars`, `percent`, `people`, `members`, `minutes`) and if one is there,
span it. If not, `unit` is `not in source`. Never supply a unit that felt implied.

**The verifier enforces adjacency, not just a byte match:** when `unit` is present, it must start no
more than 5 bytes after `value` ends, with nothing but whitespace between them
(`UNIT_NOT_ADJACENT`). A unit quoted verbatim from a different sentence's number does not pass just
because the words are real.

Digits only. Numbers spelled out in words are not extracted; they will fall into a claim instead,
which is honest, and it is noted as a limitation in the README rather than hidden.

**entities**, a run of capitalised tokens, recorded once per distinct surface form, at its first
occurrence that is **not** sentence-initial. Capitalisation at the start of a sentence says nothing
about whether a word is a name, so it does not count as evidence. Skip pure function words,
pronouns, greetings, and capitalised contractions like `I'm` and `we've`.

Two spellings of the same thing are two entities. `Marco Salas` and `Marco` both appear because both
appear in the input. Collapsing them would be normalising, which is §0.1.

## 8 · `kind`: the one label in the card, and its fence

`kind` is the single field that is not a quote, so it is fenced: it stays `unknown` **unless the
input itself stated the thing's role**, in which case `role` carries that span and `kind` is a table
lookup on the role's own words:

| if the role phrase contains | kind |
|---|---|
| platform · tool · software · app · application · extension · agent · widget · bot · system · method | `tool` |
| company · organization · organisation · community · team · business · startup · agency | `org` |
| founder · co-founder · member · person · coach · teacher · student | `person` |
| a self-introduction established this name as the speaker | `person` |
| anything else, or no stated role at all | `unknown` |

No role span means `unknown`. The verifier enforces this pairing, so classifying something you could
not point at is a failure, not a nuance.

**The verifier also enforces that `role` is *near* `name`, not merely present** (`ROLE_NOT_NEAR_NAME`):
either `name`'s span sits inside `role`'s span (a self-introduction, where the role phrase contains
the name), or `role` starts no more than 60 bytes after `name` ends (a definition-style statement,
the same gap as `definitions[]` above). A true, real, span-backed sentence pulled from elsewhere in
the card does not clear the fence just because it byte-matches something real. It has to actually be
near the name it is supposed to classify.

## 9 · `unmapped[]` and `coverage`

`coverage` is the size of the **union** of every span in the card, over the total input bytes.
Overlapping spans count once.

Then find the runs of input that no span touches. Any such run at or above
`unmapped_threshold_bytes` (32 in this profile) that contains an alphanumeric character **must**
appear in `unmapped[]`. Runs of pure whitespace and punctuation between two quotes do not count:
nothing went missing there.

**The verifier recomputes coverage from the source. It does not read `unmapped[]` and trust it.
It checks whether every run of real content at or above the threshold is touched by *some* span
anywhere on the card**, and an `unmapped[]` entry's own span counts toward that exactly like any
other field's. That means declaring a gap honestly and declaring it under a false `reason` cover the
same bytes either way. The verifier checks `reason` for closed-enum membership only (see
`reference/field-definitions.md`, the `unmapped[]` section), never against the content it is supposed
to explain. So there is a real benefit, in the sense of evading detection, to moving content into
`unmapped[]` under a reason that does not match why it lacks a field. That failure mode is disclosed
as a known, unfixed gap in the README's Limits section, and this rule does not close it. What it does
close is content with **no covering span at all**: declare nothing, and the hole is caught.

## 10 · Before you emit

- Every field in `fieldOrder`, in that order, nothing extra.
- Every leaf that came from the input is a quote with a span; everything else is `not in source` or
  declared metadata.
- No empty arrays. A field with nothing in it is `not in source`, never `[]`.
- No list cites the same span twice (`DUPLICATE_SPAN`), and no object repeats a key
  (`DUPLICATE_KEY`). A sentence the speaker really repeated has its own span; cite that one.
- `coverage` recomputed from your own spans, not estimated.
- `generated_utc` read from a real clock.

Then run `node checker/verify-traces.mjs <your-card.json>`. If it exits 1, the card is wrong. Fix
the card, never the assertion.
