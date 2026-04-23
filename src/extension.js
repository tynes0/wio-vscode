const vscode = require("vscode");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let outputChannel;
let diagnostics;
let symbolIndexCache = null;

const IGNORED_INDEX_PATH_SEGMENTS = [
    "/.git/",
    "/build/",
    "/build-",
    "/node_modules/",
    "/dist/"
];

const COLLECTION_ALIAS_KINDS = new Map([
    ["Array", "array"],
    ["DynArray", "array"],
    ["Dictionary", "dict"],
    ["Map", "dict"],
    ["OrderedDictionary", "tree"],
    ["OrderedMap", "tree"],
    ["TreeMap", "tree"]
]);

const BUILTIN_MEMBER_CATALOG = {
    string: [
        builtinMethod("Count", [], "usize"),
        builtinMethod("Empty", [], "bool"),
        builtinMethod("Contains", ["target: string"], "bool"),
        builtinMethod("ContainsChar", ["target: char"], "bool"),
        builtinMethod("StartsWith", ["prefix: string"], "bool"),
        builtinMethod("EndsWith", ["suffix: string"], "bool"),
        builtinMethod("IndexOf", ["target: string"], "usize"),
        builtinMethod("LastIndexOf", ["target: string"], "usize"),
        builtinMethod("IndexOfChar", ["target: char"], "usize"),
        builtinMethod("LastIndexOfChar", ["target: char"], "usize"),
        builtinMethod("GetOr", ["index: usize", "fallback: char"], "char"),
        builtinMethod("Last", [], "char"),
        builtinMethod("Slice", ["start: usize", "count?: usize"], "string"),
        builtinMethod("SliceFrom", ["start: usize"], "string"),
        builtinMethod("Take", ["count: usize"], "string"),
        builtinMethod("Skip", ["count: usize"], "string"),
        builtinMethod("Left", ["count: usize"], "string"),
        builtinMethod("Right", ["count: usize"], "string"),
        builtinMethod("Trim", [], "string"),
        builtinMethod("TrimStart", [], "string"),
        builtinMethod("TrimEnd", [], "string"),
        builtinMethod("ToLower", [], "string"),
        builtinMethod("ToUpper", [], "string"),
        builtinMethod("Replace", ["needle: string", "replacement: string"], "string"),
        builtinMethod("ReplaceFirst", ["needle: string", "replacement: string"], "string"),
        builtinMethod("Repeat", ["count: usize"], "string"),
        builtinMethod("Split", ["separator: string"], "string[]"),
        builtinMethod("Lines", [], "string[]"),
        builtinMethod("PadLeft", ["width: usize", "fill: char"], "string"),
        builtinMethod("PadRight", ["width: usize", "fill: char"], "string"),
        builtinMethod("Reversed", [], "string"),
        builtinMethod("Append", ["value: string"], "void"),
        builtinMethod("Push", ["value: char"], "void"),
        builtinMethod("Insert", ["index: usize", "value: string"], "void"),
        builtinMethod("Erase", ["index: usize", "count: usize"], "void")
    ],
    array: [
        builtinMethod("Count", [], "usize"),
        builtinMethod("Empty", [], "bool"),
        builtinMethod("Capacity", [], "usize"),
        builtinMethod("Contains", ["target: T"], "bool"),
        builtinMethod("IndexOf", ["target: T"], "usize"),
        builtinMethod("LastIndexOf", ["target: T"], "usize"),
        builtinMethod("GetOr", ["index: usize", "fallback: T"], "T"),
        builtinMethod("Last", [], "T"),
        builtinMethod("Clone", [], "T[]"),
        builtinMethod("Slice", ["start: usize", "count?: usize"], "T[]"),
        builtinMethod("Take", ["count: usize"], "T[]"),
        builtinMethod("Skip", ["count: usize"], "T[]"),
        builtinMethod("Concat", ["other: T[]"], "T[]"),
        builtinMethod("Reversed", [], "T[]"),
        builtinMethod("Join", ["separator: string"], "string"),
        builtinMethod("Push", ["value: T"], "void"),
        builtinMethod("PushFront", ["value: T"], "void"),
        builtinMethod("Insert", ["index: usize", "value: T"], "void"),
        builtinMethod("Clear", [], "void"),
        builtinMethod("RemoveAt", ["index: usize"], "void"),
        builtinMethod("Remove", ["value: T"], "bool"),
        builtinMethod("Extend", ["values: T[]"], "void"),
        builtinMethod("Fill", ["value: T"], "void"),
        builtinMethod("Sorted", [], "T[]")
    ],
    staticArray: [
        builtinMethod("Count", [], "usize"),
        builtinMethod("Empty", [], "bool"),
        builtinMethod("Contains", ["target: T"], "bool"),
        builtinMethod("IndexOf", ["target: T"], "usize"),
        builtinMethod("LastIndexOf", ["target: T"], "usize"),
        builtinMethod("GetOr", ["index: usize", "fallback: T"], "T"),
        builtinMethod("Last", [], "T"),
        builtinMethod("Clone", [], "[T; N]"),
        builtinMethod("Slice", ["start: usize", "count?: usize"], "T[]"),
        builtinMethod("Take", ["count: usize"], "T[]"),
        builtinMethod("Skip", ["count: usize"], "T[]"),
        builtinMethod("Concat", ["other: T[]"], "T[]"),
        builtinMethod("Reversed", [], "T[]"),
        builtinMethod("Join", ["separator: string"], "string")
    ],
    dict: [
        builtinMethod("Count", [], "usize"),
        builtinMethod("Empty", [], "bool"),
        builtinMethod("ContainsKey", ["key: K"], "bool"),
        builtinMethod("ContainsValue", ["value: V"], "bool"),
        builtinMethod("Get", ["key: K"], "V"),
        builtinMethod("GetOr", ["key: K", "fallback: V"], "V"),
        builtinMethod("TryGet", ["key: K", "outValue: ref V"], "bool"),
        builtinMethod("Keys", [], "K[]"),
        builtinMethod("Values", [], "V[]"),
        builtinMethod("Clone", [], "Dict<K, V>"),
        builtinMethod("Merge", ["other: Dict<K, V>"], "Dict<K, V>"),
        builtinMethod("Set", ["key: K", "value: V"], "void"),
        builtinMethod("Extend", ["other: Dict<K, V>"], "void"),
        builtinMethod("Clear", [], "void"),
        builtinMethod("Remove", ["key: K"], "bool")
    ],
    tree: [
        builtinMethod("Count", [], "usize"),
        builtinMethod("Empty", [], "bool"),
        builtinMethod("ContainsKey", ["key: K"], "bool"),
        builtinMethod("ContainsValue", ["value: V"], "bool"),
        builtinMethod("Get", ["key: K"], "V"),
        builtinMethod("GetOr", ["key: K", "fallback: V"], "V"),
        builtinMethod("TryGet", ["key: K", "outValue: ref V"], "bool"),
        builtinMethod("Keys", [], "K[]"),
        builtinMethod("Values", [], "V[]"),
        builtinMethod("Clone", [], "Tree<K, V>"),
        builtinMethod("Merge", ["other: Tree<K, V>"], "Tree<K, V>"),
        builtinMethod("Set", ["key: K", "value: V"], "void"),
        builtinMethod("Extend", ["other: Tree<K, V>"], "void"),
        builtinMethod("Clear", [], "void"),
        builtinMethod("Remove", ["key: K"], "bool"),
        builtinMethod("FirstKey", [], "K"),
        builtinMethod("FirstValue", [], "V"),
        builtinMethod("LastKey", [], "K"),
        builtinMethod("LastValue", [], "V")
    ]
};

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

            await runWioForDocument(document, buildCheckArguments(document), {
                reason: "check",
                updateDiagnostics: true,
                showOutputOnSuccess: getConfiguration().get("showOutputOnSuccess", false),
                automatic: false
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("wio.runCurrentFile", async () => {
            const document = getActiveWioDocument();
            if (!document) {
                vscode.window.showWarningMessage("Open a .wio file first.");
                return;
            }

            if (!hasEntryFunction(document.getText())) {
                vscode.window.showWarningMessage("The current Wio file does not seem to define `fn Entry(...)`.");
                return;
            }

            await runWioForDocument(document, buildRunArguments(), {
                reason: "run",
                updateDiagnostics: true,
                showOutputOnSuccess: true,
                automatic: false
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
                showOutputOnSuccess: true,
                automatic: false
            });

            if (!result || result.code !== 0) {
                return;
            }

            const generatedPath = `${document.uri.fsPath}.cpp`;
            const choice = await vscode.window.showInformationMessage(
                `Generated C++: ${generatedPath}`,
                "Open File"
            );

            if (choice === "Open File" && fs.existsSync(generatedPath)) {
                const generatedDocument = await vscode.workspace.openTextDocument(generatedPath);
                await vscode.window.showTextDocument(generatedDocument, { preview: false });
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

            await runWioForDocument(document, ["--show-backend-info", ...buildCheckArguments(document)], {
                reason: "backend-info",
                updateDiagnostics: false,
                showOutputOnSuccess: true,
                automatic: false
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
            invalidateSymbolIndex();
            if (!getConfiguration().get("enableDiagnosticsOnOpen", true)) {
                return;
            }

            await maybeCheckDocument(document, "open");
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            invalidateSymbolIndex();
            if (!getConfiguration().get("enableDiagnosticsOnSave", true)) {
                return;
            }

            await maybeCheckDocument(document, "save");
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(() => {
            invalidateSymbolIndex();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            invalidateSymbolIndex();
            if (isWioDocument(document)) {
                diagnostics.delete(document.uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: "wio", scheme: "file" },
            {
                provideCompletionItems: async (document, position) => provideCompletionItems(document, position)
            },
            ".",
            ":"
        )
    );

    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            { language: "wio", scheme: "file" },
            {
                provideSignatureHelp: async (document, position) => provideSignatureHelp(document, position)
            },
            "(",
            ","
        )
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

function invalidateSymbolIndex() {
    symbolIndexCache = null;
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

    if (shouldSkipAutoCheck(document)) {
        diagnostics.delete(document.uri);
        return;
    }

    await runWioForDocument(document, buildCheckArguments(document), {
        reason: trigger,
        updateDiagnostics: true,
        showOutputOnSuccess: false,
        automatic: true
    });
}

function shouldSkipAutoCheck(document) {
    const normalizedPath = normalizeFsPath(document.uri.fsPath);
    return normalizedPath.includes("/std/") ||
        normalizedPath.includes("/libs/") ||
        normalizedPath.includes("/runtime/");
}

function buildCheckArguments(document) {
    if (hasEntryFunction(document.getText())) {
        return ["--dry-run"];
    }

    return ["--dry-run", "--target", "static"];
}

function buildRunArguments() {
    const runArgs = getConfiguration().get("runArgs", []);
    const normalizedRunArgs = Array.isArray(runArgs)
        ? runArgs.filter((value) => typeof value === "string" && value.length > 0)
        : [];
    return ["--run", ...normalizedRunArgs];
}

function hasEntryFunction(text) {
    return /\bfn\s+Entry\s*\(/.test(text);
}

function getExecutableCandidates(document) {
    const configured = getConfiguration().get("executable", "").trim();
    const candidates = [];
    const seen = new Set();

    const appendCandidate = (candidate) => {
        if (!candidate || typeof candidate !== "string" || candidate.trim().length === 0) {
            return;
        }

        const normalized = candidate.trim();
        const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        candidates.push(normalized);
    };

    if (configured.length > 0) {
        appendCandidate(configured);
    }

    for (const discovered of findDiscoveredExecutablePaths(document)) {
        appendCandidate(discovered);
    }

    appendCandidate(process.platform === "win32" ? "wio.exe" : "wio");
    appendCandidate("wio");

    return candidates;
}

function findDiscoveredExecutablePaths(document) {
    const executableName = process.platform === "win32" ? "wio.exe" : "wio";
    const candidatePaths = [];
    const seen = new Set();

    const appendCandidate = (candidatePath) => {
        if (!candidatePath) {
            return;
        }

        const normalized = path.normalize(candidatePath);
        const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        candidatePaths.push(normalized);
    };

    const appendWorkspaceCandidates = (rootPath) => {
        if (!rootPath) {
            return;
        }

        appendCandidate(path.join(rootPath, "build", "app", "Debug", executableName));
        appendCandidate(path.join(rootPath, "build", "app", "Release", executableName));
        appendCandidate(path.join(rootPath, "build", "app", "RelWithDebInfo", executableName));
        appendCandidate(path.join(rootPath, "build", "app", "MinSizeRel", executableName));
        appendCandidate(path.join(rootPath, "build", "app", executableName));
        appendCandidate(path.join(rootPath, "bin", executableName));
        appendCandidate(path.join(rootPath, "dist", "bin", executableName));
    };

    for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
        appendWorkspaceCandidates(workspaceFolder.uri.fsPath);
    }

    if (document?.uri?.scheme === "file") {
        let currentDir = path.dirname(document.uri.fsPath);
        for (let depth = 0; depth < 6; ++depth) {
            appendWorkspaceCandidates(currentDir);

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break;
            }
            currentDir = parentDir;
        }
    }

    const wioRoot = process.env.WIO_ROOT || process.env.WIO_HOME;
    if (wioRoot) {
        appendCandidate(path.join(wioRoot, "bin", executableName));
        appendWorkspaceCandidates(wioRoot);
    }

    appendWorkspaceCandidates(process.cwd());
    return candidatePaths.filter((candidatePath) => fs.existsSync(candidatePath));
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
    const executableCandidates = getExecutableCandidates(document);
    const args = buildArguments(document, extraArgs);
    const cwd = getWorkingDirectory(document);

    if (!options.automatic) {
        outputChannel.clear();
    }

    let result;
    try {
        result = await spawnProcessWithFallback(executableCandidates, args, cwd);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`x ${capitalize(options.reason)} failed`);
        outputChannel.appendLine("");
        outputChannel.appendLine(message);
        outputChannel.show(true);
        if (!options.automatic) {
            vscode.window.showErrorMessage(message);
        }
        return null;
    }

    const combinedOutput = `${result.stdout}${result.stderr}`;

    if (options.updateDiagnostics) {
        updateDiagnosticsFromOutput(document, combinedOutput);
    }

    const renderedOutput = formatOutputForDisplay(document, options, result, combinedOutput, executableCandidates, args, cwd);
    if (renderedOutput) {
        outputChannel.appendLine(renderedOutput);
        outputChannel.appendLine("");
    }

    if (result.code !== 0) {
        outputChannel.show(true);
        if (!options.automatic) {
            vscode.window.showErrorMessage(`Wio ${options.reason} failed.`);
        }
        return result;
    }

    if (options.showOutputOnSuccess) {
        outputChannel.show(true);
    }

    return result;
}

function formatOutputForDisplay(document, options, result, rawOutput, executableCandidates, args, cwd) {
    const parsed = splitCompilerAndProgramOutput(rawOutput);
    const documentName = path.basename(document.uri.fsPath);
    const isSuccess = result.code === 0;
    const compilerPath = result.executable || executableCandidates[0] || "<unknown>";

    if (isSuccess && options.automatic) {
        return null;
    }

    const lines = [];
    if (isSuccess) {
        switch (options.reason) {
        case "run":
            if (parsed.programLines.length > 0) {
                lines.push(...parsed.programLines);
            } else {
                lines.push(`ok ${documentName} ran successfully.`);
            }
            return lines.join("\n");
        case "emit-cpp": {
            const generatedCppLine = parsed.compilerInfoLines.find((line) => line.startsWith("Generated C++ output:"));
            lines.push(generatedCppLine || `ok Generated C++ for ${documentName}.`);
            return lines.join("\n");
        }
        case "backend-info":
            lines.push(`Backend info for ${documentName}`);
            lines.push("");
            lines.push(`compiler: ${compilerPath}`);
            lines.push(`cwd: ${cwd}`);
            lines.push(`args: ${args.join(" ")}`);
            if (parsed.compilerInfoLines.length > 0) {
                lines.push("");
                lines.push(...parsed.compilerInfoLines);
            }
            return lines.join("\n");
        default:
            if (!options.showOutputOnSuccess) {
                return null;
            }

            lines.push(`ok ${capitalize(options.reason)} succeeded for ${documentName}.`);
            if (parsed.compilerInfoLines.length > 0) {
                lines.push("");
                lines.push(...parsed.compilerInfoLines);
            }
            return lines.join("\n");
        }
    }

    lines.push(`${capitalize(options.reason)} failed for ${documentName}.`);
    lines.push("");
    lines.push(`compiler: ${compilerPath}`);
    lines.push(`cwd: ${cwd}`);
    lines.push(`args: ${args.join(" ")}`);

    if (parsed.diagnosticLines.length > 0) {
        lines.push("");
        lines.push("Diagnostics:");
        lines.push(...parsed.diagnosticLines.map((line) => `  ${line}`));
    }

    const extraCompilerLines = parsed.compilerInfoLines.filter((line) =>
        !line.startsWith("Generated C++ output:") &&
        !line.startsWith("Generated backend output:") &&
        !line.startsWith("Running ") &&
        !line.startsWith("Dry run completed successfully.")
    );

    if (extraCompilerLines.length > 0) {
        lines.push("");
        lines.push("Compiler output:");
        lines.push(...extraCompilerLines.map((line) => `  ${line}`));
    }

    if (parsed.programLines.length > 0) {
        lines.push("");
        lines.push("Program output:");
        lines.push(...parsed.programLines.map((line) => `  ${line}`));
    }

    lines.push("");
    lines.push(`exit code: ${result.code}`);
    return lines.join("\n");
}

function splitCompilerAndProgramOutput(rawOutput) {
    const lines = rawOutput.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.length > 0);
    const compilerInfoLines = [];
    const diagnosticLines = [];
    const programLines = [];

    for (const line of lines) {
        const normalizedLine = normalizeCompilerLogLine(line);
        if (/^(Error|Warning|Note)\s+\[/.test(normalizedLine)) {
            diagnosticLines.push(normalizedLine);
            continue;
        }

        if (normalizedLine !== line.trim()) {
            compilerInfoLines.push(normalizedLine);
            continue;
        }

        programLines.push(line);
    }

    return {
        compilerInfoLines,
        diagnosticLines,
        programLines
    };
}

async function spawnProcessWithFallback(executableCandidates, args, cwd) {
    const launchErrors = [];

    for (const executable of executableCandidates) {
        try {
            const result = await spawnProcess(executable, args, cwd);
            result.executable = executable;
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            launchErrors.push(`- ${executable}: ${message}`);
        }
    }

    throw new Error(
        "Failed to start any Wio compiler candidate.\n" +
        launchErrors.join("\n") +
        "\nSet 'wio.executable' explicitly if needed."
    );
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

function updateDiagnosticsFromOutput(document, output) {
    diagnostics.delete(document.uri);

    const diagnosticsByFile = new Map();
    const lines = output.split(/\r?\n/);

    for (const line of lines) {
        const parsed = tryParseDiagnosticLine(document, line);
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

function tryParseDiagnosticLine(document, line) {
    const normalizedLine = normalizeCompilerLogLine(line);
    const match = /^(Error|Warning|Note)\s+\[([^\]]+)\]:\s*(.+)$/.exec(normalizedLine);
    if (!match) {
        return null;
    }

    const severityText = match[1];
    const label = match[2];
    const message = match[3];
    const location = parseLocationLabel(document, label);
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

function normalizeCompilerLogLine(line) {
    const trimmed = line.trim();
    const prefixMatch = /^(?:\[[^\]]+\]\s*)+(.*)$/.exec(trimmed);
    if (!prefixMatch) {
        return trimmed;
    }

    const candidate = prefixMatch[1].trim();
    if (candidate.startsWith("WIO LOG:")) {
        return candidate.slice("WIO LOG:".length).trim();
    }

    return candidate;
}

function parseLocationLabel(document, label) {
    if (label === "cli" || label === "compiler" || label === "unknown" || label.startsWith("backend:")) {
        return {
            filePath: document.uri.fsPath,
            line: 1,
            column: 1
        };
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

    const normalizedPath = resolveExistingFilePath(filePath, document);
    if (!normalizedPath) {
        return null;
    }

    return {
        filePath: normalizedPath,
        line,
        column
    };
}

function resolveExistingFilePath(filePath, document) {
    const normalizedInput = path.normalize(filePath);
    const candidatePaths = [];

    if (path.isAbsolute(normalizedInput)) {
        candidatePaths.push(normalizedInput);
    } else {
        candidatePaths.push(path.resolve(path.dirname(document.uri.fsPath), normalizedInput));

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            candidatePaths.push(path.resolve(workspaceFolder.uri.fsPath, normalizedInput));
        }

        candidatePaths.push(path.resolve(getWorkingDirectory(document), normalizedInput));
    }

    for (const candidatePath of candidatePaths) {
        if (fs.existsSync(candidatePath)) {
            return path.normalize(candidatePath);
        }
    }

    return null;
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

async function provideCompletionItems(document, position) {
    if (!isWioDocument(document)) {
        return [];
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const index = await getWorkspaceSymbolIndex(document);
    const documentContext = buildDocumentContext(document, position, index);

    const useContext = extractUseCompletionContext(linePrefix);
    if (useContext) {
        return buildScopeCompletionItems(useContext.scopePath, useContext.partial, index, documentContext);
    }

    const scopeContext = extractScopeCompletionContext(linePrefix);
    if (scopeContext) {
        return buildScopeCompletionItems(scopeContext.scopePath, scopeContext.partial, index, documentContext);
    }

    const memberContext = extractMemberCompletionContext(linePrefix);
    if (memberContext) {
        return buildMemberCompletionItems(memberContext.receiver, memberContext.partial, documentContext, index);
    }

    return [];
}

async function provideSignatureHelp(document, position) {
    if (!isWioDocument(document)) {
        return null;
    }

    const index = await getWorkspaceSymbolIndex(document);
    const documentContext = buildDocumentContext(document, position, index);
    const callContext = extractCallContext(document, position);
    if (!callContext) {
        return null;
    }

    const signatures = resolveCallableSignatures(callContext.callee, documentContext, index);
    if (signatures.length === 0) {
        return null;
    }

    const signatureHelp = new vscode.SignatureHelp();
    signatureHelp.signatures = signatures.map(toSignatureInformation);
    signatureHelp.activeSignature = 0;
    signatureHelp.activeParameter = Math.min(callContext.activeParameter, Math.max(0, signatures[0].params.length - 1));
    return signatureHelp;
}

function extractUseCompletionContext(linePrefix) {
    const match = /\buse\s+([^;]*)$/.exec(linePrefix);
    if (!match) {
        return null;
    }

    const rawPath = match[1].trim();
    if (rawPath.startsWith("@")) {
        return null;
    }

    const usePath = rawPath.replace(/\s+as\s+.*$/, "").trim();
    if (usePath.length === 0) {
        return {
            scopePath: "",
            partial: ""
        };
    }

    if (usePath.endsWith("::")) {
        return {
            scopePath: usePath.slice(0, -2),
            partial: ""
        };
    }

    const lastSeparator = usePath.lastIndexOf("::");
    if (lastSeparator < 0) {
        return {
            scopePath: "",
            partial: usePath
        };
    }

    return {
        scopePath: usePath.slice(0, lastSeparator),
        partial: usePath.slice(lastSeparator + 2)
    };
}

function extractScopeCompletionContext(linePrefix) {
    const match = /([A-Za-z_][A-Za-z0-9_:]*)::([A-Za-z_][A-Za-z0-9_]*)?$/.exec(linePrefix);
    if (!match) {
        return null;
    }

    return {
        scopePath: match[1],
        partial: match[2] || ""
    };
}

function extractMemberCompletionContext(linePrefix) {
    const match = /([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)?$/.exec(linePrefix);
    if (!match) {
        return null;
    }

    return {
        receiver: match[1],
        partial: match[2] || ""
    };
}

function extractCallContext(document, position) {
    const offset = document.offsetAt(position);
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const maxScanLength = Math.min(prefix.length, 4000);
    const scanText = prefix.slice(prefix.length - maxScanLength);

    let depthParen = 0;
    let depthAngle = 0;
    let depthBracket = 0;
    let activeParameter = 0;

    for (let index = scanText.length - 1; index >= 0; --index) {
        const char = scanText[index];

        if (char === ")") {
            depthParen += 1;
            continue;
        }
        if (char === "(") {
            if (depthParen === 0 && depthAngle === 0 && depthBracket === 0) {
                const before = scanText.slice(0, index);
                const calleeMatch = /([A-Za-z_][A-Za-z0-9_:.]*)(\s*<[^<>]*>)?\s*$/.exec(before);
                if (!calleeMatch) {
                    return null;
                }

                return {
                    callee: `${calleeMatch[1]}${calleeMatch[2] || ""}`.trim(),
                    activeParameter
                };
            }

            depthParen = Math.max(0, depthParen - 1);
            continue;
        }
        if (char === ">") {
            depthAngle += 1;
            continue;
        }
        if (char === "<") {
            depthAngle = Math.max(0, depthAngle - 1);
            continue;
        }
        if (char === "]") {
            depthBracket += 1;
            continue;
        }
        if (char === "[") {
            depthBracket = Math.max(0, depthBracket - 1);
            continue;
        }
        if (char === "," && depthParen === 0 && depthAngle === 0 && depthBracket === 0) {
            activeParameter += 1;
        }
    }

    return null;
}

function buildScopeCompletionItems(scopePathExpression, partial, index, documentContext) {
    const resolvedScopePath = resolveScopePathExpression(scopePathExpression, documentContext, index);
    if (resolvedScopePath === null) {
        return [];
    }

    const scope = index.scopes.get(resolvedScopePath);
    if (!scope) {
        return [];
    }

    const prefix = partial.toLowerCase();
    const items = [];

    for (const childScopeName of scope.childScopes.values()) {
        if (prefix.length > 0 && !childScopeName.toLowerCase().startsWith(prefix)) {
            continue;
        }

        const childFqName = resolvedScopePath ? `${resolvedScopePath}::${childScopeName}` : childScopeName;
        const childScope = index.scopes.get(childFqName);
        items.push(makeScopeCompletionItem(childScopeName, childScope?.kind || "realm", childFqName));
    }

    for (const symbol of scope.symbols) {
        if (prefix.length > 0 && !symbol.name.toLowerCase().startsWith(prefix)) {
            continue;
        }

        items.push(makeSymbolCompletionItem(symbol));
    }

    return dedupeCompletionItems(items);
}

function buildMemberCompletionItems(receiverName, partial, documentContext, index) {
    const resolvedType = resolveReceiverType(receiverName, documentContext, index);
    if (!resolvedType) {
        return [];
    }

    const prefix = partial.toLowerCase();
    const items = [];
    const builtinMembers = BUILTIN_MEMBER_CATALOG[resolvedType.kind] || [];

    for (const member of builtinMembers) {
        if (prefix.length > 0 && !member.name.toLowerCase().startsWith(prefix)) {
            continue;
        }

        items.push(makeBuiltinMemberCompletionItem(member));
    }

    if (resolvedType.kind === "user" && resolvedType.fqName) {
        const typeInfo = index.types.get(resolvedType.fqName);
        if (typeInfo) {
            for (const field of typeInfo.fields) {
                if (prefix.length > 0 && !field.name.toLowerCase().startsWith(prefix)) {
                    continue;
                }

                items.push(makeSymbolCompletionItem(field));
            }

            for (const method of typeInfo.methods) {
                if (prefix.length > 0 && !method.name.toLowerCase().startsWith(prefix)) {
                    continue;
                }

                items.push(makeSymbolCompletionItem(method));
            }
        }
    }

    return dedupeCompletionItems(items);
}

function resolveCallableSignatures(calleeExpression, documentContext, index) {
    const cleanedCallee = calleeExpression.replace(/\s*<[^<>]*>\s*$/, "").trim();

    if (cleanedCallee.includes(".")) {
        const match = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(cleanedCallee);
        if (!match) {
            return [];
        }

        const resolvedType = resolveReceiverType(match[1], documentContext, index);
        if (!resolvedType) {
            return [];
        }

        const builtinMembers = BUILTIN_MEMBER_CATALOG[resolvedType.kind] || [];
        const builtinMatches = builtinMembers.filter((entry) => entry.name === match[2]);
        if (builtinMatches.length > 0) {
            return builtinMatches;
        }

        if (resolvedType.kind === "user" && resolvedType.fqName) {
            const typeInfo = index.types.get(resolvedType.fqName);
            if (!typeInfo) {
                return [];
            }

            return typeInfo.methods.filter((method) => method.name === match[2]);
        }

        return [];
    }

    if (cleanedCallee.includes("::")) {
        const separatorIndex = cleanedCallee.lastIndexOf("::");
        const scopeExpression = cleanedCallee.slice(0, separatorIndex);
        const symbolName = cleanedCallee.slice(separatorIndex + 2);
        const resolvedScopePath = resolveScopePathExpression(scopeExpression, documentContext, index);
        if (resolvedScopePath === null) {
            return [];
        }

        const scope = index.scopes.get(resolvedScopePath);
        if (!scope) {
            return [];
        }

        return scope.symbols.filter((symbol) => symbol.name === symbolName && (symbol.kind === "function" || symbol.kind === "method"));
    }

    const localMatches = [];
    for (const scope of index.scopes.values()) {
        for (const symbol of scope.symbols) {
            if (symbol.name === cleanedCallee && (symbol.kind === "function" || symbol.kind === "method")) {
                localMatches.push(symbol);
            }
        }
    }

    return localMatches;
}

function makeScopeCompletionItem(name, kind, fqName) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
    item.detail = `${kind} ${fqName}`;
    item.insertText = name;
    return item;
}

function makeSymbolCompletionItem(symbol) {
    const kindMap = {
        function: vscode.CompletionItemKind.Function,
        method: vscode.CompletionItemKind.Method,
        field: vscode.CompletionItemKind.Field,
        type: vscode.CompletionItemKind.Class,
        alias: vscode.CompletionItemKind.Class
    };

    const item = new vscode.CompletionItem(symbol.name, kindMap[symbol.kind] || vscode.CompletionItemKind.Text);
    item.detail = symbol.signature || symbol.detail || symbol.fqName || symbol.name;
    if (symbol.kind === "function" || symbol.kind === "method") {
        item.insertText = new vscode.SnippetString(`${symbol.name}($0)`);
        item.command = {
            command: "editor.action.triggerParameterHints",
            title: "Trigger Parameter Hints"
        };
    } else {
        item.insertText = symbol.name;
    }
    item.documentation = symbol.documentation ? new vscode.MarkdownString(symbol.documentation) : undefined;
    return item;
}

function makeBuiltinMemberCompletionItem(member) {
    const item = new vscode.CompletionItem(member.name, vscode.CompletionItemKind.Method);
    item.detail = member.signature;
    item.insertText = new vscode.SnippetString(`${member.name}($0)`);
    item.command = {
        command: "editor.action.triggerParameterHints",
        title: "Trigger Parameter Hints"
    };
    return item;
}

function dedupeCompletionItems(items) {
    const deduped = [];
    const seen = new Set();

    for (const item of items) {
        const key = `${item.label}:${item.kind}:${item.detail || ""}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        deduped.push(item);
    }

    return deduped;
}

function toSignatureInformation(symbol) {
    const signature = new vscode.SignatureInformation(symbol.signature || `${symbol.name}()`);
    signature.parameters = (symbol.params || []).map((param) => new vscode.ParameterInformation(param));
    return signature;
}

async function getWorkspaceSymbolIndex(activeDocument) {
    if (symbolIndexCache) {
        return symbolIndexCache;
    }

    const index = createEmptyIndex();
    const openDocumentMap = new Map();

    for (const document of vscode.workspace.textDocuments) {
        if (isWioDocument(document)) {
            openDocumentMap.set(document.uri.fsPath, document.getText());
        }
    }

    const workspaceUris = await vscode.workspace.findFiles("**/*.wio");
    const filePaths = new Set();

    for (const uri of workspaceUris) {
        const normalized = normalizeFsPath(uri.fsPath);
        if (shouldIgnoreIndexedPath(normalized)) {
            continue;
        }

        filePaths.add(uri.fsPath);
    }

    if (activeDocument?.uri?.fsPath) {
        filePaths.add(activeDocument.uri.fsPath);
    }

    for (const filePath of filePaths) {
        const text = openDocumentMap.get(filePath) ?? safeReadFile(filePath);
        if (!text) {
            continue;
        }

        parseWioTextIntoIndex(text, filePath, index);
    }

    symbolIndexCache = index;
    return index;
}

function createEmptyIndex() {
    const scopes = new Map();
    scopes.set("", {
        fqName: "",
        name: "",
        kind: "root",
        childScopes: new Set(),
        symbols: []
    });

    return {
        scopes,
        types: new Map(),
        typeAliases: new Map()
    };
}

function parseWioTextIntoIndex(text, filePath, index) {
    const lines = text.split(/\r?\n/);
    const scopeStack = [{ fqName: "", kind: "root", braceDepth: 0 }];
    let braceDepth = 0;

    for (const line of lines) {
        const sanitizedLine = stripLineComment(line);
        const trimmedLine = sanitizedLine.trim();
        const openCount = countChar(sanitizedLine, "{");
        const closeCount = countChar(sanitizedLine, "}");
        const currentScope = scopeStack[scopeStack.length - 1];

        if (trimmedLine.length > 0) {
            const realmMatch = /\brealm\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(trimmedLine);
            if (realmMatch) {
                const realmName = realmMatch[1];
                const realmFqName = qualifyName(currentScope.fqName, realmName);
                ensureScope(index, realmFqName, realmName, "realm", currentScope.fqName);
                scopeStack.push({
                    fqName: realmFqName,
                    kind: "realm",
                    braceDepth: braceDepth + openCount
                });
                braceDepth += openCount - closeCount;
                popClosedScopes(scopeStack, braceDepth);
                continue;
            }

            const typeMatch = /\b(object|component|interface|enum|flagset|flag)\s+([A-Za-z_][A-Za-z0-9_]*)(\s*<[^>]+>)?\s*\{?/.exec(trimmedLine);
            if (typeMatch) {
                const typeKind = typeMatch[1];
                const typeName = typeMatch[2];
                const typeFqName = qualifyName(currentScope.fqName, typeName);
                const genericSuffix = typeMatch[3] || "";
                const typeSymbol = makeTypeSymbol(typeName, typeFqName, typeKind, genericSuffix);
                addScopeSymbol(index, currentScope.fqName, typeSymbol);
                ensureType(index, typeFqName, typeName, typeKind, currentScope.fqName);

                if (trimmedLine.includes("{")) {
                    ensureScope(index, typeFqName, typeName, typeKind, currentScope.fqName);
                    scopeStack.push({
                        fqName: typeFqName,
                        kind: typeKind,
                        braceDepth: braceDepth + openCount
                    });
                }

                braceDepth += openCount - closeCount;
                popClosedScopes(scopeStack, braceDepth);
                continue;
            }

            const typeAliasMatch = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)(\s*<[^>]+>)?\s*=\s*([^;]+);/.exec(trimmedLine);
            if (typeAliasMatch) {
                const aliasName = typeAliasMatch[1];
                const genericSuffix = typeAliasMatch[2] || "";
                const aliasedType = typeAliasMatch[3].trim();
                const aliasFqName = qualifyName(currentScope.fqName, aliasName);
                index.typeAliases.set(aliasFqName, aliasedType);
                addScopeSymbol(index, currentScope.fqName, {
                    kind: "alias",
                    name: aliasName,
                    fqName: aliasFqName,
                    detail: `type ${aliasName}${genericSuffix} = ${aliasedType}`
                });
            }

            const functionMatch = /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)(\s*<[^>]+>)?\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?/.exec(trimmedLine);
            if (functionMatch) {
                const functionName = functionMatch[1];
                const genericSuffix = functionMatch[2] || "";
                const params = parseParameterList(functionMatch[3]);
                const returnType = (functionMatch[4] || "void").trim();
                const functionFqName = qualifyName(currentScope.fqName, functionName);
                const functionSymbol = makeCallableSymbol("function", functionName, functionFqName, params, returnType, genericSuffix);
                addScopeSymbol(index, currentScope.fqName, functionSymbol);

                if (isTypeScopeKind(currentScope.kind)) {
                    ensureType(index, currentScope.fqName, path.basename(currentScope.fqName), currentScope.kind, "");
                    index.types.get(currentScope.fqName).methods.push({
                        ...functionSymbol,
                        kind: "method"
                    });
                }
            }

            if (isTypeScopeKind(currentScope.kind)) {
                const methodMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?/.exec(trimmedLine);
                if (methodMatch && !isReservedWord(methodMatch[1]) && !trimmedLine.startsWith("fn ")) {
                    const methodName = methodMatch[1];
                    const params = parseParameterList(methodMatch[2]);
                    const returnType = (methodMatch[3] || "void").trim();
                    const methodFqName = qualifyName(currentScope.fqName, methodName);
                    const methodSymbol = makeCallableSymbol("method", methodName, methodFqName, params, returnType, "");
                    addScopeSymbol(index, currentScope.fqName, methodSymbol);
                    ensureType(index, currentScope.fqName, path.basename(currentScope.fqName), currentScope.kind, "");
                    index.types.get(currentScope.fqName).methods.push(methodSymbol);
                }

                const fieldMatch = /^(?:public|private|protected)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;]+);/.exec(trimmedLine);
                if (fieldMatch && !trimmedLine.startsWith("fn ")) {
                    const fieldName = fieldMatch[1];
                    const fieldType = fieldMatch[2].trim();
                    const fieldFqName = qualifyName(currentScope.fqName, fieldName);
                    const fieldSymbol = {
                        kind: "field",
                        name: fieldName,
                        fqName: fieldFqName,
                        typeText: fieldType,
                        detail: `${fieldName}: ${fieldType}`
                    };
                    addScopeSymbol(index, currentScope.fqName, fieldSymbol);
                    ensureType(index, currentScope.fqName, path.basename(currentScope.fqName), currentScope.kind, "");
                    index.types.get(currentScope.fqName).fields.push(fieldSymbol);
                }
            }
        }

        braceDepth += openCount - closeCount;
        popClosedScopes(scopeStack, braceDepth);
    }
}

function ensureScope(index, fqName, name, kind, parentFqName) {
    if (!index.scopes.has(fqName)) {
        index.scopes.set(fqName, {
            fqName,
            name,
            kind,
            childScopes: new Set(),
            symbols: []
        });
    }

    const parentScope = index.scopes.get(parentFqName);
    if (parentScope) {
        parentScope.childScopes.add(name);
    }
}

function ensureType(index, fqName, name, kind, parentFqName) {
    if (!index.types.has(fqName)) {
        index.types.set(fqName, {
            fqName,
            name,
            kind,
            parentFqName,
            fields: [],
            methods: []
        });
    }
}

function addScopeSymbol(index, scopeFqName, symbol) {
    const scope = index.scopes.get(scopeFqName);
    if (!scope) {
        return;
    }

    const duplicate = scope.symbols.some((existing) =>
        existing.kind === symbol.kind &&
        existing.name === symbol.name &&
        (existing.signature || existing.detail) === (symbol.signature || symbol.detail)
    );

    if (!duplicate) {
        scope.symbols.push(symbol);
    }
}

function makeTypeSymbol(name, fqName, typeKind, genericSuffix) {
    return {
        kind: "type",
        name,
        fqName,
        detail: `${typeKind} ${name}${genericSuffix}`
    };
}

function makeCallableSymbol(kind, name, fqName, params, returnType, genericSuffix) {
    const signature = `${name}${genericSuffix}(${params.join(", ")}) -> ${returnType}`;
    return {
        kind,
        name,
        fqName,
        params,
        returnType,
        signature,
        detail: signature
    };
}

function parseParameterList(paramListText) {
    const normalizedText = paramListText.trim();
    if (normalizedText.length === 0) {
        return [];
    }

    return splitTopLevel(normalizedText, ",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function splitTopLevel(text, separator) {
    const parts = [];
    let current = "";
    let angleDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;

    for (const char of text) {
        if (char === "<") {
            angleDepth += 1;
        } else if (char === ">") {
            angleDepth = Math.max(0, angleDepth - 1);
        } else if (char === "(") {
            parenDepth += 1;
        } else if (char === ")") {
            parenDepth = Math.max(0, parenDepth - 1);
        } else if (char === "[") {
            bracketDepth += 1;
        } else if (char === "]") {
            bracketDepth = Math.max(0, bracketDepth - 1);
        }

        if (char === separator && angleDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
            parts.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    if (current.length > 0) {
        parts.push(current);
    }

    return parts;
}

function stripLineComment(line) {
    let inDoubleString = false;
    let inSingleString = false;

    for (let index = 0; index < line.length - 1; ++index) {
        const char = line[index];
        const nextChar = line[index + 1];

        if (char === "\"" && !inSingleString && line[index - 1] !== "\\") {
            inDoubleString = !inDoubleString;
            continue;
        }

        if (char === "'" && !inDoubleString && line[index - 1] !== "\\") {
            inSingleString = !inSingleString;
            continue;
        }

        if (!inDoubleString && !inSingleString && char === "/" && nextChar === "/") {
            return line.slice(0, index);
        }
    }

    return line;
}

function countChar(text, char) {
    let count = 0;
    for (const currentChar of text) {
        if (currentChar === char) {
            count += 1;
        }
    }
    return count;
}

function popClosedScopes(scopeStack, braceDepth) {
    while (scopeStack.length > 1 && braceDepth < scopeStack[scopeStack.length - 1].braceDepth) {
        scopeStack.pop();
    }
}

function isTypeScopeKind(kind) {
    return kind === "object" || kind === "component" || kind === "interface" || kind === "enum" || kind === "flagset" || kind === "flag";
}

function qualifyName(scopeFqName, name) {
    return scopeFqName ? `${scopeFqName}::${name}` : name;
}

function buildDocumentContext(document, position, index) {
    const text = document.getText();
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    return {
        aliases: parseUseAliases(text),
        scopePath: computeScopePathAtPosition(text, position),
        localTypes: collectVisibleLocalTypes(prefix),
        selfType: computeSelfTypeAtPosition(text, position, index),
        index
    };
}

function parseUseAliases(text) {
    const aliases = new Map();
    const useRegex = /^\s*use\s+([A-Za-z_][A-Za-z0-9_:]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;/gm;
    let match;
    while ((match = useRegex.exec(text)) !== null) {
        const fullPath = match[1];
        const alias = match[2] || fullPath.split("::").pop();
        aliases.set(alias, fullPath);
    }
    return aliases;
}

function computeScopePathAtPosition(text, position) {
    const lines = text.split(/\r?\n/).slice(0, position.line + 1);
    const stack = [];
    let braceDepth = 0;

    for (const line of lines) {
        const sanitizedLine = stripLineComment(line);
        const trimmedLine = sanitizedLine.trim();
        const openCount = countChar(sanitizedLine, "{");
        const closeCount = countChar(sanitizedLine, "}");

        const realmMatch = /\brealm\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(trimmedLine);
        if (realmMatch) {
            stack.push({
                name: realmMatch[1],
                kind: "realm",
                braceDepth: braceDepth + openCount
            });
            braceDepth += openCount - closeCount;
            popClosedScopes(stack, braceDepth);
            continue;
        }

        const typeMatch = /\b(object|component|interface|enum|flagset|flag)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(trimmedLine);
        if (typeMatch) {
            stack.push({
                name: typeMatch[2],
                kind: typeMatch[1],
                braceDepth: braceDepth + openCount
            });
            braceDepth += openCount - closeCount;
            popClosedScopes(stack, braceDepth);
            continue;
        }

        braceDepth += openCount - closeCount;
        popClosedScopes(stack, braceDepth);
    }

    return stack.filter((entry) => entry.kind === "realm").map((entry) => entry.name).join("::");
}

function computeSelfTypeAtPosition(text, position, index) {
    const lines = text.split(/\r?\n/).slice(0, position.line + 1);
    const stack = [];
    let braceDepth = 0;

    for (const line of lines) {
        const sanitizedLine = stripLineComment(line);
        const trimmedLine = sanitizedLine.trim();
        const openCount = countChar(sanitizedLine, "{");
        const closeCount = countChar(sanitizedLine, "}");
        const currentScopePath = stack.map((entry) => entry.name).join("::");

        const realmMatch = /\brealm\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(trimmedLine);
        if (realmMatch) {
            stack.push({
                name: realmMatch[1],
                kind: "realm",
                braceDepth: braceDepth + openCount
            });
            braceDepth += openCount - closeCount;
            popClosedScopes(stack, braceDepth);
            continue;
        }

        const typeMatch = /\b(object|component|interface|enum|flagset|flag)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(trimmedLine);
        if (typeMatch) {
            stack.push({
                name: typeMatch[2],
                kind: typeMatch[1],
                braceDepth: braceDepth + openCount
            });
            braceDepth += openCount - closeCount;
            popClosedScopes(stack, braceDepth);
            continue;
        }

        braceDepth += openCount - closeCount;
        popClosedScopes(stack, braceDepth);
    }

    const typeSegments = stack.filter((entry) => isTypeScopeKind(entry.kind)).map((entry) => entry.name);
    if (typeSegments.length === 0) {
        return null;
    }

    const realmSegments = stack.filter((entry) => entry.kind === "realm").map((entry) => entry.name);
    const fqName = [...realmSegments, ...typeSegments].join("::");
    return index.types.has(fqName) ? fqName : null;
}

function collectVisibleLocalTypes(prefixText) {
    const localTypes = new Map();
    const functionMatches = [...prefixText.matchAll(/\bfn\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*<[^>]+>)?\s*\(([^)]*)\)/g)];
    const lastFunctionMatch = functionMatches.at(-1);
    if (lastFunctionMatch) {
        for (const param of splitTopLevel(lastFunctionMatch[1], ",")) {
            const trimmedParam = param.trim();
            const paramMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(trimmedParam);
            if (paramMatch) {
                localTypes.set(paramMatch[1], paramMatch[2].trim());
            }
        }
    }

    const variableRegex = /\b(?:let|mut|const)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([^=;\n]+))?(?:=\s*([^;\n]+))?/g;
    let match;
    while ((match = variableRegex.exec(prefixText)) !== null) {
        const name = match[1];
        const explicitType = match[2] ? match[2].trim() : "";
        const initializer = match[3] ? match[3].trim() : "";
        const inferredType = explicitType || inferTypeFromInitializer(initializer);
        if (inferredType) {
            localTypes.set(name, inferredType);
        }
    }

    const forRegex = /\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
    while ((match = forRegex.exec(prefixText)) !== null) {
        const itemName = match[1];
        const sourceName = match[2];
        const sourceType = localTypes.get(sourceName);
        if (!sourceType) {
            continue;
        }

        const normalized = normalizeTypeDescriptor(sourceType, localTypes);
        if (normalized.kind === "array" || normalized.kind === "staticArray") {
            localTypes.set(itemName, normalized.elementType || "T");
        }
    }

    return localTypes;
}

function inferTypeFromInitializer(initializer) {
    if (!initializer) {
        return "";
    }

    if (/^\$?"/.test(initializer)) {
        return "string";
    }

    if (/^\[.*\]$/.test(initializer)) {
        return "T[]";
    }

    if (/^\{.*\}$/.test(initializer)) {
        return "Dict<K, V>";
    }

    if (/^\d+(?:\.\d+)?f(?:32|64)?$/.test(initializer) || /^\d+\.\d+$/.test(initializer)) {
        return "f32";
    }

    if (/^\d+(?:u(?:8|16|32|64|size)|i(?:8|16|32|64))?$/.test(initializer)) {
        return "i32";
    }

    const constructorMatch = /^([A-Za-z_][A-Za-z0-9_:]*)(?:\s*<[^>]+>)?\s*\(/.exec(initializer);
    if (constructorMatch) {
        const candidateType = constructorMatch[1].trim();
        if (candidateType.includes("::") || /^[A-Z]/.test(candidateType)) {
            return candidateType;
        }
    }

    return "";
}

function resolveScopePathExpression(scopePathExpression, documentContext, index) {
    const rawSegments = scopePathExpression.split("::").filter((segment) => segment.length > 0);
    if (rawSegments.length === 0) {
        return "";
    }

    const aliasResolved = documentContext.aliases.get(rawSegments[0]);
    let candidateSegments = rawSegments;
    if (aliasResolved) {
        candidateSegments = [...aliasResolved.split("::"), ...rawSegments.slice(1)];
    }

    const candidatePath = candidateSegments.join("::");
    if (index.scopes.has(candidatePath)) {
        return candidatePath;
    }

    if (index.types.has(candidatePath)) {
        return candidatePath;
    }

    if (documentContext.scopePath) {
        const relativeCandidate = qualifyName(documentContext.scopePath, candidatePath);
        if (index.scopes.has(relativeCandidate) || index.types.has(relativeCandidate)) {
            return relativeCandidate;
        }
    }

    return index.scopes.has(candidateSegments[0]) ? candidateSegments[0] : candidatePath;
}

function resolveReceiverType(receiverName, documentContext, index) {
    if (receiverName === "self" && documentContext.selfType) {
        return {
            kind: "user",
            fqName: documentContext.selfType
        };
    }

    const explicitType = documentContext.localTypes.get(receiverName);
    if (!explicitType) {
        return null;
    }

    return normalizeTypeDescriptor(explicitType, index.typeAliases);
}

function normalizeTypeDescriptor(typeText, typeAliases) {
    const cleanedType = typeText
        .replace(/\b(?:view|ref|mut)\b/g, "")
        .trim();

    if (cleanedType.endsWith("[]")) {
        return {
            kind: "array",
            elementType: cleanedType.slice(0, -2).trim()
        };
    }

    if (/^\[[^;]+;\s*[^]+\]$/.test(cleanedType)) {
        const elementType = cleanedType.slice(1, cleanedType.indexOf(";")).trim();
        return {
            kind: "staticArray",
            elementType
        };
    }

    if (cleanedType === "string") {
        return { kind: "string" };
    }

    if (/^Dict\s*</.test(cleanedType)) {
        return { kind: "dict" };
    }

    if (/^Tree\s*</.test(cleanedType)) {
        return { kind: "tree" };
    }

    const baseNameMatch = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*<.*>)?$/.exec(cleanedType);
    const baseName = baseNameMatch ? baseNameMatch[1] : cleanedType;
    if (COLLECTION_ALIAS_KINDS.has(baseName)) {
        return { kind: COLLECTION_ALIAS_KINDS.get(baseName) };
    }

    for (const [aliasFqName, aliasedType] of typeAliases.entries()) {
        if (aliasFqName.endsWith(`::${baseName}`) || aliasFqName === baseName) {
            return normalizeTypeDescriptor(aliasedType, typeAliases);
        }
    }

    const matchingType = [...typeAliases.keys()].find((fqName) => fqName.endsWith(`::${baseName}`) || fqName === baseName);
    return {
        kind: "user",
        fqName: matchingType || baseName
    };
}

function builtinMethod(name, params, returnType) {
    return {
        name,
        params,
        returnType,
        signature: `${name}(${params.join(", ")}) -> ${returnType}`
    };
}

function shouldIgnoreIndexedPath(normalizedPath) {
    return IGNORED_INDEX_PATH_SEGMENTS.some((segment) => normalizedPath.includes(segment));
}

function safeReadFile(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch {
        return "";
    }
}

function normalizeFsPath(fsPath) {
    return fsPath.replace(/\\/g, "/").toLowerCase();
}

function isReservedWord(identifier) {
    return new Set([
        "if",
        "else",
        "while",
        "for",
        "foreach",
        "match",
        "when",
        "return",
        "break",
        "continue"
    ]).has(identifier);
}

function capitalize(value) {
    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = {
    activate,
    deactivate
};
