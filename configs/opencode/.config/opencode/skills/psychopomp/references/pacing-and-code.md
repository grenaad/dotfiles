# Pacing and code on screen

House rules for showing code, and the engine's code display at `a32d347`.
Viewers of the first films made this way said the code "went by too fast".
Fixing that made the films about 25 % longer, so budget for it.

## Walkthrough rules (house)

- **One sentence, one set of rows.** When the narration names something,
  point at those rows or tokens and at nothing else.
- **Code goes on screen before the narration talks about it.**
- **Hold before a change.** Keep 1–2 s after the last line you point at,
  before the code changes or the camera moves. Keep silent holds to 3 s or
  less.
- **Explain every change.** Never switch to a new code state silently. Say
  *why* (for example, "So take the parts in through the constructor
  instead…"), then show the changed rows. Constructors that ask for
  interfaces were the code most often shown but never explained.
- **Connect code to the picture.** Draw a line from a token to its card or
  case.
- **Dense states**: split them into smaller states, or walk them row by row.
  Push the camera in on small editors.
- **New beats without re-voicing**: cut existing clips at pauses between
  sentences (the same audio), and voice short new clips that play between the
  pieces.

## The IDE diff editor (engine)

`psychopomp::editor::diff` at `a32d347`, from `scenes/diagnostics`:

```rust
use psychopomp::editor::diff::{Diff, add, keep};

let diff = Diff {
    file_name: "program.ts",
    lines: vec![
        keep("program.pipe("),
        add(1, "  Effect.provide(DatabaseLive),").range("provide", "Effect.provide(DatabaseLive),"),
        keep("  Effect.runPromise,").range("run", "Effect.runPromise"),
        keep(")"),
    ],
};
let editor = diff.declare(&mut scene, &[fix_at], 0, true)?;   // step 1 happens at fix_at
editor.target(&mut scene, "run", 2, "run")?;                 // Semantic Target on lines[2], range "run"
```

- Lines: `keep(text)` is there from the start. `add(step, text)` appears in
  `step`, and `remove(step, text)` is there from the start and leaves in
  `step`. Steps count from 1.
- `Line` builders: `.range(id, text)` names a range for targets,
  `.inlay(id, after, text)` adds an inlay hint after `after`, and
  `.marked(mark)` sets a line mark.
- `declare(scene, step_times, warning, entrance)`: `step_times[k]` is when
  step `k + 1` happens. Removed lines turn red `warning` nanoseconds before
  their step. `entrance` controls the card's entrance.
- `DiffEditor` has `actor()`, `line_id(index)`, `target(scene, id, index,
  range)` (a Semantic Target for callouts) and `inlay(scene, id)`. It has no
  public per-row dim or focus call at this commit, so point at code with
  targets and callouts (`scenes/diagnostics`, `scenes/pr-walkthrough`).
- **Limits (enforced by `declare`)**: each line is at most 76 columns,
  counting inlay text (`MAX_COLUMNS`), and each step shows at most 14 rows
  (`MAX_ROWS`).
- **Colour**: every line goes through `psychopomp::highlight::typescript`,
  whatever `file_name` says. Other languages get approximate TypeScript
  colours, so check them on a still.

For a few lines of code on a Stage, `StageElement::label(id, at, size, spans)`
draws `(text, Tone)` spans in the bundled monospace face by default.

## Dims and marks (house)

- Judge a dim on a rendered still, not by its number. On drawn labels, an
  opacity of 0.35 read as barely dimmed, the same grey as comments.
- A mark (underline, bracket, tint or caption) on a code row dims with that
  row, and it never points at a row that is dimmed or not yet on screen. Test
  both in the scene.
- Release a walk before the clip's seam, so both sides of the seam show the
  same picture.

## Size limits

- **76 columns × 14 rows** per code state. The diff editor enforces it, and
  the house uses the same limit for any other code display. To fit, condense
  for display: reindent, split a file across states, or leave off a helper
  with a `// …` row. Never invent code. Say so in the footer when code is
  condensed.
- **A Stage holds 1 to 256 elements**, nested ones included, with groups at
  most 8 deep. Element IDs are unique, with no whitespace or dots, and can't
  be `camera` or `post`. Budget the busiest stage early. Draw a muted
  background cast as a few grouped elements, and cut to a fresh stage rather
  than carrying two worlds.

## Code that is proven (house)

- Every displayed line comes from a project that compiles or type-checks (for
  example .NET with warnings as errors, or pyright strict plus pytest).
- Every "won't compile" or "flagged" beat has a probe that records its exact
  error code. Honest gaps (something that still compiles) are recorded too,
  and said in the narration when they matter.
- The scene's tests `include_str!` the sources and assert that each display
  matches them, in order. They also assert that the recorded build output
  shows passing runs.
- Use real types: an `enum` instead of magic strings, and an exhaustive
  `switch` or `match` to pick (`assert_never` in Python).

## Language editions

Upstream `main` has no language switch and no shared per-variant media lock.
A second language edition is a second scene with its own `Media::open`
folder and lock, so its narration is generated, and paid for, separately.
Run plan mode to see that cost before building it.

## Narration content rules (house)

- Plain words, short sentences. Say what happens, then why it matters. Keep
  pattern names and principles ("Open/Closed", "factory", "DI container") in
  presenter notes.
- Pick anchors the voice can't reformat. Avoid acronyms, punctuation and
  very short words (`half`, `once`). Each must occur once in its clip.
- Use "app", not "application", when **Application** is also an anchor.
- Keep every caveat that is true ("nothing stops other code from making one;
  our code makes it in one place").
