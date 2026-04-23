import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export async function resolveElfSymbols(
  elfPath: string,
  logData: any[],
  panel: vscode.WebviewPanel,
  memoryRegions: any[] = [],
  sramTopologies: any[] = [],
  zephyrLog = ''
) {
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Loading ELF Symbols (-l formatting)...",
    cancellable: false
  }, async (progress) => {
    return new Promise<void>((resolve) => {
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
        
        panel.webview.postMessage({ command: 'updateSymbols', logData: logData, symbols: symbols });
        vscode.window.showInformationMessage('Successfully resolved ' + symbols.length + ' ELF format symbols natively via: ' + path.basename(elfPath));
        resolve();
      });
    });
  });
}
