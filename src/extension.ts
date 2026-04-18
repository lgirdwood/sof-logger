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
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to parse log file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
