/**
 * Root.tsx — Remotion Composition Registry
 *
 * All compositions must be registered here.
 * Remotion reads this file to know what's available for render.
 *
 * Add new compositions by importing and registering with <Composition>.
 */

import { Composition } from 'remotion';
import { BasicReel, basicReelSchema, calculateBasicReelMetadata } from './BasicReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/**
       * BasicReel — default template
       * Reads manifest from public/<slug>/manifest.json
       */}
      <Composition
        id="BasicReel"
        component={BasicReel}
        schema={basicReelSchema}
        calculateMetadata={calculateBasicReelMetadata}
        // Defaults — overridden by calculateMetadata at render time
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={900}
        defaultProps={{ slug: "example" }}
      />
    </>
  );
};
