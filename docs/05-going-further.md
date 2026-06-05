# 05 — Going Further: From Starter to Production

This guide covers what to build next once you've got the starter working.

---

## 1. Add a second Remotion composition

The starter ships with `BasicReel`. Clone it to build variants.

### CaptionedReel (word-by-word subtitles)

```tsx
// src/CaptionedReel/index.tsx
import { useCurrentFrame, interpolate } from 'remotion';

interface Word {
  word: string;
  start: number; // in frames
  end: number;   // in frames
}

const WordHighlight: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const currentWord = words.find(w => frame >= w.start && frame <= w.end);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {words.map((w, i) => (
        <span key={i} style={{
          color: w === currentWord ? '#FFD700' : '#FFFFFF',
          fontWeight: w === currentWord ? 900 : 600,
          transition: 'all 0.1s',
        }}>
          {w.word}
        </span>
      ))}
    </div>
  );
};
```

To get word timings, use ElevenLabs' `/v1/text-to-speech/:voice_id/with-timestamps` endpoint — it returns start/end time per character/word. Convert seconds to frames using `Math.round(seconds * fps)`.

### Register in Root.tsx

```tsx
import { CaptionedReel, captionedReelSchema, calculateCaptionedReelMetadata } from './CaptionedReel';

// Inside RemotionRoot:
<Composition
  id="CaptionedReel"
  component={CaptionedReel}
  schema={captionedReelSchema}
  calculateMetadata={calculateCaptionedReelMetadata}
  fps={30}
  width={1080}
  height={1920}
  durationInFrames={900}
  defaultProps={{ slug: "example" }}
/>
```

---

## 2. Batch rendering pipeline

Run `node pipeline/run.mjs` for multiple topics automatically:

```bash
# topics.txt
The science of deep sleep
Why your gut is your second brain
The focus hack nobody talks about
```

```bash
# batch.sh
while IFS= read -r topic; do
  node pipeline/run.mjs "$topic" --skip-render
done < topics.txt

# Then render all at once
for slug in out/*.json; do
  npx remotion render BasicReel "${slug%.json}.mp4" --props="$slug"
done
```

Or use Remotion Lambda for cloud rendering — submit renders without waiting for local completion.

---

## 3. Remotion Lambda (cloud rendering)

For production scale, render in AWS Lambda instead of locally:

```bash
npm install @remotion/lambda
npx remotion lambda sites create --site-name=my-video
npx remotion lambda render my-video BasicReel --props='{"slug":"deep-sleep"}'
```

Cost: ~$0.03/minute of render time. A 30s video renders in ~2-3 minutes = ~$0.08 per video.

---

## 4. Scheduled content calendar

Use GitHub Actions or cron to generate videos automatically:

```yaml
# .github/workflows/daily-video.yml
name: Daily Video
on:
  schedule:
    - cron: '0 6 * * *'  # 6am UTC daily

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: pip install edge-tts
      - run: sudo apt install ffmpeg
      - run: node pipeline/run.mjs "${{ vars.DAILY_TOPIC }}" --skip-render
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          SARVAM_API_KEY: ${{ secrets.SARVAM_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: video-assets
          path: public/
```

---

## 5. Dynamic topic generation

Instead of manually providing topics, let the LLM suggest them:

```js
// pipeline/topic-generator.mjs
export async function generateTopics(niche, count = 10) {
  const prompt = `Generate ${count} viral short-form video topics for the "${niche}" niche.
  Each topic should be:
  - Counterintuitive or surprising
  - Under 10 words
  - Suitable for 30-second video
  
  Return ONLY a JSON array: ["topic1", "topic2", ...]`;
  
  const raw = await routeLLM("You generate viral video topics.", prompt);
  return JSON.parse(parseJSON(raw));
}
```

---

## 6. A/B testing hook variants

The hook (first 3 seconds) is the highest-leverage variable. Generate multiple hooks, test them:

