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

function parseMakewio(text) {
  const result = {};
  let section = "root";
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    let quoted = false;
    let escaped = false;
    let content = "";
    for (const character of rawLine) {
      if (character === "#" && !quoted) break;
      content += character;
      if (character === '"' && !escaped) quoted = !quoted;
      escaped = character === "\\" && !escaped;
      if (character !== "\\") escaped = false;
    }
    const line = content.trim();
    if (!line || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (sectionMatch) { section = sectionMatch[1]; continue; }
    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*?)\s*$/);
    if (!assignment) continue;
    const [, key, rawValue] = assignment;
    const bucket = result[section] || (result[section] = {});
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      bucket[key] = [...rawValue.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) => match[1].replace(/\\"/g, '"'));
    } else if (/^".*"$/.test(rawValue)) bucket[key] = rawValue.slice(1, -1);
    else if (/^(?:true|false)$/i.test(rawValue)) bucket[key] = rawValue.toLowerCase() === "true";
    else bucket[key] = rawValue;
  }
  return result;
}

function readProjectMetadata(context) {
  try {
    const text = fs.readFileSync(context.manifestPath, "utf8");
    const data = context.format === "json" ? JSON.parse(text) : parseMakewio(text);
    const wio = data.wio || data.Wio || data;
    const host = data.host || data.Host || {};
    return {
      entry: typeof wio.entry === "string" ? wio.entry : undefined,
      target: typeof wio.target === "string" ? wio.target : "exe",
      sourceRoots: Array.isArray(wio.sourceRoots) ? wio.sourceRoots.filter((value) => typeof value === "string") : [],
      includeDirs: Array.isArray(wio.includeDirs) ? wio.includeDirs.filter((value) => typeof value === "string") : [],
      nativeSources: Array.isArray(wio.nativeSources) ? wio.nativeSources.filter((value) => typeof value === "string") : [],
      hostEnabled: host.enabled === true
    };
  } catch {
    return { target: "exe", sourceRoots: [], includeDirs: [], nativeSources: [], hostEnabled: false };
  }
}

function pathInside(filePath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isProjectWioSource(filePath, context, metadata = readProjectMetadata(context)) {
  if (metadata.entry && path.resolve(context.root, metadata.entry) === path.resolve(filePath)) return true;
  if (!metadata.sourceRoots.length) return pathInside(filePath, context.root);
  return metadata.sourceRoots.some((root) => pathInside(filePath, path.resolve(context.root, root)));
}

function findOwningProjectContext(filePath) {
  const context = findProjectContext(filePath);
  if (!context) return undefined;
  const metadata = readProjectMetadata(context);
  return isProjectWioSource(filePath, context, metadata) ? { ...context, metadata } : undefined;
}

function workspaceRootFor(vscode, document) {
  const folder = document ? vscode.workspace.getWorkspaceFolder(document.uri) : undefined;
  return findProjectRoot(document && document.uri.fsPath)
    || findProjectRoot(folder && folder.uri.fsPath)
    || findProjectRoot(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath);
}

module.exports = {
  MANIFESTS, findOwningProjectContext, findProjectContext, findProjectRoot,
  isProjectWioSource, parseMakewio, pathInside, readProjectMetadata, workspaceRootFor
};
