"use strict";

const vscode = require("vscode");
const { WioCli } = require("./cli");
const { registerCommands } = require("./commands");
const { registerProviders } = require("./providers");
const { findOwningProjectContext, findProjectContext } = require("./project");
const { WorkspaceIndex } = require("./workspaceIndex");

let activeServices;

async function activate(context) {
  const extensionVersion = context.extension?.packageJSON?.version || "0.15.0";
  const output = vscode.window.createOutputChannel("Wio", { log: true });
  const diagnostics = vscode.languages.createDiagnosticCollection("wio");
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.name = "Wio";
  status.text = "$(sync~spin) Wio: indexing";
  status.command = "wio.showOutput";
  status.tooltip = "Show Wio output";
  status.show();

  const cli = new WioCli(vscode, output);
  const index = new WorkspaceIndex(vscode, output);
  activeServices = { output, diagnostics, status, cli, index };
  context.subscriptions.push(output, diagnostics, status, cli, index);

  const commands = registerCommands(vscode, context, activeServices);
  registerProviders(vscode, context, index);

  const timers = new Map();
  function scheduleDiagnostics(document, reason) {
    const isWio = document.languageId === "wio";
    const projectInput = /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx|m|mm)$/iu.test(document.uri.fsPath)
      || /(?:^|[\\/])(?:wio\.makewio|makewio|wio\.project\.json)$/iu.test(document.uri.fsPath);
    if (!isWio && !(reason === "save" && projectInput)) return;
    const config = vscode.workspace.getConfiguration("wio", document.uri);
    if (isWio && !config.get(reason === "open" ? "enableDiagnosticsOnOpen" : "enableDiagnosticsOnSave", true)) return;
    const project = isWio ? findOwningProjectContext(document.uri.fsPath) : findProjectContext(document.uri.fsPath);
    if (!isWio && (!project || !config.get("project.checkOnNativeSave", true))) return;
    const key = project?.manifestPath || document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      if (project) commands.checkProject(project, { activeFile: isWio ? document.uri.fsPath : undefined, resourceUri: document.uri, quiet: true });
      else commands.runDocument("check", document.uri, { diagnostics: true, quiet: true });
    }, config.get("diagnosticsDebounceMs", 250)));
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => { index.update(document); scheduleDiagnostics(document, "open"); }),
    vscode.workspace.onDidSaveTextDocument((document) => { index.update(document); scheduleDiagnostics(document, "save"); }),
    vscode.workspace.onDidChangeTextDocument((event) => index.update(event.document)),
    vscode.workspace.onDidCreateFiles((event) => event.files.filter((uri) => uri.fsPath.endsWith(".wio")).forEach((uri) => index.updateUri(uri))),
    vscode.workspace.onDidDeleteFiles((event) => event.files.forEach((uri) => index.remove(uri.toString()))),
    vscode.workspace.onDidRenameFiles((event) => event.files.forEach((item) => {
      index.remove(item.oldUri.toString());
      if (item.newUri.fsPath.endsWith(".wio")) index.updateUri(item.newUri);
    })),
    { dispose() { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); } }
  );

  await index.rebuild();
  status.text = `$(check) Wio ${extensionVersion}`;
  for (const document of vscode.workspace.textDocuments) scheduleDiagnostics(document, "open");
  output.appendLine(`Wio Language Support ${extensionVersion} activated.`);
}

function deactivate() {
  activeServices?.cli.dispose();
  activeServices = undefined;
}

module.exports = { activate, deactivate };
