export const MAX_JSON_CHARACTERS = 2_000_000;

export type JsonFormatResult = {
  output: string;
  /** Top-level shape, useful as a sanity check before copying. */
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  entryCount: number;
  byteSize: number;
};

export type JsonError = {
  message: string;
  line?: number;
  column?: number;
};

export class JsonParseError extends Error {
  override name = "JsonParseError";
  readonly line?: number;
  readonly column?: number;

  constructor({ message, line, column }: JsonError) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

function describe(value: unknown): JsonFormatResult["kind"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "object") return "object";
  if (type === "number" || type === "string" || type === "boolean") return type;
  return "null";
}

function countEntries(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return 0;
}

/**
 * Turns the engine's parse error into a line and column.
 *
 * V8 uses two message shapes: one ends with "at position N (line L column C)",
 * the other reports an unexpected token and quotes a slice of the input instead
 * of giving a position. The quoted slice is never reused, both because it is
 * noise and because it would echo whatever the visitor pasted back at them.
 */
function locate(text: string, reason: unknown): JsonError {
  const raw = reason instanceof Error ? reason.message : "";

  const explicit = /line (\d+) column (\d+)/u.exec(raw);
  if (explicit) {
    const line = Number(explicit[1]);
    const column = Number(explicit[2]);
    return { message: `Invalid JSON at line ${line}, column ${column}.`, line, column };
  }

  const position = /position (\d+)/u.exec(raw);
  if (position) {
    const index = Math.min(Number(position[1]), text.length);
    const before = text.slice(0, index);
    const line = before.split("\n").length;
    const column = index - before.lastIndexOf("\n");
    return { message: `Invalid JSON at line ${line}, column ${column}.`, line, column };
  }

  const token = /Unexpected token '?(.)'?/u.exec(raw);
  if (token) {
    return { message: `Invalid JSON: unexpected ${JSON.stringify(token[1])}.` };
  }

  return { message: "This is not valid JSON." };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortKeysDeep(entry)]),
  );
}

export type JsonFormatOptions = {
  /** Spaces per level, or 0 for a single minified line. */
  indent?: number;
  sortKeys?: boolean;
};

export function formatJson(input: string, options: JsonFormatOptions = {}): JsonFormatResult {
  const text = input.trim();
  if (!text) throw new JsonParseError({ message: "Paste some JSON to format." });
  if (text.length > MAX_JSON_CHARACTERS) {
    throw new JsonParseError({ message: "This document is too large for the formatter." });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (reason) {
    throw new JsonParseError(locate(text, reason));
  }

  const value = options.sortKeys ? sortKeysDeep(parsed) : parsed;
  const indent = options.indent ?? 2;
  const output = JSON.stringify(value, null, indent > 0 ? indent : undefined) ?? "";

  return {
    output,
    kind: describe(parsed),
    entryCount: countEntries(parsed),
    byteSize: new TextEncoder().encode(output).byteLength,
  };
}
