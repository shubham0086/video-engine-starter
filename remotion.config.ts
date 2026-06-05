import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Default output codec — MP4 for widest compatibility
Config.setCodec("h264");

// Entry point — all compositions registered in Root.tsx
// Remotion reads this file automatically.
