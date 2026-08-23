# Changelog

## 0.14.0

- Aligned extension/package metadata with the Wio 0.14 release line.
- Added completion/hover descriptions for exact JSON numbers, typed
  serialization codecs, Unicode normalization forms, and bounded regex match
  records.
- Kept the 0.13 language grammar intact while advancing the standard-library
  and SDK value-parity vocabulary.

## 0.13.0

- Added Wio 0.13 Unicode `text` and `u"..."`/`u$"..."` grammar support.
- Added completion and snippets for compact/named typed attributes, textual
  const generics, fixed-array extent inference, and guarded match arms.
- Made the extension status/output version derive from package metadata and
  aligned all extension metadata with Wio 0.13.0.

## 0.12.0

- Added Wio 0.12 structured-concurrency highlighting, completion, hover, and
  an `async scope`/`spawn` snippet.
- Advanced extension/package metadata alongside the Wio 0.12 toolchain.

## 0.11.1

- Routed files owned by a makewio/JSON manifest through full project
  build/run/describe operations instead of losing native and source settings in
  single-file mode.
- Added explicit source-root membership so scratch files nested beside a
  project remain standalone.
- Standalone files without `Entry` now check as library targets; run is blocked
  with an actionable explanation rather than a fake entry-point diagnostic.
- Corrected C++ emission to avoid the invalid `file check --emit-cpp` pairing.
- Added project-scoped diagnostic replacement, run-time compile diagnostics,
  multi-root settings, and automatic project checks after native C/C++ saves.
- Added real compiler fixtures for multi-file Wio, native-header/native-source
  Wio+C++, standalone libraries, and standalone executables.

## 0.11.0

- Rebuilt the extension around separate CLI, diagnostics, project, index, and
  language-provider modules.
- Added Wio 0.11 application/system lifecycle, async/coroutine, typed attribute,
  modern native bridge, Option/Result, and standard-library language support.
- Added incremental workspace symbols, completion, hover, definition,
  references, signature help, and document outlines.
- Added project build/run/test, environment doctor, backend information, C++
  emission, index restart, and output commands.
- Added current snippets, deterministic tests, package validation, and explicit
  compiler-extension version synchronization.
