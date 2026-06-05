# 02 — LLM Routing: Cascade Fallback Architecture

## The problem with a single LLM dependency

```js
// Brittle — one provider failure = your pipeline is dead
const response = await openai.chat.completions.create({ ... });
```

API rate limits hit. Keys expire. Providers go down. Costs spike. Your pipeline dies.

**The solution: treat LLM providers like a resource pool, not a fixed dependency.**

---

## The cascade pattern

```js
const PROVIDERS = [
  { name: "Primary",   key: env.PRIMARY_KEY,   fn: callPrimary   },
  { name: "Secondary", key: env.SECONDARY_KEY, fn: callSecondary },
  { name: "Tertiary",  key: env.TERTIARY_KEY,  fn: callTertiary  },
];

for (const p of PROVIDERS) {
  if (!p.key) continue;  // skip if no API key configured
  try {
    return await p.fn(prompt);
  } catch (err) {
    console.warn(`[SKIP] ${p.name}: ${err.message}`);
  }
}
throw new Error("All LLM providers failed");
```

Simple. Resilient. Zero additional dependencies.

---

## Provider priority in this repo

| # | Provider | Model | Free Tier | Speed |
|---|----------|-------|-----------|-------|
| 1 | NVIDIA NIM | llama-3.3-70b-instruct | 1000 credits/mo | Fast |
| 2 | OpenCode Zen | minimax-m2.5-free | Generous | Medium |
| 3 | Groq | llama-3.3-70b-versatile | 7k req/day | Fastest |
| 4 | Google Gemini | gemini-1.5-flash | 1.5M tokens/day | Fast |
| 5 | Together.ai | Mixtral-8x7B | Trial credits | Medium |

**Which to use?** Groq for maximum free tier (7,000 requests/day is a lot). Gemini for maximum token budget.

---

## The actual implementation

`pipeline/llm-router.mjs` normalizes all providers to the same interface:

```js
async function callProvider(provider, messages, temperature) {
  if (provider.format === "openai") {
    // OpenAI-compatible endpoint (NIM, Groq, Together, OpenCode all use this)
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env[provider.envKey]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider.format === "gemini") {
    // Gemini has a different API shape
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST",
      body: JSON.stringify({
        contents: [{ parts: [{ text: messages.map(m => m.content).join("\n") }] }],
        generationConfig: { temperature, maxOutputTokens: 1200 },
      }),
    });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }
}
```

The cascade calls `callProvider()` for each provider until one succeeds.

---

## Prompt engineering for structured output

Getting consistent JSON from LLMs requires explicit constraints:

```js
const SYSTEM_PROMPT = `You are a viral short-form video scriptwriter.
You MUST respond with ONLY valid JSON — no markdown, no explanation, no preamble.
The JSON must match this schema exactly:
{
  "title": "string",
  "hook": "string, 10-15 words, pattern: shocking stat or counterintuitive claim",
  "segments": [
    { "id": "s1", "narration": "string, 20-30 words", "visualHint": "string", "durationHint": 5 }
  ],
  "cta": "string, 8-12 words"
}`;
```

Key rules:
1. Say "ONLY valid JSON" — not "respond in JSON format" (too vague)
2. Give example values with constraints ("10-15 words")
3. Include `id` field with the expected values — LLMs fill it correctly when told

---

## Parsing LLM output defensively

LLMs sometimes wrap JSON in markdown fences even when told not to. Parse defensively:

```js
export function parseJSON(raw) {
  let text = raw.trim();

  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // Find first { ... } block (handles preamble)
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }

  return JSON.parse(text);
}
```

This handles the three most common failure modes:
- Wrapped in ````json ... ````
- Preceded by "Here is the JSON:"
- Followed by "Let me know if..."

---

## Adding a new LLM provider

1. Add your provider to the `PROVIDERS` array in `pipeline/llm-router.mjs`:

```js
{
  name: "My Provider",
  envKey: "MY_PROVIDER_API_KEY",
  url: "https://api.myprovider.com/v1/chat/completions",
  model: "their-model-name",
  format: "openai",  // or "gemini" if Gemini-compatible
}
```

2. Add the env var to `.env.example` with documentation.

3. If it uses a non-standard API format, add a new `format` type in `callProvider()`.

---

## Free LLMs available in 2026

| Provider | Model | Free Tier | Notes |
|----------|-------|-----------|-------|
| **Groq** | llama-3.3-70b-versatile | 7,000 req/day | Fastest inference available |
| **Google Gemini** | gemini-1.5-flash | 1.5M tokens/day | Best free context window |
| **Google Gemini** | gemini-2.0-flash | 1M tokens/day | Newer, multimodal |
| **NVIDIA NIM** | llama-3.3-70b | 1000 credits/mo | High quality, slow to exhaust |
| **Together.ai** | Mixtral-8x7B | Trial credits | Good for experiments |
| **Hugging Face** | Various | Free (slow) | Rate-limited, unpredictable |
| **Ollama** | Any | Unlimited (local) | Requires GPU, runs locally |
| **LM Studio** | Any | Unlimited (local) | GUI for local models |

**Recommendation for this project:**
- Set `GROQ_API_KEY` and `GEMINI_API_KEY`
- You'll have ~8,500 effective req/day before hitting any limits
- That's roughly 280 videos per day at ~30 LLM calls each

---

## Handling rate limits gracefully

The cascade naturally handles rate limits — if Groq hits its limit, it throws and Gemini picks up. But you can be smarter:

```js
// Add exponential backoff for rate-limit errors specifically
async function callWithRetry(fn, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.message.includes("429") && i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
        continue;
      }
      throw err;
    }
  }
}
```

The current implementation skips on first failure (simpler). Add retry logic if you need it.

---

## Next: audio generation

See `docs/03-temporal-authority.md` — how audio duration becomes exact frame counts.
