# Using psychopomp from your own Rust project

Checked against engine commit `91d6cde44fa0fb9e9f46e45e4de0215292f50311`
(`grenaad/psychopomp`, branch `performance`). It was built, emitted, rendered
and verified in a scratch workspace, and the Abstraction series' move-out proof
did the same at full scale. The engine skill's section "Use psychopomp from your
own project" covers the same ground from the engine's side. It was added in
commit `8cd4a64` on `performance`, which had not been pushed when this was written.

## What you need

- Rust (edition 2024), `cargo`, and `jq`.
- `ffmpeg` with `libx264` on `PATH`. The renderer pipes frames into it.
- A working `wgpu` adapter (on macOS, Metal).
- Optional: ImageMagick (`magick`) for contact sheets. macOS `say` for draft
  narration (`PSYCHOPOMP_MEDIA=draft`).

## 1. Layout

```text
films/                         workspace root
  Cargo.toml  Cargo.lock  verify.json  .gitignore
  assets/<group>/<file>.wav    engine sounds your plans play (copied)
  scenes/<name>/               one crate per film, EXACTLY two levels down
    Cargo.toml  src/main.rs
    <name>.plan.json | <name>.reel.json   emitted, committed
    media.lock.json  media/*.mp3          narration cache, committed
  target/  output/             ignored
```

Why exactly two levels: the renderer resolves a plan's media paths against
the plan file's folder. The engine's `psychopomp::sfx` catalog writes its
sounds as `../../assets/<file>.wav` (`crates/psychopomp/src/sfx.rs`). With a
scene at `scenes/<name>/`, that resolves to `<root>/assets/`. Don't nest
reels as `reels/x/scenes/y` under one workspace. Use one workspace per series
instead.

## 2. Workspace `Cargo.toml`

```toml
[workspace]
members = ["scenes/*"]
resolver = "3"

[workspace.package]
edition = "2024"
license = "MIT"

[workspace.dependencies]
psychopomp = { git = "https://github.com/grenaad/psychopomp", rev = "91d6cde44fa0fb9e9f46e45e4de0215292f50311" }
psychopomp-media = { git = "https://github.com/grenaad/psychopomp", rev = "91d6cde44fa0fb9e9f46e45e4de0215292f50311" }
anyhow = "1.0"
serde_json = "1.0"
```

- Pin **both** libraries to the **same full 40-character** `rev`. Don't use a
  branch: a branch moves, and the renderer won't.
- Optional: copy the engine's `Cargo.lock` into the workspace before the first
  build, to keep its dependency versions (and its CA pins). A fresh lock also
  worked: the Abstraction series' reels came out byte-identical either way.
- The pinned commit must stay fetchable. Never force-push over it. Tagging
  each pinned commit is a cheap guard.

## 3. One scene crate

`scenes/hello/Cargo.toml`:

```toml
[package]
name = "hello"
version = "0.1.0"
edition.workspace = true
license.workspace = true

[dependencies]
anyhow.workspace = true
psychopomp.workspace = true
serde_json.workspace = true
# psychopomp-media.workspace = true   # when narrated
```

`scenes/hello/src/main.rs` builds as shown at `91d6cde`:

```rust
use std::{fs, path::PathBuf};

use psychopomp::{
    author::{PlanBuilder, SECOND},
    sfx,
    stage::{StageActor, StageElement, StagePlan},
};

fn main() -> anyhow::Result<()> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let plan = StagePlan {
        post: Default::default(),
        elements: vec![
            StageElement::card("client", [560.0, 540.0, 0.0], [300.0, 110.0], "client"),
            StageElement::orb("server", [1360.0, 540.0, 0.0], 140.0),
            StageElement::beam("link", "client", "server"),
            StageElement::packet("hello", "link").labeled("GET /hello"),
        ],
    };
    let mut scene = PlanBuilder::new("hello", 4 * SECOND);
    let mut stage = StageActor::declare(&mut scene, "stage", &plan)?;
    let ready = stage.settle_in(&mut scene, "client", 0);
    let wired = stage.connect(&mut scene, "link", ready, 0.6);
    let landed = stage.send(&mut scene, "hello", wired + SECOND / 2, 0.8);
    stage.land(&mut scene, "server", landed);
    sfx::CONFIRM.play(&mut scene, "confirm", landed, -18.0); // ../../assets/opencode-hot-reload/confirm.wav
    fs::write(root.join("hello.plan.json"), serde_json::to_string_pretty(&scene.finish()?)? + "\n")?;
    Ok(())
}
```

