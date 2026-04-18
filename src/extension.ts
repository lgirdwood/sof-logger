import * as vscode from 'vscode';
import { parseLogFile } from './parser';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('sof-logger.visualize', async () => {
    const logFilePath = '/tmp/qemu-exec-default.log';

    if (!fs.existsSync(logFilePath)) {
      vscode.window.showErrorMessage(`Log file not found: ${logFilePath}`);
      return;
    }

    try {
      const logData = await parseLogFile(logFilePath);

      // Create and show the webview
      const panel = vscode.window.createWebviewPanel(
        'sofLoggerVisualizer',
        'SOF QEMU Log Visualizer',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      panel.webview.html = getWebviewContent(logData);

      panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'loadElf') {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'ELF files': ['elf'] }
          });
          if (uris && uris[0]) {
            const cp = require('child_process');
            cp.exec(`nm -nS ${uris[0].fsPath}`, { maxBuffer: 1024 * 1024 * 50 }, (error: any, stdout: string) => {
              if (error) {
                vscode.window.showErrorMessage('Error reading elf: ' + error.message);
                return;
              }
              const symbols: {addr: number, size: number, name: string}[] = [];
              const lines = stdout.split('\n');
              for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4 && parts[2].toLowerCase() === 't') {
                  symbols.push({
                    addr: parseInt(parts[0], 16),
                    size: parseInt(parts[1], 16),
                    name: parts[3]
                  });
                } else if (parts.length === 3 && parts[1].toLowerCase() === 't') {
                  symbols.push({
                    addr: parseInt(parts[0], 16),
                    size: 0,
                    name: parts[2]
                  });
                }
              }

              // Resolve addresses iteratively
              for (const d of logData) {
                if (d.funcAddr !== undefined) {
                  const addr = d.funcAddr;
                  let low = 0, high = symbols.length - 1;
                  let closestIndex = -1;
                  while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    if (symbols[mid].addr <= addr) {
                      closestIndex = mid;
                      low = mid + 1;
                    } else {
                      high = mid - 1;
                    }
                  }
                  if (closestIndex !== -1) {
                    const sym = symbols[closestIndex];
                    if (sym.size > 0 && addr >= sym.addr + sym.size) {
                      // outside strictly bound size
                    } else {
                      d.funcName = sym.name;
                    }
                  }
                }
              }
              
              panel.webview.html = getWebviewContent(logData);
              vscode.window.showInformationMessage('Successfully resolved ' + symbols.length + ' ELF format symbols!');
            });
          }
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to parse log file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
