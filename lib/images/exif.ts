export type ExifGroupId = "location" | "capture" | "device" | "software" | "other";

export type ExifField = {
  label: string;
  value: string;
};

export type ExifGroup = {
  id: ExifGroupId;
  title: string;
  /** Location is called out because it can identify where a photo was taken. */
  sensitive: boolean;
  fields: ExifField[];
};

export type ExifReport = {
  groups: ExifGroup[];
  fieldCount: number;
  hasLocation: boolean;
};

type RawExif = Record<string, unknown>;

const GROUP_TITLES: Record<ExifGroupId, string> = {
  location: "Location",
  capture: "Capture settings",
  device: "Device",
  software: "Software and editing",
  other: "Other metadata",
};

// Tags worth showing, in display order, with the group each belongs to.
const KNOWN_TAGS: Array<{ tag: string; label: string; group: ExifGroupId }> = [
  { tag: "Make", label: "Camera make", group: "device" },
  { tag: "Model", label: "Camera model", group: "device" },
  { tag: "LensModel", label: "Lens", group: "device" },
  { tag: "BodySerialNumber", label: "Camera serial number", group: "device" },
  { tag: "LensSerialNumber", label: "Lens serial number", group: "device" },
  { tag: "OwnerName", label: "Owner name", group: "device" },

  { tag: "DateTimeOriginal", label: "Taken", group: "capture" },
  { tag: "CreateDate", label: "Created", group: "capture" },
  { tag: "ModifyDate", label: "Modified", group: "capture" },
  { tag: "OffsetTimeOriginal", label: "Time zone", group: "capture" },
  { tag: "ExposureTime", label: "Exposure", group: "capture" },
  { tag: "FNumber", label: "Aperture", group: "capture" },
  { tag: "ISO", label: "ISO", group: "capture" },
  { tag: "FocalLength", label: "Focal length", group: "capture" },
  { tag: "Flash", label: "Flash", group: "capture" },
  { tag: "Orientation", label: "Orientation", group: "capture" },
  { tag: "ExifImageWidth", label: "Stored width", group: "capture" },
  { tag: "ExifImageHeight", label: "Stored height", group: "capture" },

  { tag: "Software", label: "Software", group: "software" },
  { tag: "HostComputer", label: "Host computer", group: "software" },
  { tag: "Artist", label: "Artist", group: "software" },
  { tag: "Copyright", label: "Copyright", group: "software" },
  { tag: "ImageDescription", label: "Description", group: "software" },
  { tag: "UserComment", label: "User comment", group: "software" },
];

const LOCATION_TAGS = new Set([
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "GPSDateStamp",
  "GPSTimeStamp",
  "GPSImgDirection",
  "GPSSpeed",
  "GPSDestLatitude",
  "GPSDestLongitude",
  "GPSAreaInformation",
  "GPSProcessingMethod",
]);

/** Very large or binary-ish values are unhelpful and can be huge. */
const MAX_VALUE_LENGTH = 160;

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.replace(/\0+$/u, "").trim();
    return trimmed ? trimmed.slice(0, MAX_VALUE_LENGTH) : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    const parts = value.map(formatValue).filter((part): part is string => part !== null);
    return parts.length ? parts.join(", ").slice(0, MAX_VALUE_LENGTH) : null;
  }
  // Anything else (typed arrays, nested objects) is not useful to display.
  return null;
}

function coordinate(value: unknown, positive: string, negative: string) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (numeric === null) return null;
  return `${Math.abs(numeric).toFixed(6)}° ${numeric >= 0 ? positive : negative}`;
}

/**
 * Turns a raw exifr result into display groups. Location is separated and
 * flagged so the UI can warn about it before anything else.
 */
export function buildExifReport(raw: RawExif | null | undefined): ExifReport {
  if (!raw) return { groups: [], fieldCount: 0, hasLocation: false };

  const grouped = new Map<ExifGroupId, ExifField[]>();
  const add = (group: ExifGroupId, label: string, value: string) => {
    const fields = grouped.get(group) ?? [];
    fields.push({ label, value });
    grouped.set(group, fields);
  };

  const latitude = coordinate(raw.latitude, "N", "S");
  const longitude = coordinate(raw.longitude, "E", "W");
  if (latitude) add("location", "Latitude", latitude);
  if (longitude) add("location", "Longitude", longitude);

  for (const tag of ["GPSAltitude", "GPSDateStamp", "GPSTimeStamp", "GPSImgDirection", "GPSSpeed"]) {
    const value = formatValue(raw[tag]);
    if (value) add("location", tag.replace(/^GPS/u, "GPS "), value);
  }

  for (const { tag, label, group } of KNOWN_TAGS) {
    const value = formatValue(raw[tag]);
    if (value) add(group, label, value);
  }

  const known = new Set(KNOWN_TAGS.map((entry) => entry.tag));
  for (const [tag, value] of Object.entries(raw)) {
    if (known.has(tag) || LOCATION_TAGS.has(tag)) continue;
    const formatted = formatValue(value);
    if (formatted) add("other", tag, formatted);
  }

  const order: ExifGroupId[] = ["location", "device", "capture", "software", "other"];
  const groups = order
    .filter((id) => (grouped.get(id)?.length ?? 0) > 0)
    .map((id) => ({
      id,
      title: GROUP_TITLES[id],
      sensitive: id === "location",
      fields: grouped.get(id) ?? [],
    }));

  return {
    groups,
    fieldCount: groups.reduce((total, group) => total + group.fields.length, 0),
    hasLocation: (grouped.get("location")?.length ?? 0) > 0,
  };
}

/**
 * Reads an image with human-readable tag names before building the report.
 * Keeping this boundary here makes the parser configuration testable and keeps
 * the relatively large exifr dependency out of the initial page bundle.
 */
export async function parseExifReport(bytes: ArrayBuffer): Promise<ExifReport> {
  const exifr = (await import("exifr")).default;
  const raw = await exifr
    .parse(bytes, {
      translateKeys: true,
      translateValues: true,
      mergeOutput: true,
      gps: true,
      userComment: true,
    })
    .catch(() => null);

  return buildExifReport(raw as RawExif | null);
}
