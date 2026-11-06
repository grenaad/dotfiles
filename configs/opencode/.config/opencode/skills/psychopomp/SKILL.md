---
name: psychopomp
description: >-
  Make narrated, animated explainer videos and code walkthrough videos with
  psychopomp, the Rust engine for deterministic motion graphics. Use whenever
  someone wants to script, build, voice, render, review or fix a psychopomp
  film, reel or series; use the psychopomp or psychopomp-media crates or the
  psychopomp renderer CLI; set up a film workspace pinned to an engine commit;
  pace code on screen; narrate with ElevenLabs without wasting credits; or
  master and join rendered parts.
---

# Psychopomp explainer videos

Psychopomp turns a Rust **Scene Program** into plan JSON (a Scene Plan or a
Reel), and the `psychopomp` renderer turns the plan into PNG or MP4. Narration
comes from `psychopomp-media`, which voices each line once, caches it in
`media.lock.json` + `media/`, and times every beat to the spoken words.

This skill has the workflow and the lessons from making a real six-part,
two-edition series. The engine's own skills are the API reference.

## First: read the engine's own skills, at your engine version

This global skill has the same ID as the engine repository's own `psychopomp`
skill, and **hides it**. So read the engine's skill files yourself, from the
same commit you build against. Paths are relative to the engine root:

- `.agents/skills/psychopomp/SKILL.md`: the reel workflow, core model and commands
- `.agents/skills/psychopomp/FEATURES.md`: **the API catalogue**: every need →
  handle → example scene → doc section. Look features up here. Don't guess.
- `.agents/skills/psychopomp/STORY.md`: structure, narration and visual voice
- `.agents/skills/explainer-motion/SKILL.md` and `TECHNIQUES.md`: motion rules
  and constants for every beat

Find them in the first of these places that exists:

1. **Inside the engine repository** (the root has `crates/psychopomp-render/`):
   the paths above, from the checked-out branch.
2. **A film workspace with vendored copies**: `.agents/skills/psychopomp/` in
   that workspace. If it has `docs/engine/COMMIT`, check that it matches the
   `psychopomp` commit in `Cargo.lock`. This copy is hidden
   by this skill too, so open the files directly.
3. **Cargo's checkout of the pinned commit** (run this in the film workspace):
   ```sh
   cargo metadata --format-version 1 \
     | jq -r '.packages[] | select(.name == "psychopomp") | .manifest_path'
   # → ~/.cargo/git/checkouts/psychopomp-<hash>/<short-rev>/crates/psychopomp/Cargo.toml
   # The engine root is two levels above crates/psychopomp/.
   ```
   Run `cargo fetch` first if the dependency has not been fetched yet. The
   reference docs (`SCENE_PLANS.md`, `CONTEXT.md`, `DSL.md`, `EFFECTS.md`,
   `AGENTS.md`) and the example `scenes/` are at that root too.

Links inside the engine skills point at GitHub `main`, which may be ahead of
your pin. Prefer the local files. `explainer-motion` has its own ID, so it isn't
hidden. It loads as a skill only where OpenCode discovers it (inside the
engine repo, or a vendored copy). Anywhere else, open it by path.

## Decision flow

| Situation | Go to |
| --- | --- |
| New film in a project outside the engine repo | [references/project-setup.md](references/project-setup.md) |
| Starting a film, or changing what it says | [references/production-workflow.md](references/production-workflow.md), stage 1: script first |
| Code on screen (walkthroughs, diffs, two languages) | [references/pacing-and-code.md](references/pacing-and-code.md) |
| Anything that could call ElevenLabs | [references/voice-and-credits.md](references/voice-and-credits.md), **before** running the scene |
| Rendering, mastering, stills, verify, joining a series | [references/rendering-and-ops.md](references/rendering-and-ops.md) |
| Something looks or sounds wrong | [references/pitfalls.md](references/pitfalls.md) |
| Which feature or beat to use | the engine's `FEATURES.md` and `explainer-motion` |

## Core rules

1. **Script first.** Write and revise a Markdown script per film before
   building anything. Each clip has Screen beats, a Footer, a Voice-over with
   **bold anchors**, and an anchor table. The script is the spec. When the
   build differs, record it in the script's "as built" section.
2. **Anchors** are the words a beat waits for. Each one must be unique within
   its clip (case-insensitive substring). Their times come from the voice's word
   timings, so check that each one lands on the intended word.
3. **Never voice by accident.** Run every narrated scene with
   `PSYCHOPOMP_MEDIA=plan` first. It calls no provider and reports what would be
   voiced, with a character count. Voice only on purpose, after you have
   recorded the account balance. About 0.40 credits per character.
4. **Code on screen is real.** At most 76 columns × 14 rows per state. Every
   shown line comes from a project that compiles or type-checks, and every
   "won't compile" claim is proven by a probe with its error code.
5. **Pace the code.** Each sentence lights the rows it names and dims the rest.
   Hold 1–2 s before a change. Say *why* the code changes, and never just
   switch slides.
6. **Emit with `cargo run -p <crate>`** (the dev profile). Never edit a plan by
   hand. Commit the plans with the change that produced them.
7. **Check cheaply, render once.** Use `plan frame`, contact sheets, and
   `plan render --range a..b` or `--cue`. Run `verify compare` against a
   baseline. Render a full film only after those pass.
8. **Render, then master the audio only**
   (`loudnorm=I=-16:TP=-1.5`, video stream-copied). Back up the previous MP4
   first. Look at stills of the result.
9. **Libraries and renderer share one engine commit.** The plan JSON is the
   contract between them. `psychopomp --version` does **not** exist at
   `91d6cde`: it renders the demo film to a file named `--version`. Read the
   installed commit from `~/.cargo/.crates2.json`.
10. **Long jobs run detached, logged and resumable.** Check free disk space
    first. Renders queue for one machine-wide render slot.
11. **Plain narration.** Plain words with little jargon. Use real enums, not
    magic strings. Keep the honest limits in the narration. When a film has two
    language editions, the narration never names a language.

## Where things are

- Engine: `github.com/grenaad/psychopomp` (fork; upstream
  `kitlangton/psychopomp`). Branch `performance` is the engine-only branch.
  `91d6cde` is verified for external use.
- This user's house voice (an example, not a default): Dan, ElevenLabs voice
  `72acIZo60o3D4eeTZJEQ`, `eleven_v4`, stability 0.5, similarity 0.75,
  `mp3_44100_128`. Keep that format: the Starter tier refuses 192 kbps, and the
  format is part of the cache key.
- The Abstraction series (worked example, machine-specific): psychopomp branch
  `abstraction-series` (`scenes/{abstraction,strategy,coupling,testing,clean-architecture,business-logic,series}`),
  with scripts and plans in `~/projects/arch_presentation/reels/interfaces/`
  (`SERIES.md`, `SCRIPT*.md`, `plans/`). It is planned to move into that folder
  as its own workspace (`plans/move-out/PLAN.md`).

## Reporting

Say what you checked and how: stills, motion windows, `verify compare`,
`ffprobe`, loudness, and anchor timings. Say what you didn't check, such as
"not reviewed by ear". Report credits spent from the lock and from the account
balance.
