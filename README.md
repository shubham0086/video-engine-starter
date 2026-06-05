# video-engine-starter

**Turn a text brief into a rendered 9:16 MP4 in under 10 minutes.**

A production-grade starter for programmatic video generation using React/Remotion, LLM script agents, and free TTS — with a multi-provider LLM fallback chain so your pipeline never goes dark.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-green.svg)](https://nodejs.org)

---

## What you get

```
Brief: "The science of deep sleep"
  ↓ 30 seconds
Script JSON (hook + 5 segments + CTA)
  ↓ 60 seconds
Audio files (Edge TTS, free — or ElevenLabs if you have a key)
  ↓ 90 seconds
Remotion renders → out/deep-sleep.mp4 (1080×1920, 9:16, 30fps)
```

**Total cost per video: $0.00 on all free tiers.**

---

## The core insight: Audio is the clock

React cannot async-wait for TTS to finish. Everything breaks when React tries to guess timing.

The fix is called the **Temporal Authority** — a Node.js step that uses `ffprobe` to measure exact audio duration, converts it to frame counts, and injects those integers into Remotion before React sees anything. React only reads numbers. React never makes decisions.

```
TTS → mp3 file → ffprobe → 5.2 seconds → 156 frames → Remotion prop
```

This one pattern is responsible for 90% of video timing correctness. Everything else is styling.

---

## Quick Start (15 minutes)

**Prerequisites:** Node 20+, ffprobe (comes with ffmpeg)

```bash
# Clone and install
git clone https://github.com/shubham0086/video-engine-starter
cd video-engine-starter
npm install

# Configure (minimum: one LLM key — NVIDIA NIM is free)
cp .env.example .env
# Edit .env → set NIM_API_KEY (free at build.nvidia.com)

# Run the pipeline on any topic
node pipeline/run.mjs "The science of deep sleep"

# Preview in browser before rendering
npx remotion studio

# Render to MP4
npx remotion render BasicReel out/deep-sleep.mp4
```

**Full setup guide → [SETUP.md](SETUP.md)**

---

## Architecture

```
pipeline/
  run.mjs               ← end-to-end orchestrator
  llm-router.mjs        ← multi-provider LLM with fallback chain
  script-agent.mjs      ← LLM → structured script JSON
  audio-gen.mjs         ← TTS: Edge TTS (free) or ElevenLabs
  temporal-authority.mjs← audio duration → frame counts (ffprobe)

src/
  Root.tsx              ← Remotion compositions index
  BasicReel/            ← minimal template (image + caption + audio)
  CaptionedReel/        ← word-by-word caption sync
  components/
    KenBurnsImage.tsx   ← animated background image
```

### The LLM Fallback Chain

Your pipeline calls one function: `routeLLM(systemPrompt, userPrompt)`. It never fails — it cascades:

```
[1] NVIDIA NIM      — Llama 3.3 70B       — Free (1000 req/day)
[2] OpenCode Zen    — MiniMax M2.5        — Free (unlimited)
[3] Google Gemini   — gemini-2.0-flash    — Free (1500 req/day)
[4] Groq            — Llama 3.3 70B       — Free (30 req/min, fast)
[5] Together.ai     — Mixtral 8x7B        — Free ($25 credit)
```

Set whichever keys you have. The router skips providers with missing keys and tries the next one automatically.

---

## The 5 concepts this teaches

| # | Concept | File |
|---|---------|------|
| 1 | Video as Code (React = frame renderer) | [docs/01-video-as-code.md](docs/01-video-as-code.md) |
| 2 | LLM Routing + Fallback | [docs/02-llm-routing.md](docs/02-llm-routing.md) |
| 3 | Temporal Authority (audio = time) | [docs/03-temporal-authority.md](docs/03-temporal-authority.md) |
| 4 | Free Tools Survey (2026) | [docs/04-free-tools.md](docs/04-free-tools.md) |
| 5 | From starter to production | [docs/05-going-further.md](docs/05-going-further.md) |

---

## Free tools used (zero API cost at low volume)

| Layer | Tool | Cost |
|-------|------|------|
| LLM — scripts | NVIDIA NIM (Llama 3.3 70B) | Free |
| LLM — fallback | OpenCode Zen (MiniMax) | Free |
| TTS | Edge TTS (Microsoft) | Free |
| Image generation | Pollinations.ai | Free (no key needed) |
| Video render | Remotion | Free (non-commercial) |
| Audio timing | ffprobe | Free |

**Optional upgrades (paid):**
- ElevenLabs TTS — word-level timing for captions ($0.05/reel)
- Replicate FLUX — high-quality scene images ($0.003/image)

---

## What this is NOT

This is a starter, not a production system. It intentionally excludes:
- Self-improving analytics loops (TrueScore, A/B testing)
- Attention entropy optimization (Perception Layer)
- Hook pattern validation
- Multi-brand management
- Platform publishing (Instagram / YouTube)

For the full production system, see the architecture this was extracted from → [agentOS patterns](https://github.com/shubham0086/agentic-patterns).

---

## Who this is for

- Developers building content automation tools
- Founders exploring programmatic video for marketing
- Engineers curious about React-as-renderer architecture
- Anyone who wants to generate videos without touching Premiere or CapCut

---

## Extending

```bash
# Add your own Remotion template
cp -r src/BasicReel src/MyBrandReel
# Edit src/MyBrandReel/index.tsx → change colors, fonts, layout

# Add a new LLM provider
# Edit pipeline/llm-router.mjs → add to PROVIDERS array

# Change the TTS voice
# Edit pipeline/audio-gen.mjs → change VOICE constant
```

---

*Built from real production use at 18 months of building AI-powered video pipelines.*
*MIT licensed — use it, fork it, ship it.*
