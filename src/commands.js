"use strict";

const { parseDiagnostics } = require("./diagnostics");
const { workspaceRootFor } = require("./project");

async function activeWioDocument(vscode, resource) {
  if (resource?.fsPath) {
    const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === resource.toString());
    if (open) return open;
    const document = await vscode.workspace.openTextDocument(resource);
    return document.languageId === "wio" ? document : undefined;
  }
  const document = vscode.window.activeTextEditor?.document;
  return document?.languageId === "wio" ? document : undefined;
}

function severity(vscode, value) {
  if (value === "error" || value === "fatal error") return vscode.DiagnosticSeverity.Error;
  if (value === "warning" || value === "warn") return vscode.DiagnosticSeverity.Warning;
  if (value === "note" || value === "info") return vscode.DiagnosticSeverity.Information;
  return vscode.DiagnosticSeverity.Hint;
}

function publishDiagnostics(vscode, collection, parsed) {
  const byFile = new Map();
  for (const item of parsed) {
    if (!item.file) continue;
    const uri = vscode.Uri.file(item.file);
    const line = Math.max(0, item.line - 1);
    const column = Math.max(0, item.column - 1);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(line, column, line, column + 1), item.message, severity(vscode, item.severity)
    );
    diagnostic.source = "Wio";
    const key = uri.toString();
    const entry = byFile.get(key) || { uri, diagnostics: [] };
    entry.diagnostics.push(diagnostic);
    byFile.set(key, entry);
  }
  for (const { uri, diagnostics } of byFile.values()) collection.set(uri, diagnostics);
}

function registerCommands(vscode, context, services) {
  const { cli, diagnostics, output, index, status } = services;

  async function runFile(action, resource, extra = [], options = {}) {
    const document = await activeWioDocument(vscode, resource);
    if (!document) { vscode.window.showWarningMessage("Open a Wio file first."); return undefined; }
    if (document.isDirty) await document.save();
    status.text = `$(sync~spin) Wio: ${action}`;
    const result = await cli.file(action, document, extra, { key: options.key, reveal: options.reveal });
    status.text = result.code === 0 ? "$(check) Wio" : "$(error) Wio";
    if (options.diagnostics) {
      diagnostics.delete(document.uri);
      publishDiagnostics(vscode, diagnostics, parseDiagnostics(result.output, result.cwd, document.uri.fsPath));
    }
    if (result.code !== 0 && !options.quiet) vscode.window.showErrorMessage(`Wio ${action} failed (exit ${result.code}).`);
    return result;
  }

  async function runProject(action) {
    const document = await activeWioDocument(vscode);
    const root = workspaceRootFor(vscode, document);
    if (!root) { vscode.window.showWarningMessage("Open a Wio project folder first."); return; }
    status.text = `$(sync~spin) Wio: ${action}`;
    const result = await cli.project(action, root, { reveal: action !== "build" });
    status.text = result.code === 0 ? "$(check) Wio" : "$(error) Wio";
    if (result.code !== 0) vscode.window.showErrorMessage(`Wio project ${action} failed (exit ${result.code}).`);
  }

  const command = (name, handler) => context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  command("wio.checkCurrentFile", (resource) => runFile("check", resource, [], { diagnostics: true, key: "diagnostics", reveal: true }));
  command("wio.runCurrentFile", (resource) => runFile("run", resource, [], { reveal: true }));
  command("wio.emitCppCurrentFile", (resource) => runFile("check", resource, ["--emit-cpp"], { reveal: true }));
  command("wio.showBackendInfoCurrentFile", (resource) => runFile("check", resource, ["--show-backend-info"], { reveal: true }));
  command("wio.buildProject", () => runProject("build"));
  command("wio.runProject", () => runProject("run"));
  command("wio.testProject", () => runProject("test"));
  command("wio.doctor", async () => {
    const root = workspaceRootFor(vscode, await activeWioDocument(vscode));
    const result = await cli.doctor(root);
    if (result.code !== 0) vscode.window.showErrorMessage(`Wio doctor failed (exit ${result.code}).`);
  });
  command("wio.restartIndex", async () => {
    status.text = "$(sync~spin) Wio: indexing";
    await index.rebuild();
    status.text = "$(check) Wio";
    vscode.window.showInformationMessage(`Wio index rebuilt: ${index.documents.size} file(s).`);
  });
  command("wio.showOutput", () => output.show(true));
  command("wio.clearDiagnostics", () => diagnostics.clear());

  return { runFile };
}

module.exports = { activeWioDocument, publishDiagnostics, registerCommands };
