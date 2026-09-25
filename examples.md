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

## The complete pairs — full input, full output, nothing excerpted

Everything below this section (starting at Example 1) is a field-level excerpt: real, but cropped to
the field being discussed. This section is the opposite — for three of the four shipped inputs, the
entire input file and the entire output card, so there is more than one place in this document where
nothing has been left out.

**Which three, and why.** Four inputs ship in `inputs/`. Measured directly:

```bash
wc -c inputs/*.txt
```

```
    1441 inputs/04-pricing-objection.txt
    2657 inputs/01-mobile-app-setup.txt
    6713 inputs/02-desktop-setup.txt
    7573 inputs/03-mcp-walkthrough.txt
```

Three pairs are shown below, picked to differ from each other on more than size:

- **`04-pricing-objection`** (1,441 bytes, Pair 1) — the smallest input, and the only two-party
  dialogue of the three.
- **`01-mobile-app-setup`** (2,657 bytes, Pair 2) — a single-narrator monologue instead of a dialogue,
  with `source.duration_seconds` populated, which neither other pair here has.
- **`02-desktop-setup`** (6,713 bytes, Pair 3) — the only one of the three with both a populated
  `speakers[]` and a populated `definitions[]` on the same card.

`03-mcp-walkthrough` (7,573 bytes) is not reproduced as a full pair here — it is the largest of the
four inputs and would make this page mostly JSON. Its distinguishing content, a name shipped mangled
exactly as mis-heard, is already shown as a checkable excerpt in Example 5 below.

Every card embedded below is the **exact bytes currently on disk** — not reflowed, not reformatted —
**with one guaranteed exception: `generated_utc`.** That field is the wall clock at write time, so the
moment you run `node checker/convert.mjs` yourself, your copy of each card will differ from the block
below on exactly that one line and nowhere else. `reference/format-spec.md` documents the same
exception. To see it for yourself:

```bash
node checker/convert.mjs
git diff -U0 -- cards/ | grep -c generated_utc   # the count of changed lines
git diff -U0 -- cards/ | grep -v generated_utc | grep -cE '^[+-][^+-]'   # 0 — nothing else moved
```

Each pair states its own measured byte counts and hashes, and a diff between the fenced block and the
real file was run before this page was saved (see the report for this work package). If the checker or
a card regenerates after this page is saved, the numbers here will drift from disk again — that is
inherent to embedding a generated artifact in prose, and the fix is the same each time: re-run the
`wc -c` / `shasum` commands above and re-copy the file, not hand-edit a number.

---

### Pair 1 — `04-pricing-objection`

**Why this one:**

- **Smallest input** (1,441 bytes) — short enough to read in full on this page without turning it into a scroll of its own.
- It is the only **two-party dialogue** of the three pairs shown here (`speakers[]` has two entries), and its numbers include a mid-sentence self-correction ("$5,000, sorry, $5,800") that exercises unit attachment on a harder sentence than a plain statement would.
- It is also the synthetic input described in `inputs/PROVENANCE.md` — a hand-written two-party argument, shipped specifically to test the translator outside its declared single-narrator profile. That is disclosed there, not hidden here.

**Input byte count and hash, measured directly:**

```bash
wc -c < inputs/04-pricing-objection.txt
shasum -a 256 inputs/04-pricing-objection.txt
```

```
1441
32f1fb1ba10b4d423ff83f4a23f3db1fe8faed22a13176444cd4ebc817e34460  inputs/04-pricing-objection.txt
```

1,441 bytes, sha256 `32f1fb1ba10b4d423ff83f4a23f3db1fe8faed22a13176444cd4ebc817e34460` — matches `source.sha256` in the card below and the row for this input in `inputs/sha256sums.txt`.

**The literal input** — the whole file, byte for byte, one unbroken line with a trailing newline (that is the real shape of the source; see `inputs/PROVENANCE.md`):

```text
Okay, we're recording. I'm Dana, I run onboarding here. And I'm Tomas, I'm on the finance side. So the reason I pulled this meeting is the pilot recap deck says we onboarded forty-two schools last quarter and I don't think that number is right. It is right. I built that slide off the provisioning export. Then the provisioning export is wrong, because I closed twenty-nine contracts and you cannot onboard a school that has not signed anything. Some of those forty-two were trial seats that never converted. That is the gap. Right, but the deck does not say trial anywhere, it says onboarded, and the board is going to read that as revenue. Okay, that is fair. We quoted the district $5,000, sorry, $5,800 per site, and at forty-two sites that is a number nobody can support. Let's go ahead and park the pricing for a second. No, I do not want to park it, because the renewal email goes out Thursday and it quotes the same figure. Check the invoice from August, it has the real one on it. I did check it. The invoice says $5,800 and the deck says $5,000, which is the whole reason I am raising this now. Fine. Then we correct the deck. We are not correcting the deck two days before the board reads it, we are correcting the email. Both. We correct both. I still think forty-two is defensible if we footnote it as trials. I do not agree with that, and I want it on the record that I do not agree. Noted. Anything else? No. Thanks everyone.

```

**Output card byte count and hash, measured directly:**

```bash
wc -c < cards/04-pricing-objection.card.json
shasum -a 256 cards/04-pricing-objection.card.json
```

```
7183
c41520225d836b7473297be038921efcbd5006685ed7c597ad2284836fb01f99  cards/04-pricing-objection.card.json
```

**The literal output card** — `cards/04-pricing-objection.card.json`, 7,183 bytes measured with `wc -c < cards/04-pricing-objection.card.json`. These are the exact bytes on disk, copied in, not reformatted — the indentation and line breaks below are the file's own:

<details>
<summary>Exact contents of <code>cards/04-pricing-objection.card.json</code> (7,183 bytes) — click to expand</summary>

