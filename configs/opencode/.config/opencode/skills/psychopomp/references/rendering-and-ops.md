# Rendering and operations

Checked against `a32d347`. A full render exposes every frame through the
motion-blur shutter (24 temporal samples), so it is slow. `--draft` takes one
sample per frame. The machine is shared with other agents. Time a short
`--range` window before you estimate a full render.

Commands are written for an **installed** renderer (`psychopomp …`). Inside
the engine repository, use `cargo run --release -- …` instead, as `AGENTS.md`
does.

## CLI at a32d347

These are the engine's own usage strings:

```text
psychopomp plan validate <plan.json>
psychopomp plan inspect <plan.json>
psychopomp plan check <plan-or-reel.json> [range] [--every SPEC] [--pops] [--audio] [--fail-on error|warning|never] [--theme NAME]
psychopomp plan audio <plan-or-reel.json> [range] [--at TIMES]
psychopomp plan frame <plan-or-reel.json> <time[,time...]> [output.png|dir] [--crop x,y,w,h] [--shutter] [--theme NAME]
psychopomp plan strip <plan-or-reel.json> [range|times] [output.png] [-n COUNT] [--cols N] [--width PX] [--crop x,y,w,h] [--shutter] [--theme NAME]
psychopomp plan onion <plan-or-reel.json> <range | a,b,c | from:to:step> [output.png] [--shutter] [--theme NAME]
psychopomp plan snapshot <plan-or-reel.json> <a,b,c | from:to:step> <dir> [--compare] [--shutter] [--theme NAME]
psychopomp plan render <plan-or-reel.json> [output] [--cue ID | --range SPEC] [--theme NAME] [--draft]
psychopomp verify baseline [LABEL] [--manifest FILE] [--out DIR] [--only NAME,..]
psychopomp verify compare [LABEL | DIR] [--manifest FILE] [--out DIR] [--only NAME,..] [--expect NAME,..]
```

- `plan validate` accepts a reel too. The CLI also has `plan steps`,
  `plan diff <before.json> <after.json>`, `plan schema`, `plan present`,
  `plan serve` and `plan motion-gate`.
- `plan check` checks the whole plan by default, every `0.25s`, and fails on
  errors (`--fail-on error`). Without flags it reports `nan_pose` (an error),
  `card_text_overflow` and `clipped_by_canvas` (warnings), and `off_canvas`
  (information). `--pops` adds one-frame step and flash findings. Audio is
  checked only with `--audio`: `missing_audio` (an error), `audio_clipping`
  (a warning), and integrated LUFS and true peak, which never fail.
- `plan render` without an output writes `output/scene-plan.mp4`. `--draft`
  skips the shutter: use it for timing and audio, not to judge motion blur.
