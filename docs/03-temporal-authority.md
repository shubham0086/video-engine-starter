# 03 — Temporal Authority: Audio is the Clock

## The core principle

> **Audio duration is ground truth. React never decides how long a scene lasts.**

This is the most important architectural decision in video-as-code systems. Get it wrong and you get drift — audio cuts off mid-sentence, or scenes end before the narrator finishes.

---

## Why naive approaches fail

### Approach 1: Fixed duration per scene

```js
durationInFrames = 5 * 30; // 5 seconds, always
```

Problem: TTS generates audio that is 4.2s or 6.8s depending on text length and voice speed. Your fixed 5s is wrong for almost every scene.

### Approach 2: Estimate from word count

```js
durationInFrames = Math.ceil(text.split(" ").length / 2.5 * 30);
// "words per second" estimate
```

Problem: Different TTS voices speak at different speeds. Sarvam Hindi voice speaks differently from Edge TTS English. Punctuation affects pauses. This estimate is consistently wrong.

### Approach 3: Trust the LLM's `durationHint`

```json
{ "id": "s1", "narration": "...", "durationHint": 5 }
```

Problem: LLMs hallucinate duration. They don't know how long TTS will actually speak the text.

---

## The correct approach: measure reality

After generating audio, use `ffprobe` to measure the actual duration:

```bash
ffprobe -v quiet -show_entries format=duration -of csv=p=0 audio.mp3
# Returns: 4.281633
```

Then convert to integer frames:

```js
const seconds = 4.281633;
const fps = 30;
const frames = Math.ceil(seconds * fps); // = 129 frames
```

`Math.ceil` ensures you never cut off the last syllable.

---

## Implementation: temporal-authority.mjs

```js
import { spawnSync } from "child_process";

export function getAudioDuration(filePath) {
  const result = spawnSync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ], { encoding: "utf8" });

  if (result.error) throw new Error(`ffprobe not found: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);

  const duration = parseFloat(result.stdout.trim());
  if (isNaN(duration)) throw new Error(`ffprobe returned invalid duration: ${result.stdout}`);
  return duration;
}

export function audioToFrames(filePath, fps = 30) {
  const seconds = getAudioDuration(filePath);
  return Math.ceil(seconds * fps); // ALWAYS ceil — never cut audio
}

export function buildTimelineFrames(scenes, fps = 30) {
  const measured = scenes.map(scene => ({
    id: scene.id,
    durationInFrames: audioToFrames(scene.audioFile, fps),
  }));

  const totalFrames = measured.reduce((sum, s) => sum + s.durationInFrames, 0);
  return { fps, totalFrames, scenes: measured };
}
```

---

## Why ffprobe?

- **Already required**: ffmpeg (which includes ffprobe) is needed for other audio operations
- **Exact**: Reports duration to microsecond precision
- **Reliable**: Handles all audio formats (MP3, WAV, OGG, AAC)
- **Fast**: Reads only the file header — doesn't decode the audio

Alternative: `music-metadata` npm package. Pure JS, no binary dependency. But adds a dependency where ffprobe is already available.

---

## The pipeline sequence (order matters)

```
Step 2: Generate audio (.mp3 files)
           ↓
Step 3: ffprobe measures each .mp3 → durationInFrames
           ↓
Step 5: Write manifest.json with exact durationInFrames
           ↓
Step 6: Remotion renders — reads durationInFrames from manifest
```

Remotion never sees audio files during rendering for duration purposes — it reads the pre-computed integer from the manifest. This is intentional.

---

## The frame count must be an integer

Remotion's `<Series.Sequence durationInFrames={...}>` requires an integer. If you pass a float, Remotion throws:

```
Error: durationInFrames must be an integer, got 128.44999...
```

Always use `Math.ceil()`, never `Math.round()`. Rounding down can cut the last syllable.

```js
// CORRECT
const durationInFrames = Math.ceil(audioDurationSeconds * fps);

// WRONG — can cut audio
const durationInFrames = Math.round(audioDurationSeconds * fps);

// WRONG — TypeScript won't catch this at runtime in Remotion
const durationInFrames = audioDurationSeconds * fps; // float
```

---

## Adding padding (optional)

If you want a brief silence after each scene before the next starts:

```js
const PADDING_FRAMES = 6; // 0.2s at 30fps

export function audioToFrames(filePath, fps = 30) {
  const seconds = getAudioDuration(filePath);
  return Math.ceil(seconds * fps) + PADDING_FRAMES;
}
```

The current implementation has no padding — scenes cut directly. Add it if your video feels rushed.

---

## Debugging timing issues

If audio and video feel out of sync:

```bash
# Check actual audio duration
ffprobe -v quiet -show_entries format=duration -of csv=p=0 public/slug/hook.mp3

# Check what manifest says
cat public/slug/manifest.json | python -c "import sys,json; d=json.load(sys.stdin); print([(s['id'], s['durationInFrames']/30, 'sec') for s in d['scenes']])"
```

If the manifest duration doesn't match the audio duration × 30, the temporal authority step ran before audio generation completed.

---

## Next: free tools survey

See `docs/04-free-tools.md` — every free tool in this pipeline, with alternatives.
