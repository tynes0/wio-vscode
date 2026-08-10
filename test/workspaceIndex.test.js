"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { WorkspaceIndex } = require("../src/workspaceIndex");

function uri(value) {
  return { fsPath: value, toString() { return `file://${value}`; } };
}

test("incrementally replaces declarations without leaving stale symbols", () => {
  const index = new WorkspaceIndex({}, { appendLine() {} });
  const file = uri("sample.wio");
  index.updateText(file, "component Before { value: i32; }");
  assert.equal(index.find("Before").length, 1);
  index.updateText(file, "component After { value: i32; }");
  assert.equal(index.find("Before").length, 0);
  assert.equal(index.find("After").length, 1);
  assert.equal(index.find("After")[0].uri, file);
});
