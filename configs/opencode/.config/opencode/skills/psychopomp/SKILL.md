---
name: psychopomp
description: >-
  Make narrated, animated explainer videos and code walkthrough videos with
  psychopomp, the Rust engine for deterministic motion graphics (upstream
  kitlangton/psychopomp main). Use whenever someone wants to script, build,
  voice, render, review or fix a psychopomp film or reel; use the psychopomp
  or psychopomp-media crates or the psychopomp renderer CLI; set up a film
  workspace pinned to an engine commit; pace code on screen; narrate with
  ElevenLabs without wasting credits; or master rendered films.
---

# Psychopomp explainer videos

Psychopomp turns a Rust **Scene Program** into plan JSON (a Scene Plan or a
Reel), and the `psychopomp` renderer turns the plan into PNG or MP4.
Narration comes from `psychopomp-media`. It declares each line, generates it
once, caches it in `media.lock.json` and `media/`, and gives the word timings
that beats wait for.

This skill holds the house workflow and the rules that keep paid voice safe.
The engine's own skills, docs and example scenes are the API reference.

## Engine target

- Upstream `kitlangton/psychopomp`, branch `main`. This skill was checked
  against `a32d347` (2026-11-02). This machine's clone is
  `~/projects/psychopomp`. Its `main` tracks `origin/main` (the `grenaad`
  fork), which matched `upstream/main` at `a32d347`. After
  `git fetch upstream`, check that `git rev-parse main upstream/main` prints
  the same commit twice.
