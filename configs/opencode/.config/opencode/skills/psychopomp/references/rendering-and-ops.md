# Rendering and operations

Full renders are slow. A 7.7-minute film took about 45 minutes on an M1 Pro
(24 temporal samples), and a pass over 12 films took about 5 hours. The
machine is shared with other agents. Plan for both.

Commands are written for an **installed** renderer (`psychopomp …`). Inside
the engine repository, use `cargo run --release -- …` instead.

## Before a long render

- **Check cheap first**: `plan validate`, `plan frame`, contact sheets, and
  `plan render <reel> out.mp4 --range a..b` (or `--cue <segment-id>`) windows
  with sound around motion and seams. Run `verify compare`.
- **Disk**: run `df -h .` first. The big consumers are the Cargo `target/`
  folders (the engine repo's reached 19 GB), verify output, the footage cache
  in Cargo's checkout (see project-setup.md), and kept MP4s (about 35 MB per
  4–8 minute film). Leave room for a full MP4 and a mastered copy at the same
  time.
- **Back up the previous render**: `mv output/x.mp4 output/x-pre-<pass>.mp4`,
  and do the same for its stills folder (`output/x-stills/pre-<pass>/`). Name
  the pass (`pre-pacing`, `pre-colour`, `pre-underline`), not a date.
- **Render slot**: `plan render` waits for one machine-wide slot
  (`$TMPDIR/psychopomp-render-N.lock`) and names the PID holding it.
  `PSYCHOPOMP_RENDER_SLOTS=2` allows two at once, and `0` skips the queue. Two
  renders at once each run at about half speed.
- Cap builds with `CARGO_BUILD_JOBS=4` and `nice -n 10` when others share the
  machine.

## Detached, logged, resumable jobs

Agent sessions and terminals get restarted, and a render attached to them dies
with them. Run long work as a script started with `nohup`, writing a log. Make
it resumable: it skips finished items and never leaves a half-written file at
the final path.

```bash
#!/usr/bin/env bash
# render-all.sh: render, master and still each part; safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"
for part in strategy coupling; do
  out=output/$part.mp4
  [[ -f output/$part.done ]] && { echo "skip $part"; continue; }
  [[ -f $out ]] && mv "$out" "output/$part-pre-colour.mp4"          # back up once
  psychopomp plan render "scenes/$part/$part.reel.json" "output/$part.partial.mp4" --theme black
  ffmpeg -v error -y -i "output/$part.partial.mp4" -c:v copy \
    -af 'loudnorm=I=-16:TP=-1.5:LRA=11,apad' -c:a aac -b:a 192k -ar 48000 -shortest \
    -movflags +faststart "output/$part.mastered.mp4"
  mv "output/$part.mastered.mp4" "$out" && rm "output/$part.partial.mp4"
  touch "output/$part.done"
done
```

```sh
nohup ./render-all.sh > output/render-all.log 2>&1 &
tail -f output/render-all.log      # progress is printed once per second of output
```

- Delete the `.done` markers when you start a new pass.
- An agent should not end its turn while a foreground render runs, because it
  will not be resumed. Either keep it in the foreground with a long timeout,
  or detach it as above and check the log later.
- Don't pipe a foreground render into `tail`, which shows nothing until the end.
  Use `set -o pipefail; … 2>&1 | tee output/x.render.log`.

## Mastering (audio only)

The video stream is copied bit for bit. Only the audio is normalised:

```sh
ffmpeg -i output/x.mp4 -c:v copy -af 'loudnorm=I=-16:TP=-1.5:LRA=11,apad' \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart output/x.mastered.mp4
mv output/x.mastered.mp4 output/x.mp4
ffmpeg -i output/x.mp4 -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -   # measure
```

Expect about −16 LUFS integrated with true peak under −1 dBTP. The duration
must not change (`apad` + `-shortest`).

## Checks on the rendered file

```sh
ffprobe -v error -show_streams -show_format output/x.mp4
```

- 1920×1080, 60 fps, H.264, AAC 48 kHz.
- The duration equals the reel's (from `plan inspect` or the scene's TIMINGS
  file).
- These numbers prove the file exists, not that it is right. Look at stills,
  and listen to (or transcribe) the seams and anchors.

## Stills and contact sheets

Take stills from the **rendered MP4**, not only from the plan, at every code
state, every anchor (about 0.7 s after it), every seam, and the end card:

```sh
mkdir -p output/x-stills
for t in 47.2 66.5 78 105.8; do
  ffmpeg -v error -y -ss "$t" -i output/x.mp4 -frames:v 1 "output/x-stills/$t.png"
done
magick montage output/x-stills/*.png -tile 4x -geometry 960x540+6+6 -background '#111' output/x-stills/sheet.jpg
```

Before rendering, take sheets from the plan:

```sh
psychopomp plan snapshot <reel> 0:60:2.5 /tmp/frames --theme black --shutter   # or t1,t2,...
magick montage /tmp/frames/*.png -tile 4x -geometry 960x540+6+6 output/sheet.jpg
```

Then **open and look at them**. Sheets are half resolution, so read the text
in full-size `plan frame` PNGs or in crops (`magick in.png -crop WxH+X+Y`).
Stills can't prove motion: check motion in normal-speed `--range` windows and
in frames 40 ms or less apart.

## `verify`

```sh
psychopomp verify baseline --manifest verify.json            # before the change (or --out DIR to share)
# … change code, regenerate …
psychopomp verify compare --manifest verify.json --expect strategy,strategy-python
```

- It re-runs every Scene Program in the manifest (dev profile,
  `PSYCHOPOMP_MEDIA=plan`). It compares plan bytes, with a summary of which
  actors and channels changed, and compares key frames.
- **Only the scenes you expected may change.** "expected to change but
  identical" or an unexpected changed scene both mean stop and look.
- To share one baseline across agents and worktrees, run `verify baseline
  --out <dir>` once, and have each agent run `verify compare <dir>`.

## Combined series

The series build (`scenes/series/build.sh` on `abstraction-series`) is driven
by a manifest (`series.json`, `series-python.json`) that lists, for each part,
the title, card text, `source` MP4, `commit` it was rendered from, theme and
`render` command, plus the loudness and audio targets. It:

1. Renders silent title cards: an opening card (4 s) and a `Part N · Title`
   card (3 s) before each part, from a small scene crate.
2. Normalises each piece's loudness in two passes. `loudnorm` measures, then
   one static gain plus a 4×-oversampled `alimiter` at −2.0 dBTP brings it to
   −16 LUFS / −1.5 dBTP. It retries with the shortfall added, up to eight
   times. (`loudnorm`'s own linear pass 2 refused, and its dynamic fallback
   came out 0.3–0.6 LU short.)
3. Pads every piece's audio to exactly its video length.
4. Joins the pieces with an ffconcat list: video stream-copied, audio encoded
   once (AAC mono 48 kHz). It adds one chapter per part from an FFMETADATA
   file, plus `+faststart`. If the pieces' H.264 headers differ, it
   re-encodes once.
5. Checks the result: frame count, A/V length, a warning-free decode, each
   piece's first and last frame bit-identical to its source, speech start and
   end within one frame, silence at every join, and loudness per part. It
   writes `joins.jpg`, card stills, `checks.txt` and `chapters.txt`.

It never renders or re-voices a part. A missing part fails with the command
that renders it. To change a part: re-render it, master it, update its
`commit`, and rebuild.
