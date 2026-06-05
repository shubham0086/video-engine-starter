# Canonical Code Patterns — video-engine-starter

Reference these patterns when extending the repo. Consistency matters.

---

## 1. Cascading provider pattern

Used in both `llm-router.mjs` and `audio-gen.mjs`. Never hard-code a single provider.

```js
const cascade = [];

if (process.env.PROVIDER_A_KEY) {
  cascade.push({ name: "Provider A", fn: () => callProviderA(text) });
}
if (process.env.PROVIDER_B_KEY) {
  cascade.push({ name: "Provider B", fn: () => callProviderB(text) });
}
// Always-available fallback last
cascade.push({ name: "Free Fallback", fn: () => callFree(text) });

for (const provider of cascade) {
  try {
    const result = await provider.fn();
    console.log(`[OK] ${provider.name}`);
    return result;
  } catch (err) {
    console.warn(`[SKIP] ${provider.name}: ${err.message.slice(0, 80)}`);
  }
}
throw new Error("All providers failed");
```

**Rules:**
- Skip-on-failure, never crash the pipeline for a single provider
- Log provider name on success (`[OK]`) and failure (`[SKIP]`)
- Always have a no-key fallback at the end

---

## 2. Temporal Authority — audio drives time

Never compute frame count anywhere except `temporal-authority.mjs`.

```js
// CORRECT — measure audio, convert to frames
import { audioToFrames } from "./temporal-authority.mjs";
const durationInFrames = audioToFrames(audioFilePath, 30);

// WRONG — guessing time in React
const durationInFrames = text.split(" ").length * 5; // never do this
```

Frame count must be an integer (use `Math.ceil`). Remotion rejects floats.

---

## 3. Manifest shape (TimelineDNA)

Always write manifests with this exact shape. Remotion's `calculateMetadata` reads it.

```js
const manifest = {
  title: "string",
  slug: "kebab-case-string",
  fps: 30,
  totalFrames: scenes.reduce((s, sc) => s + sc.durationInFrames, 0),
  scenes: scenes.map(s => ({
    id: s.id,                        // "hook", "s1", "s2", "cta"
    narration: s.text,               // displayed as caption
    image: `${slug}/${s.id}.jpg`,    // relative to public/
    audio: `${slug}/${s.id}.mp3`,    // relative to public/
    durationInFrames: s.frames,      // integer, from temporal-authority
  })),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
```

---

## 4. Remotion composition pattern

```tsx
// Always use Series + Series.Sequence for multi-scene videos
// Never manually compute frame offsets — Series handles it
return (
  <Series>
    {scenes.map((scene, i) => (
      <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
        <SceneView scene={scene} index={i} />
      </Series.Sequence>
    ))}
  </Series>
);
```

For animations within a scene, use `useCurrentFrame()` + `interpolate()`:

```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 12], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
```

---

## 5. LLM JSON output pattern

Always ask LLM for JSON with explicit schema. Always use `parseJSON()` to strip markdown fences.

```js
// In system prompt:
`You MUST respond with ONLY valid JSON matching this schema exactly:
{
  "title": "string",
  "hook": "string (10-15 words)",
  "segments": [{ "id": "s1", "narration": "string", "visualHint": "string", "durationHint": 5 }],
  "cta": "string"
}
No markdown, no explanation, just the JSON object.`

// Parse defensively:
import { parseJSON } from "./llm-router.mjs";
const script = parseJSON(rawLLMOutput); // strips ```, extracts JSON
```

---

## 6. TTS → audio file pattern

```js
// All TTS functions write to a file path, not return bytes
// outputPath is always .mp3
// Exception: Sarvam returns WAV → convert via ffmpeg before returning

async function myTTS(text, outputPath, options) {
  const res = await fetch(API_URL, { ... });
  if (!res.ok) throw new Error(`MyTTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  // No return value needed — caller knows the path
}
```

---

## 7. Ken Burns preset cycling

Always cycle presets by scene index so adjacent scenes have different motion:

```tsx
const kbConfig = KB_PRESETS[index % KB_PRESETS.length];
return <KenBurnsImage src={src} config={kbConfig} />;
```

Add new presets to `KB_PRESETS` in `src/components/KenBurnsImage.tsx`.
Rule: first preset zooms in, second zooms out, alternating keeps it dynamic.

---

## 8. Pipeline step pattern

Each step in `run.mjs` follows this shape:

```js
async function stepName(input) {
  console.log("\n── Step N: Description ────────────────────────────");
  if (dryRun) {
    console.log("  [dry-run] Would do X");
    return defaultValue;
  }
  // real work
  return result;
}
```

Steps must be sequential (each feeds the next). Never parallelize steps — they're a dependency chain.
