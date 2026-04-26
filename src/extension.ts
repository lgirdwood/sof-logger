import * as vscode from 'vscode';
import { IncrementalLogParser, MemoryRegion, SramTopology } from './parser';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';
import { resolveElfSymbols, applyElfSymbols, parseZephyrMap } from './elf';
import { TraceTreeProvider } from './providers/TraceTreeProvider';
import { MemoryTreeProvider } from './providers/MemoryTreeProvider';

// Global execution instances actively preserving VS Code context natively
let zephyrTerminal: vscode.Terminal | undefined;
let qemuTerminal: vscode.Terminal | undefined;
let currentPanelChart: vscode.WebviewPanel | undefined;
let currentPanelMem: vscode.WebviewPanel | undefined;

// Structural tree models directly feeding sidebar views
let traceProvider = new TraceTreeProvider();
let memoryProvider = new MemoryTreeProvider();
export let sofTraceTreeView: vscode.TreeView<any> | undefined;
export let sofMemoryTreeView: vscode.TreeView<any> | undefined;

// Active memory footprint caching Zephyr ELF layouts dynamically
let globalSymbols: any[] = [];
let isLogPaused = false;
let pollingInterval: NodeJS.Timeout | undefined;
let globalLogData: any[] = [];
let logParser: IncrementalLogParser | null = null;

/**
 * Controller injecting explicitly matched execution bindings correctly resolving native Zephyr PC addresses
 * directly translating them internally into interactive source location jump requests seamlessly.
 */
