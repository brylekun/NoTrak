import { unzipSync, zipSync, type Zippable } from "fflate";

export const MAX_ZIP_FILES = 500;
export const MAX_ZIP_INPUT_BYTES = 200 * 1024 * 1024;
export const MAX_ZIP_ENTRY_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_EXTRACTED_BYTES = 250 * 1024 * 1024;

export type ZipSource = { name: string; size: number };
export type ZipInput = ZipSource & { bytes: Uint8Array };
export type ZipEntry = {
  path: string;
  size: number;
  compressedSize: number;
};
export type ExtractedZipEntry = ZipEntry & {
  downloadName: string;
  bytes: Uint8Array;
};

const FIXED_ZIP_DATE = new Date("1980-01-01T00:00:00.000Z");
const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL_FILE = 0x02014b50;

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function numberedName(name: string, number: number) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}-${number}${name.slice(dot)}` : `${name}-${number}`;
}

export function safeZipPath(value: string) {
  const segments = value
    .replaceAll("\\", "/")
    .replace(/^[a-z]:/iu, "")
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[\u0000-\u001f<>:"|?*]/gu, "-").trim())
    .filter(Boolean);
  return segments.join("/") || "unnamed";
}

export function uniqueZipPaths(names: string[]) {
  const used = new Set<string>();
  return names.map((name) => {
    const safe = safeZipPath(name);
    let candidate = safe;
    let number = 2;
    while (used.has(candidate.toLocaleLowerCase("en-US"))) {
      candidate = numberedName(safe, number);
      number += 1;
    }
    used.add(candidate.toLocaleLowerCase("en-US"));
    return candidate;
  });
}

export function zipDownloadName(value: string) {
  const safe = safeZipPath(value).split("/").at(-1) || "archive";
  const base = safe.replace(/\.zip$/iu, "").replace(/[^\p{L}\p{N}._ -]+/gu, "-").trim() || "archive";
  return `${base}.zip`;
}

export function validateZipSources(files: ZipSource[]) {
  if (files.length === 0) throw new Error("Choose at least one file to create a ZIP archive.");
  if (files.length > MAX_ZIP_FILES) throw new Error(`Choose no more than ${MAX_ZIP_FILES} files at once.`);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (files.some((file) => file.size > MAX_ZIP_ENTRY_BYTES)) {
    throw new Error("Each file must be 100 MB or smaller.");
  }
  if (total > MAX_ZIP_INPUT_BYTES) throw new Error("The selected files must total 200 MB or less.");
  return { total, count: files.length };
}

export function createZipArchive(files: ZipInput[], level: 0 | 6 | 9 = 6) {
  validateZipSources(files);
  const paths = uniqueZipPaths(files.map((file) => file.name));
  const input: Zippable = {};
  files.forEach((file, index) => {
    input[paths[index]] = [file.bytes, { level, mtime: FIXED_ZIP_DATE }];
  });
  return zipSync(input, { level });
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView) {
  const firstPossible = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= firstPossible; offset -= 1) {
    if (readU32(view, offset) === ZIP_EOCD) return offset;
  }
  throw new Error("This does not appear to be a complete ZIP archive.");
}

export function inspectZipArchive(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_ZIP_INPUT_BYTES) throw new Error("ZIP archives must be 200 MB or smaller.");
  if (bytes.byteLength < 22) throw new Error("This does not appear to be a complete ZIP archive.");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(bytes, view);
  const disk = readU16(view, end + 4);
  const centralDisk = readU16(view, end + 6);
  const diskEntries = readU16(view, end + 8);
  const entryCount = readU16(view, end + 10);
  const centralSize = readU32(view, end + 12);
  let offset = readU32(view, end + 16);

  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount) {
    throw new Error("Multi-part ZIP archives are not supported.");
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || offset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported in this browser tool.");
  }
  if (entryCount > MAX_ZIP_FILES) throw new Error(`This archive contains more than ${MAX_ZIP_FILES} entries.`);
  if (offset + centralSize > end || offset < 0) throw new Error("The ZIP directory is invalid or incomplete.");

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  const seenPaths = new Set<string>();
  let extractedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || readU32(view, offset) !== ZIP_CENTRAL_FILE) {
      throw new Error("The ZIP directory is invalid or incomplete.");
    }
    const flags = readU16(view, offset + 8);
    const method = readU16(view, offset + 10);
    const compressedSize = readU32(view, offset + 20);
    const size = readU32(view, offset + 24);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw new Error("The ZIP directory is invalid or incomplete.");
    if ((flags & 1) !== 0) throw new Error("Password-protected ZIP archives are not supported.");
    if (method !== 0 && method !== 8) throw new Error(`ZIP compression method ${method} is not supported.`);
    if (compressedSize === 0xffffffff || size === 0xffffffff) {
      throw new Error("ZIP64 entries are not supported in this browser tool.");
    }

    const rawName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const isDirectory = rawName.endsWith("/") || rawName.endsWith("\\");
    if (!isDirectory) {
      const path = safeZipPath(rawName);
      const pathKey = path.toLocaleLowerCase("en-US");
      const pathSegments = pathKey.split("/");
      if (pathSegments.some((segment) => segment === "__proto__" || segment === "prototype" || segment === "constructor")) {
        throw new Error("The archive contains a reserved or unsafe filename.");
      }
      if (seenPaths.has(pathKey)) throw new Error("The archive contains conflicting filenames.");
      seenPaths.add(pathKey);
      if (size > MAX_ZIP_ENTRY_BYTES) throw new Error("An extracted file would exceed the 100 MB per-file limit.");
      extractedBytes += size;
      if (extractedBytes > MAX_ZIP_EXTRACTED_BYTES) {
        throw new Error("The archive would expand beyond the 250 MB safety limit.");
      }
      entries.push({ path, size, compressedSize });
    }
    offset = next;
  }

  if (entries.length === 0) throw new Error("This ZIP archive does not contain any files.");
  return { entries, extractedBytes };
}

export function extractZipArchive(bytes: Uint8Array) {
  const summary = inspectZipArchive(bytes);
  const unpacked = unzipSync(bytes);
  const records = Object.entries(unpacked).filter(([name]) => !name.endsWith("/") && !name.endsWith("\\"));
  if (records.length !== summary.entries.length) throw new Error("The extracted file list did not match the ZIP directory.");
  const safePaths = uniqueZipPaths(records.map(([name]) => name));
  const downloadNames = uniqueZipPaths(safePaths.map((path) => path.split("/").at(-1) || "unnamed"));
  const byPath = new Map(summary.entries.map((entry) => [entry.path, entry]));

  let actualExtractedBytes = 0;
  return records.map(([, data], index): ExtractedZipEntry => {
    const path = safePaths[index];
    const expected = byPath.get(path);
    if (data.byteLength > MAX_ZIP_ENTRY_BYTES) throw new Error("An extracted file exceeded the 100 MB per-file limit.");
    actualExtractedBytes += data.byteLength;
    if (actualExtractedBytes > MAX_ZIP_EXTRACTED_BYTES) {
      throw new Error("The extracted files exceeded the 250 MB safety limit.");
    }
    return {
      path,
      downloadName: downloadNames[index],
      size: data.byteLength,
      compressedSize: expected?.compressedSize ?? 0,
      bytes: data,
    };
  });
}
