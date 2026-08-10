"use strict";

const { parseDiagnostics } = require("./diagnostics");
const { OPERATIONS, planInvocation } = require("./invocationPlanner");
const { findOwningProjectContext, findProjectContext, workspaceRootFor } = require("./project");

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
  return [...byFile.values()].map((entry) => entry.uri);
}

function registerCommands(vscode, context, services) {
  const { cli, diagnostics, output, index, status } = services;
  const diagnosticScopes = new Map();

  function clearDiagnosticScope(scope) {
    for (const uri of diagnosticScopes.get(scope) || []) diagnostics.delete(uri);
    diagnosticScopes.delete(scope);
  }

  function updateDiagnosticScope(scope, result, activeFile) {
    clearDiagnosticScope(scope);
    const parsed = parseDiagnostics(result.output, result.cwd, activeFile);
    const uris = publishDiagnostics(vscode, diagnostics, parsed);
    diagnosticScopes.set(scope, uris);
  }

  async function runDocument(operation, resource, options = {}) {
    const document = await activeWioDocument(vscode, resource);
    if (!document) { vscode.window.showWarningMessage("Open a Wio file first."); return undefined; }
    if (document.isDirty) await document.save();
    const project = findOwningProjectContext(document.uri.fsPath);
    const plan = planInvocation({
      operation,
      filePath: document.uri.fsPath,
      source: document.getText(),
      project,
      configuration: cli.configuration(document.uri)
    });
    if (plan.blocked) {
      status.text = "$(info) Wio: library file";
      vscode.window.showInformationMessage(plan.message);
      return { code: -1, blocked: true, plan, output: plan.message };
    }
    const label = plan.mode === "project" ? `project ${plan.args[1]}` : operation;
    status.text = `$(sync~spin) Wio: ${label}`;
    const processKey = options.key || (options.diagnostics ? `diagnostics:${plan.diagnosticScope}` : `${operation}:${plan.diagnosticScope}`);
    const result = await cli.invoke(plan, { key: processKey, reveal: options.reveal, resourceUri: document.uri });
    status.text = result.code === 0 ? "$(check) Wio" : "$(error) Wio";
    if (options.diagnostics) {
      updateDiagnosticScope(plan.diagnosticScope, result, document.uri.fsPath);
    }
    if (result.code !== 0 && !options.quiet) vscode.window.showErrorMessage(`Wio ${label} failed (exit ${result.code}). See the Wio output for details.`);
    return { ...result, plan };
  }

  async function checkProject(project, options = {}) {
    const plan = planInvocation({ operation: OPERATIONS.CHECK, project, configuration: cli.configuration(options.resourceUri) });
    status.text = "$(sync~spin) Wio: project build";
    const result = await cli.invoke(plan, { key: `diagnostics:${plan.diagnosticScope}`, reveal: options.reveal, resourceUri: options.resourceUri });
    status.text = result.code === 0 ? "$(check) Wio" : "$(error) Wio";
    updateDiagnosticScope(plan.diagnosticScope, result, options.activeFile);
    if (result.code !== 0 && !options.quiet) vscode.window.showErrorMessage(`Wio project build failed (exit ${result.code}). See the Wio output for details.`);
    return { ...result, plan };
  }

  async function runProject(action) {
    const document = await activeWioDocument(vscode);
    const root = workspaceRootFor(vscode, document);
    if (!root) { vscode.window.showWarningMessage("Open a Wio project folder first."); return; }
    status.text = `$(sync~spin) Wio: ${action}`;
    const result = await cli.project(action, root, { reveal: action !== "build" });
    status.text = result.code === 0 ? "$(check) Wio" : "$(error) Wio";
    const project = findProjectContext(document?.uri.fsPath || root);
    updateDiagnosticScope(project?.manifestPath || root, result, document?.uri.fsPath);
    if (result.code !== 0) vscode.window.showErrorMessage(`Wio project ${action} failed (exit ${result.code}).`);
  }

  const command = (name, handler) => context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  command("wio.checkCurrentFile", (resource) => runDocument(OPERATIONS.CHECK, resource, { diagnostics: true }));
  command("wio.runCurrentFile", (resource) => runDocument(OPERATIONS.RUN, resource, { diagnostics: true, reveal: true }));
  command("wio.emitCppCurrentFile", (resource) => runDocument(OPERATIONS.EMIT_CPP, resource, { reveal: true }));
  command("wio.showBackendInfoCurrentFile", (resource) => runDocument(OPERATIONS.BACKEND_INFO, resource, { reveal: true }));
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
  command("wio.clearDiagnostics", () => { diagnostics.clear(); diagnosticScopes.clear(); });

  return { checkProject, runDocument };
}

module.exports = { activeWioDocument, publishDiagnostics, registerCommands };
