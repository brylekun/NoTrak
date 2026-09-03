import { describe, expect, it } from "vitest";

import { JsonParseError, MAX_JSON_CHARACTERS, formatJson } from "../../lib/developer/json";

describe("formatJson", () => {
  it("pretty-prints with a two-space indent by default", () => {
    expect(formatJson('{"a":1,"b":[2,3]}').output).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it("minifies when the indent is zero", () => {
    expect(formatJson('{\n  "a": 1\n}', { indent: 0 }).output).toBe('{"a":1}');
  });

  it("reports the top-level shape and entry count", () => {
    expect(formatJson('{"a":1,"b":2}')).toMatchObject({ kind: "object", entryCount: 2 });
    expect(formatJson("[1,2,3,4]")).toMatchObject({ kind: "array", entryCount: 4 });
    expect(formatJson('"just a string"')).toMatchObject({ kind: "string", entryCount: 0 });
    expect(formatJson("42")).toMatchObject({ kind: "number", entryCount: 0 });
    expect(formatJson("true")).toMatchObject({ kind: "boolean", entryCount: 0 });
    expect(formatJson("null")).toMatchObject({ kind: "null", entryCount: 0 });
  });

  it("measures the output in bytes, not characters", () => {
    // A multi-byte character must count as more than one byte.
    expect(formatJson('"é"', { indent: 0 }).byteSize).toBe(4);
  });

  it("sorts keys only when asked, and sorts nested objects too", () => {
    const input = '{"b":{"d":1,"c":2},"a":3}';

    expect(formatJson(input, { indent: 0 }).output).toBe('{"b":{"d":1,"c":2},"a":3}');
    expect(formatJson(input, { indent: 0, sortKeys: true }).output).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("sorts keys inside objects nested in arrays", () => {
    expect(formatJson('[{"b":1,"a":2}]', { indent: 0, sortKeys: true }).output).toBe('[{"a":2,"b":1}]');
  });

  it("preserves array order when sorting keys", () => {
    expect(formatJson('{"list":[3,1,2]}', { indent: 0, sortKeys: true }).output).toBe('{"list":[3,1,2]}');
  });

  it("asks for input rather than throwing a parse error on empty text", () => {
    expect(() => formatJson("   ")).toThrow(/Paste some JSON/i);
    expect(() => formatJson("")).toThrow(JsonParseError);
  });

  it("reports the line and column of a syntax error", () => {
    // A missing property name gives V8 an explicit position.
    try {
      formatJson('{\n  "a": 1,\n  ,\n}');
      throw new Error("should have thrown");
    } catch (reason) {
      expect(reason).toBeInstanceOf(JsonParseError);
      const error = reason as JsonParseError;
      expect(error.line).toBe(3);
      expect(error.column).toBeGreaterThan(0);
      expect(error.message).toMatch(/line 3, column \d+/);
    }
  });

  it("computes the line from a character position when that is all V8 gives", () => {
    try {
      formatJson('{"a":1,}');
      throw new Error("should have thrown");
    } catch (reason) {
      const error = reason as JsonParseError;
      expect(error.line).toBe(1);
      expect(error.column).toBe(8);
    }
  });

  it("names the offending token when V8 reports no position", () => {
    try {
      formatJson('{\n  "a": 1,\n  "b": oops\n}');
      throw new Error("should have thrown");
    } catch (reason) {
      const error = reason as JsonParseError;
      expect(error.message).toBe('Invalid JSON: unexpected "o".');
      expect(error.line).toBeUndefined();
    }
  });

  it("never echoes the pasted document back inside an error message", () => {
    const secret = "correct-horse-battery-staple";

    try {
      formatJson(`{"password": "${secret}", "broken": oops}`);
      throw new Error("should have thrown");
    } catch (reason) {
      expect((reason as JsonParseError).message).not.toContain(secret);
    }
  });

  it("rejects a trailing comma and a comment, which are not valid JSON", () => {
    expect(() => formatJson('{"a":1,}')).toThrow(JsonParseError);
    expect(() => formatJson('{"a":1} // note')).toThrow(JsonParseError);
  });

  it("rejects a document beyond the size limit", () => {
    const oversized = `"${"x".repeat(MAX_JSON_CHARACTERS)}"`;

    expect(() => formatJson(oversized)).toThrow(/too large/i);
  });

  it("keeps a deeply nested structure intact", () => {
    const input = JSON.stringify({ a: { b: { c: { d: [1, { e: "f" }] } } } });

    expect(JSON.parse(formatJson(input).output)).toEqual(JSON.parse(input));
  });

  it("round-trips values that JSON.stringify treats specially", () => {
    const input = '{"empty":{},"emptyList":[],"nul":null,"unicode":"\\u00e9","escaped":"line\\nbreak"}';

    expect(JSON.parse(formatJson(input).output)).toEqual(JSON.parse(input));
  });
});
