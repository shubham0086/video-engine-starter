/**
 * BasicReel — Minimal Remotion composition
 *
 * Reads manifest.json from public/<slug>/manifest.json
 * Renders: background image (Ken Burns) + narration text + audio per scene
 *
 * This is the entry point composition for most pipelines.
 * Extend it or copy it to create your brand's template.
 *
 * TimelineDNA contract (what manifest.json must contain):
 * {
 *   title: string,
 *   slug: string,
 *   fps: 30,
 *   totalFrames: number,
 *   scenes: [{
 *     id: string,
 *     narration: string,
 *     image: string,         // relative to public/
 *     audio: string,         // relative to public/
 *     durationInFrames: number  // computed by temporal-authority.mjs
 *   }]
 * }
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { z } from 'zod';
import { KenBurnsImage, KB_PRESETS } from '../components/KenBurnsImage';

// ── Schema ────────────────────────────────────────────────────────────────────
export const basicReelSchema = z.object({
  slug: z.string(),
  totalFrames: z.number().optional(),
});

export type BasicReelProps = z.infer<typeof basicReelSchema>;

// ── calculateMetadata — called by Remotion before render ─────────────────────
export async function calculateBasicReelMetadata({ props }: { props: BasicReelProps }) {
  try {
    const manifest = await fetch(staticFile(`${props.slug}/manifest.json`)).then(r => r.json());
    return {
      fps: manifest.fps || 30,
      width: 1080,
      height: 1920,
      durationInFrames: manifest.totalFrames || props.totalFrames || 900,
    };
  } catch {
    return { fps: 30, width: 1080, height: 1920, durationInFrames: props.totalFrames || 900 };
  }
}

// ── Scene component ───────────────────────────────────────────────────────────
interface Scene {
  id: string;
  narration: string;
  image: string;
  audio: string;
  durationInFrames: number;
}

const SceneView: React.FC<{ scene: Scene; index: number }> = ({ scene, index }) => {
  const frame = useCurrentFrame();

  const FADE_FRAMES = 12;

  // Text fade in
  const textOpacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Text slide up
  const textY = interpolate(frame, [0, FADE_FRAMES], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const kbConfig = KB_PRESETS[index % KB_PRESETS.length];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      {/* Background: Ken Burns animated image */}
      <KenBurnsImage src={staticFile(scene.image)} config={kbConfig} />

      {/* Dark gradient overlay — bottom third */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
        }}
      />

      {/* Caption text */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: '60px 48px',
        }}
      >
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.3,
            fontFamily: 'Inter, system-ui, sans-serif',
            margin: 0,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            maxWidth: '90%',
          }}
        >
          {scene.narration}
        </p>
      </AbsoluteFill>

      {/* Audio — duration pre-computed by temporal-authority.mjs, not guessed */}
      <Audio src={staticFile(scene.audio)} />
    </AbsoluteFill>
  );
};

// ── Main composition ──────────────────────────────────────────────────────────
export const BasicReel: React.FC<BasicReelProps> = ({ slug }) => {
  const [scenes, setScenes] = React.useState<Scene[]>([]);

  React.useEffect(() => {
    fetch(staticFile(`${slug}/manifest.json`))
      .then(r => r.json())
      .then(m => setScenes(m.scenes || []))
      .catch(() => {});
  }, [slug]);

  if (scenes.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }} />;
  }

  return (
    <Series>
      {scenes.map((scene, i) => (
        <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
          <SceneView scene={scene} index={i} />
        </Series.Sequence>
      ))}
    </Series>
  );
};
