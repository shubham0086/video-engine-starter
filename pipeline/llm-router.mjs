/**
 * llm-router.mjs — Multi-Provider LLM Router with Cascading Fallback
 *
 * Call routeLLM() from anywhere. It tries each provider in order and
 * returns the first successful response. Missing keys are skipped automatically.
 *
 * Add your keys to .env — you don't need all of them. One key is enough.
 *
 * Provider order (all free tiers):
 *   1. NVIDIA NIM    — Llama 3.3 70B   — free (1000 req/day)
 *   2. OpenCode Zen  — MiniMax M2.5    — free (unlimited)
 *   3. Groq          — Llama 3.3 70B   — free (30 req/min, fastest)
 *   4. Gemini        — gemini-2.0-flash — free (1500 req/day)
 *   5. Together.ai   — Mixtral 8x7B    — free ($25 credit)
 */

// ── Provider definitions ──────────────────────────────────────────────────────

const PROVIDERS = [
  {
    name: "NVIDIA NIM",
    envKey: "NIM_API_KEY",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    model: "meta/llama-3.3-70b-instruct",
    format: "openai",
  },
  {
    name: "OpenCode Zen",
    envKey: "OPENCODE_ZEN_API_KEY",
    url: "https://opencode.ai/zen/v1/chat/completions",
    model: "minimax-m2.5-free",
    format: "openai",
  },
  {
    name: "Groq",
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    format: "openai",
  },
  {
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    url: null, // built dynamically below
    model: "gemini-2.0-flash",
    format: "gemini",
  },
  {
    name: "Together.ai",
    envKey: "TOGETHER_API_KEY",
    url: "https://api.together.xyz/v1/chat/completions",
    model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    format: "openai",
  },
];

// ── Core call functions ───────────────────────────────────────────────────────

async function callOpenAI(url, apiKey, model, systemPrompt, userPrompt, temperature = 0.7) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000), // 60s hard timeout
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices[0].message.content;
}

async function callGemini(apiKey, model, systemPrompt, userPrompt, temperature = 0.7) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * Route an LLM request through available providers, cascading on failure.
 *
 * @param {string} systemPrompt - The system instruction
 * @param {string} userPrompt   - The user message
 * @param {number} temperature  - 0.0–1.0 (default 0.7)
 * @returns {Promise<string>}   - The model's response text
 */
export async function routeLLM(systemPrompt, userPrompt, temperature = 0.7) {
  const tried = [];

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue; // silently skip — key not configured

    try {
      console.log(`  [LLM] Trying ${provider.name} (${provider.model})...`);

      let result;
      if (provider.format === "gemini") {
        result = await callGemini(apiKey, provider.model, systemPrompt, userPrompt, temperature);
      } else {
        result = await callOpenAI(provider.url, apiKey, provider.model, systemPrompt, userPrompt, temperature);
      }

      console.log(`  [LLM] ${provider.name} responded (${result.length} chars)`);
      return result;

    } catch (err) {
      const short = err.message.slice(0, 100);
      console.warn(`  [LLM] ${provider.name} failed: ${short}`);
      tried.push(`${provider.name}: ${short}`);
    }
  }

  throw new Error(
    `All LLM providers exhausted.\nTried:\n${tried.map(t => `  - ${t}`).join("\n")}\n` +
    `Set at least one key in .env (NIM_API_KEY recommended — free at build.nvidia.com)`
  );
}

/**
 * Parse JSON from an LLM response safely.
 * LLMs often wrap JSON in markdown code fences even when told not to. This strips them.
 *
 * @param {string} raw - Raw LLM output
 * @returns {object}   - Parsed JSON object
 */
export function parseJSON(raw) {
  // Strip markdown code fences
  const stripped = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
  // Extract the outermost JSON object
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in LLM output: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
