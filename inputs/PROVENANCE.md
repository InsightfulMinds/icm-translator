# Provenance of the shipped inputs

Four inputs, shipped so anyone can re-run the translator on the exact bytes the cards in `cards/`
were cut from. Three are real transcripts. The fourth is synthetic and says so. Written
2026-09-19T13:41:51Z, input 4 added 2026-09-19.

Verify the bytes before trusting a card:

```bash
shasum -a 256 -c inputs/sha256sums.txt   # run from the repo root
```

| # | file | bytes | words | duration | origin | shape |
|---|---|---|---|---|---|---|
| 1 | `01-mobile-app-setup.txt` | 2,657 | 529 | 161.0 s | Loom recording, transcribed locally | one line, trailing newline |
| 2 | `02-desktop-setup.txt` | 6,713 | 1,310 | 391.6 s | Loom recording, transcribed locally | one line, trailing newline |
| 3 | `03-mcp-walkthrough.txt` | 7,573 | 1,415 | 425 s | YouTube caption track | one line, **no trailing newline** |
| 4 | `04-pricing-objection.txt` | 1,441 | 267 | none | **SYNTHETIC — written by hand for this repo** | one line, trailing newline |

sha256, in full:

| # | sha256 |
|---|---|
| 1 | `df4afc2facfd01252efb2e4103bcf523946249b7566c2e430800e1d89954cca8` |
| 2 | `f75026476f201a7ff3c161a72875cc0538c440728c9133efa0727711c9ac2e7c` |
| 3 | `1c5eb847754b2d41a755e9c5711a9ebbb57c9939a971b9d41d3ffdd89cc797e1` |
| 4 | `32f1fb1ba10b4d423ff83f4a23f3db1fe8faed22a13176444cd4ebc817e34460` |

## Input 4 is synthetic, and that is stated on purpose

`04-pricing-objection.txt` was **written by hand for this repo**. It is not a recording, not a
transcript of anything anyone said, and there is no audio behind it. The names Dana and Tomas are
invented, the company situation is invented, and every figure in it is invented.

It is labelled synthetic here rather than presented as found material, because a fabricated input
passed off as real would be the same failure this whole repo is built to avoid — asserting
something the source does not support. A synthetic input that says it is synthetic costs nothing.

**Why it exists.** Inputs 1, 2 and 3 are all the same genre: one person calmly narrating a
walkthrough to a camera. Three inputs of one genre cannot test what happens when the *shape of the
conversation* changes. Input 4 changes it — two speakers, no speaker labels, two directly
contradicting claims about the same quantity, an objection that is raised and never resolved, and a
figure corrected mid-sentence.

**It is deliberately outside the declared input profile.** `identity.md` says this translator takes
single-narrator walkthrough transcripts. A two-party argument is not that. It ships anyway, because
what the tool does on an input it was not designed for is worth more to a reader than a fourth
clean pass. The card it produces verifies — all spans byte-exact, shape identical to the other
three — and it also exposes five real limitations, which are written up in the README under
**"What the fourth input exposed"**. None of them were fixed quietly. None of them are invention.

**It has no `duration_seconds`.** There is no recording, so `inputs/meta.json` has no entry for it,
so card 4 carries `source.duration_seconds: "not in source"`. That is the contract working: the
field is present, in position, and honestly empty.

## Why the first three

They are deliberately unalike, because "the output shape holds across different inputs" is only a
claim worth testing if the inputs actually differ:

- **Length** spans 2.6 KB to 7.6 KB — roughly 3x.
- **Two transcription pipelines.** Inputs 1 and 2 are Whisper (`whisper-large-v3-turbo`) over Loom
  audio: fully punctuated, no speaker labels. Input 3 is a YouTube caption track: different
  sentence segmentation and different artefacts.
- **Different content.** 1 and 2 are procedural walkthroughs full of ordered steps. 3 is a
  discursive explanation with almost no procedure — so its `steps[]` behaviour is genuinely tested
  rather than assumed.
- **Different file endings.** 1 and 2 end with `\n`; 3 does not. An off-by-one at the end of a file
  is exactly the kind of thing that only shows up when an input does not look like the others.

## Two inputs carry disclosed substitutions

Both are pseudonymisations of third-party speech, applied to the **input bytes before any card was
generated**. Every card in `cards/` was cut from the shipped bytes, so the spans still verify
exactly; nothing in this repo describes bytes it does not also ship.

### Input 2

The speaker introduces himself by name in the original recording. Before shipping, that name was
replaced with the pseudonym **Marco Salas** (and the later standalone first-name reference with
**Marco**). Two occurrences, one name, nothing else touched; the file grew by one byte.

This is disclosed rather than quietly done, for a reason that matters to this specific comp: a judge
comparing the card against the shipped transcript must find them byte-identical, and they do —
**the card was generated from the pseudonymized bytes, not from the original.** The pseudonym is
what "appeared in the input" as far as this repo is concerned, so the fidelity rule holds exactly.

### Input 3

Two substitutions, both word-boundary matched, single occurrences, no other bytes touched (the file
is the same 7,573 bytes):

| shipped as | what it replaced | why |
|---|---|---|
| `Devin` | a community member's first name | a third party named in passing, who did not publish this recording |
| `Rivapong` | a coinage built on the speaker's own surname | the speaker says *"he used my last name to kind of build it out"*, so the original word discloses that surname |

**The originals are not printed here, on purpose.** A provenance note that lists the name it removed
has not removed it. Naming a substitution's input in the same file that ships the output is the
commonest way an anonymisation pass leaks the thing it was run to protect.

`Rivapong` keeps the shape of the original — a surname fused to `Pong` — so the sentence still reads
the way it was spoken. The standalone word `Pong` is the video game and is untouched, as are
`Claude`, `OpenAI`, `ChatGPT`, `Discord` and `Hermes`, which are products rather than people.

### What was deliberately NOT changed

No name was normalised, corrected or tidied anywhere in any input.

The clearest case is `Aduba`, which appears twice in input 3. It is the caption track mishearing the
platform's actual name. Correcting it would be the single most tempting edit in this repo — it
"fixes" an obvious transcription error — and it is exactly the invention the brief disqualifies:
*"a name spelled the way it usually is instead of the way it appeared."* It ships as `Aduba`, and
card 3 carries `Aduba`, because that is what the input says.

Product and community names (`Dexter`, `Cliff Notes`) are public brands and ship as they appeared,
including the transcription's own rendering of them.

Input 1 contains no personal names, email addresses or phone numbers. No input contains an email
address or a phone number; this was checked before copying, not assumed.

Input 4 needs no pseudonymisation because it has no original to protect — the names in it are
invented, not substituted. Nothing in it refers to a real person, a real district or a real price.

## Duration

Durations for inputs 1 and 2 come from the transcription run metadata, which records audio length
directly. Input 4 has no duration at all, because it has no recording — see above.

Input 3's duration comes from the scrape's video metadata, whose third column is undocumented. It is
recorded here as seconds on the strength of a check rather than an assumption: a sibling row in the
same file carries `985` and that video's own chapter list ends at `15:46`, which is only consistent
with a 16:25 runtime. Same column, same units, so `425` is 7:05.

Note that duration is metadata **about** the recording, not a claim extracted **from** the
transcript — same category as `bytes` and `sha256`. A transcript does not state its own length. See
`reference/field-definitions.md` for why that distinction is load-bearing.
