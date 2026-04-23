import * as vscode from 'vscode';
import { parseLogFile, MemoryRegion, SramTopology } from './parser';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';
import { resolveElfSymbols } from './elf';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('sof-logger.visualize', async () => {
    const logFilePath = '/tmp/qemu-exec-default.log';

    if (!fs.existsSync(logFilePath)) {
      vscode.window.showErrorMessage(`Log file not found: ${logFilePath}`);
      return;
    }

    try {
      const parseResult = await parseLogFile(logFilePath);
      const logData = parseResult.dataPoints;
      
      // [FEATURE] Terminal Telemetry Ingestion
      // Attempts to ingest Zephyr core output strings. Wrapped entirely isolated 
      // preventing file lock failures from terminating tracing visualizers fatally!
      let zephyrLog = '';
      const zephyrLogPath = '/tmp/ace-mtrace.log';
      try {
        if (fs.existsSync(zephyrLogPath)) {
            zephyrLog = fs.readFileSync(zephyrLogPath, 'utf8');
        }
      } catch (logErr: any) {
        vscode.window.showWarningMessage(`Term log read failed (non-fatal): ${logErr.message}`);
        console.error('Zephyr log read error:', logErr);
      }

      // Create and show the webview instantly
      const panel = vscode.window.createWebviewPanel(
        'sofLoggerVisualizer',
        'SOF QEMU Log Visualizer',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      panel.webview.html = getWebviewContent(context.extensionPath);

      let targetElfPath = parseResult.elfPath;
      if (targetElfPath && targetElfPath.endsWith('.ri')) {
        targetElfPath = targetElfPath.replace(/\.ri$/i, '.elf');
      }

      panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'ready') {
            panel.webview.postMessage({
                command: 'loadData',
                logData: logData,
                symbols: [],
                regionsMeta: parseResult.memoryRegions,
                sramTopologies: parseResult.sramTopologies,
                zephyrLog: zephyrLog
            });
            
            if (!targetElfPath) {
              vscode.window.showWarningMessage('ParseResult failed to find any ELF strings in QEMU log!');
            } else if (!fs.existsSync(targetElfPath)) {
              vscode.window.showWarningMessage('Parsed ELF path does not exist on disk: ' + targetElfPath);
            } else {
              // Fire and forget without blocking!
              resolveElfSymbols(targetElfPath, logData, panel, parseResult.memoryRegions, parseResult.sramTopologies, zephyrLog);
            }
        } else if (message.command === 'openSource') {
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
          } else {
            vscode.window.showWarningMessage('Source file not found natively: ' + message.file);
          }
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
