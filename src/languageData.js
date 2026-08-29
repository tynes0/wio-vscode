"use strict";

const KEYWORDS = [
  "after", "and", "application", "as", "assumed", "async", "attribute", "await",
  "before", "break", "component", "conflicts", "const", "continue", "coroutine",
  "during", "else", "enum", "every", "extension", "false", "fit", "fixed", "flag",
  "flagset", "fn", "for", "foreach", "if", "in", "interface", "is", "let",
  "loop", "match", "mut", "native", "none", "not", "object", "on", "opaque",
  "or", "private", "protected", "public", "realm", "ref", "repeatable", "resource",
  "retain", "return", "run", "schedule", "scoped", "self", "spawn", "stage", "system", "thread", "true", "type",
  "using", "view", "when", "where", "while", "with", "yield"
];

const TYPES = [
  "bool", "byte", "char", "f32", "f64", "i8", "i16", "i32", "i64",
  "isize", "object", "string", "text", "u8", "u16", "u32", "u64", "uchar", "usize", "void"
];

const BUILTINS = {
  "std::Option<T>": "Optional value. Match with Some(value) and None.",
  "std::Result<T>": "Fallible result. Match with Ok(value) and Err(message).",
  "std::ResultUnit": "Successful unit result alias used by operations without a value.",
  "std::Vector<T>": "Growable contiguous collection.",
  "std::Span<T>": "Non-owning contiguous view.",
  "std::Queue<T>": "FIFO collection.",
  "std::Set<T>": "Ordered unique-value collection.",
  "std::UnorderedSet<T>": "Hash-backed unique-value collection.",
  "std::Tuple": "Fixed-size heterogeneous values.",
  "std::json::Value": "JSON value with exact numeric tokens, checked integer accessors, parse, inspection, and writing support.",
  "std::serialization::Codec<TValue, TWire>": "Typed checked encoder/decoder pair for composing serialization boundaries.",
  "std::unicode::NormalizationForm": "Unicode 17 NFC, NFD, NFKC, or NFKD normalization form.",
  "std::regex::Match": "Bounded regex match record with byte offsets and captures.",
  "std::async::Task<T>": "Asynchronous result that can be polled or awaited.",
  "std::async::CancellationSource": "Cooperative cancellation source and token owner.",
  "std::async::CancellationToken": "Copyable cooperative cancellation signal accepted by async I/O.",
  "std::time::Instant": "Monotonic time point for duration measurement."
};

const ATTRIBUTES = {
  "CppHeader": "Includes a C++ header for a declaration.",
  "CppName": "Maps a Wio declaration to its native C++ name.",
  "cpp::opaque": "Marks a native value as opaque to Wio.",
  "Native": "Declares a native-backed type or callable.",
  "Export": "Exports a narrow C ABI entry point for native hosts.",
  "default": "Applies default visibility or declaration policy.",
  "generate_ctors": "Requests generated component constructors.",
  "attribute::Targets": "Narrows the valid declaration targets.",
  "attribute::Processor": "Attaches one checked processor phase.",
  "attribute::Requires": "Requires effective companion attributes.",
  "attribute::RequiresAny": "Requires at least one companion attribute.",
  "attribute::Conflicts": "Rejects incompatible effective attributes.",
  "attribute::OnlyWith": "Restricts the effective companion set.",
  "attribute::Before": "Orders a processor before named attributes.",
  "attribute::After": "Orders an attribute processor or application stage after a named dependency.",
  "Start": "Binds a descriptive application or system function to the start lifecycle.",
  "Update": "Binds a descriptive application or system function to the per-frame update lifecycle.",
  "Close": "Binds a descriptive application or system function to the close lifecycle.",
  "Fixed": "Runs an application stage at a positive fixed frequency.",
  "After": "Orders an application stage after a named function or system field.",
  "Main": "Requires an application stage to run on the main thread.",
  "Worker": "Reserved for conflict-checked worker scheduling; rejected in Wio 0.17."
};

const DOCS = {
  application: "Defines one stack-resident process root. Wio 0.17 uses ordinary fields/functions plus lifecycle and schedule attributes.",
  system: "Defines stack-resident application behavior using ordinary fields and Start/Update/Close functions.",
  resource: "Legacy v0.16 spelling for application-owned state used by explicit resource-injection schedules.",
  schedule: "Legacy v0.16 explicit schedule; new stages use [Fixed], [After], and [Main] on application functions.",
  async: "Marks a function or method as asynchronous.",
  await: "Suspends the current async flow until the awaited operation completes.",
  coroutine: "Defines or names a resumable computation.",
  spawn: "Starts a child task owned by the nearest lexical async scope.",
  attribute: "Declares a typed user attribute applied with `[Attribute]` or activated with `using`.",
  extension: "Adds externally implemented member-style behavior to a component or type.",
  with: "Legacy postfix attribute migration input; prefer `[Attribute]`.",
  using: "Applies a compilation-unit or import-oriented attribute.",
  match: "Pattern-matches enums, Option, Result, and other supported values.",
  ref: "A mutable borrowed reference.",
  view: "A read-only borrowed view."
};

module.exports = { KEYWORDS, TYPES, BUILTINS, ATTRIBUTES, DOCS };
