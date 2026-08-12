"use strict";

const { KEYWORDS, TYPES, BUILTINS, ATTRIBUTES, DOCS } = require("./languageData");

function symbolKind(vscode, kind) {
  const map = {
    fn: vscode.SymbolKind.Function,
    object: vscode.SymbolKind.Class,
    component: vscode.SymbolKind.Struct,
    interface: vscode.SymbolKind.Interface,
    enum: vscode.SymbolKind.Enum,
    flagset: vscode.SymbolKind.Enum,
    type: vscode.SymbolKind.TypeParameter,
    attribute: vscode.SymbolKind.Property,
    application: vscode.SymbolKind.Module,
    system: vscode.SymbolKind.Class,
    extension: vscode.SymbolKind.Namespace,
    realm: vscode.SymbolKind.Namespace
  };
  return map[kind] ?? vscode.SymbolKind.Variable;
}

function completionKind(vscode, kind) {
  return kind === "fn" ? vscode.CompletionItemKind.Function
    : ["realm", "application"].includes(kind) ? vscode.CompletionItemKind.Module
      : kind === "attribute" ? vscode.CompletionItemKind.Property
        : vscode.CompletionItemKind.Class;
}

function location(vscode, declaration) {
  return new vscode.Location(declaration.uri, new vscode.Range(
    declaration.selection.start.line, declaration.selection.start.character,
    declaration.selection.end.line, declaration.selection.end.character
  ));
}

function range(vscode, value) {
  return new vscode.Range(value.start.line, value.start.character, value.end.line, value.end.character);
}

function offsetAt(document, position) { return document.offsetAt(position); }

function wordAt(document, position) {
  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  return wordRange ? { range: wordRange, text: document.getText(wordRange) } : undefined;
}

function registerProviders(vscode, context, index) {
  const selector = { language: "wio" };

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, {
    provideCompletionItems(document, position) {
      const line = document.lineAt(position.line).text.slice(0, position.character);
      const items = [];
      for (const keyword of KEYWORDS) {
        const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
        item.detail = "Wio keyword";
        item.documentation = DOCS[keyword];
        items.push(item);
      }
      for (const type of TYPES) {
        const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
        item.detail = "Wio primitive type";
        items.push(item);
      }
      for (const [name, documentation] of Object.entries(BUILTINS)) {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
        item.filterText = name.replace(/<.*>/, "");
        item.detail = "Wio standard library";
        item.documentation = documentation;
        items.push(item);
      }
      if (/\b(?:with|using)\s+[A-Za-z0-9_:]*$/u.test(line)) {
        for (const [name, documentation] of Object.entries(ATTRIBUTES)) {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
          item.detail = "Wio attribute";
          item.documentation = documentation;
          items.push(item);
        }
      }
      for (const declaration of index.all()) {
        const item = new vscode.CompletionItem(declaration.name, completionKind(vscode, declaration.kind));
        item.detail = declaration.signature;
        item.documentation = declaration.file;
        items.push(item);
      }
      return items;
    }
  }, ":"));

  context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, {
    provideDefinition(document, position) {
      const word = wordAt(document, position);
      if (!word) return undefined;
      return index.find(word.text).map((declaration) => location(vscode, declaration));
    }
  }));

  context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position) {
      const word = wordAt(document, position);
      if (!word) return undefined;
      const declarations = index.find(word.text);
      if (declarations.length) {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(declarations[0].signature, "wio");
        if (declarations[0].file) markdown.appendMarkdown(`\nDefined in \`${declarations[0].file}\``);
        return new vscode.Hover(markdown, word.range);
      }
      if (DOCS[word.text]) return new vscode.Hover(new vscode.MarkdownString(DOCS[word.text]), word.range);
      return undefined;
    }
  }));

  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, {
    provideDocumentSymbols(document) {
      const model = index.model(document);
      const byName = new Map();
      const roots = [];
      for (const declaration of model.declarations) {
        const symbol = new vscode.DocumentSymbol(
          declaration.name, declaration.kind === "fn" ? declaration.signature : declaration.kind,
          symbolKind(vscode, declaration.kind), range(vscode, declaration.range), range(vscode, declaration.selection)
        );
        byName.set(declaration.qualifiedName, symbol);
        const parentName = declaration.qualifiedName.includes("::") ? declaration.qualifiedName.slice(0, declaration.qualifiedName.lastIndexOf("::")) : "";
        const parent = byName.get(parentName);
        if (parent) parent.children.push(symbol); else roots.push(symbol);
      }
      return roots;
    }
  }));

  context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider({
    provideWorkspaceSymbols(query) {
      const needle = query.toLowerCase();
      return index.all().filter((item) => item.name.toLowerCase().includes(needle)).map((item) =>
        new vscode.SymbolInformation(item.name, symbolKind(vscode, item.kind), item.kind, location(vscode, item))
      );
    }
  }));

  context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(selector, {
    provideSignatureHelp(document, position) {
      const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
      const call = prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)$/s);
      if (!call) return undefined;
      const declarations = index.find(call[1]).filter((item) => item.kind === "fn");
      if (!declarations.length) return undefined;
      const help = new vscode.SignatureHelp();
      help.activeSignature = 0;
      help.activeParameter = Math.max(0, call[2].split(",").length - 1);
      help.signatures = declarations.map((declaration) => {
        const info = new vscode.SignatureInformation(declaration.signature);
        info.parameters = declaration.parameters.map((parameter) => new vscode.ParameterInformation(parameter.name, parameter.type));
        return info;
      });
      return help;
    }
  }, "(", ","));

  context.subscriptions.push(vscode.languages.registerReferenceProvider(selector, {
    async provideReferences(document, position, contextInfo) {
      const word = wordAt(document, position);
      if (!word) return [];
      const results = contextInfo.includeDeclaration ? index.find(word.text).map((item) => location(vscode, item)) : [];
      for (const model of index.documents.values()) {
        const target = await vscode.workspace.openTextDocument(model.uri);
        const regex = new RegExp(`\\b${word.text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g");
        const text = target.getText();
        let match;
        while ((match = regex.exec(text))) {
          const start = target.positionAt(match.index);
          if (!contextInfo.includeDeclaration && model.declarations.some((item) => item.name === word.text && item.selection.start.line === start.line && item.selection.start.character === start.character)) continue;
          results.push(new vscode.Location(model.uri, new vscode.Range(start, target.positionAt(match.index + match[0].length))));
        }
      }
      return results;
    }
  }));
}

module.exports = { registerProviders, symbolKind };
