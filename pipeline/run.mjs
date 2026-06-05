#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateScript } from "./script-agent.mjs";
import { generateScriptAudio } from "./audio-gen.mjs";
import { buildTimelineFrames } from "./temporal-authority.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Load .env manually — no dotenv dependency
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  });
}

const args = process.argv.slice(2);
const topic = args.find((a) => !a.startsWith("--"));

if (!topic) {
  console.log(`
  video-engine-starter — End-to-End Pipeline

  Usage:
    node pipeline/run.mjs "Your topic here"
    node pipeline/run.mjs "Gut health myths" --duration 45
    node pipeline/run.mjs "Focus hacks" --skip-render
    node pipeline/run.mjs "Morning routine" --dry-run

  Options:
    --duration N    Target video duration in seconds (default: 30)
    --skip-render   Generate assets only, skip Remotion render
    --dry-run       Show plan only — no API calls, no files written
  `);
  process.exit(0);
}

const duration = parseInt(args[args.indexOf("--duration") + 1]) || 30;
const skipRender = args.includes("--skip-render");
const dryRun = args.includes("--dry-run");
const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const publicDir = path.join(ROOT, "public", slug);
const outDir = path.join(ROOT, "out");

async function stepScript() {
  console.log("\n── Step 1: Script Generation ──────────────────────");
  if (dryRun) {
    console.log("  [dry-run] Would call LLM router with fallback chain");
    return {
      title: "Example Title",
      hook: "This is a placeholder hook.",
      segments: [
        { id: "s1", narration: "Placeholder narration.", visualHint: "Abstract background", durationHint: 5 },
        { id: "s2", narration: "More placeholder narration.", visualHint: "Text overlay", durationHint: 5 },
      ],
      cta: "Follow for more.",
    };
  }
  return await generateScript(topic, { duration });
}

async function stepAudio(script) {
  console.log("\n── Step 2: Audio Generation ───────────────────────");
  if (dryRun) {
    console.log("  [dry-run] Would call TTS cascade");
    return [];
  }
  return await generateScriptAudio(script, publicDir);
}

function stepTimeline(script, audioResults) {
  console.log("\n── Step 3: Temporal Authority ─────────────────────");
  if (dryRun || audioResults.length === 0) {
    console.log("  [dry-run] Would measure audio durations via ffprobe");
    return { totalFrames: duration * 30, scenes: [] };
  }
  return buildTimelineFrames(audioResults.map((a) => ({ id: a.id, audioFile: a.audioPath })));
}

async function stepImages(script) {
  console.log("\n── Step 4: Background Images ──────────────────────");

  const allSegments = [
    { id: "hook", visualHint: script.hook },
    ...script.segments,
    { id: "cta", visualHint: script.cta },
  ];

  for (const seg of allSegments) {
    const imagePath = path.join(publicDir, `${seg.id}.jpg`);

    if (fs.existsSync(imagePath)) {
      console.log(`  [Images] ${seg.id}.jpg exists — skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would fetch image for: "${seg.visualHint || seg.narration}"`);
      continue;
    }

    try {
      const prompt = encodeURIComponent(
        `${seg.visualHint || seg.narration}, cinematic, vertical 9:16, atmospheric, professional photography`
      );
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1920&nologo=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(imagePath, Buffer.from(buffer));
      console.log(`  [Images] ${seg.id}.jpg (${(buffer.byteLength / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.warn(`  [Images] Failed for ${seg.id}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

function stepManifest(script, timeline) {
  console.log("\n── Step 5: Manifest ───────────────────────────────");

  const allSegments = [
    { id: "hook", text: script.hook },
    ...script.segments.map(s => ({ id: s.id, text: s.narration })),
    { id: "cta", text: script.cta },
  ];

  const scenes = allSegments.map((seg) => {
    const frameInfo = timeline.scenes.find(s => s.id === seg.id);
    return {
      id: seg.id,
      narration: seg.text,
      image: `${slug}/${seg.id}.jpg`,
      audio: `${slug}/${seg.id}.mp3`,
      durationInFrames: frameInfo?.durationInFrames || Math.round((duration / allSegments.length) * 30),
    };
  });

  const manifest = {
    title: script.title,
    slug,
    fps: 30,
    totalFrames: timeline.totalFrames || scenes.reduce((s, sc) => s + sc.durationInFrames, 0),
    scenes,
  };

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`  [Manifest] public/${slug}/manifest.json — ${scenes.length} scenes, ${(manifest.totalFrames / 30).toFixed(1)}s`);
  return manifest;
}

async function stepRender(manifest) {
  console.log("\n── Step 6: Remotion Render ────────────────────────");

  if (dryRun) {
    console.log(`  [dry-run] Would run: npx remotion render BasicReel out/${slug}.mp4`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${slug}.mp4`);
  const propsFile = path.join(outDir, `${slug}-props.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ slug, totalFrames: manifest.totalFrames }));

  const { spawnSync } = await import("child_process");
  // spawnSync with array args — avoids shell string interpolation
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    ["remotion", "render", "BasicReel", outFile, `--props=${propsFile}`],
    { cwd: ROOT, stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.error("  Remotion render failed. Preview first: npx remotion studio");
    throw new Error("Remotion render exited non-zero");
  }

  const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`\n  Rendered → out/${slug}.mp4 (${size} MB)`);
}

async function main() {
  console.log(`\nvideo-engine-starter`);
  console.log(`Topic: "${topic}" | Duration: ${duration}s | Slug: ${slug}`);
  if (dryRun) console.log("Mode: DRY RUN\n");

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const script = await stepScript();
  const audioResults = await stepAudio(script);
  const timeline = stepTimeline(script, audioResults);
  await stepImages(script);
  const manifest = stepManifest(script, timeline);

  if (!skipRender) {
    await stepRender(manifest);
  } else {
    console.log(`\nAssets ready. Render manually:`);
    console.log(`  npx remotion studio`);
    console.log(`  npx remotion render BasicReel out/${slug}.mp4`);
  }

  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error(`\nPipeline failed: ${err.message}`);
  process.exit(1);
});