```js
// Generate 3 hook variants
const hookVariants = await Promise.all([
  generateScript(topic, { hookStyle: "shocking-stat" }),
  generateScript(topic, { hookStyle: "counterintuitive" }),
  generateScript(topic, { hookStyle: "question" }),
]);

// Render all 3
for (const [i, script] of hookVariants.entries()) {
  await runPipeline(script, `${slug}-variant-${i}`);
}
```

Hook patterns that work:
1. **Shocking stat** — "95% of people do this wrong..."
2. **Counterintuitive** — "Stop drinking 8 glasses of water a day"
3. **Question** — "Why do you feel tired after sleeping 8 hours?"
4. **Negation** — "This is NOT how motivation works"

---

## 7. Multilingual content expansion

The TTS cascade already handles 11 Indian languages. Add language-specific pipelines:

```js
const languages = [
  { lang: "en", voice: "en-IN-NeerjaNeural", label: "English" },
  { lang: "hi", voice: "hi-IN-SwaraNeural", label: "Hindi" },
  { lang: "ta", voice: "ta-IN-PallaviNeural", label: "Tamil" },
  { lang: "bn", voice: "bn-IN-TanishaaNeural", label: "Bengali" },
];

for (const lang of languages) {
  const script = await generateScript(topic, { language: lang.lang });
  const audioDir = `public/${slug}-${lang.lang}`;
  await generateScriptAudio(script, audioDir, { lang: lang.lang });
  // ... rest of pipeline
}
```

For Sarvam AI (best for Indian languages), the provider already picks up `hi-IN`, `ta-IN`, `bn-IN` etc. automatically from the `lang` option.

---

## 8. Custom fonts in Remotion

Remotion can use Google Fonts or local fonts:

```tsx
// src/BasicReel/index.tsx
import { loadFont } from "@remotion/google-fonts/NotoSansDevanagari";

const { fontFamily } = loadFont(); // loads Noto Sans Devanagari for Hindi text

// In your component:
<p style={{ fontFamily }}>
  {scene.narration}
</p>
```

For Hindi content, use `NotoSansDevanagari` for proper Devanagari rendering.

Install: `npm install @remotion/google-fonts`

---

## 9. Scene transition effects

Add cross-fade between scenes by overlapping sequences:

```tsx
// Use <Sequence> with offset for overlapping transitions
const TRANSITION_FRAMES = 15;

return (
  <AbsoluteFill>
    {scenes.map((scene, i) => {
      const start = scenes.slice(0, i).reduce((s, sc) => s + sc.durationInFrames - TRANSITION_FRAMES, 0);
      return (
        <Sequence key={scene.id} from={start} durationInFrames={scene.durationInFrames}>
          <SceneWithFadeInOut scene={scene} fadeFrames={TRANSITION_FRAMES} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
```

Note: Overlapping sequences increase total video duration complexity. Keep it simple until you need it.

---

## 10. Uploading to YouTube / Instagram

After rendering, automate upload:

```bash
# YouTube (via yt-dlp's upload feature or YouTube Data API)
# Instagram (via instagrapi Python library)
# TikTok (via TikTok for Developers API)
```

These are outside the scope of this starter — they involve OAuth flows and platform-specific APIs. Consider using a service like n8n or Zapier to connect your rendered video to social posting.

---

## What to NOT add to the starter

This is a teaching repo. Keep it simple:

- No database (Supabase/Postgres) — teach the concept, not the persistence layer
- No auth/user management — one user, one machine
- No Docker — adds friction for learners
- No CI/CD — that's for production repos

When learners outgrow the starter, they're ready to build their own production system. That's the goal.

---

## Reference: production architecture (what KAAL does)

If you want to see where this goes at production scale, the production system adds:

- **Hook validator** — scores hook against 4 engagement patterns before rendering
- **Entropy scoring** — measures visual interest score per scene, mutates boring scenes
- **Jump-cut injection** — splits long static scenes for better pacing
- **A/B testing** — renders hook variants, tracks retention
- **TrueScore** — composite engagement prediction (hook + entropy + pacing)
- **Batch queue** — Supabase-backed render queue with Remotion Lambda
- **Analytics loop** — post-render performance feeds back into prompt calibration

These are proprietary and not in this starter. Build the basics here, then architect your moat.
