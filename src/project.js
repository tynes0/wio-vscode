"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MANIFESTS = ["wio.makewio", "makewio", "wio.project.json"];

function findProjectRoot(startPath) {
  if (!startPath) return undefined;
  let current = path.resolve(fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
    ? startPath
    : path.dirname(startPath));
  while (true) {
    if (MANIFESTS.some((name) => fs.existsSync(path.join(current, name)))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function workspaceRootFor(vscode, document) {
  const folder = document ? vscode.workspace.getWorkspaceFolder(document.uri) : undefined;
  return findProjectRoot(document && document.uri.fsPath)
    || (folder && folder.uri.fsPath)
    || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath);
}

module.exports = { MANIFESTS, findProjectRoot, workspaceRootFor };
