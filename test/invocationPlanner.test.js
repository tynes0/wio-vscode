"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { OPERATIONS, hasExecutableEntry, planInvocation } = require("../src/invocationPlanner");

const project = {
  root: path.resolve("fixtures/native-project"),
  manifestPath: path.resolve("fixtures/native-project/wio.makewio"),
  manifestName: "wio.makewio"
};

test("recognizes Entry and application without matching comments or strings", () => {
  assert.equal(hasExecutableEntry("fn Entry() -> i32 { return 0; }"), true);
  assert.equal(hasExecutableEntry("application Desk { on update {} }"), true);
  assert.equal(hasExecutableEntry('// fn Entry() {}\nlet x = "application Fake {";'), false);
});

test("checks project members through the manifest instead of file mode", () => {
  const plan = planInvocation({
    operation: OPERATIONS.CHECK,
    filePath: path.join(project.root, "wio/native.wio"),
    source: "using cpp::header(\"native_api.h\");",
    project,
    configuration: {}
  });
  assert.equal(plan.mode, "project");
  assert.deepEqual(plan.args, ["project", "build", "--project", project.manifestPath]);
  assert.equal(plan.cwd, project.root);
});

test("runs project members through project run and forwards app args", () => {
  const plan = planInvocation({ operation: OPERATIONS.RUN, filePath: "ignored.wio", source: "", project, configuration: { runArgs: ["two words"] } });
  assert.deepEqual(plan.args, ["project", "run", "--project", project.manifestPath, "--", "two words"]);
});

test("uses project describe for backend information", () => {
  const plan = planInvocation({ operation: OPERATIONS.BACKEND_INFO, filePath: "ignored.wio", source: "", project, configuration: {} });
  assert.deepEqual(plan.args, ["project", "describe", "--project", project.manifestPath]);
});

test("checks standalone library files as static targets without requiring Entry", () => {
  const file = path.resolve("library.wio");
  const plan = planInvocation({ operation: OPERATIONS.CHECK, filePath: file, source: "component Value { data: i32; }", configuration: {} });
  assert.deepEqual(plan.args, ["file", "check", file, "--target", "static"]);
  assert.equal(plan.blocked, undefined);
});

test("blocks running a standalone library with a useful explanation", () => {
  const plan = planInvocation({ operation: OPERATIONS.RUN, filePath: path.resolve("library.wio"), source: "fn Helper() {}", configuration: {} });
  assert.equal(plan.blocked, true);
  assert.match(plan.message, /treated as a library/);
});

test("uses direct compiler mode for standalone C++ emission", () => {
  const file = path.resolve("library.wio");
  const plan = planInvocation({ operation: OPERATIONS.EMIT_CPP, filePath: file, source: "fn Helper() {}", configuration: { standaloneArgs: ["--include-dir", "native/include"] } });
  assert.deepEqual(plan.args, [file, "--include-dir", "native/include", "--target", "static", "--emit-cpp"]);
  assert.equal(plan.args.includes("--dry-run"), false);
});
