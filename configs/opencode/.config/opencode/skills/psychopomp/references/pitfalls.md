# Pitfalls we hit, and their fixes

Most items happened while making earlier films. Items marked *(risk)* are
precautions taken before anything went wrong. Engine details are as of
`a32d347`.

## Setup and engine

| Mistake | What happened | Fix |
| --- | --- | --- |
| Running `psychopomp --version` (or `--help`) | There are no such flags. A single argument is an output path, so it rendered the demo film to a file named `--version` | Read `~/.cargo/.crates2.json`. Run an unknown binary only with two or more arguments |
| Libraries and renderer at different commits | Nothing checks them. The plan JSON is their contract, and its version numbers rarely change | Pin both libraries to one `rev`, install the renderer with the same `--rev`, and compare before rendering |
| Installing an upstream renderer over a fork build *(risk)* | Older workspaces would render with a different engine without noticing | `cargo install --root DIR …` per engine, and call that binary by path |
| Scene three levels deep, or `assets/` missing | `../../assets/…wav` didn't resolve, and the render failed with only ffmpeg's `Broken pipe (os error 32)` | Keep scenes at `scenes/<name>/`. Copy the sounds the plans name. `plan check <plan> --audio` reports `missing_audio` |
| Installed renderer filling Cargo's checkout | The footage cache lives in the engine source's `target/`. For `cargo install --git` that is in `~/.cargo/git/checkouts/`, and it reached about 10 GB per commit | Delete `target/psychopomp-cache` there after footage work. Check `du -sh ~/.cargo/git/checkouts/psychopomp-*` |
| Pinning a branch *(risk)* | A branch moves, and the installed renderer doesn't | Pin a full 40-character commit |
| Emitting with `--release` *(risk)* | Release and dev builds can differ in a float's last digit, so plans show spurious diffs | Always `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>` (dev), as `verify` does |
| Reading the engine docs from GitHub `main` | `main` can be ahead of the commit you build against | Read them at your commit (SKILL.md) |
| The global skill hiding the repo skill | Same ID `psychopomp`, and OpenCode prefers the global one | Open the engine's files by path |
| Taking the engine docs at their word | Some claims don't match the code (SKILL.md lists them) | Check flags and signatures in the source |

## Voice and credits

| Mistake | What happened | Fix |
| --- | --- | --- |
| Assuming "no key in env" means no spend | The key was also in a repo `.env` and in `~/.env`, found by walking up from the scene | Use `PSYCHOPOMP_MEDIA=plan` on every run unless voicing on purpose |
| Budgeting with a fixed credits-per-character rate | The rate depends on the model and plan. An early fixed estimate was far too low | Take characters from plan mode and the rate from the lock's `credits`. Add about 10 % |
| Comparing the account counter with the lock | Another job was voicing on the same account at the same time | Record both, and trust the lock for this scene |
| Editing clip text in Rust | The text is in the key, so it re-voiced | Edit the script and regenerate the constants. Restore old takes from git |
| Trusting ElevenLabs word timings blindly | One anchor was timed 0.28 s before any sound | Check onsets against the waveform. Delay that beat |
| Short or repeated anchors (`half`, `once`, `Price`) | `at` silently takes the first occurrence | Use longer, unique phrases. Test that each occurs once |
| "app" vs **Application** | The narration said "application" where `Application` was an anchor | Say "app" for the generic word |
| A part moved in a series | "Last time" and "part 3" became wrong | Search the narration for cross-references, and re-voice only those clips |
| Running the engine's `bun scripts/narrate.ts` *(risk)* | It calls ElevenLabs directly, with no plan mode, and Bun loads `.env` by itself | Use `psychopomp-media` with `PSYCHOPOMP_MEDIA=plan` |
| Pruning while migrating a fork workspace *(risk)* | Upstream prune reads only `media.lock.json`, so it deletes files that only a variant lock references | Don't prune until the user has decided what to keep (SKILL.md) |

## Code on screen

| Mistake | What happened | Fix |
| --- | --- | --- |
| Code shown for 2 s, then a slide switch | "the code went by too fast". The constructor-injection change was never explained | Walkthroughs: point at each named row, hold 1–2 s, say why the code changes |
| Judging a dim by its number | On drawn labels, 0.35 read as barely dimmed, the same grey as the comments | Measure dims on a rendered still |
| Non-TypeScript code in the diff editor | The editor colours every line as TypeScript | Check the colours on a still |
| Underlines bright on dimmed rows | Marks kept full opacity | A mark dims with its row. Test it |
| An underline pointed at a row not yet on screen | The beat silently showed nothing | Scene tests that every mark's row exists and is visible |
| Magic strings in examples | It taught the wrong habit | Real enums with an exhaustive `switch` or `match` |
| Over-claiming | A model stayed mutable after `frozen` was removed, so "always valid" was false | Keep the honest limits, and change the narration |
| Wrong tab label | A tab said `pricing.py` for `checkout.py` | Tab labels are part of the display check |

## Picture and seams

| Mistake | What happened | Fix |
| --- | --- | --- |
| Status chips overlapping at a seam | Two chips were visible during the cross-fade | Carry the old chip through the fade, and bring the new one in after it (a test checks that) |
| Footers retyping at every seam | Distracting flicker | Carry the previous footer, and change it at the clip's first anchor |
| A busy Stage *(risk)* | Validation refuses more than 256 elements (nested ones included) or groups more than 8 deep | Budget elements, group the muted cast, and cut to a fresh stage |
| Layer dissolving early during a camera zoom | Empty frames mid-flight | Fade the destination up first, and dissolve only near the chrome. Sample the zoom in a test |
| Reviewing only stills | Motion problems were missed | Watch normal-speed `--range` windows, and contact frames ≤ 40 ms apart |

## Rendering and ops

| Mistake | What happened | Fix |
| --- | --- | --- |
| Long render tied to a session | A restart of the session or terminal kills it, and the hours are lost | Foreground with a long timeout, or a detached `nohup` script with a log, `.partial` outputs and `.done` markers |
| Overwriting the only good MP4 *(risk)* | No way back after a bad pass | `mv x.mp4 x-pre-<pass>.mp4` before rendering |
| A stale joined file | An old build was reviewed as new | Check the file size and duration against the manifest, and note build times |
| Full renders as routine checks *(risk)* | They tie up the shared render slot for hours | `plan check <reel> --pops --audio`, strips, frames, `--range` and `--draft` windows, and `verify compare` |
| `loudnorm` two-pass on joined parts | Linear mode refused, and the dynamic fallback was 0.3–0.6 LU short | Static gain plus a true-peak limiter, with retries (rendering-and-ops.md) |
| Rendering without disk headroom *(risk)* | Cargo `target/` folders and the footage cache grow to tens of GB | `df -h` first. Clean `target/` and old verify output |
| Reading `verify compare` by exit status only | "expected to change but identical" exits 0 | Always pass `--expect`, and read every line of the output |
| Trusting `plan check --audio` for loudness | It reports LUFS and true peak but doesn't fail on them | Read the numbers, master, and measure the final file |