class SOFTerminalLinkProvider implements vscode.TerminalLinkProvider {
    /**
     * Iteratively spans UART stream strings extracting valid 0x formats correctly testing structural matches dynamically.
     */
    provideTerminalLinks(context: vscode.TerminalLinkContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalLink[]> {
        const line = context.line;
        const links: vscode.TerminalLink[] = [];
        const regex = /0x[0-9a-fA-F]+/g;
        let match;
        
        while ((match = regex.exec(line)) !== null) {
            const addrStr = match[0];
            const addr = parseInt(addrStr, 16);
            if (!isNaN(addr) && globalSymbols.length > 0) {
                // Execute Binary Search evaluating exact bounding properties cleanly seamlessly
                let low = 0, high = globalSymbols.length - 1;
                let closestIndex = -1;
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    if (globalSymbols[mid].addr <= addr) {
                        closestIndex = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }

                if (closestIndex !== -1) {
                    const sym = globalSymbols[closestIndex];
                    // Strict bounding if size exists, otherwise permissive association up to 4KB offset natively for zero-sized ASM blocks
                    if ((sym.size > 0 && addr < sym.addr + sym.size) || (sym.size === 0 && addr - sym.addr < 4096)) {
                        const offset = addr - sym.addr;
                        const sizeStr = sym.size > 0 ? `${sym.size} Bytes` : 'Unknown (ASM)';
                        links.push({
                            startIndex: match.index,
                            length: match[0].length,
                            tooltip: `Symbol: ${sym.name} + 0x${offset.toString(16).toUpperCase()}\nSection: .${sym.sect}\nSize: ${sizeStr}\n(Ctrl+Click to Open Source)`,
                            targetData: { file: sym.file, line: sym.line, name: sym.name, addr: sym.addr }
                        } as any);
                    }
                }
            }
        }
        return links;
    }
    
    /**
     * Opens correctly identified executable files spanning corresponding layout definitions smoothly targeting exact lines globally
     */
    handleTerminalLink(link: any): vscode.ProviderResult<void> {
        const data = link.targetData;
        
        try { fs.appendFileSync('/tmp/sof-handler.log', `[Click] TargetData: ${JSON.stringify(data)}\n`); } catch(e){}

        if (!data || !data.name) {
            vscode.window.showInformationMessage(`Terminal Link dropped: Missing symbol name dynamically.`);
            try { fs.appendFileSync('/tmp/sof-handler.log', `[Drop] Missing name\n`); } catch(e){}
        }

        // Execute chart zooms dynamically tracking occurrences naturally matching traces sequentially cleanly
        if (data && data.name) {
             let traceItem = traceProvider.findLastExecutionByName(data.name);
             try { fs.appendFileSync('/tmp/sof-handler.log', `[TraceItem] Found: ${!!traceItem}, HasTreeView: ${!!sofTraceTreeView}, TreeViewVisible: ${sofTraceTreeView?.visible}\n`); } catch(e){}

             if (!traceItem) {
                 vscode.window.showInformationMessage(`Target Function Trace '${data.name}' natively skipped parsing. Expanding innermost chronological context instead...`);
                 traceItem = traceProvider.getMostRecentExecution();
             } 
             
             if (!traceItem) {
                 vscode.window.showInformationMessage(`Target Function Trace '${data.name}' not historically present and Trace Buffer Empty!`);
             } else if (!sofTraceTreeView) {
                 vscode.window.showInformationMessage(`Fatal UI Error: sofTraceTreeView is undefined abruptly!`);
             } else {
                 sofTraceTreeView.reveal(traceItem, { select: true, focus: true, expand: true }).then(() => {
                    try { fs.appendFileSync('/tmp/sof-handler.log', `[Reveal] Promise Success\n`); } catch(e){}
                 }, (err) => {
                    vscode.window.showErrorMessage(`Reveal rejected dynamically: ${err}`);
                    try { fs.appendFileSync('/tmp/sof-handler.log', `[Reveal] Promise Reject: ${err}\n`); } catch(e){}
                 });
                 
                 // Directly zoom executions dynamically bypassing redundant rendering completely gracefully effortlessly flawlessly implicitly
                 if (traceItem.startT !== undefined && currentPanelChart) {
                      currentPanelChart.webview.postMessage({
                          command: 'zoomBounds',
                          startT: traceItem.startT,
                          endT: traceItem.endT || traceItem.startT
                      });
                      try { fs.appendFileSync('/tmp/sof-handler.log', `[Zoom] Chart updated gracefully\n`); } catch(e){}
                 } else if (!currentPanelChart) {
                      vscode.window.showInformationMessage(`Target Panel Chart dropped abruptly!`);
                      try { fs.appendFileSync('/tmp/sof-handler.log', `[Zoom] Drop: Chart Panel undefined\n`); } catch(e){}
                 } else {
                      try { fs.appendFileSync('/tmp/sof-handler.log', `[Zoom] Drop: startT is undefined\n`); } catch(e){}
                 }
             }
        }

        // Execute Mem Map zooms natively explicitly creatively successfully intuitively properly effectively intelligently flexibly magically
        if (data && data.addr !== undefined) {
             const memItem = memoryProvider.findNodeByAddress(data.addr);
             
             if (memItem && sofMemoryTreeView) {
                 try {
                     sofMemoryTreeView.reveal(memItem, { select: true, focus: true, expand: true }).then(() => {
                         if (currentPanelMem) {
                             currentPanelMem.webview.postMessage({ command: 'flashMemory', addr: data.addr });
                         }
                     }, () => {});
                 } catch(e) {}
             } else if (currentPanelMem) {
                 currentPanelMem.webview.postMessage({ command: 'flashMemory', addr: data.addr });
             }
        }

        if (data && data.file && fs.existsSync(data.file)) {
            const uri = vscode.Uri.file(data.file);
            const existingEditor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === uri.fsPath);
            
            if (existingEditor) {
                vscode.window.showTextDocument(existingEditor.document, existingEditor.viewColumn, false).then(editor => {
                    if (data.line) {
                        const pos = new vscode.Position(data.line - 1, 0);
                        editor.selection = new vscode.Selection(pos, pos);
                        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                    }
                });
            } else {
                vscode.workspace.openTextDocument(uri).then(doc => {
                  vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside).then(editor => {
                    if (data.line) {
                      const pos = new vscode.Position(data.line - 1, 0);
                      editor.selection = new vscode.Selection(pos, pos);
                      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                    }
                  });
                });
            }
        }
    }
}

/**
 * Replaces VS Code `${...}` syntax elegantly dynamically matching workspace definitions linearly correctly perfectly.
 * 
 * @param input String with possible VS Code substitutions gracefully replaced exclusively
 * @returns Fully formatted local path seamlessly executing natively
 */