- `--theme` defaults to `original`. For the time and range syntax, see
  [project-setup.md](project-setup.md#5-emit-check-render).

## Before a long render

- **Check cheap first**: `plan validate`, `plan check <reel> --pops --audio`,
  `plan strip`, `plan frame`, and `plan render <reel> out.mp4 --range a..b` (or
  `--cue <id>`) windows with sound around motion and seams. Run
  `verify compare`.
- **Disk**: run `df -h .` first. The big consumers are Cargo `target/`
  folders, `target/verify`, the footage cache
  ([project-setup.md](project-setup.md#8-caveats)), and kept MP4s. Leave room
  for a full MP4 and a mastered copy at the same time.
- **Back up the previous render**: `mv output/x.mp4 output/x-pre-<pass>.mp4`,
  and do the same for its stills folder (`output/x-stills/pre-<pass>/`). Name
  the pass (`pre-pacing`, `pre-colour`), not a date.
- **Render slot**: `plan render` waits for one machine-wide slot
  (`psychopomp-render-N.lock` in the temp folder) and names the process that
  holds it. `PSYCHOPOMP_RENDER_SLOTS=2` allows two at once, and `0` skips the
  queue. Two renders at once each run at about half speed.
- Cap builds with `CARGO_BUILD_JOBS=4` and `nice -n 10` when others share the
  machine.

## Long jobs: detached, logged, resumable

Agent sessions and terminals get restarted, and a render attached to them dies
with them. Run long work as a script started with `nohup`, writing a log. Make
it resumable: it skips finished items and never leaves a half-written file at
the final path.

```bash
#!/usr/bin/env bash
# render-all.sh: render, master and still each part; safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"
for part in intro outro; do
  out=output/$part.mp4
  [[ -f output/$part.done ]] && { echo "skip $part"; continue; }
  [[ -f $out ]] && mv "$out" "output/$part-pre-pass.mp4"          # back up once
  psychopomp plan render "scenes/$part/$part.reel.json" "output/$part.partial.mp4" --theme neutral
  ffmpeg -v error -y -i "output/$part.partial.mp4" -c:v copy \
    -af 'loudnorm=I=-16:TP=-1.5:LRA=11,apad' -c:a aac -b:a 192k -ar 48000 -shortest \
    -movflags +faststart "output/$part.mastered.mp4"
  mv "output/$part.mastered.mp4" "$out" && rm "output/$part.partial.mp4"
  touch "output/$part.done"
done
```

```sh
nohup ./render-all.sh > output/render-all.log 2>&1 &
tail -f output/render-all.log
```

- Delete the `.done` markers when you start a new pass.
- An agent should not end its turn while a foreground render runs, because it
  won't be resumed. Either keep the render in the foreground with a long
  timeout, or detach it as above and check the log later.
- Don't pipe a foreground render into `tail`, which shows nothing until the
  end. Use `set -o pipefail; … 2>&1 | tee output/x.render.log`.

## Mastering (audio only)

The video stream is copied bit for bit. Only the audio is normalised:

```sh
ffmpeg -i output/x.mp4 -c:v copy -af 'loudnorm=I=-16:TP=-1.5:LRA=11,apad' \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart output/x.mastered.mp4
mv output/x.mastered.mp4 output/x.mp4
ffmpeg -i output/x.mp4 -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -   # measure
```

Expect about −16 LUFS integrated, with true peak under −1 dBTP. The duration
must not change (`apad` + `-shortest`). The engine already normalises each
generated speech clip and muxes the film's audio as AAC at 192 kbps.
Mastering is the house step that evens out the whole mix, sound effects
included.

## Checks on the rendered file

```sh
ffprobe -v error -show_streams -show_format output/x.mp4
```

- The plan's canvas and frame rate (1920×1080 at 60 fps by default), H.264
  (yuv420p) and AAC.
- The duration matches the plan. `plan inspect` prints `durationNanos` for a
  Scene Plan.
- These numbers prove the file exists, not that it is right. Look at stills,
  and listen to (or transcribe) the seams and anchors.

## Stills and contact sheets

Before rendering, from the plan:

```sh
psychopomp plan strip <reel> all output/strip.png -n 16 --cols 4 --shutter   # one contact sheet
psychopomp plan frame <reel> "intro@2s,intro@end" output/stills --shutter    # full-size stills
psychopomp plan onion <reel> intro output/intro-onion.png --shutter          # motion in one image
```

After rendering, take stills from the **rendered MP4** at every code state,
every anchor (about 0.7 s after it), every seam, and the end card:

```sh
mkdir -p output/x-stills
for t in 47.2 66.5 78 105.8; do
  ffmpeg -v error -y -ss "$t" -i output/x.mp4 -frames:v 1 "output/x-stills/$t.png"
done
magick montage output/x-stills/*.png -tile 4x -geometry 960x540+6+6 -background '#111' output/x-stills/sheet.jpg
```

Then **open and look at them**. Sheet cells are small, so read text in
full-size frames or in crops (`plan frame … --crop x,y,w,h`). Stills can't
prove motion: check motion in normal-speed `--range` windows and in frames
40 ms or less apart.

## `verify`

```sh
psychopomp verify baseline --manifest verify.json            # before the change
# … change code, regenerate with PSYCHOPOMP_MEDIA=plan cargo run -p <crate> …
psychopomp verify compare --manifest verify.json --expect intro,outro
```

- It builds and re-runs every Scene Program in the manifest with the dev
  profile and `PSYCHOPOMP_MEDIA=plan`. It compares the plan bytes, with a
  summary of what changed, and the key frames.
- **Only the scenes you expected may change.** An unexpected change fails the
  command. "expected to change but identical" is only printed, so read the
  output. Both mean stop and look.
- To share one baseline across agents and worktrees, run `verify baseline
  --out <dir>` once on the base commit, and have each agent run
  `verify compare <dir>`.

## Joining parts

For a series joined from separately rendered parts:

1. Normalise each part's loudness before joining. Measure with `loudnorm`,
   then apply one static gain plus a true-peak limiter (for example a
   4×-oversampled `alimiter`), and measure again. `loudnorm`'s linear second
   pass can refuse, and its dynamic fallback came out 0.3–0.6 LU short.
2. Pad every part's audio to exactly its video length.
3. Join with an ffconcat list: video stream-copied, audio encoded once. If
   the parts' H.264 headers differ, re-encode once.
4. Check the result: frame count, A/V length, a decode without warnings, each
   part's first and last frame identical to its source, silence at the joins,
   and the loudness per part.

The join never renders or re-voices a part. A missing part should fail with
the command that renders it.
