/**
 * audio-gen.mjs — Multi-Provider TTS Audio Generator
 *
 * Tries providers in order based on keys in .env.
 * Sarvam AI is prioritised for Indian languages (Hindi, Tamil, Bengali, etc.)
 *
 * ── Provider Priority ────────────────────────────────────────────────────────
 *
 * 1. Sarvam AI       SARVAM_API_KEY        Best for Hindi / Indian languages
 *    Voices: meera, kalpana, amol, arjun, diya, kavya, anushka, abhilasha
 *    Hindi voices: anushka (F), abhilasha (F), arjun (M)
 *
 * 2. ElevenLabs      ELEVEN_LABS_API_KEY   Best quality English + word timing
 *    Use for: English premium quality or multilingual v2
 *
 * 3. OpenAI TTS      OPENAI_API_KEY        Great English quality
 *    Voices: alloy, echo, fable, onyx, nova, shimmer
 *
 * 4. PlayHT          PLAYHT_API_KEY        Wide voice selection
 *    Set PLAYHT_USER_ID too
 *
 * 5. Edge TTS        (no key)              Free, Microsoft — always available
 *    Best Indian English: en-IN-NeerjaNeural, en-IN-PrabhatNeural
 *    Hindi: hi-IN-SwaraNeural, hi-IN-MadhurNeural
 *
 * 6. Google TTS      GOOGLE_TTS_API_KEY    Free, basic quality
 *
 * Usage:
 *   import { generateAudio, generateScriptAudio } from "./audio-gen.mjs";
 *   await generateAudio("Hello world", "public/scene_0.mp3", { lang: "hi-IN" });
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const SARVAM_KEY = process.env.SARVAM_API_KEY;
const ELEVEN_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PLAYHT_KEY = process.env.PLAYHT_API_KEY;
const PLAYHT_USER = process.env.PLAYHT_USER_ID;

const DEFAULT_LANG = process.env.TTS_LANG || "en";
const DEFAULT_VOICE_EN = process.env.TTS_VOICE || "en-IN-NeerjaNeural";
const DEFAULT_VOICE_HI = process.env.TTS_VOICE_HI || "hi-IN-SwaraNeural";

// ── Sarvam AI ─────────────────────────────────────────────────────────────────
// Best for Hindi + all Indian regional languages
// Docs: https://docs.sarvam.ai/api-reference/text-to-speech
// Free tier: 10,000 chars/month | Sign up: dashboard.sarvam.ai
//
// Language codes: hi-IN, bn-IN, kn-IN, ml-IN, mr-IN, od-IN, pa-IN, ta-IN, te-IN, gu-IN, en-IN
// Voices: meera, kalpana, amol, arjun, diya, kavya, anushka, abhilasha

async function sarvamTTS(text, outputPath, {
  langCode = "hi-IN",
  speakerName = "anushka",
  model = "bulbul:v2",
} = {}) {
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": SARVAM_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [text.slice(0, 500)], // Sarvam max input per call
      target_language_code: langCode,
      speaker: speakerName,
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam TTS ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const base64Audio = data.audios?.[0];
  if (!base64Audio) throw new Error("Sarvam returned no audio data");

  // Sarvam returns WAV base64 — save as WAV then convert to MP3 via ffmpeg
  const wavPath = outputPath.replace(/\.mp3$/, ".wav");
  fs.writeFileSync(wavPath, Buffer.from(base64Audio, "base64"));
  const result = spawnSync("ffmpeg", ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-qscale:a", "2", outputPath], { encoding: "utf8" });
  fs.unlinkSync(wavPath);
  if (result.status !== 0) throw new Error(`ffmpeg WAV→MP3 failed: ${result.stderr}`);
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────
// Best quality English TTS + word-level timing data
// Docs: https://api.elevenlabs.io/docs
// Free: 10,000 chars/month | Paid: ~$0.05/reel

async function elevenLabsTTS(text, outputPath, voiceId = ELEVEN_VOICE_ID) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVEN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────
// Great English quality, simple API
// Docs: https://platform.openai.com/docs/guides/text-to-speech
// Cost: ~$15/1M chars | Voices: alloy, echo, fable, onyx, nova, shimmer

async function openaiTTS(text, outputPath, voice = "nova") {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", input: text, voice }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// ── PlayHT ────────────────────────────────────────────────────────────────────
// Wide voice selection including Indian voices
// Docs: https://docs.play.ht
// Free: limited trial | Set PLAYHT_API_KEY + PLAYHT_USER_ID

async function playhtTTS(text, outputPath, voice = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json") {
  const res = await fetch("https://api.play.ht/api/v2/tts/stream", {
    method: "POST",
    headers: {
      "AUTHORIZATION": PLAYHT_KEY,
      "X-USER-ID": PLAYHT_USER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice,
      output_format: "mp3",
      voice_engine: "PlayHT2.0",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`PlayHT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// ── Microsoft Edge TTS ────────────────────────────────────────────────────────
// Free, no key, good quality. Requires: pip install edge-tts
// Indian English: en-IN-NeerjaNeural, en-IN-PrabhatNeural
// Hindi: hi-IN-SwaraNeural, hi-IN-MadhurNeural

async function edgeTTS(text, outputPath, voice = DEFAULT_VOICE_EN) {
  const result = spawnSync(
    "edge-tts",
    ["--voice", voice, "--text", text, "--write-media", outputPath],
    { encoding: "utf8", timeout: 30_000 }
  );
  if (result.error) throw new Error(`edge-tts spawn: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`edge-tts: ${result.stderr?.slice(0, 200)}`);
}

// ── Google TTS ────────────────────────────────────────────────────────────────
// Free basic quality, no key needed for simple usage
// Uses google-tts-api npm package

async function googleTTS(text, outputPath, lang = "en") {
  const { googleTextToSpeech } = await import("google-tts-api").catch(() => {
    throw new Error("google-tts-api not installed. Run: npm install google-tts-api");
  });

  const url = googleTextToSpeech(text.slice(0, 200), { lang, slow: false });
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Google TTS ${res.status}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// ── Main exported functions ───────────────────────────────────────────────────

/**
 * Generate audio for a text string, cascading through available providers.
 *
 * @param {string} text       - Text to synthesize
 * @param {string} outputPath - Where to save the MP3
 * @param {object} opts
 * @param {string} opts.lang  - Language hint: "en", "hi", "ta", etc. (default: env TTS_LANG or "en")
 * @returns {Promise<string>} - Path to saved audio file
 */