```json
{
  "schema": "lesson-card.v1",
  "profile": "lesson-card.v1",
  "generated_utc": "2026-09-25T03:20:48Z",
  "source": {
    "file": "inputs/04-pricing-objection.txt",
    "sha256": "32f1fb1ba10b4d423ff83f4a23f3db1fe8faed22a13176444cd4ebc817e34460",
    "bytes": 1441,
    "duration_seconds": "not in source"
  },
  "title": "not in source",
  "speakers": [
    {
      "name": {
        "text": "Dana",
        "span": {
          "start": 27,
          "end": 31
        }
      },
      "evidence": {
        "text": "I'm Dana",
        "span": {
          "start": 23,
          "end": 31
        }
      }
    },
    {
      "name": {
        "text": "Tomas",
        "span": {
          "start": 64,
          "end": 69
        }
      },
      "evidence": {
        "text": "I'm Tomas",
        "span": {
          "start": 60,
          "end": 69
        }
      }
    }
  ],
  "claims": [
    {
      "text": "I'm Dana, I run onboarding here.",
      "span": {
        "start": 23,
        "end": 55
      }
    },
    {
      "text": "And I'm Tomas, I'm on the finance side.",
      "span": {
        "start": 56,
        "end": 95
      }
    },
    {
      "text": "So the reason I pulled this meeting is the pilot recap deck says we onboarded forty-two schools last quarter and I don't think that number is right.",
      "span": {
        "start": 96,
        "end": 244
      }
    },
    {
      "text": "I built that slide off the provisioning export.",
      "span": {
        "start": 258,
        "end": 305
      }
    },
    {
      "text": "Some of those forty-two were trial seats that never converted.",
      "span": {
        "start": 446,
        "end": 508
      }
    },
    {
      "text": "Right, but the deck does not say trial anywhere, it says onboarded, and the board is going to read that as revenue.",
      "span": {
        "start": 526,
        "end": 641
      }
    },
    {
      "text": "We quoted the district $5,000, sorry, $5,800 per site, and at forty-two sites that is a number nobody can support.",
      "span": {
        "start": 662,
        "end": 776
      }
    },
    {
      "text": "No, I do not want to park it, because the renewal email goes out Thursday and it quotes the same figure.",
      "span": {
        "start": 827,
        "end": 931
      }
    },
    {
      "text": "The invoice says $5,800 and the deck says $5,000, which is the whole reason I am raising this now.",
      "span": {
        "start": 1006,
        "end": 1104
      }
    },
    {
      "text": "We are not correcting the deck two days before the board reads it, we are correcting the email.",
      "span": {
        "start": 1137,
        "end": 1232
      }
    },
    {
      "text": "I still think forty-two is defensible if we footnote it as trials.",
      "span": {
        "start": 1256,
        "end": 1322
      }
    },
    {
      "text": "I do not agree with that, and I want it on the record that I do not agree.",
      "span": {
        "start": 1323,
        "end": 1397
      }
    }
  ],
  "definitions": "not in source",
  "numbers": [
    {
      "value": {
        "text": "$5,000,",
        "span": {
          "start": 685,
          "end": 692
        }
      },
      "unit": "not in source"
    },
    {
      "value": {
        "text": "$5,800",
        "span": {
          "start": 700,
          "end": 706
        }
      },
      "unit": {
        "text": "per site",
        "span": {
          "start": 707,
          "end": 715
        }
      }
    },
    {
      "value": {
        "text": "$5,800",
        "span": {
          "start": 1023,
          "end": 1029
        }
      },
      "unit": "not in source"
    },
    {
      "value": {
        "text": "$5,000,",
        "span": {
          "start": 1048,
          "end": 1055
        }
      },
      "unit": "not in source"
    }
  ],
  "entities": [
    {
      "name": {
        "text": "Thursday",
        "span": {
          "start": 892,
          "end": 900
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "August",
        "span": {
          "start": 955,
          "end": 961
        }
      },
      "kind": "unknown",
      "role": "not in source"
    }
  ],
  "steps": [
    {
      "index": 1,
      "action": {
        "text": "Then the provisioning export is wrong, because I closed twenty-nine contracts and you cannot onboard a school that has not signed anything.",
        "span": {
          "start": 306,
          "end": 445
        }
      }
    },
    {
      "index": 2,
      "action": {
        "text": "Let's go ahead and park the pricing for a second.",
        "span": {
          "start": 777,
          "end": 826
        }
      }
    },
    {
      "index": 3,
      "action": {
        "text": "Check the invoice from August, it has the real one on it.",
        "span": {
          "start": 932,
          "end": 989
        }
      }
    },
    {
      "index": 4,
      "action": {
        "text": "Then we correct the deck.",
        "span": {
          "start": 1111,
          "end": 1136
        }
      }
    }
  ],
  "unmapped": [
    {
      "text": "Okay, we're recording.",
      "span": {
        "start": 0,
        "end": 22
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "It is right.",
      "span": {
        "start": 245,
        "end": 257
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "That is the gap.",
      "span": {
        "start": 509,
        "end": 525
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Okay, that is fair.",
      "span": {
        "start": 642,
        "end": 661
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "I did check it.",
      "span": {
        "start": 990,
        "end": 1005
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Fine.",
      "span": {
        "start": 1105,
        "end": 1110
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Both.",
      "span": {
        "start": 1233,
        "end": 1238
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "We correct both.",
      "span": {
        "start": 1239,
        "end": 1255
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Noted.",
      "span": {
        "start": 1398,
        "end": 1404
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Anything else?",
      "span": {
        "start": 1405,
        "end": 1419
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "No.",
      "span": {
        "start": 1420,
        "end": 1423
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Thanks everyone.",
      "span": {
        "start": 1424,
        "end": 1440
      },
      "reason": "below-extraction-threshold"
    }
  ],
  "coverage": {
    "total_bytes": 1441,
    "covered_bytes": 1413,
    "pct": 98.06,
    "unmapped_threshold_bytes": 32
  }
}

```

</details>

**Read the pair — four fields, their spans, and the commands that pull them**

Every command below was run from the repo root and its output is pasted exactly, not retyped.

**1. `speakers[0].name`** — value `Dana`, span `27–31`:

```bash
dd if=inputs/04-pricing-objection.txt bs=1 skip=27 count=4 2>/dev/null; echo
```
```
Dana
```

**2. `speakers[0].evidence`** — value `I'm Dana`, span `23–31`. This is the field that makes the
name checkable rather than asserted — it points at the phrase that established it, not just the
name itself:

```bash
dd if=inputs/04-pricing-objection.txt bs=1 skip=23 count=8 2>/dev/null; echo
```
```
I'm Dana
```

**3. `numbers[0].unit` vs `numbers[1].unit`** — the sentence is a self-correction: "We quoted the
district $5,000, sorry, $5,800 per site". "Per site" sits right after `$5,800`, the figure that
stands, and does not grammatically reach back to `$5,000`, the figure the speaker corrected away.
The card now reflects exactly that split — `numbers[0]` (`$5,000,`) carries `"unit": "not in
source"`, and `numbers[1]` (`$5,800`) carries a real `unit` with its own span:

```bash
dd if=inputs/04-pricing-objection.txt bs=1 skip=700 count=6 2>/dev/null; echo   # numbers[1].value
dd if=inputs/04-pricing-objection.txt bs=1 skip=707 count=8 2>/dev/null; echo   # numbers[1].unit
```
```
$5,800
per site
```

This is a change from an earlier version of this page, which showed both figures as
`"unit": "not in source"`. The checker was hardened since then and now extracts a stated unit when
it is grammatically adjacent to the number it modifies, instead of declaring it absent by default.
`numbers[0]` still correctly gets no unit — "per site" does not attach to the corrected-away figure
— so the discipline from the earlier version (no guessing) is intact; what changed is that a present,
adjacent unit is no longer thrown away along with it.

