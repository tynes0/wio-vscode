"use strict";

const path = require("node:path");

const LOG_PREFIX = /^\[[^\]]+\]\s+\[(?:trace|debug|info|warn|warning|error|critical)\]\s+WIO LOG:\s*/i;

function normalizeLine(line) {
  return String(line || "").replace(/\r$/, "").replace(LOG_PREFIX, "").trim();
}

function resolveFile(label, cwd, activeFile) {
  if (!label || label === "cli" || label === "backend") return activeFile;
  const cleaned = label.replace(/^['"]|['"]$/g, "");
  return path.isAbsolute(cleaned) ? path.normalize(cleaned) : path.resolve(cwd || process.cwd(), cleaned);
}

function parseDiagnosticLine(line, cwd, activeFile) {
  const text = normalizeLine(line);
  const severityMatch = text.match(/^(?:WIO\s+LOG:\s*)?(Error|Warning|Warn|Note|Info)\s*(?:\[([^\]]+)\])?\s*:\s*(.*)$/i);
  if (severityMatch) {
    const [, severity, location, message] = severityMatch;
    const parsed = parseLocation(location, cwd, activeFile);
    return { severity: severity.toLowerCase(), message, ...parsed, raw: line };
  }

  const gcc = text.match(/^(.+?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.+)$/i);
  if (gcc) {
    return {
      file: resolveFile(gcc[1], cwd, activeFile), line: Number(gcc[2]), column: Number(gcc[3]),
      severity: gcc[4].toLowerCase().includes("error") ? "error" : gcc[4].toLowerCase(),
      message: gcc[5], raw: line
    };
  }

  const msvc = text.match(/^(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(error|warning|note)[^:]*:\s*(.+)$/i);
  if (msvc) {
    return {
      file: resolveFile(msvc[1], cwd, activeFile), line: Number(msvc[2]), column: Number(msvc[3] || 1),
      severity: msvc[4].toLowerCase(), message: msvc[5], raw: line
    };
  }
  return undefined;
}

function parseLocation(location, cwd, activeFile) {
  if (!location) return { file: activeFile, line: 1, column: 1 };
  const match = location.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match) return { file: resolveFile(location, cwd, activeFile), line: 1, column: 1 };
  return {
    file: resolveFile(match[1], cwd, activeFile),
    line: Math.max(1, Number(match[2])),
    column: Math.max(1, Number(match[3] || 1))
  };
}

function parseDiagnostics(output, cwd, activeFile) {
  const seen = new Set();
  const result = [];
  for (const line of String(output || "").split(/\r?\n/)) {
    const item = parseDiagnosticLine(line, cwd, activeFile);
    if (!item) continue;
    const key = `${item.file}:${item.line}:${item.column}:${item.severity}:${item.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

module.exports = { normalizeLine, parseDiagnosticLine, parseDiagnostics };