export async function generateAudio(text, outputPath, { lang = DEFAULT_LANG } = {}) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const isHindi = lang === "hi" || lang.startsWith("hi-");
  const isIndian = ["hi", "bn", "kn", "ml", "mr", "pa", "ta", "te", "gu", "od"].some(l => lang.startsWith(l));

  // Build provider cascade based on what keys are set + language
  const cascade = [];

  // Sarvam first for Indian languages
  if (SARVAM_KEY && isIndian) {
    const langCode = isHindi ? "hi-IN" : (lang.includes("-") ? lang : `${lang}-IN`);
    const speaker = isHindi ? "anushka" : "meera";
    cascade.push({ name: "Sarvam AI", fn: () => sarvamTTS(text, outputPath, { langCode, speakerName: speaker }) });
  }

  // ElevenLabs — best English quality
  if (ELEVEN_KEY) {
    cascade.push({ name: "ElevenLabs", fn: () => elevenLabsTTS(text, outputPath) });
  }

  // OpenAI TTS
  if (OPENAI_KEY) {
    cascade.push({ name: "OpenAI TTS", fn: () => openaiTTS(text, outputPath) });
  }

  // PlayHT
  if (PLAYHT_KEY && PLAYHT_USER) {
    cascade.push({ name: "PlayHT", fn: () => playhtTTS(text, outputPath) });
  }

  // Edge TTS — always available (free), best fallback
  const edgeVoice = isHindi ? DEFAULT_VOICE_HI : DEFAULT_VOICE_EN;
  cascade.push({ name: `Edge TTS (${edgeVoice})`, fn: () => edgeTTS(text, outputPath, edgeVoice) });

  // Google TTS — last resort
  cascade.push({ name: "Google TTS", fn: () => googleTTS(text, outputPath, lang.split("-")[0]) });

  // Try each in order
  for (const provider of cascade) {
    try {
      await provider.fn();
      console.log(`  [TTS] ${provider.name} → ${path.basename(outputPath)}`);
      return outputPath;
    } catch (err) {
      console.warn(`  [TTS] ${provider.name} failed: ${err.message.slice(0, 80)}`);
    }
  }

  throw new Error(`All TTS providers failed for: "${text.slice(0, 60)}..."`);
}

/**
 * Generate audio for all segments in a script.
 *
 * @param {object} script    - { hook, segments: [{id, narration}], cta }
 * @param {string} outputDir - Directory for audio files
 * @param {object} opts
 * @param {string} opts.lang - Language (default: env TTS_LANG or "en")
 * @returns {Promise<Array>}
 */
export async function generateScriptAudio(script, outputDir, { lang = DEFAULT_LANG } = {}) {
  console.log(`\n[Audio] Generating audio (lang: ${lang})...`);
  fs.mkdirSync(outputDir, { recursive: true });

  const allSegments = [
    { id: "hook", text: script.hook },
    ...script.segments.map(s => ({ id: s.id, text: s.narration })),
    { id: "cta", text: script.cta },
  ];

  const results = [];
  for (const seg of allSegments) {
    const audioPath = path.join(outputDir, `${seg.id}.mp3`);
    await generateAudio(seg.text, audioPath, { lang });
    results.push({ id: seg.id, text: seg.text, audioPath });
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Audio] ${results.length} segments done`);
  return results;
}
