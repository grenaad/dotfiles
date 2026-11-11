# Using psychopomp from your own Rust project

Checked against upstream `kitlangton/psychopomp` `main` at `a32d347`. The Rust
below was checked against that commit's source, but it hasn't been compiled
for this skill. Build the hello scene once before you rely on the setup. The
engine README's quick start is the in-repo version of the same example.

## What you need

- Rust with edition 2024 support, `cargo`, and `jq`.
- `ffmpeg` with `libx264` on `PATH`. The renderer pipes frames into it.
- A GPU the renderer can use through `wgpu` (Metal on macOS).
- Optional: macOS `say` for draft narration (`PSYCHOPOMP_MEDIA=draft`), and
  ImageMagick (`magick`) for montages of video stills.

## 1. Layout

```text
films/                         workspace root
  Cargo.toml  Cargo.lock  verify.json  .gitignore
  assets/<group>/<file>.wav    engine sounds your plans play (copied)
  scenes/<name>/               one crate per film, EXACTLY two levels down
    Cargo.toml  src/main.rs
    <name>.plan.json | <name>.reel.json   emitted, committed
    media.lock.json  media/               narration cache, committed
  target/  output/             ignored
```

The renderer resolves a plan's media paths against the plan file's folder.
`psychopomp::sfx` names its sounds `../../assets/<file>`, written for a plan
that sits beside its Scene Program in `scenes/<name>/`. Don't nest scenes
deeper (for example `reels/x/scenes/y`). Use one workspace per series instead.

## 2. Workspace `Cargo.toml`

```toml
[workspace]
members = ["scenes/*"]
resolver = "3"

[workspace.package]
edition = "2024"
license = "MIT"

[workspace.dependencies]
psychopomp = { git = "https://github.com/kitlangton/psychopomp", rev = "<full commit on main>" }
psychopomp-media = { git = "https://github.com/kitlangton/psychopomp", rev = "<the same commit>" }
anyhow = "1.0"
serde_json = "1.0"
```

- Pin **both** libraries to the **same full 40-character** commit from
  upstream `main`. The audited one is
  `a32d347d5bf5d901cc66c738ed126b62411072bb`. Don't use a branch: a branch
  moves, and the installed renderer won't.
- Optional: copy the engine's `Cargo.lock` into the workspace before the first
  build, to keep its dependency versions.

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

`scenes/hello/src/main.rs` (every call checked against `a32d347`):

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

Times are nanoseconds (`SECOND`). The last argument of `connect` and `send` is
a duration in seconds. Write plans beside the crate (`CARGO_MANIFEST_DIR`),
not into the current directory: then the `../../assets` paths hold no matter
where you run from.

### Narrated scene

```rust
use psychopomp_media::{Media, Voice};

let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
let media = Media::open(&root)?;              // media.lock.json + media/ beside Cargo.toml
let voice = Voice::eleven("<voice-id>")       // eleven_v4 is the default model
    .stability(0.5)
    .similarity(0.75)
    .format("mp3_44100_128");                 // see voice-and-credits.md, "House voice"
let line = media.say("intro", &voice,
    "[warm, conversational voice] The client sends one request, and the server answers.")?;
media.finish()?;                               // prints + ~ =; in plan mode fails if anything needs generating

let lead = SECOND / 2;
let mut scene = PlanBuilder::new("narrated", lead + line.duration() + SECOND);
let spoken = line.place(&mut scene, lead);
// … declare the stage …
stage.settle_in(&mut scene, "client", spoken.at("client"));   // first match; panics if never said
stage.send(&mut scene, "request", spoken.at("sends"), 0.8);
```

Add `psychopomp-media.workspace = true` to the scene's dependencies. Run it
with `PSYCHOPOMP_MEDIA=plan` until you decide to voice
([voice-and-credits.md](voice-and-credits.md)).

### Sounds

