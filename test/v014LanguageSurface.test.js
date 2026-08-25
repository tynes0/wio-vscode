"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const { TYPES, BUILTINS, ATTRIBUTES } = require("../src/languageData");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function findNamedPattern(value, name) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNamedPattern(item, name);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  if (value.name === name) return value;
  for (const child of Object.values(value)) {
    const found = findNamedPattern(child, name);
    if (found) return found;
  }
  return undefined;
}

test("aligns package and release metadata with Wio 0.16", () => {
  const packageJson = readJson("package.json");
  const lock = readJson("package-lock.json");
  const release = readJson("release-manifest.json");

  assert.equal(packageJson.version, "0.16.0");
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[""].version, packageJson.version);
  assert.equal(release.version, packageJson.version);
  assert.equal(release.compatibleWio, "0.16.x");
});

test("exposes the Wio 0.16 language and std surface", () => {
  assert.ok(TYPES.includes("text"));
  assert.ok(Object.hasOwn(ATTRIBUTES, "attribute::Processor"));
  assert.ok(Object.hasOwn(ATTRIBUTES, "attribute::Conflicts"));
  assert.ok(Object.hasOwn(ATTRIBUTES, "Export"));
  assert.ok(Object.hasOwn(BUILTINS, "std::serialization::Codec<TValue, TWire>"));
  assert.ok(Object.hasOwn(BUILTINS, "std::unicode::NormalizationForm"));
  assert.ok(Object.hasOwn(BUILTINS, "std::regex::Match"));
  assert.ok(Object.hasOwn(BUILTINS, "std::async::CancellationToken"));

  const snippets = readJson("snippets/wio.json");
  assert.match(snippets["Typed Attribute"].body.join("\n"), /retain/);
  assert.ok(snippets["Textual Const Generic"].body.join("\n").includes("const ${2:Name}: ${3:string}"));
  assert.match(snippets["Fixed Array Inferred Extent"].body.join("\n"), /; _\]/);
  assert.match(snippets["Guarded Match Arm"].body.join("\n"), / if /);
  assert.match(snippets["Scheduled Application Resource"].body.join("\n"), /run simulation\.update\(ref self\.world\)/);
  assert.match(snippets["Cancellation-aware File Read"].body.join("\n"), /ReadTextAsync\(path, token\)/);
});

test("highlights byte and Unicode interpolated strings independently", () => {
  const grammar = readJson("syntaxes/wio.tmLanguage.json");
  const unicode = findNamedPattern(grammar, "string.quoted.double.unicode.wio");
  const interpolated = findNamedPattern(grammar, "string.quoted.double.unicode.interpolated.wio");

  assert.equal(unicode.begin, 'u"');
  assert.equal(interpolated.begin, 'u\\$"');
  assert.ok(interpolated.patterns.some((pattern) => pattern.include === "#interpolation"));
  assert.match(grammar.repository.types.patterns[0].match, /text/);
});

test("highlights canonical bracket attributes and retains legacy migration input", () => {
  const grammar = readJson("syntaxes/wio.tmLanguage.json");
  const bracket = findNamedPattern(grammar, "meta.attribute.bracket.wio");
  const legacy = findNamedPattern(grammar, "punctuation.definition.annotation.wio");

  assert.match(bracket.begin, /\\\[/);
  assert.equal(bracket.end, "(\\])");
  assert.ok(legacy);

  const snippets = readJson("snippets/wio.json");
  const nativeFunction = snippets["Native Function"].body.join("\n");
  assert.match(nativeFunction, /^\[Native, CppName/);
  assert.doesNotMatch(nativeFunction, /\bwith\b/);
});
