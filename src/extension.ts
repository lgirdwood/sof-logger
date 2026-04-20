import * as vscode from 'vscode';
import { parseLogFile, MemoryRegion, SramTopology } from './parser';
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

    async function resolveElfSymbols(elfPath: string, logData: any[], panel: vscode.WebviewPanel, memoryRegions: MemoryRegion[] = [], sramTopologies: SramTopology[] = []) {
      return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading ELF Symbols (-l formatting)...",
        cancellable: false
      }, async (progress) => {
        return new Promise<void>((resolve) => {
          const cp = require('child_process');
          cp.exec(`nm -nS -l ${elfPath}`, { maxBuffer: 1024 * 1024 * 50 }, (error: any, stdout: string) => {
            if (error) {
              vscode.window.showErrorMessage('Error reading elf: ' + error.message);
              resolve();
              return;
            }
            const symbols: {addr: number, size: number, name: string, file?: string, line?: number, sect?: string}[] = [];
            const lines = stdout.split('\n');
            for (const rawLine of lines) {
              const rawParts = rawLine.trim().split(/\t/);
              const lineData = rawParts[0];
              const fileData = rawParts.length > 1 ? rawParts[1] : undefined;
              const parts = lineData.trim().split(/\s+/);

              let file, lineNum;
              if (fileData) {
                 const idx = fileData.lastIndexOf(':');
                 if (idx !== -1) {
                    file = fileData.substring(0, idx);
                    lineNum = parseInt(fileData.substring(idx + 1), 10);
                 } else {
                    file = fileData;
                 }
              }

              let addrStr, sizeStr, typeChar, nameStr;
              if (parts.length >= 4) {
                 addrStr = parts[0]; sizeStr = parts[1]; typeChar = parts[2]; nameStr = parts[3];
              } else if (parts.length === 3) {
                 addrStr = parts[0]; sizeStr = "0"; typeChar = parts[1]; nameStr = parts[2];
              } else {
                 continue;
              }
              
              const tChar = typeChar.toLowerCase();
              if (['t', 'w', 'b', 'd', 'r', 'c', 'v', 'g', 'a'].includes(tChar)) {
                  let sect = 'text';
                  if (tChar === 'r') sect = 'rodata';
                  else if (tChar === 'd' || tChar === 'v' || tChar === 'g') sect = 'data';
                  else if (tChar === 'b' || tChar === 'c') sect = 'bss';
                  
                  symbols.push({
                    addr: parseInt(addrStr, 16),
                    size: parseInt(sizeStr, 16),
                    name: nameStr,
                    file: file,
                    line: lineNum,
                    sect: sect
                  });
              }
            }

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
                    if (sym.file) d.file = sym.file;
                    if (sym.line) d.line = sym.line;
                  }
                }
              }
            }
            
            panel.webview.html = getWebviewContent(logData, symbols, memoryRegions, sramTopologies);
            vscode.window.showInformationMessage('Successfully resolved ' + symbols.length + ' ELF format symbols natively via: ' + path.basename(elfPath));
            resolve();
          });
        });
      });
    }

    try {
      const parseResult = await parseLogFile(logFilePath);
      const logData = parseResult.dataPoints;

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

      panel.webview.html = getWebviewContent(logData, [], parseResult.memoryRegions, parseResult.sramTopologies);

      let targetElfPath = parseResult.elfPath;
      if (targetElfPath && targetElfPath.endsWith('.ri')) {
        targetElfPath = targetElfPath.replace(/\.ri$/i, '.elf');
      }

      if (!targetElfPath) {
        vscode.window.showWarningMessage('ParseResult failed to find any ELF strings in QEMU log!');
      } else if (!fs.existsSync(targetElfPath)) {
        vscode.window.showWarningMessage('Parsed ELF path does not exist on disk: ' + targetElfPath);
      } else {
        // Fire and forget without blocking!
        resolveElfSymbols(targetElfPath, logData, panel, parseResult.memoryRegions, parseResult.sramTopologies);
      }

      panel.webview.onDidReceiveMessage(async message => {
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

export function deactivate() {}