`psychopomp::sfx` has `TICK`, `SEND`, `CONFIRM`, `MARK`, `IMPACT`, `GLITCH`,
`WHOOSH` and more (`crates/psychopomp/src/sfx.rs`), all at `../../assets/…`.
Copy the files you use from the engine's `assets/`, which is also in Cargo's
checkout of your commit:

```sh
ENGINE=$(dirname "$(dirname "$(dirname "$(cargo metadata --format-version 1 \
  | jq -r '.packages[] | select(.name=="psychopomp") | .manifest_path')")")")
for f in $(grep -oh '"\.\./\.\./assets/[^"]*"' scenes/*/*.json | tr -d '"' | sed 's|^\.\./\.\./||' | sort -u); do
  mkdir -p "$(dirname "$f")" && cp "$ENGINE/$f" "$f"
done
```

Then run `psychopomp plan check <plan> --audio`. Only with `--audio` does it
look for audio files, and it reports a missing one as a `missing_audio`
error. A render with a missing sound has failed with nothing but
`Broken pipe (os error 32)` from ffmpeg. For your own sounds, use
`Sfx::new(path, length)`, with the path relative to the plan file and the
length in nanoseconds.

## 4. Install the renderer

```sh
cargo install --locked --git https://github.com/kitlangton/psychopomp \
  --rev <the same commit> psychopomp-render
```

This installs `~/.cargo/bin/psychopomp`. If another psychopomp is already
there (for example a fork build that an older workspace uses), install this
one with `--root DIR` and call `DIR/bin/psychopomp` by path.

**Check which commit is installed.** At `a32d347` the renderer has no
`--version` or `--help`. A single argument is an output path, so
`psychopomp --version` renders the built-in demo film to a file named
`--version`. Read Cargo's install record instead:

```sh
jq -r '.installs | keys[] | select(startswith("psychopomp-render "))' ~/.cargo/.crates2.json
# psychopomp-render 0.1.0 (git+https://github.com/kitlangton/psychopomp?rev=<sha>#<sha>)
cargo install --list | grep -A1 psychopomp-render       # add --root DIR for a separate install
awk '/^name = "psychopomp"$/{f=1;next} f&&/^source/{print;exit}' Cargo.lock   # what the libraries use
```

The two commits must match. Run an unknown `psychopomp` binary only with two
or more arguments (`psychopomp plan …`). Two arguments it doesn't know make it
print its usage.

## 5. Emit, check, render

Run everything from the workspace root:

```sh
PSYCHOPOMP_MEDIA=plan cargo run -p hello              # writes scenes/hello/hello.plan.json
psychopomp plan validate scenes/hello/hello.plan.json
psychopomp plan check    scenes/hello/hello.plan.json --pops --audio --theme neutral
psychopomp plan strip    scenes/hello/hello.plan.json all output/hello-strip.png -n 8 --cols 4 --shutter --theme neutral
psychopomp plan frame    scenes/hello/hello.plan.json 1,2.5,3.5 output/hello-stills --shutter --theme neutral
psychopomp plan render   scenes/hello/hello.plan.json output/hello.mp4 --theme neutral   # or --range 1..3, --cue ID, --draft
```

- Plan mode costs nothing in a scene without narration, and it keeps the habit
  safe.
- Themes: `original` (the default), `evergreen`, `tokyo-night`, `black`,
  `opencode`, `neutral`.
- Times: seconds (`2.5`, `2.5s`, `500ms`, `1:05.5`), frames (`120f`), `50%`,
  `start`, `end`, a segment or cue (`intro`, `#2`, `intro[1]`), or an offset
  into one (`intro@1.2s`, `intro@50%`, `intro@end`). Ranges: `all`, `intro`,
  `a..b`, `a..` and `..b`.
