# Pacing and code on screen

The first versions of the Abstraction series showed code for a few seconds
and moved on. The user's verdict: "the code went by too fast". The fix
lengthened the films by about 25 %, and every rule below comes from it.

APIs named here exist at engine `91d6cde`. Check their signatures in the
engine source or in `FEATURES.md`.

## Walkthrough rules

- **One sentence, one set of rows.** When the narration names something, light
  its rows (or tokens) and dim the rest. A row bar or highlight band moves to
  the row being talked about.
- **Code goes on screen before the narration talks about it.**
- **Hold before a change.** Keep 1–2 s after the last lit line before the code
  changes or the camera moves. Keep silent holds to 3 s or less.
- **Explain every change.** Never switch to a new code state silently. Say
  *why* (for example, "So take the parts in through the constructor instead…"),
  then light the changed rows. Constructors that ask for interfaces were the
  most common "shown but never explained" code.
- **Connect code to the picture.** Draw a line from a token (`orders.Get`, a
  union member, a `switch` arm) to its card or case.
- **Dense states**: split them into smaller states, or walk them row by row.
  Push the camera in on small editors.
- **New beats without re-voicing**: cut existing clips at pauses between
  sentences (the same audio), and voice short new clips that play between the
  pieces.

## Dims (focus)

| Editor | API | Dim level | Reads on screen as |
| --- | --- | --- | --- |
| IDE diff editor (`editor` root, `editor::diff::Diff`) | `DiffEditor::focus(scene, rows, at)` / `focus_to(…, dim)` / `unfocus(scene, at)` | `DIM` = 0.35 (default) | about 40 % |
| Code drawn on the Stage (one label per row) | the row's `<row>.opacity` channel | **about 0.13** (0.11 on dense panels) | about 40 % |

Stage opacity blends in linear light, so 0.35 on a drawn label reads as about
63 %. That looked "not dimmed", and the dimmed code came out the same grey as
the muted comments. Measure it: 0.13 gave 95/238 ≈ 0.40 on screen. `focus`
eases over `DIM_SECONDS` (0.25 s). Release the walk before the clip's seam, so
both sides of a seam show the same picture.

## Change marks (`+`)

- Put `+` only on rows that really changed in a step, and fade it about 1.5 s
  after it lands. Use `Diff::declare_paced(scene, step_times, warning,
  entrance, ChangeMarks::paced())` instead of `declare`. `paced()` means
  `only_changed: true` and `fade_after: Some(ChangeMarks::FADE_AFTER)`
  (1.5 s).
- A row that is removed and re-added unchanged gets `.unmarked()`. To force a
  mark, use `.marked(mark)`.
- A row added with the same text as a row leaving in the same step is the same
  code, so it gets no `+` (`ChangeMarks` matches them the way `diff` does).

## Marks follow their rows

Waves, brackets, diff tints and bracket captions drawn on a code row must dim
with that row. Otherwise the narration seems to point at a bright mark on a
dim row.

- IDE diff editor: waves and highlight bands already take their row's dim.
- Drawn code: record each mark with `stage::marks::RowMarks::attach`, keep the
  ones on stage with `among`, and after the plan is finished call `follow` to
  rewrite each mark's `opacity`. A mark on several rows takes the brightest
  row. Showing a mark on an already-dim row is refused, which catches a beat
  that points at the wrong row. Connectors and arrows are not Row Marks.

## Syntax colour

- IDE editor: `Syntax::for_file` picks the highlighter from the file name
  (`.cs`/`.csx` C#, `.py`/`.pyi` Python, anything else TypeScript).
  `Diff::declare_as(syntax, …)` overrides it for tabs without an extension.
- Drawn code: `StageElement::code(id, at, size, syntax, line)` makes one
  syntax-coloured label per row on the monospace column grid. Character `c`
  starts at `at.x + c × MONO_ADVANCE × size`, so waves and brackets land on
  their characters. For other multi-span labels, `.columns()` opts into the
  same grid. `Syntax::label_spans(line)` gives the coloured runs.
- Highlighters: `psychopomp::highlight::{typescript, csharp, python}`. They
  are line-local approximations: they don't track multi-line strings or
  comments.
- Strokes and lines take theme tones only, not custom colours. Show colour with
  chips, swatches and tints.

## Size limits

- **76 columns × 14 rows** per code state (the house limit, from STORY.md). To
  fit, condense for display: reindent, split a file across states, or leave
  off a helper with a `// …` row. Never invent code. Say so in the footer when
  code is condensed.
- **128 elements per Stage**. Budget the busiest stage early. Draw a muted
  background cast as a few grouped elements, and cut to a fresh stage rather
  than carrying two worlds.

## Code that is proven

- Every displayed line comes from a project that compiles (`csharp/`, .NET,
  warnings as errors) or type-checks (`python/`, pyright strict, pytest).
- Every "won't compile" or "flagged" beat has a probe recording its exact error
  code. Honest gaps (something that still compiles) are recorded too, and said
  in the narration when they matter.
- The scene's tests `include_str!("../csharp/…")` the sources and assert that
  each display matches them, in order. They also assert `expected.txt` shows
  the runs passed.
- Use real types: an `enum` (`PriceMode.Outage`, `Provider(Enum)`) instead of
  magic strings, and pick with a `switch`/`match` that's exhaustive
  (`assert_never` in Python).

## Two editions from one scene

One Scene Program tells the same story in C# (default) and Python:

```rust
use psychopomp::lang::Lang;
let lang = Lang::current();                    // PSYCHOPOMP_LANG = csharp (default) | python; panics on others
let reel = ReelPlan::new(lang.id("strategy"), segments)?;      // "strategy" / "strategy-python"
let tab  = lang.pick("Checkout.cs", "checkout.py");
let row  = lang.pick(3, 4);                    // aim highlights per edition
let media = Media::open_variant(root, lang.variant())?;        // media.lock.json / media.python.lock.json
StageElement::code(id, at, size, lang.syntax(), line);
```

- The narration is **identical where possible**, so it is voiced once: the
  Python lock reuses any clip whose key (text, voice, settings) is already in a
  sibling lock, for free. Only differing text is voiced, into its own lock.
  Neither edition writes the other's lock, and `prune` keeps any file that any
  lock references.
- The narration never says "C#", "Python", "compile", "build" or "type checker"
  in shared clips. Say "check a mode" and "case", which fit both `switch` and
  `match`. An edition-only clip may differ (for example a type-checker remark
  in Python).
- Keep the honest limits per edition. Python models aren't immutable, and
  nothing stops other code from constructing a type. Change the narration
  rather than overstate.
- Display states have the same length, or are within one row, so one piece of
  choreography fits both editions.
- Add a `verify.json` entry per edition with `"env": { "PSYCHOPOMP_LANG":
  "python" }`. `verify` never passes the shell's value through.
- Commands: `PSYCHOPOMP_LANG=python PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`
  (expect 0 to voice when the narration is shared), then
  `PSYCHOPOMP_LANG=python cargo run -p <crate>` → `<name>-python.reel.json`.

## Narration content rules

- Plain words, short sentences. Say what happens, then why it matters. Keep
  pattern names and principles ("Open/Closed", "factory", "DI container") in
  presenter notes.
- Pick anchors the voice can't reformat. Avoid acronyms, punctuation and
  very short words (`half`, `once`). They must be unique within their clip.
- Use "app", not "application", when **Application** is also an anchor.
- Keep every caveat that is true ("nothing stops other code from making one;
  our code makes it in one place").