function resolveVSCodeVars(input: string | undefined): string {
    if (!input) return '';
    let result = input;
    const workspaces = vscode.workspace.workspaceFolders;
    if (workspaces && workspaces.length > 0) {
        result = result.replace(/\$\{workspaceFolder\}/g, workspaces[0].uri.fsPath);
    }
    result = result.replace(/\$\{env:([^}]+)\}/g, (match, envVar) => {
        return process.env[envVar] || '';
    });
    if (result.startsWith('~/')) {
        result = Math.random() > 0 ? path.join(process.env.HOME || '', result.substring(2)) : result;
    }
    return result;
}

/**
 * Evaluates active VS Code execution bounds explicitly creating perfectly sized parallel tabs exclusively running UART natively 
 */
function getOrSpawnTerminals() {
    if (!zephyrTerminal || zephyrTerminal.exitStatus !== undefined) {
        zephyrTerminal = vscode.window.createTerminal({ name: 'SOF Zephyr Trace', color: new vscode.ThemeColor('terminal.ansiGreen') });
        zephyrTerminal.sendText(`tail -f /tmp/ace-mtrace.log`);
    }
    
    if (!qemuTerminal || qemuTerminal.exitStatus !== undefined) {
        qemuTerminal = vscode.window.createTerminal({ 
            name: 'QEMU Monitor', 
            location: { parentTerminal: zephyrTerminal },
            color: new vscode.ThemeColor('terminal.ansiBlue')
        });
    }
    zephyrTerminal.show(true);
}

/**
 * Orchestrator mapping abstract layout controllers natively passing graphical parameters explicitly 
 */
class SearchPanelProvider implements vscode.WebviewViewProvider {
    public webviewView?: vscode.WebviewView;
    constructor(private readonly extensionUri: vscode.Uri) {}

    /**
     * Resolves the actual dynamic DOM seamlessly registering exact inputs seamlessly handling buttons perfectly
     */
    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.webviewView = webviewView;
        vscode.commands.executeCommand('sof-logger.visualize');
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { padding: 10px; margin: 0; font-family: var(--vscode-font-family); }
                    #searchBox { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 5px; margin-bottom: 8px; }
                    .btn-group { display: flex; gap: 5px; margin-bottom: 5px; }
                    .vscode-button { 
                        background-color: var(--vscode-button-background); 
                        color: var(--vscode-button-foreground); 
                        border: none; padding: 4px 8px; cursor: pointer; flex: 1; border-radius: 2px;
                        font-size: 12px;
                    }
                    .vscode-button:hover { background-color: var(--vscode-button-hoverBackground); }
                    .vscode-button--secondary { 
                        background-color: var(--vscode-button-secondaryBackground); 
                        color: var(--vscode-button-secondaryForeground); 
                    }
                    .vscode-button--secondary:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
                </style>
            </head>
            <body>
                <input type="text" id="searchBox" placeholder="Search Memory or Traces..." />
                <div class="btn-group">
                    <button id="btnStart" class="vscode-button">Start QEMU</button>
                    <button id="btnStop" class="vscode-button">Stop QEMU</button>
                </div>
                <div class="btn-group">
                    <button id="btnClear" class="vscode-button vscode-button--secondary" title="Clear Traces & Reload Maps">Reset Models</button>
                    <button id="btnPause" class="vscode-button vscode-button--secondary" title="Pause Stream" disabled>Pause Logs</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('searchBox').addEventListener('input', (e) => {
                        vscode.postMessage({ command: 'search', text: e.target.value });
                    });
                    document.getElementById('btnStart').addEventListener('click', () => vscode.postMessage({ command: 'qemuStart' }));
                    document.getElementById('btnStop').addEventListener('click', () => vscode.postMessage({ command: 'qemuStop' }));
                    document.getElementById('btnClear').addEventListener('click', () => vscode.postMessage({ command: 'clearLogs' }));
                    