- Every command and flag:
  [rendering-and-ops.md](rendering-and-ops.md#cli-at-a32d347).

## 6. `verify.json`

```json
{
  "theme": "neutral",
  "scenes": [
    { "name": "hello", "package": "hello", "plan": "scenes/hello/hello.plan.json", "times": [0.5, 1.5, 3] }
  ]
}
```

```sh
psychopomp verify baseline --manifest verify.json            # before a change
psychopomp verify compare  --manifest verify.json --expect hello
```

- The manifest's folder is the root. `verify` builds each package there with
  the dev profile, runs each program with `PSYCHOPOMP_MEDIA=plan`, reads
  `plan` relative to the manifest, and renders `times` (seconds). Times in
  `shutter` are rendered through the export shutter.
- Keys: `theme` and `scenes` at the top. Per scene: `name`, `package`, `plan`
  and `times`, plus optional `args`, `shutter`, `theme` and `requires`.
  Unknown keys are rejected.
- Results go to `<root>/target/verify/<label>` (`baseline` by default, and
  `compare` writes `current`). A positional argument that contains `/` is a
  directory. Paths under the root are recorded as `$ROOT`, so worktrees can
  share one baseline.
- An unexpected change fails (`changed unexpectedly: …`). A scene named in
  `--expect` that didn't change only prints `expected to change but
  identical: …`, and the exit status is still 0. Read the output.

## 7. Working on the engine at the same time

Override the git source with a local checkout. Put this in the workspace
`Cargo.toml`, or in an **untracked** `.cargo/config.toml`, with paths relative
to the workspace root:

```toml
[patch."https://github.com/kitlangton/psychopomp"]
psychopomp = { path = "../psychopomp/crates/psychopomp" }
psychopomp-media = { path = "../psychopomp/crates/psychopomp-media" }
```

1. Install that checkout's renderer:
   `cargo install --path ../psychopomp/crates/psychopomp-render` (add
   `--root DIR` to keep it apart from other installs).
2. While patched, `Cargo.lock`'s `psychopomp` entry has no `source`.
3. When the change is on upstream `main`: remove the patch, set both `rev`s to
   that commit, run `cargo update -p psychopomp -p psychopomp-media`,
   reinstall the renderer at that commit, regenerate every plan with
   `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`, and run
   `verify compare --expect …` against a baseline from before.

## 8. Caveats

- **Footage cache.** The renderer caches decoded footage in the `target/`
  folder of the engine source it was built from:
  `<engine source>/target/psychopomp-cache/footage`. For `cargo install --git`,
  that is in Cargo's checkout,
  `~/.cargo/git/checkouts/psychopomp-*/<short-rev>/target/psychopomp-cache/footage`,
  which Cargo never cleans. It has reached about 10 GB per commit. It is safe
  to delete and refills when needed. Films without footage don't write it.
  `PSYCHOPOMP_FOOTAGE_CACHE_MB` sets the decoded-frame memory budget (default
  384).
- **Render slot.** `plan render` waits for a machine-wide lock
  (`psychopomp-render-N.lock` in the temp folder, `$TMPDIR` on macOS), shared
  by every psychopomp on the machine. `PSYCHOPOMP_RENDER_SLOTS=2` allows two,
  and `0` skips the queue. Frames, snapshots and `verify` don't wait.
- **API keys.** `ELEVENLABS_API_KEY` (and `FISH_AUDIO_API_KEY` for Fish
  voices) comes from the environment, or else from the nearest `.env` that
  defines it, in the scene folder or any folder above it, up to `/`. Moving a
  workspace can
  change which `.env` is found. Never open, print or commit one.
- **Float digits.** Release and dev builds can differ in a plan's last float
  digit. Always emit in the dev profile, with
  `PSYCHOPOMP_MEDIA=plan cargo run -p <crate>`, as `verify` does.
- **Docs at your commit.** Read the engine skills and docs at your pin (see
  SKILL.md). If you copy them into the workspace, record the commit next to
  them and refresh them whenever the pin moves.
- **`psychopomp-media` CLI** (`adopt`, `show`): install it the same way
  (`cargo install --locked --git … --rev … psychopomp-media`) if you need it.
