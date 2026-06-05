/**
 * temporal-authority.mjs — The Source of Truth for Time
 *
 * React (Remotion) cannot async-wait for audio. It renders frames synchronously.
 * This means all timing must be crystallised into integers BEFORE React runs.
 *
 * This module uses ffprobe (ships with ffmpeg) to read actual audio duration,
 * then converts seconds → frames at your target FPS.
 *
 * RULE: Never trust a TTS API's "duration" field. Measure the actual file.
 *       A 200ms error in duration = 6 frames of desync. Viewers notice.
 *
 * Usage:
 *   import { audioToFrames, buildTimelineFrames } from "./temporal-authority.mjs";
 *
 *   const frames = audioToFrames("public/scene_0.mp3", 30);
 *   // → 156 (if audio is 5.2 seconds at 30fps)
 */

import { spawnSync } from "child_process";
import fs from "fs";

const DEFAULT_FPS = 30;
const DEFAULT_FALLBACK_SECONDS = 5;

/**
 * Get the exact duration of an audio file using ffprobe.
 *
 * @param {string} filePath - Absolute or relative path to audio file
 * @returns {number}        - Duration in seconds (float)
 */
export function getAudioDuration(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[TemporalAuthority] File not found: ${filePath} — using fallback ${DEFAULT_FALLBACK_SECONDS}s`);
    return DEFAULT_FALLBACK_SECONDS;
  }

  const result = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf8" }
  );

  if (result.error) {
    console.warn(`[TemporalAuthority] ffprobe error: ${result.error.message} — using fallback`);
    return DEFAULT_FALLBACK_SECONDS;
  }

  const parsed = parseFloat(result.stdout.trim());
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(`[TemporalAuthority] Could not parse duration for ${filePath} — using fallback`);
    return DEFAULT_FALLBACK_SECONDS;
  }

  return parsed;
}

/**
 * Convert audio duration to frame count.
 * Always rounds UP (Math.ceil) — never cut audio short.
 *
 * @param {string} filePath - Path to audio file
 * @param {number} fps      - Frames per second (default 30)
 * @returns {number}        - Integer frame count
 */
export function audioToFrames(filePath, fps = DEFAULT_FPS) {
  const seconds = getAudioDuration(filePath);
  return Math.ceil(seconds * fps);
}

/**
 * Build a frame-accurate timeline from a list of scenes with audio files.
 * Returns the total duration and per-scene frame counts.
 *
 * @param {Array<{id: string, audioFile: string}>} scenes
 * @param {number} fps
 * @returns {{ totalFrames: number, scenes: Array<{id, durationInFrames, durationSeconds}> }}
 */
export function buildTimelineFrames(scenes, fps = DEFAULT_FPS) {
  const result = scenes.map((scene) => {
    const durationSeconds = getAudioDuration(scene.audioFile);
    const durationInFrames = Math.ceil(durationSeconds * fps);
    return { id: scene.id, durationInFrames, durationSeconds };
  });

  const totalFrames = result.reduce((sum, s) => sum + s.durationInFrames, 0);

  console.log(
    `[TemporalAuthority] Timeline locked: ${result.length} scenes, ` +
    `${(totalFrames / fps).toFixed(1)}s total (${totalFrames} frames at ${fps}fps)`
  );

  return { totalFrames, scenes: result };
}
