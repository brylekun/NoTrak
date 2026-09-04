export const MAX_RESIZE_DIMENSION = 12_000;
export const MAX_RESIZE_PIXELS = 40_000_000;

export type ImageDimensions = {
  width: number;
  height: number;
};

export function linkedResizeDimensions(
  source: ImageDimensions,
  changedAxis: "width" | "height",
  changedValue: number,
): ImageDimensions {
  if (
    !Number.isFinite(source.width)
    || !Number.isFinite(source.height)
    || source.width < 1
    || source.height < 1
    || !Number.isFinite(changedValue)
    || changedValue < 1
  ) {
    throw new Error("Image dimensions must be positive numbers.");
  }

  if (changedAxis === "width") {
    return {
      width: Math.round(changedValue),
      height: Math.max(1, Math.round(changedValue * (source.height / source.width))),
    };
  }

  return {
    width: Math.max(1, Math.round(changedValue * (source.width / source.height))),
    height: Math.round(changedValue),
  };
}

export function scaledResizeDimensions(source: ImageDimensions, percentage: number): ImageDimensions {
  if (!Number.isFinite(percentage) || percentage <= 0) {
    throw new Error("Scale percentage must be positive.");
  }
  return linkedResizeDimensions(source, "width", source.width * (percentage / 100));
}

export function validateResizeDimensions(width: number, height: number): ImageDimensions {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Width and height must be positive whole numbers.");
  }
  if (width > MAX_RESIZE_DIMENSION || height > MAX_RESIZE_DIMENSION) {
    throw new Error(`Width and height must not exceed ${MAX_RESIZE_DIMENSION.toLocaleString()} pixels.`);
  }
  if (width * height > MAX_RESIZE_PIXELS) {
    throw new Error("The resized image must not exceed 40 megapixels.");
  }
  return { width, height };
}
