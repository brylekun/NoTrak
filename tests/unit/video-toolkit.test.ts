import { describe, expect, it } from "vitest";

import {
  buildVideoCommand,
  estimateVideoBytes,
  formatDuration,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION,
  targetVideoDimensions,
  validateVideoFile,
  validateVideoMetadata,
  validateVideoSettings,
  videoInputExtension,
  videoOutputName,
  type VideoMetadata,
  type VideoSettings,
} from "../../lib/video/toolkit";

const metadata: VideoMetadata = { duration: 60, width: 1920, height: 1080 };
const settings: VideoSettings = { start: 5, end: 35, aspect: "9:16", resolution: 720, quality: "balanced", muted: false, volume: 80 };

describe("video toolkit policy", () => {
  it("accepts supported MP4 and WebM files", () => {
    expect(videoInputExtension({ name: "clip.MP4", type: "" } as File)).toBe("mp4");
    expect(videoInputExtension({ name: "clip", type: "video/webm" } as File)).toBe("webm");
    expect(() => validateVideoFile({ name: "clip.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES } as File)).not.toThrow();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(() => validateVideoFile({ name: "clip.avi", type: "video/x-msvideo", size: 20 } as File)).toThrow(/MP4 or WebM/);
    expect(() => validateVideoFile({ name: "clip.mp4", type: "video/mp4", size: 0 } as File)).toThrow(/empty/);
    expect(() => validateVideoFile({ name: "clip.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 } as File)).toThrow(/75 MB/);
  });

  it("validates duration and dimensions", () => {
    expect(() => validateVideoMetadata(metadata)).not.toThrow();
    expect(() => validateVideoMetadata({ ...metadata, duration: MAX_VIDEO_DURATION + 0.01 })).toThrow(/3 minutes/);
    expect(() => validateVideoMetadata({ ...metadata, width: 5000 })).toThrow(/4K/);
    expect(() => validateVideoMetadata({ ...metadata, duration: Number.NaN })).toThrow(/duration/);
  });

  it("requires a bounded trim and audio range", () => {
    expect(validateVideoSettings(settings, metadata).duration).toBe(30);
    expect(() => validateVideoSettings({ ...settings, end: 5.4 }, metadata)).toThrow(/0.5 seconds/);
    expect(() => validateVideoSettings({ ...settings, end: 61 }, metadata)).toThrow(/trim range/);
    expect(() => validateVideoSettings({ ...settings, volume: 151 }, metadata)).toThrow(/150%/);
  });
});

describe("video toolkit output", () => {
  it.each([
    ["16:9", 720, 1280, 720], ["16:9", 1080, 1920, 1080],
    ["1:1", 720, 720, 720], ["4:5", 1080, 1080, 1350], ["9:16", 720, 720, 1280],
  ] as const)("maps %s at %sp to %sx%s", (aspect, resolution, width, height) => {
    expect(targetVideoDimensions(metadata, aspect, resolution)).toEqual({ width, height });
  });

  it("keeps original proportions without upscaling and uses even dimensions", () => {
    expect(targetVideoDimensions({ width: 641, height: 359 }, "original", 1080)).toEqual({ width: 640, height: 358 });
    expect(targetVideoDimensions({ width: 3840, height: 2160 }, "original", 720)).toEqual({ width: 1280, height: 720 });
    expect(targetVideoDimensions({ width: 1080, height: 1920 }, "original", 720)).toEqual({ width: 720, height: 1280 });
  });

  it("builds a bounded H.264/AAC command with metadata removed", () => {
    const command = buildVideoCommand("input.webm", "output.mp4", settings, metadata);
    expect(command).toContain("libx264"); expect(command).toContain("aac");
    expect(command).toContain("volume=0.80"); expect(command).toContain("-map_metadata"); expect(command).toContain("-map_chapters");
    expect(command).toContain("scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,setsar=1");
    expect(command.at(-1)).toBe("output.mp4");
  });

  it("removes audio when muted and avoids unnecessary upscaling", () => {
    const command = buildVideoCommand("input.mp4", "output.mp4", { ...settings, aspect: "original", resolution: 1080, muted: true }, metadata);
    expect(command).toContain("-an"); expect(command).not.toContain("aac");
    expect(command).toContain("scale=1920:1080:flags=lanczos,setsar=1");
  });

  it("provides conservative names, readable time, and explicitly approximate estimates", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(videoOutputName("../../My private clip!!.MOV", "processed", "mp4")).toBe("My-private-clip-processed.mp4");
    const full = estimateVideoBytes(10_000_000, metadata, { ...settings, start: 0, end: 60 });
    const trim = estimateVideoBytes(10_000_000, metadata, settings);
    expect(trim).toBeLessThan(full);
    expect(estimateVideoBytes(10_000_000, metadata, { ...settings, muted: true })).toBeLessThan(trim);
  });
});
