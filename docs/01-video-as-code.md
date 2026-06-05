# 01 — Video as Code: The Core Concept

## The problem with traditional video tools

Traditional video editors (Premiere, DaVinci, CapCut) are timeline GUIs. You drag clips, adjust keyframes manually, export. This breaks at scale:

- One video = hours of manual work
- Changing brand colors = re-edit every video
- A/B testing = duplicate work manually
- 100 videos for 100 topics = 100× the manual work

**What if video was just data?**

---

## The insight: video = function(data)

React already proved this for UI. A React component is a pure function — same props, same output, every time. Remotion applies this to video:

```
video = f(JSON)
```

Where JSON is your **TimelineDNA** — a structured description of what to show and when.

```json
{
  "fps": 30,
  "totalFrames": 900,
  "scenes": [
    {
      "id": "hook",
      "narration": "Most people sleep wrong.",
      "image": "deep-sleep/hook.jpg",
      "audio": "deep-sleep/hook.mp3",
      "durationInFrames": 150
    }
  ]
}
```

Your React component reads this JSON and renders deterministically. The same JSON produces the exact same video, every time, on any machine.

---

## What Remotion actually does

Remotion is a React renderer that produces video frames instead of DOM nodes.

```
Frame 0   → React renders with frame=0   → JPEG
Frame 1   → React renders with frame=1   → JPEG
Frame 2   → React renders with frame=2   → JPEG
...
Frame 899 → React renders with frame=899 → JPEG
ffmpeg concatenates all JPEGs → MP4
```

Inside your component, `useCurrentFrame()` gives you the current frame number. You use `interpolate()` to animate anything:

```tsx
import { useCurrentFrame, interpolate } from 'remotion';

const frame = useCurrentFrame();

// Fade in over first 12 frames
const opacity = interpolate(frame, [0, 12], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});

// Text slides up
const y = interpolate(frame, [0, 12], [20, 0], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
```

This is just math. No timeline dragging. No keyframe clicking. Code.

---

## Why this changes everything

### 1. Scale without effort

```bash
for topic in "${topics[@]}"; do
  node pipeline/run.mjs "$topic"
done
```

100 videos = same effort as 1 video (minus API rate limits).

### 2. Instant brand updates

Change one React component → every video changes. Update the gradient in `BasicReel/index.tsx` → regenerate → all 100 videos have the new look.

### 3. Data-driven personalization

```json
{ "narration": "Rahul, here's your sleep report" }
```

Swap the JSON, render with the same template. 10,000 personalized videos from one codebase.

### 4. Testable, diffable, versionable

Video templates are TypeScript. They go through code review, CI/CD, git history. Your video production has the same rigor as your product code.

---

## The three layers

```
┌─────────────────────────────────────────────┐
│ 1. DATA LAYER                               │
│    TimelineDNA (manifest.json)              │
│    Who talks, what image, how long          │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│ 2. RENDER LAYER                             │
│    Remotion (React)                         │
│    Reads JSON → renders frames              │
│    Animations, text, audio sync             │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│ 3. PIPELINE LAYER                           │
│    Node.js scripts                          │
│    LLM → TTS → Images → Manifest → Render   │
└─────────────────────────────────────────────┘
```

These layers are independent:
- Change the pipeline without touching React
- Swap the React template without touching the pipeline
- The JSON contract between them never changes

---

## The TimelineDNA contract

This is the interface between your pipeline and your renderer. It must never break:

```typescript
interface TimelineDNA {
  title: string;
  slug: string;      // kebab-case, used as folder name in public/
  fps: 30;           // always 30 for now — Remotion can do 60 but 30 is standard
  totalFrames: number; // sum of all scene durationInFrames
  scenes: Scene[];
}

interface Scene {
  id: string;         // "hook", "s1", "s2", "cta"
  narration: string;  // displayed as caption text
  image: string;      // path relative to public/ — e.g., "my-topic/hook.jpg"
  audio: string;      // path relative to public/ — e.g., "my-topic/hook.mp3"
  durationInFrames: number; // INTEGER — how long this scene plays
}
```

`durationInFrames` is always an integer because Remotion's `<Series.Sequence>` requires it. The pipeline computes this from real audio duration (see `docs/03-temporal-authority.md`).

---

## Try it: write a manifest manually

You don't need the full pipeline to see Remotion working. Create a test manifest:

```bash
mkdir -p public/test-video
```

Create `public/test-video/manifest.json`:
```json
{
  "title": "Manual Test",
  "slug": "test-video",
  "fps": 30,
  "totalFrames": 300,
  "scenes": [
    {
      "id": "scene1",
      "narration": "This is rendered from a JSON file.",
      "image": "test-video/bg.jpg",
      "audio": "test-video/audio.mp3",
      "durationInFrames": 150
    },
    {
      "id": "scene2",
      "narration": "No timeline editor. Just code.",
      "image": "test-video/bg.jpg",
      "audio": "test-video/audio.mp3",
      "durationInFrames": 150
    }
  ]
}
```

Add any image as `public/test-video/bg.jpg` and any mp3 as `public/test-video/audio.mp3`. Then:

```bash
npm start
# In Studio: select BasicReel, set slug to "test-video"
```

You'll see your JSON rendered as a video.

---

## Next: how the script gets generated

See `docs/02-llm-routing.md` — the LLM cascade that turns a topic into narration JSON.
