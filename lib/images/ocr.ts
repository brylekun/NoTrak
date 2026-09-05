export const MAX_OCR_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_OCR_IMAGE_PIXELS = 40_000_000;

export type OcrDimensions = { width: number; height: number };
export type OcrCrop = { x: number; y: number; width: number; height: number };
export type OcrRotation = 0 | 90 | 180 | 270;

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateOcrImage(file: Pick<File, "name" | "size" | "type">) {
  if (file.size === 0) throw new Error("Choose a non-empty image.");
  if (file.size > MAX_OCR_IMAGE_BYTES) throw new Error("Choose an image no larger than 15 MB.");
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
}

export function validateOcrDimensions(dimensions: OcrDimensions) {
  const { width, height } = dimensions;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("The image dimensions could not be read.");
  }
  if (width * height > MAX_OCR_IMAGE_PIXELS) {
    throw new Error("Choose an image with no more than 40 megapixels.");
  }
}

export function normalizeOcrCrop(crop: OcrCrop, source: OcrDimensions): OcrCrop {
  const normalized = {
    x: Math.round(crop.x),
    y: Math.round(crop.y),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  };
  if (Object.values(normalized).some((value) => !Number.isFinite(value))) {
    throw new Error("Enter valid crop dimensions.");
  }
  if (normalized.x < 0 || normalized.y < 0 || normalized.width < 1 || normalized.height < 1) {
    throw new Error("Crop coordinates must be zero or greater, with a width and height of at least 1 pixel.");
  }
  if (normalized.x + normalized.width > source.width || normalized.y + normalized.height > source.height) {
    throw new Error("The crop area must stay inside the image.");
  }
  return normalized;
}

export function rotateOcrLeft(rotation: OcrRotation): OcrRotation {
  return ((rotation + 270) % 360) as OcrRotation;
}

export function rotateOcrRight(rotation: OcrRotation): OcrRotation {
  return ((rotation + 90) % 360) as OcrRotation;
}

export function ocrTextName(imageName: string) {
  const base = imageName.replace(/\.[^.]+$/u, "") || "image";
  return `${base}-text.txt`;
}

export function ocrStatusLabel(status: string) {
  const labels: Record<string, string> = {
    "loading tesseract core": "Loading the local OCR engine",
    "initializing tesseract": "Starting the local OCR engine",
    "loading language traineddata": "Loading the bundled English model",
    "initializing api": "Preparing text recognition",
    "recognizing text": "Reading text from the image",
  };
  return labels[status] ?? "Preparing local recognition";
}