**4. `unmapped[0]`** — value `"Okay, we're recording."`, span `0–22`, reason
`below-extraction-threshold`:

```bash
dd if=inputs/04-pricing-objection.txt bs=1 skip=0 count=22 2>/dev/null; echo
```
```
Okay, we're recording.
```

This is the opening line of the transcript — true, but not a claim, a step, a number, or a
definition, so the card names it and moves on instead of forcing it into a field it does not belong
in. Eleven other spans get the same treatment; together with the field above, this is the same
"absent marker" and "named gap" pattern documented in Examples 4 and 6, shown here on one small card
end to end instead of split across two excerpts.

**Round-trip check:**

```bash
node checker/verify-traces.mjs cards/04-pricing-objection.card.json
```

Real output, this run:

```
TRACES VERIFIED — cards/04-pricing-objection.card.json. 0 problems.

All 1 card(s) verified against their inputs.
```

Exit code: `0`.

---

### Pair 2 — `01-mobile-app-setup`

**Why this one:**

- **Second-smallest input** (2,657 bytes) and the only **single-narrator monologue** of the three — no `speakers[]`, which is a real contrast to Pair 1's two-party dialogue.
- The only one of the three with a populated `source.duration_seconds` (161 seconds instead of `"not in source"`), which exercises a field the other two pairs on this page leave empty.
- Carries the largest `steps[]` list of the three pairs (17 entries) and a 9-item `unmapped[]` list, both already discussed as field excerpts in Examples 1 and 6 below — this pair shows them in the full card those excerpts were cut from.

**Input byte count and hash, measured directly:**

```bash
wc -c < inputs/01-mobile-app-setup.txt
shasum -a 256 inputs/01-mobile-app-setup.txt
```

```
2657
df4afc2facfd01252efb2e4103bcf523946249b7566c2e430800e1d89954cca8  inputs/01-mobile-app-setup.txt
```

2,657 bytes, sha256 `df4afc2facfd01252efb2e4103bcf523946249b7566c2e430800e1d89954cca8` — matches `source.sha256` in the card below and the row for this input in `inputs/sha256sums.txt`.

**The literal input** — the whole file, byte for byte, one unbroken line with a trailing newline (that is the real shape of the source; see `inputs/PROVENANCE.md`):

<details>
<summary>Full contents of <code>inputs/01-mobile-app-setup.txt</code> (2,657 bytes) — click to expand</summary>

```text
How do you set this up inside of your mobile device? The first thing is to click the link that is underneath this video. It's going to take you to a page that looks just like this. And the next thing is to continue with Google or put your email and you will receive a code. All you have to do is just copy and paste it. Continue with Google. We select the same account. We suggest you use the same school email account so you're not jiggling through multiple accounts. That we can continue with Google. And the next thing is to upload a photo of us. Enter our name and our username. If you don't know where that is, you can simply click this button right here. We can zoom into the page. And as you can see, it will be right underneath your profile name. And after that, it's going to ask us a couple questions. And this is going to help our AI recommend the right strategies for your current stage. Because what works for a person that is making $5,000 a month right now, it's not the same strategy that a person that is making $50,000 need. So we can go ahead and click that. Click next. And just like that, we will submit a profile. And it's going to ask us if we are on mobile or in a computer. In this case, we are on a phone. We can click continue. And just like that, we're going to have access to the personalized roadmap and our profile details. But this looks too clunky and we don't want to have this inside of our phone. So what we can do is just click that share button right in the middle. Scroll a little bit. Add to home screen. Just click add. Add. And just like that, we are now going to have this in our mobile without needing to have a app to download. You can access your profile details. You can see all the communities that you are in. And you can also ask the AI chat button any questions that you have. So the first thing is to watch this video. We can go ahead and open the community and it's going to redirect us to either a post or ask us to make a post. So we can click open community. And in this case, I have already done that. So what I need to do is to copy the link. Paste it here. Verify comment. You see the comment has already been verified. I can click complete. And just like that, I can continue with the roadmap inside of my phone. If you have any questions, feel free to let us know. We are happy to help you out. This mobile version is still under development. So if you spot any issues, feel free to let us know. We are happy to help and get you on track as soon as possible. I wish you the best of luck. Ask anything to the AI agent. Get started with the roadmap. And I'll see you inside of the community. Ciao.

```

</details>

**Output card byte count and hash, measured directly:**

```bash
wc -c < cards/01-mobile-app-setup.card.json
shasum -a 256 cards/01-mobile-app-setup.card.json
```

```
10622
59d62976fc98302ba3fc6c449bf2f2d5a90152acbda4eef447f6b2eeb7fa1787  cards/01-mobile-app-setup.card.json
```

**The literal output card** — `cards/01-mobile-app-setup.card.json`, 10,622 bytes measured with `wc -c < cards/01-mobile-app-setup.card.json`. These are the exact bytes on disk, copied in, not reformatted — the indentation and line breaks below are the file's own:

<details>
<summary>Exact contents of <code>cards/01-mobile-app-setup.card.json</code> (10,622 bytes) — click to expand</summary>

