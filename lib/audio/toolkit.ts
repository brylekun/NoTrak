export const MAX_AUDIO_BYTES = 75 * 1024 * 1024;
export const MAX_AUDIO_DURATION = 30 * 60;
export const AUDIO_ENGINE_BASE = "/video-engine/0.12.10";

export type AudioFormat = "mp3" | "m4a" | "wav";
export type AudioBitrate = 128 | 192 | 256;
export type AudioMetadata = { duration: number };
export type AudioSettings = {
  start: number;
  end: number;
  format: AudioFormat;
  bitrate: AudioBitrate;
  volume: number;
  normalize: boolean;
  mono: boolean;
  fadeIn: number;
  fadeOut: number;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

const INPUT_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "oga", "webm"]);

export function formatAudioDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function audioInputExtension(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/u)?.[1];
  if (extension && INPUT_EXTENSIONS.has(extension)) return extension === "oga" ? "ogg" : extension;
  return MIME_EXTENSIONS[file.type];
}

export function validateAudioFile(file: Pick<File, "name" | "type" | "size">) {
  if (!audioInputExtension(file)) throw new Error("Choose a browser-readable MP3, M4A, AAC, WAV, OGG, or WebM audio file.");
  if (file.size <= 0) throw new Error("The selected audio file is empty.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Choose an audio file no larger than 75 MB.");
}

export function validateAudioMetadata(metadata: AudioMetadata) {
  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) throw new Error("The browser could not read this audio file's duration.");
  if (metadata.duration > MAX_AUDIO_DURATION) throw new Error("Choose audio no longer than 30 minutes.");
}

export function validateAudioSettings(settings: AudioSettings, metadata: AudioMetadata) {
  const duration = settings.end - settings.start;
  if (!Number.isFinite(settings.start) || !Number.isFinite(settings.end) || settings.start < 0 || settings.end > metadata.duration + 0.05 || duration < 0.25) {
    throw new Error("Choose a trim range of at least 0.25 seconds inside the audio file.");
  }
  if (!Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 200) throw new Error("Choose a volume between 0% and 200%.");
  for (const fade of [settings.fadeIn, settings.fadeOut]) {
    if (!Number.isFinite(fade) || fade < 0 || fade > 10) throw new Error("Choose fades between 0 and 10 seconds.");
  }
  if (settings.fadeIn + settings.fadeOut > duration) throw new Error("The combined fades must fit inside the trimmed duration.");
  return { duration };
}

export function buildAudioCommand(input: string, output: string, settings: AudioSettings, metadata: AudioMetadata) {
  const { duration } = validateAudioSettings(settings, metadata);
  const filters: string[] = [];
  if (settings.normalize) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  if (settings.volume !== 100) filters.push(`volume=${(settings.volume / 100).toFixed(2)}`);
  if (settings.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${settings.fadeIn.toFixed(2)}`);
  if (settings.fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, duration - settings.fadeOut).toFixed(2)}:d=${settings.fadeOut.toFixed(2)}`);

  const args = [
    "-ss", settings.start.toFixed(3), "-i", input, "-t", duration.toFixed(3),
    "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1", "-vn", "-sn", "-dn",
  ];
  if (filters.length > 0) args.push("-af", filters.join(","));
  if (settings.mono) args.push("-ac", "1");
  if (settings.format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", `${settings.bitrate}k`);
  else if (settings.format === "m4a") args.push("-c:a", "aac", "-b:a", `${settings.bitrate}k`, "-movflags", "+faststart");
  else args.push("-c:a", "pcm_s16le");
  args.push(output);
  return args;
}

export function estimateAudioBytes(settings: AudioSettings, metadata: AudioMetadata) {
  const { duration } = validateAudioSettings(settings, metadata);
  if (settings.format === "wav") return Math.round(duration * 44_100 * 2 * (settings.mono ? 1 : 2) + 44);
  return Math.round(duration * settings.bitrate * 1000 / 8 * 1.03);
}

export function audioOutputName(input: string, format: AudioFormat) {
  const base = input.replace(/\.[^.]+$/u, "").replace(/[^a-z0-9._-]+/giu, "-").replace(/^[.-]+|[.-]+$/gu, "").slice(0, 80) || "audio";
  return `${base}-processed.${format}`;
}
