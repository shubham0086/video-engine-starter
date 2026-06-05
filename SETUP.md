# Setup Guide — video-engine-starter

From zero to a rendered video in 15 minutes.

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | ≥ 18 | Remotion + pipeline |
| Python | ≥ 3.8 | Edge TTS (free TTS fallback) |
| ffmpeg | any | Audio duration measurement, WAV→MP3 |
| Git | any | Clone the repo |

### Install ffmpeg

**Windows:**
```bash
winget install Gyan.FFmpeg
# or download from https://ffmpeg.org/download.html
# Add to PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### Install Edge TTS (free TTS, no API key)

```bash
pip install edge-tts
```

Test it works:
```bash
edge-tts --voice en-IN-NeerjaNeural --text "Hello world" --write-media test.mp3
```

---

## Step 1 — Clone and install

```bash
git clone <repo-url>
cd video-engine-starter
npm install
```

---

## Step 2 — Configure environment

```bash
cp .env.example .env
```

**Minimum viable .env (fully free, no API keys):**

```env
TTS_LANG=en
TTS_VOICE=en-IN-NeerjaNeural
```

With just Edge TTS + Pollinations.ai (both free), you can generate full videos.

**To add LLM for smarter scripts**, add one key — Groq is easiest (free):

```env
GROQ_API_KEY=your_key_here
```

Get Groq key at: https://console.groq.com (free, 7,000 req/day)

**For Hindi/Indian language content**, add Sarvam AI (free 10k chars/month):

```env
SARVAM_API_KEY=your_key_here
TTS_LANG=hi
```

Get Sarvam key at: https://dashboard.sarvam.ai

---

## Step 3 — Run your first video

```bash
node pipeline/run.mjs "The science of deep sleep" --dry-run
```

`--dry-run` shows the plan without calling any APIs. Check the output matches expectations.

```bash
node pipeline/run.mjs "The science of deep sleep" --skip-render
```

`--skip-render` generates all assets (audio, images, manifest) but skips the Remotion render step. Good for testing TTS and images first.

```bash
node pipeline/run.mjs "The science of deep sleep"
```

Full pipeline. Outputs to `out/the-science-of-deep-sleep.mp4`.

---

## Step 4 — Preview in Remotion Studio

```bash
npm start
# Opens http://localhost:3000
```

In the Studio:
1. Select `BasicReel` composition
2. Set props → `slug: "the-science-of-deep-sleep"`
3. Hit play — you'll see the real-time preview with all your scenes

---

## Step 5 — Render from Studio (optional)

In Remotion Studio, hit the "Render" button at top right. Or from CLI:

```bash
npx remotion render BasicReel out/my-video.mp4 --props='{"slug":"the-science-of-deep-sleep"}'
```

---

## Troubleshooting

### "edge-tts not found"

```bash
pip install edge-tts
# If that doesn't work:
pip3 install edge-tts
# Verify:
which edge-tts
```

### "ffprobe not found" / "ffmpeg not found"

ffmpeg must be on your PATH. Check:
```bash
ffmpeg -version
ffprobe -version
```

If not found, install ffmpeg and add to PATH.

### "All TTS providers failed"

The cascade tried all providers and failed. Most common cause: `edge-tts` not installed.

```bash
pip install edge-tts
edge-tts --voice en-IN-NeerjaNeural --text "test" --write-media /tmp/test.mp3
```

### LLM errors / JSON parse failures

The script agent has retry logic built in. If all LLM providers fail, it uses a hardcoded fallback script. Check your `.env` API keys are valid.

### Remotion render fails

Run `npm start` first to check if the preview works in Studio. Render issues are often caused by:
- Missing audio files (TTS step failed silently)
- Wrong `slug` in props
- `public/<slug>/manifest.json` not found

Check `public/<slug>/` directory has all assets before rendering.

---

## What the pipeline produces

After running `node pipeline/run.mjs "Your Topic"`:

```
public/
  your-topic/
    manifest.json       ← TimelineDNA for Remotion
    hook.mp3            ← TTS audio for hook
    hook.jpg            ← Background image
    s1.mp3, s1.jpg      ← Segment 1
    s2.mp3, s2.jpg      ← Segment 2
    ...
    cta.mp3, cta.jpg    ← Call to action

out/
  your-topic.mp4        ← Final rendered video
```

---

## Extending the pipeline

See `docs/05-going-further.md` for how to:
- Add your own LLM provider
- Add a new TTS voice/provider
- Build a new Remotion composition template
- Add subtitles / word-level captions
- Schedule batch rendering
