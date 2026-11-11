# Voice and credits

ElevenLabs narration costs real money. Plan every voicing run, voice each line
once, and record what it cost. Checked against `psychopomp-media` at
`a32d347`.

## How `psychopomp-media` decides what to call

- You declare audio with `media.say(id, &voice, text)`,
  `media.dialogue(id, [(&voice, text), …])` and
  `media.sfx(id, prompt, duration)`. Then `media.finish()` reconciles the
  declarations with the lock.
- Each declaration gets a **content key**: a hash of its whole spec. That
  covers the backend, model, voices and exact text (with `[directions]`), the
  settings (stability, similarity, speed, seed, language), the previous line
  given by `Line::after`, the output format, post-processing and alignment.
- `media.lock.json` sits in the folder passed to `Media::open`, usually the
  scene crate. It records each id's key, file (`media/<key>.<ext>`), duration
  and word timings. For ElevenLabs entries it also records the `credits` that
  the provider reported for that request.
- A run generates only the ids that are new (`+`) or changed (`~`). `=` means
  up to date. Orphans (lock entries that nothing declares any more) print as
  `-` and are counted in the summary line. They are never generated.
- So **any** change to the text, voice, settings, `.format(…)` or
  `.whisper()` generates that line again. A typo fix costs as much as a new
  line.

## Modes (`PSYCHOPOMP_MEDIA`)

| Value | Calls a provider? | What it does |
| --- | --- | --- |
| unset or `apply` | **yes**, for every `+` and `~` | The default. Use it only when you mean to spend. |
| `plan` | never | Prints `+ ~ =` per declared resource, `-` per orphan, and a summary. Missing audio gets estimated timings so the program runs, then `finish()` fails with the total characters to generate, saying that nothing was called. It fails only when something is `+` or `~`: orphans (`-`) don't fail it. |
| `draft` | no | Speech comes from macOS `say` (`SAY_VOICE`, default `Samantha`), and sound effects become silence. Drafts are written to the lock and `media/` under their own keys, so the real voice shows as `~` later. |
| `prune` | never | When nothing is pending, it removes orphaned lock entries and every file in `media/` that this lock doesn't reference. |

`verify` always runs programs with `PSYCHOPOMP_MEDIA=plan`.

