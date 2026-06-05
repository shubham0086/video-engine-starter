# video-engine-starter — Agent Context

## What this repo is

A MIT-licensed, clone-and-run showcase of the "Video as Code" pattern.
It teaches: React/Remotion rendering, LLM routing with fallback, multi-provider TTS cascade,
and the Temporal Authority principle (audio duration drives frame count — never the other way).

This is a **public teaching repo** — not the production KAAL engine.
Do not add proprietary moat features (entropy scoring, hook validator, A/B testing).

## Architecture

```
Topic (string)
  ↓  pipeline/script-agent.mjs   — LLM router generates narration JSON
  ↓  pipeline/audio-gen.mjs      — TTS cascade → .mp3 per scene
  ↓  pipeline/temporal-authority.mjs — ffprobe → exact frame counts
  ↓  pipeline/run.mjs (step 4)   — Pollinations.ai → .jpg per scene
  ↓  public/<slug>/manifest.json — TimelineDNA contract
  ↓  src/BasicReel/index.tsx     — Remotion renders from manifest
  →  out/<slug>.mp4
```

## Key files

| File | Role |
|------|------|
| `pipeline/run.mjs` | End-to-end orchestrator, 6 steps |
| `pipeline/llm-router.mjs` | Cascading LLM fallback (NIM→Groq→Gemini→Together) |
| `pipeline/audio-gen.mjs` | TTS cascade (Sarvam→ElevenLabs→OpenAI→PlayHT→Edge→Google) |
| `pipeline/temporal-authority.mjs` | ffprobe measures audio → integer frame counts |
| `pipeline/script-agent.mjs` | Generates narration JSON via LLM |
| `src/BasicReel/index.tsx` | Main Remotion composition (reads manifest.json) |
| `src/Root.tsx` | Remotion composition registry |
| `src/components/KenBurnsImage.tsx` | Animated background (pan+zoom) |
| `.env.example` | All env vars documented |

## TimelineDNA contract

Remotion receives this manifest — never compute time in React:

```json
{
  "title": "string",
  "slug": "string",
  "fps": 30,
  "totalFrames": 900,
  "scenes": [{
    "id": "hook",
    "narration": "string",
    "image": "slug/hook.jpg",
    "audio": "slug/hook.mp3",
    "durationInFrames": 180
  }]
}
```

`durationInFrames` = `Math.ceil(audioDurationSeconds * fps)` — computed by temporal-authority.mjs.

## Provider priority

### LLM (script generation)
1. NVIDIA NIM (`NIM_API_KEY`) — llama-3.3-70b-instruct
2. OpenCode Zen (`OPENCODE_ZEN_API_KEY`) — minimax-m2.5-free
3. Groq (`GROQ_API_KEY`) — llama-3.3-70b-versatile
4. Google Gemini (`GEMINI_API_KEY`) — gemini-1.5-flash
5. Together.ai (`TOGETHER_API_KEY`) — Mixtral-8x7B

### TTS (audio generation)
1. Sarvam AI (`SARVAM_API_KEY`) — ONLY for Indian languages (hi-IN, bn-IN, ta-IN, etc.)
2. ElevenLabs (`ELEVEN_LABS_API_KEY`) — best English quality
3. OpenAI TTS (`OPENAI_API_KEY`) — tts-1 model
4. PlayHT (`PLAYHT_API_KEY` + `PLAYHT_USER_ID`)
5. Edge TTS — free, no key (always available, best fallback)
6. Google TTS — free, last resort

## What NOT to build here (KAAL moat)

- Entropy scoring / perceptual audit
- Hook validation (4-pattern classifier)
- Jump-cut injection based on entropy
- A/B testing of hooks
- TrueScore engagement prediction

These live in the production agency-os repo, not here.

## Common tasks

### Add a new LLM provider

In `pipeline/llm-router.mjs`, add to the `PROVIDERS` array:
```js
{ name: "MyProvider", envKey: "MYPROVIDER_API_KEY", url: "...", model: "...", format: "openai" }
```

### Add a new TTS voice

In `pipeline/audio-gen.mjs`, add a new provider function + push to `cascade` array in `generateAudio()`.

### Add a new Remotion composition

1. Create `src/MyTemplate/index.tsx`
2. Register in `src/Root.tsx` with `<Composition id="MyTemplate" ...>`
3. Call `npx remotion render MyTemplate out/output.mp4`

### Test without API calls

```bash
node pipeline/run.mjs "Your topic" --dry-run
```

### Generate assets without rendering

```bash
node pipeline/run.mjs "Your topic" --skip-render
```

## Environment

- Node ≥ 18
- Python ≥ 3.8 (for edge-tts)
- ffmpeg in PATH (for ffprobe + WAV→MP3 conversion)
- `pip install edge-tts` for free TTS fallback
