export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type ImageProcessOptions = {
  outputType: SupportedImageType;
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
};

export type ProcessedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export function validateImageFile(file: Pick<File, "size" | "type">) {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size === 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Choose an image no larger than 25 MB.");
}

export function fitDimensions(width: number, height: number, maxWidth = width, maxHeight = height) {
  if (width < 1 || height < 1 || maxWidth < 1 || maxHeight < 1) {
    throw new Error("Image dimensions must be positive.");
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function outputImageName(originalName: string, suffix: string, type: SupportedImageType) {
  const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1];
  const base = originalName.replace(/\.[^./\\]+$/u, "") || "image";
  return `${base}-${suffix}.${extension}`;
}

export function containsExifSegment(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  for (let index = 0; index <= view.length - 6; index += 1) {
    if (
      view[index] === 0x45 && view[index + 1] === 0x78 && view[index + 2] === 0x69 &&
      view[index + 3] === 0x66 && view[index + 4] === 0x00 && view[index + 5] === 0x00
    ) return true;
  }
  return false;
}

export async function processImage(file: File, options: ImageProcessOptions): Promise<ProcessedImage> {
  validateImageFile(file);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const dimensions = fitDimensions(
      bitmap.width,
      bitmap.height,
      options.maxWidth ?? bitmap.width,
      options.maxHeight ?? bitmap.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d", { alpha: options.outputType !== "image/jpeg" });
    if (!context) throw new Error("This browser could not prepare an image canvas.");

    if (options.outputType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("This browser could not export the image.")),
        options.outputType,
        Math.min(1, Math.max(0.1, options.quality)),
      );
    });

    return { blob, ...dimensions };
  } finally {
    bitmap.close();
  }
}
