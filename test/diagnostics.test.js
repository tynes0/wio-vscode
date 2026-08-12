"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { normalizeLine, parseDiagnosticLine, parseDiagnostics } = require("../src/diagnostics");

test("normalizes timestamped Wio logs", () => {
  assert.equal(normalizeLine("[08/03/26-01:26:48] [error] WIO LOG: Error [cli]: bad"), "Error [cli]: bad");
});

test("parses Wio source diagnostics", () => {
  const file = path.resolve("sample.wio");
  const item = parseDiagnosticLine(`[time] [error] WIO LOG: Error [${file}:12:7]: unknown name`, process.cwd(), file);
  assert.equal(item.file, file);
  assert.equal(item.line, 12);
  assert.equal(item.column, 7);
  assert.equal(item.severity, "error");
  assert.equal(item.message, "unknown name");
});

test("parses GCC diagnostics and removes duplicates", () => {
  const line = "native.cpp:4:9: warning: unused value";
  const parsed = parseDiagnostics(`${line}\n${line}`, process.cwd(), "sample.wio");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].severity, "warning");
});
