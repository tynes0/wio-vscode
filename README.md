# Wio Language Support

The official editing companion for Wio `0.15.x`. The extension follows the
compiler's release line and understands the modern application, async,
attribute, Unicode `text`, generic, interop, and standard-library surfaces.

## What You Get

- syntax highlighting for `application`, `system`, lifecycle blocks,
  `async`/`await`/`coroutine`, typed attributes, and modern native declarations
- manifest-aware compiler diagnostics on open and save, mapped back to Wio or
  native C/C++ source files
- completion for language keywords, primitive and standard-library types,
  attributes, and declarations in the current workspace
- hover, go to definition, references, signature help, document outline, and
  workspace symbols backed by an incremental Wio source index
- commands for checking/running a file, emitting C++, inspecting the backend,
  building/running/testing a project, and running `wio env doctor`
- current snippets for applications, systems, async functions, compact typed
  attributes, Unicode text, textual const generics, guarded matches, inferred
  fixed arrays, component extensions, and native bridges

## Requirements

Install Wio `0.15.x` and make `wio` available on `PATH`, or set
`wio.executable` to its full path.

## Commands

Open the Command Palette and search for **Wio**:

| Command | Manifest project | Standalone file |
| --- | --- | --- |
| Check Current File | `wio project build --project <manifest>` | `wio file check <file>` |
| Run Current File | `wio project run --project <manifest>` | `wio file run <file>` |
| Emit Generated C++ | project rebuild/output | direct compiler `--emit-cpp` |
| Show Backend Information | `wio project describe` | direct compiler `--show-backend-info --dry-run` |
| Build/Run/Test Project | structured `wio project` command | not available |
| Run Environment Doctor | `wio env doctor` | `wio env doctor` |
| Restart Workspace Index | rebuilds editor navigation data | rebuilds editor navigation data |

The nearest `wio.makewio`, `makewio`, or `wio.project.json` determines the
project root. Files listed by its entry/source roots are always built through
the complete manifest, so include paths, native sources, link libraries,
output settings, host targets, and the real application entry remain intact.

A `.wio` file outside explicit manifest source roots is standalone. Standalone
files containing `Entry` or `application` are executable; other files are
checked as static libraries and do not receive a false missing-Entry error.
Trying to run such a library shows an explanation instead of invoking a broken
compile. Native standalone files can supply their own compiler flags through
`wio.standalone.compilerArgs`.

## Settings

- `wio.executable`: executable path or command (`wio` by default)
- `wio.defaultArgs`: compatibility compiler arguments for standalone files
- `wio.runArgs`: application arguments forwarded after `--`
- `wio.standalone.target`: `auto`, `exe`, `static`, or `shared`
- `wio.standalone.compilerArgs`: includes/native/link flags without a manifest
- `wio.project.commandArgs`: project-only configuration/build-directory flags
- `wio.project.checkOnNativeSave`: rebuild after C/C++ source/header saves
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

The checked-in pure-Wio, native C++/Wio, and standalone fixtures can also be
run against a real compiler:

```powershell
$env:WIO_TEST_EXECUTABLE = "C:\\Wio\\bin\\wio.exe"
$env:WIO_TEST_FORCE_REBUILD = "1" # optional packaged-toolchain qualification
npm run test:integration
```

Press `F5` in VS Code to open an Extension Development Host.

See [RELEASE_POLICY.md](./RELEASE_POLICY.md) for compiler/extension versioning.

## License

MIT
