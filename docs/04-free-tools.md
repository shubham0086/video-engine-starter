# 04 — Free Tools: The Complete Market Map

Everything you need to build production-quality AI videos at zero cost.

---

## LLM (Script Generation)

| Provider | Model | Free Tier | Quality | Speed | Sign Up |
|----------|-------|-----------|---------|-------|---------|
| **Groq** | llama-3.3-70b-versatile | 7,000 req/day | Excellent | Fastest | console.groq.com |
| **Google Gemini** | gemini-1.5-flash | 1.5M tokens/day | Excellent | Fast | aistudio.google.com |
| **Google Gemini** | gemini-2.0-flash | 1M tokens/day | Excellent | Fast | aistudio.google.com |
| **NVIDIA NIM** | llama-3.3-70b-instruct | 1000 credits/mo | Excellent | Fast | build.nvidia.com |
| **Mistral AI** | mistral-small | 1000 req/mo | Good | Fast | console.mistral.ai |
| **Cohere** | command-r | 1000 req/mo | Good | Medium | cohere.com |
| **Hugging Face** | Various | Free (slow) | Varies | Slow | huggingface.co |
| **Ollama** | Any (local) | Unlimited | Varies | Depends on GPU | ollama.ai |
| **LM Studio** | Any (local) | Unlimited | Varies | Depends on GPU | lmstudio.ai |

**Best combo for this starter:** `GROQ_API_KEY` + `GEMINI_API_KEY`
- Groq for speed and daily volume
- Gemini as fallback with huge token budget
- Together: ~8,500 effective requests/day

---

## TTS (Text-to-Speech)

### Indian Languages

| Provider | Languages | Free Tier | Quality | Key Required |
|----------|-----------|-----------|---------|--------------|
| **Sarvam AI** | hi-IN, bn-IN, ta-IN, te-IN, kn-IN, ml-IN, mr-IN, gu-IN, pa-IN, od-IN, en-IN | 10,000 chars/mo | Excellent native | Yes |
| **Edge TTS** | hi-IN (SwaraNeural, MadhurNeural) | Unlimited | Good | No |
| **Google TTS** | All Indian languages | Free (limited) | Basic | No |
| **Azure TTS** | All Indian languages | 500k chars/mo | Excellent | Yes |

**For Hindi content:** Sarvam AI is the clear winner — it's built specifically for Indian languages with natural prosody.

### English

| Provider | Voices | Free Tier | Quality | Key Required |
|----------|--------|-----------|---------|--------------|
| **Edge TTS** | en-IN-NeerjaNeural, en-IN-PrabhatNeural, en-US-AriaNeural, 300+ | Unlimited | Excellent | No |
| **ElevenLabs** | Thousands | 10,000 chars/mo | Best in class | Yes |
| **OpenAI TTS** | alloy, echo, fable, onyx, nova, shimmer | No free tier | Excellent | Yes ($15/1M chars) |
| **PlayHT** | Thousands | Trial only | Excellent | Yes |
| **Google Cloud TTS** | WaveNet, Neural2 | 1M chars/mo | Good | Yes (complex setup) |

**Best free English TTS:** Edge TTS — `en-IN-NeerjaNeural` sounds natural for Indian English content.

### Edge TTS Voice Reference (Best Voices)

```bash
# List all voices
edge-tts --list-voices | grep "en-IN\|hi-IN"

# Recommended voices:
en-IN-NeerjaNeural    # Indian English, female, natural
en-IN-PrabhatNeural   # Indian English, male
hi-IN-SwaraNeural     # Hindi, female, natural
hi-IN-MadhurNeural    # Hindi, male
en-US-AriaNeural      # American English, female, energetic
en-US-GuyNeural       # American English, male
en-GB-SoniaNeural     # British English, female
```

---

## Image Generation

| Provider | Free Tier | Quality | Vertical 9:16 | Key Required |
|----------|-----------|---------|---------------|--------------|
| **Pollinations.ai** | Unlimited | Good | Yes (custom dimensions) | No |
| **Stable Diffusion** (local) | Unlimited | Excellent | Yes | No (needs GPU) |
| **Stable Diffusion** (API) | Trial credits | Excellent | Yes | Yes |
| **DALL-E 3** | 15 images/mo (Bing) | Excellent | Yes | No (via Bing) |
| **Ideogram** | 10 images/day | Excellent | Yes | No |
| **Leonardo.ai** | 150 credits/day | Excellent | Yes | No |

**This starter uses Pollinations.ai** — zero config, unlimited, good quality for backgrounds.

Pollinations.ai URL format:
```
https://image.pollinations.ai/prompt/{encoded_prompt}?width=1080&height=1920&nologo=true
```

Set `width=1080&height=1920` for 9:16 vertical (Reels/Shorts/TikTok format).

---

## Video Rendering

| Tool | Free Tier | Type | Notes |
|------|-----------|------|-------|
| **Remotion** | Free non-commercial | React-based | This repo uses it |
| **FFmpeg** | Free | CLI | Used for audio processing |
| **Motion Canvas** | Free/open source | TS-based | Alternative to Remotion |
| **Revideo** | Free tier | React-based | Remotion fork, simpler API |
| **Manim** | Free/open source | Python | Best for math animations |
| **Pixi.js** | Free | Canvas-based | 2D game engine for video |

**Remotion license note:** Free for non-commercial use. Commercial license required if you sell videos or it's part of a paid product ($15/mo). Check remotion.dev/license.

---

## Audio Processing

| Tool | Purpose | Free |
|------|---------|------|
| **ffmpeg + ffprobe** | Duration measurement, format conversion | Yes |
| **edge-tts** (Python) | Microsoft TTS, 300+ voices | Yes |
| **pydub** | Audio manipulation in Python | Yes |
| **sox** | Command-line audio processor | Yes |

Install ffmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
winget install Gyan.FFmpeg
```

Install edge-tts:
```bash
pip install edge-tts
```

---

## Storage & CDN (for scale)

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Cloudflare R2** | 10 GB storage, 1M ops/mo | Best free S3-compatible |
| **Backblaze B2** | 10 GB storage | S3-compatible |
| **Supabase Storage** | 1 GB | Postgres integrated |
| **GitHub Releases** | 2 GB per release | Via git lfs |
| **Bunny.net** | Trial credits | Fastest CDN |

---

## Free Tier Comparison for a 100-video/month pipeline

Estimating per video: ~3k LLM tokens, ~500 TTS chars, ~4 images

| Resource | Usage | Provider | Free Capacity | Result |
|----------|-------|----------|---------------|--------|
| LLM tokens | 300k/mo | Groq | 210M tokens/mo | ✅ Easily free |
| TTS chars | 50k/mo | Edge TTS | Unlimited | ✅ Free |
| Images | 400/mo | Pollinations.ai | Unlimited | ✅ Free |
| Compute | 100 renders | Local | Unlimited | ✅ Free |

**Conclusion: 100 videos/month = $0 with this stack.**

---

## Paid upgrades worth considering

| What | Provider | Cost | When to upgrade |
|------|----------|------|-----------------|
| Better Hindi TTS | Sarvam AI Pro | ~$20/mo | >10k chars/mo Hindi |
| Premium English TTS | ElevenLabs | $5/mo | Client-facing English content |
| Faster LLM | OpenAI GPT-4o | $0.005/1k tokens | Production quality scripts |
| Cloud rendering | Remotion Lambda | $0.03/min | CI/CD automated rendering |
| Image quality | Midjourney | $10/mo | Premium visual quality |

---

## Next: going further

See `docs/05-going-further.md` — extending this starter to production scale.
