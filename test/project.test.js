"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { findProjectRoot } = require("../src/project");

test("finds the nearest Wio project manifest", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wio-vscode-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, "wio", "feature");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(root, "wio.makewio"), "type = executable\n");
  const file = path.join(nested, "main.wio");
  fs.writeFileSync(file, "fn Entry() -> i32 { return 0; }\n");
  assert.equal(findProjectRoot(file), root);
});
