"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { registerCommands } = require("../src/commands");

function makeUri(filePath) {
  return { fsPath: filePath, toString() { return `file://${filePath}`; } };
}

function harness(document) {
  const handlers = new Map();
  const invocations = [];
  const messages = [];
  const vscode = {
    commands: { registerCommand(name, handler) { handlers.set(name, handler); return { dispose() {} }; } },
    workspace: {
      textDocuments: [document],
      openTextDocument: async () => document,
      getWorkspaceFolder: () => ({ uri: makeUri(path.dirname(document.uri.fsPath)) }),
      workspaceFolders: []
    },
    window: {
      activeTextEditor: { document },
      showWarningMessage(message) { messages.push(message); },
      showInformationMessage(message) { messages.push(message); },
      showErrorMessage(message) { messages.push(message); }
    }
  };
  const cli = {
    configuration: () => ({}),
    async invoke(plan) { invocations.push(plan); return { code: 0, output: "", cwd: plan.cwd }; },
    async project() { return { code: 0, output: "" }; },
    async doctor() { return { code: 0, output: "" }; }
  };
  const services = {
    cli,
    diagnostics: { delete() {}, set() {}, clear() {} },
    output: { show() {} },
    index: { async rebuild() {}, documents: new Map() },
    status: { text: "" }
  };
  registerCommands(vscode, { subscriptions: [] }, services);
  return { handlers, invocations, messages };
}

test("Check Current File builds the owning manifest project", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wio-vscode-command-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, "wio");
  fs.mkdirSync(sourceRoot);
  fs.writeFileSync(path.join(root, "wio.makewio"), '[wio]\nentry = "wio/main.wio"\nsourceRoots = ["wio"]\n');
  const file = path.join(sourceRoot, "native.wio");
  fs.writeFileSync(file, 'using cpp::header("native_api.h");\n');
  const uri = makeUri(file);
  const document = { uri, languageId: "wio", isDirty: false, getText: () => fs.readFileSync(file, "utf8") };
  const { handlers, invocations } = harness(document);
  await handlers.get("wio.checkCurrentFile")(uri);
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].mode, "project");
  assert.deepEqual(invocations[0].args.slice(0, 3), ["project", "build", "--project"]);
});

test("Run Current File refuses a manifest-free library instead of reporting a fake Entry error", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wio-vscode-library-command-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "library.wio");
  fs.writeFileSync(file, "fn Helper() {}\n");
  const uri = makeUri(file);
  const document = { uri, languageId: "wio", isDirty: false, getText: () => fs.readFileSync(file, "utf8") };
  const { handlers, invocations, messages } = harness(document);
  await handlers.get("wio.runCurrentFile")(uri);
  assert.equal(invocations.length, 0);
  assert.match(messages[0], /treated as a library/);
});
