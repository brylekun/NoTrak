export const MAX_VIDEO_BYTES = 75 * 1024 * 1024;
export const MAX_VIDEO_DURATION = 180;
export const MAX_VIDEO_PIXELS = 3840 * 2160;
export const VIDEO_ENGINE_BASE = "/video-engine/0.12.10";

export type VideoAspect = "original" | "16:9" | "1:1" | "4:5" | "9:16";
export type VideoResolution = 720 | 1080;
export type VideoQuality = "high" | "balanced" | "small";
export type VideoMetadata = { duration: number; width: number; height: number };
export type VideoSettings = {
  start: number;
  end: number;
  aspect: VideoAspect;
  resolution: VideoResolution;
  quality: VideoQuality;
  muted: boolean;
  volume: number;
};

const QUALITY_CRF: Record<VideoQuality, number> = { high: 19, balanced: 23, small: 28 };
const MIME_EXTENSIONS: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function videoInputExtension(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (extension === "mp4" || extension === "webm") return extension;
  return MIME_EXTENSIONS[file.type];
}

export function validateVideoFile(file: Pick<File, "name" | "type" | "size">) {
  if (!videoInputExtension(file)) throw new Error("Choose a browser-readable MP4 or WebM video.");
  if (file.size <= 0) throw new Error("The selected video is empty.");
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Choose a video no larger than 75 MB.");
}

export function validateVideoMetadata(metadata: VideoMetadata) {
  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) throw new Error("The browser could not read this video's duration.");
  if (metadata.duration > MAX_VIDEO_DURATION) throw new Error("Choose a video no longer than 3 minutes.");
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width < 2 || metadata.height < 2) throw new Error("The browser could not read this video's dimensions.");
  if (metadata.width * metadata.height > MAX_VIDEO_PIXELS || metadata.width > 4096 || metadata.height > 4096) throw new Error("Choose a video no larger than 4K (8.3 megapixels).");
}

function even(value: number) { return Math.max(2, Math.floor(value / 2) * 2); }

export function targetVideoDimensions(source: Pick<VideoMetadata, "width" | "height">, aspect: VideoAspect, resolution: VideoResolution) {
  if (aspect === "16:9") return resolution === 1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
  if (aspect === "1:1") return { width: resolution, height: resolution };
  if (aspect === "4:5") return { width: resolution, height: resolution === 1080 ? 1350 : 900 };
  if (aspect === "9:16") return resolution === 1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  const maximum = source.width >= source.height ? { width: resolution === 1080 ? 1920 : 1280, height: resolution } : { width: resolution, height: resolution === 1080 ? 1920 : 1280 };
  const scale = Math.min(1, maximum.width / source.width, maximum.height / source.height);
  return { width: even(source.width * scale), height: even(source.height * scale) };
}

export function validateVideoSettings(settings: VideoSettings, metadata: VideoMetadata) {
  const { start, end, volume } = settings;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > metadata.duration + 0.05 || end - start < 0.5) throw new Error("Choose a trim range of at least 0.5 seconds inside the video.");
  if (!Number.isFinite(volume) || volume < 0 || volume > 150) throw new Error("Choose an audio volume between 0% and 150%.");
  return { duration: end - start, dimensions: targetVideoDimensions(metadata, settings.aspect, settings.resolution) };
}

export function buildVideoCommand(input: string, output: string, settings: VideoSettings, metadata: VideoMetadata) {
  const { duration, dimensions } = validateVideoSettings(settings, metadata);
  const crop = settings.aspect === "original"
    ? `scale=${dimensions.width}:${dimensions.height}:flags=lanczos,setsar=1`
    : `scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${dimensions.width}:${dimensions.height},setsar=1`;
  const args = [
    "-ss", settings.start.toFixed(3), "-i", input, "-t", duration.toFixed(3),
    "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-map_chapters", "-1", "-sn", "-dn",
    "-vf", crop, "-c:v", "libx264", "-preset", "veryfast", "-crf", String(QUALITY_CRF[settings.quality]),
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ];
  if (settings.muted || settings.volume === 0) args.push("-an");
  else {
    if (settings.volume !== 100) args.push("-af", `volume=${(settings.volume / 100).toFixed(2)}`);
    args.push("-c:a", "aac", "-b:a", "128k");
  }
  args.push(output);
  return args;
}

export function estimateVideoBytes(fileBytes: number, metadata: VideoMetadata, settings: VideoSettings) {
  const { duration, dimensions } = validateVideoSettings(settings, metadata);
  const timeRatio = duration / metadata.duration;
  const pixelRatio = Math.min(1.5, (dimensions.width * dimensions.height) / (metadata.width * metadata.height));
  const qualityFactor = { high: 1.05, balanced: 0.72, small: 0.42 }[settings.quality];
  const audioFactor = settings.muted ? 0.92 : 1;
  return Math.max(50_000, Math.round(fileBytes * timeRatio * Math.pow(pixelRatio, 0.65) * qualityFactor * audioFactor));
}

export function videoOutputName(input: string, suffix: "processed" | "thumbnail", extension: "mp4" | "jpg") {
  const base = input.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 80) || "video";
  return `${base}-${suffix}.${extension}`;
}
