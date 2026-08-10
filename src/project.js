"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MANIFESTS = ["wio.makewio", "makewio", "wio.project.json"];

function findProjectContext(startPath) {
  if (!startPath) return undefined;
  let current;
  try {
    current = path.resolve(fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
      ? startPath
      : path.dirname(startPath));
  } catch {
    current = path.resolve(path.dirname(startPath));
  }
  while (true) {
    for (const manifestName of MANIFESTS) {
      const manifestPath = path.join(current, manifestName);
      if (fs.existsSync(manifestPath)) {
        return {
          root: current,
          manifestPath,
          manifestName,
          format: manifestName.endsWith(".json") ? "json" : "makewio"
        };
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function findProjectRoot(startPath) {
  return findProjectContext(startPath)?.root;
}

function workspaceRootFor(vscode, document) {
  const folder = document ? vscode.workspace.getWorkspaceFolder(document.uri) : undefined;
  return findProjectRoot(document && document.uri.fsPath)
    || findProjectRoot(folder && folder.uri.fsPath)
    || findProjectRoot(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath);
}

module.exports = { MANIFESTS, findProjectContext, findProjectRoot, workspaceRootFor };