```json
{
  "schema": "lesson-card.v1",
  "profile": "lesson-card.v1",
  "generated_utc": "2026-09-25T03:20:48Z",
  "source": {
    "file": "inputs/01-mobile-app-setup.txt",
    "sha256": "df4afc2facfd01252efb2e4103bcf523946249b7566c2e430800e1d89954cca8",
    "bytes": 2657,
    "duration_seconds": 161
  },
  "title": "not in source",
  "speakers": "not in source",
  "claims": [
    {
      "text": "How do you set this up inside of your mobile device?",
      "span": {
        "start": 0,
        "end": 52
      }
    },
    {
      "text": "It's going to take you to a page that looks just like this.",
      "span": {
        "start": 121,
        "end": 180
      }
    },
    {
      "text": "All you have to do is just copy and paste it.",
      "span": {
        "start": 274,
        "end": 319
      }
    },
    {
      "text": "We suggest you use the same school email account so you're not jiggling through multiple accounts.",
      "span": {
        "start": 370,
        "end": 468
      }
    },
    {
      "text": "That we can continue with Google.",
      "span": {
        "start": 469,
        "end": 502
      }
    },
    {
      "text": "If you don't know where that is, you can simply click this button right here.",
      "span": {
        "start": 583,
        "end": 660
      }
    },
    {
      "text": "We can zoom into the page.",
      "span": {
        "start": 661,
        "end": 687
      }
    },
    {
      "text": "And as you can see, it will be right underneath your profile name.",
      "span": {
        "start": 688,
        "end": 754
      }
    },
    {
      "text": "And after that, it's going to ask us a couple questions.",
      "span": {
        "start": 755,
        "end": 811
      }
    },
    {
      "text": "And this is going to help our AI recommend the right strategies for your current stage.",
      "span": {
        "start": 812,
        "end": 899
      }
    },
    {
      "text": "Because what works for a person that is making $5,000 a month right now, it's not the same strategy that a person that is making $50,000 need.",
      "span": {
        "start": 900,
        "end": 1042
      }
    },
    {
      "text": "And it's going to ask us if we are on mobile or in a computer.",
      "span": {
        "start": 1136,
        "end": 1198
      }
    },
    {
      "text": "In this case, we are on a phone.",
      "span": {
        "start": 1199,
        "end": 1231
      }
    },
    {
      "text": "But this looks too clunky and we don't want to have this inside of our phone.",
      "span": {
        "start": 1355,
        "end": 1432
      }
    },
    {
      "text": "So what we can do is just click that share button right in the middle.",
      "span": {
        "start": 1433,
        "end": 1503
      }
    },
    {
      "text": "You can access your profile details.",
      "span": {
        "start": 1673,
        "end": 1709
      }
    },
    {
      "text": "You can see all the communities that you are in.",
      "span": {
        "start": 1710,
        "end": 1758
      }
    },
    {
      "text": "And you can also ask the AI chat button any questions that you have.",
      "span": {
        "start": 1759,
        "end": 1827
      }
    },
    {
      "text": "So we can click open community.",
      "span": {
        "start": 1983,
        "end": 2014
      }
    },
    {
      "text": "And in this case, I have already done that.",
      "span": {
        "start": 2015,
        "end": 2058
      }
    },
    {
      "text": "So what I need to do is to copy the link.",
      "span": {
        "start": 2059,
        "end": 2100
      }
    },
    {
      "text": "You see the comment has already been verified.",
      "span": {
        "start": 2132,
        "end": 2178
      }
    },
    {
      "text": "If you have any questions, feel free to let us know.",
      "span": {
        "start": 2273,
        "end": 2325
      }
    },
    {
      "text": "We are happy to help you out.",
      "span": {
        "start": 2326,
        "end": 2355
      }
    },
    {
      "text": "This mobile version is still under development.",
      "span": {
        "start": 2356,
        "end": 2403
      }
    },
    {
      "text": "So if you spot any issues, feel free to let us know.",
      "span": {
        "start": 2404,
        "end": 2456
      }
    },
    {
      "text": "We are happy to help and get you on track as soon as possible.",
      "span": {
        "start": 2457,
        "end": 2519
      }
    },
    {
      "text": "Ask anything to the AI agent.",
      "span": {
        "start": 2549,
        "end": 2578
      }
    }
  ],
  "definitions": "not in source",
  "numbers": [
    {
      "value": {
        "text": "$5,000",
        "span": {
          "start": 947,
          "end": 953
        }
      },
      "unit": {
        "text": "a month",
        "span": {
          "start": 954,
          "end": 961
        }
      }
    },
    {
      "value": {
        "text": "$50,000",
        "span": {
          "start": 1029,
          "end": 1036
        }
      },
      "unit": "not in source"
    }
  ],
  "entities": [
    {
      "name": {
        "text": "Google",
        "span": {
          "start": 220,
          "end": 226
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "AI",
        "span": {
          "start": 842,
          "end": 844
        }
      },
      "kind": "unknown",
      "role": "not in source"
    }
  ],
  "steps": [
    {
      "index": 1,
      "action": {
        "text": "The first thing is to click the link that is underneath this video.",
        "span": {
          "start": 53,
          "end": 120
        }
      }
    },
    {
      "index": 2,
      "action": {
        "text": "And the next thing is to continue with Google or put your email and you will receive a code.",
        "span": {
          "start": 181,
          "end": 273
        }
      }
    },
    {
      "index": 3,
      "action": {
        "text": "Continue with Google.",
        "span": {
          "start": 320,
          "end": 341
        }
      }
    },
    {
      "index": 4,
      "action": {
        "text": "And the next thing is to upload a photo of us.",
        "span": {
          "start": 503,
          "end": 549
        }
      }
    },
    {
      "index": 5,
      "action": {
        "text": "Enter our name and our username.",
        "span": {
          "start": 550,
          "end": 582
        }
      }
    },
    {
      "index": 6,
      "action": {
        "text": "So we can go ahead and click that.",
        "span": {
          "start": 1043,
          "end": 1077
        }
      }
    },
    {
      "index": 7,
      "action": {
        "text": "Click next.",
        "span": {
          "start": 1078,
          "end": 1089
        }
      }
    },
    {
      "index": 8,
      "action": {
        "text": "And just like that, we will submit a profile.",
        "span": {
          "start": 1090,
          "end": 1135
        }
      }
    },
    {
      "index": 9,
      "action": {
        "text": "And just like that, we're going to have access to the personalized roadmap and our profile details.",
        "span": {
          "start": 1255,
          "end": 1354
        }
      }
    },
    {
      "index": 10,
      "action": {
        "text": "Scroll a little bit.",
        "span": {
          "start": 1504,
          "end": 1524
        }
      }
    },
    {
      "index": 11,
      "action": {
        "text": "Add to home screen.",
        "span": {
          "start": 1525,
          "end": 1544
        }
      }
    },
    {
      "index": 12,
      "action": {
        "text": "Add.",
        "span": {
          "start": 1561,
          "end": 1565
        }
      }
    },
    {
      "index": 13,
      "action": {
        "text": "And just like that, we are now going to have this in our mobile without needing to have a app to download.",
        "span": {
          "start": 1566,
          "end": 1672
        }
      }
    },
    {
      "index": 14,
      "action": {
        "text": "So the first thing is to watch this video.",
        "span": {
          "start": 1828,
          "end": 1870
        }
      }
    },
    {
      "index": 15,
      "action": {
        "text": "We can go ahead and open the community and it's going to redirect us to either a post or ask us to make a post.",
        "span": {
          "start": 1871,
          "end": 1982
        }
      }
    },
    {
      "index": 16,
      "action": {
        "text": "Paste it here.",
        "span": {
          "start": 2101,
          "end": 2115
        }
      }
    },
    {
      "index": 17,
      "action": {
        "text": "And just like that, I can continue with the roadmap inside of my phone.",
        "span": {
          "start": 2201,
          "end": 2272
        }
      }
    }
  ],
  "unmapped": [
    {
      "text": "We select the same account.",
      "span": {
        "start": 342,
        "end": 369
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "We can click continue.",
      "span": {
        "start": 1232,
        "end": 1254
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Just click add.",
      "span": {
        "start": 1545,
        "end": 1560
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Verify comment.",
      "span": {
        "start": 2116,
        "end": 2131
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "I can click complete.",
      "span": {
        "start": 2179,
        "end": 2200
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "I wish you the best of luck.",
      "span": {
        "start": 2520,
        "end": 2548
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "Get started with the roadmap.",
      "span": {
        "start": 2579,
        "end": 2608
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "And I'll see you inside of the community.",
      "span": {
        "start": 2609,
        "end": 2650
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "Ciao.",
      "span": {
        "start": 2651,
        "end": 2656
      },
      "reason": "no-field-for-this-content"
    }
  ],
  "coverage": {
    "total_bytes": 2657,
    "covered_bytes": 2603,
    "pct": 97.97,
    "unmapped_threshold_bytes": 32
  }
}

```

