# Wio Language Support

The official editing companion for Wio `0.11.x`. The extension follows the
compiler's release line and understands the modern application, async,
attribute, interop, and standard-library surfaces introduced by Wio 0.11.

## What You Get

- syntax highlighting for `application`, `system`, lifecycle blocks,
  `async`/`await`/`coroutine`, typed attributes, and modern native declarations
- compiler diagnostics on open and save, mapped back to the originating Wio
  source file
- completion for language keywords, primitive and standard-library types,
  attributes, and declarations in the current workspace
- hover, go to definition, references, signature help, document outline, and
  workspace symbols backed by an incremental Wio source index
- commands for checking/running a file, emitting C++, inspecting the backend,
  building/running/testing a project, and running `wio env doctor`
- v0.11 snippets for applications, systems, async functions, typed attributes,
  Result/Option matches, component extensions, and native bridges

## Requirements

Install Wio `0.11.x` and make `wio` available on `PATH`, or set
`wio.executable` to its full path.

## Commands

Open the Command Palette and search for **Wio**:

| Command | CLI operation |
| --- | --- |
| Check Current File | `wio file check <file>` |
| Run Current File | `wio file run <file> -- <args>` |
| Emit Generated C++ | `wio file check <file> --emit-cpp` |
| Show Backend Information | `wio file check <file> --show-backend-info` |
| Build Project | `wio project build --project <root>` |
| Run Project | `wio project run --project <root> -- <args>` |
| Test Project | `wio project test --project <root>` |
| Run Environment Doctor | `wio env doctor` |
| Restart Workspace Index | Rebuilds editor navigation data |

The nearest `wio.makewio`, `makewio`, or `wio.project.json` determines the
project root.

## Settings

- `wio.executable`: executable path or command (`wio` by default)
- `wio.defaultArgs`: extra compiler or project arguments for each invocation
- `wio.runArgs`: application arguments forwarded after `--`
- `wio.enableDiagnosticsOnOpen` / `wio.enableDiagnosticsOnSave`
- `wio.diagnosticsDebounceMs`: automatic-check delay
- `wio.index.maxFiles`: workspace index safety limit
- `wio.showOutputOnSuccess`: reveal successful compiler output
- `wio.trace.server`: extension-side diagnostic verbosity

## Development

```powershell
npm install
npm run check
npm test
npm run package
```

Press `F5` in VS Code to open an Extension Development Host.

See [RELEASE_POLICY.md](./RELEASE_POLICY.md) for compiler/extension versioning.

## License

MIT