Prune reads only `media.lock.json`. If a folder has other lock files (the
fork's `media.<variant>.lock.json`), prune deletes the files that only those
locks reference.

## Safety: assume a key is always available

- `ELEVENLABS_API_KEY` from the environment wins. Otherwise the key comes from
  the nearest `.env` that has the key, in the scene folder or any folder above
  it, up to `/`. A
  repo `.env` or `~/.env` both count, so unsetting the variable doesn't make a
  run safe.
- The only reliable guard is the mode. **Put `PSYCHOPOMP_MEDIA=plan` on every
  `cargo run -p` of a narrated scene** unless you have decided to voice.
- Don't open, print, copy or commit `.env` files or keys. Don't pass a key
  inline on the command line (the engine playbook's example does), because it
  ends up in shell history and logs.
- Don't run the engine's legacy `bun scripts/narrate.ts`. It calls ElevenLabs
  directly, it has no plan mode (`--draft` uses `say`), and Bun loads `.env`
  from the current folder by itself.

## Cost

- The engine doesn't estimate credits. Plan mode lists each pending resource,
  and its failure message gives the total characters per provider (and the
  total seconds of generated sound effects), not a count per resource.
  Bracketed directions are sent to the provider, so they count.
- The credits per character depend on the model and the account's plan, and
  they change. Work out the current rate from your own recent entries: the
  lock's `credits` divided by that line's characters.

  ```sh
  jq -r '.resources | to_entries[] | select(.value.credits != null and .value.spec.lines != null)
    | "\(.key)\t\(.value.credits)\t\([.value.spec.lines[].text] | join("") | length)"' media.lock.json
  ```

  With no history, check the account's pricing before voicing. Add about 10 %
  for retakes.
- Record the account balance before and after. Trust the lock's `credits` for
  a scene: the account counter also counts other jobs voicing on the same
  account at the same time.

## A voicing run

1. Fix the script first. The narration text is generated from it.
2. Run `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`. Confirm that **only** the
   intended ids are `+` or `~`, and write down the total characters.
   Optionally, time the film first with `PSYCHOPOMP_MEDIA=draft`.
3. Get the user's go-ahead if the spend isn't already agreed. Record the
   balance.
4. With the go-ahead, voice once: `cargo run -p <crate>` (apply). This is the
   only run without `PSYCHOPOMP_MEDIA=plan`.
5. Run `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>` again. Every declared
   resource should be `=` (orphans, `-`, may remain), and the run should
   write the plan.
6. Check the anchors (below). Then record the characters, the credits (lock
   and counter), and the balance before and after in the scene README or the
   script.

## Retakes

- Retake only clips that are actually broken: a skipped or repeated word, a
  direction read aloud, or a mispronunciation. Each retake must change the key
  (a seed, a settings tweak, or a text fix), or the cache returns the same
  audio.
- To restore an old take for free, copy its lock entry and its
  `media/<key>.<ext>` file back from git.
- Prefer **new short clips at sentence pauses** over re-voicing long clips.
- When parts change order, search the narration for cross-references ("last
  time", "part 3").

## Anchors and timing

- `let spoken = line.place(&mut scene, start)`, then `spoken.at("phrase")`
  gives the time of the **first** occurrence of the phrase in that clip. It
  matches whole words and ignores case and punctuation, and number words match
  digits. A phrase that is never said panics, naming the clip.
- Also: `at_any(&[…])` (the first listed spelling that was said),
  `at_every(phrase)`, `at_after(phrase, earlier)` (searching only after
  `earlier`), `start()`, `end()` and `words()`.
  `psychopomp::author::PlanTime` adds `.not_before(t)` to a time.
- House rule: each anchor phrase occurs once in its clip, because the engine
  silently takes the first match. If a word repeats, anchor on a longer
  phrase, and test that each anchor occurs exactly once.
- ElevenLabs word timings come from the provider's character alignment of the
  text that was sent, not of the audio. `[directions]` are left out of the
  words. If the voice skips, repeats or improvises, the timings are wrong but
  look plausible.
- Check every anchor:
  1. It resolves to the intended word, in order (a scene test).
  2. Its timed start matches the waveform: an RMS onset above about −40 dB
     within 0.05 s. One word was once timed 0.28 s before any sound, so that
     beat had to wait.
  3. Listen to it, or transcribe it. If you didn't, say so in the report.
- `.whisper()` on a voice times it from the audio instead, with local
  `mlx_whisper` run through `uvx` (`WHISPER_MODEL`, default
  `mlx-community/whisper-large-v3-mlx`). It changes the key, so the line is
  generated again. Check the cost with `plan` first.

## House voice

This user's voice. It is an example, not a default.

```rust
Voice::eleven("72acIZo60o3D4eeTZJEQ")   // "Dan", the user's ElevenLabs voice
    .v4()                                // eleven_v4, already Voice::eleven's default model
    .stability(0.5)
    .similarity(0.75)
    .format("mp3_44100_128")             // keep: see below
```

- **Format.** The engine's ElevenLabs default is `mp3_44100_192`. The user's
  Starter plan refused 192 kbps (observed; it depends on the paid plan), so
  we pin `mp3_44100_128`. The format is part of the cache key, so changing it
  regenerates every line.
- This combination hasn't been voiced against `a32d347`. The builder calls
  exist there, but whether the provider accepts this voice, model and format
  today is untested. Run plan mode, then voice one short line first.
- Put at most one short `[direction]` at the start of a clip (for example
  `[warm, conversational voice]`), and check that it wasn't spoken.
