# Voice and credits

ElevenLabs narration costs real money. In the Abstraction series every
voicing run was planned, counted and recorded, and each clip was voiced once.

## How `psychopomp-media` decides what to call

- Each `media.say(id, &voice, text)` gets a **content key**: a hash of the
  backend, model, voice, exact text (including `[directions]`), settings,
  seed, format, post-processing and alignment.
- `media.lock.json` beside the scene records each id's key, file
  (`media/<key>.mp3`), duration and word timings. A run calls the provider
  only for ids whose key is new (`+`) or changed (`~`). `=` means up to date,
  and `-` means an orphan.
- So **any** change to the text, voice, settings, `.format(…)` or `.whisper()`
  re-voices that line. A typo fix costs as much as a new line.
- Sibling locks (`media.<variant>.lock.json`, from `Media::open_variant`)
  share `media/`. A key that is already in any lock is reused for free.

## Modes (`PSYCHOPOMP_MEDIA`)

| Value | Calls a provider? | Use |
| --- | --- | --- |
| `plan` | **never** | Lists `+ ~ = -` with character counts and an estimate. Missing audio gets estimated timings so the program still runs, then it **exits non-zero** ("nothing was called"). |
| `draft` | no (macOS `say`) | Times a film before you spend anything. Real audio already in the lock is kept. Drafts are written into the lock under a `say` key, so the real voice is a `~` later. |
| `prune` | never | Once nothing is missing, deletes orphaned entries and unreferenced files in `media/`. It keeps files that a sibling lock references. |
| unset / `apply` | **yes**, for `+` and `~` | Only when you mean to spend. |

`verify` always runs programs with `PSYCHOPOMP_MEDIA=plan`.

## Safety: assume a key is always available

- The key comes from `ELEVENLABS_API_KEY`, or else from the **nearest `.env`
  above the scene folder**. This user has a key in a repo `.env` **and** in
  `~/.env`. Unsetting the variable, or removing one file, doesn't make a run
  safe.
- The only reliable guard is the mode: **put `PSYCHOPOMP_MEDIA=plan` on every
  `cargo run -p` of a narrated scene** unless you have decided to voice.
- Don't print, copy or commit `.env` contents or keys.

## Credit maths

- About **0.40 credits per character** on `eleven_v4`, counting bracketed
  directions (they are sent). Examples from the series: 2,206 characters →
  883 credits; 1,062 → 425; 235 → 94. An early estimate of 0.26 per character
  was wrong.
- The plan output gives characters per resource. Multiply by 0.4 and add
  about 10 % for retakes.
- Record the balance before and after. The lock records each request's
  credits from the response headers. The account counter can disagree when
  another job is voicing on the same account at the same time (once 913 by the
  counter against 819 by the lock).

## A voicing run

1. Fix the script first: the narration text is generated from it.
2. `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`. Confirm that **only** the
   intended ids are `+`/`~`, and write down the characters and estimate. Do
   this for each edition. With shared narration, the second edition should
   show 0 to voice.
3. Get the user's go-ahead if the spend is not already agreed. Record the
   balance.
4. `cargo run -p <crate>` once (apply).
5. Run `PSYCHOPOMP_MEDIA=plan` again. Every resource should be `=`.
6. Check the anchors (below), then record the characters, credits (lock and
   counter), and the balance before and after in the scene README / script.

## Retakes

- Retake only clips that are actually broken: a skipped or repeated word, a
  direction read aloud, or a mispronunciation. Each retake must change the key
  (a seed, a settings tweak, or a text fix), or the cache returns the same
  audio.
- To restore an old take for free, copy its lock entry and its
  `media/<key>.mp3` back from git (the series did this byte for byte).
- Prefer **new short clips at sentence pauses** over re-voicing long clips.
- Moving a part changed "last time" / "part 3" wording. Search the narration
  for cross-references whenever the order changes.

## Anchors and timing

- `spoken.at("phrase")` returns the time the phrase is spoken in a placed clip,
  and panics, naming the clip, if it is missing. `at_every` returns every
  occurrence, and `at_any` the first of several phrases.
- Keep each anchor unique in its clip (case-insensitive substring), so the
  first match is the intended one. If a phrase repeats, anchor on a longer
  phrase.
- ElevenLabs word timings come from the provider's character alignment of the
  **script**, not of the audio. If the voice skips, repeats or improvises,
  the timings are wrong but look plausible.
- Check every anchor:
  1. It resolves to the intended word, in order (scene test).
  2. Its timed start matches the waveform: an RMS onset above about −40 dB
     within 0.05 s. In one series clip a word was timed at 2.28 s while the
     audio was silent until 2.56 s, so that beat had to wait 0.28 s.
  3. Listen to it, or transcribe it. Most series clips were never reviewed by
     ear, because local Whisper was broken. Report that gap plainly.
- `.whisper()` on a voice times it from the audio instead. It changes the key,
  so the line is voiced again. Check the cost with `plan` first.

## House voice (this user)

```rust
Voice::eleven("72acIZo60o3D4eeTZJEQ")   // "Dan", the user's ElevenLabs clone
    .v4()                                // eleven_v4
    .stability(0.5)
    .similarity(0.75)
    .format("mp3_44100_128")             // Starter tier refuses 192 kbps; part of the key
```

Put at most one short `[direction]` at the start of a clip (for example
`[warm, conversational voice]`), and check that it wasn't spoken.
