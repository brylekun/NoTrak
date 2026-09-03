import { describe, expect, it } from "vitest";

import { buildExifReport, parseExifReport } from "../../lib/images/exif";

/** Cameras pad fixed-width string tags with NUL bytes. */
const NUL = "\u0000";

function minimalExifJpeg() {
  // Big-endian TIFF with one ASCII Make tag whose value is "Acme".
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x0f, 0x00, 0x02, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x1a,
    0x00, 0x00, 0x00, 0x00,
    ...new TextEncoder().encode(`Acme${NUL}`),
  ];
  const payload = [...new TextEncoder().encode(`Exif${NUL}${NUL}`), ...tiff];
  const segmentLength = payload.length + 2;
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff,
    ...payload,
    0xff, 0xd9,
  ]).buffer;
}

describe("buildExifReport", () => {
  it("parses real EXIF tag IDs into the human-readable names used by the report", async () => {
    const report = await parseExifReport(minimalExifJpeg());

    expect(report.groups.find((group) => group.id === "device")?.fields).toContainEqual({
      label: "Camera make",
      value: "Acme",
    });
  });

  it("returns an empty report when there is no metadata", () => {
    for (const input of [null, undefined, {}]) {
      const report = buildExifReport(input);
      expect(report.groups).toEqual([]);
      expect(report.fieldCount).toBe(0);
      expect(report.hasLocation).toBe(false);
    }
  });

  it("formats coordinates with a hemisphere instead of a signed number", () => {
    const report = buildExifReport({ latitude: 14.5995, longitude: 120.9842 });

    expect(report.hasLocation).toBe(true);
    const location = report.groups.find((group) => group.id === "location");
    expect(location?.fields).toEqual([
      { label: "Latitude", value: "14.599500° N" },
      { label: "Longitude", value: "120.984200° E" },
    ]);
  });

  it("uses the southern and western hemispheres for negative coordinates", () => {
    const report = buildExifReport({ latitude: -33.8688, longitude: -70.6693 });
    const values = report.groups.find((group) => group.id === "location")?.fields.map((field) => field.value);

    expect(values).toEqual(["33.868800° S", "70.669300° W"]);
  });

  it("flags location as sensitive and puts it first", () => {
    const report = buildExifReport({ latitude: 1, longitude: 2, Make: "Acme", ISO: 200 });

    expect(report.groups[0].id).toBe("location");
    expect(report.groups[0].sensitive).toBe(true);
    expect(report.groups.filter((group) => group.sensitive).map((group) => group.id)).toEqual(["location"]);
  });

  it("groups device, capture, and software tags separately", () => {
    const report = buildExifReport({
      Make: "Acme",
      Model: "X100",
      BodySerialNumber: "SN-42",
      ISO: 400,
      FNumber: 2.8,
      Software: "Photo Editor 3",
    });

    const byId = new Map(report.groups.map((group) => [group.id, group.fields]));
    expect(byId.get("device")?.map((field) => field.label)).toEqual([
      "Camera make",
      "Camera model",
      "Camera serial number",
    ]);
    expect(byId.get("capture")?.map((field) => field.label)).toEqual(["Aperture", "ISO"]);
    expect(byId.get("software")?.map((field) => field.label)).toEqual(["Software"]);
    expect(report.hasLocation).toBe(false);
  });

  it("renders a date as an ISO timestamp and skips an invalid one", () => {
    const valid = buildExifReport({ DateTimeOriginal: new Date("2026-01-02T03:04:05Z") });
    expect(valid.groups[0].fields[0].value).toBe("2026-01-02T03:04:05.000Z");

    expect(buildExifReport({ DateTimeOriginal: new Date("nonsense") }).fieldCount).toBe(0);
  });

  it("drops empty, null, and non-finite values rather than showing blanks", () => {
    const report = buildExifReport({
      Make: "   ",
      Model: null,
      ISO: Number.NaN,
      FocalLength: Number.POSITIVE_INFINITY,
      Software: "  ",
    });

    expect(report.fieldCount).toBe(0);
  });

  it("trims trailing NUL padding that cameras write into strings", () => {
    const report = buildExifReport({ Make: `Acme${NUL}${NUL}` });

    expect(report.groups[0].fields[0].value).toBe("Acme");
  });

  it("formats booleans and arrays readably and ignores binary blobs", () => {
    const report = buildExifReport({
      Flash: true,
      GPSTimeStamp: [10, 30, 0],
      latitude: 1,
      MakerNote: new Uint8Array([1, 2, 3]),
      Thumbnail: { width: 10 },
    });

    const fields = report.groups.flatMap((group) => group.fields);
    expect(fields.find((field) => field.label === "Flash")?.value).toBe("Yes");
    expect(fields.find((field) => field.label === "GPS TimeStamp")?.value).toBe("10, 30, 0");
    expect(fields.some((field) => field.label === "MakerNote")).toBe(false);
    expect(fields.some((field) => field.label === "Thumbnail")).toBe(false);
  });

  it("truncates an unreasonably long value", () => {
    const report = buildExifReport({ ImageDescription: "x".repeat(500) });

    expect(report.groups[0].fields[0].value.length).toBe(160);
  });

  it("keeps unrecognized tags in an other group without duplicating known ones", () => {
    const report = buildExifReport({ Make: "Acme", CustomVendorTag: "vendor-value" });

    const other = report.groups.find((group) => group.id === "other");
    expect(other?.fields).toEqual([{ label: "CustomVendorTag", value: "vendor-value" }]);
    expect(report.groups.flatMap((group) => group.fields).filter((field) => field.value === "Acme")).toHaveLength(1);
  });

  it("does not repeat GPS tags in the other group", () => {
    const report = buildExifReport({ latitude: 1, longitude: 2, GPSLatitudeRef: "N", GPSLongitude: [1, 2, 3] });
    const other = report.groups.find((group) => group.id === "other");

    expect(other?.fields.some((field) => field.label === "GPSLongitude")).toBe(false);
  });

  it("counts every displayed field", () => {
    const report = buildExifReport({ latitude: 1, longitude: 2, Make: "Acme", ISO: 100, Custom: "x" });

    expect(report.fieldCount).toBe(report.groups.flatMap((group) => group.fields).length);
    expect(report.fieldCount).toBe(5);
  });
});