</details>

**What this pair shows that Pair 1 does not.** `source.duration_seconds` is populated here (`161`) instead of `"not in source"` — check it directly:

```bash
python3 -c "import json; print(json.load(open('cards/01-mobile-app-setup.card.json'))['source'])"
```
```
{'file': 'inputs/01-mobile-app-setup.txt', 'sha256': 'df4afc2facfd01252efb2e4103bcf523946249b7566c2e430800e1d89954cca8', 'bytes': 2657, 'duration_seconds': 161}
```

`speakers`, `definitions`, and `title` are all `"not in source"` on this card — it is a single-narrator monologue, not a dialogue, so there is no second voice to attribute and no self-introduction to quote. It also carries the longest `steps[]` list of the three pairs on this page (17 entries) and is the source of the number-with-unit / number-without-unit contrast already walked through in Example 1 below, and the nine-item `unmapped[]` list walked through in Example 6.

**Round-trip check:**

```bash
node checker/verify-traces.mjs cards/01-mobile-app-setup.card.json
```

Real output, this run:

```
TRACES VERIFIED — cards/01-mobile-app-setup.card.json. 0 problems.

All 1 card(s) verified against their inputs.
```

Exit code: `0`.

---

### Pair 3 — `02-desktop-setup`

**Why this one:**

- The only one of the three pairs shown here with both a populated `speakers[]` **and** a populated `definitions[]` entry on the same card — Pair 1 has speakers but no definitions, Pair 2 has neither.
- Carries the largest `entities[]` list of the three (10 entries).
- Its speaker (`Marco Salas`) and its `Dexter` definition are the exact fields already quoted as a field excerpt in Example 3 below; this pair is the complete card that excerpt comes from.

**Input byte count and hash, measured directly:**

```bash
wc -c < inputs/02-desktop-setup.txt
shasum -a 256 inputs/02-desktop-setup.txt
```

```
6713
f75026476f201a7ff3c161a72875cc0538c440728c9133efa0727711c9ac2e7c  inputs/02-desktop-setup.txt
```

6,713 bytes, sha256 `f75026476f201a7ff3c161a72875cc0538c440728c9133efa0727711c9ac2e7c` — matches `source.sha256` in the card below and the row for this input in `inputs/sha256sums.txt`.

**The literal input** — the whole file, byte for byte, one unbroken line with a trailing newline (that is the real shape of the source; see `inputs/PROVENANCE.md`):

<details>
<summary>Full contents of <code>inputs/02-desktop-setup.txt</code> (6,713 bytes) — click to expand</summary>

```text
Hello everyone, my name is Marco Salas and I'm the co-founder of Dexter, which is a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom, plus a roadmap that is going to guide you step by step on the things that you need to do in order for you to find success inside of this community. The AI agent is also going to be your accountability coach that is going to be there whenever you're falling off, you're not completing the steps or are confused on the things that you need to do next. And in this video, I want to show you how to set it up, plus how to get access to the AI agent once you have been on board. Now, the next thing is to find this link. You will probably find it somewhere in the community. Now, let's create an account. You can use a regular email for this. You would get a code inside of your email. Check your spam, put it in here and you will be able to proceed. But for quick access, we're going to continue with Google. We're going to create an account. We're going to click continue and it's going to ask us a couple of questions. All these questions are there to help the agent understand a little bit more about your journey, where you're currently at and what are your goals. So it can help you and pinpoint you to the right resources and videos that are inside of the classroom. This is an example, but let's click submit. And now it's going to create a profile of you and it's going to tell the AI agent that is now inside of the community who you are, what's your goal and what you would like to do inside of this classroom. Now, it's going to ask you if you are in a computer or a phone. In this video, I'm going to show you how to set it up in the computer. But there's going to be another video on how to set it up inside of your phone as well. Now, let's go ahead and click computer. It's going to ask us to download the extension and click add to Chrome, add extension. It's going to ask us to pin it so we can go ahead, pin it in here. Oops, that's the other one. And we're going to open. Now, mind you, I highly recommend you to create the account with the same email you use for your school community. That way you're not managing multiple accounts. And in case you forget, you always know that it's the same one as your school account. We're going to continue with Google once again. And now you're going to see access to all the communities you belong. In this case, it will be Cliff Notes. But if you belong to any other communities on Dexter, you will also be able to see it and find it right there. And now you will see a widget to the side of the screen. You can open it and you can get access to the roadmap as well as the chatbot plus your profile details. Now, in the profile details, you can modify essentially the role, the experience or your goal if at some point it changes. So the AI agent is up to date with the latest version of your journey. Now, let's go ahead and ask the chatbot a specific question. What are the first things that I need to do in order to find success inside of this community? Right now, it's start with two things. Understand the structure. Get your hands on the tool. So once I finish, I want to show you where it's taking me. Now, the first thing is, is telling me to go to navigating the course. Now, this is because I need to understand how this community works. And essentially, it's going to guide me through that process. But the more questions I have, the more I talk to it, the more it's going to understand about us. And it's going to redirect us to the right place. And the second step is to get my hands on the tool so I can go ahead and click on this lesson. And as you can see, it's guiding me through this process. I can also open the tool. And if at some point I have a question about the specific lesson, I can say, how does this lesson actually apply to me? And it's going to take a look at our profile details plus what's inside of the lesson. And it's going to give us a personalized walkthrough based on what we currently need. Right. So how it applies to you specifically, you want to build a school dashboard using Dexter MCP to automate posts, scripts, DMs, and pipelines. To do that, we need Claude, the Claude desktop, cursor, and essentially, you know, all the stuff that I also need. Your folder structure. And of course, I can keep on reading this and perhaps ask further questions ahead. Now, there is also the roadmap, which is awesome for you to get started and know exactly what are the lessons that you need to watch or what are the stuff that you need to do in order to keep yourself accountable. Also, share the journey with the members and test your knowledge through the quizzes. So as you can see, there is a step, but we also have access to more roadmaps in here. So if you're still in that beginning phase with the foundations, I highly recommend you to take a look at this roadmap. And there are other roadmaps down below that you can also get started. For example, let's go ahead and jump with the foundation. We're going to click continue. It's going to redirect us to this specific lesson. And the first task is to create a post after watching this video where we're going to reflect on where is our AI journey right now. Now, all of these instructions and the post template might change, but I just want to show you how will this actually work at play. I'm going to create a post. We're going to copy this title, put it in here, delete this part, put our name, Marco. And I can also go ahead, further customize this post. I can post it in general and I can create post. And just like that, the task has now been completed. And now I can move to the next task, which is a small quiz. Now, all of these questions are going to be based on what has been covered inside of the video. So you can go ahead, take a look at the video first and then proceed to answer the question. So let me just give it a quick try. Now we're going to submit the quiz and it's going to evaluate our answers. You can see I got all of them right, which is surprisingly, I watched half through the video. But then you can go ahead, read the feedback that is giving you if you got them wrong and proceed to click done. After that, you can click continue and then you're going to be redirected to the next task. That is it for right now. Right underneath this lesson, there's going to be a post where you can ask us any questions. If there is any issues, any bugs, feel free to let us know. I want to see you crushing it. I want to see you succeed. And I want to see you in the community as well. See you soon. Ciao.

```

