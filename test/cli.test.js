"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildFileArgs, buildProjectArgs, quoteForDisplay } = require("../src/cli");

test("builds structured file commands", () => {
  assert.deepEqual(buildFileArgs("check", "C:\\app\\main.wio", { defaultArgs: ["--quiet"] }), ["file", "check", "C:\\app\\main.wio", "--quiet"]);
});

test("forwards run arguments after the separator", () => {
  assert.deepEqual(buildProjectArgs("run", "C:\\app", { runArgs: ["two words", "--safe"] }), ["project", "run", "--project", "C:\\app", "--", "two words", "--safe"]);
});

test("quotes display-only command arguments", () => {
  assert.equal(quoteForDisplay("two words"), '"two words"');
  assert.equal(quoteForDisplay("plain"), "plain");
});
