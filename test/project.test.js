"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { findOwningProjectContext, findProjectContext, findProjectRoot, parseMakewio } = require("../src/project");

test("finds the nearest Wio project manifest", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wio-vscode-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, "wio", "feature");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(root, "wio.makewio"), "type = executable\n");
  const file = path.join(nested, "main.wio");
  fs.writeFileSync(file, "fn Entry() -> i32 { return 0; }\n");
  assert.equal(findProjectRoot(file), root);
  const context = findProjectContext(file);
  assert.equal(context.root, root);
  assert.equal(context.manifestName, "wio.makewio");
  assert.equal(context.format, "makewio");
});

test("does not treat an arbitrary workspace folder as a Wio project", () => {
  assert.equal(findProjectRoot(__filename), undefined);
});

test("parses the manifest source and native boundaries", () => {
  const parsed = parseMakewio(`
[wio]
entry = "wio/main.wio"
target = "shared"
sourceRoots = ["wio", "generated"] # source boundary
includeDirs = ["native/include"]
nativeSources = ["native/src/api.cpp"]
[host]
enabled = true
`);
  assert.deepEqual(parsed.wio.sourceRoots, ["wio", "generated"]);
  assert.equal(parsed.wio.target, "shared");
  assert.equal(parsed.host.enabled, true);
});

test("does not route a scratch file outside explicit source roots through the project", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wio-vscode-boundary-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "wio"));
  fs.mkdirSync(path.join(root, "scratch"));
  fs.writeFileSync(path.join(root, "wio.makewio"), '[wio]\nentry = "wio/main.wio"\nsourceRoots = ["wio"]\n');
  const source = path.join(root, "wio", "module.wio");
  const scratch = path.join(root, "scratch", "experiment.wio");
  fs.writeFileSync(source, "fn Helper() {}\n");
  fs.writeFileSync(scratch, "fn Experiment() {}\n");
  assert.equal(findOwningProjectContext(source).root, root);
  assert.equal(findOwningProjectContext(scratch), undefined);
});