Write plans beside the crate (`CARGO_MANIFEST_DIR`), not into the current
directory: then the `../../assets` paths hold no matter where you run from.

### Narrated scene

```rust
use psychopomp_media::{Media, Voice};

let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
let media = Media::open(&root)?;              // media.lock.json + media/ beside Cargo.toml
let voice = Voice::eleven("<voice-id>").v4().stability(0.5).similarity(0.75).format("mp3_44100_128");
let line = media.say("intro", &voice,
    "[warm, conversational voice] The client sends one request, and the server answers.")?;
media.finish()?;                               // prints the delta; in plan mode fails if audio is missing

let lead = SECOND / 2;
let mut scene = PlanBuilder::new("narrated", lead + line.duration() + SECOND);
let spoken = line.place(&mut scene, lead);
// … declare the stage …
stage.settle_in(&mut scene, "client", spoken.at("client"));   // panics if the phrase isn't spoken
stage.send(&mut scene, "request", spoken.at("sends"), 0.8);
```

Two language editions: open
`Media::open_variant(&root, psychopomp::lang::Lang::current().variant())`.
See [pacing-and-code.md](pacing-and-code.md#two-editions-from-one-scene).

### Sounds

`psychopomp::sfx::*` (`TICK`, `SEND`, `CONFIRM`, `IMPACT`, `GLITCH`,
`WHOOSH`, …) all point at `../../assets/…`. Copy the files you use from the
engine's `assets/`, which is also in Cargo's checkout of your commit:

```sh
ENGINE=$(dirname "$(dirname "$(dirname "$(cargo metadata --format-version 1 \
  | jq -r '.packages[] | select(.name=="psychopomp") | .manifest_path')")")")
for f in $(grep -oh '"\.\./\.\./assets/[^"]*"' scenes/*/*.json | tr -d '"' | sed 's|^\.\./\.\./||' | sort -u); do
  mkdir -p "$(dirname "$f")" && cp "$ENGINE/$f" "$f"
done
```

A missing sound file fails the render with only `Broken pipe (os error 32)`
from ffmpeg. For your own sounds, use `Sfx::new(path, length)`, with the path
relative to the plan file.

## 4. Install the renderer at the same commit

```sh
cargo install --locked --git https://github.com/grenaad/psychopomp \
  --rev 91d6cde44fa0fb9e9f46e45e4de0215292f50311 psychopomp-render
```

This takes about 1 minute (4 jobs, M1 Pro) and installs `~/.cargo/bin/psychopomp`.
Add `--root DIR` to install somewhere else.

**Check which commit is installed.** At `91d6cde` the renderer has no
`--version`, `-V` or `--help`. Any single argument is an output path, so
`psychopomp --version` renders the demo film to `./--version`. Use:

```sh
jq -r '.installs | keys[] | select(startswith("psychopomp-render "))' ~/.cargo/.crates2.json
# psychopomp-render 0.1.0 (git+https://github.com/grenaad/psychopomp?rev=<sha>#<sha>)
cargo install --list | grep -A1 psychopomp-render     # same, short hash
awk '/^name = "psychopomp"$/{f=1;next} f&&/^source/{print;exit}' Cargo.lock   # what the libraries use
```

The two commits must match. A later engine commit may add `--version`. Until
you have confirmed that it exists, only run an unknown `psychopomp` binary with
two or more arguments (`psychopomp plan …`). With two unknown arguments it
prints its usage.

## 5. Emit, check, render

Run everything from the workspace root:

```sh
cargo run -p hello                                   # writes scenes/hello/hello.plan.json
psychopomp plan validate scenes/hello/hello.plan.json
psychopomp plan inspect  scenes/hello/hello.plan.json
psychopomp plan frame    scenes/hello/hello.plan.json 2 output/hello-2.png --theme neutral --shutter
psychopomp plan snapshot scenes/hello/hello.plan.json 0:4:0.5 output/hello-frames --theme neutral
psychopomp plan render   scenes/hello/hello.plan.json output/hello.mp4 --theme neutral   # or --range a..b / --cue ID
```

Themes: `neutral`, `black`, `opencode`, `original`. The engine repo's
`bun scripts/sheet.ts` builds the engine from its own checkout, so it can't be
used here. Make sheets from `plan snapshot` with `magick montage` instead (see
[rendering-and-ops.md](rendering-and-ops.md#stills-and-contact-sheets)).

## 6. `verify.json`

```json
{
  "theme": "neutral",
  "scenes": [
    { "name": "hello", "package": "hello", "plan": "scenes/hello/hello.plan.json", "times": [0.5, 1.5, 3] },
    { "name": "hello-python", "package": "hello", "env": { "PSYCHOPOMP_LANG": "python" },
      "plan": "scenes/hello/hello-python.plan.json", "theme": "black", "times": [0.5, 1.5, 3] }
  ]
}
```

```sh
psychopomp verify baseline --manifest verify.json            # before a change
psychopomp verify compare  --manifest verify.json --expect hello
```

- The manifest's folder is the root. `verify` runs `cargo build --profile dev -p
  <package>` there, runs each program with `PSYCHOPOMP_MEDIA=plan` and the
  entry's `env`, reads `plan` relative to the root, and renders the `times`.
- Results go to `<root>/target/verify/<label>`. An argument containing a `/` is
  a directory. Plans are recorded with `$ROOT`, so one baseline serves every
  worktree.
- Per-scene keys: `args`, `env`, `theme`, `times`, `shutter`, `requires`.
- Without `--manifest`, `verify` looks for `verify.json` in the current
  directory.

## 7. Working on the engine at the same time

Override the git source with a local checkout. Put this in the workspace
`Cargo.toml`, or in an **untracked** `.cargo/config.toml`, with paths relative
to the workspace root:

```toml
[patch."https://github.com/grenaad/psychopomp"]
psychopomp = { path = "../psychopomp/crates/psychopomp" }
psychopomp-media = { path = "../psychopomp/crates/psychopomp-media" }
```

1. Install that checkout's renderer:
   `cargo install --path ../psychopomp/crates/psychopomp-render`.
2. While patched, `Cargo.lock`'s `psychopomp` entry has no `source`.
3. When the engine change is done: commit and push it, remove the patch, set
   both `rev`s to the new commit, run `cargo update -p psychopomp -p
   psychopomp-media`, reinstall the renderer at that commit, regenerate every
   plan, and `verify compare --expect …` against a baseline from before.

## 8. Caveats

- **Footage cache.** The renderer caches decoded video footage in
  `<engine source>/target/psychopomp-cache/footage`. For an installed renderer
  that is `~/.cargo/git/checkouts/psychopomp-*/<short-rev>/target/…`, which
  Cargo never cleans. It reached about 10 GB per commit in a test over the
  engine's footage scenes. Delete it when you are done. Films without
  `footage` don't write it.
- **Render slot.** `plan render` waits for a machine-wide lock
  (`$TMPDIR/psychopomp-render-N.lock`), shared by every psychopomp on the
  machine. `PSYCHOPOMP_RENDER_SLOTS=2` allows two, and `0` skips the queue.
  `frame`, `snapshot` and `verify` never wait.
- **API keys.** They come from `ELEVENLABS_API_KEY` / `FISH_AUDIO_API_KEY`, or
  the nearest `.env` **above the scene folder**. Moving a workspace can change
  which `.env` is found (for example `~/.env`). Never commit one.
- **Float digits.** Release and dev builds can differ in a plan's last float
  digit. Always emit with `cargo run` (dev), as `verify` does.
- **Docs at your commit.** Read the engine skills and docs from Cargo's
  checkout (see SKILL.md). Copying them into the workspace is fine. If you do,
  record the commit next to them and refresh them whenever the pin moves.
- **`psychopomp-media` CLI** (`adopt`, `show`): install it the same way
  (`cargo install --locked --git … --rev … psychopomp-media`) if you need it.

## Optional helper

The Abstraction series' planned `scripts/engine.sh`
(`~/projects/arch_presentation/reels/interfaces/plans/move-out/proof/workspace/scripts/engine.sh`)
wraps this: `rev`, `install`, `check` (renderer commit equals the lock), `bump
REV`, and `docs` (copies the engine skills and docs at the locked commit). It
was tested in scratch only. Copy it if you want it, and adjust its `URL`.
