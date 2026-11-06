# Production workflow

The order that worked for the Abstraction series (six parts, about 29 minutes,
C# and Python editions):

script → verified code → scene → media plan → voice → emit and review → render →
master → stills → verify → series.

Each stage has a checklist. Don't start a stage until the one before it is
done. Most of the cost of a late fix is re-voicing and re-rendering.

---

## 1. Script (Markdown, one file per film)

Write it in the project, beside the films (for example `SCRIPT-2-strategy.md`).
Revise it with the user until they approve it. It is cheaper to change than
anything after it.

Per film:

- **Goal**: one paragraph saying what the viewer should understand.
- **The picture**: the cast (cards, colours, positions) and how it changes.
- **Plain-language rules**: words already taught, words allowed in this part,
  and words never said. Use a "Say / Means / Don't say" table.
- **Per clip** (one clip is one voiced line, about 10–30 s):
  - `#### Clip \`id\``
  - **Screen**: numbered beats ("At "check a mode", underline row 3").
  - **Footer**: the one caption that sums up the beat.
  - **Voice-over**: the narration, with the **anchor** phrases in bold, and an
    optional `[bracketed direction]` at the start.
  - **Anchor table**: `| Anchor | Beat |`. For two editions, give per-edition
    rows (`C# 3 / Py 4`).
  - **Display** blocks: each code state, verbatim, with its tab label
    (`Checkout.cs · the quick way`).
- **Code states summary**, **timing and voice budget** (characters → credits),
  **build notes** (engine limits, risky anchors), **open questions**, and
  **out of scope**.
- After building, add **"As built"** sections: clip timings, the "spec where the
  build differs" table (*this list wins over section 4*), and **known issues**.
  Later passes add their own dated sections: reorder, code pacing, colour, and
  so on.

When the user hands you a draft, keep their structure. Put factual fixes in a
**Corrections** table (`Original | Revised | Reason`), each traceable to the
code.

Checklist:

- [ ] Every claim in the narration is true of the code shown, or of a probe.
- [ ] Every anchor is unique in its clip (case-insensitive substring) and has a
      table row, and every row has its anchor.
- [ ] Every display is at most 76 columns × 14 rows.
- [ ] Banned words are absent (language names in two-edition films, jargon).
- [ ] Character count and credit estimate are written down.
- [ ] The user approved the script.

## 2. Verified code (before any scene code)

For each film with code on screen, the project has `csharp/` and/or `python/`
beside the scene:

- Real projects that build or type-check (.NET with warnings as errors;
  pyright strict plus pytest), with runtime checks that print PASS lines.
- **Probes**: one copy per "this won't compile" claim, each recording its
  error code (`CS7036`, `CS0535`, `CS8524`, `CS1503`; pyright
  `reportCallIssue`, `reportArgumentType`, …), plus the honest gaps that do
  compile.
- `run.sh <scratch-dir>` builds everything outside the repo and writes
  `expected.txt`. Commit `expected.txt`, and diff it on every run.
- A script checker (the series used `check_script.py`) confirms that every
  displayed line is in its source file, in order. It also checks the 76×14
  limit, the anchors and the banned words.

Checklist:

- [ ] `run.sh` passes, and `expected.txt` is unchanged or the change is
      explained.
- [ ] Each display state maps to a source file. The scene's tests
      `include_str!` those files and assert the match.

## 3. Scene crate

- Copy a previous scene's shape rather than starting blank: the kit (voice,
  chrome, icons), the code editor, segments, and tests.
- Generate the narration constants from the script (the series used
  `extract.py` → `src/script.rs`). Never hand-edit a clip's text: the text is
  part of its media key, so an edit re-voices it and costs credits.
- One segment per clip, joined into a `ReelPlan`. Each clip starts on the
  previous clip's last picture (a `rest` module), so the seams cut between
  identical frames.
- Scene tests that paid off: every seam joins identical pictures; footers and
  chips hold across seams; every stage stays at or under the 128-element limit
  with unique ids; resting labels don't overlap; every frame clears the chrome;
  anchors are unique in the script and in the word timings; nothing names a
  language; the code matches its source.

Checklist:

- [ ] `cargo fmt --check`, `cargo clippy -p <crate> --all-targets -- -D warnings`
      and `cargo test -p <crate>` pass.
- [ ] `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>` lists exactly the clips you
      expect as `+` / `~`.

## 4. Media plan, then voice

See [voice-and-credits.md](voice-and-credits.md). In short:

- [ ] Run `PSYCHOPOMP_MEDIA=plan`, and note the characters and estimated credits.
- [ ] Optionally use `PSYCHOPOMP_MEDIA=draft` to time the film with macOS `say`.
- [ ] Record the account balance, voice once, then run again: every resource
      should be `=`.
- [ ] Check each anchor against the word timings (and the waveform).

## 5. Emit and review

- [ ] `cargo run -p <crate>` writes the reel. Then run `psychopomp plan validate`.
- [ ] Get the segment spans from `plan inspect` or the scene's TIMINGS file.
- [ ] Make contact sheets at the anchors (0.7 s after each one) and at every
      code state. Read the text at full size with `plan frame` (sheets are half
      resolution).
- [ ] Render short `--range a..b` windows with sound around motion, seams and
      transitions.

## 6. Render, master, stills

See [rendering-and-ops.md](rendering-and-ops.md).

- [ ] Back up the previous MP4 (`<name>-pre-<pass>.mp4`).
- [ ] Render once in a detached, logged job.
- [ ] Master the audio only (`loudnorm=I=-16:TP=-1.5`).
- [ ] Run `ffprobe`: 1920×1080, 60 fps, AAC, and a duration equal to the reel's.
- [ ] Extract stills from the **rendered video** at the key times, plus a
      sheet. Look at them.

## 7. Verify and record

- [ ] Run `verify compare --expect <the scenes you meant to change>`. Nothing
      else should change.
- [ ] Record the render in the scene README and the script's "as built"
      section: the commit, duration, loudness, render time, stills, credits and
      known issues.
- [ ] Commit the plans, locks and `media/` together with the code that
      produced them.

## 8. Series (optional)

- [ ] Use a manifest of parts (title, card text, source MP4, the commit it was
      rendered from, the render command), then join the parts with a build
      script. See [rendering-and-ops.md](rendering-and-ops.md#combined-series).
- [ ] When a part changes, re-render that part, master it, update its commit
      in the manifest, and rebuild the series. Never edit the series by hand.

## Iteration passes that came up (budget for them)

These came up as user feedback after the first full render:

- **Reorder** (a part moved): headers, "part N" in narration (re-voiced),
  badges, tabs.
- **Code pacing** (code too fast): walkthroughs, holds, new short clips at
  sentence pauses. About 25 % longer films.
- **Colour** (code all white): a syntax highlighter, coloured drawn code,
  stronger dims.
- **Marks** (underlines bright on dimmed rows): marks follow their row's dim.

Each pass meant re-rendering every part in both editions (about 5 hours of
machine time for 12 renders) and rebuilding both series. Get the walkthrough
style right on one part first.
