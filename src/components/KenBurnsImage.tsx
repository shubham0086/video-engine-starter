/**
 * KenBurnsImage — Animated background image with pan + zoom
 *
 * Always animate static images. A moving background increases entropy,
 * keeps viewers engaged, and costs zero extra — it's pure CSS interpolation.
 *
 * Props:
 *   src        — image URL (use staticFile() for local assets)
 *   from       — starting scale (default 1.0)
 *   to         — ending scale (default 1.12)
 *   panX       — horizontal pan offset in px (default 0)
 *   panY       — vertical pan offset in px (default 0)
 *   opacity    — optional override (handles fade-in/fade-out externally)
 */

import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface KenBurnsConfig {
  from?: number;
  to?: number;
  panX?: number;
  panY?: number;
}

interface KenBurnsImageProps {
  src: string;
  config?: KenBurnsConfig;
  opacity?: number;
  style?: React.CSSProperties;
}

// Default presets — alternate them across scenes to avoid monotony
export const KB_PRESETS: KenBurnsConfig[] = [
  { from: 1.0, to: 1.10 },
  { from: 1.10, to: 1.0 },
  { from: 1.02, to: 1.12, panX: 20 },
  { from: 1.12, to: 1.02, panX: -20 },
  { from: 1.0, to: 1.15, panY: 15 },
];

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  config,
  opacity = 1,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const cfg: Required<KenBurnsConfig> = {
    from: config?.from ?? 1.0,
    to: config?.to ?? 1.1,
    panX: config?.panX ?? 0,
    panY: config?.panY ?? 0,
  };

  const easing = Easing.inOut(Easing.cubic);

  const scale = interpolate(frame, [0, durationInFrames], [cfg.from, cfg.to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

  const translateX = interpolate(frame, [0, durationInFrames], [0, cfg.panX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, cfg.panY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        opacity,
        ...style,
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
