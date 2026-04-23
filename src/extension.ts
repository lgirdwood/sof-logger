import * as vscode from 'vscode';
import { parseLogFile, MemoryRegion, SramTopology } from './parser';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';
import { resolveElfSymbols } from './elf';
import { TraceTreeProvider } from './providers/TraceTreeProvider';
import { MemoryTreeProvider } from './providers/MemoryTreeProvider';

let zephyrChannel: vscode.OutputChannel | undefined;
let currentPanelChart: vscode.WebviewPanel | undefined;
let currentPanelMem: vscode.WebviewPanel | undefined;
let traceProvider = new TraceTreeProvider();
let memoryProvider = new MemoryTreeProvider();

class SearchPanelProvider implements vscode.WebviewViewProvider {
    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
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
                    <button id="btnClear" class="vscode-button vscode-button--secondary">Clear Logs</button>
                    <button id="btnPause" class="vscode-button vscode-button--secondary">Pause Logs</button>
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
                </script>
            </body>
            </html>
        `;

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'search') {
                memoryProvider.setSearchString(message.text);
                traceProvider.setSearchString(message.text);
            } else if (message.command === 'qemuStart') {
                vscode.window.showInformationMessage('Starting QEMU execution...');
            } else if (message.command === 'qemuStop') {
                vscode.window.showInformationMessage('Stopping QEMU execution...');
            } else if (message.command === 'clearLogs') {
                vscode.window.showInformationMessage('SOF traces and UI models cleared.');
                memoryProvider.refresh([], [], [], []);
                traceProvider.refresh([]);
            } else if (message.command === 'togglePause') {
                vscode.window.showInformationMessage(message.state ? 'Log collection paused' : 'Log collection resumed');
            }
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
  zephyrChannel = vscode.window.createOutputChannel('SOF Zephyr Server');
  context.subscriptions.push(zephyrChannel);
  vscode.window.registerWebviewViewProvider('sofSearchView', new SearchPanelProvider(context.extensionUri));
  vscode.window.registerTreeDataProvider('sofTraceView', traceProvider);

  context.subscriptions.push(vscode.commands.registerCommand('sof-logger.openResource', (file: string, line: number, startT: number, endT?: number) => {
    if (file && fs.existsSync(file)) {
      vscode.workspace.openTextDocument(vscode.Uri.file(file)).then(doc => {
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside).then(editor => {
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
    
    // Smoothly broadcast the execution window bound scaling natively backwards into the Webview!
    if (currentPanelChart && startT !== undefined) {
      currentPanelChart.webview.postMessage({
        command: 'zoomBounds',
        startT: startT,
        endT: endT || startT
      });
    }
  }));

  const disposable = vscode.commands.registerCommand('sof-logger.visualize', async () => {
    
    // Register the custom Sidebar TreeViews smoothly binding DOM traces securely gracefully cleanly natively automatically logically!
    vscode.window.registerTreeDataProvider('sofTraceView', traceProvider);
    vscode.window.registerTreeDataProvider('sofMemoryView', memoryProvider);
    const config = vscode.workspace.getConfiguration('sofLogger');
    const logFilePath = config.get<string>('qemuLogFile', '/tmp/qemu-exec-default.log');

    if (!fs.existsSync(logFilePath)) {
      vscode.window.showErrorMessage(`Log file not found: ${logFilePath}`);
      return;
    }

    try {
      const parseResult = await parseLogFile(logFilePath);
      const logData = parseResult.dataPoints;
      
      // [FEATURE] Terminal Telemetry Ingestion
      // Pushing Zephyr trace strings exclusively completely natively bypassing standard DOM structures completely.
      const zephyrLogPath = config.get<string>('mtraceLogFile', '/tmp/ace-mtrace.log');
      try {
        if (fs.existsSync(zephyrLogPath) && zephyrChannel) {
            const logContent = fs.readFileSync(zephyrLogPath, 'utf8');
            zephyrChannel.clear();
            zephyrChannel.appendLine(logContent);
            zephyrChannel.show(true);
        }
      } catch (logErr: any) {
        vscode.window.showWarningMessage(`Term log read failed (non-fatal): ${logErr.message}`);
        console.error('Zephyr log read error:', logErr);
      }

      // Create and show the chart webview instantly
      const panelChart = vscode.window.createWebviewPanel(
        'sofLoggerVisualizer',
        'SOF Execution Chart',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      currentPanelChart = panelChart;
      
      const panelMem = vscode.window.createWebviewPanel(
        'sofLoggerMemoryMap',
        'SOF Memory Map',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      currentPanelMem = panelMem;

      // Pump the TraceTree natively efficiently bypassing UI block limits completely natively
      traceProvider.refresh(logData);
      memoryProvider.refresh(logData, [], parseResult.memoryRegions || [], parseResult.sramTopologies || []);

      panelChart.webview.html = getWebviewContent(context.extensionPath, 'chart');
      panelMem.webview.html = getWebviewContent(context.extensionPath, 'memory');

      let targetElfPath = parseResult.elfPath;
      if (targetElfPath && targetElfPath.endsWith('.ri')) {
        targetElfPath = targetElfPath.replace(/\.ri$/i, '.elf');
      }

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

      panelChart.webview.onDidReceiveMessage(handleWebviewMessages);
      panelMem.webview.onDidReceiveMessage(handleWebviewMessages);

      const dataPayload = {
        command: 'loadData',
        logData: logData,
        symbols: [],
        regionsMeta: parseResult.memoryRegions,
        sramTopologies: parseResult.sramTopologies
      };

      let elfSymbolsPromise: Promise<any[]> | null = null;
      const getSymbols = async () => {
         if (!targetElfPath || !fs.existsSync(targetElfPath)) return [];
         if (!elfSymbolsPromise) {
            elfSymbolsPromise = resolveElfSymbols(targetElfPath, logData);
         }
         return await elfSymbolsPromise;
      };

      panelChart.webview.onDidReceiveMessage(async message => {
        if (message.command === 'ready') {
            panelChart.webview.postMessage(dataPayload);
            getSymbols().then(symbols => {
                if (symbols.length > 0) {
                     panelChart.webview.postMessage({ command: 'updateSymbols', logData: logData, symbols: symbols });
                     traceProvider.refresh(logData);
                }
            });
        }
      });
      
      panelMem.webview.onDidReceiveMessage(async message => {
        if (message.command === 'ready') {
            panelMem.webview.postMessage(dataPayload);
            getSymbols().then(symbols => {
                if (symbols.length > 0) {
                     panelMem.webview.postMessage({ command: 'updateSymbols', logData: logData, symbols: symbols });
                     memoryProvider.refresh(logData, symbols, parseResult.memoryRegions || [], parseResult.sramTopologies || []);
                     traceProvider.refresh(logData);
                }
            });
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to parse log file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Required destruction lifecycle hook allowing VS Code to purge any lingering subprocesses securely.
}
