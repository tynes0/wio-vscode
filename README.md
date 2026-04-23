# Wio VS Code Extension

This is the minimal starting point for the separate Wio VS Code extension repo.

Included in this first small scaffold:

- `package.json`
- `language-configuration.json`
- `syntaxes/wio.tmLanguage.json`
- `README.md`

Current scope:

- `.wio` file association
- basic bracket/comment configuration
- first-pass syntax highlighting for keywords, attributes, strings, comments, numbers, and primitive types

Planned next steps:

- extension icon and publisher metadata
- snippets
- diagnostics wiring to `wio check`
- go-to-definition / hover / completion through an LSP layer