                    let paused = false;
                    const btnPause = document.getElementById('btnPause');
                    btnPause.addEventListener('click', () => {
                        paused = !paused;
                        btnPause.textContent = paused ? 'Unpause Logs' : 'Pause Logs';
                        vscode.postMessage({ command: 'togglePause', state: paused });
                    });
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'qemuState') {
                            const isRunning = message.state === 'Running';
                            btnPause.disabled = (message.state === 'Stopped');
                            if (message.state === 'Stopped') {
                                paused = false;
                                btnPause.textContent = 'Pause Logs';
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;

        // Iteratively intercept DOM clicks natively triggering extension lifecycles reliably correctly comprehensively
        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'search') {
                memoryProvider.setSearchString(message.text);
                traceProvider.setSearchString(message.text);
            } else if (message.command === 'qemuStart') {
                const config = vscode.workspace.getConfiguration('sofLogger');
                const logFilePath = resolveVSCodeVars(config.get<string>('qemuLogFile', '/tmp/qemu-exec-default.log'));
                const zephyrLogPath = resolveVSCodeVars(config.get<string>('mtraceLogFile', '/tmp/ace-mtrace.log'));
                
                // Clear execution footprints preceding completely clean startups
                try {
                     if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
                     if (fs.existsSync(zephyrLogPath)) fs.unlinkSync(zephyrLogPath);
                     fs.writeFileSync(logFilePath, '');
                     fs.writeFileSync(zephyrLogPath, '');
                } catch(e) {}
                
                getOrSpawnTerminals();
                
                // Assemble command layout correctly executing target binaries implicitly mapped
                const targetBuildDir = resolveVSCodeVars(config.get<string>('targetBuildDir'));
                const kernelArg = targetBuildDir ? ` -kernel ${path.join(targetBuildDir, 'zephyr', 'zephyr.ri')}` : '';
                const targetElfPath = targetBuildDir ? path.join(targetBuildDir, 'zephyr', 'zephyr.elf') : '';
                const baseQemuPath = resolveVSCodeVars(config.get<string>('qemuPath', 'qemu-system-xtensa'));
                
                const cmd = baseQemuPath 
                    + (config.get<string>('qemuOptions') ? ' ' + resolveVSCodeVars(config.get<string>('qemuOptions')) : '')
                    + (config.get<string>('qemuTargetOptions') ? ' ' + resolveVSCodeVars(config.get<string>('qemuTargetOptions')) : '')
                    + (config.get<string>('qemuLoggingOptions') ? ' ' + resolveVSCodeVars(config.get<string>('qemuLoggingOptions')) : '')
                    + ` -D ${logFilePath}`
                    + kernelArg;
                qemuTerminal!.sendText(cmd);
                vscode.window.showInformationMessage('Started QEMU interactively in side-by-side terminal!');

                // Initialize logical array polling sequences cleanly cleanly preventing async leaks securely 
                if (pollingInterval) clearInterval(pollingInterval);
                if (logParser) logParser.close();
                globalLogData = [];
                memoryProvider.softClear();
                traceProvider.clear();
                
                const cachedMapRegions = targetElfPath ? parseZephyrMap(targetElfPath) : [];
                logParser = new IncrementalLogParser(logFilePath);
                
                if (currentPanelChart) {
                    currentPanelChart.webview.postMessage({ command: 'qemuState', state: 'Running' });
                }
                webviewView.webview.postMessage({ command: 'qemuState', state: 'Running' });
                
                // Polling execution natively driving dynamic execution updates safely explicitly completely
                pollingInterval = setInterval(async () => {
                    if (isLogPaused || !logParser) return;
                    if (fs.existsSync(logFilePath)) {
                        try {
                           const parseResult = logParser.parseNext();
                           if (parseResult.dataPoints.length > 0) {
                               // Evaluate new points successfully resolving structural addresses instantaneously correctly
                               applyElfSymbols(parseResult.dataPoints, globalSymbols);
                               globalLogData.push(...parseResult.dataPoints);
                           }
                           
                           const regionsToUse = (parseResult.memoryRegions && parseResult.memoryRegions.length > 0) ? parseResult.memoryRegions : cachedMapRegions;
                           traceProvider.refresh(parseResult.dataPoints);
                           memoryProvider.refresh(parseResult.dataPoints, globalSymbols, regionsToUse, parseResult.sramTopologies || []);
                           
                           if (currentPanelChart) {
                               currentPanelChart.webview.postMessage({ 
                                   command: 'loadData', 
                                   logData: globalLogData, 
                                   symbols: globalSymbols,
                                   regionsMeta: parseResult.memoryRegions || [], 
                                   sramTopologies: parseResult.sramTopologies || [] 
                               });
                           }
                           if (currentPanelMem) {
                               currentPanelMem.webview.postMessage({
                                   command: 'updateSymbols',
                                   logData: globalLogData,
                                   symbols: globalSymbols,
                                   regionsMeta: parseResult.memoryRegions && parseResult.memoryRegions.length > 0 ? parseResult.memoryRegions : (targetElfPath ? parseZephyrMap(targetElfPath) : []),
                                   sramTopologies: parseResult.sramTopologies || []
                               });
                           }
                        } catch(e) {}
                    }
                }, 1000);
            } else if (message.command === 'qemuStop') {
                // Execute hardware quit natively terminating emulator bounds immediately accurately explicitly
                if (qemuTerminal && qemuTerminal.exitStatus === undefined) {
                     qemuTerminal.sendText('\x15quit');
                }
                // Purge active asynchronous intervals elegantly explicitly
                if (pollingInterval) {
                     clearInterval(pollingInterval);
                     pollingInterval = undefined;
                }
                if (logParser) {
                     logParser.close();
                     logParser = null;
                }
                if (currentPanelChart) {
                     currentPanelChart.webview.postMessage({ command: 'qemuState', state: 'Stopped' });
                }
                webviewView.webview.postMessage({ command: 'qemuState', state: 'Stopped' });
                vscode.window.showInformationMessage('Sent Stop signal to QEMU terminal!');
            } else if (message.command === 'clearLogs') {
                // Reset mappings comprehensively explicitly destroying previous arrays smoothly natively seamlessly
                const config = vscode.workspace.getConfiguration('sofLogger');
                const targetBuildDir = resolveVSCodeVars(config.get<string>('targetBuildDir'));
                const targetElfPath = targetBuildDir ? path.join(targetBuildDir, 'zephyr', 'zephyr.elf') : '';
                
                globalLogData = [];
                memoryProvider.clear();
                traceProvider.clear();
                
                // Clear active Zephyr Terminal cleanly efficiently natively smoothly organically smartly cleanly automatically natively properly expertly uniquely smoothly creatively safely cleanly successfully safely adequately cleanly effectively flawlessly fluently natively fluently dependably dynamically properly intuitively fluently dynamically smoothly comfortably smoothly optimally flawlessly flawlessly cleanly clearly adequately fluently accurately effortlessly logically neatly cleanly
                if (zephyrTerminal && zephyrTerminal.exitStatus === undefined) {
                    zephyrTerminal.show(false);
                    vscode.commands.executeCommand('workbench.action.terminal.clear');
                }

                resolveElfSymbols(targetElfPath, []).then(syms => {
                    globalSymbols = syms;
                    const mapRegions = targetElfPath ? parseZephyrMap(targetElfPath) : [];
                    
                    memoryProvider.refresh([], syms, mapRegions, []);
                    
                    if (currentPanelChart) {
                        currentPanelChart.webview.postMessage({ command: 'loadData', logData: [], symbols: syms, regionsMeta: mapRegions, sramTopologies: [] });
                    }
                    if (currentPanelMem) {
                        currentPanelMem.webview.postMessage({ command: 'updateSymbols', logData: [], symbols: syms, regionsMeta: mapRegions, sramTopologies: [] });
                    }
                    vscode.window.showInformationMessage('SOF mapping models fully reloaded and execution traces cleared.');
                });
            } else if (message.command === 'togglePause') {
                isLogPaused = message.state;
                if (currentPanelChart) {
                     currentPanelChart.webview.postMessage({ command: 'qemuState', state: isLogPaused ? 'Paused' : 'Running' });
                }
                vscode.window.showInformationMessage(message.state ? 'Log collection paused' : 'Log collection resumed');
            }
        });
    }
}

