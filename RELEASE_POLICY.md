# Wio Extension Release Policy

The VS Code extension follows the Wio compiler version beginning with `0.11.0`.

- Extension `0.11.x` targets compiler and standard library `0.11.x`.
- A new Wio major or minor release receives an extension release with the same
  major and minor version.
- The matching `.0` extension is prepared as part of the compiler release
  freeze, not as a later follow-up.
- Patch releases stay aligned whenever grammar, diagnostics, CLI behavior, or
  editor metadata changes. An editor-only emergency patch may advance first,
  but compatibility remains within the same major/minor line.
- The extension test suite and VSIX package check are release gates for Wio.

For example, Wio `0.13.0` and its language surface must ship alongside
`wio-vscode 0.13.0`.
