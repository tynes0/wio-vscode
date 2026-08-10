"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { OPERATIONS, planInvocation } = require("../src/invocationPlanner");
const { findProjectContext } = require("../src/project");

const executable = process.env.WIO_TEST_EXECUTABLE;
const fixtureRoot = path.resolve(__dirname, "fixtures");
const projectConfiguration = process.env.WIO_TEST_FORCE_REBUILD === "1" ? { projectArgs: ["--rebuild"] } : {};

function execute(plan) {
  const result = childProcess.spawnSync(executable, plan.args, { cwd: plan.cwd, encoding: "utf8", windowsHide: true });
  return { code: result.status, output: `${result.stdout || ""}${result.stderr || ""}`, error: result.error };
}

function requireCompiler(t) {
  if (!executable || !fs.existsSync(executable)) {
    t.skip("Set WIO_TEST_EXECUTABLE to run Wio integration fixtures.");
    return false;
  }
  return true;
}

test("manifest-aware check builds a multi-file pure Wio project", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "pure-project", "wio", "math.wio");
  const plan = planInvocation({ operation: OPERATIONS.CHECK, filePath: file, source: fs.readFileSync(file, "utf8"), project: findProjectContext(file), configuration: projectConfiguration });
  const result = execute(plan);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0, result.output);
});

test("manifest-aware check resolves C++ headers and native sources", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "native-project", "wio", "native.wio");
  const plan = planInvocation({ operation: OPERATIONS.CHECK, filePath: file, source: fs.readFileSync(file, "utf8"), project: findProjectContext(file), configuration: projectConfiguration });
  const result = execute(plan);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0, result.output);
});

test("manifest-aware run executes the native Wio project", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "native-project", "wio", "native.wio");
  const plan = planInvocation({ operation: OPERATIONS.RUN, filePath: file, source: fs.readFileSync(file, "utf8"), project: findProjectContext(file), configuration: projectConfiguration });
  const result = execute(plan);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0, result.output);
});

test("standalone library check does not require Entry", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "standalone", "library.wio");
  const plan = planInvocation({ operation: OPERATIONS.CHECK, filePath: file, source: fs.readFileSync(file, "utf8"), configuration: {} });
  const result = execute(plan);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0, result.output);
});

test("manifest library project checks without an Entry function", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "library-project", "wio", "library.wio");
  const plan = planInvocation({ operation: OPERATIONS.CHECK, filePath: file, source: fs.readFileSync(file, "utf8"), project: findProjectContext(file), configuration: projectConfiguration });
  const result = execute(plan);
  assert.equal(result.code, 0, result.output);
});

test("standalone executable still runs in structured file mode", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "standalone", "application.wio");
  const plan = planInvocation({ operation: OPERATIONS.RUN, filePath: file, source: fs.readFileSync(file, "utf8"), configuration: {} });
  const result = execute(plan);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0, result.output);
});

test("project C++ emission rebuilds the manifest output", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "pure-project", "wio", "math.wio");
  const project = findProjectContext(file);
  const plan = planInvocation({ operation: OPERATIONS.EMIT_CPP, filePath: file, source: fs.readFileSync(file, "utf8"), project, configuration: projectConfiguration });
  const result = execute(plan);
  assert.equal(result.code, 0, result.output);
  assert.equal(fs.existsSync(path.join(project.root, ".wio-build", "interop", "editor_pure_fixture.wio.cpp")), true);
});

test("standalone C++ emission uses direct compiler mode successfully", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "standalone", "library.wio");
  const plan = planInvocation({ operation: OPERATIONS.EMIT_CPP, filePath: file, source: fs.readFileSync(file, "utf8"), configuration: {} });
  const result = execute(plan);
  assert.equal(result.code, 0, result.output);
  assert.equal(fs.existsSync(`${file}.cpp`), true);
});

test("project backend information comes from project describe", (t) => {
  if (!requireCompiler(t)) return;
  const file = path.join(fixtureRoot, "native-project", "wio", "native.wio");
  const plan = planInvocation({ operation: OPERATIONS.BACKEND_INFO, filePath: file, source: fs.readFileSync(file, "utf8"), project: findProjectContext(file), configuration: {} });
  const result = execute(plan);
  assert.equal(result.code, 0, result.output);
  const description = JSON.parse(result.output.trim());
  assert.equal(description.wio.target, "exe");
  assert.match(description.manifest, /wio\.makewio$/);
});
