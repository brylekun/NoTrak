import { describe, expect, it } from "vitest";

import {
  audioInputExtension,
  audioOutputName,
  buildAudioCommand,
  estimateAudioBytes,
  formatAudioDuration,
  validateAudioFile,
  validateAudioMetadata,
  validateAudioSettings,
  type AudioSettings,
} from "../../lib/audio/toolkit";

const metadata = { duration: 120 };
const settings: AudioSettings = {
  start: 5,
  end: 65,
  format: "mp3",
  bitrate: 192,
  volume: 125,
  normalize: true,
  mono: true,
  fadeIn: 1,
  fadeOut: 2,
};

describe("private audio toolkit", () => {
  it("recognizes supported input names and enforces limits", () => {
    expect(audioInputExtension({ name: "note.MP3", type: "" })).toBe("mp3");
    expect(audioInputExtension({ name: "recording", type: "audio/mp4" })).toBe("m4a");
    expect(() => validateAudioFile({ name: "note.wav", type: "audio/wav", size: 100 })).not.toThrow();
    expect(() => validateAudioFile({ name: "note.txt", type: "text/plain", size: 100 })).toThrow(/MP3/);
    expect(() => validateAudioMetadata({ duration: 1801 })).toThrow(/30 minutes/);
  });

  it("validates trim, volume, and fades", () => {
    expect(validateAudioSettings(settings, metadata)).toEqual({ duration: 60 });
    expect(() => validateAudioSettings({ ...settings, end: 5.1 }, metadata)).toThrow(/0.25 seconds/);
    expect(() => validateAudioSettings({ ...settings, fadeIn: 10, fadeOut: 10, end: 20 }, metadata)).toThrow(/combined fades/);
    expect(() => validateAudioSettings({ ...settings, volume: 205 }, metadata)).toThrow(/between 0% and 200%/);
  });

  it("builds a metadata-free filtered MP3 command", () => {
    const command = buildAudioCommand("input.wav", "output.mp3", settings, metadata);
    expect(command).toContain("-map_metadata");
    expect(command).toContain("libmp3lame");
    expect(command).toContain("192k");
    expect(command).toContain("1");
    expect(command.join(" ")).toContain("loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.25,afade=t=in");
  });

  it("estimates output sizes and creates safe names", () => {
    expect(estimateAudioBytes(settings, metadata)).toBeGreaterThan(1_000_000);
    expect(estimateAudioBytes({ ...settings, format: "wav", mono: false }, metadata)).toBeGreaterThan(10_000_000);
    expect(audioOutputName("My private memo.WAV", "m4a")).toBe("My-private-memo-processed.m4a");
    expect(formatAudioDuration(3661)).toBe("1:01:01");
  });
});