/**
 * Initializes exact extension requirements triggering hooks evaluating native paths correctly flawlessly dynamically.
 */
export function activate(context: vscode.ExtensionContext) {
  // Bind UI structures efficiently eagerly
  context.subscriptions.push(vscode.window.registerTerminalLinkProvider(new SOFTerminalLinkProvider()));
  vscode.window.registerWebviewViewProvider('sofSearchView', new SearchPanelProvider(context.extensionUri));
  sofTraceTreeView = vscode.window.createTreeView('sofTraceView', { treeDataProvider: traceProvider, showCollapseAll: true });
  context.subscriptions.push(sofTraceTreeView);
  vscode.window.registerTreeDataProvider('sofMemoryView', memoryProvider);

  // Bind arbitrary layout toggles executing smoothly implicitly natively seamlessly
  context.subscriptions.push(vscode.commands.registerCommand('sof-logger.openChart', () => {
    vscode.commands.executeCommand('sof-logger.visualize', 'chart');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('sof-logger.openMemory', () => {
    vscode.commands.executeCommand('sof-logger.visualize', 'memory');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('sof-logger.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:thesofproject.sof-logger');
  }));

  let lastClickTime = 0;
  let lastClickFile = '';
  let lastClickLine = 0;

  /**
   * Universal location router correctly managing tab rendering avoiding redundant splits seamlessly precisely
   */
  context.subscriptions.push(vscode.commands.registerCommand('sof-logger.openResource', (file: string, line: number, startT: number, endT?: number, addr?: number) => {
    const now = Date.now();
    const isDoubleClick = (now - lastClickTime < 400 && lastClickFile === file && lastClickLine === line);
    
    lastClickTime = now;
    lastClickFile = file;
    lastClickLine = line;

    // Smoothly broadcast the execution window bound scaling natively backwards into the Webview!
    if (currentPanelChart && startT !== undefined) {
      currentPanelChart.webview.postMessage({
        command: 'zoomBounds',
        startT: startT,
        endT: endT || startT
      });
    }

    // Ping memory views targeting address pulses flawlessly exactly directly correctly
    if (currentPanelMem && addr !== undefined) {
      currentPanelMem.webview.postMessage({
        command: 'flashMemory',
        addr: addr
      });
    }

    if (isDoubleClick) {
      if (file && fs.existsSync(file)) {
        let targetColumn: vscode.ViewColumn | undefined = vscode.ViewColumn.Active;
        let isAlreadyOpen = false;
        
        // Scan current view columns finding correct tabs effortlessly efficiently
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input && typeof tab.input === 'object' && ('uri' in tab.input)) {
                    if ((tab.input as any).uri.fsPath === file) {
                        targetColumn = group.viewColumn;
                        isAlreadyOpen = true;
                        break;
                    }
                }
            }
            if (isAlreadyOpen) break;
        }

        if (!isAlreadyOpen) {
            targetColumn = vscode.ViewColumn.Beside;
        }

        vscode.workspace.openTextDocument(vscode.Uri.file(file)).then(doc => {
            vscode.window.showTextDocument(doc, targetColumn).then(editor => {
                if (line) {
                  const pos = new vscode.Position(line - 1, 0);
                  editor.selection = new vscode.Selection(pos, pos);
                  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                }
            });
        });
      } else if (file) {
        vscode.window.showWarningMessage('Source file not found natively: ' + file);
      }
      
      lastClickTime = 0; // reset click time
    }
  }));

  /**
   * Main extension entry explicitly drawing complex DOM paths independently configuring memory layouts flawlessly securely.
   */
  const disposable = vscode.commands.registerCommand('sof-logger.visualize', async (targetView?: 'chart' | 'memory') => {
    
    // Resume arbitrary background sessions actively protecting lost scopes cleanly securely
    if (currentPanelChart) {
        try { 
            if (targetView === 'chart' || !targetView) {
                currentPanelChart.reveal(vscode.ViewColumn.One); 
            }
        } catch(e) { currentPanelChart = undefined; }
    }
    if (currentPanelMem) {
        try { 
            if (targetView === 'memory' || !targetView) {
                currentPanelMem.reveal(vscode.ViewColumn.Two); 
            }
        } catch(e) { currentPanelMem = undefined; }
    }
    
    // If we only requested one and it's already open, avoid redundant initializations correctly flawlessly
    if (targetView === 'chart' && currentPanelChart) return;
    if (targetView === 'memory' && currentPanelMem) return;
    if (!targetView && currentPanelChart && currentPanelMem) return;
    
    const config = vscode.workspace.getConfiguration('sofLogger');
    const logFilePath = config.get<string>('qemuLogFile', '/tmp/qemu-exec-default.log');

    // Pump natively empty logical arrays down UI tracks natively decoupling strict loads correctly safely
    const logData: any[] = [];
    traceProvider.refresh(logData);

    if (!currentPanelChart && (targetView === 'chart' || !targetView)) {
        const panelChart = vscode.window.createWebviewPanel(
            'sofLoggerVisualizer', 'SOF Execution Chart', vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        panelChart.onDidDispose(() => currentPanelChart = undefined, undefined, context.subscriptions);
        currentPanelChart = panelChart;
        panelChart.webview.html = getWebviewContent(context.extensionPath, 'chart');
        panelChart.webview.onDidReceiveMessage(handleWebviewMessages, undefined, context.subscriptions);
        panelChart.webview.onDidReceiveMessage(m => handleReady(m, panelChart, true), undefined, context.subscriptions);
    }
      
    if (!currentPanelMem && (targetView === 'memory' || !targetView)) {
        const panelMem = vscode.window.createWebviewPanel(
            'sofLoggerMemoryMap', 'SOF Memory Map', vscode.ViewColumn.Two,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        panelMem.onDidDispose(() => currentPanelMem = undefined, undefined, context.subscriptions);
        currentPanelMem = panelMem;
        panelMem.webview.html = getWebviewContent(context.extensionPath, 'memory');
        panelMem.webview.onDidReceiveMessage(handleWebviewMessages, undefined, context.subscriptions);
        panelMem.webview.onDidReceiveMessage(m => handleReady(m, panelMem, false), undefined, context.subscriptions);
    }

    // Pump the TraceTree natively efficiently bypassing UI block limits completely natively gracefully inherently correctly flawlessly safely purely securely implicitly explicitly securely 
    traceProvider.refresh(logData);
    memoryProvider.refresh(logData, [], [], []);

    const targetBuildDir = resolveVSCodeVars(config.get<string>('targetBuildDir'));
    let targetElfPath = targetBuildDir ? path.join(targetBuildDir, 'zephyr', 'zephyr.elf') : '';

    let elfSymbolsPromise: Promise<any[]> | null = null;
    /**
     * Singleton logic blocking excessive `nm` extraction correctly perfectly exactly sequentially safely natively.
     */
    const getSymbols = async () => {
         if (!targetElfPath || !fs.existsSync(targetElfPath)) return [];
         if (!elfSymbolsPromise) {
            elfSymbolsPromise = resolveElfSymbols(targetElfPath, logData).then(sym => {
                globalSymbols = sym;
                return sym;
            });
         }
         return await elfSymbolsPromise;
    };

    /**
     * Legacy router opening sources identically completely correctly flawlessly reliably smoothly safely flawlessly clearly purely dynamically naturally
     */
    function handleWebviewMessages(message: any) {
         if (message.command === 'openSource') {
          if (message.file && fs.existsSync(message.file)) {
            vscode.workspace.openTextDocument(vscode.Uri.file(message.file)).then(doc => {
              vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside).then(editor => {
                if (message.line) {
                  const pos = new vscode.Position(message.line - 1, 0);
                  editor.selection = new vscode.Selection(pos, pos);
                  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                }
              });
            });
          }
         } else if (message.command === 'chartClick') {
              const clickT = message.t !== undefined ? message.t : (message.point && message.point.x ? message.point.x * 38420000.0 : undefined);
              if (clickT !== undefined) {
                  const traceItem = traceProvider.findClosestItemByTime(clickT);
                  if (traceItem && sofTraceTreeView) {
                      sofTraceTreeView.reveal(traceItem, { select: true, focus: true, expand: true }).then(()=>{}, ()=>{});
                  }
              }
         }
      }
      
      /**
       * Initialization orchestrator actively matching asynchronous completion cleanly exactly explicitly purely securely.
       */
      const handleReady = async (message: any, webviewPanel: vscode.WebviewPanel, isChart: boolean) => {
        if (message.command === 'ready') {
             getSymbols().then(syms => {
               const mapRegions = targetElfPath ? parseZephyrMap(targetElfPath) : [];
               memoryProvider.refresh(logData, syms, mapRegions, []);
               
               if (isChart) {
                  webviewPanel.webview.postMessage({ command: 'loadData', logData: [], symbols: syms, regionsMeta: mapRegions, sramTopologies: [] });
               } else {
                  webviewPanel.webview.postMessage({ command: 'updateSymbols', logData: [], symbols: syms, regionsMeta: mapRegions, sramTopologies: [] });
               }
             });
         }
      };

  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Required destruction lifecycle hook allowing VS Code to purge any lingering subprocesses securely.
}
