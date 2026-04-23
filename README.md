# Wio VS Code Extension

This repository contains the first standalone VS Code extension scaffold for Wio.

Current scope:

- `.wio` file association
- bracket and comment configuration
- first-pass syntax highlighting
- starter snippets
- command palette integration for Wio compiler actions
- basic diagnostics by running `wio <file> --dry-run`

## Included Commands

- `Wio: Check Current File`
- `Wio: Emit Generated C++`
- `Wio: Show Backend Info`
- `Wio: Clear Diagnostics`

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

## Local Development

No build step is required right now.

1. Open this folder in VS Code.
2. Press `F5`.
3. In the Extension Development Host, open a `.wio` file.
4. Run one of the Wio commands from the Command Palette.

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
