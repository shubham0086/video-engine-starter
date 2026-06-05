/**
 * script-agent.mjs — LLM Script Generator
 *
 * Takes a topic string and returns a structured script JSON.
 * Uses the LLM router — works with any free provider you have configured.
 *
 * Output schema:
 * {
 *   title: string,
 *   hook: string,           // Opening line — scroll-stop moment
 *   segments: [
 *     { id: string, narration: string, visualHint: string, durationHint: number }
 *   ],
 *   cta: string             // Final call to action
 * }
 */

import { routeLLM, parseJSON } from "./llm-router.mjs";

const SYSTEM_PROMPT = `You are a viral short-form video scriptwriter specializing in educational content reels.

Your output must be ONLY valid JSON with NO markdown, NO preamble, NO explanation.

Rules for great hooks:
- Max 8 words for the opening clause
- Create instant curiosity or challenge a belief
- Examples: "Your sleep is broken. Here's why." / "No one told you this about focus."

Rules for segments:
- 3-5 segments per script
- Each segment: 2-3 sentences of narration
- Keep narration conversational — it will be spoken aloud by TTS
- visualHint: describe what should appear on screen (1 sentence)
- durationHint: estimated seconds (3-8)

Always end with a CTA: follow/save/share ask.`;

const USER_PROMPT_TEMPLATE = (topic, duration, style) => `
Write a ${duration}-second vertical reel script about: "${topic}"
Style: ${style}

Output this exact JSON structure:
{
  "title": "Short title for the video",
  "hook": "Opening scroll-stop line (max 8 words)",
  "segments": [
    {
      "id": "s1",
      "narration": "What the voiceover says (2-3 sentences)",
      "visualHint": "What appears on screen while this narration plays",
      "durationHint": 5
    }
  ],
  "cta": "Final call to action"
}`;

/**
 * Generate a structured video script from a topic.
 *
 * @param {string} topic     - The topic or concept for the video
 * @param {object} options
 * @param {number} options.duration  - Target duration in seconds (default 30)
 * @param {string} options.style     - Content style (default "educational")
 * @param {number} options.temperature
 * @returns {Promise<object>} - Parsed script JSON
 */
export async function generateScript(topic, {
  duration = 30,
  style = "educational, calm and authoritative tone",
  temperature = 0.8,
} = {}) {
  console.log(`\n[ScriptAgent] Generating script: "${topic}" (${duration}s)`);

  const userPrompt = USER_PROMPT_TEMPLATE(topic, duration, style);

  let raw;
  try {
    raw = await routeLLM(SYSTEM_PROMPT, userPrompt, temperature);
  } catch (err) {
    throw new Error(`Script generation failed: ${err.message}`);
  }

  let script;
  try {
    script = parseJSON(raw);
  } catch (err) {
    throw new Error(`Script JSON parse failed. Raw output:\n${raw.slice(0, 400)}\nError: ${err.message}`);
  }

  // Validate required fields
  const required = ["title", "hook", "segments", "cta"];
  for (const field of required) {
    if (!script[field]) throw new Error(`Script missing required field: "${field}"`);
  }

  if (!Array.isArray(script.segments) || script.segments.length === 0) {
    throw new Error("Script segments must be a non-empty array");
  }

  // Ensure segment IDs are set even if LLM skipped them
  script.segments = script.segments.map((s, i) => ({
    ...s,
    id: s.id || `s${i + 1}`,
  }));

  console.log(`[ScriptAgent] Script ready: "${script.title}" — ${script.segments.length} segments`);
  console.log(`[ScriptAgent] Hook: "${script.hook}"`);

  return script;
}
