"use strict";

const { parseDocument } = require("./sourceModel");

class WorkspaceIndex {
  constructor(vscode, output) {
    this.vscode = vscode;
    this.output = output;
    this.documents = new Map();
    this.byName = new Map();
    this.ready = false;
  }

  async rebuild() {
    this.ready = false;
    this.documents.clear();
    this.byName.clear();
    const config = this.vscode.workspace.getConfiguration("wio");
    const maxFiles = config.get("index.maxFiles", 4000);
    const uris = await this.vscode.workspace.findFiles(
      "**/*.wio",
      "**/{.git,.wio-build,.wio-qualification,node_modules,artifacts,build,dist}/**",
      maxFiles
    );
    await Promise.all(uris.map(async (uri) => {
      try {
        await this.updateUri(uri);
      } catch (error) {
        this.output.appendLine(`[index] ${uri.fsPath}: ${error.message}`);
      }
    }));
    this.ready = true;
    this.output.appendLine(`[index] ${this.documents.size} Wio file(s), ${[...this.byName.values()].reduce((n, v) => n + v.length, 0)} declaration(s).`);
  }

  update(document) {
    if (document.languageId !== "wio") return;
    return this.updateText(document.uri, document.getText());
  }

  updateText(uri, text) {
    this.remove(uri.toString());
    const model = parseDocument(text, uri.fsPath);
    model.uri = uri;
    this.documents.set(uri.toString(), model);
    for (const declaration of model.declarations) {
      declaration.uri = uri;
      const bucket = this.byName.get(declaration.name) || [];
      bucket.push(declaration);
      this.byName.set(declaration.name, bucket);
    }
    return model;
  }

  async updateUri(uri) {
    const bytes = await this.vscode.workspace.fs.readFile(uri);
    return this.updateText(uri, Buffer.from(bytes).toString("utf8"));
  }

  remove(key) {
    const old = this.documents.get(key);
    if (!old) return;
    for (const declaration of old.declarations) {
      const bucket = (this.byName.get(declaration.name) || []).filter((item) => item.uri.toString() !== key);
      if (bucket.length) this.byName.set(declaration.name, bucket); else this.byName.delete(declaration.name);
    }
    this.documents.delete(key);
  }

  model(document) {
    return this.documents.get(document.uri.toString()) || this.update(document);
  }

  find(name) { return this.byName.get(name) || []; }
  all() { return [...this.documents.values()].flatMap((model) => model.declarations); }
  dispose() { this.documents.clear(); this.byName.clear(); }
}

module.exports = { WorkspaceIndex };