</details>

**Output card byte count and hash, measured directly:**

```bash
wc -c < cards/02-desktop-setup.card.json
shasum -a 256 cards/02-desktop-setup.card.json
```

```
19839
9f33c48d077768bc702168ded82c078c44e4cbb0628665b444a20dd5ce6c636d  cards/02-desktop-setup.card.json
```

**The literal output card** — `cards/02-desktop-setup.card.json`, 19,839 bytes measured with `wc -c < cards/02-desktop-setup.card.json`. These are the exact bytes on disk, copied in, not reformatted — the indentation and line breaks below are the file's own:

<details>
<summary>Exact contents of <code>cards/02-desktop-setup.card.json</code> (19,839 bytes) — click to expand</summary>

```json
{
  "schema": "lesson-card.v1",
  "profile": "lesson-card.v1",
  "generated_utc": "2026-09-25T03:20:48Z",
  "source": {
    "file": "inputs/02-desktop-setup.txt",
    "sha256": "f75026476f201a7ff3c161a72875cc0538c440728c9133efa0727711c9ac2e7c",
    "bytes": 6713,
    "duration_seconds": 391.6
  },
  "title": "not in source",
  "speakers": [
    {
      "name": {
        "text": "Marco Salas",
        "span": {
          "start": 27,
          "end": 38
        }
      },
      "evidence": {
        "text": "my name is Marco Salas",
        "span": {
          "start": 16,
          "end": 38
        }
      }
    }
  ],
  "claims": [
    {
      "text": "The AI agent is also going to be your accountability coach that is going to be there whenever you're falling off, you're not completing the steps or are confused on the things that you need to do next.",
      "span": {
        "start": 389,
        "end": 590
      }
    },
    {
      "text": "And in this video, I want to show you how to set it up, plus how to get access to the AI agent once you have been on board.",
      "span": {
        "start": 591,
        "end": 714
      }
    },
    {
      "text": "Now, the next thing is to find this link.",
      "span": {
        "start": 715,
        "end": 756
      }
    },
    {
      "text": "You will probably find it somewhere in the community.",
      "span": {
        "start": 757,
        "end": 810
      }
    },
    {
      "text": "You can use a regular email for this.",
      "span": {
        "start": 841,
        "end": 878
      }
    },
    {
      "text": "You would get a code inside of your email.",
      "span": {
        "start": 879,
        "end": 921
      }
    },
    {
      "text": "But for quick access, we're going to continue with Google.",
      "span": {
        "start": 987,
        "end": 1045
      }
    },
    {
      "text": "We're going to create an account.",
      "span": {
        "start": 1046,
        "end": 1079
      }
    },
    {
      "text": "We're going to click continue and it's going to ask us a couple of questions.",
      "span": {
        "start": 1080,
        "end": 1157
      }
    },
    {
      "text": "All these questions are there to help the agent understand a little bit more about your journey, where you're currently at and what are your goals.",
      "span": {
        "start": 1158,
        "end": 1305
      }
    },
    {
      "text": "So it can help you and pinpoint you to the right resources and videos that are inside of the classroom.",
      "span": {
        "start": 1306,
        "end": 1409
      }
    },
    {
      "text": "This is an example, but let's click submit.",
      "span": {
        "start": 1410,
        "end": 1453
      }
    },
    {
      "text": "And now it's going to create a profile of you and it's going to tell the AI agent that is now inside of the community who you are, what's your goal and what you would like to do inside of this classroom.",
      "span": {
        "start": 1454,
        "end": 1657
      }
    },
    {
      "text": "Now, it's going to ask you if you are in a computer or a phone.",
      "span": {
        "start": 1658,
        "end": 1721
      }
    },
    {
      "text": "In this video, I'm going to show you how to set it up in the computer.",
      "span": {
        "start": 1722,
        "end": 1792
      }
    },
    {
      "text": "But there's going to be another video on how to set it up inside of your phone as well.",
      "span": {
        "start": 1793,
        "end": 1880
      }
    },
    {
      "text": "It's going to ask us to download the extension and click add to Chrome, add extension.",
      "span": {
        "start": 1921,
        "end": 2007
      }
    },
    {
      "text": "It's going to ask us to pin it so we can go ahead, pin it in here.",
      "span": {
        "start": 2008,
        "end": 2074
      }
    },
    {
      "text": "Now, mind you, I highly recommend you to create the account with the same email you use for your school community.",
      "span": {
        "start": 2128,
        "end": 2242
      }
    },
    {
      "text": "That way you're not managing multiple accounts.",
      "span": {
        "start": 2243,
        "end": 2290
      }
    },
    {
      "text": "And in case you forget, you always know that it's the same one as your school account.",
      "span": {
        "start": 2291,
        "end": 2377
      }
    },
    {
      "text": "We're going to continue with Google once again.",
      "span": {
        "start": 2378,
        "end": 2425
      }
    },
    {
      "text": "And now you're going to see access to all the communities you belong.",
      "span": {
        "start": 2426,
        "end": 2495
      }
    },
    {
      "text": "In this case, it will be Cliff Notes.",
      "span": {
        "start": 2496,
        "end": 2533
      }
    },
    {
      "text": "But if you belong to any other communities on Dexter, you will also be able to see it and find it right there.",
      "span": {
        "start": 2534,
        "end": 2644
      }
    },
    {
      "text": "And now you will see a widget to the side of the screen.",
      "span": {
        "start": 2645,
        "end": 2701
      }
    },
    {
      "text": "You can open it and you can get access to the roadmap as well as the chatbot plus your profile details.",
      "span": {
        "start": 2702,
        "end": 2805
      }
    },
    {
      "text": "Now, in the profile details, you can modify essentially the role, the experience or your goal if at some point it changes.",
      "span": {
        "start": 2806,
        "end": 2928
      }
    },
    {
      "text": "So the AI agent is up to date with the latest version of your journey.",
      "span": {
        "start": 2929,
        "end": 2999
      }
    },
    {
      "text": "What are the first things that I need to do in order to find success inside of this community?",
      "span": {
        "start": 3061,
        "end": 3155
      }
    },
    {
      "text": "Right now, it's start with two things.",
      "span": {
        "start": 3156,
        "end": 3194
      }
    },
    {
      "text": "Get your hands on the tool.",
      "span": {
        "start": 3221,
        "end": 3248
      }
    },
    {
      "text": "So once I finish, I want to show you where it's taking me.",
      "span": {
        "start": 3249,
        "end": 3307
      }
    },
    {
      "text": "Now, the first thing is, is telling me to go to navigating the course.",
      "span": {
        "start": 3308,
        "end": 3378
      }
    },
    {
      "text": "Now, this is because I need to understand how this community works.",
      "span": {
        "start": 3379,
        "end": 3446
      }
    },
    {
      "text": "And essentially, it's going to guide me through that process.",
      "span": {
        "start": 3447,
        "end": 3508
      }
    },
    {
      "text": "But the more questions I have, the more I talk to it, the more it's going to understand about us.",
      "span": {
        "start": 3509,
        "end": 3606
      }
    },
    {
      "text": "And it's going to redirect us to the right place.",
      "span": {
        "start": 3607,
        "end": 3656
      }
    },
    {
      "text": "And the second step is to get my hands on the tool so I can go ahead and click on this lesson.",
      "span": {
        "start": 3657,
        "end": 3751
      }
    },
    {
      "text": "And as you can see, it's guiding me through this process.",
      "span": {
        "start": 3752,
        "end": 3809
      }
    },
    {
      "text": "I can also open the tool.",
      "span": {
        "start": 3810,
        "end": 3835
      }
    },
    {
      "text": "And if at some point I have a question about the specific lesson, I can say, how does this lesson actually apply to me?",
      "span": {
        "start": 3836,
        "end": 3955
      }
    },
    {
      "text": "And it's going to take a look at our profile details plus what's inside of the lesson.",
      "span": {
        "start": 3956,
        "end": 4042
      }
    },
    {
      "text": "And it's going to give us a personalized walkthrough based on what we currently need.",
      "span": {
        "start": 4043,
        "end": 4128
      }
    },
    {
      "text": "So how it applies to you specifically, you want to build a school dashboard using Dexter MCP to automate posts, scripts, DMs, and pipelines.",
      "span": {
        "start": 4136,
        "end": 4276
      }
    },
    {
      "text": "To do that, we need Claude, the Claude desktop, cursor, and essentially, you know, all the stuff that I also need.",
      "span": {
        "start": 4277,
        "end": 4391
      }
    },
    {
      "text": "And of course, I can keep on reading this and perhaps ask further questions ahead.",
      "span": {
        "start": 4415,
        "end": 4497
      }
    },
    {
      "text": "Now, there is also the roadmap, which is awesome for you to get started and know exactly what are the lessons that you need to watch or what are the stuff that you need to do in order to keep yourself accountable.",
      "span": {
        "start": 4498,
        "end": 4711
      }
    },
    {
      "text": "Also, share the journey with the members and test your knowledge through the quizzes.",
      "span": {
        "start": 4712,
        "end": 4797
      }
    },
    {
      "text": "So as you can see, there is a step, but we also have access to more roadmaps in here.",
      "span": {
        "start": 4798,
        "end": 4883
      }
    },
    {
      "text": "So if you're still in that beginning phase with the foundations, I highly recommend you to take a look at this roadmap.",
      "span": {
        "start": 4884,
        "end": 5003
      }
    },
    {
      "text": "And there are other roadmaps down below that you can also get started.",
      "span": {
        "start": 5004,
        "end": 5074
      }
    },
    {
      "text": "It's going to redirect us to this specific lesson.",
      "span": {
        "start": 5164,
        "end": 5214
      }
    },
    {
      "text": "And the first task is to create a post after watching this video where we're going to reflect on where is our AI journey right now.",
      "span": {
        "start": 5215,
        "end": 5346
      }
    },
    {
      "text": "Now, all of these instructions and the post template might change, but I just want to show you how will this actually work at play.",
      "span": {
        "start": 5347,
        "end": 5478
      }
    },
    {
      "text": "I'm going to create a post.",
      "span": {
        "start": 5479,
        "end": 5506
      }
    },
    {
      "text": "We're going to copy this title, put it in here, delete this part, put our name, Marco.",
      "span": {
        "start": 5507,
        "end": 5593
      }
    },
    {
      "text": "And I can also go ahead, further customize this post.",
      "span": {
        "start": 5594,
        "end": 5647
      }
    },
    {
      "text": "I can post it in general and I can create post.",
      "span": {
        "start": 5648,
        "end": 5695
      }
    },
    {
      "text": "And now I can move to the next task, which is a small quiz.",
      "span": {
        "start": 5749,
        "end": 5808
      }
    },
    {
      "text": "Now, all of these questions are going to be based on what has been covered inside of the video.",
      "span": {
        "start": 5809,
        "end": 5904
      }
    },
    {
      "text": "So let me just give it a quick try.",
      "span": {
        "start": 5998,
        "end": 6033
      }
    },
    {
      "text": "Now we're going to submit the quiz and it's going to evaluate our answers.",
      "span": {
        "start": 6034,
        "end": 6108
      }
    },
    {
      "text": "You can see I got all of them right, which is surprisingly, I watched half through the video.",
      "span": {
        "start": 6109,
        "end": 6202
      }
    },
    {
      "text": "That is it for right now.",
      "span": {
        "start": 6408,
        "end": 6433
      }
    },
    {
      "text": "Right underneath this lesson, there's going to be a post where you can ask us any questions.",
      "span": {
        "start": 6434,
        "end": 6526
      }
    },
    {
      "text": "If there is any issues, any bugs, feel free to let us know.",
      "span": {
        "start": 6527,
        "end": 6586
      }
    }
  ],
  "definitions": [
    {
      "term": {
        "text": "Dexter",
        "span": {
          "start": 65,
          "end": 71
        }
      },
      "definition": {
        "text": "a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom",
        "span": {
          "start": 82,
          "end": 239
        }
      }
    }
  ],
  "numbers": "not in source",
  "entities": [
    {
      "name": {
        "text": "Marco Salas",
        "span": {
          "start": 27,
          "end": 38
        }
      },
      "kind": "person",
      "role": {
        "text": "my name is Marco Salas",
        "span": {
          "start": 16,
          "end": 38
        }
      }
    },
    {
      "name": {
        "text": "Dexter",
        "span": {
          "start": 65,
          "end": 71
        }
      },
      "kind": "tool",
      "role": {
        "text": "a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom",
        "span": {
          "start": 82,
          "end": 239
        }
      }
    },
    {
      "name": {
        "text": "AI",
        "span": {
          "start": 164,
          "end": 166
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Google",
        "span": {
          "start": 1038,
          "end": 1044
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Chrome",
        "span": {
          "start": 1985,
          "end": 1991
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Cliff Notes",
        "span": {
          "start": 2521,
          "end": 2532
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Dexter MCP",
        "span": {
          "start": 4218,
          "end": 4228
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "DMs",
        "span": {
          "start": 4257,
          "end": 4260
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Claude",
        "span": {
          "start": 4297,
          "end": 4303
        }
      },
      "kind": "unknown",
      "role": "not in source"
    },
    {
      "name": {
        "text": "Marco",
        "span": {
          "start": 5587,
          "end": 5592
        }
      },
      "kind": "unknown",
      "role": "not in source"
    }
  ],
  "steps": [
    {
      "index": 1,
      "action": {
        "text": "Now, let's create an account.",
        "span": {
          "start": 811,
          "end": 840
        }
      }
    },
    {
      "index": 2,
      "action": {
        "text": "Check your spam, put it in here and you will be able to proceed.",
        "span": {
          "start": 922,
          "end": 986
        }
      }
    },
    {
      "index": 3,
      "action": {
        "text": "Now, let's go ahead and click computer.",
        "span": {
          "start": 1881,
          "end": 1920
        }
      }
    },
    {
      "index": 4,
      "action": {
        "text": "Now, let's go ahead and ask the chatbot a specific question.",
        "span": {
          "start": 3000,
          "end": 3060
        }
      }
    },
    {
      "index": 5,
      "action": {
        "text": "For example, let's go ahead and jump with the foundation.",
        "span": {
          "start": 5075,
          "end": 5132
        }
      }
    },
    {
      "index": 6,
      "action": {
        "text": "And just like that, the task has now been completed.",
        "span": {
          "start": 5696,
          "end": 5748
        }
      }
    },
    {
      "index": 7,
      "action": {
        "text": "So you can go ahead, take a look at the video first and then proceed to answer the question.",
        "span": {
          "start": 5905,
          "end": 5997
        }
      }
    },
    {
      "index": 8,
      "action": {
        "text": "But then you can go ahead, read the feedback that is giving you if you got them wrong and proceed to click done.",
        "span": {
          "start": 6203,
          "end": 6315
        }
      }
    },
    {
      "index": 9,
      "action": {
        "text": "After that, you can click continue and then you're going to be redirected to the next task.",
        "span": {
          "start": 6316,
          "end": 6407
        }
      }
    }
  ],
  "unmapped": [
    {
      "text": "Hello everyone, my name is Marco Salas and I'm the co-founder of Dexter, which is a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom, plus a roadmap that is going to guide you step by step on the things that you need to do in order for you to find success inside of this community.",
      "span": {
        "start": 0,
        "end": 388
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "Oops, that's the other one.",
      "span": {
        "start": 2075,
        "end": 2102
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "And we're going to open.",
      "span": {
        "start": 2103,
        "end": 2127
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Understand the structure.",
      "span": {
        "start": 3195,
        "end": 3220
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Right.",
      "span": {
        "start": 4129,
        "end": 4135
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "Your folder structure.",
      "span": {
        "start": 4392,
        "end": 4414
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "We're going to click continue.",
      "span": {
        "start": 5133,
        "end": 5163
      },
      "reason": "below-extraction-threshold"
    },
    {
      "text": "I want to see you crushing it.",
      "span": {
        "start": 6587,
        "end": 6617
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "I want to see you succeed.",
      "span": {
        "start": 6618,
        "end": 6644
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "And I want to see you in the community as well.",
      "span": {
        "start": 6645,
        "end": 6692
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "See you soon.",
      "span": {
        "start": 6693,
        "end": 6706
      },
      "reason": "no-field-for-this-content"
    },
    {
      "text": "Ciao.",
      "span": {
        "start": 6707,
        "end": 6712
      },
      "reason": "no-field-for-this-content"
    }
  ],
  "coverage": {
    "total_bytes": 6713,
    "covered_bytes": 6625,
    "pct": 98.69,
    "unmapped_threshold_bytes": 32
  }
}

```

