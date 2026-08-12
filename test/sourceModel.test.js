"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { maskTrivia, parseDocument, parseParameters, splitTopLevel, wordAt } = require("../src/sourceModel");

test("masks nested-looking text without changing offsets", () => {
  const source = "fn Real() {} // fn Fake() {}\nlet text = \"object Nope {}\";";
  const masked = maskTrivia(source);
  assert.equal(masked.length, source.length);
  assert.match(masked, /fn Real/);
  assert.doesNotMatch(masked, /Fake|Nope/);
});

test("indexes v0.11 applications, systems, attributes, and async methods", () => {
  const source = `
attribute persisted(key: string) for field retain;
system Loader {
    async fn Scan(path: string) -> std::Result<string> { return std::Ok<string>(path); }
}
application Desk {
    on update { }
}
`;
  const model = parseDocument(source, "app.wio");
  assert.deepEqual(model.declarations.map((item) => [item.kind, item.name]), [
    ["attribute", "persisted"], ["system", "Loader"], ["fn", "Scan"], ["application", "Desk"]
  ]);
  const scan = model.declarations[2];
  assert.equal(scan.async, true);
  assert.equal(scan.parent, "Loader");
  assert.equal(scan.parameters[0].type, "string");
  assert.equal(scan.returnType, "std::Result<string>");
});

test("splits generic parameter lists at top level", () => {
  assert.deepEqual(splitTopLevel("left: std::Result<string>, items: std::Vector<i32>"), ["left: std::Result<string>", "items: std::Vector<i32>"]);
  assert.equal(parseParameters("value: ref Thing")[0].type, "ref Thing");
});

test("finds identifiers at offsets", () => {
  assert.deepEqual(wordAt("std::async::Run", 13), { text: "Run", start: 12, end: 15 });
});
