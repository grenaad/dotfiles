# Production workflow

This is the house order, not an engine requirement:

script → verified code → scene → media plan → voice → emit and check →
review windows → render → master → stills → verify and record.

Each stage has a checklist. Don't start a stage until the one before it is
done. Most of the cost of a late fix is re-voicing and re-rendering.

---

## 1. Script (Markdown, one file per film)

Write it in the project, beside the films (for example `SCRIPT-intro.md`).
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
  - **Anchor table**: `| Anchor | Beat |`.
  - **Display** blocks: each code state, verbatim, with its tab label
    (`checkout.ts · the quick way`).
- **Code states summary**, **timing and voice budget** (characters, and
  credits at the current rate), **build notes** (engine limits, risky
  anchors), **open questions**, and **out of scope**.
- After building, add **"As built"** sections: clip timings, the "spec where
  the build differs" table (*this list wins over the clip sections*), and
  **known issues**. Later passes add their own dated sections.

When the user hands you a draft, keep their structure. Put factual fixes in a
**Corrections** table (`Original | Revised | Reason`), each traceable to the
code.

Checklist:

- [ ] Every claim in the narration is true of the code shown, or of a probe.
- [ ] Every anchor occurs once in its clip and has a table row, and every row
      has its anchor.
- [ ] Every display is at most 76 columns × 14 rows.
- [ ] Banned words and jargon are absent.
- [ ] The character count and credit estimate are written down.
- [ ] The user approved the script.

## 2. Verified code (before any scene code)

For each film with code on screen, keep real projects beside the scene:

- Projects that build or type-check (for example .NET with warnings as
  errors, or pyright strict plus pytest), with runtime checks that print PASS
  lines.
- **Probes**: one copy per "this won't compile" claim, each recording its
  error code (for example `CS7036`, or pyright `reportCallIssue`), plus the
  honest gaps that do compile.
- A build script runs everything outside the repo and writes the results to
  a file (for example `expected.txt`). Commit that file and diff it on every
  run.
- A script checker confirms that every displayed line is in its source file,
  in order. It also checks the 76×14 limit, the anchors and the banned words.

Checklist:

- [ ] The build script passes, and its results file is unchanged or the change
      is explained.
- [ ] Each display state maps to a source file. The scene's tests
      `include_str!` those files and assert the match.

## 3. Scene crate

- Start from an upstream shape rather than a blank file: the README quick
  start, `scenes/generated-media` for narration, `scenes/diagnostics` for the
  diff editor, and the playbook's Style Kits for the look.
- Generate the narration constants from the script. Never hand-edit a clip's
  text in Rust: the text is part of its media key, so an edit re-voices it and
  costs credits.
- One segment per clip, joined with `ReelPlan::new(id, segments)`. The first
  segment is a cut (`ReelSegmentPlan::cut`). Later ones can enter through a
  transition such as `ReelSegmentPlan::wiped`. Start each clip on the previous
  clip's last picture, so the seams cut between identical frames.
- Scene tests that paid off: every seam joins identical pictures; footers and
  chips hold across seams; every stage stays within the engine's limits (1 to
  256 elements, groups at most 8 deep, unique IDs); resting labels don't
  overlap; every frame clears the chrome; each anchor occurs once in the
  script and in the word timings; and the code matches its source.

Checklist:

- [ ] `cargo fmt --check`, `cargo clippy -p <crate> --all-targets -- -D warnings`
      and `PSYCHOPOMP_MEDIA=plan cargo test -p <crate>` pass (plan mode in
      case a test opens `Media`).
- [ ] `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>` lists exactly the clips you
      expect as `+` or `~`.

## 4. Media plan, then voice

See [voice-and-credits.md](voice-and-credits.md). In short:

- [ ] Run `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`. Note the total
      characters, and estimate the credits from the rate in your recent lock
      entries.
- [ ] Optionally use `PSYCHOPOMP_MEDIA=draft` to time the film with macOS `say`.
- [ ] Record the account balance, voice once in the approved apply run
      ([voice-and-credits.md](voice-and-credits.md#a-voicing-run)), then run
      plan mode again: every declared resource should be `=` (orphans, `-`,
      may remain).
- [ ] Check each anchor against the word timings and the waveform.

## 5. Emit and check (no video yet)

- [ ] `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>` writes the reel. Then run
      `psychopomp plan validate <reel>`.
- [ ] `psychopomp plan check <reel> --pops --audio` passes. It checks canvas
      bounds and card text fit; `--pops` adds one-frame pops, and `--audio`
      adds missing audio and clipping. It only reports loudness, so read the
      numbers.
- [ ] Make a contact sheet with `plan strip <reel> all output/strip.png -n 16
      --cols 4 --shutter`. Take stills at each anchor (about 0.7 s after it)
      and at each code state with `plan frame <reel> <times> output/stills`.
      Read the text in the full-size frames.
- [ ] Where sound matters, run `plan audio <reel> --at <times>`.

## 6. Review windows, render, master, stills

See [rendering-and-ops.md](rendering-and-ops.md).

- [ ] Render short windows with sound around motion, seams and transitions:
      `plan render <reel> output/w.mp4 --range a..b`, or `--cue ID`. Add
      `--draft` when you only need timing and audio.
- [ ] Back up the previous MP4 (`<name>-pre-<pass>.mp4`).
- [ ] Render once, in a job that survives the session.
- [ ] Master the audio only (`loudnorm=I=-16:TP=-1.5`).
- [ ] Run `ffprobe`: the plan's canvas and frame rate (1920×1080 at 60 fps by
      default), H.264 and AAC, and the right duration.
- [ ] Extract stills from the **rendered video** at the key times, plus a
      sheet. Look at them.

## 7. Verify and record

- [ ] Run `verify compare --expect <the scenes you meant to change>`. Nothing
      else should change, and every expected scene should have changed: read
      the output, because "expected to change but identical" doesn't fail.
- [ ] Record the render in the scene README and the script's "as built"
      section: the engine commit, duration, loudness, render time, stills,
      credits and known issues.
- [ ] Commit the plans, `media.lock.json` and `media/` together with the code
      that produced them.

## 8. Several parts (optional)

- [ ] Keep a manifest of parts (title, card text, source MP4, the engine
      commit it was rendered from, the render command), and join the parts
      with a script. See
      [rendering-and-ops.md](rendering-and-ops.md#joining-parts).
- [ ] When a part changes, re-render it, master it, update its manifest entry,
      and rebuild. Never edit the joined file by hand.

## Iteration passes to budget for

These came as feedback after the first full renders of earlier films:

- **Reorder** (a part moved): headers, "part N" in the narration (re-voiced),
  badges and tabs.
- **Code pacing** (code too fast): walkthroughs, holds, and new short clips at
  sentence pauses. About 25 % longer films.
- **Colour** (code all one colour): syntax colour, stronger dims.
- **Marks** (underlines bright on dimmed rows): marks follow their row's dim.

Each pass re-renders every affected part. Get the walkthrough style right on
one part first.
