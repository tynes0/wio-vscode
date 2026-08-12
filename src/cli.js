"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");

function quoteForDisplay(value) {
  const text = String(value);
  return /[\s"]/u.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function buildFileArgs(action, file, configuration = {}) {
  const args = ["file", action, file, ...(configuration.defaultArgs || [])];
  if (action === "run" && configuration.runArgs?.length) args.push("--", ...configuration.runArgs);
  return args;
}

function buildProjectArgs(action, root, configuration = {}) {
  const args = ["project", action, "--project", root, ...(configuration.projectArgs || [])];
  if (action === "run" && configuration.runArgs?.length) args.push("--", ...configuration.runArgs);
  return args;
}

class WioCli {
  constructor(vscode, output) {
    this.vscode = vscode;
    this.output = output;
    this.running = new Map();
  }

  configuration(scope) {
    const config = this.vscode.workspace.getConfiguration("wio", scope);
    return {
      executable: config.get("executable", "wio"),
      defaultArgs: config.get("defaultArgs", []),
      runArgs: config.get("runArgs", []),
      standaloneArgs: config.get("standalone.compilerArgs", []),
      standaloneTarget: config.get("standalone.target", "auto"),
      projectArgs: config.get("project.commandArgs", []),
      showOutputOnSuccess: config.get("showOutputOnSuccess", false),
      trace: config.get("trace.server", "off")
    };
  }

  async file(action, document, extra = [], options = {}) {
    const config = this.configuration(document.uri);
    const args = buildFileArgs(action, document.uri.fsPath, config);
    args.push(...extra);
    return this.run(args, path.dirname(document.uri.fsPath), { ...options, activeFile: document.uri.fsPath, resourceUri: document.uri });
  }

  async project(action, root, options = {}) {
    const config = this.configuration(this.vscode.Uri?.file(root));
    return this.run(buildProjectArgs(action, root, config), root, { ...options, resourceUri: this.vscode.Uri?.file(root) });
  }

  async invoke(plan, options = {}) {
    if (plan.blocked) return { code: -1, blocked: true, output: plan.message, args: [], cwd: plan.cwd };
    return this.run(plan.args, plan.cwd, { ...options, activeFile: plan.filePath });
  }

  async doctor(root) {
    return this.run(["env", "doctor", ...(root ? ["--wio-root", root] : [])], root, { resourceUri: root ? this.vscode.Uri?.file(root) : undefined });
  }

  async run(args, cwd, options = {}) {
    const config = this.configuration(options.resourceUri);
    const executable = config.executable || "wio";
    const key = options.key;
    if (key) this.cancel(key);
    this.output.appendLine(`\n> ${quoteForDisplay(executable)} ${args.map(quoteForDisplay).join(" ")}`);
    this.output.appendLine(`  cwd: ${cwd || process.cwd()}`);

    const result = await new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let child;
      try {
        child = childProcess.spawn(executable, args, {
          cwd: cwd || undefined,
          windowsHide: true,
          shell: false,
          env: process.env
        });
      } catch (error) {
        resolve({ code: -1, stdout, stderr: String(error), error });
        return;
      }
      if (key) this.running.set(key, child);
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); this.output.append(chunk.toString()); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); this.output.append(chunk.toString()); });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        resolve({ code: -1, stdout, stderr: `${stderr}${error.message}`, error });
      });
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        resolve({ code: code ?? -1, signal, stdout, stderr });
      });
    });
    if (key) this.running.delete(key);
    const output = `${result.stdout}${result.stderr}`;
    if (result.code !== 0 || config.showOutputOnSuccess || options.reveal) this.output.show(true);
    return { ...result, output, executable, args, cwd };
  }

  cancel(key) {
    const child = this.running.get(key);
    if (child && !child.killed) child.kill();
    this.running.delete(key);
  }

  dispose() {
    for (const child of this.running.values()) if (!child.killed) child.kill();
    this.running.clear();
  }
}

module.exports = { WioCli, buildFileArgs, buildProjectArgs, quoteForDisplay };
