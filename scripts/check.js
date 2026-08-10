"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
for (const file of ["package.json", "language-configuration.json", "syntaxes/wio.tmLanguage.json", "snippets/wio.json"]) {
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

const jsFiles = [];
for (const folder of ["src", "scripts", "test"]) {
  const directory = path.join(root, folder);
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory)) if (name.endsWith(".js")) jsFiles.push(path.join(directory, name));
}
for (const file of jsFiles) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}
console.log(`Validated ${jsFiles.length} JavaScript files and extension JSON manifests.`);
