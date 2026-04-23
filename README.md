# Wio VS Code Extension

This repository contains the first standalone VS Code extension scaffold for Wio.

Current scope:

- `.wio` file association
- light/dark file icons for `.wio`
- bracket and comment configuration
- first-pass syntax highlighting
- starter snippets
- command palette integration for Wio compiler actions
- basic diagnostics by running `wio <file> --dry-run`
- direct run support for entry-bearing files

## Included Commands

- `Wio: Check Current File`
- `Wio: Run Current File`
- `Wio: Emit Generated C++`
- `Wio: Show Backend Info`
- `Wio: Clear Diagnostics`

## Default Shortcuts

- `Ctrl+Alt+W`: check current file
- `Ctrl+Alt+R`: run current file
- `Ctrl+Alt+E`: emit generated C++
- `Ctrl+Alt+B`: show backend info

On macOS the same bindings use `Cmd+Alt+...`.

The editor title bar buttons also use codicon-based action icons now, so they should look much cleaner than plain text buttons.

## Settings

- `wio.executable`
  Use this when `wio` is not already on `PATH`.
- `wio.defaultArgs`
  Extra compiler args to append to every command.
- `wio.enableDiagnosticsOnSave`
  Re-check the current `.wio` file after save.
- `wio.enableDiagnosticsOnOpen`
  Re-check the current `.wio` file when opened.
- `wio.showOutputOnSuccess`
  Reveal the Wio output channel even when a command succeeds.
- `wio.runArgs`
  Extra arguments appended after `--run`.

## Local Development

No build step is required right now.

1. Open this folder in VS Code.
2. Press `F5`.
3. In the Extension Development Host, open a `.wio` file.
4. Use the title-bar buttons, Command Palette, or the default shortcuts above.

A ready-to-use launch config already exists in:

- `.vscode/launch.json`

## Current Limits

This is intentionally a first useful slice, not the full editor story yet.

Still missing:

- hover, completion, go-to-definition
- LSP-backed semantic understanding
- formatter integration
- test explorer integration
- richer diagnostic parsing for non-file backend diagnostics

## Suggested Next Steps

- add richer grammar scopes and themes
- improve diagnostics parsing and stale cleanup behavior
- add a tiny `wio check` / `wio emit-cpp` task provider
- move toward a proper Wio language server when compiler JSON diagnostics are ready
