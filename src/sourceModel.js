"use strict";

const DECLARATION_PATTERN = /\b(async\s+)?(fn|object|component|interface|enum|flagset|type|attribute|application|system|extension|realm)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

function maskTrivia(source) {
  const chars = [...source];
  let state = "code";
  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];
    if (state === "line") {
      if (current === "\n") state = "code"; else chars[i] = " ";
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/") { chars[i] = chars[i + 1] = " "; i += 1; state = "code"; }
      else if (current !== "\n") chars[i] = " ";
      continue;
    }
    if (state === "string" || state === "char") {
      if (current === "\\") { chars[i] = " "; if (i + 1 < chars.length && chars[i + 1] !== "\n") chars[++i] = " "; continue; }
      const terminator = state === "string" ? '"' : "'";
      if (current === terminator) state = "code";
      if (current !== "\n") chars[i] = " ";
      continue;
    }
    if (current === "/" && next === "/") { chars[i] = chars[i + 1] = " "; i += 1; state = "line"; continue; }
    if (current === "/" && next === "*") { chars[i] = chars[i + 1] = " "; i += 1; state = "block"; continue; }
    if (current === '"') { chars[i] = " "; state = "string"; continue; }
    if (current === "'") { chars[i] = " "; state = "char"; }
  }
  return chars.join("");
}

function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) if (source[i] === "\n") starts.push(i + 1);
  return starts;
}

function positionAt(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= offset) low = middle; else high = middle;
  }
  return { line: low, character: offset - starts[low] };
}

function findMatchingBrace(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    if (masked[i] === "{") depth += 1;
    else if (masked[i] === "}" && --depth === 0) return i;
  }
  return undefined;
}

function splitTopLevel(text, separator = ",") {
  const parts = [];
  let start = 0;
  let angle = 0, round = 0, square = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "<") angle += 1;
    else if (text[i] === ">") angle = Math.max(0, angle - 1);
    else if (text[i] === "(") round += 1;
    else if (text[i] === ")") round = Math.max(0, round - 1);
    else if (text[i] === "[") square += 1;
    else if (text[i] === "]") square = Math.max(0, square - 1);
    else if (text[i] === separator && angle === 0 && round === 0 && square === 0) {
      parts.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function parseParameters(text) {
  return splitTopLevel(text).map((part) => {
    const match = part.match(/^(?:(ref|view|mut)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    return match ? { modifier: match[1], name: match[2], type: match[3].trim() } : { name: part, type: "" };
  });
}

function declarationDetails(source, masked, match, starts) {
  const async = Boolean(match[1]);
  const kind = match[2];
  const name = match[3];
  const start = match.index;
  const nameOffset = match.index + match[0].lastIndexOf(name);
  const openBrace = masked.indexOf("{", DECLARATION_PATTERN.lastIndex);
  const semicolon = masked.indexOf(";", DECLARATION_PATTERN.lastIndex);
  const hasBody = openBrace >= 0 && (semicolon < 0 || openBrace < semicolon);
  const end = hasBody ? (findMatchingBrace(masked, openBrace) ?? openBrace) + 1 : (semicolon >= 0 ? semicolon + 1 : match.index + match[0].length);
  const headerEnd = hasBody ? openBrace : end;
  const header = source.slice(match.index, headerEnd);
  let parameters = [];
  let returnType = "";
  if (kind === "fn") {
    const signature = header.match(/\(([^)]*)\)/s);
    const returnMatch = header.match(/->\s*(.+?)\s*(?=\bwhere\b|\bwith\b|$)/s);
    if (signature) { parameters = parseParameters(signature[1]); returnType = (returnMatch?.[1] || "void").trim(); }
  }
  return {
    async, kind, name, parameters, returnType,
    start, end, bodyStart: hasBody ? openBrace + 1 : undefined, bodyEnd: hasBody ? end - 1 : undefined,
    position: positionAt(starts, nameOffset), range: { start: positionAt(starts, start), end: positionAt(starts, end) },
    selection: { start: positionAt(starts, nameOffset), end: positionAt(starts, nameOffset + name.length) },
    signature: kind === "fn" ? `${async ? "async " : ""}fn ${name}(${parameters.map((p) => `${p.modifier ? `${p.modifier} ` : ""}${p.name}: ${p.type}`).join(", ")}) -> ${returnType}` : `${kind} ${name}`
  };
}

function parseUses(source, masked, starts) {
  const uses = [];
  const pattern = /\buse\s+([A-Za-z_][A-Za-z0-9_:]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;/g;
  let match;
  while ((match = pattern.exec(masked))) uses.push({ path: match[1], alias: match[2], position: positionAt(starts, match.index) });
  return uses;
}

function parseDocument(source, file = "") {
  const masked = maskTrivia(source);
  const starts = lineStarts(source);
  const declarations = [];
  DECLARATION_PATTERN.lastIndex = 0;
  let match;
  while ((match = DECLARATION_PATTERN.exec(masked))) declarations.push(declarationDetails(source, masked, match, starts));

  const stack = [];
  for (const declaration of declarations) {
    while (stack.length && declaration.start >= stack[stack.length - 1].end) stack.pop();
    const parent = [...stack].reverse().find((candidate) => candidate.bodyStart !== undefined && declaration.start > candidate.bodyStart && declaration.end <= candidate.end);
    declaration.parent = parent?.name;
    declaration.qualifiedName = parent ? `${parent.qualifiedName}::${declaration.name}` : declaration.name;
    declaration.file = file;
    if (declaration.bodyStart !== undefined) stack.push(declaration);
  }
  return { file, declarations, uses: parseUses(source, masked, starts), masked };
}

function wordAt(text, offset) {
  let start = Math.max(0, offset);
  let end = start;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z0-9_]/.test(text[end])) end += 1;
  return start === end ? undefined : { text: text.slice(start, end), start, end };
}

module.exports = { maskTrivia, parseDocument, parseParameters, splitTopLevel, wordAt };
