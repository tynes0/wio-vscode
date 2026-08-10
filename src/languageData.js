"use strict";

const KEYWORDS = [
  "and", "application", "as", "assumed", "async", "attribute", "await",
  "break", "component", "conflicts", "const", "continue", "coroutine",
  "during", "else", "enum", "every", "extension", "false", "fit", "flag",
  "flagset", "fn", "for", "foreach", "if", "in", "interface", "is", "let",
  "loop", "match", "mut", "native", "none", "not", "object", "on", "opaque",
  "or", "private", "protected", "public", "realm", "ref", "repeatable",
  "retain", "return", "scoped", "self", "system", "thread", "true", "type",
  "using", "view", "when", "where", "while", "with", "yield"
];

const TYPES = [
  "bool", "byte", "char", "f32", "f64", "i8", "i16", "i32", "i64",
  "isize", "object", "string", "u8", "u16", "u32", "u64", "uchar", "usize", "void"
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
  "std::json::Value": "JSON value with parse, inspection, and writing support.",
  "std::async::Task<T>": "Asynchronous result that can be polled or awaited.",
  "std::async::CancellationSource": "Cooperative cancellation source and token owner.",
  "std::time::Instant": "Monotonic time point for duration measurement."
};

const ATTRIBUTES = {
  "cpp::header": "Includes a C++ header for a declaration or compilation unit.",
  "cpp::name": "Maps a Wio declaration to its native C++ name.",
  "cpp::opaque": "Marks a native value as opaque to Wio.",
  "native": "Declares a native-backed type or callable.",
  "default": "Applies default visibility or declaration policy.",
  "generate_ctors": "Requests generated component constructors.",
  "retain": "Keeps an attribute available for reflection.",
  "repeatable": "Allows an attribute to occur multiple times.",
  "scoped": "Restricts an attribute to its declared target kinds."
};

const DOCS = {
  application: "Defines the process lifecycle. Use `on start`, `on update`, and `on close` blocks.",
  system: "Defines stack-resident application behavior with ordered lifecycle participation.",
  async: "Marks a function or method as asynchronous.",
  await: "Suspends the current async flow until the awaited operation completes.",
  coroutine: "Defines or names a resumable computation.",
  attribute: "Declares a typed user attribute usable through `with` or `using`.",
  extension: "Adds externally implemented member-style behavior to a component or type.",
  with: "Attaches modern postfix attributes to a declaration.",
  using: "Applies a compilation-unit or import-oriented attribute.",
  match: "Pattern-matches enums, Option, Result, and other supported values.",
  ref: "A mutable borrowed reference.",
  view: "A read-only borrowed view."
};

module.exports = { KEYWORDS, TYPES, BUILTINS, ATTRIBUTES, DOCS };