</details>

**What this pair shows that the other two do not.** This is the only one of the three pairs with both a populated `speakers[]` **and** a populated `definitions[]` on the same card — check both directly:

```bash
python3 -c "import json; c=json.load(open('cards/02-desktop-setup.card.json')); print(c['speakers']); print(c['definitions'])"
```
```
[{'name': {'text': 'Marco Salas', 'span': {'start': 27, 'end': 38}}, 'evidence': {'text': 'my name is Marco Salas', 'span': {'start': 16, 'end': 38}}}]
[{'term': {'text': 'Dexter', 'span': {'start': 65, 'end': 71}}, 'definition': {'text': 'a platform that aims to help you find success inside of this community through an AI agent that is trained with everything that lives inside of the classroom', 'span': {'start': 82, 'end': 239}}}]
```

This is the same speaker and definition already quoted as a field excerpt in Example 3 below — this pair is the full card that excerpt is cut from. It also carries the largest `entities[]` list of the three pairs shown here (10 entries).

**Round-trip check:**

```bash
node checker/verify-traces.mjs cards/02-desktop-setup.card.json
```

Real output, this run:

```
TRACES VERIFIED — cards/02-desktop-setup.card.json. 0 problems.

All 1 card(s) verified against their inputs.
```

Exit code: `0`.

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

This transcript says some variant of "continue with Google" **three times**, and their casing is not
identical. Checked directly, case-sensitively:

```bash
python3 -c "
import re
data = open('inputs/01-mobile-app-setup.txt','rb').read()
for m in re.finditer(rb'(?i)continue with google', data):
    print(m.start(), m.end(), m.group())
"
```

```
206 226 b'continue with Google'
320 340 b'Continue with Google'
481 501 b'continue with Google'
```

Only the occurrence at span 320 — the one step 3 actually cites — byte-matches the capitalized string
`Continue with Google`. The other two, at 206 and 481, spell it `continue with Google` (lowercase
`c`) and sit embedded inside longer sentences (step 2's own action text, and a separate claim at
469–502) rather than standing alone. So a verifier that only did a case-sensitive text comparison
would in fact single out span 320 correctly here — but that is incidental to this transcript's
capitalization, not a property the verifier relies on or should be trusted to have. A
case-insensitive comparison, or a transcript that happened to capitalize all three the same way,
collapses the distinction completely: all three occurrences say the same words. Span order is what
`fixtures/neg-05-neighbour-span` exists to prove the verifier actually checks, independent of
whatever casing the source happens to use.

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
