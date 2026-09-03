export type MetadataContainer =
  | "exif"
  | "xmp"
  | "iptc"
  | "icc"
  | "comment"
  | "png-text"
  | "png-exif"
  | "webp-exif"
  | "webp-xmp";

export type MetadataFinding = {
  container: MetadataContainer;
  label: string;
};

const LABELS: Record<MetadataContainer, string> = {
  exif: "EXIF (camera, timestamp, and possible GPS)",
  xmp: "XMP (editing and rights metadata)",
  iptc: "IPTC / Photoshop resources",
  icc: "ICC color profile",
  comment: "Embedded comment",
  "png-text": "PNG text chunk",
  "png-exif": "PNG EXIF chunk",
  "webp-exif": "WebP EXIF chunk",
  "webp-xmp": "WebP XMP chunk",
};

function found(container: MetadataContainer): MetadataFinding {
  return { container, label: LABELS[container] };
}

function ascii(view: Uint8Array, offset: number, length: number) {
  let output = "";
  for (let index = 0; index < length; index += 1) output += String.fromCharCode(view[offset + index]);
  return output;
}

function startsWith(view: Uint8Array, offset: number, text: string) {
  if (offset + text.length > view.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (view[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * Walks JPEG markers rather than scanning raw bytes, so compressed scan data
 * cannot produce a false positive.
 */
function readJpegMetadata(view: Uint8Array): MetadataFinding[] {
  const findings = new Set<MetadataContainer>();
  let offset = 2;

  while (offset + 4 <= view.length) {
    if (view[offset] !== 0xff) break;
    const marker = view[offset + 1];

    // Start of scan: everything after this is entropy-coded image data.
    if (marker === 0xda || marker === 0xd9) break;
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }

    const length = (view[offset + 2] << 8) | view[offset + 3];
    if (length < 2) break;
    const payload = offset + 4;

    if (marker === 0xe1) {
      if (startsWith(view, payload, "Exif\0\0")) findings.add("exif");
      if (startsWith(view, payload, "http://ns.adobe.com/xap/1.0/")) findings.add("xmp");
    } else if (marker === 0xe2 && startsWith(view, payload, "ICC_PROFILE\0")) {
      findings.add("icc");
    } else if (marker === 0xed && startsWith(view, payload, "Photoshop 3.0\0")) {
      findings.add("iptc");
    } else if (marker === 0xfe) {
      findings.add("comment");
    }

    offset = payload + length - 2;
  }

  return [...findings].map(found);
}

const PNG_METADATA_CHUNKS = new Map<string, MetadataContainer>([
  ["tEXt", "png-text"],
  ["iTXt", "png-text"],
  ["zTXt", "png-text"],
  ["eXIf", "png-exif"],
  ["iCCP", "icc"],
]);

function readPngMetadata(view: Uint8Array): MetadataFinding[] {
  const findings = new Set<MetadataContainer>();
  let offset = 8;

  while (offset + 12 <= view.length) {
    const length =
      (view[offset] << 24) | (view[offset + 1] << 16) | (view[offset + 2] << 8) | view[offset + 3];
    if (length < 0) break;
    const type = ascii(view, offset + 4, 4);
    if (type === "IEND") break;

    const container = PNG_METADATA_CHUNKS.get(type);
    if (container) findings.add(container);
    // An XMP packet travels inside an iTXt chunk keyed "XML:com.adobe.xmp".
    if (type === "iTXt" && startsWith(view, offset + 8, "XML:com.adobe.xmp")) findings.add("xmp");

    offset += 12 + length;
  }

  return [...findings].map(found);
}

const WEBP_METADATA_CHUNKS = new Map<string, MetadataContainer>([
  ["EXIF", "webp-exif"],
  ["XMP ", "webp-xmp"],
  ["ICCP", "icc"],
]);

function readWebpMetadata(view: Uint8Array): MetadataFinding[] {
  const findings = new Set<MetadataContainer>();
  let offset = 12;

  while (offset + 8 <= view.length) {
    const type = ascii(view, offset, 4);
    const length =
      view[offset + 4] | (view[offset + 5] << 8) | (view[offset + 6] << 16) | (view[offset + 7] << 24);
    if (length < 0) break;

    const container = WEBP_METADATA_CHUNKS.get(type);
    if (container) findings.add(container);

    // RIFF chunks are padded to an even length.
    offset += 8 + length + (length % 2);
  }

  return [...findings].map(found);
}

function isJpeg(view: Uint8Array) {
  return view.length > 3 && view[0] === 0xff && view[1] === 0xd8;
}

function isPng(view: Uint8Array) {
  return view.length > 8 && startsWith(view, 0, "\x89PNG\r\n\x1a\n");
}

function isWebp(view: Uint8Array) {
  return view.length > 12 && startsWith(view, 0, "RIFF") && startsWith(view, 8, "WEBP");
}

/**
 * Lists the metadata containers present in an image. Covers the JPEG APP
 * segments, PNG ancillary chunks, and WebP RIFF chunks that carry metadata --
 * an earlier check looked only for the JPEG EXIF marker and so reported "no
 * metadata" for a PNG or WebP that did carry some.
 */
export function detectImageMetadata(bytes: ArrayBuffer): MetadataFinding[] {
  const view = new Uint8Array(bytes);
  if (isJpeg(view)) return readJpegMetadata(view);
  if (isPng(view)) return readPngMetadata(view);
  if (isWebp(view)) return readWebpMetadata(view);
  return [];
}

export function hasImageMetadata(bytes: ArrayBuffer) {
  return detectImageMetadata(bytes).length > 0;
}
