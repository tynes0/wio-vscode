const vscode = require("vscode");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let outputChannel;
let diagnostics;

function activate(context) {
    outputChannel = vscode.window.createOutputChannel("Wio");
    diagnostics = vscode.languages.createDiagnosticCollection("wio");

    context.subscriptions.push(outputChannel, diagnostics);

    context.subscriptions.push(
        vscode.commands.registerCommand("wio.checkCurrentFile", async () => {
            const document = getActiveWioDocument();
            if (!document) {
                vscode.window.showWarningMessage("Open a .wio file first.");
                return;
            }

            await runWioForDocument(document, ["--dry-run"], {
                reason: "check",
                updateDiagnostics: true,
                showOutputOnSuccess: getConfiguration().get("showOutputOnSuccess", false)
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("wio.emitCppCurrentFile", async () => {
            const document = getActiveWioDocument();
            if (!document) {
                vscode.window.showWarningMessage("Open a .wio file first.");
                return;
            }

            const result = await runWioForDocument(document, ["--emit-cpp"], {
                reason: "emit-cpp",
                updateDiagnostics: false,
                showOutputOnSuccess: getConfiguration().get("showOutputOnSuccess", false)
            });

            if (!result || result.code !== 0) {
                return;
            }

            const generatedPath = `${document.uri.fsPath}.cpp`;
            const choice = await vscode.window.showInformationMessage(
                `Generated C++: ${generatedPath}`,
                "Open File",
                "Show Output"
            );

            if (choice === "Open File" && fs.existsSync(generatedPath)) {
                const generatedDocument = await vscode.workspace.openTextDocument(generatedPath);
                await vscode.window.showTextDocument(generatedDocument, { preview: false });
            } else if (choice === "Show Output") {
                outputChannel.show(true);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("wio.showBackendInfoCurrentFile", async () => {
            const document = getActiveWioDocument();
            if (!document) {
                vscode.window.showWarningMessage("Open a .wio file first.");
                return;
            }

            await runWioForDocument(document, ["--show-backend-info", "--dry-run"], {
                reason: "backend-info",
                updateDiagnostics: false,
                showOutputOnSuccess: true
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("wio.clearDiagnostics", () => {
            diagnostics.clear();
            vscode.window.showInformationMessage("Wio diagnostics cleared.");
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (!getConfiguration().get("enableDiagnosticsOnOpen", true)) {
                return;
            }

            await maybeCheckDocument(document, "open");
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (!getConfiguration().get("enableDiagnosticsOnSave", true)) {
                return;
            }

            await maybeCheckDocument(document, "save");
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            if (isWioDocument(document)) {
                diagnostics.delete(document.uri);
            }
        })
    );

    if (getConfiguration().get("enableDiagnosticsOnOpen", true)) {
        const activeDocument = getActiveWioDocument();
        if (activeDocument) {
            void maybeCheckDocument(activeDocument, "startup");
        }
    }
}

function deactivate() {
}

function getConfiguration() {
    return vscode.workspace.getConfiguration("wio");
}

function getActiveWioDocument() {
    const document = vscode.window.activeTextEditor?.document;
    return isWioDocument(document) ? document : null;
}

function isWioDocument(document) {
    return Boolean(document) && document.languageId === "wio" && document.uri.scheme === "file";
}

async function maybeCheckDocument(document, trigger) {
    if (!isWioDocument(document)) {
        return;
    }

    await runWioForDocument(document, ["--dry-run"], {
        reason: trigger,
        updateDiagnostics: true,
        showOutputOnSuccess: false
    });
}

function getExecutableName() {
    const configured = getConfiguration().get("executable", "").trim();
    if (configured.length > 0) {
        return configured;
    }

    return process.platform === "win32" ? "wio.exe" : "wio";
}

function getDefaultArgs() {
    const args = getConfiguration().get("defaultArgs", []);
    if (!Array.isArray(args)) {
        return [];
    }

    return args.filter((value) => typeof value === "string" && value.length > 0);
}

function getWorkingDirectory(document) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
        return workspaceFolder.uri.fsPath;
    }

    return path.dirname(document.uri.fsPath);
}

function buildArguments(document, extraArgs) {
    const defaultArgs = getDefaultArgs();
    const mergedArgs = [...defaultArgs];

    for (const extraArg of extraArgs) {
        if (!mergedArgs.includes(extraArg)) {
            mergedArgs.push(extraArg);
        }
    }

    return [document.uri.fsPath, ...mergedArgs];
}

async function runWioForDocument(document, extraArgs, options) {
    const executable = getExecutableName();
    const args = buildArguments(document, extraArgs);
    const cwd = getWorkingDirectory(document);

    outputChannel.appendLine(`[wio:${options.reason}] ${executable} ${args.join(" ")}`);
    outputChannel.appendLine(`[cwd] ${cwd}`);

    let result;
    try {
        result = await spawnProcess(executable, args, cwd);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(message);
        outputChannel.show(true);
        vscode.window.showErrorMessage(message);
        return null;
    }

    const combinedOutput = `${result.stdout}${result.stderr}`;
    if (combinedOutput.trim().length > 0) {
        outputChannel.appendLine(combinedOutput.trimEnd());
    }
    outputChannel.appendLine(`[exit code] ${result.code}`);
    outputChannel.appendLine("");

    if (options.updateDiagnostics) {
        updateDiagnosticsFromOutput(combinedOutput);
    }

    if (result.code !== 0) {
        outputChannel.show(true);
        vscode.window.showErrorMessage(`Wio ${options.reason} failed.`);
        return result;
    }

    if (options.showOutputOnSuccess) {
        outputChannel.show(true);
    }

    return result;
}

function spawnProcess(executable, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn(executable, args, {
            cwd,
            shell: false
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            reject(new Error(`Failed to start '${executable}'. Set 'wio.executable' if the compiler is not on PATH. ${error.message}`));
        });

        child.on("close", (code) => {
            resolve({
                code: typeof code === "number" ? code : -1,
                stdout,
                stderr
            });
        });
    });
}

function updateDiagnosticsFromOutput(output) {
    diagnostics.clear();

    const diagnosticsByFile = new Map();
    const lines = output.split(/\r?\n/);

    for (const line of lines) {
        const parsed = tryParseDiagnosticLine(line);
        if (!parsed) {
            continue;
        }

        const key = parsed.uri.fsPath;
        const existing = diagnosticsByFile.get(key) ?? [];
        existing.push(parsed.diagnostic);
        diagnosticsByFile.set(key, existing);
    }

    for (const [filePath, fileDiagnostics] of diagnosticsByFile.entries()) {
        diagnostics.set(vscode.Uri.file(filePath), fileDiagnostics);
    }
}

function tryParseDiagnosticLine(line) {
    const match = /^(Error|Warning|Note)\s+\[([^\]]+)\]:\s*(.+)$/.exec(line.trim());
    if (!match) {
        return null;
    }

    const severityText = match[1];
    const label = match[2];
    const message = match[3];
    const location = parseLocationLabel(label);
    if (!location) {
        return null;
    }

    const range = new vscode.Range(
        Math.max(0, location.line - 1),
        Math.max(0, location.column - 1),
        Math.max(0, location.line - 1),
        Math.max(0, location.column)
    );

    const diagnostic = new vscode.Diagnostic(range, message, toSeverity(severityText));
    diagnostic.source = "wio";

    return {
        uri: vscode.Uri.file(location.filePath),
        diagnostic
    };
}

function parseLocationLabel(label) {
    if (label === "cli" || label === "compiler" || label.startsWith("backend:")) {
        return null;
    }

    let filePath = label;
    let line = 1;
    let column = 1;

    let match = /^(.*):(\d+):(\d+)$/.exec(label);
    if (match) {
        filePath = match[1];
        line = Number(match[2]);
        column = Number(match[3]);
    } else {
        match = /^(.*):(\d+)$/.exec(label);
        if (match) {
            filePath = match[1];
            line = Number(match[2]);
        }
    }

    const normalizedPath = path.normalize(filePath);
    if (!path.isAbsolute(normalizedPath) || !fs.existsSync(normalizedPath)) {
        return null;
    }

    return {
        filePath: normalizedPath,
        line,
        column
    };
}

function toSeverity(severityText) {
    switch (severityText) {
    case "Warning":
        return vscode.DiagnosticSeverity.Warning;
    case "Note":
        return vscode.DiagnosticSeverity.Information;
    default:
        return vscode.DiagnosticSeverity.Error;
    }
}

module.exports = {
    activate,
    deactivate
};