- Use the commit you build against for every lookup. In the engine repo it is
  `git rev-parse HEAD`. In a film workspace it is the `psychopomp` `source`
  line in `Cargo.lock`. For the installed renderer, read
  `~/.cargo/.crates2.json`
  ([project-setup.md](references/project-setup.md#4-install-the-renderer)).
- If your commit is newer than `a32d347`, check each flag and signature you use
  against the source. The CLI usage strings are in
  `crates/psychopomp-render/src/plan_runtime.rs` (`*_USAGE`, `usage()`) and
  `crates/psychopomp-render/src/plan_runtime/verify.rs` (`USAGE`).

> **Workspaces pinned to the `grenaad/psychopomp` fork** (branch
> `performance`) use APIs that upstream `main` doesn't have: language
> editions, `Media::open_variant` with per-variant locks, and a `verify.json`
> `env` key. Don't repin one silently, and don't install an upstream renderer
> over the one it uses. Never run `PSYCHOPOMP_MEDIA=prune` while migrating
> one: upstream prune reads only `media.lock.json` and deletes the files that
> only a `media.<variant>.lock.json` references, and those lines cost credits
> to voice again. Ask the user before migrating.

## Read the engine's own docs, at your commit

This skill has the same ID as the engine repository's
`.agents/skills/psychopomp` skill. OpenCode prefers
`~/.config/opencode/skills` over a project's `.agents/skills`, so the engine
skill is hidden. Open its files by path, from the engine root:

- `.agents/skills/psychopomp/SKILL.md`: the video playbook (Style Kits, the
  steps from facts to render, and extending the engine). `STORY.md`: story,
  narration and visual voice.
- `.agents/skills/explainer-motion/SKILL.md` and `TECHNIQUES.md`: motion rules,
  beats and motion tokens. This skill has its own ID, so it isn't hidden, but
  it loads only where OpenCode discovers it (inside the engine repo).
  Anywhere else, open it by path.
- `AGENTS.md` (commands, verify, a shared machine), `README.md` (quick start
  and the example index), `CONTEXT.md` (domain language), `ARCHITECTURE.md`,
  `SCENE_PLANS.md`, `DSL.md` and `EFFECTS.md`.
- Example scenes: `scenes/generated-media` (the smallest narrated scene),
  `scenes/diagnostics` (the IDE diff editor), `scenes/pr-walkthrough`, and the
  Style Kit reels `scenes/editorial`, `scenes/kinetic-poster` and
  `scenes/product-launch`.

Inside the engine repo, the root is the folder with `crates/psychopomp-render/`.
From a film workspace, use Cargo's checkout of your pin (run `cargo fetch`
first if the dependency hasn't been fetched yet):

```sh
cargo metadata --format-version 1 \
  | jq -r '.packages[] | select(.name == "psychopomp") | .manifest_path'
# → ~/.cargo/git/checkouts/psychopomp-<hash>/<short-rev>/crates/psychopomp/Cargo.toml
# The engine root is two levels above crates/psychopomp/.
```

Links inside the engine docs point at GitHub `main`, which may be ahead of
your commit. Prefer the local files.

**The engine docs are claims, so check them against the source.** At
`a32d347` these don't match the code:

- The playbook says `plan check --audio` verifies loudness. It reports LUFS
  and true peak but never fails on them. Of its audio findings, only
  `missing_audio` is an error; `audio_clipping` is a warning.
- The playbook writes `.inlay(id, range, ghost)`. It is the `Line` builder
  `inlay(id, after, text)`, and `keep`, `add` and `remove` are functions in
  `editor::diff`, not methods.
- `STORY.md` puts explainer headers at `y ~ 72`. `kit::explainer::HEADER_Y` is
  `96.0`.
- Some curves in `TECHNIQUES.md` don't match `stage.rs`: trail cooling, the
  ember core, the rewind curve and the flash table. Its motion-token table
  does match.
- `AGENTS.md` lists `bun scripts/narrate.ts`. That legacy script calls
  ElevenLabs directly and has no plan mode. Use `psychopomp-media` instead.

## Decision flow

| Situation | Go to |
| --- | --- |
| New film in a project outside the engine repo | [references/project-setup.md](references/project-setup.md) |
| Starting a film, or changing what it says | [references/production-workflow.md](references/production-workflow.md), stage 1: script first |
| Code on screen (walkthroughs, diffs) | [references/pacing-and-code.md](references/pacing-and-code.md) |
| Anything that could call ElevenLabs | [references/voice-and-credits.md](references/voice-and-credits.md), **before** running the scene |
| Checks, rendering, mastering, stills, verify | [references/rendering-and-ops.md](references/rendering-and-ops.md) |
| Something looks or sounds wrong | [references/pitfalls.md](references/pitfalls.md) |
| Which kit, feature or beat to use | the engine playbook (Style Kits), the example scenes, and `explainer-motion` |

## House rules

These are ours, not the engine's. Follow them unless the user decides
otherwise.

1. **Script first.** Write and revise a Markdown script per film before
   building anything. Each clip has Screen beats, a Footer, a Voice-over with
   **bold anchors**, and an anchor table. The script is the spec. When the
   build differs, record it in the script's "as built" section.
2. **One anchor, one occurrence.** Each anchor phrase occurs once in its
   clip. The engine doesn't check this: `spoken.at` silently takes the first
   match. Check that every anchor lands on the intended word.
3. **Never voice by accident.** Put `PSYCHOPOMP_MEDIA=plan` on every
   `cargo run -p` of a narrated scene. Plan mode calls no provider, lists what
   would be generated, and gives the total characters. Voice only on purpose,
   in the one approved apply run
   ([voice-and-credits.md](references/voice-and-credits.md#a-voicing-run)),
   after the user agrees and you have recorded the account balance.
4. **Code on screen is real.** Every shown line comes from a project that
   compiles or type-checks, and every "won't compile" claim is proven by a
   probe with its error code. Keep code within 76 columns × 14 rows per state.
5. **Pace the code.** Each sentence points at the rows it names. Hold 1–2 s
   before a change. Say *why* the code changes, and never just switch slides.
6. **Emit with `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`** (the dev
   profile, which `verify` also uses). A plain `cargo run -p` is only for the
   approved apply run. Never edit a plan by hand. Commit plans,
   `media.lock.json` and `media/` with the change that produced them.
7. **Check cheaply, render once.** Use `plan check <plan> --pops --audio`,
   `plan strip`, `plan frame`, and `plan render` windows (`--range a..b`, `--cue ID`,
   `--draft`), then `verify compare`. Render a full film only after those
   pass.
8. **Render, then master the audio only** (`loudnorm=I=-16:TP=-1.5`, video
   stream-copied). Back up the previous MP4 first. Look at stills of the
   result.
9. **Long jobs survive the session.** Run them in the foreground with a long
   timeout, or detached, logged and resumable. Check free disk space first.
10. **Plain narration.** Plain words with little jargon. Use real enums, not
    magic strings. Keep the honest limits in the narration.

## Engine facts at `a32d347`

The code enforces these. Check them again when your commit moves.

- `PSYCHOPOMP_MEDIA` unset (or `apply`) calls the provider for every new or
  changed line. The ElevenLabs key comes from `ELEVENLABS_API_KEY`, or else
  from the nearest `.env` that defines it, in the scene folder or any folder
  above it.
- The libraries and the renderer must come from one commit. The plan JSON is
  the contract between them. Its version numbers (scene plan 2, reel 1)
  don't change with most engine changes, so nothing catches a mismatch.
- The renderer has no `--version` or `--help`. A single argument is taken as
  an output path, and the built-in demo film is rendered there.
- Media paths in a plan resolve against the plan file's folder. The
  `psychopomp::sfx` sounds are `../../assets/<file>`, so scenes live at
  `scenes/<name>/`.
- A Stage holds 1 to 256 elements, nested ones included, with groups at most
  8 deep and unique element IDs. An overlay has at most 8 anchors.
- The IDE diff editor allows 76 columns per line (inlays included) and 14
  rows per step, and it highlights every line as TypeScript.
- `plan render` waits for a machine-wide render slot
  (`PSYCHOPOMP_RENDER_SLOTS`, default 1). Frames, snapshots and `verify` don't
  wait.
- `verify` builds with the dev profile and runs every program with
  `PSYCHOPOMP_MEDIA=plan`.
- ElevenLabs output defaults to `mp3_44100_192`. The format is part of the
  cache key.

## Where things are (this machine)

- Engine: `~/projects/psychopomp`, with remotes `upstream`
  (`kitlangton/psychopomp`) and `origin` (the `grenaad` fork). Build against
  upstream `main`, not the fork's branches.
- House voice (an example, not a default):
  [voice-and-credits.md](references/voice-and-credits.md#house-voice).

## Reporting

Say what you checked and how: stills, motion windows, `plan check`,
`verify compare`, `ffprobe`, loudness, and anchor timings. Say what you
didn't check, such as "not reviewed by ear". Report the credits spent, from
the lock's `credits` entries and from the account balance.
