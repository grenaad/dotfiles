# Pitfalls we hit, and their fixes

Most items happened while making the Abstraction series or moving it out of
the engine repository. Items marked *(risk)* are precautions that the series
or the engine docs adopted before anything went wrong.

## Setup and engine

| Mistake | What happened | Fix |
| --- | --- | --- |
| Running `psychopomp --version` (or `--help`) | At `91d6cde`, any single argument is an output path, so it rendered the demo film to a file named `--version` | Read `~/.cargo/.crates2.json`. Run unknown binaries only with ≥ 2 arguments |
| Libraries and renderer at different commits | Nothing checks them. The plan JSON is their contract | Pin both libraries to one `rev`, install the renderer with the same `--rev`, and compare before rendering |
| Scene three levels deep, or `assets/` missing | `../../assets/…wav` didn't resolve, and the render failed with only ffmpeg `Broken pipe (os error 32)` | Keep scenes at `scenes/<name>/`. Copy the sounds the plans name (project-setup.md) |
| Installed renderer filling Cargo's checkout | The footage cache went to `~/.cargo/git/checkouts/…/target/`: about 10 GB per commit | Delete it after footage work. Check `du -sh ~/.cargo/git/checkouts/psychopomp-*` |
| Pinning a branch, or force-pushing the pinned commit *(risk)* | Fresh clones can't fetch a commit that has been garbage-collected | Pin a full commit and tag it. Never rewrite the branch it lives on |
| Emitting with `--release` *(risk)* | Release and dev builds can differ in a float's last digit, so plans show spurious diffs | Always `cargo run -p` (dev), as `verify` does |
| Reading the engine docs from GitHub `main` | `main` was ahead of the pinned commit | Read the skills in Cargo's checkout of the pin (SKILL.md) |
| The global skill hiding the repo skill | The same ID `psychopomp`, so the engine's own SKILL/FEATURES/STORY weren't loaded | Open them by path (SKILL.md, "First") |

## Voice and credits

| Mistake | What happened | Fix |
| --- | --- | --- |
| Assuming "no key in env" means no spend | The key was also in a repo `.env` and in `~/.env`, found by walking up from the scene | Use `PSYCHOPOMP_MEDIA=plan` on every run unless voicing on purpose |
| Estimating 0.26 credits per character | It cost about 0.40 per character, directions included | Budget 0.40 per character + 10 % |
| Comparing the account counter with the lock | Another reel was voicing on the same account, so the counter showed 913 against the lock's 819 | Record both, and trust the lock for this scene |
| Editing clip text in Rust | The text is in the key, so it re-voiced | Edit the script and regenerate the constants. Restore old takes from git |
| Trusting ElevenLabs word timings blindly | One anchor was timed 0.28 s before any sound | Check onsets against the waveform. Delay that beat |
| Anchors like `half`, `once`, `Price` | Short words matched inside other words or repeated | Use longer, unique phrases. Run a test that each occurs once |
| "app" vs **Application** | The narration said "application" where `Application` was an anchor | Say "app" for the generic word |
| A part moved in the series | "Last time" and "part 3" became wrong | Search the narration for cross-references, and re-voice only those clips |

## Code on screen

| Mistake | What happened | Fix |
| --- | --- | --- |
| Code shown for 2 s, then a slide switch | "the code went by too fast". The constructor-injection change was never explained | Walkthroughs: light each named row, hold 1–2 s, say why the code changes |
| Drawn-code dim at 0.35 | Stage opacity is linear light, so it read as about 63 % ("all white"), the same grey as comments | Use about 0.13 on drawn labels (about 40 %). The diff editor's 0.35 is already about 40 % |
| All code white in drawn editors | Labels were one tone. C# was highlighted as TypeScript | `StageElement::code(…, Syntax::CSharp/Python, line)` on the column grid. Use the C# highlighter |
| Underlines bright on dimmed rows | Marks kept full opacity | `stage::marks::RowMarks` (drawn code). The diff editor does it built in |
| `+` on every row of a re-shown state | Every row looked changed | `declare_paced` with `ChangeMarks::paced()`, and `.unmarked()` on unchanged rows |
| An underline pointed at a row not yet on screen | The beat silently showed nothing | Scene tests that every mark's row exists and is lit |
| Magic strings in examples | It taught the wrong habit | Real enums with exhaustive `switch`/`match` (`assert_never`) |
| Over-claiming in one edition | Python models stayed mutable after `frozen` was removed, so "always valid" was false | Keep honest limits, and change the narration ("checked on the way in") |
| Wrong tab label | Python S5 said `pricing.py` for `checkout.py` | Tab labels are part of the display check |

## Picture and seams

| Mistake | What happened | Fix |
| --- | --- | --- |
| Status chips overlapping at a seam | Two chips were visible during the cross-fade | Carry the old chip through the fade, and bring the new one in after it (a test checks that) |
| Footers retyping at every seam | Distracting flicker | Carry the previous footer, and change it at the clip's first anchor |
| Stage over 128 elements *(risk)* | Preflight refuses it. Busy stages reached 117 and 125 of 128 | Budget elements, group the muted cast, and cut to a fresh stage |
| Coloured lines or text requested | Strokes and labels take theme tones only | Use tints, swatches and chips. Green outline + ✓ for success |
| Layer dissolving early during a camera zoom | Empty frames mid-flight | Fade the destination up first, and dissolve only near the chrome. Sample the zoom in a test |
| Reviewing only stills | Motion problems were missed | Watch normal-speed `--range` windows, and contact frames ≤ 40 ms apart |

## Rendering and ops

| Mistake | What happened | Fix |
| --- | --- | --- |
| Long render tied to a session | A restart of the session or terminal kills it, and the hours are lost | Detached `nohup` script, a log, `.partial` outputs, and `.done` markers |
| Overwriting the only good MP4 *(risk)* | No way back after a bad pass. Every series pass kept the earlier render | `mv x.mp4 x-pre-<pass>.mp4` before rendering |
| A stale series file | The series on disk was still the pre-pacing build, but was reviewed as new | Check the file size and duration against the manifest, and note build times |
| Full renders as routine checks *(risk)* | They tie up the shared render slot for hours | Frames, sheets, `--range` windows, and `verify compare` |
| `loudnorm` two-pass for the series | Linear mode refused, and the dynamic fallback was 0.3–0.6 LU short | Static gain plus true-peak limiter, with retries (rendering-and-ops.md) |
| Rendering without disk headroom *(risk)* | The engine repo's `target/` alone reached 19 GB, and a 10 GB footage cache appeared in scratch | `df -h` first. Clean `target/` and old verify output |
| Unchecked `verify compare` *(risk)* | Unrelated scenes can change unnoticed | Always pass `--expect`, and read every changed line |
