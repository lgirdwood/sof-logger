import * as vscode from 'vscode';
import { IncrementalLogParser, MemoryRegion, SramTopology } from './parser';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';
import { resolveElfSymbols, applyElfSymbols, parseZephyrMap } from './elf';
import { TraceTreeProvider } from './providers/TraceTreeProvider';
import { MemoryTreeProvider } from './providers/MemoryTreeProvider';

let zephyrTerminal: vscode.Terminal | undefined;
let qemuTerminal: vscode.Terminal | undefined;
let currentPanelChart: vscode.WebviewPanel | undefined;
let currentPanelMem: vscode.WebviewPanel | undefined;
let traceProvider = new TraceTreeProvider();
let memoryProvider = new MemoryTreeProvider();
let globalSymbols: any[] = [];
let isLogPaused = false;
let pollingInterval: NodeJS.Timeout | undefined;
let globalLogData: any[] = [];
let logParser: IncrementalLogParser | null = null;

class SOFTerminalLinkProvider implements vscode.TerminalLinkProvider {
    provideTerminalLinks(context: vscode.TerminalLinkContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalLink[]> {
        const line = context.line;
        const links: vscode.TerminalLink[] = [];
        const regex = /0x[0-9a-fA-F]+/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const addrStr = match[0];
            const addr = parseInt(addrStr, 16);
            if (!isNaN(addr) && globalSymbols.length > 0) {
                let closestSymbol = null;
                for (const sym of globalSymbols) {
                    if (sym.size > 0 && addr >= sym.addr && addr < sym.addr + sym.size) {
                        closestSymbol = sym;
                        break;
                    }
                }
                if (closestSymbol) {
                    const offset = addr - closestSymbol.addr;
                    links.push({
                        startIndex: match.index,
                        length: match[0].length,
                        tooltip: `Symbol: ${closestSymbol.name} + 0x${offset.toString(16).toUpperCase()}\nSection: .${closestSymbol.sect}\nSize: ${closestSymbol.size} Bytes\n(Ctrl+Click to Open Source)`,
                        targetData: { file: closestSymbol.file, line: closestSymbol.line }
                    } as any);
                }
            }
        }
        return links;
    }
    
    handleTerminalLink(link: any): vscode.ProviderResult<void> {
        const data = link.targetData;
        if (data.file && fs.existsSync(data.file)) {
            vscode.workspace.openTextDocument(vscode.Uri.file(data.file)).then(doc => {
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

class SearchPanelProvider implements vscode.WebviewViewProvider {
    public webviewView?: vscode.WebviewView;
    constructor(private readonly extensionUri: vscode.Uri) {}

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

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'search') {
                memoryProvider.setSearchString(message.text);
                traceProvider.setSearchString(message.text);
            } else if (message.command === 'qemuStart') {
                const config = vscode.workspace.getConfiguration('sofLogger');
                const logFilePath = resolveVSCodeVars(config.get<string>('qemuLogFile', '/tmp/qemu-exec-default.log'));
                const zephyrLogPath = resolveVSCodeVars(config.get<string>('mtraceLogFile', '/tmp/ace-mtrace.log'));
                try {
                     if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
                     if (fs.existsSync(zephyrLogPath)) fs.unlinkSync(zephyrLogPath);
                     fs.writeFileSync(logFilePath, '');
                     fs.writeFileSync(zephyrLogPath, '');
                } catch(e) {}
                
                getOrSpawnTerminals();
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
                
                pollingInterval = setInterval(async () => {
                    if (isLogPaused || !logParser) return;
                    if (fs.existsSync(logFilePath)) {
                        try {
                           const parseResult = logParser.parseNext();
                           if (parseResult.dataPoints.length > 0) {
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
                if (qemuTerminal && qemuTerminal.exitStatus === undefined) {
                     qemuTerminal.sendText('\x15quit');
                }
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
                const config = vscode.workspace.getConfiguration('sofLogger');
                const targetBuildDir = resolveVSCodeVars(config.get<string>('targetBuildDir'));
                const targetElfPath = targetBuildDir ? path.join(targetBuildDir, 'zephyr', 'zephyr.elf') : '';
                
                globalLogData = [];
                memoryProvider.clear();
                traceProvider.clear();
                
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

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.window.registerTerminalLinkProvider(new SOFTerminalLinkProvider()));
  
  vscode.window.registerWebviewViewProvider('sofSearchView', new SearchPanelProvider(context.extensionUri));
  vscode.window.registerTreeDataProvider('sofTraceView', traceProvider);
  vscode.window.registerTreeDataProvider('sofMemoryView', memoryProvider);

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

  const disposable = vscode.commands.registerCommand('sof-logger.visualize', async (targetView?: 'chart' | 'memory') => {
    
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
    
    // If we only requested one and it's already open, we can just return
    if (targetView === 'chart' && currentPanelChart) return;
    if (targetView === 'memory' && currentPanelMem) return;
    if (!targetView && currentPanelChart && currentPanelMem) return;
    
    const config = vscode.workspace.getConfiguration('sofLogger');
    const logFilePath = config.get<string>('qemuLogFile', '/tmp/qemu-exec-default.log');

    // Pump natively empty logical arrays down UI tracks natively decoupling strict loads
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

    // Pump the TraceTree natively efficiently bypassing UI block limits completely natively
    traceProvider.refresh(logData);
    memoryProvider.refresh(logData, [], [], []);

    const targetBuildDir = resolveVSCodeVars(config.get<string>('targetBuildDir'));
    let targetElfPath = targetBuildDir ? path.join(targetBuildDir, 'zephyr', 'zephyr.elf') : '';

    let elfSymbolsPromise: Promise<any[]> | null = null;
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
         }
      }
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
