"use strict";

const path = require("node:path");
const { parseDocument } = require("./sourceModel");

const OPERATIONS = Object.freeze({
  CHECK: "check",
  RUN: "run",
  EMIT_CPP: "emitCpp",
  BACKEND_INFO: "backendInfo"
});

function hasExecutableEntry(source) {
  return parseDocument(String(source || "")).declarations.some((declaration) =>
    !declaration.parent && ((declaration.kind === "fn" && declaration.name === "Entry") || declaration.kind === "application")
  );
}

function hasArgument(args, name) {
  return args.some((arg, index) => arg === name || (index > 0 && args[index - 1] === name));
}

function withStandaloneTarget(args, target) {
  if (hasArgument(args, "--target")) return [...args];
  return [...args, "--target", target];
}

function standaloneTarget(source, configuration = {}) {
  const configured = configuration.standaloneTarget || "auto";
  if (configured !== "auto") return configured;
  return hasExecutableEntry(source) ? "exe" : "static";
}

function planProject(operation, project, configuration) {
  const common = [...(configuration.projectArgs || [])];
  const base = ["project"];
  if (operation === OPERATIONS.CHECK || operation === OPERATIONS.EMIT_CPP) {
    const args = [...base, "build", "--project", project.manifestPath, ...common];
    if (operation === OPERATIONS.EMIT_CPP) args.push("--emit-cpp");
    return { mode: "project", operation, args, cwd: project.root, project, diagnosticScope: project.manifestPath };
  }
  if (operation === OPERATIONS.RUN) {
    if (project.metadata && project.metadata.target !== "exe" && !project.metadata.hostEnabled) {
      return {
        mode: "project", operation, cwd: project.root, project, diagnosticScope: project.manifestPath,
        blocked: true,
        message: `Project target '${project.metadata.target}' is a library and has no enabled host executable. Build it, or enable a host target before running.`
      };
    }
    const args = [...base, "run", "--project", project.manifestPath, ...common];
    if (configuration.runArgs?.length) args.push("--", ...configuration.runArgs);
    return { mode: "project", operation, args, cwd: project.root, project, diagnosticScope: project.manifestPath };
  }
  return {
    mode: "project", operation,
    args: [...base, "describe", "--project", project.manifestPath, ...common],
    cwd: project.root, project, diagnosticScope: project.manifestPath
  };
}

function planStandalone(operation, filePath, source, configuration) {
  const cwd = path.dirname(filePath);
  const target = standaloneTarget(source, configuration);
  const compilerArgs = withStandaloneTarget(
    [...(configuration.defaultArgs || []), ...(configuration.standaloneArgs || [])], target
  );
  const base = { mode: "standalone", operation, cwd, filePath, target, diagnosticScope: filePath };
  if (operation === OPERATIONS.RUN && target !== "exe") {
    return {
      ...base,
      blocked: true,
      message: "This file has no Entry function or application declaration, so it is treated as a library. Add an entry point, select standalone target 'exe', or run it through a Wio project manifest."
    };
  }
  if (operation === OPERATIONS.CHECK) return { ...base, args: ["file", "check", filePath, ...compilerArgs] };
  if (operation === OPERATIONS.RUN) {
    const args = ["file", "run", filePath, ...compilerArgs];
    if (configuration.runArgs?.length) args.push("--", ...configuration.runArgs);
    return { ...base, args };
  }
  if (operation === OPERATIONS.EMIT_CPP) return { ...base, args: [filePath, ...compilerArgs, "--emit-cpp"] };
  return { ...base, args: [filePath, ...compilerArgs, "--show-backend-info", "--dry-run"] };
}

function planInvocation({ operation, filePath, source, project, configuration = {} }) {
  if (!Object.values(OPERATIONS).includes(operation)) throw new Error(`Unknown Wio operation: ${operation}`);
  return project
    ? planProject(operation, project, configuration)
    : planStandalone(operation, filePath, source, configuration);
}

module.exports = {
  OPERATIONS,
  hasExecutableEntry,
  planInvocation,
  standaloneTarget,
  withStandaloneTarget
};
